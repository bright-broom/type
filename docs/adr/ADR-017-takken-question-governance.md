# ADR-017: Takken question governance and versioning

## Context

The official exam declares a legal-basis date for each edition, while the official archive warns that older questions may no longer match current law. The administering organisation also prohibits unauthorised reproduction and modification of website content. Attempt history must continue to resolve after a question is corrected.

## Decision

Ship an original editioned study pack derived from TypeLoop's tracked glossary instead of copying official question text. Every question carries a concept-derived stable id, revision, content-fingerprinted pack version, legal-basis date, category, concept ids, source label, answer, explanation, and review status. Structural validation rejects malformed or duplicate-choice questions before they reach the UI.

Attempts persist question ids and pack version, not duplicated question text. Published question revisions are never edited in place; a correction adds a revision. Official past questions may be added only after the repository owner confirms permission or another lawful basis.

The generated pack starts as `provisional`. The launcher must identify it as mechanically constructed and not professionally supervised. Moving a question to `published` requires a licensed or otherwise qualified subject-matter reviewer to inspect the stem, every choice, keyed answer, explanation, legal-basis date, source, and category metadata. Per-question, per-revision evidence is recorded in `takken-question-reviews.json` and signed with the reviewer's Ed25519 key. The owner-managed `TAKKEN_REVIEWER_KEYS_JSON` repository variable is the external trust root: it binds a reviewer id to qualification evidence, allowed subject categories, and public key. CI defaults to no trusted reviewers and rejects `published` unless the evidence date is within the verified edition, the exact question and registry digests match, the review points to an immutable TypeLoop commit, and the signature verifies. A pull request cannot make itself trusted by editing repository files. Automated validation is never described as a semantic or legal review.

## Alternatives

- Copy the official PDF into a generated dataset. Rejected because public availability is not permission to republish or modify it.
- Generate legal explanations at runtime. Rejected because it adds a network dependency and makes answers non-reproducible.
- Store question text in every attempt. Rejected because it wastes limited browser storage and creates stale duplicate content.

## Consequences

The first pack is clearly labelled as provisional original study material, builds are deterministic and offline, and any content change creates a new pack identity so an active older attempt cannot silently resolve against changed questions. Subject-matter review remains the gate for `published` status even when code and schema tests pass.
