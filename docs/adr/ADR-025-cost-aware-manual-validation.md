# ADR-025: Cost-aware manual validation and production-only deployment

## Status

Accepted — 2026-09-01

## Context

The private repository is owned by a GitHub Free account with 2,000 included
GitHub Actions minutes per month. A pull-request synchronization previously started
five Ubuntu jobs. Recent repository evidence showed Browser E2E dominated runner
time, while checkout, dependency installation, and production build were repeated
across jobs. Vercel also built a Preview for every feature-branch push.

Quality must not be reduced: the complete deterministic gate, Security scan,
production Build, Chromium E2E, and WebKit E2E still need to cover the exact
candidate commit. GitHub Free does not provide branch protection or Rulesets for
this private repository, so code cannot make the pre-Merge check mandatory on the
server.

## Decision

- Feature-branch Push and PR synchronization do not trigger CI.
- When a PR is Ready for review and unchanged, a human dispatches `CI` once with
  its exact full head SHA. The workflow fails before Checkout if the selected
  Branch resolves to another SHA.
- Full CI uses one digest-pinned Playwright Runner and executes `npm run check:ci`.
  No Test, Security check, Browser engine, or Build gate is removed.
- A merged `main` revision runs Full CI once. This preserves exact Merge-SHA and
  Production evidence while eliminating repeated PR synchronization runs.
- Autofix and Codex CI advisory are manual workflows bound to an explicit PR SHA
  or failed CI run. Autofix never starts Full CI automatically.
- Vercel Git deployment is enabled for `main` and disabled for every other Branch.
  Exceptional Preview deployment uses the Vercel Dashboard Git-reference flow.
- The deny pattern is `**`, not `*`, because Vercel uses minimatch syntax and agent
  Branch names contain `/`. A matching `main: true` rule still permits Production.
- Vercel's Ignored Build Step stays `Automatic`; repository Git policy prevents
  automatic feature-branch deployment without also suppressing manual Preview.
- Vercel CLI remains blocked because the isolated `59.10.0` dependency audit has
  High and Critical findings. Production promotion, rollback, alias mutation, and
  Merge remain human-only operations.
- After GitHub Pro is enabled, the owner creates a no-bypass `main` Ruleset that
  requires a PR, conversation resolution, and the unique `Full CI` status for the
  latest Commit.

## Alternatives

- **Make the repository Public:** rejected as a cost workaround. Current-tree
  privacy gates do not clear deleted history, author metadata, or redistribution
  rights for public release.
- **Remove E2E or Security checks:** rejected because it saves cost by weakening
  release evidence.
- **Run only before Merge:** rejected because Squash or Merge Commit changes the
  final SHA and Vercel Production needs exact-revision evidence.
- **Use a self-hosted personal Mac Runner:** rejected because an always-available
  host expands credential, persistence, and untrusted-code risk.
- **Enable the Vercel CLI despite audit findings:** rejected until its isolated
  graph passes the Repository's High/Critical gate.

## Consequences

- Ordinary PR Pushes consume no Full CI minutes and create no Vercel Preview.
- A normal delivery consumes one deliberate candidate run and one post-Merge run,
  each on one Runner instead of five independently billed jobs.
- Human discipline is the only pre-Merge enforcement while the Repository remains
  Private on GitHub Free. Missing, stale, skipped, cancelled, or failed CI evidence
  must be treated as a blocker, but GitHub cannot enforce that rule until Pro.
- Reviewers lose automatic Preview URLs. They create a Dashboard Preview only when
  visual or external-device verification materially needs one.
- Next.js `.next/cache` is persisted to reduce repeat Build time; Cache usage must
  remain within the Repository allowance and be reviewed if it grows unexpectedly.
