import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(".");
const requiredDocuments = [
  "AGENTS.md",
  "README.md",
  ".agents/skills/develop-typeloop/SKILL.md",
  "docs/architecture.md",
  "docs/directory-structure.md",
  "docs/adr/README.md",
  "src/content/generated/AGENTS.md",
];
const forbiddenDirectoryNames = new Set(["shared", "common", "utils", "helpers"]);
const authoredExtensions = new Set([".ts", ".tsx", ".mjs", ".py"]);
const authoredRoots = ["app", "src", "scripts", "tests"];
const maxAuthoredLines = 300;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return [{ path, directory: true }, ...await walk(path)];
    return [{ path, directory: false }];
  }));
  return nested.flat();
}

test("agent entry documents are present", async () => {
  await Promise.all(requiredDocuments.map((path) => access(resolve(repositoryRoot, path))));
});

test("agent instructions stay concise and the repository skill is valid", async () => {
  const agentGuide = await readFile(resolve(repositoryRoot, "AGENTS.md"), "utf8");
  assert.ok(agentGuide.split(/\r?\n/).length <= 120, "AGENTS.md must stay below 120 lines");

  const skill = await readFile(
    resolve(repositoryRoot, ".agents/skills/develop-typeloop/SKILL.md"),
    "utf8",
  );
  assert.match(skill, /^---\nname: develop-typeloop\ndescription: .+\n---\n/);
  assert.doesNotMatch(skill, /\bTODO\b/);
});

test("source directories use responsibility-specific names", async () => {
  const entries = await walk(resolve(repositoryRoot, "src"));
  const violations = entries
    .filter((entry) => entry.directory && forbiddenDirectoryNames.has(entry.path.split(sep).at(-1)))
    .map((entry) => relative(repositoryRoot, entry.path));
  assert.deepEqual(violations, []);
});

test("authored code stays below the reviewability ceiling", async () => {
  const violations = [];
  for (const root of authoredRoots) {
    for (const entry of await walk(resolve(repositoryRoot, root))) {
      if (entry.directory || !authoredExtensions.has(extname(entry.path))) continue;
      if (entry.path.includes(`${sep}src${sep}content${sep}generated${sep}`)) continue;
      const lines = (await readFile(entry.path, "utf8")).split(/\r?\n/).length;
      if (lines > maxAuthoredLines) violations.push(`${relative(repositoryRoot, entry.path)}: ${lines} lines`);
    }
  }
  assert.deepEqual(violations, []);
});
