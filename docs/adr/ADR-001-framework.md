# ADR-001: Framework

## Context
The MVP needs a responsive React UI, server-rendered entry shell, strict TypeScript, and a deployment path that does not add a backend dependency to play.

## Decision
Use the existing React 19 + vinext modular monolith. Keep the product as a single route whose explicit game state machine controls the core journey.

## Alternatives
Multi-route Next.js pages, a client-only Vite SPA, and a heavier game framework were considered.

## Consequences
The first interaction is fast and route transitions cannot interrupt a session. The stateful client boundary must remain small and well tested.
