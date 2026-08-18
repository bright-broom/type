import assert from "node:assert/strict";
import test from "node:test";
import { validatePrompts } from "../domain/prompts/validate-prompts.ts";
import { byTrainingSet, TRAINING_SET_PROMPTS, TRAINING_SETS } from "./training-set-catalog.ts";

test("every catalogued training set resolves to a usable prompt collection", () => {
  assert.ok(TRAINING_SETS.length > 0);
  for (const trainingSet of TRAINING_SETS) {
    const prompts = TRAINING_SET_PROMPTS[trainingSet];
    // Two is the minimum `createPromptSelector` accepts, so a set below it would
    // throw only once a player picked it.
    assert.ok(prompts.length >= 2, `${trainingSet} needs at least two prompts`);
    assert.deepEqual(
      validatePrompts(prompts, { allowDuplicateText: true }),
      [],
      `${trainingSet} contains prompts the typing engine cannot consume`,
    );
  }
});

test("prompt ids are unique across the whole catalogue", () => {
  // Session history keys attempts by prompt id, so ids must not collide between sets.
  const ids = TRAINING_SETS.flatMap((set) => TRAINING_SET_PROMPTS[set].map((prompt) => prompt.id));
  assert.equal(new Set(ids).size, ids.length);
});

test("byTrainingSet covers exactly the catalogued sets", () => {
  const record = byTrainingSet((trainingSet) => trainingSet);
  assert.deepEqual(Object.keys(record).sort(), [...TRAINING_SETS].sort());
  for (const trainingSet of TRAINING_SETS) assert.equal(record[trainingSet], trainingSet);
});
