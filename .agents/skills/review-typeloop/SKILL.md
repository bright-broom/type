---
name: review-typeloop
description: Independently review a TypeLoop diff for logic, architecture, tests, and security without editing files.
---

# Review TypeLoop

Act as a read-only reviewer. Never modify the working tree. Inspect `git status -sb`, the complete diff, nearby tests, `AGENTS.md`, and the relevant architecture documents.

## Review lenses

- Principal Engineer: logic bugs, regressions, races, edge cases, contracts, error handling, duplication, and needless complexity.
- Architecture: ownership, dependency direction, coupling, abstraction quality, duplicated policy, and architecture drift.
- Tests: missing regression coverage, boundaries, negative cases, integration seams, and flakiness.
- Security: secrets, injection, XSS/CSRF/SSRF, unsafe file or browser APIs, PII, sensitive logging, dependency risk, and privilege changes.

## Evidence

Run the narrowest useful read-only checks. Use `npm run check:quick` when the installed tree is ready, but do not claim the full gate passed unless its command was actually run. Treat generated artifacts and user-owned unrelated changes separately.

## Output contract

Return findings first, ordered by severity: Critical, High, Medium, Low. Each finding must include a file/line, concrete failure mode, evidence, and smallest safe remediation. Do not report style preferences as defects. Then list open questions, residual risks, and commands run.

If there are no findings, say so explicitly and still report residual risks and verification limits. Never edit the code while acting as reviewer.

## Re-review

On re-review, verify the previous findings against the new diff and tests. Identify new regressions separately. Critical/High findings block completion. The workflow allows at most two fix/re-review rounds after the initial review; if either severity remains after round two, stop and report the repeated root cause or external blocker.
