"use client";

import { useEffect, useRef, useState } from "react";
import type { AssessmentAttempt } from "../../../application/assessment/assessment-attempt.ts";
import { ASSESSMENT_PLANS } from "../../../domain/assessment/assessment-plans.ts";
import type { AssessmentQuestion } from "../../../domain/assessment/assessment-types.ts";
import { PageShell } from "../layout/PageShell.tsx";

function formatTime(milliseconds: number | null): string {
  if (milliseconds === null) return "時間制限なし";
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function AssessmentQuestionScreen({
  attempt,
  questions,
  remainingMs,
  onAnswer,
  onNavigate,
  onToggleFlag,
  onSubmit,
  onAbandon,
}: {
  attempt: AssessmentAttempt;
  questions: ReadonlyArray<AssessmentQuestion>;
  remainingMs: number | null;
  onAnswer: (questionId: string, choiceId: string) => void;
  onNavigate: (index: number) => void;
  onToggleFlag: (questionId: string) => void;
  onSubmit: () => void;
  onAbandon: () => void;
}) {
  const question = questions[attempt.currentIndex];
  const answer = attempt.answers[question.id];
  const flagged = attempt.flaggedQuestionIds.includes(question.id);
  const immediate = ASSESSMENT_PLANS[attempt.mode].feedback === "immediate";
  const answeredCount = Object.keys(attempt.answers).length;
  const unansweredCount = questions.length - answeredCount;
  const [confirmation, setConfirmation] = useState<"submit" | "abandon" | null>(null);
  const confirmationRef = useRef<HTMLDialogElement>(null);
  const cancelConfirmationRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (confirmation || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      const index = Number(event.key) - 1;
      const choice = question.choices[index];
      if (!choice) return;
      event.preventDefault();
      onAnswer(question.id, choice.id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmation, onAnswer, question]);
  useEffect(() => {
    if (confirmation && !confirmationRef.current?.open) {
      confirmationRef.current?.showModal();
      cancelConfirmationRef.current?.focus();
    }
  }, [confirmation]);
  return (
    <PageShell width="session" spacing="compact" className="assessment-session-shell">
      <header className="assessment-session-status">
        <div>
          <span>QUESTION</span>
          <strong>
            {attempt.currentIndex + 1} / {questions.length}
          </strong>
        </div>
        <div className="assessment-timer" role="timer" aria-label="残り時間">
          <span>TIME</span>
          <strong>{formatTime(remainingMs)}</strong>
        </div>
        <div>
          <span>ANSWERED</span>
          <strong>{answeredCount}</strong>
        </div>
      </header>

      <section className="assessment-question-card" aria-labelledby="assessment-question-title">
        <div className="assessment-question-meta">
          <span>{question.categoryLabel}</span>
          <button type="button" aria-pressed={flagged} onClick={() => onToggleFlag(question.id)}>
            {flagged ? "★ 見直す" : "☆ 見直し"}
          </button>
        </div>
        <h1 id="assessment-question-title">{question.stem}</h1>
        <fieldset className="assessment-choices">
          <legend>選択肢を1つ選んでください</legend>
          {question.choices.map((choice, index) => {
            const selected = answer?.choiceId === choice.id;
            const correct = immediate && answer ? choice.id === question.correctChoiceId : false;
            const incorrect = immediate && selected && !correct;
            return (
              <label className={correct ? "is-correct" : incorrect ? "is-incorrect" : ""} key={choice.id}>
                <input
                  type="radio"
                  name={question.id}
                  checked={selected}
                  onChange={() => onAnswer(question.id, choice.id)}
                />
                <kbd>{index + 1}</kbd>
                <span>{choice.text}</span>
              </label>
            );
          })}
        </fieldset>
        {immediate && answer ? (
          <div className="assessment-feedback" role="status">
            <strong>{answer.choiceId === question.correctChoiceId ? "正解です" : "もう一度整理しましょう"}</strong>
            <p>{question.explanation}</p>
          </div>
        ) : null}
      </section>

      <nav className="assessment-question-nav" aria-label="問題操作">
        <button
          type="button"
          disabled={attempt.currentIndex === 0}
          onClick={() => onNavigate(attempt.currentIndex - 1)}
        >
          ← 前の問題
        </button>
        {attempt.currentIndex < questions.length - 1 ? (
          <button className="primary-button" type="button" onClick={() => onNavigate(attempt.currentIndex + 1)}>
            次の問題 →
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={() => setConfirmation("submit")}>
            採点する
          </button>
        )}
      </nav>

      <details className="assessment-overview">
        <summary>解答状況を見る</summary>
        <div>
          {questions.map((item, index) => (
            <button
              className={`${attempt.answers[item.id] ? "is-answered" : ""} ${attempt.flaggedQuestionIds.includes(item.id) ? "is-flagged" : ""}`}
              type="button"
              aria-label={`問${index + 1}${attempt.answers[item.id] ? " 回答済み" : " 未回答"}`}
              aria-current={index === attempt.currentIndex ? "step" : undefined}
              onClick={() => onNavigate(index)}
              key={item.id}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <button className="assessment-overview-submit" type="button" onClick={() => setConfirmation("submit")}>
          現在の回答を提出
        </button>
      </details>
      <button className="assessment-abandon" type="button" onClick={() => setConfirmation("abandon")}>
        このセッションを終了する
      </button>
      {confirmation ? (
        <dialog
          className="assessment-confirm-dialog"
          aria-labelledby="assessment-confirm-title"
          ref={confirmationRef}
          onCancel={(event) => {
            event.preventDefault();
            setConfirmation(null);
          }}
        >
          <span className="section-index">CONFIRM</span>
          <h2 id="assessment-confirm-title">
            {confirmation === "submit" ? "この内容で採点しますか？" : "セッションを終了しますか？"}
          </h2>
          <p>
            {confirmation === "submit"
              ? `未回答は${unansweredCount}問です。提出後は回答を変更できません。`
              : "進行中の回答は削除され、試験記録には残りません。"}
          </p>
          <div>
            <button type="button" ref={cancelConfirmationRef} onClick={() => setConfirmation(null)}>
              戻る
            </button>
            <button className="primary-button" type="button" onClick={confirmation === "submit" ? onSubmit : onAbandon}>
              {confirmation === "submit" ? "提出して採点" : "終了する"}
            </button>
          </div>
        </dialog>
      ) : null}
    </PageShell>
  );
}
