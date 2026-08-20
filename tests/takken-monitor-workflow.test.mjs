import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(".github/workflows/takken-source-monitor.yml", "utf8");

test("the source monitor always executes trusted default-branch code", () => {
  assert.match(workflow, /if: github\.event_name != 'workflow_dispatch'.+github\.event\.repository\.default_branch/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(workflow, /persist-credentials: false/);
});

test("the monitor has narrow permissions and only reconciles an Issue", () => {
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /issues: write/);
  assert.doesNotMatch(workflow, /contents: write|git push|gh pr merge/);
});
