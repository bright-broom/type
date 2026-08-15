# ADR-004: Timer Source of Truth

## Context

Interval counters drift and background tabs throttle callbacks.

## Decision

Use monotonic `performance.now()` differences as the source of truth. Animation frames only request repaint; pause duration is explicitly subtracted.

## Alternatives

One-second interval decrement and wall-clock timestamps were rejected for active timing.

## Consequences

Delayed callbacks jump to the correct remaining time. Clock transitions can be tested with numeric inputs and no browser timer mocks.
