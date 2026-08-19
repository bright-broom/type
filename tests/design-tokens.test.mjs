import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Contract tests for the design-token registry in app/styles/themes.css.
 *
 * The axe E2E suite measures rendered pages, but only after a build and only for
 * the states the tests visit. These assertions run in milliseconds against the
 * tokens themselves, so a retune that breaks a core reading pair fails before a
 * browser ever starts. They are the reason a tone change is safe to make quickly.
 */

const css = await readFile(new URL("../app/styles/themes.css", import.meta.url), "utf8");
const block = css.match(/\/\* @tokens-begin[\s\S]*?@tokens-end \*\//)?.[0];

function token(name) {
  const match = block?.match(new RegExp(`--${name}:\\s*([^;]+);`));
  assert.ok(match, `token --${name} is missing from the token block`);
  return match[1].trim();
}

function themeToken(theme, name) {
  const declarations = block?.match(new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]+)\\}`))?.[1];
  return declarations?.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim() ?? token(name);
}

function luminance(hex) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(value.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const [high, low] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

test("the token registry has one unscoped root contract", () => {
  assert.ok(block, "@tokens-begin/@tokens-end block is missing");
  assert.equal((css.match(/^:root\s*\{/gm) ?? []).length, 1, "a second :root would silently fork the palette");
});

// Pairs a tone retune must never break: body text, primary controls, and the
// badges whose contrast already failed AA once (#f36f56 carried white at 2.9:1).
const AA_PAIRS = [
  ["ink", "paper"],
  ["ink-deep", "paper-soft"],
  ["muted", "paper"],
  ["muted", "paper-soft"],
  ["text-prose", "paper-soft"],
  ["text-lede", "paper"],
  ["white", "ink-deep"],
  ["text-on-dark", "ink-deep"],
  ["text-on-dark-muted", "ink-deep"],
  ["ink-deep", "cyan"],
  ["ink-deep", "coral"],
];

for (const [foreground, background] of AA_PAIRS) {
  test(`--${foreground} on --${background} meets WCAG AA (4.5:1)`, () => {
    const ratio = contrast(token(foreground), token(background));
    assert.ok(ratio >= 4.5, `contrast is ${ratio.toFixed(2)}:1`);
  });
}

for (const [foreground, background] of AA_PAIRS) {
  test(`classic --${foreground} on --${background} meets WCAG AA`, () => {
    const ratio = contrast(themeToken("classic", foreground), themeToken("classic", background));
    assert.ok(ratio >= 4.5, `contrast is ${ratio.toFixed(2)}:1`);
  });
}

test("every --*-rgb triplet matches its hex base in each theme block", () => {
  // Translucent colors are built from these; a mismatch forks the palette invisibly.
  for (const [, selector, declarations] of block.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    for (const [, name, triplet] of declarations.matchAll(/--([a-z-]+)-rgb:\s*(\d+ \d+ \d+);/g)) {
      if (name === "black") continue;
      const localHex = declarations.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`))?.[1];
      const hex = localHex ?? token(name);
      const fromHex = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");
      assert.equal(triplet, fromHex, `${selector.trim()} --${name}-rgb drifted from ${hex}`);
    }
  }
});

test("no two color tokens hold the same value", () => {
  // An exact duplicate means someone added a token instead of reusing one; the
  // two will then drift apart, which is how four near-identical grays appeared.
  const seen = new Map();
  for (const [, name, value] of block.matchAll(/--([a-z-]+(?<!-rgb)):\s*(#[0-9a-f]{6});/g)) {
    assert.ok(!seen.has(value), `--${name} duplicates --${seen.get(value)} (${value}); alias it with var() instead`);
    seen.set(value, name);
  }
});
