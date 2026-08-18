#!/usr/bin/env node
/**
 * Hold the shipped JavaScript to a budget.
 *
 * The product promise is a 60-second session that starts immediately, so the size
 * of the first-load bundle is a feature, not an implementation detail. Sizes are
 * read from the build manifest rather than by globbing chunks, so lazily loaded
 * dictionaries are not counted against the first paint and content-hashed
 * filenames do not matter.
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
