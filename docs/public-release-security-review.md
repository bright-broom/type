# Public-release security review

Review date: 2026-08-23 JST
Scope: current source tree, generated browser content, local persistence, production
headers, service worker, GitHub controls, dependency state, and public-release process.

This review distinguishes the deployed application from the Git repository. Passing the
application gate does not authorize a repository visibility change.

## Verified facts

- TypeLoop has no account, backend database, analytics SDK, advertising tracker, or runtime
  third-party API. Preferences and aggregate learning history are browser-local.
- The pre-review application bundle contained a pseudonymized internal meeting glossary.
  Stable pseudonyms, a meeting identifier, and deal-timing context were present in client
  chunks; the production `/ais` route returned that content. Pseudonymization did not make
  the material safe for unrestricted release.
- This change removes that route, importer, generated artifact, and training set, and adds
  source and emitted-build confidentiality gates.
- New and legacy typing histories are minimized before persistence. Prompt text and ordered
  keystrokes are no longer written to localStorage or JSON archives.
- The dependency installation and High-severity audit reported no known vulnerability at
  review time. The tracked/untracked secret heuristic also passed. These checks do not scan
  deleted Git history.
- The repository is currently private. Git history contains 115 author-email records across
  three domains, including personal-provider and local-machine metadata. No addresses or
  local parts are reproduced in this report.
- Dependabot alerts and automated fixes are enabled. GitHub Code Scanning returned 403 and
  Secret Scanning returned 404 for the current private-repository plan/configuration.

## Application-release gate

The production application is eligible for general use only after all of the following:

1. This privacy-boundary change is merged through a PR and the exact `main` SHA passes every
   required GitHub and Vercel check.
2. The deployed `/ais` route returns 404 and the production JavaScript contains none of the
   restricted-content markers enforced by `check:privacy`.
3. `/privacy` is reachable; effective CSP, referrer, service worker cache, and browser E2E
   checks pass.
4. Vercel Deployment Checks are owner-verified for the exact CI job names in
   `docs/release-checklist.md`.
5. An owner provisions a public security policy plus a private reporting channel that is
   reachable without access to this private repository, then records an unauthenticated
   reachability check in `docs/release-checklist.md`.

Until step 2 is verified, the current production deployment must be treated as containing
restricted business context even though direct personal names were masked.

## Repository-publication gate

Do not make `bright-broom/type` public until an owner separately completes and records:

- a sensitive-history inventory covering deleted AIS blobs and author email metadata;
- an explicit decision to keep the repository private, create a clean public repository, or
  perform an approved history rewrite with collaborator migration and backup;
- GitHub CodeQL/default setup, Secret Scanning, push protection, private vulnerability
  reporting, and a no-bypass default-branch ruleset;
- a clean full-history secret scan after the chosen history treatment;
- license and redistribution review for every generated learning dataset and image asset.

History rewriting, repository visibility changes, and control enablement are owner actions.
They are not performed by this application PR.

## Residual and unverified risks

- Vercel Deployment Checks remain **not owner-verified** in the repository evidence.
- A repository-independent private vulnerability-reporting channel does not yet exist;
  this blocks general product distribution, not only repository publication.
- Browser storage is visible to other users of the same browser profile and is not encrypted.
  The UI warns users not to enter confidential information and to clear site data on shared
  devices.
- Takken assessment content remains provisional until the qualified-review gate in ADR-017
  is satisfied; this is a content-validity risk, not a confidentiality exception.
- The repository's current private-plan API responses do not prove which GitHub Advanced
  Security controls will become active after a visibility or plan change. Reverify at the
  moment of change.
