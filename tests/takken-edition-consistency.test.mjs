import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editionConsumers = [
  "app/takken/page.tsx",
  "app/takken/layout.tsx",
  "src/presentation/components/takken/TakkenGlossary.tsx",
  "src/presentation/components/takken-assessment/AssessmentLauncher.tsx",
  "src/content/takken/takken-assessment-pack.ts",
  "scripts/monitor-takken-sources.mjs",
];

test("edition consumers derive year and legal dates from the edition manifest", async () => {
  for (const path of editionConsumers) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /2026|令和[８8]|2026-04-01/, `${path} contains an edition literal`);
  }
});
