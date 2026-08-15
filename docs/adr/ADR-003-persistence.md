# ADR-003: Persistence

## Context

The product is explicitly local-first, has no account or backend, and must remain playable when storage is unavailable or corrupt.

## Decision

Use a versioned `SessionRepository` port with a defensive localStorage adapter. Retain at most 50 completed sessions and never write during the typing hot path.

## Alternatives

IndexedDB and cloud persistence were deferred because the MVP data volume is small and cloud features are out of scope.

## Consequences

History and settings are device-local. Storage exceptions cannot crash play, and a later adapter can migrate to another store.
