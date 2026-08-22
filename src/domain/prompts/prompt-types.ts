export type PromptCategory =
  "basic" | "daily" | "sokuon" | "contracted" | "n-rule" | "phrase" | "consulting" | "takken" | "git";

/**
 * Identifier of a practisable prompt collection.
 *
 * It lives beside `TypingPrompt` because it names a collection of prompts, not a
 * session concept. Keeping it in the domain lets `content` own the catalogue that
 * binds each identifier to its dataset while `application` only persists the name.
 */
export const TRAINING_SET_IDS = ["japanese", "consulting", "takken", "git"] as const;
export type TrainingSet = (typeof TRAINING_SET_IDS)[number];

export function isTrainingSet(value: unknown): value is TrainingSet {
  return typeof value === "string" && TRAINING_SET_IDS.some((trainingSet) => trainingSet === value);
}

export type TypingPrompt = {
  id: string;
  displayText: string;
  reading: string;
  category: PromptCategory;
  difficulty: number;
  tags?: ReadonlyArray<string>;
  description?: string;
};
