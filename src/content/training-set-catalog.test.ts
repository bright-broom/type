import assert from "node:assert/strict";
import test from "node:test";
import { validatePrompts } from "../domain/prompts/validate-prompts.ts";
import { byTrainingSet, loadTrainingSetPrompts, TRAINING_SETS } from "./training-set-catalog.ts";

test("every catalogued training set resolves to a usable prompt collection", async () => {
  assert.ok(TRAINING_SETS.length > 0);
  for (const trainingSet of TRAINING_SETS) {
    const prompts = await loadTrainingSetPrompts(trainingSet);
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

test("prompt ids are unique across the whole catalogue", async () => {
  // Session history keys attempts by prompt id, so ids must not collide between sets.
  const ids = (await Promise.all(TRAINING_SETS.map(loadTrainingSetPrompts))).flatMap((prompts) =>
    prompts.map((prompt) => prompt.id),
  );
  assert.equal(new Set(ids).size, ids.length);
});

test("known Tokyo place names retain reviewed readings", async () => {
  const prompts = await loadTrainingSetPrompts("tokyo");
  const readingOf = (name: string, category: string) =>
    prompts.find((prompt) => prompt.displayText === name && prompt.tags?.includes(category))?.reading;
  assert.equal(readingOf("一橋学園駅", "鉄道駅"), "ひとつばしがくえんえき");
  assert.equal(readingOf("中野坂上駅", "鉄道駅"), "なかのさかうええき");
  assert.equal(readingOf("馬喰横山駅", "鉄道駅"), "ばくろよこやまえき");
  assert.equal(readingOf("多摩川", "河川"), "たまがわ");
  assert.equal(readingOf("神田川", "河川"), "かんだがわ");
});

test("byTrainingSet covers exactly the catalogued sets", () => {
  const record = byTrainingSet((trainingSet) => trainingSet);
  assert.deepEqual(Object.keys(record).sort(), [...TRAINING_SETS].sort());
  for (const trainingSet of TRAINING_SETS) assert.equal(record[trainingSet], trainingSet);
});
