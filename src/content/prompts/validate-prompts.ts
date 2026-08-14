import { segmentReading } from "../../domain/typing/romanization-engine.ts";
import type { TypingPrompt } from "../../domain/prompts/prompt-types.ts";

export function validatePrompts(
  prompts: ReadonlyArray<TypingPrompt>,
  options: { allowDuplicateText?: boolean } = {},
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const texts = new Set<string>();
  for (const prompt of prompts) {
    if (ids.has(prompt.id)) errors.push(`Duplicate id: ${prompt.id}`);
    if (!options.allowDuplicateText && texts.has(prompt.displayText)) errors.push(`Duplicate text: ${prompt.displayText}`);
    if (!prompt.reading) errors.push(`Empty reading: ${prompt.id}`);
    if (!Number.isInteger(prompt.difficulty) || prompt.difficulty < 1 || prompt.difficulty > 5) {
      errors.push(`Invalid difficulty: ${prompt.id}`);
    }
    try { segmentReading(prompt.reading); } catch (error) {
      errors.push(`${prompt.id}: ${error instanceof Error ? error.message : "Invalid reading"}`);
    }
    ids.add(prompt.id);
    texts.add(prompt.displayText);
  }
  return errors;
}
