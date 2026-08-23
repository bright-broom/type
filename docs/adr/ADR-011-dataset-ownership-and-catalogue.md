# ADR-011: Dataset ownership and the training set catalogue

## Context

At the time of this decision four training sets existed, and adding one touched more places than it should:

- A dataset's code was split in two. `content/ais/` held its types and filters while
  its prompt adapter held the code that turns it into
  `TypingPrompt`s. Neither directory described a whole dataset, and both had to be
  edited together.
- `content/prompts/validate-prompts.ts` was a pure rule over domain types with no
  content dependency at all, sitting in the wrong layer.
- The catalogue binding a `TrainingSet` identifier to its prompts lived in
  `presentation/hooks/training-set-prompts.ts` — not a hook, and not presentation's
  subject matter. It was there only because `TrainingSet` was declared in
  `application`, and `application` may not import `content`.

The last point is the root cause: the identifier's home decided which layer had to
own the wiring.

## Decision

**`TrainingSet` is a domain concept.** It names a collection of prompts, so it sits
beside `TypingPrompt` in `domain/prompts/prompt-types.ts`. `application` imports it
to persist which set was played; it no longer defines it.

**`content` owns the catalogue.** `content/training-set-catalog.ts` binds each
identifier to its prompts and exports `TRAINING_SETS` and `byTrainingSet`. It is
declared the single module allowed to reach across dataset directories.
`presentation` consumes the catalogue instead of assembling it.

**One directory per dataset.** `content/<dataset>/` owns that dataset's types,
filters, prompt adapter, and tests. `content/prompts/` is gone; `japanese/` joins
`takken/` and `consulting/` as a peer. The AIS dataset was later removed by ADR-024;
the ownership rule remains unchanged.

**Pure rules move to the domain.** `validate-prompts.ts` now lives in
`domain/prompts/`, where its dependencies already pointed.

**The structure enforces itself.** `tests/architecture-boundaries.test.mjs` fails on
a cross-dataset import, on a React hook declared outside `presentation/hooks`, and
if the catalogue stops binding several datasets.
`content/training-set-catalog.test.ts` validates every catalogued set against the
typing engine and asserts prompt ids do not collide between sets, so a newly
registered dataset cannot ship unvalidated.

## Alternatives

- **Leave the catalogue in presentation.** Rejected: it forced the layer that only
  renders to also know every dataset, and it hid a non-hook in `hooks/`.
- **Let `application` import `content`.** Rejected: it inverts the dependency rule
  and would let session logic depend on learning material.
- **Move the generated artifacts into each dataset directory.** Considered, because
  it would make a dataset directory literally complete. Rejected: generated files
  have a distinct lifecycle — importer output, never hand-edited, reviewed by counts
  rather than as code — and keeping them in one `content/generated/` directory keeps
  that rule scoped to a single `AGENTS.md` and a single coverage exclusion. The
  boundary test treats `generated` as an artifact store rather than a dataset.
- **Keep `keyboard-inset.ts` out of `presentation/hooks`.** Rejected: it is the pure
  rule that `useKeyboardInset` evaluates, and separating them would split one
  capability across two directories for no gain.

## Consequences

Adding a training set is now: add `content/<dataset>/`, extend the `TrainingSet`
union, add one catalogue entry. Nothing in `application`, `infrastructure`, or
`presentation` changes, and the catalogue test covers the new set automatically.

Dataset directories can be read, reviewed, and removed independently, and the
boundary test prevents them from growing dependencies on each other.

This is a pure move: no runtime behaviour, persisted shape, or `TrainingSet` string
value changed. Persisted sessions keep their `trainingSet` values, so existing
local history and personal bests continue to resolve.
