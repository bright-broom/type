# Contributing to TypeLoop

TypeLoop uses a pull-request-only delivery workflow. This applies to humans, coding agents, IDE integrations, scripts, and every other environment that can write to the repository.

## Required workflow

1. Synchronize local `main` with `origin/main` without adding commits to it.
2. Create a focused branch before editing. Agent-created branches use `codex/<topic>`.
3. During implementation, run `npm run check:quick`. Before submission, run
   `npm run check:ci` locally.
4. Commit and push only the feature branch.
5. Open a pull request targeting `main` and complete the PR template. Pushing the
   branch does not start Full CI or a Vercel Preview deployment.
6. Resolve review findings on the same feature branch. When the pull request is
   ready to merge, copy its latest full commit SHA and run **Actions → CI → Run
   workflow** once on that branch. Enter the copied SHA as `expected_sha`.
7. Confirm that the uniquely named `Full CI` check succeeded on the unchanged
   latest commit. Missing, skipped, cancelled, stale, or failed results do not pass.
8. Leave the pull request unmerged. A human repository owner performs the final
   review and merge. The resulting `main` commit runs Full CI once and is the only
   branch that Vercel deploys automatically.

Never push commits directly to `main`, force-push or delete `main`, bypass checks, dismiss reviews to unblock a merge, merge a PR, or enable auto-merge.

## Repository-owner enforcement

Configure a GitHub branch ruleset for the default branch with these controls:

- Require a pull request before merging.
- Require the `Full CI` status check to pass on the latest commit.
- Require conversation resolution.
- Block force pushes and branch deletion.
- Disable bypass for repository administrators and automation unless an audited break-glass procedure explicitly requires it.

The `Full CI` job detects a direct push and makes the workflow fail, but GitHub
receives that commit before Actions can run. It is a visible backstop, not a
replacement for server-side branch protection. The current private repository on
GitHub Free cannot enable branch protection or repository rulesets. Upgrade to
GitHub Pro before treating the latest-commit requirement as platform-enforced.

Operational commands, manual Autofix and advisory procedures, and Vercel Preview
instructions are in [`docs/manual-ci-cd.md`](docs/manual-ci-cd.md).
