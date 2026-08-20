#!/usr/bin/env node

import { readFileSync } from "node:fs";

export const PRODUCTION_HEALTH_MARKER = "<!-- typeloop-production-health -->";

export function classifierExitIsBlocking(status) {
  if (status === 0) return false;
  if (status === 2) return true;
  throw new Error(`Unexpected CI classifier exit status: ${status}`);
}

export function latestRunOwnsHealthMutation(currentRunId, currentSha, currentAttempt, currentConclusion, latestRun) {
  return (
    String(latestRun?.databaseId) === String(currentRunId) &&
    latestRun?.headSha === currentSha &&
    Number(latestRun?.attempt) === Number(currentAttempt) &&
    latestRun?.conclusion === currentConclusion &&
    latestRun?.status === "completed"
  );
}

export function openPullRequestsForCommit(pulls) {
  return [
    ...new Set(
      pulls.filter((pull) => pull?.state === "open" && Number.isSafeInteger(pull?.number)).map((pull) => pull.number),
    ),
  ].sort((left, right) => left - right);
}

export function productionHealthIssue(issues) {
  return issues.find((issue) => typeof issue?.body === "string" && issue.body.includes(PRODUCTION_HEALTH_MARKER))
    ?.number;
}

function readStdinJson() {
  return JSON.parse(readFileSync(0, "utf8"));
}

function runCli([command, ...args]) {
  if (command === "classifier") return String(classifierExitIsBlocking(Number(args[0])));
  if (command === "latest-run") {
    return String(latestRunOwnsHealthMutation(args[0], args[1], args[2], args[3], JSON.parse(args[4])));
  }
  if (command === "pull-requests") return openPullRequestsForCommit(readStdinJson()).join("\n");
  if (command === "production-issue") return String(productionHealthIssue(readStdinJson()) ?? "");
  if (command === "marker") return PRODUCTION_HEALTH_MARKER;
  throw new Error(`Unknown CI triage contract command: ${command ?? ""}`);
}

if (import.meta.filename === process.argv[1]) {
  try {
    process.stdout.write(`${runCli(process.argv.slice(2))}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
