import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { ESLint } from "eslint";

const repositoryRoot = resolve(".");

test("ESLint enforces the runtime network boundary with AST rules", async () => {
  const eslint = new ESLint({ cwd: repositoryRoot });
  const [forbidden] = await eslint.lintText(
    `import * as https from "node:https";
     export function leak() {
       fetch("/");
       new XMLHttpRequest();
       navigator.sendBeacon("/", "x");
       globalThis["fe" + "tch"]("/");
       https.get("https://example.com");
     }`,
    { filePath: "src/security-boundary-fixture.ts" },
  );
  const boundaryViolations = forbidden.messages.filter(
    ({ ruleId }) =>
      ruleId === "no-restricted-globals" || ruleId === "no-restricted-imports" || ruleId === "no-restricted-syntax",
  );
  assert.equal(boundaryViolations.length, 5);

  const [safe] = await eslint.lintText("export const localValue = JSON.stringify({ ok: true });", {
    filePath: "src/security-boundary-fixture.ts",
  });
  assert.deepEqual(safe.messages, []);
});

test("repository policy keeps environment files and credentials out of Git", async () => {
  const [gitignore, packageJson] = await Promise.all([
    readFile(resolve(repositoryRoot, ".gitignore"), "utf8"),
    readFile(resolve(repositoryRoot, "package.json"), "utf8").then(JSON.parse),
  ]);

  assert.match(gitignore, /^\.env\*$/m);
  assert.equal(packageJson.scripts["check:secrets"], "node scripts/check-secrets.mjs");
  assert.equal(packageJson.scripts["audit:dependencies"], "npm audit --audit-level=high");
});
