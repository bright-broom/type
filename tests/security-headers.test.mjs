import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "../next.config.ts";

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
});

test("the production CSP is same-origin and blocks dangerous embedding", () => {
  const csp = headers["content-security-policy"];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /connect-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-eval|https?:\/\//);
});

test("HSTS does not claim unverified subdomains or preload eligibility", () => {
  assert.equal(headers["strict-transport-security"], "max-age=63072000");
});
