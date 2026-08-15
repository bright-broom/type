# ADR-001: Framework

## Context

The MVP needs a responsive React UI, server-rendered entry shell, strict TypeScript, and a deployment path that does not add a backend dependency to play.

## Decision

Use standard Next.js App Router with React 19 as a modular monolith. Keep the product as a single route whose explicit game state machine controls the core journey.

## Alternatives

Cloudflare vinext, a client-only Vite SPA, and a heavier game framework were considered.

## Consequences

The first interaction is fast and route transitions cannot interrupt a session. Standard Next.js output is directly deployable on Vercel; the stateful client boundary must remain small and well tested.
