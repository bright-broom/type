# TypeLoop agent guide

## Start here

TypeLoop is a local-first Next.js typing trainer. Before structural work, read:

- `docs/architecture.md` — system boundaries and dependency direction
- `docs/directory-structure.md` — placement and naming rules
- `docs/adr/README.md` — design-decision index

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
- Architecture only: `npm run test:architecture`
- Consulting import: `npm run import:consulting -- "/path/to/source.xlsx"`
- Takken import: `npm run import:takken -- "/path/to/source.tsv"`
