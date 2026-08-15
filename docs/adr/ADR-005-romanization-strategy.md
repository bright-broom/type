# ADR-005: Romanization Strategy

## Context

The engine needs explicit, teachable behavior for alternative spellings, small `っ`, and ambiguous `ん` before vowels or `y`.

## Decision

Use data-defined kana variants. Small `っ` emits the next unit's consonant. `ん` accepts `n`, `nn`, or `n'` before unambiguous consonants/end, and requires `nn` or `n'` before vowels, `y`, or another `n`.

## Alternatives

Browser IME conversion and hidden heuristic correction were rejected.

## Consequences

Rules are deterministic and visible in tests. The MVP intentionally supports common Hepburn and keyboard-input variants rather than every historical scheme.
