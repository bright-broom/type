export type PromptCategory =
  | "basic"
  | "daily"
  | "sokuon"
  | "contracted"
  | "n-rule"
  | "phrase"
  | "consulting"
  | "takken";

export type TypingPrompt = {
  id: string;
  displayText: string;
  reading: string;
  category: PromptCategory;
  difficulty: number;
  tags?: ReadonlyArray<string>;
  description?: string;
};
