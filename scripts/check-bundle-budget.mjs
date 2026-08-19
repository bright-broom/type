#!/usr/bin/env node
/**
 * Hold the shipped JavaScript to a budget.
 *
 * The product promise is a 60-second session that starts immediately, so the size
 * of the first-load bundle is a feature, not an implementation detail. Sizes are
 * read from build manifests rather than by globbing chunks, so lazily loaded
 * dictionaries are not counted against first paint, substantial routes have
 * explicit ceilings, and content-hashed filenames do not matter.
 *
 * Budgets are uncompressed bytes, set just above the measured size at the time of
 * writing. Raising one is a deliberate decision that belongs in a pull request.
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BUILD_DIR = ".next";
const BUDGETS = {
  firstLoad: 480 * 1024,
  referenced: 640 * 1024,
};
const APP_ROUTE_BUDGETS = {
  "/takken": 80 * 1024,
  "/takken/practice": 300 * 1024,
  "/takken/mock": 300 * 1024,
  "/takken/history": 300 * 1024,
  "/takken/glossary": 300 * 1024,
};

function sizeOf(file) {
  try {
    return statSync(join(BUILD_DIR, file)).size;
  } catch {
    return 0;
  }
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(BUILD_DIR, "build-manifest.json"), "utf8"));
} catch {
  console.error(`No build manifest in ${BUILD_DIR}. Run \`npm run build\` first.`);
  process.exit(1);
}

const firstLoadFiles = manifest.rootMainFiles ?? [];
if (firstLoadFiles.length === 0) {
  console.error("The build manifest lists no root files; the budget cannot be checked.");
  process.exit(1);
}

const firstLoad = firstLoadFiles.reduce((total, file) => total + sizeOf(file), 0);
// Files the manifest references for a navigation. Lazily imported dictionary
// chunks are deliberately absent: they load only when a player opens a glossary.
const referencedFiles = new Set([
  ...firstLoadFiles,
  ...Object.values(manifest.pages ?? {}).flat(),
  ...(manifest.polyfillFiles ?? []),
  ...(manifest.lowPriorityFiles ?? []),
]);
const referenced = [...referencedFiles].reduce((sum, file) => sum + sizeOf(file), 0);

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
const rows = [
  ["first load", firstLoad, BUDGETS.firstLoad],
  ["referenced", referenced, BUDGETS.referenced],
];

function appRouteSize(route) {
  const manifestPath = join(
    BUILD_DIR,
    "server",
    "app",
    ...route.slice(1).split("/"),
    "page_client-reference-manifest.js",
  );
  const source = readFileSync(manifestPath, "utf8");
  const marker = `["${route}/page"] = `;
  const assignment = source.indexOf(marker);
  if (assignment < 0) throw new Error(`Cannot parse ${manifestPath}`);
  const routeManifest = JSON.parse(
    source
      .slice(assignment + marker.length)
      .trim()
      .replace(/;$/, ""),
  );
  const entry = Object.entries(routeManifest.entryJSFiles).find(([key]) => key.endsWith(`/app${route}/page`));
  if (!entry) throw new Error(`No client entry for ${route}`);
  return [...new Set(entry[1])].reduce((total, file) => total + sizeOf(file), 0);
}

for (const [route, budget] of Object.entries(APP_ROUTE_BUDGETS)) {
  rows.push([route, appRouteSize(route), budget]);
}

let failed = false;
for (const [label, actual, budget] of rows) {
  const share = Math.round((actual / budget) * 100);
  const verdict = actual > budget ? "OVER BUDGET" : "ok";
  if (actual > budget) failed = true;
  console.log(`${label.padEnd(17)} ${kb(actual).padStart(8)} / ${kb(budget).padStart(8)}  (${share}%)  ${verdict}`);
}

if (failed) {
  console.error(
    [
      "",
      "Shipped JavaScript exceeded its budget. Either reduce it, or raise the",
      "budget in scripts/check-bundle-budget.mjs with the reason in the pull request.",
    ].join("\n"),
  );
  process.exit(1);
}
