# Release control checklist

Repository code can verify workflow behavior but cannot prove GitHub or Vercel
owner settings. Re-check this table after a plan, repository visibility, GitHub job
name, Vercel project, or production-domain change.

## Current evidence (2026-08-23 JST)

| Control                  | Required state                                   | Observed state                                          | Evidence / next action                                                                                                           |
| ------------------------ | ------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| GitHub merge protection  | Ruleset requires PR and named checks             | **Unavailable** for the current private-repository plan | GitHub Rulesets API returned 403 requiring GitHub Pro or public visibility. Owner must choose a plan/visibility change.          |
| Vercel Git integration   | `bright-broom/type`, production branch `main`    | Connected                                               | Vercel project API reports the GitHub repository and branch.                                                                     |
| Vercel automatic aliases | On, so Deployment Checks can gate assignment     | On                                                      | Project API reports `autoAssignCustomDomains: true`.                                                                             |
| Vercel Deployment Checks | All five unique `main` CI jobs selected          | **Not owner-verified**                                  | In Vercel → type → Settings → Environments → Production, add the checks below and record the confirming owner/date in this file. |
| Human release authority  | No workflow merge, forced promotion, or rollback | Enforced in repository workflow and agent policy        | Human owner performs merge/promotion/rollback.                                                                                   |

## Public distribution gates

| Boundary                      | Required state                                                  | Observed state                                                                                                                                | Next action                                                                                                  |
| ----------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Restricted runtime content    | No internal meeting data or re-identifiable stable pseudonyms   | Verified by Codex in Production at `0fb2e63` on 2026-08-24; [main CI evidence](https://github.com/bright-broom/type/actions/runs/32630361708) | The post-merge verifier repeats exact deployment, alias SHA, route, asset, retired-route, and policy checks. |
| Typing-data minimization      | No prompt text or ordered keystroke timeline in persistence     | Enforced by versioned migration and archive tests                                                                                             | Confirm full CI and independent review.                                                                      |
| Vulnerability reporting       | Public policy plus a repository-independent private channel     | **Not satisfied**                                                                                                                             | Owner provisions the channel and records an unauthenticated reachability check before general distribution.  |
| Repository-history privacy    | No sensitive blobs or unapproved personal author metadata       | **Not satisfied**                                                                                                                             | Follow `docs/public-release-security-review.md`; destructive history treatment requires explicit approval.   |
| Native GitHub security        | CodeQL, secret scanning, push protection, Dependabot            | Dependabot enabled; other native scanners absent                                                                                              | Enable and record after plan/visibility permits; do not infer from repository files.                         |
| Content redistribution rights | Every generated dataset and asset approved for public republish | **Not yet recorded**                                                                                                                          | Owner records provenance/license acceptance before changing repository visibility.                           |

## Checks to select in Vercel

Select these exact GitHub Actions job names; changing a name requires updating
Vercel and this checklist in the same release operation:

1. `PR-only policy`
2. `Dependency compatibility`
3. `Quality gates`
4. `Browser E2E`
5. `Security`

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
