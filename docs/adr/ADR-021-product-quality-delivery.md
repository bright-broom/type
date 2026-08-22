# ADR-021: Product quality is a delivery contract

## Status

Accepted — 2026-08-21

This number is reserved after release-safety ADR-019 in PR #33 and browser-security
ADR-020 in PR #36. This change must not merge before those two PRs and must be
rebased after them so the sequence is present on `main`.

## Context

TypeLoop already protects behavior, accessibility, responsive geometry, and JavaScript weight. Product quality still had four gaps: sharing art was oversized, mobile supporting text could shrink below a comfortable reading size, visual changes had no pixel baseline, and the local-first application had no installable/offline shell.

Adding these as isolated UI tweaks would let the same risks return. Offline support also changes the browser distribution boundary and must remain unable to introduce an external runtime dependency.

## Decision

- Social and install imagery is a versioned product asset with exact dimensions and byte budgets.
- Informative text never renders below 11px. `--font-caption` and `--font-micro` are the two smallest semantic sizes; individual screens do not invent smaller values. A source-wide CSS floor complements representative rendered-screen checks.
- A production-only service worker caches the root HTML and the exact same-origin Next.js assets referenced by it. It handles only same-origin `GET` requests, treats navigation as network-first, and keeps registration failure non-fatal. Every required response must be successful or installation fails atomically. Static assets not discovered during atomic installation are rejected rather than fetched through an older page. Normal releases do not call `skipWaiting`, so they cannot evict the cache of an older, still-open client. The ADR-024 privacy-boundary release is the sole enumerated exception: when an exact restricted legacy cache is present, the fully staged worker activates immediately, deletes every retired shell, claims its clients, and navigates existing windows from the worker itself so the operation does not depend on code in the old page.
- The cached document runs a same-origin, pre-paint appearance bootstrap. It validates the current cookie before restoring document attributes and browser chrome, so an offline reload cannot revive the theme that happened to be active at install time. The document root explicitly suppresses the expected attribute-only hydration difference at this boundary; browser errors remain test failures. Its colors are passed from a CSS-derived build artifact; the public script owns no palette.
- The manifest advertises only the offline-supported root start URL. A route shortcut is added only when that route has a tested offline shell.
- The Web App Manifest, offline interactive shell, and representative phone typography are browser-tested.
- Chromium owns pixel baselines for the home, settings, assessment launcher, and result surfaces. Baselines are platform-specific because system Japanese fonts rasterize differently on macOS and Linux.
- Lab LCP and CLS budgets plus measured single-interaction Event Timing budgets run in the production browser harness. The interaction check requires a positive `interactionId` and separates the product-owned processing interval (100 ms) from a broader hosted-runner end-to-end safety ceiling (500 ms). It is deliberately not labelled INP because one synthetic interaction is not the field metric's grouping and percentile algorithm, and shared-runner scheduling is not field latency. These are release regressions, not a claim about field telemetry; session content remains local and no analytics endpoint is added.
- The existing bundle gate also owns total/largest CSS and public raster budgets. Takken assessment CSS is imported by the Takken route layout rather than the root application stylesheet.

## Alternatives

- Field analytics would provide real-user data, but it would add a runtime network and privacy boundary that this local-first product does not currently need.
- A third-party PWA package would reduce service-worker code, but would add dependency and generated-runtime complexity for a deliberately small shell.
- Cross-platform shared pixel baselines were rejected because system Japanese font metrics make them noisy; behavior and geometry remain cross-browser, while pixel comparison is platform-specific.

## Consequences

The application can be installed and a previously installed home shell can start a typing session without a network connection while preserving its current appearance. New public imagery, CSS growth, sub-11px informative text, visual drift, or major lab performance regressions fail before merge.

The service worker can normally serve an older cached shell until activation completes. Cache names are explicit release identities and activation deletes older TypeLoop shell caches. A specifically named privacy-retirement cache is fail-closed instead: the new atomic shell replaces it immediately and controlled pages reload, accepting interruption of an in-progress local session to retire previously distributed restricted material. Runtime content, settings, history, and answers remain on-device; no new backend, analytics, or third-party request exists.
