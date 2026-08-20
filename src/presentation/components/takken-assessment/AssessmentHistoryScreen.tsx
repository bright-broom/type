"use client";

import Link from "next/link";
import { summarizeCategoryProgress } from "../../../domain/assessment/assessment-progress.ts";
import { useAssessmentSession } from "../../hooks/useAssessmentSession.ts";
import { PageShell } from "../layout/PageShell.tsx";

const MODE_LABELS = {
  practice: "10問演習",
  "mock-standard": "50問模試",
  "mock-exempt": "5問免除模試",
} as const;

export function AssessmentHistoryScreen() {
  const session = useAssessmentSession();
  if (!session.ready) {
    return (
      <PageShell width="assessment" spacing="none" centered className="assessment-loading" role="status">
        試験記録を読み込んでいます…
      </PageShell>
    );
  }
  const progress = summarizeCategoryProgress(session.history.map(({ score }) => score));
  return (
    <PageShell width="assessment" className="assessment-history-shell assessment-reading-shell">
      <span className="section-index">LOCAL HISTORY</span>
      <h1>試験記録</h1>
      <p className="assessment-lede">結果はこの端末だけに保存されます。</p>
      {session.attempt ? (
        <aside className="assessment-resume-card">
          <div>
            <span>進行中</span>
            <strong>{MODE_LABELS[session.attempt.mode]}</strong>
          </div>
          <Link href={session.attempt.mode === "practice" ? "/takken/practice" : "/takken/mock"}>再開する →</Link>
        </aside>
      ) : null}
      {progress.length > 0 ? (
        <section className="assessment-progress-summary" aria-labelledby="progress-summary-title">
          <div>
            <span className="section-index">WEAKNESS FIRST</span>
            <h2 id="progress-summary-title">累計の分野別正答率</h2>
          </div>
          {progress.map((category) => (
            <div key={category.id}>
              <span>{category.label}</span>
              <strong>{category.accuracy}%</strong>
              <small>{category.total}問回答</small>
            </div>
          ))}
        </section>
      ) : null}
      {session.history.length === 0 ? (
        <div className="assessment-empty-history">
          <p>まだ試験記録がありません。</p>
          <Link href="/takken/practice">10問演習から始める</Link>
        </div>
      ) : (
        <ol className="assessment-history-list">
          {session.history.map((item) => (
            <li key={item.id}>
              <div>
                <span>{MODE_LABELS[item.mode]}</span>
                <time dateTime={new Date(item.completedAt).toISOString()}>
                  {new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(
                    item.completedAt,
                  )}
                </time>
              </div>
              <strong>
                {item.score.correct} <small>/ {item.score.total}</small>
              </strong>
              <span>正答率 {item.score.accuracy}%</span>
            </li>
          ))}
        </ol>
      )}
    </PageShell>
  );
}
