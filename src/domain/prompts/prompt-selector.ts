import type { TypingPrompt } from "./prompt-types.ts";

export type PromptSelector = { next(): TypingPrompt; reset(): void };

export function createPromptSelector(
  prompts: ReadonlyArray<TypingPrompt>,
  random: () => number = Math.random,
): PromptSelector {
  if (prompts.length < 2) throw new Error("PromptSelector requires at least two prompts");
  let bag: TypingPrompt[] = [];
  let previousId: string | null = null;

  function refill() {
    bag = [...prompts];
    for (let index = bag.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [bag[index], bag[target]] = [bag[target] as TypingPrompt, bag[index] as TypingPrompt];
    }
    if (bag.at(-1)?.id === previousId && bag.length > 1) {
      [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1] as TypingPrompt, bag[0] as TypingPrompt];
    }
  }

  return {
    next() {
      if (bag.length === 0) refill();
      const prompt = bag.pop();
      if (!prompt) throw new Error("Prompt bag unexpectedly empty");
      previousId = prompt.id;
      return prompt;
    },
    reset() {
      bag = [];
      previousId = null;
    },
  };
}
