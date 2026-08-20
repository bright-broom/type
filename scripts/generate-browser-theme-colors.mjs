#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const registryUrl = new URL("app/styles/themes.css", ROOT);
const outputUrl = new URL("src/presentation/theme/browser-theme-colors.generated.json", ROOT);
const registry = await readFile(registryUrl, "utf8");
const basePaper = registry.match(/^:root \{[\s\S]*?--paper: (#[0-9a-f]+);/im)?.[1];
const noirPaper = registry.match(/:root\[data-theme="noir"\] \{[\s\S]*?--paper: (#[0-9a-f]+);/i)?.[1];

if (!basePaper || !noirPaper) {
  throw new Error("Could not derive browser theme colors from the theme registry.");
}

const generated = `${JSON.stringify({ dark: noirPaper, light: basePaper }, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const current = await readFile(outputUrl, "utf8").catch(() => "");
  if (current !== generated) {
    console.error("Browser theme colors are stale. Run node scripts/generate-browser-theme-colors.mjs.");
    process.exit(1);
  }
} else {
  await writeFile(outputUrl, generated);
}
