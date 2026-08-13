export type GameState = "idle" | "countdown" | "playing" | "paused" | "finished" | "aborted";

export type SessionEvent =
  | { type: "START"; now: number }
  | { type: "TICK"; now: number }
  | { type: "PAUSE"; now: number }
  | { type: "RESUME"; now: number }
  | { type: "ABORT"; now: number }
  | { type: "RESET" };
