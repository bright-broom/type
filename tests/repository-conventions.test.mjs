import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(".");
const requiredDocuments = [
  "AGENTS.md",
  "README.md",
  ".agents/skills/develop-typeloop/SKILL.md",
  ".agents/skills/review-typeloop/SKILL.md",
  "docs/architecture.md",
  "docs/directory-structure.md",
  "docs/quality-harness.md",
  "docs/adr/README.md",
  "src/content/generated/AGENTS.md",
];
const forbiddenDirectoryNames = new Set(["shared", "common", "utils", "helpers"]);
const authoredExtensions = new Set([".ts", ".tsx", ".mjs", ".py"]);
const authoredRoots = ["app", "src", "scripts", "tests"];
const maxAuthoredLines = 300;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return [{ path, directory: true }, ...(await walk(path))];
      return [{ path, directory: false }];
    }),
  );
  return nested.flat();
}

test("agent entry documents are present", async () => {
  await Promise.all(requiredDocuments.map((path) => access(resolve(repositoryRoot, path))));
});

test("agent instructions stay concise and the repository skill is valid", async () => {
  const agentGuide = await readFile(resolve(repositoryRoot, "AGENTS.md"), "utf8");
  assert.ok(agentGuide.split(/\r?\n/).length <= 120, "AGENTS.md must stay below 120 lines");

  const skill = await readFile(resolve(repositoryRoot, ".agents/skills/develop-typeloop/SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: develop-typeloop\ndescription: .+\n---\n/);
  assert.doesNotMatch(skill, /\bTODO\b/);

  const reviewSkill = await readFile(resolve(repositoryRoot, ".agents/skills/review-typeloop/SKILL.md"), "utf8");
  assert.match(reviewSkill, /^---\nname: review-typeloop\ndescription: .+\n---\n/);
  assert.match(reviewSkill, /Never modify the working tree/);
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

test("the manifest declares every dependency exactly once", async () => {
  // A conflicted merge once duplicated four devDependencies. JSON keeps the last
  // value silently, so the reverted version only surfaced as an install failure.
  const raw = await readFile(resolve(repositoryRoot, "package.json"), "utf8");
  for (const section of ["dependencies", "devDependencies"]) {
    const block = raw.split(`"${section}": {`)[1]?.split("\n  }")[0] ?? "";
    const names = [...block.matchAll(/"([^"]+)":\s*"/g)].map((match) => match[1]);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    assert.deepEqual(duplicates, [], `${section} declares a dependency more than once`);
  }
});

test("Playwright CI uses a version-matched image with browser dependencies", async () => {
  // Installing OS packages from an Ubuntu mirror made E2E depend on apt latency
  // and left an orphaned lock after timeout. The official image makes browsers
  // and their OS packages immutable job infrastructure instead.
  const workflow = await readFile(resolve(repositoryRoot, ".github/workflows/ci.yml"), "utf8");
  const manifest = JSON.parse(await readFile(resolve(repositoryRoot, "package.json"), "utf8"));
  const playwrightVersion = manifest.devDependencies?.["@playwright/test"];
  const e2eJob = workflow.split("  e2e:")[1]?.split("  security:")[0] ?? "";

  assert.equal(typeof playwrightVersion, "string");
  assert.match(
    e2eJob,
    new RegExp(`image: mcr\\.microsoft\\.com/playwright:v${playwrightVersion}-noble@sha256:[a-f0-9]{64}`),
    "the CI image must match the installed Playwright version and pin a digest",
  );
  assert.match(e2eJob, /options: --user 1001 --ipc=host/);
  assert.doesNotMatch(e2eJob, /playwright install(?:-deps|\s)/, "the image must own browser and OS installation");
  assert.doesNotMatch(e2eJob, /ms-playwright|browser-cache/, "browser caching is redundant with the pinned image");
});

test("the ESLint runtime stays within every ESLint plugin's supported major", async () => {
  // `npm ci` fails on this mismatch, but a red dependency PR can still be merged.
  // Naming the constraint here makes the reason visible in the failing assertion.
  const manifest = JSON.parse(await readFile(resolve(repositoryRoot, "package.json"), "utf8"));
  const devDependencies = manifest.devDependencies ?? {};
  const eslintMajor = Number.parseInt(devDependencies.eslint, 10);
  assert.equal(
    Number.parseInt(devDependencies["@eslint/js"], 10),
    eslintMajor,
    "@eslint/js must share a major with eslint",
  );

  const plugins = Object.keys(devDependencies).filter((name) => name.startsWith("eslint-plugin-"));
  assert.ok(plugins.length > 0);
  for (const plugin of plugins) {
    const manifestPath = resolve(repositoryRoot, "node_modules", plugin, "package.json");
    const peer = JSON.parse(await readFile(manifestPath, "utf8")).peerDependencies?.eslint;
    if (!peer) continue;
    const supported = [...peer.matchAll(/\^?(\d+)/g)].map((match) => Number(match[1]));
    assert.ok(
      supported.includes(eslintMajor),
      `${plugin} supports eslint ${peer}, but the project pins eslint ${eslintMajor}`,
    );
  }
});
