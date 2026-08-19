# ADR-016: Assessment experience boundary

## Context

TypeLoop's existing session is a 60-second typing activity whose invariants are romanization, keystroke scoring, a monotonic active clock, and WPM history. A takken mock exam instead needs four-choice answers, free navigation, review flags, a deadline that continues in the background, and assessment-specific history.

## Decision

Add `assessment` capabilities inside the existing modular monolith. Pure questions, plans, and scoring live in `domain/assessment`; lifecycle orchestration lives in `application/assessment`; takken owns its question pack under `content/takken`; persistence is supplied through an application port; and interactive routes delegate to `presentation`.

`TrainingSet`, the typing reducer, and typing persistence remain unchanged. Assessment receives addressable `/takken` routes so reload, back navigation, and route-level code splitting do not expand `TypingApp`'s overlay state.

Mock time is a stored wall-clock deadline because a real examination continues while a tab is hidden. This is deliberately different from the monotonic, pausable typing clock in ADR-004.

## Alternatives

- Treat the mock as another `TrainingSet`. Rejected because it would overload WPM, romanization, and the 60-second lifecycle with unrelated meanings.
- Add every screen to `TypingApp`. Rejected because one client component would own two independent state machines and load the assessment bundle on the typing route.
- Build a generic qualification plugin system. Rejected until a second qualification demonstrates a real shared requirement.

## Consequences

Typing compatibility stays additive, assessment behavior is independently testable, and future qualifications may reuse proven assessment rules without inheriting takken law or taxonomy. Multiple public routes and a second persistence capability are now part of the architecture.
