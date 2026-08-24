#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import routes from "../public/application-routes.json" with { type: "json" };
import {
  assertProductionOrigin,
  assessProductionRelease,
  formatProductionReleaseReport,
} from "./production-release-contract.mjs";
import {
  fetchProductionDocument,
  PRODUCTION_FETCH_TIMEOUT_MS,
  referencedAssetPaths,
  referencedChunkPaths,
  serviceWorkerShellAssetPaths,
} from "./production-release-fetch.mjs";
const DEFAULT_ATTEMPTS = 20;
const DEFAULT_INTERVAL_MS = 15_000;
const DEFAULT_TOTAL_TIMEOUT_MS = 6 * 60_000;
const MAX_REFERENCED_ASSETS = 200;
const ASSET_BATCH_SIZE = 20;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
}
function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new TypeError(`${name} must be a positive integer`);
  return parsed;
}

function githubApi(path) {
  return JSON.parse(
    execFileSync("gh", ["api", path], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: PRODUCTION_FETCH_TIMEOUT_MS,
      env: process.env,
    }),
  );
}

export function latestProductionDeployment(repository) {
  if (!REPOSITORY_PATTERN.test(repository)) throw new TypeError("repository must be an owner/name pair");
  const deployment = githubApi(`repos/${repository}/deployments?environment=Production&per_page=1`)[0];
  if (!Number.isSafeInteger(deployment?.id) || typeof deployment?.sha !== "string") {
    return { sha: null, state: "missing" };
  }
  const state =
    githubApi(`repos/${repository}/deployments/${deployment.id}/statuses?per_page=1`)[0]?.state ?? "missing";
  return { sha: deployment.sha, state };
}

export async function verifyProductionReleaseOnce({
  repository,
  origin: rawOrigin,
  expectedSha,
  expectedRoutes = routes,
  fetchImpl = fetch,
  deploymentProvider = latestProductionDeployment,
  overallSignal,
}) {
  const origin = assertProductionOrigin(rawOrigin);
  const deployment = await deploymentProvider(repository);
  const inventory = await fetchProductionDocument(origin, "/application-routes.json", fetchImpl, overallSignal);
  const serviceWorker = await fetchProductionDocument(origin, "/sw.js", fetchImpl, overallSignal);
  let remoteRoutes = [];
  if (inventory.status === 200 && !inventory.redirected) {
    const parsed = JSON.parse(inventory.text);
    if (Array.isArray(parsed) && parsed.every((route) => typeof route === "string")) remoteRoutes = parsed;
  }

  const routeDocuments = await Promise.all(
    expectedRoutes.map(async (path) => ({
      kind: "route",
      path,
      ...(await fetchProductionDocument(origin, path, fetchImpl, overallSignal)),
    })),
  );
  const assetPaths = new Set([
    "/application-routes.json",
    "/sw.js",
    ...serviceWorkerShellAssetPaths(serviceWorker.text),
  ]);
  for (const document of routeDocuments) {
    if (document.status === 200 && !document.redirected) {
      for (const assetPath of referencedAssetPaths(document.text, origin)) assetPaths.add(assetPath);
    }
  }
  if (assetPaths.size > MAX_REFERENCED_ASSETS) throw new Error("Production asset inventory exceeds the limit");
  const retiredRoute = await fetchProductionDocument(origin, "/ais", fetchImpl, overallSignal);
  const assetDocuments = [];
  const pending = [...assetPaths].sort();
  for (let index = 0; index < pending.length;) {
    const batch = pending.slice(index, index + ASSET_BATCH_SIZE);
    index += batch.length;
    const documents = await Promise.all(
      batch.map(async (path) => ({
        kind: "asset",
        path,
        ...(path === "/application-routes.json"
          ? inventory
          : path === "/sw.js"
            ? serviceWorker
            : await fetchProductionDocument(origin, path, fetchImpl, overallSignal)),
      })),
    );
    assetDocuments.push(...documents);
    for (const document of documents) {
      if (!/\.(?:js|css)(?:\?|$)/.test(document.path)) continue;
      for (const dependency of referencedChunkPaths(document.text)) {
        if (assetPaths.has(dependency)) continue;
        assetPaths.add(dependency);
        pending.push(dependency);
      }
    }
    if (assetPaths.size > MAX_REFERENCED_ASSETS) throw new Error("Production asset inventory exceeds the limit");
  }
  const serviceWorkerDocument = assetDocuments.find((document) => document.path === "/sw.js");
  return assessProductionRelease({
    expectedSha,
    deployment,
    expectedRoutes,
    remoteRoutes,
    documents: [...routeDocuments, ...assetDocuments],
    retiredRoute,
    serviceWorkerHeaders: serviceWorkerDocument?.headers,
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function verifyProductionRelease(options) {
  let lastAssessment;
  let lastError;
  const deadline = options.nowImpl() + options.totalTimeoutMs;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      const remaining = deadline - options.nowImpl();
      if (remaining < 1) break;
      lastAssessment = await options.verifyOnceImpl({
        ...options,
        overallSignal: AbortSignal.timeout(remaining),
      });
      lastError = undefined;
      if (lastAssessment.healthy) return lastAssessment;
    } catch (error) {
      lastError = error;
    }
    const remaining = deadline - options.nowImpl();
    if (attempt < options.attempts && remaining > 0) {
      await options.waitImpl(Math.min(options.intervalMs, remaining));
    }
  }
  if (lastAssessment) return lastAssessment;
  throw lastError ?? new Error("Production verification did not complete");
}

async function main() {
  const repository = option("--repository", process.env.GITHUB_REPOSITORY);
  const origin = option("--origin");
  const expectedSha = option("--expected-sha");
  const output = option("--output", "production-release.md");
  const attempts = positiveInteger(option("--attempts", DEFAULT_ATTEMPTS), "attempts");
  const intervalMs = positiveInteger(option("--interval-ms", DEFAULT_INTERVAL_MS), "interval-ms");
  const totalTimeoutMs = positiveInteger(option("--timeout-ms", DEFAULT_TOTAL_TIMEOUT_MS), "timeout-ms");
  if (!repository || !origin || !expectedSha || !output) {
    throw new TypeError("Usage: verify-production-release --repository owner/name --origin URL --expected-sha SHA");
  }
  const assessment = await verifyProductionRelease({
    repository,
    origin,
    expectedSha,
    attempts,
    intervalMs,
    totalTimeoutMs,
    waitImpl: wait,
    nowImpl: Date.now,
    verifyOnceImpl: verifyProductionReleaseOnce,
  });
  const report = formatProductionReleaseReport(assessment, { expectedSha, origin });
  await writeFile(output, report, "utf8");
  process.stdout.write(report);
  if (!assessment.healthy) process.exitCode = 2;
}

if (import.meta.filename === process.argv[1]) {
  main().catch(async () => {
    const output = option("--output", "production-release.md");
    const report = [
      "# Production release verification failed",
      "",
      "- `verification-operational-error` — `production-verifier`",
      "",
      "Response bodies and matched confidential values are intentionally omitted.",
      "",
    ].join("\n");
    await writeFile(output, report, "utf8").catch(() => undefined);
    console.error("Production release verification could not complete.");
    process.exit(1);
  });
}
