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

test("CI runs manually for pull requests and once for the merged main revision", async () => {
  const source = await workflow("ci.yml");
  const trigger = topLevelBlock(source, "on:");
  assert.doesNotMatch(trigger, /pull_request:/);
  assert.match(trigger, /push:\s+branches: \[main\]/);
  assert.match(trigger, /workflow_dispatch:\s+inputs:\s+expected_sha:/);
  assert.match(trigger, /expected_sha:[\s\S]*required: true/);

  const fullCi = jobBlock(source, "full-ci");
  assert.match(fullCi, /name: Full CI/);
  assert.match(fullCi, /ACTUAL_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(fullCi, /if \[ "\$ACTUAL_SHA" != "\$EXPECTED_SHA" \]/);
  assert.match(fullCi, /commits\/\$\{SHA\}\/pulls/);
  assert.match(fullCi, /persist-credentials: false/);
  assert.match(fullCi, /cache: npm/);
  assert.match(fullCi, /run: npm ci/);
  assert.match(fullCi, /run: npm run check:ci/);
  assert.match(fullCi, /mcr\.microsoft\.com\/playwright:/);
  assert.equal(source.split("runs-on: ubuntu-latest").length - 1, 1);
});

test("Autofix is manually dispatched and isolates pull request execution from write capabilities", async () => {
  const source = await workflow("autofix.yml");
  const trigger = topLevelBlock(source, "on:");
  assert.doesNotMatch(trigger, /pull_request_target:/);
  assert.match(trigger, /workflow_dispatch:\s+inputs:\s+pull_request_number:/);
  assert.match(trigger, /expected_sha:/);
  const prepare = jobBlock(source, "prepare");
  const write = jobBlock(source, "write");
  const artifactBinding = "autofix-${{ inputs.pull_request_number }}-${{ inputs.expected_sha }}";
  assert.equal(source.split(artifactBinding).length - 1, 2);
  assert.match(prepare, /permissions:\s+contents: read/);
  assert.match(prepare, /pull-requests: read/);
  assert.match(prepare, /pulls\/\$NUMBER/);
  assert.match(prepare, /EXPECTED_SHA/);
  assert.match(prepare, /persist-credentials: false/);
  assert.match(prepare, /npm run check:quick/);
  assert.doesNotMatch(prepare, /contents: write|actions: write|pull-requests: write/);
  assert.match(write, /contents: write/);
  assert.match(write, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}\s+path: trusted/);
  assert.match(write, /autofix-contract\.mjs head "\$EXPECTED_SHA" "\$current"/);
  assert.equal(write.split("autofix-contract.mjs head").length - 1, 2);
  assert.match(write, /\[\.head\.sha, \.state\] \| @tsv/);
  assert.match(write, /path: source/);
  assert.match(write, /name: autofix-\$\{\{ inputs\.pull_request_number \}\}-\$\{\{/);
  assert.match(write, /--slurp .*pulls\/\$NUMBER\/files/);
  assert.match(write, /git apply --index/);
  assert.match(write, /git diff --cached --name-status -z/);
  assert.match(write, /autofix-contract\.mjs patch/);
  assert.doesNotMatch(write, /npm (?:ci|run)|npx eslint/);
  assert.match(write, /pull-requests: write/);
  assert.match(write, /Full CI/);
  assert.doesNotMatch(source, /gh workflow run ci\.yml/);
  assert.equal(jobBlock(source, "validate"), "");
});

test("Codex CI advisory runs only for an explicitly selected failed CI run", async () => {
  const source = await workflow("codex-ci-advisory.yml");
  const trigger = topLevelBlock(source, "on:");
  assert.doesNotMatch(trigger, /workflow_run:/);
  assert.match(trigger, /workflow_dispatch:\s+inputs:\s+run_id:/);
  assert.match(source, /jq -r '\.name'/);
  assert.match(source, /!= "CI"/);
  assert.match(source, /jq -r '\.path'/);
  assert.match(source, /!= "\.github\/workflows\/ci\.yml"/);
  assert.match(source, /jq -r '\.conclusion'/);
  assert.match(source, /!= "failure"/);
  assert.doesNotMatch(source, /path:\s*\|\s*\n\s*failure\.log/);
});

test("Vercel automatically deploys only main", async () => {
  const config = JSON.parse(await readFile(resolve(root, "vercel.json"), "utf8"));
  assert.deepEqual(config.git?.deploymentEnabled, {
    main: true,
    "*": false,
  });
});

test("main health is serial, latest-run owned, and marker deduplicated", async () => {
  const source = await workflow("ci-triage.yml");
  const production = jobBlock(source, "production-health");
  assert.match(source, /deployment_status:/);
  assert.match(production, /group: production-health-\$\{\{ github\.repository \}\}/);
  assert.match(production, /cancel-in-progress: false/);
  assert.match(production, /deployments: read/);
  assert.match(production, /ci-triage-contract\.mjs latest-run/);
  assert.equal(production.split("ci-triage-contract.mjs latest-run").length - 1, 2);
  assert.equal(production.split("ci-triage-contract.mjs deployment-recovery").length - 1, 2);
  assert.match(production, /CURRENT_ATTEMPT: \$\{\{ github\.event\.workflow_run\.run_attempt \}\}/);
  assert.match(production, /CURRENT_CONCLUSION: \$\{\{ github\.event\.workflow_run\.conclusion \}\}/);
  assert.match(production, /--json databaseId,headSha,attempt,status,conclusion/);
  assert.match(production, /steps\.owner\.outputs\.owns == 'true'/);
  assert.match(production, /verify-production-release\.mjs/);
  assert.match(
    production,
    /EXPECTED_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \|\| github\.event\.deployment\.sha \}\}/,
  );
  assert.match(production, /PRODUCTION_ORIGIN: https:\/\/type-tau\.vercel\.app/);
  assert.match(production, /RELEASE_HEALTHY: \$\{\{ steps\.release\.outputs\.healthy \}\}/);
  assert.match(production, /ci-triage-contract\.mjs release-health/);
  assert.match(production, /github\.event\.deployment\.environment == 'Production'/);
  assert.match(production, /cat production-release\.md/);
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

test("coverage-mode CI discovers trusted script contract tests", async () => {
  const runner = await readFile(resolve(root, "scripts/run-node-tests.mjs"), "utf8");
  assert.match(runner, /const scriptTests = walk\("scripts"\)/);
  assert.match(runner, /\[\.\.\.sourceTests, \.\.\.repositoryTests, \.\.\.scriptTests\]/);
});
