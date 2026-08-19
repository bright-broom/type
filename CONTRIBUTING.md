# Contributing to TypeLoop

TypeLoop uses a pull-request-only delivery workflow. This applies to humans, coding agents, IDE integrations, scripts, and every other environment that can write to the repository.

## Required workflow

1. Synchronize local `main` with `origin/main` without adding commits to it.
2. Create a focused branch before editing. Agent-created branches use `codex/<topic>`.
3. Commit and push only the feature branch.
4. Open a pull request targeting `main` and complete the PR template.
5. Wait for every GitHub Actions check to pass:
   - PR-only policy
   - Dependency compatibility
   - Quality gates
   - Browser E2E
   - Security
6. Resolve review findings on the same feature branch and let CI rerun.
7. Leave the pull request unmerged. A human repository owner performs the final review and merge.

Never push commits directly to `main`, force-push or delete `main`, bypass checks, dismiss reviews to unblock a merge, merge a PR, or enable auto-merge.

## Repository-owner enforcement

Configure a GitHub branch ruleset for the default branch with these controls:

- Require a pull request before merging.
- Require the five status checks listed above to pass on the latest commit.
- Require conversation resolution.
- Block force pushes and branch deletion.
- Disable bypass for repository administrators and automation unless an audited break-glass procedure explicitly requires it.

The `PR-only policy` CI job detects a direct push and makes the workflow fail, but GitHub receives that commit before Actions can run. It is a visible backstop, not a replacement for server-side branch protection. On private repositories, GitHub may require a paid plan before branch protection or repository rulesets can be enabled.
