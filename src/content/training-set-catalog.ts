import { TRAINING_SET_IDS, type TrainingSet, type TypingPrompt } from "../domain/prompts/prompt-types.ts";
import { JAPANESE_PROMPTS } from "./japanese/japanese-prompts.ts";
import { CONSULTING_PROMPTS } from "./consulting/consulting-prompts.ts";
import { TAKKEN_PROMPTS } from "./takken/takken-prompts.ts";
import { GIT_COMMAND_PROMPTS } from "./git/git-commands.ts";

/**
 * The catalogue of practisable datasets.
 *
 * This is the only module allowed to reach across dataset directories: it is the
 * seam where a `TrainingSet` identifier is bound to the prompts behind it. Adding
 * a dataset means adding its directory, extending `TrainingSet`, and adding one
 * entry here — selectors, personal bests, and persistence lookups all derive from
 * this map, so no other wiring changes.
 */
export const TRAINING_SET_PROMPTS: Record<TrainingSet, ReadonlyArray<TypingPrompt>> = {
  japanese: JAPANESE_PROMPTS,
  consulting: CONSULTING_PROMPTS,
  takken: TAKKEN_PROMPTS,
  git: GIT_COMMAND_PROMPTS,
};

export const TRAINING_SETS: ReadonlyArray<TrainingSet> = TRAINING_SET_IDS;

/** Build a record keyed by every catalogued training set. */
export function byTrainingSet<Value>(create: (trainingSet: TrainingSet) => Value): Record<TrainingSet, Value> {
  return Object.fromEntries(TRAINING_SETS.map((set) => [set, create(set)])) as Record<TrainingSet, Value>;
}
