"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPromptSelector } from "../../domain/prompts/prompt-selector.ts";
import type { PromptSelector } from "../../domain/prompts/prompt-selector.ts";
import type { TrainingSet } from "../../domain/prompts/prompt-types.ts";
import { calculateMetrics } from "../../domain/scoring/metrics.ts";
import { getTypingGuide } from "../../domain/typing/romanization-engine.ts";
import { JAPANESE_PROMPTS } from "../../content/japanese/japanese-prompts.ts";
import { byTrainingSet, TRAINING_SET_PROMPTS, TRAINING_SETS } from "../../content/training-set-catalog.ts";
import { LocalSessionRepository } from "../../infrastructure/persistence/local-session-repository.ts";
import { WebAudioService } from "../../infrastructure/audio/audio-service.ts";
import { createSessionId } from "../../infrastructure/identity/browser-session-id.ts";
import type { SessionRepository } from "../../application/ports/session-repository.ts";
import type { TypingAudio } from "../../application/ports/typing-audio.ts";
import * as sessionClock from "../../application/session/session-reducer.ts";
import {
  alignTypingAttemptStart,
  completeTypingSession,
  createTypingAttempt,
  createTypingSessionState,
  transitionTypingText,
  type TypingSessionState,
} from "../../application/session/typing-session-state.ts";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../../application/settings/app-settings.ts";
import type * as Session from "../../application/session/session-types.ts";

/** How many recent sessions the history screen shows. Storage keeps more. */
const RECENT_SESSIONS_SHOWN = 20;

type TypingSessionDependencies = {
  repository: SessionRepository;
  audio: TypingAudio;
  createId: () => string;
  monotonicNow: () => number;
  wallNow: () => number;
};

function createBrowserDependencies(): TypingSessionDependencies {
  return {
    repository: new LocalSessionRepository(),
    audio: new WebAudioService(),
    createId: createSessionId,
    monotonicNow: () => performance.now(),
    wallNow: () => Date.now(),
  };
}

