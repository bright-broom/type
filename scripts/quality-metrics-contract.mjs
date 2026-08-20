const SUCCESS = "success";

function field(value, camelCase, snakeCase) {
  return value?.[camelCase] ?? value?.[snakeCase] ?? null;
}

function timestamp(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0 ? (ordered[middle - 1] + ordered[middle]) / 2 : ordered[middle];
}

function percentage(numerator, denominator) {
  return denominator === 0 ? null : (numerator / denominator) * 100;
}

function pullRequestNumbers(run) {
  const associations = run.pullRequests ?? run.pull_requests ?? [];
  return associations.map((pullRequest) => pullRequest.number).filter(Number.isInteger);
}

function runCreatedAt(run) {
  return timestamp(field(run, "createdAt", "created_at")) ?? 0;
}

function runCompletedAt(run) {
  return timestamp(field(run, "updatedAt", "updated_at")) ?? runCreatedAt(run);
}

function initialConclusion(run) {
  return field(run, "initialConclusion", "initial_conclusion") ?? run.conclusion;
}

function hasFailedAttempt(run) {
  const conclusions = field(run, "attemptConclusions", "attempt_conclusions");
  return Array.isArray(conclusions)
    ? conclusions.includes("failure")
    : run.conclusion === "failure" || initialConclusion(run) === "failure";
}

function firstGreenAt(run) {
  return (
    timestamp(field(run, "firstSuccessCompletedAt", "first_success_completed_at")) ??
    (run.conclusion === SUCCESS ? runCompletedAt(run) : null)
  );
}

function reviewRevisionCount(reviews) {
  const commits = new Set(
    reviews
      .map((review) => field(review, "commitId", "commit_id"))
      .filter((commitId) => typeof commitId === "string" && commitId !== ""),
  );
  return Math.max(0, commits.size - 1);
}

export function calculateQualityMetrics({
  pullRequests,
  workflowRuns,
  reviewsByPullRequest = {},
  commitShasByPullRequest = {},
  defaultBranch = "main",
  windowStart,
}) {
  const windowStartMs = timestamp(windowStart);
  if (windowStartMs === null) throw new TypeError("windowStart must be an ISO date");

  const mergedPullRequests = pullRequests.filter((pullRequest) => {
    const mergedAt = timestamp(field(pullRequest, "mergedAt", "merged_at"));
    return mergedAt !== null && mergedAt >= windowStartMs;
  });
  const runsInWindow = workflowRuns.filter((run) => runCreatedAt(run) >= windowStartMs);
  const pullRequestRuns = new Map();
  for (const run of workflowRuns.filter((candidate) => candidate.event === "pull_request")) {
    for (const number of pullRequestNumbers(run)) {
      const runs = pullRequestRuns.get(number) ?? [];
      runs.push(run);
      pullRequestRuns.set(number, runs);
    }
  }
  const pullRequestNumbersByCommit = new Map();
  for (const pullRequest of mergedPullRequests) {
    const commitShas = new Set([...(commitShasByPullRequest[pullRequest.number] ?? []), pullRequest.head?.sha]);
    for (const commitSha of commitShas) {
      if (typeof commitSha !== "string" || commitSha === "") continue;
      const numbers = pullRequestNumbersByCommit.get(commitSha) ?? [];
      numbers.push(pullRequest.number);
      pullRequestNumbersByCommit.set(commitSha, numbers);
    }
  }
  for (const run of workflowRuns.filter((candidate) => candidate.event === "pull_request")) {
    const headSha = field(run, "headSha", "head_sha");
    for (const number of pullRequestNumbersByCommit.get(headSha) ?? []) {
      const runs = pullRequestRuns.get(number) ?? [];
      if (!runs.includes(run)) runs.push(run);
      pullRequestRuns.set(number, runs);
    }
  }

  let initialSuccesses = 0;
  let missingInitialRuns = 0;
  const hoursToGreen = [];
  const reviewRevisions = [];
  for (const pullRequest of mergedPullRequests) {
    const runs = [...(pullRequestRuns.get(pullRequest.number) ?? [])].sort(
      (left, right) => runCreatedAt(left) - runCreatedAt(right),
    );
    if (runs.length === 0) missingInitialRuns += 1;
    else if (initialConclusion(runs[0]) === SUCCESS) initialSuccesses += 1;
    const firstGreen = runs.find((run) => firstGreenAt(run) !== null);
    const createdAt = timestamp(field(pullRequest, "createdAt", "created_at"));
    if (firstGreen && createdAt !== null) {
      hoursToGreen.push((firstGreenAt(firstGreen) - createdAt) / 3_600_000);
    }
    reviewRevisions.push(reviewRevisionCount(reviewsByPullRequest[pullRequest.number] ?? []));
  }

  const failedPullRequestRuns = runsInWindow.filter(
    (run) => run.event === "pull_request" && hasFailedAttempt(run),
  ).length;
  const failedDefaultBranchRuns = runsInWindow.filter(
    (run) => run.event === "push" && field(run, "headBranch", "head_branch") === defaultBranch && hasFailedAttempt(run),
  ).length;
  const agentPullRequests = pullRequests.filter((pullRequest) => {
    const closedAt = timestamp(field(pullRequest, "closedAt", "closed_at"));
    return closedAt !== null && closedAt >= windowStartMs && pullRequest.head?.ref?.startsWith("codex/");
  });
  const mergedAgentPullRequests = agentPullRequests.filter(
    (pullRequest) => field(pullRequest, "mergedAt", "merged_at") !== null,
  ).length;

  return {
    mergedPullRequests: mergedPullRequests.length,
    initialCi: {
      successes: initialSuccesses,
      total: mergedPullRequests.length,
      missingRuns: missingInitialRuns,
      rate: percentage(initialSuccesses, mergedPullRequests.length),
    },
    medianTimeToGreenHours: median(hoursToGreen),
    medianReviewRevisions: median(reviewRevisions),
    postMergeCiFailures: failedDefaultBranchRuns,
    preproductionFailureDetection: {
      pullRequestFailures: failedPullRequestRuns,
      defaultBranchFailures: failedDefaultBranchRuns,
      rate: percentage(failedPullRequestRuns, failedPullRequestRuns + failedDefaultBranchRuns),
    },
    agentBranchCompletion: {
      merged: mergedAgentPullRequests,
      closed: agentPullRequests.length,
      rate: percentage(mergedAgentPullRequests, agentPullRequests.length),
    },
  };
}

