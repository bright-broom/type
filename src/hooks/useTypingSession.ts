"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { analyzeWeakKeys } from "../domain/analytics/weak-key-analyzer.ts";
import { createPromptSelector } from "../domain/prompts/prompt-selector.ts";
import type { TypingPrompt } from "../domain/prompts/prompt-types.ts";
import { calculateMetrics } from "../domain/scoring/metrics.ts";
import { calculateScore } from "../domain/scoring/scoring-engine.ts";
import { createTypingState, getTypingGuide, validateInput } from "../domain/typing/romanization-engine.ts";
import type { TypingState } from "../domain/typing/typing-types.ts";
import { JAPANESE_PROMPTS } from "../data/prompts/japanese-prompts.ts";
import { CONSULTING_PROMPTS } from "../data/prompts/consulting-prompts.ts";
import { LocalSessionRepository } from "../infrastructure/persistence/local-session-repository.ts";
import { WebAudioService } from "../infrastructure/audio/audio-service.ts";
import {
  createSessionState,
  getCountdownValue,
  getElapsedMs,
  sessionTransition,
} from "../application/session/session-reducer.ts";
import type {
  AppSettings,
  CompletedSession,
  KeystrokeEvent,
  PromptAttempt,
} from "../application/session/session-types.ts";

const repository = new LocalSessionRepository();

type AttemptDraft = PromptAttempt & { completedAt?: number };
export type TrainingSet = "japanese" | "consulting";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useTypingSession() {
  const [clock, dispatch] = useReducer(sessionTransition, undefined, () => createSessionState());
  const [selectors] = useState(() => ({
    japanese: createPromptSelector(JAPANESE_PROMPTS),
    consulting: createPromptSelector(CONSULTING_PROMPTS),
  }));
  const [trainingSet, setTrainingSet] = useState<TrainingSet>("japanese");
  const firstPrompt = JAPANESE_PROMPTS[0] as TypingPrompt;
  const [prompt, setPrompt] = useState<TypingPrompt>(firstPrompt);
  const [typing, setTyping] = useState<TypingState>(() => createTypingState(firstPrompt.reading));
  const [correct, setCorrect] = useState(0);
  const [misses, setMisses] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [completedPrompts, setCompletedPrompts] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "miss" | "complete" | null>(null);
  const [result, setResult] = useState<CompletedSession | null>(null);
  const [history, setHistory] = useState<CompletedSession[]>([]);
  const [bests, setBests] = useState<Record<TrainingSet, CompletedSession | null>>({ japanese: null, consulting: null });
  const [settings, setSettings] = useState<AppSettings>({ soundEnabled: true });
  const [now, setNow] = useState(0);
  const keystrokesRef = useRef<KeystrokeEvent[]>([]);
  const attemptsRef = useRef<PromptAttempt[]>([]);
  const attemptRef = useRef<AttemptDraft | null>(null);
  const savedRef = useRef(false);
  const audioRef = useRef(new WebAudioService());

  useEffect(() => {
    Promise.all([repository.getRecent(20), repository.getBest("japanese"), repository.getBest("consulting"), repository.getSettings()])
      .then(([recent, japaneseBest, consultingBest, storedSettings]) => {
        setHistory(recent);
        setBests({ japanese: japaneseBest, consulting: consultingBest });
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

  const start = useCallback((requestedSet: TrainingSet = "japanese") => {
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
  }, [selectors]);

  useEffect(() => {
    if (clock.status !== "finished" || savedRef.current) return;
    savedRef.current = true;
    const endedAt = Date.now();
    const startedAt = endedAt - clock.durationMs;
    if (attemptRef.current && (attemptRef.current.correctKeystrokes > 0 || attemptRef.current.incorrectKeystrokes > 0)) {
      attemptsRef.current.push({ ...attemptRef.current });
    }
    const metrics = calculateMetrics({ correct, incorrect: misses, elapsedMs: clock.durationMs });
    const weakKeys = analyzeWeakKeys(keystrokesRef.current.map((event) => ({ key: event.normalizedKey, correct: event.correct })));
    const session: CompletedSession = {
      id: newId(), mode: "60s", trainingSet, startedAt, endedAt,
      prompts: [...attemptsRef.current], keystrokes: [...keystrokesRef.current], metrics,
      score: calculateScore({ ...metrics, completedPrompts, maxCombo }),
      completedPrompts, maxCombo, weakKeys,
    };
    setResult(session);
    setHistory((current) => [session, ...current].slice(0, 20));
    setBests((current) => ({
      ...current,
      [trainingSet]: !current[trainingSet] || session.score > current[trainingSet].score
        ? session
        : current[trainingSet],
    }));
    void repository.save(session);
  }, [clock.status, clock.durationMs, completedPrompts, correct, maxCombo, misses, trainingSet]);

  useEffect(() => {
    if (clock.status === "playing" && clock.startedAt !== null && attemptRef.current?.input === "") {
      attemptRef.current.startedAt = clock.startedAt;
    }
  }, [clock.startedAt, clock.status]);

  const typeKey = useCallback((key: string) => {
    if (clock.status !== "playing") return;
    const time = performance.now();
    const outcome = validateInput(prompt.reading, typing, key);
    const event: KeystrokeEvent = {
      timestamp: time,
      key,
      normalizedKey: key.toLowerCase(),
      correct: outcome.accepted,
      promptId: prompt.id,
      position: typing.input.length,
    };
    keystrokesRef.current.push(event);
    if (!attemptRef.current) return;
    if (!outcome.accepted) {
      attemptRef.current.incorrectKeystrokes += 1;
      setMisses((value) => value + 1);
      setCombo(0);
      setFeedback("miss");
      audioRef.current.playMiss();
      return;
    }
    attemptRef.current.correctKeystrokes += 1;
    attemptRef.current.input = outcome.nextState.input;
    setCorrect((value) => value + 1);
    setCombo((value) => {
      const next = value + 1;
      setMaxCombo((maximum) => Math.max(maximum, next));
      return next;
    });
    if (!outcome.completed) {
      setTyping(outcome.nextState);
      setFeedback("correct");
      audioRef.current.playCorrect();
      return;
    }
    attemptRef.current.completedAt = time;
    attemptsRef.current.push({ ...attemptRef.current });
    const next = selectors[trainingSet].next();
    setCompletedPrompts((value) => value + 1);
    setFeedback("complete");
    audioRef.current.playComplete();
    setPrompt(next);
    setTyping(createTypingState(next.reading));
    attemptRef.current = {
      promptId: next.id, startedAt: time, input: "", correctKeystrokes: 0, incorrectKeystrokes: 0,
    };
  }, [clock.status, prompt, selectors, trainingSet, typing]);

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

  const elapsedMs = getElapsedMs(clock, now);
  const liveMetrics = useMemo(
    () => calculateMetrics({ correct, incorrect: misses, elapsedMs }),
    [correct, misses, elapsedMs],
  );

  return {
    clock, now, countdown: getCountdownValue(clock, now), prompt, guide: getTypingGuide(typing),
    correct, misses, combo, maxCombo, completedPrompts, feedback, liveMetrics,
    result, history, best: bests[trainingSet], bests, settings, trainingSet,
    start, typeKey, pause, resume, abort, home, escape, enter, toggleSound,
  };
}
