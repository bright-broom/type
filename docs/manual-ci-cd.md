# Manual CI/CD runbook

TypeLoop keeps the Repository Private and saves hosted minutes without removing
quality gates. This runbook is the operational source of truth for local validation,
manual Full CI, exceptional Preview, and Production verification.

## Normal delivery flow

1. Start from current `origin/main` and create a focused feature Branch.
2. During implementation, run `npm run check:quick` after coherent changes.
3. Before Push, run `npm run check:ci`. It includes Format, generated-content,
   privacy, design-token, Lint, Typecheck, Coverage, dead-code, Build, static-route,
   bundle, Chromium／WebKit E2E, tracked-secret, and High dependency checks.
4. Commit and Push the feature Branch, then create or update its PR. Push does not
   start Full CI or Vercel Preview.
5. Finish review and mark the PR **Ready for review**. Do not dispatch Full CI while
   more Commit changes are expected.
6. Copy the PR's latest full 40-character Commit SHA.
7. Open **GitHub → Actions → CI → Run workflow**. Select the PR Branch, enter the
   exact SHA in `expected_sha`, and run it once.
8. Confirm `Full CI` succeeded and its head SHA still equals the PR head SHA.
   Missing, skipped, neutral, cancelled, timed-out, stale, or failed evidence blocks
   Merge.
9. A human owner performs Merge. `main` runs Full CI once for the exact merged SHA,
   while Vercel automatically creates the Production deployment.
10. Confirm the `main` Full CI result and Production Health. Merge, Promote,
    Rollback, and Alias changes remain human-only operations.

The equivalent manual CI command is:

```sh
sha=$(git rev-parse HEAD)
gh workflow run ci.yml --ref "$(git branch --show-current)" \
  --field expected_sha="$sha"
gh run watch
```

## GitHub Free Private limitation

GitHub Free cannot apply Branch Protection or Rulesets to this Private Repository.
The workflow verifies SHA identity, but GitHub cannot prevent an owner from merging
without running it. Until GitHub Pro is enabled, the PR checklist and human
verification are compensating controls, not server-side enforcement.

After upgrading to GitHub Pro, configure `main` with no bypass:

- Require a Pull Request before merging.
- Require `Full CI` for the latest Commit.
- Require conversation resolution.
- Block Force Push and Branch deletion.
- Do not permit administrator or automation bypass outside an audited emergency.

## Manual Autofix

Autofix is not triggered by PR Push. Use it only when Formatter／Lint mechanical
changes are needed:

1. Copy the PR number and current full head SHA.
2. Open **Actions → Autofix → Run workflow**.
3. Enter `pull_request_number` and `expected_sha`.
4. After Autofix Pushes a new Commit, copy the new SHA and run Full CI manually.

Autofix rejects closed, advanced, fork, and Dependabot PRs. Its write-enabled Job
does not execute PR-owned package commands.

## Manual CI diagnosis and AI advisory

The deterministic CI Triage continues to classify a failed CI run. Use Codex CI
advisory only when human judgment needs a second opinion:

1. Open the failed CI run and copy its numeric Run ID and attempt number.
2. Open **Actions → Codex CI advisory → Run workflow**.
3. Enter `run_id` and `run_attempt`.

The workflow accepts only a failed `CI` run, has read-only Repository permissions,
and creates an Artifact. Without the owner-managed `OPENAI_API_KEY`, it preserves
only deterministic Triage and makes no model call.

## Vercel deployment

`vercel.json` restricts automatic Git deployment to `main`; feature Branch Pushes
do not create Preview Deployments. The Project's Ignored Build Step stays
`Automatic` so an explicitly created Dashboard deployment can still build.

When a Preview is materially necessary, use the Vercel Dashboard:

1. Open **Vercel → type → Deployments**.
2. Choose the manual deployment action and select the exact Git Branch／Commit.
3. Confirm the resulting deployment is **Preview**, not Production.
4. Use the Preview URL for visual or external-device review. Do not Promote it as
   part of validation.

Vercel CLI is intentionally unavailable. The isolated audit of the current
`vercel@59.10.0` graph on 2026-09-01 reported High and Critical findings. Do not use
`npx vercel`, add `vercel` to dependencies, or weaken the Command Hook. Re-evaluate
only after a pinned isolated graph passes `npm audit --audit-level=high`.

## Failure and recovery

- **Full CI resolves to another SHA:** stop, copy the new PR head SHA, and dispatch
  once after changes finish.
- **Autofix advances the Branch:** the previous Full CI is stale; run it again on
  the new SHA.
- **Vercel Preview is unexpectedly created:** verify the deployed revision contains
  the `vercel.json` rule that disables `**` while enabling `main`. `**` is required
  because feature Branch names can contain `/`. Keep the Project's Ignored Build
  Step `Automatic`; changing it to `Only build production` also skips an explicitly
  requested Dashboard Preview.
- **Production fails:** do not auto-Promote or auto-Rollback. Inspect the exact
  `main` SHA, Full CI, Vercel deployment, and Production Health evidence, then let
  the human owner choose Rollback or a corrective PR.
