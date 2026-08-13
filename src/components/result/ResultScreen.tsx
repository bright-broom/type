import type { CompletedSession } from "../../application/session/session-types.ts";

type ResultScreenProps = {
  result: CompletedSession;
  previousBest: CompletedSession | null;
  onRetry: () => void;
  onHome: () => void;
  onHistory: () => void;
};

export function ResultScreen({ result, previousBest, onRetry, onHome, onHistory }: ResultScreenProps) {
  const isBest = !previousBest || result.score > previousBest.score;
  const delta = previousBest ? result.metrics.wpm - previousBest.metrics.wpm : 0;
  return (
    <main className="result-shell">
      <section className="result-heading">
        <div className="eyebrow"><span /> SESSION COMPLETE</div>
        <h1>おつかれさまでした。</h1>
        <p>60秒の集中が、次の速さにつながります。</p>
      </section>

      <section className="score-card" aria-label="今回の結果">
        {isBest && <div className="best-ribbon">PERSONAL BEST</div>}
        <div className="main-score"><span>SCORE</span><strong>{result.score.toLocaleString("ja-JP")}</strong></div>
        <div className="metric-grid">
          <div className="metric-primary"><span>WPM</span><strong>{result.metrics.wpm}</strong>{previousBest && <small className={delta >= 0 ? "positive" : ""}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)} vs BEST</small>}</div>
          <div><span>CPM</span><strong>{result.metrics.cpm}</strong><small>文字 / 分</small></div>
          <div><span>精度</span><strong>{result.metrics.accuracy}<i>%</i></strong><small>{result.metrics.totalKeystrokes} 入力</small></div>
          <div><span>ミス</span><strong>{result.metrics.totalKeystrokes - result.metrics.correctKeystrokes}</strong><small>次はもっと正確に</small></div>
          <div><span>最大コンボ</span><strong>{result.maxCombo}</strong><small>{result.completedPrompts} 問クリア</small></div>
        </div>
      </section>

      {result.weakKeys.length > 0 && (
        <section className="weak-keys" aria-labelledby="weak-title">
          <div><span className="section-index">FOCUS</span><h2 id="weak-title">次に意識するキー</h2></div>
          <div className="key-list">{result.weakKeys.slice(0, 5).map((key) => <span key={key.key}><kbd>{key.key.toUpperCase()}</kbd><small>{key.accuracy}%</small></span>)}</div>
        </section>
      )}

      <div className="result-actions">
        <button className="primary-button" type="button" onClick={onRetry}><span>もう一度挑戦</span><kbd>Enter</kbd></button>
        <button className="text-button" type="button" onClick={onHistory}>練習履歴 <span aria-hidden="true">→</span></button>
        <button className="text-button" type="button" onClick={onHome}>ホームへ</button>
      </div>
    </main>
  );
}
