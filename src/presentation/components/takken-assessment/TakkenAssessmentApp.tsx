"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAssessmentSession } from "../../hooks/useAssessmentSession.ts";
import { AssessmentLauncher } from "./AssessmentLauncher.tsx";
import { AssessmentQuestionScreen } from "./AssessmentQuestionScreen.tsx";
import { AssessmentResultScreen } from "./AssessmentResultScreen.tsx";

export function TakkenAssessmentApp({ experience }: { experience: "practice" | "mock" }) {
  const session = useAssessmentSession();
  useEffect(() => {
    if (session.result) document.querySelector<HTMLElement>("[data-result-root]")?.focus();
  }, [session.result]);
  if (!session.ready) {
    return (
      <main className="assessment-loading" role="status">
        宅建問題を読み込んでいます…
      </main>
    );
  }
  if (session.result) {
    return (
      <AssessmentResultScreen result={session.result} questions={session.questions} onDone={session.dismissResult} />
    );
  }
  if (!session.attempt) return <AssessmentLauncher experience={experience} onStart={session.start} />;
  const currentExperience = session.attempt.mode === "practice" ? "practice" : "mock";
  if (currentExperience !== experience) {
    return (
      <main className="assessment-reading-shell assessment-active-elsewhere">
        <span className="section-index">ACTIVE SESSION</span>
        <h1>進行中のセッションがあります。</h1>
        <p>{currentExperience === "practice" ? "10問演習" : "本番模試"}を先に再開してください。</p>
        <Link className="primary-button" href={currentExperience === "practice" ? "/takken/practice" : "/takken/mock"}>
          セッションへ戻る
        </Link>
      </main>
    );
  }
  return (
    <AssessmentQuestionScreen
      attempt={session.attempt}
      questions={session.questions}
      remainingMs={session.remainingMs}
      onAnswer={session.answer}
      onNavigate={session.navigate}
      onToggleFlag={session.toggleFlag}
      onSubmit={session.submit}
      onAbandon={session.abandon}
    />
  );
}
