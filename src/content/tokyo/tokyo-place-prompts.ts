import type { TypingPrompt } from "../../domain/prompts/prompt-types.ts";
import catalogue from "../generated/tokyo-place-names.json" with { type: "json" };

type TokyoEntry = readonly [id: string, name: string, reading: string, category: string, readingSource: string];

function difficulty(reading: string): number {
  if (reading.length <= 6) return 1;
  if (reading.length <= 12) return 2;
  if (reading.length <= 20) return 3;
  return 4;
}

function readingLabel(source: string): string {
  if (source === "official") return "公的資料";
  if (source === "official-municipality") return "自治体資料で補正";
  if (source === "manual-reviewed") return "個別確認";
  return "辞書補完（要確認）";
}

export const TOKYO_PLACE_PROMPTS: ReadonlyArray<TypingPrompt> = (catalogue.entries as unknown as TokyoEntry[]).map(
  ([id, name, reading, category, readingSource]) => ({
    id,
    displayText: name,
    reading,
    category: "tokyo",
    difficulty: difficulty(reading),
    tags: [category, readingSource],
    description: `${category} / 読み: ${readingLabel(readingSource)}`,
  }),
);
