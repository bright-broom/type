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

The distribution shell is static and local-first. Every application route is prerendered
to an invariant CDN document; no request cookie or header creates a Lambda boundary. A
production-only service worker atomically caches every declared route document and the
same-origin build assets discovered from them, so installed deep links remain interactive
offline. It owns no product state, never handles non-GET or
cross-origin requests, waits behind clients of the previous release, and is registered
as a non-fatal progressive enhancement. A pre-paint script restores the validated
appearance cookie before application paint, both online and from cached HTML. See
[ADR-021](adr/ADR-021-product-quality-delivery.md) and
[ADR-023](adr/ADR-023-static-route-shell.md).

`public/application-routes.json` is the single delivery inventory. The production build
must match it exactly, and the service worker reads that same artifact before installation,
so a newly added route cannot silently escape either CDN or offline guarantees.

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

Appearance is persisted in a validated cookie that a small, same-origin parser-blocking
script reads in `<head>`. The static document carries safe noir defaults; the script
applies theme, density, motion, browser chrome, and `color-scheme` before `<body>` can
paint. CI inspects the emitted HTML byte order, so a framework transform cannot silently
move this boundary behind hydration (see [ADR-023](adr/ADR-023-static-route-shell.md)).

```text
settings UI → cookie → pre-paint bootstrap → <html data-theme/density/motion> → CSS themes
```

Sound and session history stay in `SessionRepository`/localStorage. Each preference has
exactly one owner. Cookie values are three allow-listed identifiers, validated per field
before they reach document attributes.

Reference work surfaces are URL-owned even though they reuse the in-memory typing
composition. `/settings`, `/history`, `/consulting`, `/ais`, and `/takken/glossary`
survive reload and bookmarks; `popstate` restores the prior surface and focus target.
The active timed session remains an in-memory state machine and replaces reference URLs
with `/` before play, so Back cannot reopen an overlay during a run.

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
- `scripts/check-bundle-budget.mjs` bounds JavaScript, CSS, and public raster delivery weight.
- `npm run check` is the canonical deterministic local validation command; CI adds the network-backed dependency audit with `npm run check:ci`.
- `.agents/skills/develop-typeloop` provides a reusable, progressively loaded workflow for TypeLoop changes.
- Root and nested `AGENTS.md` files hold a small number of consequential review invariants; mechanical rules remain in CI.
- Durable changes to these boundaries require an ADR.
