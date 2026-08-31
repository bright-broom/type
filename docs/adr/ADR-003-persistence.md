# ADR-003: Persistence

## Context

The product is explicitly local-first, has no account or backend, and must remain playable when storage is unavailable or corrupt.

## Decision

Use a versioned `SessionRepository` port with a defensive localStorage adapter. Retain at most 50 completed sessions and never write during the typing hot path.

Daily score summaries have a different lifecycle from session details. Keep one summary per local calendar day—date, best score, and session count—for up to 3,660 days. This preserves roughly ten years of calendar progress without retaining unbounded keystroke or prompt detail. When an older envelope has no summaries, derive them once from its retained sessions.

## Alternatives

IndexedDB and cloud persistence were deferred because the MVP data volume is small and cloud features are out of scope.

## Consequences

History and settings are device-local. Storage exceptions cannot crash play, and a later adapter can migrate to another store. The calendar can outlive detailed session rows; when detail has expired, the UI says so instead of implying that no practice occurred.
