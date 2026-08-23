# Security policy

## Reporting a vulnerability

This repository is private, so its GitHub advisory flow is not reachable by general product
users. Public distribution remains blocked until an owner provisions and verifies a public
policy plus a private reporting channel independent of repository access. Do not publish
exploit details, personal information, credentials, or user data in a public Issue.

The eventual private report should include the affected URL or revision, a minimal
reproduction, security impact, and any safe remediation suggestion. This repository does
not currently operate a bug-bounty program.

## Supported version

Only the current production version and the latest `main` revision receive security
updates. Preview deployments and older local installations are not separately supported.

## Product boundary

TypeLoop is a local-first static web application. It has no account system, backend
database, analytics SDK, advertising tracker, or runtime third-party API. Browser storage
contains local learning aggregates and preferences and must not be treated as a secure
place for confidential information. Security changes follow the pull-request-only process
in `CONTRIBUTING.md`; production promotion and rollback remain human-owned operations.
