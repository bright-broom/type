# ADR-023: CDN-prerendered shell and URL-owned reference screens

## Status

Accepted — 2026-08-21

This number follows agent-control ADR-022 in PR #38. This change must be rebased after
PRs #33, #36, #37, and #38 before merge so the sequence is present on `main`.

## Context

TypeLoop has no account, backend, or request-specific product data, but reading cookies
and headers in the root layout made every route a request-time Lambda response with
`no-store` semantics. Settings, history, and two reference dictionaries also existed
only as internal overlays, so reload, Back, bookmarks, and deep links did not identify
the user's current work surface.

The appearance cookie previously justified SSR because hydrated scripts ran after the
first paint. Product-quality work introduced a tiny validated same-origin bootstrap,
creating a safer static alternative if its emitted position can be enforced.

## Decision

- Every application route is prerendered. Request cookies, request headers, and async
  search parameters are forbidden from the root delivery path.
- Static metadata uses one production canonical base. Preview HTML remains identical;
  no host-derived metadata creates a rendering boundary.
- The document ships authored noir defaults. A raw parser-blocking
  `/theme-bootstrap.js` in `<head>` validates the appearance cookie and sets root
  attributes, native color scheme, and theme metadata before `<body>` can paint.
- One authored JSON inventory feeds both the service worker and the build gate. The
  gate requires an exact match with Next's application prerenders, immutable
  `initialRevalidateSeconds`, and the bootstrap before body markup in emitted home HTML.
- Settings, typing history, consulting, AIS, and the takken glossary own stable routes.
  One route-state hook maps URLs to reference surfaces, owns `popstate`, and restores
  deterministic in-app Back behavior.
- Starting a timed session replaces the reference URL with `/`; active timing and
  keystrokes remain an in-memory application state machine.
- `TypingApp` keeps session and input composition. Lazy reference rendering moves to a
  separate component and URL/history policy moves to a separate hook.

## Alternatives

- **Keep cookie SSR.** Rejected because it makes public local-first content pay a
  request-time compute and cache-miss cost on every route.
- **Use `next/script` beforeInteractive.** Rejected because the emitted document stores
  an instruction for the Next runtime rather than a parser-blocking script element.
- **Use only client state without routes.** Rejected because it leaves Back, reload,
  bookmarking, and assistive navigation without a stable destination.
- **Move active typing sessions into URL routes.** Rejected because transient countdown,
  pause, and keystroke state should not become navigation or serialization state.

## Consequences

All public application surfaces can be served from the CDN without a Lambda invocation.
The service worker atomically caches every declared static route and the route-specific
Next assets discovered from their emitted HTML, so a previously installed build can
also start from a deep application URL offline. Query strings reuse the matching cached
route document. The install manifest therefore exposes the browser-tested takken
glossary as a direct shortcut. Appearance retains one cookie owner and a pre-paint restore, with an
explicit root hydration-warning boundary limited to document attributes. Reference
screens are deep-linkable and Back-aware. The bootstrap is a deliberate render-blocking
1.1 KB same-origin asset; its size, content, and emitted position remain release-gated.
