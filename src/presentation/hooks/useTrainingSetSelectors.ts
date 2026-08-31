"use client";

import { useCallback, useRef, useState } from "react";
import { EAGER_TRAINING_SET_PROMPTS, loadTrainingSetPrompts } from "../../content/training-set-catalog.ts";
import { createPromptSelector, type PromptSelector } from "../../domain/prompts/prompt-selector.ts";
import type { TrainingSet } from "../../domain/prompts/prompt-types.ts";

export function useTrainingSetSelectors() {
  const [selectors] = useState<Map<TrainingSet, PromptSelector>>(
    () =>
      new Map(
        Object.entries(EAGER_TRAINING_SET_PROMPTS).map(([set, prompts]) => [
          set as TrainingSet,
          createPromptSelector(prompts),
        ]),
      ),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(
    async (trainingSet: TrainingSet): Promise<PromptSelector | null> => {
      const request = ++requestRef.current;
      setPending(true);
      setError(null);
      try {
        let selector = selectors.get(trainingSet);
        if (!selector) {
          selector = createPromptSelector(await loadTrainingSetPrompts(trainingSet));
          selectors.set(trainingSet, selector);
        }
        return request === requestRef.current ? selector : null;
      } catch {
        if (request === requestRef.current) {
          setError("地名データを読み込めませんでした。ページを再読み込みして、もう一度お試しください。");
        }
        return null;
      } finally {
        if (request === requestRef.current) setPending(false);
      }
    },
    [selectors],
  );

  return { selectors, load, pending, error };
}
