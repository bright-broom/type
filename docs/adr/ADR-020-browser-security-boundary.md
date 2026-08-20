# ADR-020: Browser and supply-chain security boundary

## Context

TypeLoop is a local-first static-data application with no backend API, authentication, uploads, or required runtime network calls. The repository pinned action references voluntarily, but repository settings allowed every action and did not require full commit SHAs. Browser responses also exposed the framework header and did not declare a Content Security Policy or capability boundary.

## Decision

Apply one same-origin browser policy to every route. Disable the framework identification header; deny framing, objects, forms outside the origin, external connections, sensitive device capabilities, and MIME sniffing; and isolate top-level browsing contexts. HSTS protects only the exact deployed HTTPS host; `includeSubDomains` and preload are withheld until an owner verifies every subdomain and records rollback ownership. The CSP deliberately omits `upgrade-insecure-requests`, because the production test harness serves HTTP and WebKit otherwise upgrades its same-origin assets to an unavailable HTTPS endpoint. Next.js hydration requires inline scripts and styles, so production permits `unsafe-inline` but never `unsafe-eval`. Development alone permits eval for the Next.js development runtime. Automated response tests verify the effective production headers on every route and a hydrated client interaction in both browser engines.

Enable Dependabot vulnerability alerts and automated security fixes in GitHub. Restrict Actions to GitHub-owned actions plus individually documented owner-managed exceptions, and require every action reference to use a full commit SHA. The current allowlist contains only `openai/codex-action@*`, reserved for the separately reviewed agent-control workflow; adding another pattern requires an ADR that names its consumer and trust boundary. These settings are owner-managed external controls; their verified state and date belong in `docs/security-control-checklist.md` rather than being inferred from workflow source.

## Alternatives

- A nonce-based strict CSP was deferred because Next.js nonce rendering would force dynamic rendering and conflicts with the planned static-shell work.
- Report-only CSP was rejected because the application has a closed runtime network boundary and can exercise the enforced policy in both browser engines before release.
- Allowing all Marketplace actions was rejected because every non-GitHub-owned action must be individually justified, allowlisted, and SHA-pinned.

## Consequences

An accidental third-party request, embed, device API, or unpinned action fails closed. Preview tooling that injects cross-origin frames may not render inside the application; this does not affect the product or Vercel deployment status. Any future analytics, external API, worker, font, image, or embedded service requires an explicit ADR and CSP change with browser coverage.
