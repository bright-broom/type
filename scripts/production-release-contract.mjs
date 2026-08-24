import { publicContentViolations } from "./public-content-policy.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
export const EXPECTED_PRODUCTION_CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");
export const EXPECTED_PRODUCTION_HEADERS = {
  "content-security-policy": EXPECTED_PRODUCTION_CSP,
  "referrer-policy": "no-referrer",
  "permissions-policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "strict-transport-security": "max-age=63072000",
};

function violation(code, scope) {
  return { code, scope };
}

function headerValue(headers, name) {
  if (typeof headers?.get === "function") return headers.get(name) ?? "";
  const entry = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return typeof entry?.[1] === "string" ? entry[1] : "";
}

function normalizedPolicy(value) {
  return value
    .split(";")
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("; ");
}

function contentPolicyPath(document) {
  if (document.kind === "asset") return `public${document.path}`;
  return document.path === "/" ? "app/page.html" : `app${document.path}/page.html`;
}

function sameStringArray(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function routeHeaderViolations(headers, scope, expectedSha) {
  const violations = [];
  for (const [name, value] of Object.entries(EXPECTED_PRODUCTION_HEADERS)) {
    const actual = headerValue(headers, name);
    const matches =
      name === "content-security-policy" ? normalizedPolicy(actual) === normalizedPolicy(value) : actual === value;
    if (!matches) violations.push(violation(`header-${name}`, scope));
  }
  if (headerValue(headers, "x-powered-by") !== "") {
    violations.push(violation("header-x-powered-by", scope));
  }
  if (headerValue(headers, "x-typeloop-release") !== expectedSha) {
    violations.push(violation("release-sha-header", scope));
  }
  return violations;
}

function documentShapeViolations(document) {
  if (document.status !== 200 || document.redirected) return [];
  const contentType = headerValue(document.headers, "content-type").toLowerCase();
  if (document.kind === "route") {
    const html = document.text ?? "";
    const structuralHtml = html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
    const hasShell =
      /<!doctype html>/i.test(structuralHtml) &&
      /<html(?:\s|>)/i.test(structuralHtml) &&
      /<body(?:\s|>)/i.test(structuralHtml) &&
      /<main\b[^>]*\bdata-layout-shell=(?:"[^"]+"|'[^']+')[^>]*>/i.test(structuralHtml);
    return [
      ...(!contentType.startsWith("text/html") ? [violation("route-content-type", document.path)] : []),
      ...(!hasShell ? [violation("route-shell-missing", document.path)] : []),
    ];
  }
  const expectedType = document.expectedContentType;
  return [
    ...(document.bodyBytes < 1 ? [violation("asset-empty", document.path)] : []),
    ...(expectedType && !contentType.includes(expectedType) ? [violation("asset-content-type", document.path)] : []),
  ];
}

export function assertProductionOrigin(rawOrigin) {
  const origin = new URL(rawOrigin);
  if (
    origin.protocol !== "https:" ||
    origin.username !== "" ||
    origin.password !== "" ||
    origin.port !== "" ||
    origin.pathname !== "/" ||
    origin.search !== "" ||
    origin.hash !== ""
  ) {
    throw new TypeError("Production URL must be a canonical HTTPS origin");
  }
  return origin;
}

export function assessProductionRelease(snapshot) {
  if (!SHA_PATTERN.test(snapshot.expectedSha ?? "")) throw new TypeError("expectedSha must be a full commit SHA");
  const violations = [];
  if (snapshot.deployment?.sha !== snapshot.expectedSha) {
    violations.push(violation("deployment-sha-mismatch", "deployment"));
  }
  if (snapshot.deployment?.state !== "success") {
    violations.push(violation("deployment-not-successful", "deployment"));
  }
  if (!sameStringArray(snapshot.expectedRoutes, snapshot.remoteRoutes)) {
    violations.push(violation("route-inventory-mismatch", "application-routes"));
  }

  for (const document of snapshot.documents ?? []) {
    if (document.redirected) violations.push(violation("document-redirected", document.path));
    if (document.status !== 200) violations.push(violation("document-request-failed", document.path));
    violations.push(...documentShapeViolations(document));
    if (document.kind === "route") {
      violations.push(...routeHeaderViolations(document.headers, document.path, snapshot.expectedSha));
    }
    if (publicContentViolations(contentPolicyPath(document), document.text ?? "").length > 0) {
      violations.push(violation("restricted-content", document.path));
    }
  }

  if (snapshot.retiredRoute?.redirected || snapshot.retiredRoute?.status !== 404) {
    violations.push(violation("retired-route-reachable", "/ais"));
  }
  if (snapshot.retiredRoute) {
    violations.push(...routeHeaderViolations(snapshot.retiredRoute.headers, "/ais", snapshot.expectedSha));
    if (publicContentViolations("app/retired-not-found/page.html", snapshot.retiredRoute.text ?? "").length > 0) {
      violations.push(violation("restricted-content", "/ais"));
    }
  }
  const serviceWorkerCache = headerValue(snapshot.serviceWorkerHeaders, "cache-control")
    .split(",")
    .map((directive) => directive.trim().toLowerCase());
  if (!["no-cache", "no-store", "must-revalidate"].every((directive) => serviceWorkerCache.includes(directive))) {
    violations.push(violation("service-worker-cache", "/sw.js"));
  }
  if (headerValue(snapshot.serviceWorkerHeaders, "x-typeloop-release") !== snapshot.expectedSha) {
    violations.push(violation("release-sha-header", "/sw.js"));
  }

  const documents = snapshot.documents ?? [];
  return {
    healthy: violations.length === 0,
    violations,
    stats: {
      routes: documents.filter((document) => document.kind === "route").length,
      assets: documents.filter((document) => document.kind === "asset").length,
      documents: documents.length,
    },
  };
}

export function formatProductionReleaseReport(assessment, { expectedSha, origin }) {
  const lines = [
    `# Production release verification ${assessment.healthy ? "passed" : "failed"}`,
    "",
    `- Expected commit: \`${expectedSha}\``,
    `- Production origin: ${origin}`,
    `- Checked routes: ${assessment.stats.routes}`,
    `- Checked assets: ${assessment.stats.assets}`,
    "",
  ];
  if (assessment.healthy) {
    lines.push("The latest successful Production deployment and canonical public surface are healthy.", "");
  } else {
    lines.push("## Violations", "");
    for (const item of assessment.violations) lines.push(`- \`${item.code}\` — \`${item.scope}\``);
    lines.push("");
  }
  lines.push("Response bodies and matched confidential values are intentionally omitted.", "");
  return lines.join("\n");
}
