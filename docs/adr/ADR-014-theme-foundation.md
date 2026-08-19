# ADR-014: Validated appearance settings and a replaceable theme registry

## Context

The first token guardrail made palette retuning safer, but all values and roughly
3,000 lines of screen CSS still lived in `app/globals.css`. The application had no
theme concept, and its persisted settings contained only `soundEnabled`. A redesign
performed directly in that shape would either erase the previous visual baseline or
spread theme choices through React components.

TypeLoop is local-first. Existing history and settings must survive schema growth,
and a persisted appearance must apply before hydration to avoid a visible flash.

## Decision

- `application/settings` owns closed unions, defaults, and field-by-field
  normalization for appearance settings.
- Theme, density, and motion are independent axes. The initial themes are `modern`
  and `classic`; adding another theme extends the allow-list and CSS registry rather
  than screen components.
- The existing repository remains the only settings persistence boundary.
- Presentation writes validated identifiers to `data-theme`, `data-density`, and
  `data-motion` on the document root. A small first-party `beforeInteractive` script
  restores only allow-listed values before hydration.
- Raw design values move to `app/styles/themes.css`. Global and component styles
  consume the stable token contract, and the existing CI guard follows the registry.
- The classic theme is a reversible visual fallback. Behavior, training data,
  storage keys, and session timing are not theme concerns.

Dark mode is deferred until component use sites migrate from historical palette
names such as `--ink-deep` to fully semantic surface and content roles. Inverting
those mixed-purpose tokens would create inaccessible combinations.

## Alternatives

- **React context containing concrete colors.** Rejected because it moves design
  values into TSX, causes avoidable rerenders, and bypasses the CSS guardrail.
- **A second localStorage key for appearance.** Rejected because two settings owners
  can drift and complicate recovery from corrupt data.
- **Ship dark mode by swapping existing primitives.** Rejected because the same
  primitives currently serve both foreground and background roles.
- **Unrestricted custom token values.** Rejected because persisted arbitrary values
  are difficult to validate, migrate, test, and keep accessible.

## Consequences

Older sound-only payloads gain default appearance fields without losing history or
sound preference. Invalid future or corrupt values fail closed to authored defaults.
The app can switch themes without changing screen markup, and the modern redesign can
land screen by screen while classic remains available for comparison and rollback.

The next visual phase must extract semantic surface, content, action, and status
tokens before adding dark mode. It should also continue splitting screen styles out
of `globals.css` by responsibility rather than by arbitrary line count.
