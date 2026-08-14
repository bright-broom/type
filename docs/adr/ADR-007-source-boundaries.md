# ADR-007: Source directory boundaries

## Context
The code already follows a layered design, but UI code was split across generic `components` and `hooks` folders, static curriculum data used the ambiguous `data` name, and the persistence port lived beside its browser adapter. Those locations made the intended dependency direction harder to see and easier to violate.

## Decision
Organize `src` by architectural responsibility: `presentation`, `application`, `domain`, `infrastructure`, and `content`. Place application-owned interfaces in `application/ports`, keep adapters in `infrastructure`, and enforce the allowed inward dependencies with an automated architecture test.

## Alternatives
A feature-sliced rewrite and separate packages were rejected because the application is a single-route modular monolith. They would add build and navigation overhead without a corresponding deployment or team boundary.

## Consequences
Directory names now match the architecture diagram, static learning content has an explicit boundary, and invalid cross-layer imports fail the test suite. Presentation remains the composition boundary that connects content and infrastructure to application behavior.
