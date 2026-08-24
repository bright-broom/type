import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EXPECTED_PRODUCTION_HEADERS } from "./production-release-contract.mjs";
import { serviceWorkerShellAssetPaths } from "./production-release-fetch.mjs";
import { verifyProductionRelease, verifyProductionReleaseOnce } from "./verify-production-release.mjs";

const SHA = "a".repeat(40);
const ORIGIN = "https://type-tau.vercel.app";
const ROUTES = ["/", "/privacy"];
const ROUTE_HEADERS = {
  ...EXPECTED_PRODUCTION_HEADERS,
  "content-type": "text/html; charset=utf-8",
  "x-typeloop-release": SHA,
};
const DECLARED_SHELL_ASSETS = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/theme-bootstrap.js",
];
const SHELL_ASSETS = ["/application-routes.json", ...DECLARED_SHELL_ASSETS, "/sw.js"];

function response(body, init = {}) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: init.headers,
  });
}

function html(content = "safe") {
  return `<!doctype html><html><body><main data-layout-shell="default">${content}</main></body></html>`;
}

function routeResponse(content, init = {}) {
  return response(content, { ...init, headers: { ...ROUTE_HEADERS, ...init.headers } });
}

function assetResponse(path, body = "safe") {
  const type = path.endsWith(".css")
    ? "text/css"
    : path.endsWith(".json") || path.endsWith(".webmanifest")
      ? "application/json"
      : path.endsWith(".svg")
        ? "image/svg+xml"
        : path.endsWith(".png")
          ? "image/png"
          : "application/javascript";
  const headers = { "content-type": type };
  if (path === "/sw.js") {
    headers["cache-control"] = "no-cache, no-store, must-revalidate";
    headers["x-typeloop-release"] = SHA;
  }
  return response(body, { headers });
}

test("walks the route inventory and same-origin shipped assets", async () => {
  const requested = [];
  const responses = new Map([
    ["/", routeResponse(html('<script src="/_next/static/app.js"></script>'))],
    ["/privacy", routeResponse(html('<link rel="stylesheet" href="/_next/static/app.css">'))],
    ["/application-routes.json", assetResponse("/application-routes.json", JSON.stringify(ROUTES))],
    ["/_next/static/app.js", assetResponse("/_next/static/app.js", '"static/chunks/lazy.js"')],
    ["/_next/static/app.css", assetResponse("/_next/static/app.css", "safe css")],
    ["/_next/static/chunks/lazy.js", assetResponse("/_next/static/chunks/lazy.js")],
    ["/ais", routeResponse("not found", { status: 404 })],
  ]);
  for (const path of SHELL_ASSETS) {
    if (!responses.has(path)) {
      const body = path === "/sw.js" ? `const SHELL_ASSETS = ${JSON.stringify(DECLARED_SHELL_ASSETS)};` : "safe";
      responses.set(path, assetResponse(path, body));
    }
  }
  const fetchImpl = async (url, options) => {
    const parsed = new URL(url);
    requested.push({ path: parsed.pathname, redirect: options.redirect });
    const result = responses.get(parsed.pathname);
    if (!result) throw new Error(`Unexpected request: ${parsed.pathname}`);
    return result;
  };

  const assessment = await verifyProductionReleaseOnce({
    repository: "bright-broom/type",
    origin: ORIGIN,
    expectedSha: SHA,
    expectedRoutes: ROUTES,
    fetchImpl,
    deploymentProvider: async () => ({ sha: SHA, state: "success" }),
  });

  assert.equal(assessment.healthy, true);
  assert.deepEqual(assessment.stats, { routes: 2, assets: 12, documents: 14 });
  assert.deepEqual(
    new Set(requested.map((request) => request.path)),
    new Set([
      ...SHELL_ASSETS,
      "/",
      "/privacy",
      "/ais",
      "/_next/static/app.css",
      "/_next/static/app.js",
      "/_next/static/chunks/lazy.js",
    ]),
  );
  assert.ok(requested.every((request) => request.redirect === "manual"));
});

test("does not follow a route redirect or consume its body as trusted content", async () => {
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/application-routes.json") return assetResponse(path, JSON.stringify(ROUTES));
    if (path === "/") {
      return routeResponse("redirect", {
        status: 302,
        headers: { location: "https://example.invalid/escape" },
      });
    }
    if (path === "/privacy") return routeResponse(html());
    if (path === "/ais") return routeResponse("not found", { status: 404 });
    if (SHELL_ASSETS.includes(path)) {
      const body = path === "/sw.js" ? `const SHELL_ASSETS = ${JSON.stringify(DECLARED_SHELL_ASSETS)};` : "safe";
      return assetResponse(path, body);
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  const assessment = await verifyProductionReleaseOnce({
    repository: "bright-broom/type",
    origin: ORIGIN,
    expectedSha: SHA,
    expectedRoutes: ROUTES,
    fetchImpl,
    deploymentProvider: async () => ({ sha: SHA, state: "success" }),
  });
  assert.equal(assessment.healthy, false);
  assert.ok(assessment.violations.some((violation) => violation.code === "document-redirected"));
});

test("reads the shell asset inventory from the shipped Service Worker and fails closed", () => {
  assert.deepEqual(
    serviceWorkerShellAssetPaths(`const SHELL_ASSETS = ${JSON.stringify(DECLARED_SHELL_ASSETS)};`),
    DECLARED_SHELL_ASSETS,
  );
  assert.throws(() => serviceWorkerShellAssetPaths("const SHELL_ASSETS = [];"), /invalid/);
  assert.throws(() => serviceWorkerShellAssetPaths('const SHELL_ASSETS = ["//outside.invalid/a.js"];'), /invalid/);
  for (const path of ["/a\nb", "/a#fragment"]) {
    assert.throws(() => serviceWorkerShellAssetPaths(`const SHELL_ASSETS = ${JSON.stringify([path])};`), /invalid/);
  }
  assert.throws(() => serviceWorkerShellAssetPaths('const SHELL_ASSETS = ["/a\nb"];'), /invalid/);
  assert.throws(
    () => serviceWorkerShellAssetPaths('const SHELL_ASSETS = ["/a.js"];\nconst SHELL_ASSETS = ["/b.js"];'),
    /duplicated/,
  );
});

test("the production verifier derives the exact inventory from the real Service Worker", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.deepEqual(serviceWorkerShellAssetPaths(source), DECLARED_SHELL_ASSETS);
});

test("bounds retries by the overall deadline", async () => {
  let now = 0;
  let attempts = 0;
  const assessment = await verifyProductionRelease({
    attempts: 20,
    intervalMs: 15,
    totalTimeoutMs: 30,
    nowImpl: () => now,
    waitImpl: async (milliseconds) => {
      now += milliseconds;
    },
    verifyOnceImpl: async () => {
      attempts += 1;
      return { healthy: false, violations: [], stats: { routes: 0, assets: 0, documents: 0 } };
    },
  });
  assert.equal(assessment.healthy, false);
  assert.equal(attempts, 2);
  assert.equal(now, 30);
});
