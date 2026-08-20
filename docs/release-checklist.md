# Release control checklist

Repository code can verify workflow behavior but cannot prove GitHub or Vercel
owner settings. Re-check this table after a plan, repository visibility, GitHub job
name, Vercel project, or production-domain change.

## Current evidence (2026-08-20 JST)

| Control                  | Required state                                   | Observed state                                          | Evidence / next action                                                                                                           |
| ------------------------ | ------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| GitHub merge protection  | Ruleset requires PR and named checks             | **Unavailable** for the current private-repository plan | GitHub Rulesets API returned 403 requiring GitHub Pro or public visibility. Owner must choose a plan/visibility change.          |
| Vercel Git integration   | `bright-broom/type`, production branch `main`    | Connected                                               | Vercel project API reports the GitHub repository and branch.                                                                     |
| Vercel automatic aliases | On, so Deployment Checks can gate assignment     | On                                                      | Project API reports `autoAssignCustomDomains: true`.                                                                             |
| Vercel Deployment Checks | All five unique `main` CI jobs selected          | **Not owner-verified**                                  | In Vercel → type → Settings → Environments → Production, add the checks below and record the confirming owner/date in this file. |
| Human release authority  | No workflow merge, forced promotion, or rollback | Enforced in repository workflow and agent policy        | Human owner performs merge/promotion/rollback.                                                                                   |

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
