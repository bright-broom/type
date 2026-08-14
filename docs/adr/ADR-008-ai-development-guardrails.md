# ADR-008: AI-readable development guardrails

## Context
AI agents need a compact repository map, deterministic validation commands, and machine-enforced boundaries. Without those, implementation quality depends on long prompts and undocumented human context. Generated content also appeared as a multi-thousand-line authored TypeScript module, making safe navigation and review harder.

## Decision
Use a concise root `AGENTS.md` as the entry map and keep detailed design in `docs`. Establish `npm run check` as the canonical validation command used by both local agents and CI. Enforce architectural dependencies, required repository documents, precise directory naming, and a 300-line ceiling for authored code. Isolate generated artifacts under `src/content/generated` and keep typed loaders small.

## Alternatives
A custom monorepo toolchain, dependency-analysis package, and extensive agent-specific instruction framework were rejected. The repository is small enough for Node-based tests and npm scripts already supported by the existing stack.

## Consequences
Agents can discover rules without a detailed prompt, local and CI validation use the same command, and common structural regressions fail mechanically. Generated data remains large but is explicitly separated from authored code. New exceptions require updating the documented rule and its enforcing test together.
