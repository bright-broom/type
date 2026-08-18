"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { analyzeWeakKeys } from "../../domain/analytics/weak-key-analyzer.ts";
import { createPromptSelector } from "../../domain/prompts/prompt-selector.ts";
import type { PromptSelector } from "../../domain/prompts/prompt-selector.ts";
import type { TypingPrompt } from "../../domain/prompts/prompt-types.ts";
import { calculateMetrics } from "../../domain/scoring/metrics.ts";
import { calculateScore } from "../../domain/scoring/scoring-engine.ts";
import { createTypingState, getTypingGuide } from "../../domain/typing/romanization-engine.ts";
import type { TypingState } from "../../domain/typing/typing-types.ts";
import { JAPANESE_PROMPTS } from "../../content/prompts/japanese-prompts.ts";
import { LocalSessionRepository } from "../../infrastructure/persistence/local-session-repository.ts";
import { WebAudioService } from "../../infrastructure/audio/audio-service.ts";
import { createSessionId } from "../../infrastructure/identity/browser-session-id.ts";
import * as sessionClock from "../../application/session/session-reducer.ts";
import { applyTypingText } from "../../application/session/apply-typing-text.ts";
import type * as Session from "../../application/session/session-types.ts";
import { byTrainingSet, TRAINING_SET_PROMPTS, TRAINING_SETS } from "./training-set-prompts.ts";

const repository = new LocalSessionRepository();

type AttemptDraft = Session.PromptAttempt & { completedAt?: number };

export function useTypingSession() {
  const [clock, dispatch] = useReducer(sessionClock.sessionTransition, undefined, () =>
    sessionClock.createSessionState(),
  );
  const [selectors] = useState<Record<Session.TrainingSet, PromptSelector>>(() =>
    byTrainingSet((set) => createPromptSelector(TRAINING_SET_PROMPTS[set])),
  );
  const [trainingSet, setTrainingSet] = useState<Session.TrainingSet>("japanese");
  const firstPrompt = JAPANESE_PROMPTS[0] as TypingPrompt;
  const [prompt, setPrompt] = useState<TypingPrompt>(firstPrompt);
  const [typing, setTyping] = useState<TypingState>(() => createTypingState(firstPrompt.reading));
  const [correct, setCorrect] = useState(0);
  const [misses, setMisses] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [completedPrompts, setCompletedPrompts] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "miss" | "complete" | null>(null);
  const [result, setResult] = useState<Session.CompletedSession | null>(null);
  const [history, setHistory] = useState<Session.CompletedSession[]>([]);
  const [bests, setBests] = useState<Record<Session.TrainingSet, Session.CompletedSession | null>>(() =>
    byTrainingSet(() => null),
  );
  const [settings, setSettings] = useState<Session.AppSettings>({ soundEnabled: true });
  const [now, setNow] = useState(0);
  const keystrokesRef = useRef<Session.KeystrokeEvent[]>([]);
  const attemptsRef = useRef<Session.PromptAttempt[]>([]);
  const attemptRef = useRef<AttemptDraft | null>(null);
  const savedRef = useRef(false);
  const audioRef = useRef(new WebAudioService());

  useEffect(() => {
    Promise.all([
      repository.getRecent(20),
      Promise.all(TRAINING_SETS.map(async (set) => [set, await repository.getBest(set)] as const)),
      repository.getSettings(),
    ])
      .then(([recent, bestPerSet, storedSettings]) => {
        setHistory(recent);
        setBests(Object.fromEntries(bestPerSet) as Record<Session.TrainingSet, Session.CompletedSession | null>);
        setSettings(storedSettings);
        audioRef.current.setEnabled(storedSettings.soundEnabled);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (clock.status !== "countdown" && clock.status !== "playing") return;
    let frame = 0;
    let lastPaint = 0;
    const update = (time: number) => {
      if (time - lastPaint >= 50) {
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
    (requestedSet: Session.TrainingSet = "japanese") => {
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
    const session: Session.CompletedSession = {
      id: createSessionId(),
      mode: "60s",
      trainingSet,
      startedAt,
      endedAt,
      prompts: [...attemptsRef.current],
      keystrokes: [...keystrokesRef.current],
      metrics,
      score: calculateScore({ ...metrics, completedPrompts, maxCombo }),
      completedPrompts,
      maxCombo,
      weakKeys,
    };
    setResult(session);
    setHistory((current) => [session, ...current].slice(0, 20));
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
      const applied = applyTypingText(prompt, typing, text, () => selectors[trainingSet].next());
      let acceptedCount = 0;
      let missCount = 0;
      let completedCount = 0;
      let latestFeedback: "correct" | "miss" | "complete" | null = null;

      for (const step of applied.steps) {
        const time = performance.now();
        const event: Session.KeystrokeEvent = {
          timestamp: time,
          key: step.key,
          normalizedKey: step.key,
          correct: step.result.accepted,
          promptId: step.prompt.id,
          position: step.previousState.input.length,
        };
        keystrokesRef.current.push(event);
        if (!step.result.accepted) {
          attemptRef.current.incorrectKeystrokes += 1;
          missCount += 1;
          setCombo(0);
          latestFeedback = "miss";
          audioRef.current.playMiss();
          continue;
        }
        acceptedCount += 1;
        attemptRef.current.correctKeystrokes += 1;
        attemptRef.current.input = step.result.nextState.input;
        setCombo((value) => {
          const next = value + 1;
          setMaxCombo((maximum) => Math.max(maximum, next));
          return next;
        });
        if (!step.result.completed) {
          latestFeedback = "correct";
          audioRef.current.playCorrect();
          continue;
        }
        attemptRef.current.completedAt = time;
        attemptsRef.current.push({ ...attemptRef.current });
        completedCount += 1;
        latestFeedback = "complete";
        audioRef.current.playComplete();
        const next = step.nextPrompt as TypingPrompt;
        attemptRef.current = {
          promptId: next.id,
          startedAt: time,
          input: "",
          correctKeystrokes: 0,
          incorrectKeystrokes: 0,
        };
      }

      if (acceptedCount > 0) setCorrect((value) => value + acceptedCount);
      if (missCount > 0) setMisses((value) => value + missCount);
      if (completedCount > 0) setCompletedPrompts((value) => value + completedCount);
      if (latestFeedback) setFeedback(latestFeedback);
      setPrompt(applied.prompt);
      setTyping(applied.typing);
    },
    [clock.status, prompt, selectors, trainingSet, typing],
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
      const next = { soundEnabled: !current.soundEnabled };
      audioRef.current.setEnabled(next.soundEnabled);
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
  };
}