function displayNumber(value, suffix = "") {
  return value === null ? "n/a" : `${value.toFixed(1)}${suffix}`;
}

export function formatQualityReport(metrics, { repository, windowStart, windowEnd }) {
  return [
    `# TypeLoop quality metrics — ${repository}`,
    "",
    `Window: ${windowStart.slice(0, 10)} through ${windowEnd.slice(0, 10)}`,
    "",
    "| Signal | Result | Definition |",
    "| --- | ---: | --- |",
    `| Merged pull requests | ${metrics.mergedPullRequests} | PRs merged during the window |`,
    `| Initial CI success | ${displayNumber(metrics.initialCi.rate, "%")} (${metrics.initialCi.successes}/${metrics.initialCi.total}; ${metrics.initialCi.missingRuns} missing) | Attempt 1 of the earliest PR CI run succeeded; missing runs count as not successful |`,
    `| Median time to green | ${displayNumber(metrics.medianTimeToGreenHours, " h")} | PR creation to first successful CI run |`,
    `| Median review revisions | ${displayNumber(metrics.medianReviewRevisions)} | Distinct reviewed commits after the first |`,
    `| Post-merge CI failures | ${metrics.postMergeCiFailures} | Failed CI push runs on the default branch |`,
    `| Pre-production failure detection | ${displayNumber(metrics.preproductionFailureDetection.rate, "%")} | PR workflow runs with any observed failed attempt / failed PR and default-branch workflow runs |`,
    `| Agent-branch completion | ${displayNumber(metrics.agentBranchCompletion.rate, "%")} (${metrics.agentBranchCompletion.merged}/${metrics.agentBranchCompletion.closed}) | Closed codex/* PRs that were merged |`,
    "",
    "> These are engineering signals, not individual performance scores. `n/a` means the window has no valid denominator.",
    "",
  ].join("\n");
}
