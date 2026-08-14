"use client";

import { useMemo, useState } from "react";
import glossaryJson from "../../../content/takken/takken-glossary.json";
import { filterTakkenGlossary } from "../../../content/takken/filter-takken-glossary.ts";
import type { TakkenGlossary as TakkenGlossaryData } from "../../../content/takken/takken-glossary-types.ts";

const glossary = glossaryJson as TakkenGlossaryData;

export function TakkenGlossary({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [importance, setImportance] = useState("");
  const [sourceId, setSourceId] = useState("");

  const entries = useMemo(
    () => filterTakkenGlossary(glossary.entries, { query, category, importance, sourceId }),
    [category, importance, query, sourceId],
  );

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setImportance("");
    setSourceId("");
  };

  return (
    <main className="takken-shell">
      <div className="takken-heading">
        <button className="text-button" type="button" onClick={onBack}>← ホームへ</button>
        <div>
          <span className="section-index">TAKKEN MASTER GLOSSARY / 2026</span>
          <h1>宅建試験 完全用語一覧</h1>
          <p>{glossary.edition}・全{glossary.stats.entryCount}語を、分野・重要度・出典で絞り込めます。</p>
        </div>
        <button className="primary-button" type="button" onClick={onStart}><span>用語を練習</span><kbd>Enter</kbd></button>
      </div>

      <section className="takken-filters" aria-label="用語の絞り込み">
        <label className="takken-search">
          <span>キーワード検索</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例：抵当権、都市計画法" type="search" />
        </label>
        <label><span>分野</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">すべて</option>{glossary.filters.categories.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
        <label><span>重要度</span><select value={importance} onChange={(event) => setImportance(event.target.value)}><option value="">すべて</option>{glossary.filters.importanceLevels.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
        <label><span>出典</span><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">すべて</option>{glossary.filters.sourceIds.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
        <button className="filter-clear" type="button" onClick={clearFilters}>条件をクリア</button>
      </section>

      <div className="takken-result-meta" aria-live="polite"><strong>{entries.length.toLocaleString("ja-JP")}</strong> / {glossary.stats.entryCount}語</div>
      <section className="takken-list" aria-label="宅建用語一覧">
        {entries.map((entry) => (
          <article className="takken-entry" key={entry.id}>
            <span className="row-number">{String(entry.id).padStart(3, "0")}</span>
            <div className="takken-entry-main">
              <div className="takken-entry-title">
                <div><span>{entry.reading}</span><h2>{entry.term}</h2></div>
                <i className={`importance importance-${entry.importance.toLowerCase()}`}>重要度 {entry.importance}</i>
              </div>
              <p>{entry.definition}</p>
              <p className="exam-note"><strong>試験上の注意</strong>{entry.examNote}</p>
              <footer><span>{entry.category}</span><span>{entry.subcategory}</span><span>{entry.law}</span><span>{entry.sourceId}</span></footer>
            </div>
          </article>
        ))}
        {entries.length === 0 && <p className="empty-state">一致する用語はありません。</p>}
      </section>
    </main>
  );
}
