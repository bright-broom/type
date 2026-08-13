# ADR-002: Typing Engine Design

## Context
Japanese readings accept multiple romanizations. Precomputing every full sentence creates a Cartesian-product risk.

## Decision
Represent each kana unit as variants and incrementally advance a small nondeterministic set of valid prefix states. Keep the engine pure and browser-independent.

## Alternatives
Single canonical answer strings and eager full-candidate generation were rejected.

## Consequences
`shi`/`si`, contracted sounds, sokuon, and contextual `n` rules compose without candidate explosion. New mappings require focused unit tests.
