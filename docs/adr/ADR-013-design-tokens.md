# ADR-013: Single-source design tokens with enforced boundaries

Status: Superseded in placement by [ADR-014](ADR-014-theme-foundation.md). The
single-source and enforcement principles remain active.

## Context

A tone redesign is planned, with more expected after it. Measuring the stylesheet
first showed why that was unsafe: `app/globals.css` carried **two** `:root` blocks —
the second silently overriding nine tokens of the first — plus eighteen hex values
outside any token, and 64 numeric `rgb()` literals of which several still spelled
the palette the second block had replaced. Four near-identical grays (`#93a6ae`,
`#93a2aa`, `#92a7b0`, `#8da0aa`) had accumulated by accident. The `--muted` token,
fixed to meet WCAG AA in ADR-012, had been overridden back below AA (4.43:1).

Retuning the tone meant grepping ~3,000 lines and hoping.

## Decision

**One marked token block.** This placement was moved by ADR-014; all color values
now live between `@tokens-begin` and `@tokens-end` in `app/styles/themes.css` — primitives (with `--*-rgb` channel triplets
for translucent use) and semantic roles (`--text-prose`, `--text-on-dark`,
`--surface-raised`). Everything below the block references `var(--token)`.

**Enforced, not documented.** `npm run check:tokens` (in `check:quick` and `check`)
rejects color literals outside the block, a second `:root`, and any color literal
in authored TS/TSX. `tests/design-tokens.test.mjs` asserts the core reading pairs
meet AA, that channel triplets match their hex base, and that no two tokens hold
the same value — the exact failure modes found above, each of which had already
happened.

**Stale literals realigned, imperceptible duplicates merged.** Old-palette `rgb()`
remnants now reference the current token channels; grays within a few channel
units were merged into one token. Deltas are below perception at the sizes used;
the axe E2E gate verifies the rendered result.

**Two guideline rules added to `AGENTS.md`:** colors only via tokens (CI-enforced),
and meaningful thresholds as named module-level constants (review-enforced — an
AST rule for "magic numbers" drowns in false positives, so this one stays human).

## Alternatives

- **Split the stylesheet into `tokens.css`/`base.css`/per-screen files.** Deferred:
  parallel work is landing in this file continuously, and a split multiplies merge
  conflicts while the enforcement already guarantees the seam. Worth revisiting
  when churn settles.
- **Full semantic indirection (`--surface`, `--text` aliases over primitives).**
  Deferred with the theming work: today primitives double as the semantic layer
  for the base theme, and a `[data-theme]` block overriding tokens is already
  sufficient for a second theme. Renaming 368 `var()` references buys nothing
  until a second theme actually maps roles differently.
- **Tokenize the type scale and spacing in the same pass.** Rejected for scope:
  color is the tone lever, and spacing/radius/layout tokens already existed. The
  ramp can be tokenized when the tone redesign actually touches it.
- **UI copy catalogue (i18n).** Rejected for now: single-language app; a catalogue
  adds indirection with no consumer.

## Consequences

A tone change is an edit to one block; a broken one fails contract tests in
milliseconds, the token check on commit, and axe in CI. The palette can no longer
fork silently. `--muted` is back above AA (`#5f707a`, 4.63:1 on `--paper`).

Color literals in test files remain allowed (tests may assert rendered colors),
and computed non-color style values in TSX (widths, transforms) remain legitimate.
