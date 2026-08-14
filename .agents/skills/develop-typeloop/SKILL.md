---
name: develop-typeloop
description: Implement, refactor, debug, test, or review TypeLoop application code and learning content. Use for changes under app, src, scripts, or tests; typing behavior, session state, UI, persistence, generated datasets, architecture boundaries, and repository quality gates.
---

# Develop TypeLoop

Use the repository's existing boundaries and validation ladder to make the smallest behavior-preserving change.

## Orient

1. Read `AGENTS.md` and the closest relevant test.
2. Read `docs/architecture.md` for cross-layer work and `docs/directory-structure.md` before adding or moving files.
3. Inspect `git status -sb`; preserve unrelated changes.
4. Trace the behavior from composition inward instead of scanning the whole repository:
   - UI event: `presentation` → `application` → `domain`
   - storage/audio: `presentation` → `application/ports` → `infrastructure`
   - training content: `presentation` → `content` → `domain/prompts`

## Choose the change path

- Typing, scoring, prompt selection, or analytics: change `domain`; add a table-driven unit test first.
- Session lifecycle or orchestration: change `application`; cover transitions and monotonic-time behavior.
- React rendering or browser input: change `presentation`; keep business rules out of components and hooks.
- Browser persistence or audio: preserve the application port and change the `infrastructure` adapter.
- Learning datasets: change the importer, regenerate `src/content/generated`, and run the dataset validation tests. Never hand-edit generated JSON.
- New dependency direction or top-level layer: update the boundary test, architecture document, and ADR together.

## Validate efficiently

Run the narrowest relevant test while iterating, then expand:

1. Domain-only change: `npm run test:domain`.
2. Boundary or repository-policy change: `npm run test:architecture`.
3. Any completed code change: `npm run check:quick`.
4. Before handoff or publication: `npm run check`.
5. For dependency or CI changes: `npm run check:ci`.

Do not report success from a narrow test alone. Include the final command and result in the handoff.

## Review the diff

Apply the Code Review Rules in `AGENTS.md`. Check especially for removed compatibility, runtime network access, direct generated-data edits, browser APIs leaking inward, and tests that assert implementation details instead of behavior.

Keep changes local and reversible. Do not add an agent framework, MCP server, AI review action, or dependency unless the task needs it and the required credentials, ownership, and operating cost are explicit.
