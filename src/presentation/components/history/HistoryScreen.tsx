"use client";

import { useState } from "react";
import type { CompletedSession } from "../../../application/session/session-types.ts";
import { PageShell } from "../layout/PageShell.tsx";
import styles from "./HistoryScreen.module.css";

const DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type HistoryScreenProps = {
  sessions: ReadonlyArray<CompletedSession>;
  onBack: () => void;
  onSave: () => Promise<boolean>;
};

export function HistoryScreen({ sessions, onBack, onSave }: HistoryScreenProps) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const bestWpm = sessions.reduce((best, session) => Math.max(best, session.metrics.wpm), 0);
  const averageWpm = sessions.length
    ? Math.round((sessions.reduce((total, session) => total + session.metrics.wpm, 0) / sessions.length) * 10) / 10
    : 0;
  const saveRecords = async () => {
    setSaveStatus("saving");
    setSaveStatus((await onSave()) ? "saved" : "failed");
  };

  return (
    <PageShell width="reading" data-history-root data-overlay-root tabIndex={-1}>
      <div className={styles.heading}>
        <button className="text-button" type="button" onClick={onBack}>
          ← 戻る
        </button>
        <div>
          <span className="section-index">LOCAL HISTORY</span>
          <h1>練習の記録</h1>
          <p>直近の変化を確認して、次の60秒で改善することを1つだけ決めましょう。</p>
        </div>
        {sessions.length > 0 && (
          <div className={styles.actions}>
            <button
              className={`secondary-button ${styles.saveButton}`}
              type="button"
              onClick={saveRecords}
              disabled={saveStatus === "saving"}
            >
              {saveStatus === "saving" ? "保存中…" : "JSONで保存"}
            </button>
            <p
              className={`${styles.saveStatus} ${saveStatus === "failed" ? styles.saveFailed : ""}`}
              role="status"
              aria-live="polite"
            >
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
        <section className={styles.overview} aria-label="記録の要約">
          <div>
            <span>最新 WPM</span>
            <strong>{sessions[0]?.metrics.wpm}</strong>
          </div>
          <div>
            <span>平均 WPM</span>
            <strong>{averageWpm}</strong>
          </div>
          <div>
            <span>ベスト WPM</span>
            <strong>{bestWpm}</strong>
          </div>
          <p>
            直近 <span>{sessions.length}</span> セッションを表示
          </p>
        </section>
      ) : null}
      {sessions.length === 0 ? (
        <p className={styles.empty}>まだ記録がありません。</p>
      ) : (
        <div className={styles.table} role="table" aria-label="直近の練習履歴">
          <div className={`${styles.row} ${styles.labels}`} role="row">
            <span role="columnheader">日時</span>
            <span role="columnheader">WPM</span>
            <span role="columnheader">精度</span>
            <span role="columnheader">スコア</span>
          </div>
          {sessions.map((session, index) => (
            <div className={styles.row} role="row" key={session.id}>
              <span role="cell" data-label="日時">
                <i>{String(index + 1).padStart(2, "0")}</i>
                {DATE_FORMATTER.format(session.endedAt)}
              </span>
              <strong role="cell" data-label="WPM">
                {session.metrics.wpm}
              </strong>
              <span role="cell" data-label="精度">
                {session.metrics.accuracy}%
              </span>
              <span role="cell" data-label="スコア">
                {session.score.toLocaleString("ja-JP")}
              </span>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