export function useTypingSession(dependencies?: TypingSessionDependencies) {
  const [runtime] = useState(() => dependencies ?? createBrowserDependencies());
  const [clock, dispatch] = useReducer(sessionClock.sessionTransition, undefined, () =>
    sessionClock.createSessionState(),
  );
  const [selectors] = useState<Record<TrainingSet, PromptSelector>>(() =>
    byTrainingSet((set) => createPromptSelector(TRAINING_SET_PROMPTS[set])),
  );
  const firstPrompt = JAPANESE_PROMPTS[0];
  const [typingSession, setTypingSession] = useState<TypingSessionState>(() =>
    createTypingSessionState(firstPrompt, "japanese"),
  );
  const typingSessionRef = useRef(typingSession);
  const [result, setResult] = useState<Session.CompletedSession | null>(null);
  const [history, setHistory] = useState<Session.CompletedSession[]>([]);
  const [retainedHistory, setRetainedHistory] = useState<Session.CompletedSession[]>([]);
  const [bests, setBests] = useState<Record<TrainingSet, Session.CompletedSession | null>>(() =>
    byTrainingSet(() => null),
  );
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [now, setNow] = useState(0);
  const keystrokesRef = useRef<Session.KeystrokeEvent[]>([]);
  const attemptsRef = useRef<Session.PromptAttempt[]>([]);
  const attemptRef = useRef<Session.PromptAttempt & { completedAt?: number }>(null);
  const savedRef = useRef(false);
  const commitTypingSession = useCallback((next: TypingSessionState) => {
    typingSessionRef.current = next;
    setTypingSession(next);
  }, []);

  useEffect(() => {
    Promise.all([
      runtime.repository.getRecent(RECENT_SESSIONS_SHOWN),
      runtime.repository.getAll(),
      Promise.all(TRAINING_SETS.map(async (set) => [set, await runtime.repository.getBest(set)] as const)),
      runtime.repository.getSettings(),
    ])
      .then(([recent, retained, bestPerSet, storedSettings]) => {
        setHistory(recent);
        setRetainedHistory(retained);
        setBests(Object.fromEntries(bestPerSet) as Record<TrainingSet, Session.CompletedSession | null>);
        setSettings(storedSettings);
        runtime.audio.setEnabled(storedSettings.soundEnabled);
      })
      .catch(() => undefined)
      .finally(() => setSettingsReady(true));
  }, [runtime]);

  useEffect(() => {
    if (clock.status !== "countdown" && clock.status !== "playing") return;
    let frame = 0;
    let lastPaint = 0;
    const update = (time: number) => {
      if (time - lastPaint >= 100) {
        lastPaint = time;
        setNow(time);
        dispatch({ type: "TICK", now: time });
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [clock.status]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) dispatch({ type: "PAUSE", now: runtime.monotonicNow() });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [runtime]);

  const start = useCallback(
    (requestedSet: TrainingSet = "japanese") => {
      const selector = selectors[requestedSet];
      selector.reset();
      const next = selector.next();
      const time = runtime.monotonicNow();
      commitTypingSession(createTypingSessionState(next, requestedSet));
      setResult(null);
      keystrokesRef.current = [];
      attemptsRef.current = [];
      attemptRef.current = createTypingAttempt(next, time);
      savedRef.current = false;
      setNow(time);
      dispatch({ type: "START", now: time });
    },
    [commitTypingSession, runtime, selectors],
  );

  useEffect(() => {
    if (clock.status !== "finished" || savedRef.current) return;
    savedRef.current = true;
    const endedAt = runtime.wallNow();
    const startedAt = endedAt - clock.durationMs;
    const session = completeTypingSession({
      id: runtime.createId(),
      state: typingSession,
      startedAt,
      endedAt,
      elapsedMs: clock.durationMs,
      attempts: attemptsRef.current,
      activeAttempt: attemptRef.current,
      keystrokes: keystrokesRef.current,
    });
    setResult(session);
    setHistory((current) => [session, ...current].slice(0, RECENT_SESSIONS_SHOWN));
    setBests((current) => {
      const previous = current[typingSession.trainingSet];
      return {
        ...current,
        [typingSession.trainingSet]: !previous || session.score > previous.score ? session : previous,
      };
    });
    void runtime.repository
      .save(session)
      .then(() => runtime.repository.getAll())
      .then(setRetainedHistory)
      .catch(() => undefined);
  }, [clock.status, clock.durationMs, runtime, typingSession]);

  useEffect(() => {
    if (clock.status === "playing" && clock.startedAt !== null && attemptRef.current?.input === "") {
      attemptRef.current = alignTypingAttemptStart(attemptRef.current, clock.startedAt);
    }
  }, [clock.startedAt, clock.status]);

  const typeText = useCallback(
    (text: string) => {
      if (clock.status !== "playing" || !attemptRef.current) return;
      const current = typingSessionRef.current;
      const transition = transitionTypingText({
        state: current,
        attempt: attemptRef.current,
        text,
        selectNextPrompt: () => selectors[current.trainingSet].next(),
        now: runtime.monotonicNow,
      });
      if (transition.state !== current) commitTypingSession(transition.state);
      if (!transition.tally) return;
      keystrokesRef.current.push(...transition.tally.keystrokes);
      attemptsRef.current.push(...transition.tally.finishedAttempts);
      attemptRef.current = transition.tally.attempt;
      for (const sound of transition.tally.sounds) {
        if (sound === "miss") runtime.audio.playMiss();
        else if (sound === "correct") runtime.audio.playCorrect();
        else runtime.audio.playComplete();
      }
    },
    [clock.status, commitTypingSession, runtime, selectors],
  );

  const pause = useCallback(() => dispatch({ type: "PAUSE", now: runtime.monotonicNow() }), [runtime]);
  const resume = useCallback(() => dispatch({ type: "RESUME", now: runtime.monotonicNow() }), [runtime]);
  const abort = useCallback(() => dispatch({ type: "ABORT", now: runtime.monotonicNow() }), [runtime]);
  const home = useCallback(() => dispatch({ type: "RESET" }), []);
  const escape = useCallback(() => {
    if (clock.status === "playing") pause();
    else if (clock.status === "paused") resume();
  }, [clock.status, pause, resume]);
  const enter = useCallback(() => {
    if (["idle", "finished", "aborted"].includes(clock.status)) start(typingSession.trainingSet);
    else if (clock.status === "paused") resume();
  }, [clock.status, resume, start, typingSession.trainingSet]);
  const toggleSound = useCallback(() => {
    setSettings((current) => {
      const next = { ...current, soundEnabled: !current.soundEnabled };
      runtime.audio.setEnabled(next.soundEnabled);
      void runtime.repository.saveSettings(next);
      return next;
    });
  }, [runtime]);
  const elapsedMs = sessionClock.getElapsedMs(clock, now);
  const liveMetrics = useMemo(
    () => calculateMetrics({ correct: typingSession.correct, incorrect: typingSession.misses, elapsedMs }),
    [elapsedMs, typingSession.correct, typingSession.misses],
  );

  return {
    clock,
    now,
    countdown: sessionClock.getCountdownValue(clock, now),
    prompt: typingSession.prompt,
    guide: getTypingGuide(typingSession.typing),
    correct: typingSession.correct,
    misses: typingSession.misses,
    combo: typingSession.combo,
    maxCombo: typingSession.maxCombo,
    completedPrompts: typingSession.completedPrompts,
    feedback: typingSession.feedback,
    liveMetrics,
    result,
    history,
    retainedHistory,
    best: bests[typingSession.trainingSet],
    bests,
    settings,
    settingsReady,
    trainingSet: typingSession.trainingSet,
    start,
    typeText,
    pause,
    resume,
    abort,
    home,
    escape,
    enter,
    toggleSound,
  };
}
