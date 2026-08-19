"use client";

import { useMemo, useState } from "react";
import playbookJson from "../../../content/generated/consulting-playbook.json";
import type {
  ConsultingPlaybook as ConsultingPlaybookData,
  PlaybookRow,
} from "../../../content/consulting/consulting-playbook-types.ts";

const playbook = playbookJson as ConsultingPlaybookData;

function rowText(row: PlaybookRow): string {
  return row.cells
    .map((cell) => cell.value)
    .filter(Boolean)
    .join("　");
}

export function ConsultingPlaybook({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const [activeSheetId, setActiveSheetId] = useState(playbook.sheets[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const activeSheet = playbook.sheets.find((sheet) => sheet.id === activeSheetId) ?? playbook.sheets[0];
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");
  const rows = useMemo(() => {
    if (!activeSheet) return [];
    return activeSheet.rows.filter(
      (row) => !normalizedQuery || rowText(row).toLocaleLowerCase("ja").includes(normalizedQuery),
    );
  }, [activeSheet, normalizedQuery]);

  return (
    <main className="playbook-shell" data-overlay-root tabIndex={-1}>
      <div className="playbook-heading">
        <button className="text-button" type="button" onClick={onBack}>
          ← ホームへ
        </button>
        <div>
          <span className="section-index">CONSULTING PLAYBOOK</span>
          <h1>コンサル実務辞典</h1>
          <p>
            全{playbook.stats.sheetCount}セクション・{playbook.stats.nonemptyCellCount.toLocaleString("ja-JP")}
            項目を端末内で検索できます。
          </p>
        </div>
        <button className="primary-button" type="button" onClick={onStart}>
          <span>用語を練習</span>
          <kbd>Enter</kbd>
        </button>
      </div>

      <div className="playbook-controls">
        <label>
          <span>辞典を検索</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例：MECE、仮説、要件定義"
            type="search"
          />
        </label>
        <span>{rows.length.toLocaleString("ja-JP")} 行</span>
      </div>

      <div className="playbook-layout">
        <nav className="playbook-nav" aria-label="Playbook セクション">
          {playbook.sheets.map((sheet, index) => (
            <button
              type="button"
              className={sheet.id === activeSheet?.id ? "active" : ""}
              onClick={() => setActiveSheetId(sheet.id)}
              key={sheet.id}
            >
              <i>{String(index + 1).padStart(2, "0")}</i>
              <span>{sheet.name.replace(/^\d+_/, "")}</span>
              <small>{sheet.rowCount}</small>
            </button>
          ))}
        </nav>
        <section className="playbook-content" aria-live="polite">
          <header>
            <span>{activeSheet?.name}</span>
            <strong>
              {rows.length} / {activeSheet?.rowCount} rows
            </strong>
          </header>
          <div
            className="playbook-rows"
            // The list scrolls, so it must be reachable without a pointer.
            tabIndex={0}
            role="group"
            aria-label="辞典の項目一覧"
          >
            {rows.map((row) => (
              <article key={row.index}>
                <span className="row-number">{String(row.index).padStart(3, "0")}</span>
                <div>
                  {row.cells.map((cell) => (
                    <p key={cell.column}>{cell.value}</p>
                  ))}
                </div>
              </article>
            ))}
            {rows.length === 0 && <p className="empty-state">一致する項目はありません。</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
