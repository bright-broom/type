import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), "utf8");
const workflow = (path) => parse(read(path));

test("repository hook applies a fail-closed Bash pre-tool policy", () => {
  const hooks = JSON.parse(read(".codex/hooks.json"));
  const preToolUse = hooks.hooks.PreToolUse;
  assert.equal(preToolUse.length, 1);
  assert.equal(preToolUse[0].matcher, "^Bash$");
  assert.match(preToolUse[0].hooks[0].command, /pre_tool_use_policy\.py/);
  assert.match(preToolUse[0].hooks[0].commandWindows, /pre_tool_use_policy\.py/);
  assert.match(preToolUse[0].hooks[0].commandWindows, /^powershell /);
  assert.doesNotMatch(preToolUse[0].hooks[0].commandWindows, /\$\(git/);
});

test("Codex advisory is manually selected and stays read-only", () => {
  const advisory = workflow(".github/workflows/codex-ci-advisory.yml");
  assert.deepEqual(Object.keys(advisory.jobs), ["advise"]);
  assert.deepEqual(advisory.permissions, { actions: "read", contents: "read" });
  assert.equal(advisory.on.workflow_dispatch.inputs.run_id.required, true);
  assert.equal(advisory.on.workflow_run, undefined);

  const adviseSteps = advisory.jobs.advise.steps;
  const checkout = adviseSteps.find((step) => step.uses?.startsWith("actions/checkout@"));
  assert.equal(checkout.uses, "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1");
  assert.equal(checkout.with.ref, "${{ github.event.repository.default_branch }}");
  assert.equal(checkout.with["persist-credentials"], false);
  const codex = adviseSteps.find((step) => step.id === "codex");
  assert.equal(codex.uses, "openai/codex-action@c385816875cc2fc8e033ed9d1cba96f8c331210e");
  assert.equal(codex.with["permission-profile"], ":read-only");
  assert.equal(codex.with["safety-strategy"], "drop-sudo");
  assert.equal(codex.with["output-file"], "codex-ci-advisory.md");
  assert.ok(adviseSteps.some((step) => step.run?.includes("triage-ci-failure.mjs")));
  assert.ok(adviseSteps.some((step) => step.run?.includes('!= "failure"')));
  assert.doesNotMatch(JSON.stringify(advisory), /contents":"write|pull-requests":"write|gh pr comment|gh pr merge/);
});

test("weekly metrics are read-only, scheduled, and retained as evidence", () => {
  const metrics = workflow(".github/workflows/quality-metrics.yml");
  assert.equal(metrics.on.schedule[0].cron, "17 0 * * 1");
  assert.equal(metrics.on.workflow_dispatch, null);
  assert.deepEqual(metrics.permissions, { contents: "read" });
  assert.deepEqual(metrics.jobs.report.permissions, {
    actions: "read",
    contents: "read",
    "pull-requests": "read",
  });
  const upload = metrics.jobs.report.steps.at(-1);
  assert.equal(upload.uses, "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a");
  assert.equal(upload.with["retention-days"], 90);
  assert.doesNotMatch(JSON.stringify(metrics), /contents":"write|pull-requests":"write/);
});

test("unsafe Vercel CLI graph is not exposed as repository tooling", () => {
  const packageJson = JSON.parse(read("package.json"));
  assert.equal(packageJson.scripts["vercel:cli"], undefined);
  assert.equal(packageJson.devDependencies.vercel, undefined);
});
