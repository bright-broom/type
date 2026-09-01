# Release control checklist

Repository code can verify workflow behavior but cannot prove GitHub or Vercel
owner settings. Re-check this table after a plan, repository visibility, GitHub job
name, Vercel project, or production-domain change.

## Current evidence (2026-09-01 JST)

| Control                  | Required state                                   | Observed state                                          | Evidence / next action                                                                                                            |
| ------------------------ | ------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| GitHub merge protection  | Ruleset requires PR and `Full CI`                | **Unavailable** for the current private-repository plan | GitHub Rulesets API returned 403 requiring GitHub Pro or Public visibility. Keep Private and upgrade to Pro before enforcement.   |
| Vercel Git integration   | `bright-broom/type`, production branch `main`    | Connected                                               | Vercel project API reports the GitHub repository and branch.                                                                      |
| Vercel automatic Preview | Feature branches do not deploy automatically     | Repository policy prepared                              | `vercel.json` disables `**` and enables `main`; verify with the next feature Branch Push. `**` also matches names containing `/`. |
| Vercel manual Preview    | Exact Git reference can be built on demand       | Project setting `Automatic`                             | Verified in Vercel Project Settings on 2026-09-01. Do not select `Only build production`; it also skips manual Preview builds.    |
| Vercel automatic aliases | On, so Deployment Checks can gate assignment     | On                                                      | Project API reports `autoAssignCustomDomains: true`.                                                                              |
| Vercel Deployment Checks | Unique `Full CI` job selected                    | **Not owner-verified**                                  | After this workflow reaches `main`, select `Full CI` for Production and prove a deployment waits while the check is pending.      |
| Human release authority  | No workflow merge, forced promotion, or rollback | Enforced in repository workflow and agent policy        | Human owner performs merge/promotion/rollback.                                                                                    |

## Public distribution gates

| Boundary                      | Required state                                                  | Observed state                                                                                                                                | Next action                                                                                                  |
| ----------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Restricted runtime content    | No internal meeting data or re-identifiable stable pseudonyms   | Verified by Codex in Production at `0fb2e63` on 2026-08-24; [main CI evidence](https://github.com/bright-broom/type/actions/runs/32630361708) | The post-merge verifier repeats exact deployment, alias SHA, route, asset, retired-route, and policy checks. |
| Typing-data minimization      | No prompt text or ordered keystroke timeline in persistence     | Enforced by versioned migration and archive tests                                                                                             | Confirm full CI and independent review.                                                                      |
| Vulnerability reporting       | Public policy plus a repository-independent private channel     | **Not satisfied**                                                                                                                             | Owner provisions the channel and records an unauthenticated reachability check before general distribution.  |
| Repository-history privacy    | No sensitive blobs or unapproved personal author metadata       | **Not satisfied**                                                                                                                             | Follow `docs/public-release-security-review.md`; destructive history treatment requires explicit approval.   |
| Native GitHub security        | CodeQL, secret scanning, push protection, Dependabot            | Dependabot enabled; other native scanners absent                                                                                              | Enable and record after plan/visibility permits; do not infer from repository files.                         |
| Content redistribution rights | Every generated dataset and asset approved for public republish | **Not yet recorded**                                                                                                                          | Owner records provenance/license acceptance before changing repository visibility.                           |

## Check to select in Vercel

Select the exact GitHub Actions job name `Full CI`. The single Runner executes the
same complete `npm run check:ci` gate, including Security and Chromium／WebKit E2E.
Changing this name requires updating Vercel and this checklist in the same release
operation.

Deployment Checks are not considered active until the Vercel production deployment
shows each check as required and a new `main` deployment remains staged while one is
pending. Record the verification date and owner here; do not infer it from a green PR.

## Post-merge verification

After exact-SHA `main` CI succeeds, the trusted CI reconciler runs the read-only
production verifier and folds failures into the single Production Health issue. It
does not prove that Deployment Checks delayed alias assignment and does not own any
promotion or rollback capability. The canonical response's `X-TypeLoop-Release` must
equal the full expected SHA; a successful delayed Production deployment triggers a
recovery check. For an owner-operated check, run:

```sh
npm run verify:production -- \
  --repository bright-broom/type \
  --origin https://type-tau.vercel.app \
  --expected-sha <full-main-sha>
```
