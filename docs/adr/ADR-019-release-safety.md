# ADR-019: Release safety and capability-separated automation

## Context

TypeLoop's Vercel Git integration can finish assigning a production domain before
the independent `main` Browser E2E run finishes. PR checks reduce risk but do not
prove the exact merge commit or its production deployment. The private repository's
current GitHub plan also rejects branch Rulesets, so repository-local policy remains
a visible backstop rather than a preventive control.

Automation has a second trust boundary: a pull request owns package scripts, npm
lifecycle hooks, formatter configuration, and ESLint configuration. Those programs
must never run in a job that can push, dispatch workflows, or comment as the bot.

## Decision

The release path has distinct authoring, validation, reconciliation, and promotion
capabilities:

1. Feature branches are validated by CI and Vercel Preview. A human owner alone
   merges; neither agents nor workflows merge or enable auto-merge.
2. `main` CI validates the exact merge SHA. Vercel Deployment Checks must use the
   uniquely named CI jobs before assigning production domains. This is an owner
   setting and cannot be claimed active from repository code alone.
3. A default-branch `workflow_run` reconciler serializes all Production Health
   mutations. It re-reads the latest `main` CI run immediately before mutation;
   stale events cannot open, update, or close the incident. After a successful
   exact-SHA CI run, the same read-only path waits for the matching successful
   GitHub Production deployment. The build emits the full commit in an immutable
   `X-TypeLoop-Release` response header so the canonical alias is bound to that SHA.
   The verifier traverses the canonical route inventory and recursively referenced
   shell assets, and verifies route shells, the retired route, restricted-content
   policy, and the complete browser security-header contract on every route response. It
   reports only codes and paths, never response bodies or matched confidential values.
4. Production verification can open or close the single health incident but cannot
   promote, alias, roll back, or remove a deployment. Vercel Deployment Checks remain
   the separate owner-controlled pre-assignment gate; post-merge verification does
   not replace them.
5. Autofix executes pull-request code only with a read-only token and no persisted
   Git credential. A separate job applies a patch without executing branch code,
   restricts the patch to files already changed by the PR, and pushes it. A third
   job dispatches CI for the resulting exact SHA.
6. Rollback and forced promotion always require a human. Automation may report an
   incident but never changes production traffic in response to a classifier.

## Alternatives

- **Deploy immediately after merge:** rejected because post-merge validation can
  fail after users already receive the deployment.
- **Run Autofix with one write-enabled job:** rejected because every branch-owned
  command would inherit the job token's effective capability.
- **Create one incident per SHA:** rejected because concurrent runs produce alert
  noise and older completions can contradict newer health.
- **Automatic rollback:** rejected until production signals are sufficiently
  deterministic; a flaky browser test must not move live traffic.

## Consequences

- GitHub Rulesets remain an owner prerequisite: upgrade the private repository plan
  or make the repository public before PR requirements can be enforced server-side.
- Vercel Deployment Checks must be verified in project settings after CI job names
  change. Repository tests protect those names from accidental drift.
- The Production Health issue represents current `main` CI and canonical Production
  health, not a permanent incident archive; GitHub Actions retains the per-run evidence.
- Verification has an overall budget below the workflow timeout. A later successful
  `Production` deployment-status event rechecks the current green `main` SHA and can
  close a delay-induced incident without waiting for another commit.
- Autofix has more jobs and one short-lived artifact, but no untrusted command holds
  write, Actions-dispatch, or PR-comment capability.
