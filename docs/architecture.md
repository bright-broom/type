# Architecture

## System shape

TypeLoop is a single-route, local-first Next.js modular monolith. The browser owns the active session, audio, settings, and history. There is no backend, account, or runtime network dependency.

The architecture optimizes for deterministic typing behavior, fast local feedback, and clear boundaries that can be verified without starting a browser.

## Layers and dependency direction

| Layer            | Responsibility                                          | May depend on                             |
| ---------------- | ------------------------------------------------------- | ----------------------------------------- |
| `domain`         | Typing rules, scoring, prompt selection, analytics      | `domain` only                             |
| `application`    | Session state, transitions, application types, ports    | `application`, `domain`                   |
| `content`        | Learning datasets, filters, validation, prompt adapters | `content`, `domain`                       |
| `infrastructure` | Browser audio and persistence adapters                  | `infrastructure`, `application`, `domain` |
| `presentation`   | React UI, browser event handling, composition           | all layers                                |

Dependencies point inward toward stable policy. `application/ports` owns interfaces because application behavior defines what it needs; `infrastructure` supplies implementations.

`app/` is the Next.js framework boundary. It should remain thin and delegate product behavior to `presentation`.

## Runtime flow

```text
Next.js route
  → TypingApp
    → useTypingSession
      → application session reducer
      → domain typing/scoring/analytics
      → content prompt datasets
      → infrastructure audio/localStorage adapters
```

The active typing path stays in memory. Persistence happens after session completion or a settings change, never on every keystroke.

## Content flow

Source workbooks or TSV files are imported by scripts into `src/content/generated`. Authored loaders and validators expose those artifacts as typed prompt collections.

```text
source file → importer → generated JSON → typed content loader → presentation
```

Generated artifacts are versioned for reproducible builds but are not hand-edited.

## State and failure boundaries

- The session reducer is the source of truth for lifecycle and time transitions.
- `performance.now()` is the monotonic active-session clock.
- localStorage is best-effort; corrupt or unavailable storage must not stop play.
- Audio failures are non-fatal and must not alter scoring.
- Domain modules remain deterministic and testable without React or browser mocks.

## Extension rules

When adding a training set:

1. Add or generate content under `src/content`.
2. Convert it to `TypingPrompt` without changing domain rules unless the input model truly differs.
3. Register the selector in the presentation composition hook.
4. Extend the `TrainingSet` type and persistence lookup.
5. Add dataset validation and an interaction-level test.

When adding persistence or another external capability, define the required port in `application/ports`, implement it in `infrastructure`, and wire it only at the presentation composition boundary.

## Guardrails

- `tests/architecture-boundaries.test.mjs` enforces layer dependencies.
- `tests/repository-conventions.test.mjs` enforces required documentation, precise directory names, and authored-file size limits.
- `npm run check` is the canonical deterministic local validation command; CI adds the network-backed dependency audit with `npm run check:ci`.
- `.agents/skills/develop-typeloop` provides a reusable, progressively loaded workflow for TypeLoop changes.
- Root and nested `AGENTS.md` files hold a small number of consequential review invariants; mechanical rules remain in CI.
- Durable changes to these boundaries require an ADR.
