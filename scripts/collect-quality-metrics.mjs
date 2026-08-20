#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { calculateQualityMetrics, formatQualityReport } from "./quality-metrics-contract.mjs";

const DEFAULT_DAYS = 28;

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
}

function githubApi(path) {
  const output = execFileSync("gh", ["api", "--paginate", "--slurp", path], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: process.env,
  });
  return JSON.parse(output).flat();
}

function workflowRuns(repository, createdAfter) {
  const created = encodeURIComponent(`>=${createdAfter.slice(0, 10)}`);
  const pages = githubApi(`repos/${repository}/actions/workflows/ci.yml/runs?per_page=100&created=${created}`);
  return pages.flatMap((page) => page.workflow_runs ?? page);
}

function closedPullRequests(repository, closedAfter) {
  const query = encodeURIComponent(`repo:${repository} is:pr is:closed closed:>=${closedAfter.slice(0, 10)}`);
  const pages = githubApi(`search/issues?q=${query}&per_page=100`);
  const numbers = pages.flatMap((page) => page.items ?? []).map((item) => item.number);
  return numbers.map((number) => githubApi(`repos/${repository}/pulls/${number}`)[0]);
}

function jobsForAttempt(repository, runId, attempt) {
  const pages = githubApi(`repos/${repository}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`);
  return pages.flatMap((page) => page.jobs ?? page);
}

function jobsOutcome(jobs) {
  const successful = jobs.length > 0 && jobs.every((job) => ["success", "skipped", "neutral"].includes(job.conclusion));
  const completedAt = jobs
    .map((job) => job.completed_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  return { conclusion: successful ? "success" : "failure", completedAt };
}

function withAttemptOutcomes(repository, run) {
  const priorAttempts = Array.from({ length: Math.max(0, (run.run_attempt ?? 1) - 1) }, (_, index) =>
    jobsOutcome(jobsForAttempt(repository, run.id, index + 1)),
  );
  const attempts = [...priorAttempts, { conclusion: run.conclusion, completedAt: run.updated_at }];
  return {
    ...run,
    initial_conclusion: attempts[0].conclusion,
    attempt_conclusions: attempts.map((attempt) => attempt.conclusion),
    first_success_completed_at: attempts.find((attempt) => attempt.conclusion === "success")?.completedAt,
  };
}

const repository = option("--repository", process.env.GITHUB_REPOSITORY);
const outputPath = option("--output", "quality-metrics.md");
const days = Number(option("--days", DEFAULT_DAYS));
if (!repository || !Number.isInteger(days) || days < 1 || !outputPath) {
  throw new TypeError("Usage: collect-quality-metrics --repository owner/repo --days 28 --output report.md");
}

const windowEnd = new Date();
const windowStart = new Date(windowEnd.getTime() - days * 24 * 60 * 60 * 1000);
const pullRequests = closedPullRequests(repository, windowStart.toISOString());
const reviewsByPullRequest = Object.fromEntries(
  pullRequests
    .filter((pullRequest) => pullRequest.merged_at)
    .map((pullRequest) => [
      pullRequest.number,
      githubApi(`repos/${repository}/pulls/${pullRequest.number}/reviews?per_page=100`),
    ]),
);
const commitShasByPullRequest = Object.fromEntries(
  pullRequests
    .filter((pullRequest) => pullRequest.merged_at)
    .map((pullRequest) => [
      pullRequest.number,
      githubApi(`repos/${repository}/pulls/${pullRequest.number}/commits?per_page=100`).map((commit) => commit.sha),
    ]),
);
const repositoryDetails = githubApi(`repos/${repository}`)[0];
const earliestPullRequestCreation = pullRequests.reduce(
  (earliest, pullRequest) =>
    Date.parse(pullRequest.created_at) < Date.parse(earliest) ? pullRequest.created_at : earliest,
  windowStart.toISOString(),
);
const runs = workflowRuns(repository, earliestPullRequestCreation).map((run) => withAttemptOutcomes(repository, run));
const metrics = calculateQualityMetrics({
  pullRequests,
  workflowRuns: runs,
  reviewsByPullRequest,
  commitShasByPullRequest,
  defaultBranch: repositoryDetails.default_branch,
  windowStart: windowStart.toISOString(),
});
const report = formatQualityReport(metrics, {
  repository,
  windowStart: windowStart.toISOString(),
  windowEnd: windowEnd.toISOString(),
});
writeFileSync(outputPath, report);
process.stdout.write(report);
