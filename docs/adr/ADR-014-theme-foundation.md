# ADR-014: Validated appearance settings and a replaceable theme registry

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
- Appearance is persisted in a validated cookie because the server needs it for
  the first paint. Sound and history remain behind the existing local repository.
- Server rendering writes validated identifiers to `data-theme`, `data-density`,
  and `data-motion`; presentation updates the same attributes after an in-session
  change.
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

## The restore is server-rendered, because no client script can beat the paint

Appearance is persisted in a cookie and the server sets `data-theme`, `data-density`,
and `data-motion` on `<html>` while rendering. The attributes therefore arrive with
the document and the first paint already uses the stored theme.

A client-side restore was tried first and measured on the built app, not assumed.
Serving the document truncated just before the app markup showed the default theme
painting:

```text
before:  {"theme":"(unset)", "bg":"rgb(245, 243, 237)"}   // default --paper
after:   {"theme":"classic", "bg":"rgb(238, 243, 245)"}   // classic --paper
```

Three placements produced identical output at the same byte offset: `next/script`
with `strategy="beforeInteractive"`, a plain `<script>` inside `<head>`, and
`<script dangerouslySetInnerHTML>` as the first child of `<body>`. React 19
serialises a script authored in a Server Component into its flight payload wherever
it sits, so it runs through the client runtime after the initial HTML has painted. No
JSX placement avoids this on Next 16 / React 19, which is why the cookie is not a
convenience but the only mechanism that works.

### Why a cookie does not create a second owner

Appearance was **moved**, not copied: `AppSettings` no longer carries it, and reading
an envelope that still does drops the stale value. Sound and history stay in
localStorage because the server never needs them. Each preference has exactly one
owner, split by a real criterion — whether the server must know it before painting.

The cookie holds three dot-separated allow-listed identifiers, no personal data. It
is `SameSite=Lax` and `Secure` outside development, and is not `HttpOnly` because the
settings screen writes it. `parseAppearance` falls back per field, so a truncated or
hand-edited value never reaches the rendered attributes; `appearance-cookie.test.ts`
and `e2e/appearance.spec.ts` both assert that, including a `"><script>` payload.

Reading a cookie makes the route dynamic. It already was, so nothing was lost; a
future static export would have to fall back to a client-side restore and accept the
flash.
