import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Contract tests for the design-token block in app/globals.css.
 *
 * The axe E2E suite measures rendered pages, but only after a build and only for
 * the states the tests visit. These assertions run in milliseconds against the
 * tokens themselves, so a retune that breaks a core reading pair fails before a
 * browser ever starts. They are the reason a tone change is safe to make quickly.
 */

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const block = css.match(/\/\* @tokens-begin[\s\S]*?@tokens-end \*\//)?.[0];

function token(name) {
  const match = block?.match(new RegExp(`--${name}:\\s*([^;]+);`));
  assert.ok(match, `token --${name} is missing from the token block`);
  return match[1].trim();
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

test("the token block exists and is the only :root", () => {
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

test("every --*-rgb triplet matches its hex base", () => {
  // Translucent colors are built from these; a mismatch forks the palette invisibly.
  for (const [, name, triplet] of block.matchAll(/--([a-z-]+)-rgb:\s*(\d+ \d+ \d+);/g)) {
    if (name === "black") continue; // no opaque --black token; used only for shadows
    const hex = token(name);
    const fromHex = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");
    assert.equal(triplet, fromHex, `--${name}-rgb (${triplet}) drifted from --${name} (${hex})`);
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
