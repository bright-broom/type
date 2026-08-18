import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import test from "node:test";

const sourceRoot = resolve("src");
const allowedDependencies = {
  domain: new Set(["domain"]),
  application: new Set(["application", "domain"]),
  infrastructure: new Set(["infrastructure", "application", "domain"]),
  content: new Set(["content", "domain"]),
  presentation: new Set(["presentation", "application", "domain", "infrastructure", "content"]),
};

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
    }),
  );
  return nested.flat();
}

function layerOf(path) {
  return relative(sourceRoot, path).split(sep)[0];
}

/**
 * Dataset directory under `src/content` that owns a file, or null when the path is
 * outside content. `generated` is an artifact store with its own lifecycle, not a
 * dataset, so every dataset may read its own artifact from it.
 */
const ARTIFACT_DIRECTORY = "generated";

function datasetOf(path) {
  const segments = relative(sourceRoot, path).split(sep);
  if (segments[0] !== "content" || segments.length < 3) return null;
  return segments[1] === ARTIFACT_DIRECTORY ? null : segments[1];
}

function importedLayer(file, specifier) {
  if (specifier.startsWith(".")) return layerOf(resolve(dirname(file), specifier));
  if (specifier.startsWith("@/src/")) return specifier.split("/")[2];
  return null;
}

test("source layers only import from allowed inward dependencies", async () => {
  const violations = [];
  for (const file of await sourceFiles(sourceRoot)) {
    const sourceLayer = layerOf(file);
    const allowed = allowedDependencies[sourceLayer];
    assert.ok(allowed, `Unregistered source layer: ${sourceLayer}`);
    const source = await readFile(file, "utf8");
    const imports = source.matchAll(/(?:from\s+|import\s*\()\s*["']([^"']+)["']/g);
    for (const match of imports) {
      const specifier = match[1];
      const targetLayer = importedLayer(file, specifier);
      if (!targetLayer) continue;
      if (!allowed.has(targetLayer)) {
        violations.push(`${relative(sourceRoot, file)} -> ${targetLayer} (${specifier})`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("each content dataset stays self-contained", async () => {
  // Datasets must not know about each other: `training-set-catalog.ts` is the single
  // seam that binds identifiers to datasets, so cross-dataset imports would smuggle
  // coupling in and make a dataset impossible to add or drop on its own.
  const catalogue = resolve(sourceRoot, "content/training-set-catalog.ts");
  const violations = [];
  for (const file of await sourceFiles(resolve(sourceRoot, "content"))) {
    if (file === catalogue) continue;
    const owner = datasetOf(file);
    if (!owner) continue;
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/(?:from\s+|import\s*\()\s*["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) continue;
      const target = datasetOf(resolve(dirname(file), specifier));
      if (target && target !== owner) {
        violations.push(`${relative(sourceRoot, file)} -> content/${target} (${specifier})`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("the training set catalogue is the only cross-dataset module in content", async () => {
  const catalogue = await readFile(resolve(sourceRoot, "content/training-set-catalog.ts"), "utf8");
  const datasets = new Set();
  for (const match of catalogue.matchAll(/from\s+["']\.\/([^/"']+)\//g)) datasets.add(match[1]);
  assert.ok(datasets.size > 1, "the catalogue is expected to bind several datasets");
});

test("browser-facing hooks stay in the hooks directory", async () => {
  // Nothing outside `presentation/hooks` may declare a React hook, so the composition
  // surface stays discoverable as the app grows.
  const violations = [];
  for (const file of await sourceFiles(resolve(sourceRoot, "presentation"))) {
    const segments = relative(sourceRoot, file).split(sep);
    if (segments[1] === "hooks") continue;
    const source = await readFile(file, "utf8");
    if (/\bexport function use[A-Z]/.test(source)) violations.push(relative(sourceRoot, file));
  }
  assert.deepEqual(violations, []);
});
