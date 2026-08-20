# Architecture decision records

ADRs capture durable decisions that constrain future implementation. They do not replace feature requirements or routine code comments.

| ADR                                                    | Decision                                             |
| ------------------------------------------------------ | ---------------------------------------------------- |
| [001](ADR-001-framework.md)                            | Next.js modular monolith                             |
| [002](ADR-002-typing-engine-design.md)                 | Incremental typing engine                            |
| [003](ADR-003-persistence.md)                          | Local-first persistence port                         |
| [004](ADR-004-timer-source-of-truth.md)                | Monotonic session clock                              |
| [005](ADR-005-romanization-strategy.md)                | Explicit romanization variants                       |
| [006](ADR-006-takken-glossary.md)                      | Static takken glossary ingestion                     |
| [007](ADR-007-source-boundaries.md)                    | Source directory boundaries                          |
| [008](ADR-008-ai-development-guardrails.md)            | AI-readable repository guardrails                    |
| [009](ADR-009-ais-meeting-glossary.md)                 | De-identified meeting glossary ingestion             |
| [010](ADR-010-software-keyboard-input.md)              | Software keyboard input on touch devices             |
| [011](ADR-011-dataset-ownership-and-catalogue.md)      | Dataset ownership and the training set catalogue     |
| [012](ADR-012-cross-browser-durability-and-budgets.md) | Cross-browser proof, storage durability, and budgets |
| [013](ADR-013-design-tokens.md)                        | Single-source design tokens with enforced boundaries |
| [014](ADR-014-theme-foundation.md)                     | Validated settings and replaceable theme registry    |
| [015](ADR-015-semantic-color-system.md)                | Semantic color roles and noir as the default theme   |
| [016](ADR-016-assessment-experience.md)                | Separate assessment experience and deadline clock    |
| [017](ADR-017-takken-question-governance.md)           | Versioned original takken question governance        |
| [018](ADR-018-fluid-page-layout.md)                    | Typed fluid page layout contract                     |
| [019](ADR-019-release-safety.md)                       | Capability-separated release automation              |

Add an ADR only for a decision with meaningful alternatives and long-lived consequences. Use the next number and include Context, Decision, Alternatives, and Consequences.
