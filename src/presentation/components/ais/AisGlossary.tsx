"use client";

import { useMemo, useState } from "react";
import glossaryJson from "../../../content/generated/ais-glossary.json";
import { filterAisGlossary } from "../../../content/ais/filter-ais-glossary.ts";
import type { AisConfidence, AisGlossary as AisGlossaryData } from "../../../content/ais/ais-glossary-types.ts";

const glossary = glossaryJson as AisGlossaryData;

const CONFIDENCE_MODIFIER: Record<AisConfidence, string> = {
  確定: "confirmed",
  一部要確認: "partial",
  要確認: "pending",
};

function meetingDate(): string {
  const [year, month, day] = glossary.meeting.date.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function AisGlossary({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [confidence, setConfidence] = useState("");
  const [termKind, setTermKind] = useState("");
  const [pendingReviewOnly, setPendingReviewOnly] = useState(false);

  const entries = useMemo(
    () => filterAisGlossary(glossary.entries, { query, category, confidence, termKind, pendingReviewOnly }),
    [category, confidence, pendingReviewOnly, query, termKind],
  );

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setConfidence("");
    setTermKind("");
    setPendingReviewOnly(false);
  };

  return (
    <main className="glossary-shell">
      <div className="glossary-heading">
        <button className="text-button" type="button" onClick={onBack}>
          ← ホームへ
        </button>
        <div>
          <span className="section-index">AIS WEEKLY MEETING GLOSSARY / {glossary.meeting.date}</span>
          <h1>{glossary.title}</h1>
          <p>
            {meetingDate()}の{glossary.meeting.name}（{glossary.meeting.sourceType}）から抽出した全
            {glossary.stats.entryCount}語。カテゴリ・確度・種別で絞り込めます。
          </p>
        </div>
        <button className="primary-button" type="button" onClick={onStart}>
          <span>用語を練習</span>
          <kbd>Enter</kbd>
        </button>
      </div>

      <p className="glossary-notice" role="note">
        <strong>非開示処理済み</strong>
        {glossary.masking.policy}実名を伏せた用語は{glossary.stats.maskedEntryCount}件です。
      </p>

      <section className="glossary-filters ais-filters" aria-label="用語の絞り込み">
        <label className="glossary-search">
          <span>キーワード検索</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例：パイプライン、読み、エージェント"
            type="search"
          />
        </label>
        <label>
          <span>カテゴリ</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">すべて</option>
            {glossary.filters.categories.map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>確度</span>
          <select value={confidence} onChange={(event) => setConfidence(event.target.value)}>
            <option value="">すべて</option>
            {glossary.filters.confidenceLevels.map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>種別</span>
          <select value={termKind} onChange={(event) => setTermKind(event.target.value)}>
            <option value="">すべて</option>
            {glossary.filters.termKinds.map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="glossary-toggle">
          <span>確認待ちのみ</span>
          <input
            checked={pendingReviewOnly}
            onChange={(event) => setPendingReviewOnly(event.target.checked)}
            type="checkbox"
          />
        </label>
        <button className="filter-clear" type="button" onClick={clearFilters}>
          条件をクリア
        </button>
      </section>

      <div className="glossary-result-meta" aria-live="polite">
        <strong>{entries.length.toLocaleString("ja-JP")}</strong> / {glossary.stats.entryCount}語
        <span> · 確認キュー {glossary.stats.reviewQueueCount}件</span>
      </div>

      <section className="glossary-list" aria-label="AIS会議用語一覧">
        {entries.map((entry) => (
          <article className="glossary-entry" key={entry.id}>
            <span className="row-number">{String(entry.id).padStart(3, "0")}</span>
            <div className="glossary-entry-main">
              <div className="glossary-entry-title">
                <div>
                  <span>
                    {entry.reading}
                    {entry.englishName !== "-" && ` / ${entry.englishName}`}
                  </span>
                  <h2>{entry.term}</h2>
                </div>
                <i className={`confidence confidence-${CONFIDENCE_MODIFIER[entry.confidence]}`}>{entry.confidence}</i>
              </div>
              <p>{entry.definition}</p>
              {entry.meetingContext && (
                <p className="meeting-context">
                  <strong>会議での使われ方</strong>
                  {entry.meetingContext}
                </p>
              )}
              {entry.reviewQuestion && (
                <p className="review-question">
                  <strong>確認事項（優先度{entry.reviewPriority}）</strong>
                  {entry.reviewQuestion}
                </p>
              )}
              <footer>
                <span>{entry.termKind}</span>
                {entry.categories.map((value) => (
                  <span key={value}>{value}</span>
                ))}
                <span>{entry.reviewState}</span>
                {entry.masked && <span className="masked-chip">実名非開示</span>}
              </footer>
            </div>
          </article>
        ))}
        {entries.length === 0 && <p className="empty-state">一致する用語はありません。</p>}
      </section>
    </main>
  );
}
