import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTypedText, TYPABLE_CHARACTER } from "./typed-text.ts";

test("keeps engine-consumable characters and lower-cases them", () => {
  assert.deepEqual(normalizeTypedText("KyoU"), { keys: "kyou", rejected: "" });
  assert.deepEqual(normalizeTypedText("b2b strategy"), { keys: "b2b strategy", rejected: "" });
  assert.deepEqual(normalizeTypedText("ri-do"), { keys: "ri-do", rejected: "" });
  assert.deepEqual(normalizeTypedText("it's"), { keys: "it's", rejected: "" });
});

test("reports kana and other unsupported characters instead of dropping them silently", () => {
  assert.deepEqual(normalizeTypedText("あいう"), { keys: "", rejected: "あいう" });
  assert.deepEqual(normalizeTypedText("パイプライン"), { keys: "", rejected: "パイプライン" });
  assert.deepEqual(normalizeTypedText("ka。na"), { keys: "kana", rejected: "。" });
  assert.deepEqual(normalizeTypedText("漢字"), { keys: "", rejected: "漢字" });
});

test("an empty or fully typable string reports nothing rejected", () => {
  assert.deepEqual(normalizeTypedText(""), { keys: "", rejected: "" });
  assert.deepEqual(normalizeTypedText("   "), { keys: "   ", rejected: "" });
});

test("the typable character rule stays a single-character test", () => {
  assert.equal(TYPABLE_CHARACTER.test("a"), true);
  assert.equal(TYPABLE_CHARACTER.test("Z"), true);
  assert.equal(TYPABLE_CHARACTER.test("ab"), false);
  assert.equal(TYPABLE_CHARACTER.test("あ"), false);
});
