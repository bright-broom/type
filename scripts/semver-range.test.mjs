import assert from "node:assert/strict";
import test from "node:test";
import { satisfies } from "./semver-range.mjs";

test("caret ranges accept the rest of the major", () => {
  assert.equal(satisfies("9.39.5", "^9.0.0"), true);
  assert.equal(satisfies("10.0.1", "^9.0.0"), false);
  assert.equal(satisfies("9.7.0", "^9.7"), true);
  assert.equal(satisfies("9.6.0", "^9.7"), false);
  assert.equal(satisfies("0.3.1", "^0.3.0"), true);
  assert.equal(satisfies("0.4.0", "^0.3.0"), false);
});

test("bare majors accept the whole major", () => {
  assert.equal(satisfies("9.39.5", "^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9"), true);
  assert.equal(satisfies("10.8.1", "^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9"), false);
});

test("comparator pairs bound both ends", () => {
  assert.equal(satisfies("5.9.3", ">=4.8.4 <6.1.0"), true);
  assert.equal(satisfies("7.0.2", ">=4.8.4 <6.1.0"), false);
  assert.equal(satisfies("4.8.3", ">=4.8.4 <6.1.0"), false);
  assert.equal(satisfies("6.1.0", ">=4.8.4 <6.1.0"), false);
});

test("open-ended and wildcard ranges behave", () => {
  assert.equal(satisfies("10.8.1", "^6.0.0 || ^7.0.0 || >=8.0.0"), true);
  assert.equal(satisfies("5.0.0", ">8.0.0"), false);
  assert.equal(satisfies("1.0.0", "*"), true);
  assert.equal(satisfies("1.0.0", ""), true);
});

test("the real regressions that broke main are rejected", () => {
  // dependabot #17: @eslint/js 10.0.1 declares peerOptional eslint ^10.0.0.
  assert.equal(satisfies("9.39.5", "^10.0.0"), false);
  // dependabot #16: typescript-eslint 8.67.0 caps the compiler below 6.1.0.
  assert.equal(satisfies("7.0.2", ">=4.8.4 <6.1.0"), false);
});

test("unmodelled syntax is reported as unknown rather than satisfied", () => {
  assert.equal(satisfies("1.2.3", "workspace:^"), null);
  assert.equal(satisfies("not-a-version", "^1.0.0"), null);
});
