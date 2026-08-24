import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProductionOrigin,
  assessProductionRelease,
  EXPECTED_PRODUCTION_HEADERS,
  formatProductionReleaseReport,
} from "./production-release-contract.mjs";

const SHA = "a".repeat(40);
const ROUTES = ["/", "/privacy", "/settings"];
const ROUTE_HEADERS = {
  ...EXPECTED_PRODUCTION_HEADERS,
  "content-type": "text/html; charset=utf-8",
  "x-typeloop-release": SHA,
};
const SAFE_HTML = '<!doctype html><html><body><main data-layout-shell="default">safe</main></body></html>';

function healthySnapshot() {
  return {
    expectedSha: SHA,
    deployment: { sha: SHA, state: "success" },
    expectedRoutes: ROUTES,
    remoteRoutes: ROUTES,
    documents: [
      { kind: "route", path: "/", status: 200, redirected: false, text: SAFE_HTML, headers: ROUTE_HEADERS },
      {
        kind: "route",
        path: "/privacy",
        status: 200,
        redirected: false,
        text: SAFE_HTML,
        headers: ROUTE_HEADERS,
      },
      {
        kind: "route",
        path: "/settings",
        status: 200,
        redirected: false,
        text: SAFE_HTML,
        headers: ROUTE_HEADERS,
      },
      {
        kind: "asset",
        path: "/_next/static/app.js",
        status: 200,
        redirected: false,
        text: "safe",
        bodyBytes: 4,
        expectedContentType: "javascript",
        headers: { "content-type": "application/javascript" },
      },
    ],
    retiredRoute: { status: 404, redirected: false, text: "not found", headers: ROUTE_HEADERS },
    serviceWorkerHeaders: {
      "cache-control": "no-cache, no-store, must-revalidate",
      "x-typeloop-release": SHA,
    },
  };
}

test("accepts a same-origin HTTPS production root only", () => {
  assert.equal(assertProductionOrigin("https://type-tau.vercel.app").origin, "https://type-tau.vercel.app");
  for (const value of [
    "http://type-tau.vercel.app",
    "https://user@type-tau.vercel.app",
    "https://type-tau.vercel.app:444",
    "https://type-tau.vercel.app/path",
    "https://type-tau.vercel.app?query=1",
    "https://type-tau.vercel.app/#fragment",
  ]) {
    assert.throws(() => assertProductionOrigin(value), /canonical HTTPS origin/);
  }
});

test("accepts an exact healthy production release without exposing response content", () => {
  const assessment = assessProductionRelease(healthySnapshot());
  assert.deepEqual(assessment, {
    healthy: true,
    violations: [],
    stats: { routes: 3, assets: 1, documents: 4 },
  });
  const report = formatProductionReleaseReport(assessment, {
    expectedSha: SHA,
    origin: "https://type-tau.vercel.app",
  });
  assert.match(report, /Production release verification passed/);
  assert.doesNotMatch(report, /response body/i);
});

test("fails closed across deployment, routing, content, and header boundaries", () => {
  const snapshot = healthySnapshot();
  snapshot.deployment = { sha: "b".repeat(40), state: "failure" };
  snapshot.remoteRoutes = [...ROUTES, "/unexpected"];
  snapshot.documents[0] = { ...snapshot.documents[0], redirected: true };
  snapshot.documents[1] = { ...snapshot.documents[1], text: SAFE_HTML.replace("safe", "person@company.jp") };
  snapshot.documents[3] = { ...snapshot.documents[3], status: 500 };
  snapshot.retiredRoute = { status: 200, redirected: false, text: "safe", headers: ROUTE_HEADERS };
  snapshot.serviceWorkerHeaders = {};

  const assessment = assessProductionRelease(snapshot);
  assert.equal(assessment.healthy, false);
  assert.deepEqual(
    assessment.violations.map((violation) => violation.code),
    [
      "deployment-sha-mismatch",
      "deployment-not-successful",
      "route-inventory-mismatch",
      "document-redirected",
      "restricted-content",
      "document-request-failed",
      "retired-route-reachable",
      "service-worker-cache",
      "release-sha-header",
    ],
  );
  const report = formatProductionReleaseReport(assessment, {
    expectedSha: SHA,
    origin: "https://type-tau.vercel.app",
  });
  assert.doesNotMatch(report, /person@company\.jp/);
  assert.match(report, /restricted-content/);
});

test("enforces the complete route header contract on every route and the retired 404", () => {
  for (const header of [...Object.keys(EXPECTED_PRODUCTION_HEADERS), "x-typeloop-release"]) {
    const snapshot = healthySnapshot();
    snapshot.documents[1] = {
      ...snapshot.documents[1],
      headers: { ...snapshot.documents[1].headers, [header]: "weakened" },
    };
    const assessment = assessProductionRelease(snapshot);
    assert.equal(assessment.healthy, false, header);
    assert.ok(
      assessment.violations.some((item) => item.scope === "/privacy"),
      header,
    );
  }

  const retired = healthySnapshot();
  retired.retiredRoute = {
    ...retired.retiredRoute,
    text: "AIS週次定例会議 MTG-2026-01-AIS",
    headers: { ...retired.retiredRoute.headers, "x-content-type-options": "" },
  };
  const assessment = assessProductionRelease(retired);
  assert.ok(assessment.violations.some((item) => item.code === "restricted-content" && item.scope === "/ais"));
  assert.ok(assessment.violations.some((item) => item.code === "header-x-content-type-options"));
});

test("rejects a non-HTML route shell and an empty or mistyped asset", () => {
  const snapshot = healthySnapshot();
  snapshot.documents[0] = {
    ...snapshot.documents[0],
    text: "maintenance",
    headers: { ...snapshot.documents[0].headers, "content-type": "text/plain" },
  };
  snapshot.documents[3] = {
    ...snapshot.documents[3],
    bodyBytes: 0,
    headers: { "content-type": "text/html" },
  };
  const codes = assessProductionRelease(snapshot).violations.map((item) => item.code);
  assert.ok(codes.includes("route-content-type"));
  assert.ok(codes.includes("route-shell-missing"));
  assert.ok(codes.includes("asset-empty"));
  assert.ok(codes.includes("asset-content-type"));

  const maintenance = healthySnapshot();
  maintenance.documents[0] = {
    ...maintenance.documents[0],
    text: '<!doctype html><html><body><script>"<main data-layout-shell=\\"fake\\">"</script></body></html>',
  };
  const maintenanceCodes = assessProductionRelease(maintenance).violations.map((item) => item.code);
  assert.ok(maintenanceCodes.includes("route-shell-missing"));
  assert.ok(!maintenanceCodes.includes("route-content-type"));
});

test("rejects a stale Service Worker even when its cache contract is intact", () => {
  const snapshot = healthySnapshot();
  snapshot.serviceWorkerHeaders = {
    ...snapshot.serviceWorkerHeaders,
    "x-typeloop-release": "b".repeat(40),
  };
  assert.ok(
    assessProductionRelease(snapshot).violations.some(
      (item) => item.code === "release-sha-header" && item.scope === "/sw.js",
    ),
  );
});
