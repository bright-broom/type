import type { CompletedSession } from "./session-types.ts";

/**
 * Keep only the information used by history, personal bests, and weak-key guidance.
 *
 * Prompt input and ordered keystrokes are useful while a session is running, but
 * retaining them after scoring creates an unnecessary reconstruction surface for
 * text entered while the typing field was active.
 */
export function minimizeCompletedSession(session: CompletedSession): CompletedSession {
  return {
    ...session,
    prompts: [],
    keystrokes: [],
  };
}

export function hasDetailedTypingData(session: CompletedSession): boolean {
  return session.prompts.length > 0 || session.keystrokes.length > 0;
}
