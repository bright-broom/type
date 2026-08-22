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

| Boundary                      | Required state                                                  | Observed state                                    | Next action                                                                                                 |
| ----------------------------- | --------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Restricted runtime content    | No internal meeting data or re-identifiable stable pseudonyms   | Removed on the public-security feature branch     | Merge by PR, deploy exact `main` SHA, then verify retired route and production chunks.                      |
| Typing-data minimization      | No prompt text or ordered keystroke timeline in persistence     | Enforced by versioned migration and archive tests | Confirm full CI and independent review.                                                                     |
| Vulnerability reporting       | Public policy plus a repository-independent private channel     | **Not satisfied**                                 | Owner provisions the channel and records an unauthenticated reachability check before general distribution. |
| Repository-history privacy    | No sensitive blobs or unapproved personal author metadata       | **Not satisfied**                                 | Follow `docs/public-release-security-review.md`; destructive history treatment requires explicit approval.  |
| Native GitHub security        | CodeQL, secret scanning, push protection, Dependabot            | Dependabot enabled; other native scanners absent  | Enable and record after plan/visibility permits; do not infer from repository files.                        |
| Content redistribution rights | Every generated dataset and asset approved for public republish | **Not yet recorded**                              | Owner records provenance/license acceptance before changing repository visibility.                          |

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
