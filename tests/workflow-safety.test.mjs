import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(".");

async function workflow(name) {
  return readFile(resolve(root, ".github/workflows", name), "utf8");
}

function topLevelBlock(source, key) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line === key);
  if (start < 0) return "";
  const end = lines.findIndex((line, index) => index > start && /^\S/.test(line));
  return lines.slice(start, end < 0 ? undefined : end).join("\n");
}

function jobBlock(source, name) {
  const jobs = topLevelBlock(source, "jobs:").split(/\r?\n/);
  const start = jobs.findIndex((line) => line === `  ${name}:`);
  if (start < 0) return "";
  const end = jobs.findIndex((line, index) => index > start && /^ {2}[a-z][\w-]*:$/.test(line));
  return jobs.slice(start, end < 0 ? undefined : end).join("\n");
}

test("CI accepts an explicit dispatch only for the requested commit", async () => {
  const source = await workflow("ci.yml");
  assert.match(topLevelBlock(source, "on:"), /workflow_dispatch:\s+inputs:\s+expected_sha:/);
  const policy = jobBlock(source, "pr-policy");
  assert.match(policy, /ACTUAL_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(policy, /if \[ "\$ACTUAL_SHA" != "\$EXPECTED_SHA" \]/);
});

test("Autofix isolates pull request execution from write capabilities", async () => {
  const source = await workflow("autofix.yml");
  assert.match(topLevelBlock(source, "on:"), /pull_request_target:/);
  const prepare = jobBlock(source, "prepare");
  const write = jobBlock(source, "write");
  const validate = jobBlock(source, "validate");
  const artifactBinding = "autofix-${{ github.event.pull_request.number }}-${{ github.event.pull_request.head.sha }}";
  assert.equal(source.split(artifactBinding).length - 1, 2);
  assert.match(prepare, /permissions:\s+contents: read/);
  assert.match(prepare, /persist-credentials: false/);
  assert.match(prepare, /npm run check:quick/);
  assert.doesNotMatch(prepare, /contents: write|actions: write|pull-requests: write/);
  assert.match(write, /contents: write/);
  assert.match(write, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}\s+path: trusted/);
  assert.match(write, /autofix-contract\.mjs head "\$EXPECTED_SHA" "\$current"/);
  assert.equal(write.split("autofix-contract.mjs head").length - 1, 2);
  assert.match(write, /\[\.head\.sha, \.state\] \| @tsv/);
  assert.match(write, /path: source/);
  assert.match(write, /name: autofix-\$\{\{ github\.event\.pull_request\.number \}\}-\$\{\{/);
  assert.match(write, /--slurp .*pulls\/\$NUMBER\/files/);
  assert.match(write, /git apply --index/);
  assert.match(write, /git diff --cached --name-status -z/);
  assert.match(write, /autofix-contract\.mjs patch/);
  assert.doesNotMatch(write, /npm (?:ci|run)|npx eslint/);
  assert.match(validate, /actions: write/);
  assert.match(validate, /\[ "\$current" != "\$AUTOFIX_SHA" \]/);
  assert.match(validate, /"\$state" != open/);
  assert.match(validate, /gh workflow run ci\.yml/);
  assert.doesNotMatch(validate, /actions\/checkout|npm (?:ci|run)/);
});

test("main health is serial, latest-run owned, and marker deduplicated", async () => {
  const source = await workflow("ci-triage.yml");
  const production = jobBlock(source, "production-health");
  assert.match(production, /group: production-health-\$\{\{ github\.repository \}\}/);
  assert.match(production, /cancel-in-progress: false/);
  assert.match(production, /ci-triage-contract\.mjs latest-run/);
  assert.equal(production.split("ci-triage-contract.mjs latest-run").length - 1, 2);
  assert.match(production, /CURRENT_ATTEMPT: \$\{\{ github\.event\.workflow_run\.run_attempt \}\}/);
  assert.match(production, /CURRENT_CONCLUSION: \$\{\{ github\.event\.workflow_run\.conclusion \}\}/);
  assert.match(production, /--json databaseId,headSha,attempt,status,conclusion/);
  assert.match(production, /steps\.owner\.outputs\.owns == 'true'/);
  assert.match(production, /ci-triage-contract\.mjs production-issue/);
  assert.doesNotMatch(production, /select\(\.title/);
});

test("PR triage includes workflow-dispatched autofix validation", async () => {
  const source = await workflow("ci-triage.yml");
  const pullRequest = jobBlock(source, "pull-request-triage");
  assert.match(pullRequest, /workflow_run\.event == 'workflow_dispatch'/);
  assert.match(pullRequest, /commits\/\$HEAD_SHA\/pulls/);
  assert.match(pullRequest, /ci-triage-contract\.mjs pull-requests/);
  assert.match(pullRequest, /while read -r number/);
  assert.match(pullRequest, /ci-triage-contract\.mjs classifier/);
});
