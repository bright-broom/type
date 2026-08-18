import glossaryJson from "../generated/takken-glossary.json" with { type: "json" };
import type { TypingPrompt } from "../../domain/prompts/prompt-types.ts";
import type { TakkenGlossary } from "./takken-glossary-types.ts";

const glossary = glossaryJson as TakkenGlossary;

function difficultyFor(reading: string): number {
  if (reading.length <= 5) return 1;
  if (reading.length <= 9) return 2;
  if (reading.length <= 13) return 3;
  if (reading.length <= 18) return 4;
  return 5;
}

export const TAKKEN_PROMPTS: ReadonlyArray<TypingPrompt> = glossary.entries.map((entry) => ({
  id: `takken-${String(entry.id).padStart(3, "0")}`,
  displayText: entry.term,
  reading: entry.reading,
  category: "takken",
  difficulty: difficultyFor(entry.reading),
  tags: [entry.category, entry.subcategory, entry.importance, entry.sourceId],
  description: `${entry.definition} / 試験上の注意：${entry.examNote}`,
}));
