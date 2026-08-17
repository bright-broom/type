import type { TypingPrompt } from "../../domain/prompts/prompt-types.ts";
import { JAPANESE_PROMPTS } from "../../content/prompts/japanese-prompts.ts";
import { CONSULTING_PROMPTS } from "../../content/prompts/consulting-prompts.ts";
import { TAKKEN_PROMPTS } from "../../content/prompts/takken-prompts.ts";
import { AIS_PROMPTS } from "../../content/prompts/ais-prompts.ts";
import type * as Session from "../../application/session/session-types.ts";

/**
 * The single place a training set is bound to its dataset.
 *
 * Presentation owns this binding because it is the only layer allowed to see both
 * the application's `TrainingSet` and the content datasets. Adding a set means
 * extending `TrainingSet` and adding one entry here; selectors, personal bests,
 * and persistence lookups all derive from this map.
 */
export const TRAINING_SET_PROMPTS: Record<Session.TrainingSet, ReadonlyArray<TypingPrompt>> = {
  japanese: JAPANESE_PROMPTS,
  consulting: CONSULTING_PROMPTS,
  takken: TAKKEN_PROMPTS,
  ais: AIS_PROMPTS,
};

export const TRAINING_SETS = Object.keys(TRAINING_SET_PROMPTS) as ReadonlyArray<Session.TrainingSet>;

/** Build a record keyed by every registered training set. */
export function byTrainingSet<Value>(
  create: (trainingSet: Session.TrainingSet) => Value,
): Record<Session.TrainingSet, Value> {
  return Object.fromEntries(TRAINING_SETS.map((set) => [set, create(set)])) as Record<Session.TrainingSet, Value>;
}
