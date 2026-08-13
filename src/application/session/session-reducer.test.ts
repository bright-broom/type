import assert from "node:assert/strict";
import test from "node:test";
import { createSessionState, sessionTransition } from "./session-reducer.ts";

test("countdown and finish use clock difference instead of tick count", () => {
  let state = createSessionState(60_000);
  state = sessionTransition(state, { type: "START", now: 1_000 });
  state = sessionTransition(state, { type: "TICK", now: 4_000 });
  assert.equal(state.status, "playing");
  state = sessionTransition(state, { type: "TICK", now: 64_001 });
  assert.equal(state.status, "finished");
});

test("pause excludes hidden time and resume is deterministic", () => {
  let state = createSessionState(60_000);
  state = sessionTransition(state, { type: "START", now: 0 });
  state = sessionTransition(state, { type: "TICK", now: 3_000 });
  state = sessionTransition(state, { type: "PAUSE", now: 13_000 });
  assert.equal(state.remainingMs, 50_000);
  state = sessionTransition(state, { type: "RESUME", now: 43_000 });
  state = sessionTransition(state, { type: "TICK", now: 92_999 });
  assert.equal(state.status, "playing");
  state = sessionTransition(state, { type: "TICK", now: 93_000 });
  assert.equal(state.status, "finished");
});

test("invalid transitions leave state unchanged", () => {
  const idle = createSessionState(60_000);
  assert.equal(sessionTransition(idle, { type: "RESUME", now: 10 }), idle);
});
