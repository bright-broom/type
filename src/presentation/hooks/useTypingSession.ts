"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { analyzeWeakKeys } from "../../domain/analytics/weak-key-analyzer.ts";
import { createPromptSelector } from "../../domain/prompts/prompt-selector.ts";
import type { PromptSelector } from "../../domain/prompts/prompt-selector.ts";
import type { TrainingSet, TypingPrompt } from "../../domain/prompts/prompt-types.ts";
import { calculateMetrics } from "../../domain/scoring/metrics.ts";
import { createTypingState, getTypingGuide } from "../../domain/typing/romanization-engine.ts";
import { normalizeTypedText } from "../../domain/typing/typed-text.ts";
import type { TypingState } from "../../domain/typing/typing-types.ts";
import { JAPANESE_PROMPTS } from "../../content/japanese/japanese-prompts.ts";
import { byTrainingSet, TRAINING_SET_PROMPTS, TRAINING_SETS } from "../../content/training-set-catalog.ts";
import { LocalSessionRepository } from "../../infrastructure/persistence/local-session-repository.ts";
import { WebAudioService } from "../../infrastructure/audio/audio-service.ts";
import { createSessionId } from "../../infrastructure/identity/browser-session-id.ts";
import * as sessionClock from "../../application/session/session-reducer.ts";
import { applyTypingText } from "../../application/session/apply-typing-text.ts";
import { completeSession } from "../../application/session/complete-session.ts";
import { tallyTypingSteps } from "../../application/session/tally-typing-steps.ts";
import {
  DEFAULT_APP_SETTINGS,
  type AppearanceSettings,
  type AppSettings,
} from "../../application/settings/app-settings.ts";
import type * as Session from "../../application/session/session-types.ts";

const repository = new LocalSessionRepository();

/** How many recent sessions the history screen shows. Storage keeps more. */
const RECENT_SESSIONS_SHOWN = 20;

