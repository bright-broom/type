import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCTION_HEALTH_MARKER,
  classifierExitIsBlocking,
  latestRunOwnsHealthMutation,
  openPullRequestsForCommit,
  productionHealthIssue,
} from "./ci-triage-contract.mjs";

test("classifier exit statuses fail closed", () => {
  assert.equal(classifierExitIsBlocking(0), false);
  assert.equal(classifierExitIsBlocking(2), true);
  assert.throws(() => classifierExitIsBlocking(1), /Unexpected/);
  assert.throws(() => classifierExitIsBlocking(3), /Unexpected/);
});

test("only the latest completed main run may mutate health", () => {
  const latestFailure = {
    databaseId: 22,
    headSha: "sha-b",
    attempt: 2,
    status: "completed",
    conclusion: "failure",
  };
  const latestSuccess = { ...latestFailure, conclusion: "success" };
  assert.equal(latestRunOwnsHealthMutation(21, "sha-a", 1, "failure", latestFailure), false);
  assert.equal(latestRunOwnsHealthMutation(22, "sha-b", 2, "failure", latestFailure), true);
  assert.equal(latestRunOwnsHealthMutation(22, "sha-b", 1, "success", latestSuccess), false);
  assert.equal(latestRunOwnsHealthMutation(22, "sha-b", 2, "success", latestSuccess), true);
  assert.equal(latestRunOwnsHealthMutation(22, "sha-b", 1, "failure", latestSuccess), false);
  assert.equal(
    latestRunOwnsHealthMutation(22, "sha-b", 2, "success", { ...latestSuccess, status: "in_progress" }),
    false,
  );
});

test("workflow-dispatched validation resolves every open pull request", () => {
  assert.deepEqual(
    openPullRequestsForCommit([
      { number: 31, state: "closed" },
      { number: 32, state: "open" },
      { number: 30, state: "open" },
      { number: 32, state: "open" },
    ]),
    [30, 32],
  );
  assert.deepEqual(openPullRequestsForCommit([{ number: 31, state: "closed" }]), []);
});

test("production incident identity is the durable marker, not its title", () => {
  assert.equal(
    productionHealthIssue([
      { number: 4, body: "unrelated" },
      { number: 8, body: `${PRODUCTION_HEALTH_MARKER}\nrenamed issue` },
    ]),
    8,
  );
  assert.equal(productionHealthIssue([]), undefined);
});
