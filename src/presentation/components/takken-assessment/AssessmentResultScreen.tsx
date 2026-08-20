"use client";

import Link from "next/link";
import type { CompletedAssessment } from "../../../application/assessment/assessment-attempt.ts";
import type { AssessmentQuestion } from "../../../domain/assessment/assessment-types.ts";
import { PageShell } from "../layout/PageShell.tsx";

export function AssessmentResultScreen({
  result,
  questions,
  onDone,
}: {
  result: CompletedAssessment;
  questions: ReadonlyArray<AssessmentQuestion>;
  onDone: () => void;
}) {
  const resultById = new Map(result.score.results.map((item) => [item.questionId, item]));
  const review = questions.filter((question) => !resultById.get(question.id)?.correct);
  return (
    <PageShell
      width="assessment"
      className="assessment-result-shell assessment-reading-shell"
      data-result-root
      tabIndex={-1}
    >
      <span className="section-index">ASSESSMENT COMPLETE</span>
      <h1>
        {result.score.correct}
        <small> / {result.score.total}</small>
      </h1>
      <p className="assessment-lede">
        正答率 {result.score.accuracy}% · 未回答 {result.score.unanswered}問
      </p>
      <section className="assessment-category-results" aria-label="分野別結果">
        {result.score.categories.map((category) => (
          <div key={category.id}>
            <span>{category.label}</span>
            <strong>
              {category.correct} / {category.total}
            </strong>
          </div>
        ))}
      </section>
      {review.length > 0 ? (
        <section className="assessment-review" aria-labelledby="review-heading">
          <div>
            <span className="section-index">REVIEW</span>
            <h2 id="review-heading">復習する問題</h2>
          </div>
          {review.map((question) => {
            const item = resultById.get(question.id);
            return (
              <article key={question.id}>
                <span>{question.categoryLabel}</span>
                <h3>{question.stem}</h3>
                <p>{question.explanation}</p>
                <small>
                  {item?.choiceId ? "誤答" : "未回答"} · {question.sourceLabel}
                </small>
                <Link href={`/takken/glossary?concept=${question.conceptIds[0]}`}>この用語を確認 →</Link>
              </article>
            );
          })}
        </section>
      ) : null}
      <div className="assessment-result-actions">
        <button className="primary-button" type="button" onClick={onDone}>
          もう一度取り組む
        </button>
        <Link href="/?training=takken">宅建用語をタイピング</Link>
        <Link href="/takken/glossary">関連用語を確認</Link>
      </div>
      <p className="assessment-score-note">点数は学習状況の目安です。公式の合否判定ではありません。</p>
    </PageShell>
  );
}
