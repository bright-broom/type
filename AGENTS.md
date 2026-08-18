# TypeLoop agent guide

## Start here

TypeLoop is a local-first Next.js typing trainer. Before structural work, read:

- `docs/architecture.md` — system boundaries and dependency direction
- `docs/directory-structure.md` — placement and naming rules
- `docs/quality-harness.md` — deterministic gates, bugfix flow, and review loop
- `docs/adr/README.md` — design-decision index
- `.agents/skills/develop-typeloop/SKILL.md` — focused implementation and validation workflow
- `.agents/skills/review-typeloop/SKILL.md` — read-only independent review contract

## Repository map

- `app/`: Next.js routes, metadata, and global styles
- `src/presentation/`: React components and browser-facing hooks
- `src/application/`: session state and application-owned ports
- `src/domain/`: pure framework-independent business rules
- `src/infrastructure/`: browser adapters implementing application ports
- `src/content/`: one directory per learning dataset, plus `training-set-catalog.ts` binding each `TrainingSet` to its prompts
- `src/content/generated/`: generated artifacts; never edit by hand
- `scripts/`: repeatable content importers and their authored ingestion policies
- `tests/`: cross-layer and repository-level guardrails

## Rules

- Preserve the dependency rules in `docs/architecture.md`; CI enforces them.
- Keep domain code independent of React, Next.js, browser APIs, and persistence.
- Put interfaces needed by application logic in `src/application/ports` and implementations in `src/infrastructure`.
- Use precise responsibility names. Do not create generic `shared`, `common`, or `utils` directories.
- Keep authored TypeScript, JavaScript, and Python files below 300 lines. Split by responsibility, not merely by size.
- Regenerate content with the npm import commands; do not patch generated JSON directly.
- Confidential source material is de-identified by its importer, never by the UI. Do not commit source workbooks, and do not add a real customer or personal name to any authored file (see `docs/adr/ADR-009-ais-meeting-glossary.md`).
- Do not add dependencies, persistence, authentication, or network calls without a concrete requirement and ADR-worthy justification.
- Never commit `.env*`, credentials, tokens, or user-local output.
- The application currently has no database or migrations. Stop and require an ADR plus an approved migration/rollback plan before adding either.
- Never run destructive data, filesystem, Git-history, credential, OS, SSH, firewall, or production operations without explicit approval.
- Never deploy or change production directly. Use a reviewed PR and green CI as a procedural policy; branch protection
  requires an eligible GitHub plan and owner configuration.

## Code Review Rules

### Behavioral compatibility

- Treat accepted romanization sequences, scoring formulas, the 60-second monotonic clock, persisted storage keys/schema, and training-set IDs as compatibility surfaces.
- Prefer additive compatibility. Removing or renaming an existing behavior requires an explicit requirement, a safe migration path when persisted data is involved, and a regression test.

### Local-first data boundary

- Typed input, session history, weak-key data, and settings stay on-device. Flag new runtime network calls, telemetry, authentication, or server persistence unless the requirement and ADR explicitly establish that boundary.
- Use the existing localStorage port for persistence; never log user session contents or silently weaken best-effort failure handling.

## Workflow

1. Run `git status -sb` and inspect nearby tests and ADRs.
2. For bugs: reproduce → add a failing regression test → identify the root cause → apply the smallest fix.
3. Make the smallest coherent change that preserves existing behavior.
4. During iteration, run `npm run check:quick`.
5. Before handoff, run `npm run check` and request an independent `review-typeloop` review.
6. Resolve every Critical/High finding and use at most two fix/re-review rounds after the initial review. If either
   severity remains after round two, stop and report the blocker.
7. Record only durable architectural decisions in `docs/adr`.

## Commands

- Install: `npm ci`
- Install browser: `npm run e2e:install`
- Develop: `npm run dev`
- Format: `npm run format` / `npm run format:check`
- Fast validation: `npm run check:quick`
- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- Coverage: `npm run test:coverage`
- Browser/E2E: `npm run test:e2e`
- Dead code: `npm run check:dead-code`
- Security: `npm run check:security`
- Full local validation: `npm run check`
- CI-equivalent validation: `npm run check:ci`
- Architecture only: `npm run test:architecture`
- Consulting import: `npm run import:consulting -- "/path/to/source.xlsx"`
- Takken import: `npm run import:takken -- "/path/to/source.tsv"`
- AIS meeting glossary import: `npm run import:ais -- "/path/to/source.xlsx"`

## Definition of Done

- Required behavior is covered by a regression, integration, or E2E test at the correct boundary.
- `npm run check:ci` succeeds and the evidence is reported; do not substitute an AI claim for command output.
- The final diff contains no secret, generated-file hand edit, architecture drift, or unrelated product change.
- An independent reviewer reports no unresolved Critical/High finding.
- CI is green before merge; production changes still require human approval.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
