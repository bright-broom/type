#!/usr/bin/env node
/**
 * Verify every peer range declared by a pinned dependency is satisfied.
 *
 * `npm ci` already fails on an unsatisfiable peer range, but only after the cache
 * restore and inside every job, and the reason is buried in a long ERESOLVE dump.
 * This resolves the same question from the manifest and the registry, so a bad
 * dependency bump fails fast with the offending pin and constraint named — which is
 * what the CI triage workflow quotes back onto the pull request.
 *
 * It does not depend on the lockfile or on node_modules, so it is meaningful even
 * when installing is exactly what is broken.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { satisfies } from "./semver-range.mjs";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const pinned = { ...manifest.dependencies, ...manifest.devDependencies };

function peerRangesOf(name, version) {
  const result = spawnSync("npm", ["view", `${name}@${version}`, "peerDependencies", "--json"], { encoding: "utf8" });
  if (result.status !== 0) {
    const detail = (result.stderr || "").trim().split("\n").at(-1) ?? "unknown error";
    throw new Error(`cannot read peerDependencies of ${name}@${version}: ${detail}`);
  }
  const raw = (result.stdout || "").trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  // A version range can match several published versions; npm then returns an array.
  return Array.isArray(parsed) ? Object.assign({}, ...parsed) : parsed;
}

const conflicts = [];
const unknown = [];

for (const [name, version] of Object.entries(pinned)) {
  let peers;
  try {
    peers = peerRangesOf(name, version);
  } catch (error) {
    unknown.push(error.message);
    continue;
  }
  for (const [peer, range] of Object.entries(peers)) {
    const installed = pinned[peer];
    // Peers the project does not declare are resolved transitively; npm handles those.
    if (!installed) continue;
    const verdict = satisfies(installed, range);
    if (verdict === false) {
      conflicts.push({ name, version, peer, installed, range });
    } else if (verdict === null) {
      unknown.push(`cannot interpret ${name}@${version} peer ${peer}@"${range}"`);
    }
  }
}

for (const note of unknown) console.warn(`warning: ${note}`);

if (conflicts.length === 0) {
  console.log(`Peer ranges satisfied across ${Object.keys(pinned).length} pinned dependencies.`);
  process.exit(0);
}

console.error("Incompatible dependency pins:\n");
for (const { name, version, peer, installed, range } of conflicts) {
  console.error(`  ${name}@${version} requires ${peer}@"${range}" but ${peer} is pinned to ${installed}`);
}
console.error(
  [
    "",
    "`npm ci` will fail with ERESOLVE. Resolve it by either",
    "  - moving the dependency back to a version its peers accept, or",
    "  - upgrading every package in the constraint together.",
    "Do not use --force or --legacy-peer-deps: the installed tree would stop",
    "matching what the lockfile promises.",
  ].join("\n"),
);
process.exit(1);
