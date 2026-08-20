"use client";

import { useState } from "react";
import type { AssessmentMode } from "../../../domain/assessment/assessment-types.ts";
import { TAKKEN_ASSESSMENT_CATEGORIES } from "../../../content/takken/takken-assessment-pack.ts";
import { formatEditionDate, TAKKEN_EDITION } from "../../../content/takken/takken-edition.ts";
import { PageShell } from "../layout/PageShell.tsx";

export function AssessmentLauncher({
  experience,
  onStart,
}: {
  experience: "practice" | "mock";
  onStart: (mode: AssessmentMode, categoryId?: string) => void;
}) {
  const [category, setCategory] = useState("");
  if (experience === "practice") {
    return (
      <PageShell width="assessment" className="assessment-launcher assessment-reading-shell">
        <span className="section-index">10 QUESTION PRACTICE</span>
        <h1>理解を確かめる、10問。</h1>
        <p className="assessment-lede">回答直後に正誤と解説を確認できます。間違えた概念から用語学習へ戻れます。</p>
        <label className="assessment-field">
          <span>重点分野</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">全分野から出題</option>
            {TAKKEN_ASSESSMENT_CATEGORIES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="assessment-field-note">問題数が10問に満たない分野は、他分野の問題で補完します。</p>
        <button className="primary-button assessment-start" type="button" onClick={() => onStart("practice", category)}>
          10問演習を始める
        </button>
        <AssessmentNotice />
      </PageShell>
    );
  }
  return (
    <PageShell width="assessment" className="assessment-launcher assessment-reading-shell">
      <span className="section-index">FULL SIMULATION</span>
      <h1>本番と同じ時間配分で。</h1>
      <p className="assessment-lede">提出まで正解を表示せず、未回答と見直しを管理します。途中で時計は止まりません。</p>
      <div className="assessment-mode-grid">
        <button type="button" onClick={() => onStart("mock-standard")}>
          <span>一般受験</span>
          <strong>50問</strong>
          <small>120分</small>
        </button>
        <button type="button" onClick={() => onStart("mock-exempt")}>
          <span>5問免除</span>
          <strong>45問</strong>
          <small>110分</small>
        </button>
      </div>
      <AssessmentNotice />
    </PageShell>
  );
}

function AssessmentNotice() {
  return (
    <aside className="assessment-notice">
      <strong>{TAKKEN_EDITION.label}・専門家監修前のオリジナル問題</strong>
      <p>
        {formatEditionDate(TAKKEN_EDITION.legalBasisDate, "japanese")}
        時点の学習用語集から機械的に構成した暫定教材です。公式過去問ではなく、法的正確性や合格を保証するものではありません。
      </p>
    </aside>
  );
}
