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
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

function layerOf(path) {
  return relative(sourceRoot, path).split(sep)[0];
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
      if (!specifier.startsWith(".")) continue;
      const targetLayer = layerOf(resolve(dirname(file), specifier));
      if (!allowed.has(targetLayer)) {
        violations.push(`${relative(sourceRoot, file)} -> ${targetLayer} (${specifier})`);
      }
    }
  }
  assert.deepEqual(violations, []);
});
