import assert from "node:assert/strict";
import test from "node:test";
import nextConfig, { RELEASE_COMMIT, resolveReleaseCommit } from "../next.config.ts";
import { EXPECTED_PRODUCTION_HEADERS } from "../scripts/production-release-contract.mjs";

const configuredRoutes = await nextConfig.headers();
const headers = Object.fromEntries(
  configuredRoutes.flatMap(({ headers: routeHeaders }) =>
    routeHeaders.map(({ key, value }) => [key.toLowerCase(), value]),
  ),
);

test("production responses declare the complete security header boundary", async () => {
  assert.equal(nextConfig.poweredByHeader, false);
  assert.equal(configuredRoutes[0].source, "/:path*");
  for (const required of [
    "content-security-policy",
    "referrer-policy",
    "permissions-policy",
    "x-content-type-options",
    "x-frame-options",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
    "strict-transport-security",
  ]) {
    assert.ok(headers[required], `${required} is missing`);
  }
  for (const [name, value] of Object.entries(EXPECTED_PRODUCTION_HEADERS)) {
    assert.equal(headers[name], value, `${name} drifted from the production verifier`);
  }
  assert.equal(headers["x-typeloop-release"], RELEASE_COMMIT);
  assert.match(RELEASE_COMMIT, /^(?:[0-9a-f]{40}|unavailable)$/);
});

test("the production CSP is same-origin and blocks dangerous embedding", () => {
  const csp = headers["content-security-policy"];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /script-src-attr 'none'/);
  assert.match(csp, /connect-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-eval|https?:\/\//);
  assert.equal(headers["referrer-policy"], "no-referrer");
});

test("HSTS does not claim unverified subdomains or preload eligibility", () => {
  assert.equal(headers["strict-transport-security"], "max-age=63072000");
});

test("the service worker script cannot be retained by an intermediary cache", () => {
  const serviceWorkerRoute = configuredRoutes.find(({ source }) => source === "/sw.js");
  assert.ok(serviceWorkerRoute);
  assert.deepEqual(serviceWorkerRoute.headers, [
    { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
  ]);
});

test("release identity prefers Vercel, falls back to GitHub, and fails closed", () => {
  const vercel = "a".repeat(40);
  const github = "b".repeat(40);
  assert.equal(resolveReleaseCommit(vercel, github), vercel);
  assert.equal(resolveReleaseCommit(undefined, github), github);
  assert.equal(resolveReleaseCommit("invalid", github), "unavailable");
  assert.equal(resolveReleaseCommit(undefined, undefined), "unavailable");
});
