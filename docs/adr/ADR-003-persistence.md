# ADR-003: Persistence

## Context

The product is explicitly local-first, has no account or backend, and must remain playable when storage is unavailable or corrupt.

## Decision

Use a versioned `SessionRepository` port with a defensive localStorage adapter. Retain at most 50 completed sessions and never write during the typing hot path. Persist only the aggregates required by history and weak-key analysis. Prompt text, partial input, and ordered keystroke timelines are active-session data and are removed before localStorage writes or JSON archive export. Reading a legacy envelope migrates it to the minimized shape and rewrites the local copy best-effort.

## Alternatives

IndexedDB and cloud persistence were deferred because the MVP data volume is small and cloud features are out of scope.

## Consequences

History and settings are device-local, but local storage is not treated as a secure vault. Storage exceptions cannot crash play, a legacy record cannot retain unnecessary typed detail after migration, and a later adapter can migrate to another store.
