"use client";

import { useState } from "react";
import type { CompletedSession } from "../../../application/session/session-types.ts";

type HistoryScreenProps = {
  sessions: ReadonlyArray<CompletedSession>;
  onBack: () => void;
  onSave: () => Promise<boolean>;
};

export function HistoryScreen({ sessions, onBack, onSave }: HistoryScreenProps) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const saveRecords = async () => {
    setSaveStatus("saving");
    setSaveStatus((await onSave()) ? "saved" : "failed");
  };

  return (
    <main className="history-shell">
      <div className="history-heading">
        <button className="text-button" type="button" onClick={onBack}>
          ← 戻る
        </button>
        <div>
          <span className="section-index">LOCAL HISTORY</span>
          <h1>練習の記録</h1>
          <p>この端末に自動保存。JSONファイルに書き出して、手元にも残せます。</p>
        </div>
        {sessions.length > 0 && (
          <div className="history-actions">
            <button className="primary-button" type="button" onClick={saveRecords} disabled={saveStatus === "saving"}>
              {saveStatus === "saving" ? "保存中…" : "記録を保存"}
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
      {sessions.length === 0 ? (
        <p className="empty-state">まだ記録がありません。</p>
      ) : (
        <div className="history-table" role="table" aria-label="直近の練習履歴">
          <div className="history-row history-labels" role="row">
            <span role="columnheader">日時</span>
            <span role="columnheader">WPM</span>
            <span role="columnheader">精度</span>
            <span role="columnheader">スコア</span>
          </div>
          {sessions.map((session, index) => (
            <div className="history-row" role="row" key={session.id}>
              <span role="cell" data-label="日時">
                <i>{String(index + 1).padStart(2, "0")}</i>
                {new Intl.DateTimeFormat("ja-JP", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(session.endedAt)}
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
    </main>
  );
}
