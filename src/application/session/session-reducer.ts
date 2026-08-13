import type { GameState, SessionEvent } from "./session-events.ts";

export const COUNTDOWN_MS = 3_000;
export const SESSION_DURATION_MS = 60_000;

export type SessionClockState = {
  status: GameState;
  durationMs: number;
  countdownStartedAt: number | null;
  startedAt: number | null;
  endedAt: number | null;
  pausedAt: number | null;
  pausedDurationMs: number;
  remainingMs: number;
};

export function createSessionState(durationMs = SESSION_DURATION_MS): SessionClockState {
  return {
    status: "idle",
    durationMs,
    countdownStartedAt: null,
    startedAt: null,
    endedAt: null,
    pausedAt: null,
    pausedDurationMs: 0,
    remainingMs: durationMs,
  };
}

function elapsedAt(state: SessionClockState, now: number): number {
  if (state.startedAt === null) return 0;
  const activePause = state.pausedAt === null ? 0 : now - state.pausedAt;
  return Math.max(0, now - state.startedAt - state.pausedDurationMs - activePause);
}

export function getElapsedMs(state: SessionClockState, now: number): number {
  return Math.min(state.durationMs, elapsedAt(state, now));
}

export function getCountdownValue(state: SessionClockState, now: number): number {
  if (state.status !== "countdown" || state.countdownStartedAt === null) return 0;
  return Math.max(1, Math.ceil((COUNTDOWN_MS - (now - state.countdownStartedAt)) / 1_000));
}

export function sessionTransition(state: SessionClockState, event: SessionEvent): SessionClockState {
  switch (event.type) {
    case "START":
      if (state.status !== "idle" && state.status !== "finished" && state.status !== "aborted") return state;
      return {
        ...createSessionState(state.durationMs),
        status: "countdown",
        countdownStartedAt: event.now,
      };
    case "TICK": {
      if (state.status === "countdown" && state.countdownStartedAt !== null) {
        if (event.now - state.countdownStartedAt < COUNTDOWN_MS) return state;
        const startedAt = state.countdownStartedAt + COUNTDOWN_MS;
        return { ...state, status: "playing", startedAt, remainingMs: state.durationMs };
      }
      if (state.status !== "playing") return state;
      const elapsed = elapsedAt(state, event.now);
      const remainingMs = Math.max(0, state.durationMs - elapsed);
      return remainingMs === 0
        ? { ...state, status: "finished", endedAt: event.now, remainingMs: 0 }
        : { ...state, remainingMs };
    }
    case "PAUSE":
      if (state.status !== "playing") return state;
      return {
        ...state,
        status: "paused",
        pausedAt: event.now,
        remainingMs: Math.max(0, state.durationMs - elapsedAt(state, event.now)),
      };
    case "RESUME":
      if (state.status !== "paused" || state.pausedAt === null) return state;
      return {
        ...state,
        status: "playing",
        pausedDurationMs: state.pausedDurationMs + Math.max(0, event.now - state.pausedAt),
        pausedAt: null,
      };
    case "ABORT":
      if (state.status !== "playing" && state.status !== "paused" && state.status !== "countdown") return state;
      return { ...state, status: "aborted", endedAt: event.now, pausedAt: null };
    case "RESET":
      return createSessionState(state.durationMs);
    default:
      return state;
  }
}
