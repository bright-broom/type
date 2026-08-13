import type { CompletedSession } from "../../application/session/session-types.ts";

export function HistoryScreen({ sessions, onBack }: { sessions: ReadonlyArray<CompletedSession>; onBack: () => void }) {
  return (
    <main className="history-shell">
      <div className="history-heading">
        <button className="text-button" type="button" onClick={onBack}>← 戻る</button>
        <div><span className="section-index">LOCAL HISTORY</span><h1>練習の記録</h1><p>小さな伸びも、積み重ねれば見えてくる。</p></div>
      </div>
      {sessions.length === 0 ? <p className="empty-state">まだ記録がありません。</p> : (
        <div className="history-table" role="table" aria-label="直近の練習履歴">
          <div className="history-row history-labels" role="row"><span>日時</span><span>WPM</span><span>精度</span><span>スコア</span></div>
          {sessions.map((session, index) => (
            <div className="history-row" role="row" key={session.id}>
              <span><i>{String(index + 1).padStart(2, "0")}</i>{new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(session.endedAt)}</span>
              <strong>{session.metrics.wpm}</strong>
              <span>{session.metrics.accuracy}%</span>
              <span>{session.score.toLocaleString("ja-JP")}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
