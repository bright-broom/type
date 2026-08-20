# ADR-014: Validated appearance settings and a replaceable theme registry

Status: Extended by [ADR-015](ADR-015-semantic-color-system.md); appearance delivery superseded by [ADR-023](ADR-023-static-route-shell.md).

## Context

The first token guardrail made palette retuning safer, but all values and roughly
3,000 lines of screen CSS still lived in `app/globals.css`. The application had no
theme concept, and its persisted settings contained only `soundEnabled`. A redesign
performed directly in that shape would either erase the previous visual baseline or
spread theme choices through React components.

TypeLoop is local-first. Existing history and settings must survive schema growth,
and a persisted appearance must be restored as early as the framework allows.

## Decision

- `application/settings` owns closed unions, defaults, and field-by-field
  normalization for appearance settings.
- Theme, density, and motion are independent axes. The initial themes are `modern`
  and `classic`; adding another theme extends the allow-list and CSS registry rather
  than screen components.
- Appearance is persisted in a validated cookie because the delivery shell needs it
  for the first paint. Sound and history remain behind the existing local repository.
- The delivery boundary writes validated identifiers to `data-theme`, `data-density`,
  and `data-motion`; presentation updates the same attributes after an in-session change.
- Raw design values move to `app/styles/themes.css`. Global and component styles
  consume the stable token contract, and the existing CI guard follows the registry.
- `app/styles/modern.css` is a theme-scoped product layer over the stable component
  class contract. It contains no raw color, geometry, or motion values; those remain
  globally adjustable in the registry.
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

The modern layer now owns the current product language while classic remains a
rollback surface. Future visual phases should continue extracting screen styles out
of `globals.css` by responsibility rather than by arbitrary line count. Dark mode
still requires semantic content and status roles before palette inversion is safe.

## Static delivery supersedes the original server restore

The original implementation read the cookie during SSR. ADR-023 replaces that request
boundary with one invariant prerendered document and a same-origin parser-blocking
script. The distinction is structural: `next/script` and hydrated inline scripts were
too late, while the emitted raw `<script src="/theme-bootstrap.js">` is verified to
appear in `<head>` before `<body>` and executes during HTML parsing.

### Why a cookie does not create a second owner

Appearance was **moved**, not copied: `AppSettings` no longer carries it, and reading
an envelope that still does drops the stale value. Sound and history stay in
localStorage. Each preference has exactly one owner.

The cookie holds three dot-separated allow-listed identifiers, no personal data. It
is `SameSite=Lax` and `Secure` outside development, and is not `HttpOnly` because the
settings screen and bootstrap read it. Validation falls back per field, so a truncated
or hand-edited value never reaches document attributes; unit and browser tests cover
that boundary, including a `"><script>` payload.
