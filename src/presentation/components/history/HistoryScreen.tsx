"use client";

import { useState } from "react";
import type { CompletedSession } from "../../../application/session/session-types.ts";
import type { DailyScore } from "../../../domain/analytics/daily-score-calendar.ts";
import { localDateKey } from "../../../domain/analytics/daily-score-calendar.ts";
import { HistoryCalendar } from "./HistoryCalendar.tsx";

const DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const SELECTED_DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric" });

type HistoryScreenProps = {
  sessions: ReadonlyArray<CompletedSession>;
  dailyScores: ReadonlyArray<DailyScore>;
  onBack: () => void;
  onSave: () => Promise<boolean>;
};

export function HistoryScreen({ sessions, dailyScores, onBack, onSave }: HistoryScreenProps) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const latestTimestamp = sessions.reduce(
      (latest, session) => (Number.isFinite(session.endedAt) ? Math.max(latest, session.endedAt) : latest),
      0,
    );
    const latestDate = new Date(latestTimestamp || Date.now());
    return new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const metricSessions = sessions.filter((session) => session.metricsAvailable !== false);
  const bestWpm = metricSessions.length
    ? metricSessions.reduce((best, session) => Math.max(best, session.metrics.wpm), 0)
    : null;
  const averageWpm = metricSessions.length
    ? Math.round(
        (metricSessions.reduce((total, session) => total + session.metrics.wpm, 0) / metricSessions.length) * 10,
      ) / 10
    : 0;
  const saveRecords = async () => {
    setSaveStatus("saving");
    setSaveStatus((await onSave()) ? "saved" : "failed");
  };
  const visibleSessions = selectedDateKey
    ? sessions.filter((session) => localDateKey(session.endedAt) === selectedDateKey)
    : sessions;
  const selectedDateLabel = selectedDateKey
    ? SELECTED_DATE_FORMATTER.format(new Date(`${selectedDateKey}T00:00:00`))
    : null;

  return (
    <main className="history-shell" data-overlay-root tabIndex={-1}>
      <div className="history-heading">
        <button className="text-button" type="button" onClick={onBack}>
          ← 戻る
        </button>
        <div>
          <span className="section-index">LOCAL HISTORY</span>
          <h1>練習の記録</h1>
          <p>直近の変化を確認して、次の60秒で改善することを1つだけ決めましょう。</p>
        </div>
        {sessions.length > 0 && (
          <div className="history-actions">
            <button
              className="secondary-button history-save-button"
              type="button"
              onClick={saveRecords}
              disabled={saveStatus === "saving"}
            >
              {saveStatus === "saving" ? "保存中…" : "JSONで保存"}
            </button>
            <p className={"history-save-status status-" + saveStatus} role="status" aria-live="polite">
              {saveStatus === "saved"
                ? "JSONファイルに保存しました。"
                : saveStatus === "failed"
                  ? "保存できませんでした。ダウンロード設定を確認してください。"
                  : ""}
            </p>
          </div>
        )}
      </div>
      {sessions.length > 0 ? (
        <section className="history-overview" aria-label="記録の要約">
          <div>
            <span>最新 WPM</span>
            <strong>{metricSessions[0]?.metrics.wpm ?? "—"}</strong>
          </div>
          <div>
            <span>平均 WPM</span>
            <strong>{metricSessions.length ? averageWpm : "—"}</strong>
          </div>
          <div>
            <span>ベスト WPM</span>
            <strong>{bestWpm ?? "—"}</strong>
          </div>
          <p>
            直近 <span>{sessions.length}</span> セッションを表示
          </p>
        </section>
      ) : null}
      <HistoryCalendar
        dailyScores={dailyScores}
        visibleMonth={visibleMonth}
        selectedDateKey={selectedDateKey}
        onChangeMonth={setVisibleMonth}
        onSelectDate={setSelectedDateKey}
      />
      {sessions.length === 0 ? (
        <p className="empty-state">まだ記録がありません。</p>
      ) : (
        <section className="history-records" aria-labelledby="history-records-title">
          <header className="history-records__heading">
            <div>
              <span className="section-index">SESSION LOG</span>
              <h2 id="history-records-title">{selectedDateLabel ? `${selectedDateLabel}の記録` : "すべての練習"}</h2>
            </div>
            {selectedDateKey ? (
              <button className="text-button" type="button" onClick={() => setSelectedDateKey(null)}>
                絞り込みを解除
              </button>
            ) : null}
          </header>
          <div
            className="history-table"
            role="table"
            aria-label={selectedDateLabel ? `${selectedDateLabel}の練習履歴` : "直近の練習履歴"}
          >
            <div className="history-row history-labels" role="row">
              <span role="columnheader">日時</span>
              <span role="columnheader">WPM</span>
              <span role="columnheader">精度</span>
              <span role="columnheader">スコア</span>
            </div>
            {visibleSessions.map((session, index) => (
              <div className="history-row" role="row" key={session.id}>
                <span role="cell" data-label="日時">
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  {DATE_FORMATTER.format(session.endedAt)}
                </span>
                <strong role="cell" data-label="WPM">
                  {session.metricsAvailable === false ? "—" : session.metrics.wpm}
                </strong>
                <span role="cell" data-label="精度">
                  {session.metricsAvailable === false ? "計測不可" : `${session.metrics.accuracy}%`}
                </span>
                <span role="cell" data-label="スコア">
                  {session.score.toLocaleString("ja-JP")}
                </span>
              </div>
            ))}
            {selectedDateKey && visibleSessions.length === 0 ? (
              <p className="empty-state">
                この日の最高スコアは保存されていますが、セッション詳細の保存期間は終了しています。
              </p>
            ) : null}
          </div>
        </section>
      )}
    </main>
  );
}
