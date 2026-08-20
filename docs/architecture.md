# Architecture

## System shape

TypeLoop is a local-first Next.js modular monolith. The browser owns active typing and assessment sessions, audio, settings, and history. There is no backend, account, or runtime network dependency. Typing stays on the primary route; substantial learning experiences use addressable routes so their state and bundles remain independent.

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

Assessment is a separate application capability. Its low-frequency answers are persisted after each transition so a long mock exam survives reload, while question content remains a versioned build artifact.

```text
Takken route
  → Takken assessment presentation
    → application assessment state machine
    → domain plan and scoring rules
    → content takken question pack
    → infrastructure assessment repository
```

## Layout flow

Responsive page geometry is a presentation policy with one entry point. Routes and
screens do not independently own viewport gutters or content maxima.

```text
viewport + safe-area insets
  → fluid tokens in themes.css
    → typed PageShell width/spacing role
      → screen-owned Grid/Flex composition
```

`PageShell` is the only application-level `<main>` owner. Its semantic width roles
keep catalogue, reading, assessment, session, game, and compact workspaces distinct
without duplicating page geometry. It also establishes an inline-size container so
components can evolve with their actual workspace. See
[ADR-018](adr/ADR-018-fluid-page-layout.md).

## Appearance flow

Appearance is the one preference the server must know before it renders, so it is
persisted in a cookie and applied to the document root during SSR. The first paint
already carries the stored theme; no client script is involved, because React
serialises one into its flight payload where it runs too late (see
[ADR-014](adr/ADR-014-theme-foundation.md)).

```text
settings UI → cookie → SSR reads it → <html data-theme/density/motion> → CSS themes
```

Sound and session history stay in `SessionRepository`/localStorage, which the server
never needs to read. Each preference has exactly one owner. Cookie values are three
allow-listed identifiers, validated per field before they reach the rendered HTML.

## Content flow

Source workbooks or TSV files are imported by scripts into `src/content/generated`. Authored loaders and validators expose those artifacts as typed prompt collections.

```text
source file → importer → generated JSON → typed content loader → presentation
```

Generated artifacts are versioned for reproducible builds but are not hand-edited.

Confidentiality is an importer responsibility, not a UI one. When a source contains
material that must not reach a deployed bundle, the importer de-identifies it and
fails on any leak, so the generated artifact is already the publishable form. See
[ADR-009](adr/ADR-009-ais-meeting-glossary.md).

## State and failure boundaries

- The session reducer is the source of truth for lifecycle and time transitions.
- `performance.now()` is the monotonic active-session clock.
- localStorage is best-effort; corrupt or unavailable storage must not stop play.
- Audio failures are non-fatal and must not alter scoring.
- Software-keyboard focus is owned by the presentation composition boundary because it must ride a user gesture; see [ADR-010](adr/ADR-010-software-keyboard-input.md).
- Input the romanization engine cannot consume is reported, never silently dropped, and never counted as a typing mistake.
- Domain modules remain deterministic and testable without React or browser mocks.

## Release flow

Release automation is a control plane outside the runtime modular monolith. A
feature branch produces CI evidence and a Vercel Preview; a human performs the
merge. Vercel Deployment Checks **must be configured and owner-verified** before
the exact `main` SHA validation can be treated as a production-domain prerequisite;
repository code alone does not provide that guarantee. CI failure reconciliation is
serialized and latest-run/attempt owned, while production promotion and rollback
remain human-only. Autofix separates untrusted pull-request execution from Git,
Actions, and PR write capabilities. See [ADR-019](adr/ADR-019-release-safety.md) and
the [release checklist](release-checklist.md).

## Extension rules

When adding a training set:

1. Add or generate content under `src/content/<dataset>/`, keeping the dataset self-contained.
2. Convert it to `TypingPrompt` without changing domain rules unless the input model truly differs.
3. Extend the `TrainingSet` union in `domain/prompts/prompt-types.ts`.
4. Bind the set to its dataset in `content/training-set-catalog.ts`. Selectors, personal bests, and persistence lookups derive from that catalogue, so no other wiring is needed.
5. Add dataset validation and an interaction-level test.

When adding persistence or another external capability, define the required port in `application/ports`, implement it in `infrastructure`, and wire it only at the presentation composition boundary.

## Guardrails

- `tests/architecture-boundaries.test.mjs` enforces layer dependencies, dataset self-containment, and that React hooks stay in `presentation/hooks`.
- `tests/repository-conventions.test.mjs` enforces required documentation, precise directory names, and authored-file size limits.
- The same repository guard requires every application screen to enter through the typed `PageShell` contract.
- `scripts/check-design-tokens.mjs` keeps raw colors inside the theme registry and out of components.
- `npm run check` is the canonical deterministic local validation command; CI adds the network-backed dependency audit with `npm run check:ci`.
- `.agents/skills/develop-typeloop` provides a reusable, progressively loaded workflow for TypeLoop changes.
- Root and nested `AGENTS.md` files hold a small number of consequential review invariants; mechanical rules remain in CI.
- Durable changes to these boundaries require an ADR.
