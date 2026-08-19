# ADR-015: Semantic color roles and noir as the default theme

## Context

ADR-014 introduced a replaceable theme registry but deliberately deferred dark mode. Historical palette tokens such as `--ink-deep` served both as text and as a dark surface, so inverting them could produce white text on white controls or light shadows on a dark canvas.

The product now requires a near-monochrome, dark-first interface while retaining an explicit light option. The change must not add runtime theme logic, delay the first paint, or fork component markup.

## Decision

- Add `noir` to the closed theme allow-list and make it the default. Keep `modern` as the light product theme and `classic` as the compatibility theme.
- Introduce stable semantic roles for canvas, surfaces, content, controls, focus, and inverse regions. New component styling consumes roles rather than palette names.
- Apply the existing modern product layer to both `noir` and `modern`; theme selection changes tokens only.
- Reserve colored status tokens for success and danger. Ordinary emphasis in `noir` uses neutral values.
- Continue server-rendering the validated theme identifier from the existing cookie, preserving a flash-free first paint and one persistence owner.
- Validate core semantic foreground/background pairs for every theme and cover the default, selector availability, persistence, and dark `color-scheme` in browser tests.

## Alternatives

- **Invert the historical palette tokens.** Rejected because several tokens carry conflicting foreground and background responsibilities.
- **Use `prefers-color-scheme` as the only switch.** Rejected because it removes explicit user control and cannot preserve a choice independent of the operating system.
- **Add a React theme provider.** Rejected because concrete styles belong in CSS, the server already knows the theme, and a provider would add rerenders without improving capability.
- **Remove the previous themes.** Rejected because an additive theme is reversible and preserves persisted identifiers and the existing visual fallback.

## Consequences

Noir loads by default without client bootstrap code, network activity, or additional dependencies. The same DOM and component behavior serve dark and light presentations. The semantic layer creates a safe migration path for remaining historical palette references; touched styles should move to roles, while the token and contrast gates prevent accidental regressions during that migration.
