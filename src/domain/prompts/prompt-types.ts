export type PromptCategory =
  "basic" | "daily" | "sokuon" | "contracted" | "n-rule" | "phrase" | "consulting" | "takken" | "ais" | "git";

/**
 * Identifier of a practisable prompt collection.
 *
 * It lives beside `TypingPrompt` because it names a collection of prompts, not a
 * session concept. Keeping it in the domain lets `content` own the catalogue that
 * binds each identifier to its dataset while `application` only persists the name.
 */
export type TrainingSet = "japanese" | "consulting" | "takken" | "ais" | "git";

export type TypingPrompt = {
  id: string;
  displayText: string;
  reading: string;
  category: PromptCategory;
  difficulty: number;
  tags?: ReadonlyArray<string>;
  description?: string;
};
