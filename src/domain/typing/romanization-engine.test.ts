import assert from "node:assert/strict";
import test from "node:test";
import { createTypingState, getTypingGuide, validateInput } from "./romanization-engine.ts";

function type(reading: string, input: string) {
  let state = createTypingState(reading);
  for (const key of input) {
    const result = validateInput(reading, state, key);
    assert.equal(result.accepted, true, `${reading}: ${key} should be accepted`);
    state = result.nextState;
  }
  return state;
}

for (const [reading, variants] of [
  ["し", ["shi", "si"]],
  ["ち", ["chi", "ti"]],
  ["つ", ["tsu", "tu"]],
  ["ふ", ["fu", "hu"]],
  ["しゃ", ["sha", "sya"]],
  ["きって", ["kitte"]],
  ["がっこう", ["gakkou"]],
  ["かんたん", ["kantan", "kanntann"]],
  ["しんよう", ["shin'you", "shinnyou"]],
] as const) {
  for (const variant of variants) {
    test(`${reading} accepts ${variant}`, () => {
      assert.equal(type(reading, variant).completed, true);
    });
  }
}

test("partial prefixes remain valid", () => {
  const state = type("し", "sh");
  assert.equal(state.completed, false);
  assert.equal(getTypingGuide(state).typed, "sh");
  assert.equal(getTypingGuide(state).remaining, "i");
});

test("invalid input does not advance and a correct retry succeeds", () => {
  const initial = createTypingState("し");
  const invalid = validateInput("し", initial, "x");
  assert.equal(invalid.accepted, false);
  assert.equal(invalid.nextState, initial);
  const retry = validateInput("し", invalid.nextState, "s");
  assert.equal(retry.accepted, true);
  assert.equal(retry.nextState.input, "s");
});

test("prompt completion is stable", () => {
  const complete = type("すし", "sushi");
  assert.equal(complete.completed, true);
  assert.equal(validateInput("すし", complete, "x").accepted, false);
});

test("ASCII consulting terms are matched case-insensitively with spaces and digits", () => {
  assert.equal(type("mece", "MECE").completed, true);
  assert.equal(type("b2b strategy", "b2b strategy").completed, true);
});

for (const [reading, variants] of [
  ["えーじぇんと", ["e-jento", "e-jyento"]],
  ["ちぇっく", ["chekku", "tyekku"]],
  ["しぇあ", ["shea", "syea"]],
  ["つぁー", ["tsa-"]],
  ["ふゅーじょん", ["fyu-jon"]],
  ["うぇぶ", ["webu"]],
] as const) {
  for (const variant of variants) {
    test(`loanword syllable ${reading} accepts ${variant}`, () => {
      assert.equal(type(reading, variant).completed, true);
    });
  }
}

test("mixed latin and kana readings type as one continuous target", () => {
  assert.equal(type("aiえーじぇんと", "aie-jento").completed, true);
  assert.equal(type("ほしゅapi", "hoshuapi").completed, true);
});
