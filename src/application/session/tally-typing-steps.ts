import type { TypingPrompt } from "../../domain/prompts/prompt-types.ts";
import type { AppliedTypingStep } from "./apply-typing-text.ts";
import type { KeystrokeEvent, PromptAttempt, TypingFeedback } from "./session-types.ts";

export type AttemptDraft = PromptAttempt & { completedAt?: number };

export type TallyInput = {
  steps: ReadonlyArray<AppliedTypingStep>;
  /** The attempt in progress when the text arrived. */
  attempt: AttemptDraft;
  combo: number;
  maxCombo: number;
  /** Injected so the tally stays pure and its timestamps stay assertable. */
  now: () => number;
};

export type Tally = {
  accepted: number;
  missed: number;
  completed: number;
  combo: number;
  maxCombo: number;
  feedback: TypingFeedback;
  keystrokes: KeystrokeEvent[];
  /** Attempts finished by this text, in completion order. */
  finishedAttempts: PromptAttempt[];
  /** The attempt still in progress afterwards. */
  attempt: AttemptDraft;
  /** Per-step outcomes, so the caller can play one sound per keystroke as before. */
  sounds: ReadonlyArray<"correct" | "miss" | "complete">;
};

/**
 * Turn applied typing steps into the counters, keystroke log, and attempt records a
 * session needs.
 *
 * This is the accounting that decides score, accuracy, and combo. It lived inside a
 * React callback where it could only be exercised through the browser; as a pure
 * function the rules are assertable directly, which matters because they are a
 * documented compatibility surface.
 */
export function tallyTypingSteps(input: TallyInput): Tally {
  const keystrokes: KeystrokeEvent[] = [];
  const finishedAttempts: PromptAttempt[] = [];
  const sounds: Array<"correct" | "miss" | "complete"> = [];
  let attempt: AttemptDraft = { ...input.attempt };
  let combo = input.combo;
  let maxCombo = input.maxCombo;
  let accepted = 0;
  let missed = 0;
  let completed = 0;
  let feedback: TypingFeedback = null;

  for (const step of input.steps) {
    const timestamp = input.now();
    keystrokes.push({
      timestamp,
      key: step.key,
      normalizedKey: step.key,
      correct: step.result.accepted,
      promptId: step.prompt.id,
      position: step.previousState.input.length,
    });

    if (!step.result.accepted) {
      attempt = { ...attempt, incorrectKeystrokes: attempt.incorrectKeystrokes + 1 };
      missed += 1;
      combo = 0;
      feedback = "miss";
      sounds.push("miss");
      continue;
    }

    accepted += 1;
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    attempt = {
      ...attempt,
      correctKeystrokes: attempt.correctKeystrokes + 1,
      input: step.result.nextState.input,
    };

    if (!step.result.completed) {
      feedback = "correct";
      sounds.push("correct");
      continue;
    }

    finishedAttempts.push({ ...attempt, completedAt: timestamp });
    completed += 1;
    feedback = "complete";
    sounds.push("complete");
    const next = step.nextPrompt as TypingPrompt;
    attempt = {
      promptId: next.id,
      startedAt: timestamp,
      input: "",
      correctKeystrokes: 0,
      incorrectKeystrokes: 0,
    };
  }

  return { accepted, missed, completed, combo, maxCombo, feedback, keystrokes, finishedAttempts, attempt, sounds };
}