export function useTypingSession() {
  const [clock, dispatch] = useReducer(sessionClock.sessionTransition, undefined, () =>
    sessionClock.createSessionState(),
  );
  const [selectors] = useState<Record<TrainingSet, PromptSelector>>(() =>
    byTrainingSet((set) => createPromptSelector(TRAINING_SET_PROMPTS[set])),
  );
  const [trainingSet, setTrainingSet] = useState<TrainingSet>("japanese");
  const firstPrompt = JAPANESE_PROMPTS[0] as TypingPrompt;
  const [prompt, setPrompt] = useState<TypingPrompt>(firstPrompt);
  const [typing, setTyping] = useState<TypingState>(() => createTypingState(firstPrompt.reading));
  const [correct, setCorrect] = useState(0);
  const [misses, setMisses] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [completedPrompts, setCompletedPrompts] = useState(0);
  const [feedback, setFeedback] = useState<Session.TypingFeedback>(null);
  const [result, setResult] = useState<Session.CompletedSession | null>(null);
  const [history, setHistory] = useState<Session.CompletedSession[]>([]);
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
  const audioRef = useRef(new WebAudioService());

  useEffect(() => {
    Promise.all([
      repository.getRecent(RECENT_SESSIONS_SHOWN),
      Promise.all(TRAINING_SETS.map(async (set) => [set, await repository.getBest(set)] as const)),
      repository.getSettings(),
    ])
      .then(([recent, bestPerSet, storedSettings]) => {
        setHistory(recent);
        setBests(Object.fromEntries(bestPerSet) as Record<TrainingSet, Session.CompletedSession | null>);
        setSettings(storedSettings);
        audioRef.current.setEnabled(storedSettings.soundEnabled);
      })
      .catch(() => undefined)
      .finally(() => setSettingsReady(true));
  }, []);

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
      if (document.hidden) dispatch({ type: "PAUSE", now: performance.now() });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const start = useCallback(
    (requestedSet: TrainingSet = "japanese") => {
      const selector = selectors[requestedSet];
      selector.reset();
      const next = selector.next();
      const time = performance.now();
      setPrompt(next);
      setTrainingSet(requestedSet);
      setTyping(createTypingState(next.reading));
      setCorrect(0);
      setMisses(0);
      setCombo(0);
      setMaxCombo(0);
      setCompletedPrompts(0);
      setFeedback(null);
      setResult(null);
      keystrokesRef.current = [];
      attemptsRef.current = [];
      attemptRef.current = {
        promptId: next.id,
        startedAt: time,
        input: "",
        correctKeystrokes: 0,
        incorrectKeystrokes: 0,
      };
      savedRef.current = false;
      setNow(time);
      dispatch({ type: "START", now: time });
    },
    [selectors],
  );

  useEffect(() => {
    if (clock.status !== "finished" || savedRef.current) return;
    savedRef.current = true;
    const endedAt = Date.now();
    const startedAt = endedAt - clock.durationMs;
    if (
      attemptRef.current &&
      (attemptRef.current.correctKeystrokes > 0 || attemptRef.current.incorrectKeystrokes > 0)
    ) {
      attemptsRef.current.push({ ...attemptRef.current });
    }
    const metrics = calculateMetrics({ correct, incorrect: misses, elapsedMs: clock.durationMs });
    const weakKeys = analyzeWeakKeys(
      keystrokesRef.current.map((event) => ({ key: event.normalizedKey, correct: event.correct })),
    );
    const session = completeSession({
      id: createSessionId(),
      trainingSet,
      startedAt,
      endedAt,
      attempts: attemptsRef.current,
      keystrokes: keystrokesRef.current,
      metrics,
      completedPrompts,
      maxCombo,
      weakKeys,
    });
    setResult(session);
    setHistory((current) => [session, ...current].slice(0, RECENT_SESSIONS_SHOWN));
    setBests((current) => ({
      ...current,
      [trainingSet]:
        !current[trainingSet] || session.score > current[trainingSet].score ? session : current[trainingSet],
    }));
    void repository.save(session);
  }, [clock.status, clock.durationMs, completedPrompts, correct, maxCombo, misses, trainingSet]);

  useEffect(() => {
    if (clock.status === "playing" && clock.startedAt !== null && attemptRef.current?.input === "") {
      attemptRef.current.startedAt = clock.startedAt;
    }
  }, [clock.startedAt, clock.status]);

  const typeText = useCallback(
    (text: string) => {
      if (clock.status !== "playing" || !attemptRef.current) return;
      const { keys, rejected } = normalizeTypedText(text);
      if (!keys) {
        // Nothing usable arrived. Guide the player instead of failing silently.
        if (rejected) setFeedback("unsupported");
        return;
      }
      const applied = applyTypingText(prompt, typing, keys, () => selectors[trainingSet].next());
      const tally = tallyTypingSteps({
        steps: applied.steps,
        attempt: attemptRef.current,
        combo,
        maxCombo,
        now: () => performance.now(),
      });

      keystrokesRef.current.push(...tally.keystrokes);
      attemptsRef.current.push(...tally.finishedAttempts);
      attemptRef.current = tally.attempt;
      for (const sound of tally.sounds) {
        if (sound === "miss") audioRef.current.playMiss();
        else if (sound === "correct") audioRef.current.playCorrect();
        else audioRef.current.playComplete();
      }

      if (tally.accepted > 0) setCorrect((value) => value + tally.accepted);
      if (tally.missed > 0) setMisses((value) => value + tally.missed);
      if (tally.completed > 0) setCompletedPrompts((value) => value + tally.completed);
      setCombo(tally.combo);
      setMaxCombo(tally.maxCombo);
      if (tally.feedback) setFeedback(tally.feedback);
      setPrompt(applied.prompt);
      setTyping(applied.typing);
    },
    [clock.status, combo, maxCombo, prompt, selectors, trainingSet, typing],
  );

  const pause = useCallback(() => dispatch({ type: "PAUSE", now: performance.now() }), []);
  const resume = useCallback(() => dispatch({ type: "RESUME", now: performance.now() }), []);
  const abort = useCallback(() => dispatch({ type: "ABORT", now: performance.now() }), []);
  const home = useCallback(() => dispatch({ type: "RESET" }), []);
  const escape = useCallback(() => {
    if (clock.status === "playing") pause();
    else if (clock.status === "paused") resume();
  }, [clock.status, pause, resume]);
  const enter = useCallback(() => {
    if (["idle", "finished", "aborted"].includes(clock.status)) start(trainingSet);
    else if (clock.status === "paused") resume();
  }, [clock.status, resume, start, trainingSet]);
  const toggleSound = useCallback(() => {
    setSettings((current) => {
      const next = { ...current, soundEnabled: !current.soundEnabled };
      audioRef.current.setEnabled(next.soundEnabled);
      void repository.saveSettings(next);
      return next;
    });
  }, []);
  const updateAppearance = useCallback((appearance: AppearanceSettings) => {
    setSettings((current) => {
      const next = { ...current, appearance };
      void repository.saveSettings(next);
      return next;
    });
  }, []);

  const elapsedMs = sessionClock.getElapsedMs(clock, now);
  const liveMetrics = useMemo(
    () => calculateMetrics({ correct, incorrect: misses, elapsedMs }),
    [correct, misses, elapsedMs],
  );

  return {
    clock,
    now,
    countdown: sessionClock.getCountdownValue(clock, now),
    prompt,
    guide: getTypingGuide(typing),
    correct,
    misses,
    combo,
    maxCombo,
    completedPrompts,
    feedback,
    liveMetrics,
    result,
    history,
    best: bests[trainingSet],
    bests,
    settings,
    settingsReady,
    trainingSet,
    start,
    typeText,
    pause,
    resume,
    abort,
    home,
    escape,
    enter,
    toggleSound,
    updateAppearance,
  };
}
