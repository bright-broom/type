import assert from "node:assert/strict";
import test from "node:test";
import { calculateQualityMetrics, formatQualityReport } from "./quality-metrics-contract.mjs";

const pullRequests = [
  {
    number: 1,
    created_at: "2026-08-01T00:00:00Z",
    closed_at: "2026-08-02T00:00:00Z",
    merged_at: "2026-08-02T00:00:00Z",
    head: { ref: "codex/one" },
  },
  {
    number: 2,
    created_at: "2026-08-03T00:00:00Z",
    closed_at: "2026-08-05T00:00:00Z",
    merged_at: "2026-08-05T00:00:00Z",
    head: { ref: "feature/two" },
  },
  {
    number: 3,
    created_at: "2026-08-06T00:00:00Z",
    closed_at: "2026-08-07T00:00:00Z",
    merged_at: null,
    head: { ref: "codex/abandoned" },
  },
];

const workflowRuns = [
  {
    event: "pull_request",
    conclusion: "success",
    created_at: "2026-08-01T01:00:00Z",
    updated_at: "2026-08-01T02:00:00Z",
    pull_requests: [{ number: 1 }],
  },
  {
    event: "pull_request",
    conclusion: "failure",
    created_at: "2026-08-03T01:00:00Z",
    updated_at: "2026-08-03T02:00:00Z",
    pull_requests: [{ number: 2 }],
  },
  {
    event: "pull_request",
    conclusion: "success",
    created_at: "2026-08-03T03:00:00Z",
    updated_at: "2026-08-03T06:00:00Z",
    pull_requests: [{ number: 2 }],
  },
  {
    event: "push",
    conclusion: "failure",
    created_at: "2026-08-08T00:00:00Z",
    updated_at: "2026-08-08T00:10:00Z",
    head_branch: "main",
    pull_requests: [],
  },
];

test("calculates deterministic engineering signals", () => {
  const metrics = calculateQualityMetrics({
    pullRequests,
    workflowRuns,
    reviewsByPullRequest: {
      1: [{ commit_id: "a" }],
      2: [{ commit_id: "b" }, { commit_id: "c" }, { commit_id: "c" }],
    },
    defaultBranch: "main",
    windowStart: "2026-08-01T00:00:00Z",
  });

  assert.deepEqual(metrics, {
    mergedPullRequests: 2,
    initialCi: { successes: 1, total: 2, missingRuns: 0, rate: 50 },
    medianTimeToGreenHours: 4,
    medianReviewRevisions: 0.5,
    postMergeCiFailures: 1,
    preproductionFailureDetection: {
      pullRequestFailures: 1,
      defaultBranchFailures: 1,
      rate: 50,
    },
    agentBranchCompletion: { merged: 1, closed: 2, rate: 50 },
  });
});

test("reports missing denominators without inventing zero rates", () => {
  const metrics = calculateQualityMetrics({
    pullRequests: [],
    workflowRuns: [],
    windowStart: "2026-08-01T00:00:00Z",
  });
  assert.equal(metrics.initialCi.rate, null);
  assert.equal(metrics.initialCi.missingRuns, 0);
  assert.equal(metrics.preproductionFailureDetection.rate, null);
  assert.match(
    formatQualityReport(metrics, {
      repository: "bright-broom/type",
      windowStart: "2026-08-01T00:00:00Z",
      windowEnd: "2026-08-29T00:00:00Z",
    }),
    /Initial CI success \| n\/a/,
  );
});

test("associates closed pull requests by commit when GitHub omits pull_requests", () => {
  const metrics = calculateQualityMetrics({
    pullRequests: [pullRequests[0]],
    workflowRuns: [
      {
        event: "pull_request",
        conclusion: "success",
        created_at: "2026-08-01T01:00:00Z",
        updated_at: "2026-08-01T02:00:00Z",
        head_sha: "closed-pr-commit",
        pull_requests: [],
      },
    ],
    commitShasByPullRequest: { 1: ["closed-pr-commit"] },
    windowStart: "2026-08-01T00:00:00Z",
  });
  assert.deepEqual(metrics.initialCi, { successes: 1, total: 1, missingRuns: 0, rate: 100 });
  assert.equal(metrics.medianTimeToGreenHours, 2);
});

test("counts missing CI and a failed first rerun attempt instead of inflating success", () => {
  const metrics = calculateQualityMetrics({
    pullRequests: [pullRequests[0], pullRequests[1]],
    workflowRuns: [
      {
        event: "pull_request",
        conclusion: "success",
        initial_conclusion: "failure",
        attempt_conclusions: ["failure", "success"],
        first_success_completed_at: "2026-08-01T03:00:00Z",
        run_attempt: 2,
        created_at: "2026-08-01T01:00:00Z",
        updated_at: "2026-08-01T03:00:00Z",
        pull_requests: [{ number: 1 }],
      },
    ],
    windowStart: "2026-08-01T00:00:00Z",
  });
  assert.deepEqual(metrics.initialCi, { successes: 0, total: 2, missingRuns: 1, rate: 0 });
  assert.equal(metrics.preproductionFailureDetection.pullRequestFailures, 1);
  assert.equal(metrics.medianTimeToGreenHours, 3);
});

test("uses the earliest completed green run when concurrent runs finish out of creation order", () => {
  const metrics = calculateQualityMetrics({
    pullRequests: [pullRequests[0]],
    workflowRuns: [
      {
        event: "pull_request",
        conclusion: "success",
        created_at: "2026-08-01T01:00:00Z",
        updated_at: "2026-08-01T10:00:00Z",
        pull_requests: [{ number: 1 }],
      },
      {
        event: "pull_request",
        conclusion: "success",
        created_at: "2026-08-01T02:00:00Z",
        updated_at: "2026-08-01T03:00:00Z",
        pull_requests: [{ number: 1 }],
      },
    ],
    windowStart: "2026-08-01T00:00:00Z",
  });

  assert.equal(metrics.medianTimeToGreenHours, 3);
});
