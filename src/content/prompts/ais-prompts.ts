import glossaryJson from "../generated/ais-glossary.json" with { type: "json" };
import type { TypingPrompt } from "../../domain/prompts/prompt-types.ts";
import type { AisGlossary } from "../ais/ais-glossary-types.ts";

const glossary = glossaryJson as AisGlossary;

function difficultyFor(reading: string): number {
  if (reading.length <= 5) return 1;
  if (reading.length <= 9) return 2;
  if (reading.length <= 13) return 3;
  if (reading.length <= 18) return 4;
  return 5;
}

export const AIS_PROMPTS: ReadonlyArray<TypingPrompt> = glossary.entries.map((entry) => ({
  id: `ais-${String(entry.id).padStart(3, "0")}`,
  displayText: entry.term,
  reading: entry.reading,
  category: "ais",
  difficulty: difficultyFor(entry.reading),
  tags: [...entry.categories, entry.termKind, entry.confidence],
  description: entry.meetingContext
    ? `${entry.definition} / 会議での使われ方：${entry.meetingContext}`
    : entry.definition,
}));
