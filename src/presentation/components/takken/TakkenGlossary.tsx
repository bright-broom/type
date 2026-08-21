"use client";

import { useMemo, useState } from "react";
import glossaryJson from "../../../content/generated/takken-glossary.json";
import { filterTakkenGlossary } from "../../../content/takken/filter-takken-glossary.ts";
import { TAKKEN_EXAM_YEAR } from "../../../content/takken/takken-edition.ts";
import type { TakkenGlossary as TakkenGlossaryData } from "../../../content/takken/takken-glossary-types.ts";
import { useBrowserSnapshot } from "../../hooks/useBrowserSnapshot.ts";
import { PageShell } from "../layout/PageShell.tsx";

const glossary = glossaryJson as TakkenGlossaryData;

export function TakkenGlossary({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const browserReady = useBrowserSnapshot(() => true, false);
  const routeQuery = useBrowserSnapshot(() => {
    const match = new URLSearchParams(window.location.search).get("concept")?.match(/^takken-term-(\d{3})$/);
    return match ? (glossary.entries.find(({ id }) => id === Number(match[1]))?.term ?? "") : "";
  }, "");
  const [queryOverride, setQuery] = useState<string | null>(null);
  const query = queryOverride ?? routeQuery;
  const [category, setCategory] = useState("");
  const [importance, setImportance] = useState("");
  const [sourceId, setSourceId] = useState("");

  const entries = useMemo(
    () => (browserReady ? filterTakkenGlossary(glossary.entries, { query, category, importance, sourceId }) : []),
    [browserReady, category, importance, query, sourceId],
  );

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setImportance("");
    setSourceId("");
  };

  return (
    <PageShell width="wide" className="glossary-shell" data-overlay-root tabIndex={-1}>
      <div className="glossary-heading">
        <button className="text-button" type="button" onClick={onBack}>
          ← ホームへ
        </button>
        <div>
          <span className="section-index">TAKKEN MASTER GLOSSARY / {TAKKEN_EXAM_YEAR}</span>
          <h1>宅建試験 完全用語一覧</h1>
          <p>
            {glossary.edition}・全{glossary.stats.entryCount}語を、分野・重要度・出典で絞り込めます。
          </p>
        </div>
        <button className="primary-button" type="button" onClick={onStart}>
          <span>用語を練習</span>
          <kbd>Enter</kbd>
        </button>
      </div>

      <section className="glossary-filters takken-filters" aria-label="用語の絞り込み">
        <label className="glossary-search">
          <span>キーワード検索</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例：抵当権、都市計画法"
            type="search"
          />
        </label>
        <label>
          <span>分野</span>
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
          <span>重要度</span>
          <select value={importance} onChange={(event) => setImportance(event.target.value)}>
            <option value="">すべて</option>
            {glossary.filters.importanceLevels.map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>出典</span>
          <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
            <option value="">すべて</option>
            {glossary.filters.sourceIds.map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button className="filter-clear" type="button" onClick={clearFilters}>
          条件をクリア
        </button>
      </section>

      <div className="glossary-result-meta" aria-live="polite">
        {browserReady ? (
          <>
            <strong>{entries.length.toLocaleString("ja-JP")}</strong> / {glossary.stats.entryCount}語
          </>
        ) : (
          "用語を準備しています…"
        )}
      </div>
      <section className="glossary-list" aria-label="宅建用語一覧" aria-busy={!browserReady}>
        {entries.map((entry) => (
          <article className="glossary-entry" key={entry.id}>
            <span className="row-number">{String(entry.id).padStart(3, "0")}</span>
            <div className="glossary-entry-main">
              <div className="glossary-entry-title">
                <div>
                  <span>{entry.reading}</span>
                  <h2>{entry.term}</h2>
                </div>
                <i className={`importance importance-${entry.importance.toLowerCase()}`}>重要度 {entry.importance}</i>
              </div>
              <p>{entry.definition}</p>
              <p className="exam-note">
                <strong>試験上の注意</strong>
                {entry.examNote}
              </p>
              <footer>
                <span>{entry.category}</span>
                <span>{entry.subcategory}</span>
                <span>{entry.law}</span>
                <span>{entry.sourceId}</span>
              </footer>
            </div>
          </article>
        ))}
        {browserReady && entries.length === 0 && <p className="empty-state">一致する用語はありません。</p>}
      </section>
    </PageShell>
  );
}
