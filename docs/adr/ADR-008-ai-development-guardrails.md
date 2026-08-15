# ADR-008: AI-readable development guardrails

## Context

AI agents need a compact repository map, deterministic validation commands, and machine-enforced boundaries. Without those, implementation quality depends on long prompts and undocumented human context. Generated content also appeared as a multi-thousand-line authored TypeScript module, making safe navigation and review harder.

## Decision

Use a concise root `AGENTS.md` as the entry map and keep detailed design in `docs`. Store repeatable TypeLoop procedures as a repo-scoped skill under `.agents/skills`, using progressive disclosure instead of expanding always-loaded instructions. Keep a small set of consequential compatibility and data-boundary review rules in `AGENTS.md`, with directory-specific guidance close to generated content. Establish `npm run check` as the deterministic local validation command and `npm run check:ci` as the CI variant with a network-backed dependency audit. Enforce architectural dependencies, required agent artifacts, precise directory naming, and a 300-line ceiling for authored code. Isolate generated artifacts under `src/content/generated` and keep typed loaders small.

## Alternatives

A custom monorepo toolchain, dependency-analysis package, and extensive agent-specific instruction framework were rejected. The repository is small enough for Node-based tests and npm scripts already supported by the existing stack.

## Consequences

Agents can discover rules without a detailed prompt, load the implementation workflow only when relevant, and apply the same repository invariants during implementation and review. Local and CI validation share deterministic gates, CI additionally rejects known High dependency vulnerabilities, and common structural regressions fail mechanically. Generated data remains large but is explicitly separated from authored code. New exceptions require updating the documented rule and its enforcing test together.
