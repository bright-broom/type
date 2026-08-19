"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAssessmentAttempt,
  remainingAssessmentMs,
  type AssessmentAttempt,
  type AssessmentAttemptEvent,
  type CompletedAssessment,
} from "../../application/assessment/assessment-attempt.ts";
import { assessmentAttemptMatchesQuestions } from "../../application/assessment/assessment-attempt-invariants.ts";
import { assessmentAttemptTransition } from "../../application/assessment/assessment-reducer.ts";
import { ASSESSMENT_PLANS } from "../../domain/assessment/assessment-plans.ts";
import { scoreAssessment } from "../../domain/assessment/score-assessment.ts";
import { selectPracticeQuestions } from "../../domain/assessment/assessment-progress.ts";
import type { AssessmentMode, AssessmentQuestion } from "../../domain/assessment/assessment-types.ts";
import { TAKKEN_ASSESSMENT_QUESTIONS, TAKKEN_PACK_VERSION } from "../../content/takken/takken-assessment-pack.ts";
import { createSessionId } from "../../infrastructure/identity/browser-session-id.ts";
import { LocalAssessmentRepository } from "../../infrastructure/persistence/local-assessment-repository.ts";

const repository = new LocalAssessmentRepository();
const TIMER_REFRESH_MS = 1_000;

function questionsForAttempt(attempt: AssessmentAttempt | null): AssessmentQuestion[] {
  if (!attempt) return [];
  const byId = new Map(TAKKEN_ASSESSMENT_QUESTIONS.map((question) => [question.id, question]));
  return attempt.questionIds.flatMap((id) => {
    const question = byId.get(id);
    return question ? [question] : [];
  });
}

export function useAssessmentSession() {
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [result, setResult] = useState<CompletedAssessment | null>(null);
  const [history, setHistory] = useState<CompletedAssessment[]>([]);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const finalisedIdRef = useRef<string | null>(null);
  const questions = useMemo(() => questionsForAttempt(attempt), [attempt]);

  useEffect(() => {
    Promise.all([repository.getActive(), repository.getHistory()])
      .then(async ([storedAttempt, storedHistory]) => {
        setHistory(storedHistory);
        if (
          storedAttempt &&
          storedAttempt.packVersion === TAKKEN_PACK_VERSION &&
          assessmentAttemptMatchesQuestions(storedAttempt, TAKKEN_ASSESSMENT_QUESTIONS)
        ) {
          setAttempt(storedAttempt);
        } else if (storedAttempt) {
          await repository.clearActive();
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!attempt) return;
    if (attempt.status === "active") {
      void repository.saveActive(attempt);
      return;
    }
    if (attempt.status === "abandoned") {
      void repository.clearActive();
      const abandonedId = attempt.id;
      queueMicrotask(() => setAttempt((current) => (current?.id === abandonedId ? null : current)));
      return;
    }
    if (finalisedIdRef.current === attempt.id) return;
    finalisedIdRef.current = attempt.id;
    const completed: CompletedAssessment = {
      ...attempt,
      status: attempt.status,
      completedAt: attempt.completedAt ?? Date.now(),
      score: scoreAssessment(questions, attempt.answers),
    };
    queueMicrotask(() => {
      setResult(completed);
      setHistory((current) => [completed, ...current.filter(({ id }) => id !== completed.id)]);
    });
    void Promise.all([repository.saveCompleted(completed), repository.clearActive()]);
  }, [attempt, questions]);

  useEffect(() => {
    if (attempt?.status !== "active" || attempt.deadlineAt === null) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      setAttempt((state) => (state ? assessmentAttemptTransition(state, { type: "TICK", now: current }) : state));
    };
    tick();
    const timer = window.setInterval(tick, TIMER_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [attempt?.deadlineAt, attempt?.status]);

  const start = useCallback(
    (mode: AssessmentMode, categoryId?: string) => {
      const plan = ASSESSMENT_PLANS[mode];
      const selected =
        mode === "practice"
          ? selectPracticeQuestions(
              TAKKEN_ASSESSMENT_QUESTIONS,
              history.filter(({ packVersion }) => packVersion === TAKKEN_PACK_VERSION).map(({ score }) => score),
              plan.questionCount,
              Date.now(),
              categoryId,
            )
          : TAKKEN_ASSESSMENT_QUESTIONS.slice(0, plan.questionCount);
      const startedAt = Date.now();
      finalisedIdRef.current = null;
      setNow(startedAt);
      setResult(null);
      setAttempt(
        createAssessmentAttempt({
          id: createSessionId(),
          packVersion: TAKKEN_PACK_VERSION,
          mode,
          questionIds: selected.map(({ id }) => id),
          startedAt,
          durationMs: plan.durationMs,
        }),
      );
    },
    [history],
  );

  const transition = useCallback((event: AssessmentAttemptEvent) => {
    setAttempt((state) => (state ? assessmentAttemptTransition(state, event) : state));
  }, []);

  const answer = useCallback(
    (questionId: string, choiceId: string) => transition({ type: "ANSWER", questionId, choiceId, now: Date.now() }),
    [transition],
  );
  const navigate = useCallback(
    (index: number) => transition({ type: "NAVIGATE", index, now: Date.now() }),
    [transition],
  );
  const toggleFlag = useCallback(
    (questionId: string) => transition({ type: "TOGGLE_FLAG", questionId, now: Date.now() }),
    [transition],
  );
  const submit = useCallback(() => transition({ type: "SUBMIT", now: Date.now() }), [transition]);
  const abandon = useCallback(() => transition({ type: "ABANDON", now: Date.now() }), [transition]);
  const dismissResult = useCallback(() => {
    setResult(null);
    setAttempt(null);
  }, []);

  return {
    ready,
    attempt,
    questions,
    currentQuestion: attempt ? (questions[attempt.currentIndex] ?? null) : null,
    result,
    history,
    remainingMs: attempt ? remainingAssessmentMs(attempt, now) : null,
    start,
    answer,
    navigate,
    toggleFlag,
    submit,
    abandon,
    dismissResult,
  };
}
