import { analyzeWeakKeys } from "../../domain/analytics/weak-key-analyzer.ts";
import type { TrainingSet, TypingPrompt } from "../../domain/prompts/prompt-types.ts";
import { calculateMetrics } from "../../domain/scoring/metrics.ts";
import { createTypingState } from "../../domain/typing/romanization-engine.ts";
import { normalizeTypedText } from "../../domain/typing/typed-text.ts";
import type { TypingState } from "../../domain/typing/typing-types.ts";
import { applyTypingText } from "./apply-typing-text.ts";
import { completeSession } from "./complete-session.ts";
import type { CompletedSession, KeystrokeEvent, PromptAttempt, TypingFeedback } from "./session-types.ts";
import { tallyTypingSteps, type AttemptDraft, type Tally } from "./tally-typing-steps.ts";

export type TypingSessionState = {
  trainingSet: TrainingSet;
  prompt: TypingPrompt;
  typing: TypingState;
  correct: number;
  misses: number;
  combo: number;
  maxCombo: number;
  completedPrompts: number;
  feedback: TypingFeedback;
};

export type TypingSessionTransition = {
  state: TypingSessionState;
  tally: Tally | null;
};

export function createTypingSessionState(prompt: TypingPrompt, trainingSet: TrainingSet): TypingSessionState {
  return {
    trainingSet,
    prompt,
    typing: createTypingState(prompt.reading),
    correct: 0,
    misses: 0,
    combo: 0,
    maxCombo: 0,
    completedPrompts: 0,
    feedback: null,
  };
}

export function createTypingAttempt(prompt: TypingPrompt, startedAt: number): AttemptDraft {
  return {
    promptId: prompt.id,
    startedAt,
    input: "",
    correctKeystrokes: 0,
    incorrectKeystrokes: 0,
  };
}

export function alignTypingAttemptStart(attempt: AttemptDraft | null, startedAt: number): AttemptDraft | null {
  return attempt?.input === "" ? { ...attempt, startedAt } : attempt;
}

export function transitionTypingText(input: {
  state: TypingSessionState;
  attempt: AttemptDraft | null;
  text: string;
  selectNextPrompt: () => TypingPrompt;
  now: () => number;
}): TypingSessionTransition {
  if (!input.attempt) return { state: input.state, tally: null };
  const { keys, rejected } = normalizeTypedText(input.text);
  if (!keys) {
    return {
      state: rejected ? { ...input.state, feedback: "unsupported" } : input.state,
      tally: null,
    };
  }

  const applied = applyTypingText(input.state.prompt, input.state.typing, keys, input.selectNextPrompt);
  const tally = tallyTypingSteps({
    steps: applied.steps,
    attempt: input.attempt,
    combo: input.state.combo,
    maxCombo: input.state.maxCombo,
    now: input.now,
  });
  return {
    state: {
      ...input.state,
      prompt: applied.prompt,
      typing: applied.typing,
      correct: input.state.correct + tally.accepted,
      misses: input.state.misses + tally.missed,
      combo: tally.combo,
      maxCombo: tally.maxCombo,
      completedPrompts: input.state.completedPrompts + tally.completed,
      feedback: tally.feedback ?? input.state.feedback,
    },
    tally,
  };
}

export function completeTypingSession(input: {
  id: string;
  state: TypingSessionState;
  startedAt: number;
  endedAt: number;
  elapsedMs: number;
  attempts: ReadonlyArray<PromptAttempt>;
  activeAttempt: AttemptDraft | null;
  keystrokes: ReadonlyArray<KeystrokeEvent>;
}): CompletedSession {
  const attempts = [...input.attempts];
  if (
    input.activeAttempt &&
    (input.activeAttempt.correctKeystrokes > 0 || input.activeAttempt.incorrectKeystrokes > 0)
  ) {
    attempts.push({ ...input.activeAttempt });
  }
  const metrics = calculateMetrics({
    correct: input.state.correct,
    incorrect: input.state.misses,
    elapsedMs: input.elapsedMs,
  });
  const weakKeys = analyzeWeakKeys(
    input.keystrokes.map((event) => ({ key: event.normalizedKey, correct: event.correct })),
  );
  return completeSession({
    id: input.id,
    trainingSet: input.state.trainingSet,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    attempts,
    keystrokes: input.keystrokes,
    metrics,
    completedPrompts: input.state.completedPrompts,
    maxCombo: input.state.maxCombo,
    weakKeys,
  });
}
