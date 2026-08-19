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

test("Playwright system dependencies are installed outside retry loops", async () => {
  // Retrying `install --with-deps` can overlap an orphaned apt process after a
  // timeout. Keep the privileged package install single-shot and retry only the
  // browser download, which does not hold the system package-manager lock.
  const workflow = await readFile(resolve(repositoryRoot, ".github/workflows/ci.yml"), "utf8");
  const systemDependencyCommands = workflow.match(/npx playwright install-deps/g) ?? [];
  const systemDependencies = workflow.indexOf("npx playwright install-deps chromium webkit");
  const retryLoop = workflow.indexOf("for attempt in 1 2 3; do");
  const retryLoopEnd = workflow.indexOf("done", retryLoop);
  const browserInstallStep = workflow
    .split("- name: Install browsers")[1]
    ?.split("- name: Build production application")[0];

  assert.equal(systemDependencyCommands.length, 1, "CI must run install-deps exactly once");
  assert.doesNotMatch(workflow, /--with-deps/, "CI must not couple apt installation to a retried browser install");
  assert.ok(systemDependencies >= 0, "CI must install the Playwright system dependencies");
  assert.ok(retryLoop > systemDependencies, "the browser retry loop must start after install-deps");
  assert.ok(retryLoopEnd > retryLoop, "the browser retry loop must have an explicit end");
  assert.ok(browserInstallStep, "CI must keep a dedicated browser installation step");
  assert.doesNotMatch(browserInstallStep, /install-deps|--with-deps/);

  const retriedCommands = workflow.slice(retryLoop, retryLoopEnd);
  assert.match(retriedCommands, /npx playwright install chromium webkit/);
  assert.doesNotMatch(retriedCommands, /install-deps|--with-deps/);
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
