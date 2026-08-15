import type { TypingPrompt } from "../../domain/prompts/prompt-types.ts";
import { createTypingState, validateInput } from "../../domain/typing/romanization-engine.ts";
import type { TypingResult, TypingState } from "../../domain/typing/typing-types.ts";

export type AppliedTypingStep = {
  key: string;
  prompt: TypingPrompt;
  previousState: TypingState;
  result: TypingResult;
  nextPrompt?: TypingPrompt;
};

export type AppliedTypingText = {
  prompt: TypingPrompt;
  typing: TypingState;
  steps: ReadonlyArray<AppliedTypingStep>;
};

export function applyTypingText(
  initialPrompt: TypingPrompt,
  initialTyping: TypingState,
  text: string,
  selectNextPrompt: () => TypingPrompt,
): AppliedTypingText {
  let prompt = initialPrompt;
  let typing = initialTyping;
  const steps: AppliedTypingStep[] = [];

  for (const character of text) {
    const key = character.toLowerCase();
    const previousState = typing;
    const result = validateInput(prompt.reading, typing, key);
    if (!result.accepted) {
      steps.push({ key, prompt, previousState, result });
      continue;
    }
    if (!result.completed) {
      steps.push({ key, prompt, previousState, result });
      typing = result.nextState;
      continue;
    }
    const nextPrompt = selectNextPrompt();
    steps.push({ key, prompt, previousState, result, nextPrompt });
    prompt = nextPrompt;
    typing = createTypingState(nextPrompt.reading);
  }

  return { prompt, typing, steps };
}
