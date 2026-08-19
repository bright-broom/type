#!/usr/bin/env node
/**
 * Enforce that design colors exist in exactly one place.
 *
 * The stylesheet once carried two competing `:root` blocks, eighteen stray hex
 * values, and rgb() literals still spelling out a palette that had already been
 * replaced — four accidental near-duplicates of the same gray among them. Retuning
 * the app's tone meant grepping ~3000 lines. This check keeps the seam closed:
 *
 * - `app/styles/themes.css`: raw color values are allowed only inside the
 *   `@tokens-begin` … `@tokens-end` registry. All other CSS uses tokens.
 * - `src/` and `app/` TypeScript/TSX: no color literals at all. Computed style
 *   values (widths, transforms) are fine; colors come from the stylesheet.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const THEME_REGISTRY = "app/styles/themes.css";
const MODERN_STYLES = "app/styles/modern.css";
const CSS_ROOT = "app";
const CODE_ROOTS = ["src", "app"];

const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/;
const NUMERIC_COLOR_FN = /\b(?:rgb|hsl)a?\(\s*[\d.]/;
const COLOR_KEYWORD =
  /(?:^|[\s:])(?:color|background(?:-color)?|border(?:-\w+)?-color|fill|stroke)\s*:\s*(?:white|black)\b/;
const RAW_DESIGN_DIMENSION =
  /(?<![\w-])-?\d*\.?\d+(?:px|rem|em|ms|s|%|fr|deg|ch|ex|cap|ic|lh|rlh|vw|vh|vi|vb|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|cqw|cqh|cqi|cqb|cqmin|cqmax)\b/;

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const violations = [];

function scan(file, text, startLine = 1) {
  text.split(/\r?\n/).forEach((line, index) => {
    if (HEX_COLOR.test(line) || NUMERIC_COLOR_FN.test(line) || COLOR_KEYWORD.test(line)) {
      violations.push(`${file}:${startLine + index}: ${line.trim().slice(0, 80)}`);
    }
  });
}

// 1. The stylesheet, outside the token block.
const css = readFileSync(THEME_REGISTRY, "utf8");
const marker = css.match(/\/\* @tokens-begin[\s\S]*?@tokens-end \*\//);
if (!marker) {
  console.error(`${THEME_REGISTRY} has no @tokens-begin/@tokens-end block; the token seam is gone.`);
  process.exit(1);
}
const before = css.slice(0, marker.index ?? 0);
const after = css.slice((marker.index ?? 0) + marker[0].length);
scan(THEME_REGISTRY, before);
scan(THEME_REGISTRY, after, css.slice(0, (marker.index ?? 0) + marker[0].length).split(/\r?\n/).length);

// A second :root redefining tokens is how the palette forked last time.
const rootBlocks = css.match(/^:root\s*\{/gm) ?? [];
if (rootBlocks.length > 1) {
  violations.push(`${THEME_REGISTRY}: ${rootBlocks.length} unscoped :root blocks — the base token contract forked`);
}

// 2. Other authored CSS must consume the theme contract rather than define colors.
for (const file of walk(CSS_ROOT)) {
  if (!file.endsWith(".css") || file === THEME_REGISTRY) continue;
  scan(file, readFileSync(file, "utf8"));
}

// The new modern layer is the migration target for all screen styling. Unlike
// the historical global stylesheet, it must not acquire raw geometry or timing
// decisions: those belong in the registry so settings can retune them globally.
const modernCss = readFileSync(MODERN_STYLES, "utf8");
modernCss.split(/\r?\n/).forEach((line, index) => {
  if (RAW_DESIGN_DIMENSION.test(line)) {
    violations.push(`${MODERN_STYLES}:${index + 1}: raw design dimension: ${line.trim().slice(0, 80)}`);
  }
});

// 3. Authored TypeScript/TSX. Colors belong to the stylesheet, not to markup.
for (const root of CODE_ROOTS) {
  for (const file of walk(root)) {
    if (!/\.(?:ts|tsx)$/.test(file) || /\.(?:test|spec)\./.test(file)) continue;
    if (file.includes(`${join("src", "content", "generated")}`)) continue;
    scan(file, readFileSync(file, "utf8"));
  }
}

if (violations.length > 0) {
  console.error("Design literals outside the theme registry:\n");
  for (const violation of violations) console.error(`  ${violation}`);
  console.error(
    [
      "",
      "Add or reuse a token between @tokens-begin/@tokens-end in app/styles/themes.css",
      "and reference it with var(--token). Modern geometry and timing decisions",
      "also belong there. Translucent colors use the channel",
      "triplets: rgb(var(--ink-rgb) / 8%).",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("Design colors and modern layout values are defined only inside the theme registry.");
