# TypeLoop agent guide

## Start here

TypeLoop is a local-first Next.js typing trainer. Before structural work, read:

- `docs/architecture.md` — system boundaries and dependency direction
- `docs/directory-structure.md` — placement and naming rules
- `docs/adr/README.md` — design-decision index
- `.agents/skills/develop-typeloop/SKILL.md` — focused implementation and validation workflow

## Repository map

- `app/`: Next.js routes, metadata, and global styles
- `src/presentation/`: React components and browser-facing hooks
- `src/application/`: session state and application-owned ports
- `src/domain/`: pure framework-independent business rules
- `src/infrastructure/`: browser adapters implementing application ports
- `src/content/`: authored content loaders, filters, types, and tests
- `src/content/generated/`: generated artifacts; never edit by hand
- `scripts/`: repeatable content importers
- `tests/`: cross-layer and repository-level guardrails

## Rules

- Preserve the dependency rules in `docs/architecture.md`; CI enforces them.
- Keep domain code independent of React, Next.js, browser APIs, and persistence.
- Put interfaces needed by application logic in `src/application/ports` and implementations in `src/infrastructure`.
- Use precise responsibility names. Do not create generic `shared`, `common`, or `utils` directories.
- Keep authored TypeScript, JavaScript, and Python files below 300 lines. Split by responsibility, not merely by size.
- Regenerate content with the npm import commands; do not patch generated JSON directly.
- Do not add dependencies, persistence, authentication, or network calls without a concrete requirement and ADR-worthy justification.
- Never commit `.env*`, credentials, tokens, or user-local output.

## Code Review Rules

### Behavioral compatibility

- Treat accepted romanization sequences, scoring formulas, the 60-second monotonic clock, persisted storage keys/schema, and training-set IDs as compatibility surfaces.
- Prefer additive compatibility. Removing or renaming an existing behavior requires an explicit requirement, a safe migration path when persisted data is involved, and a regression test.

### Local-first data boundary

- Typed input, session history, weak-key data, and settings stay on-device. Flag new runtime network calls, telemetry, authentication, or server persistence unless the requirement and ADR explicitly establish that boundary.
- Use the existing localStorage port for persistence; never log user session contents or silently weaken best-effort failure handling.

## Workflow

1. Run `git status -sb` and inspect nearby tests and ADRs.
2. Make the smallest coherent change that preserves existing behavior.
3. During iteration, run `npm run check:quick`.
4. Before handoff, run `npm run check`.
5. Record only durable architectural decisions in `docs/adr`.

## Commands

- Install: `npm ci`
- Develop: `npm run dev`
- Fast validation: `npm run check:quick`
- Full validation: `npm run check`
- CI validation including dependency audit: `npm run check:ci`
- Architecture only: `npm run test:architecture`
- Consulting import: `npm run import:consulting -- "/path/to/source.xlsx"`
- Takken import: `npm run import:takken -- "/path/to/source.tsv"`
