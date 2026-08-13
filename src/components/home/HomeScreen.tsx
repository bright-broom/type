import type { CompletedSession } from "../../application/session/session-types.ts";

type HomeScreenProps = {
  best: CompletedSession | null;
  history: ReadonlyArray<CompletedSession>;
  onStart: () => void;
  onStartConsulting: () => void;
  onShowPlaybook: () => void;
  onShowHistory: () => void;
  aborted: boolean;
};

export function HomeScreen({ best, history, onStart, onStartConsulting, onShowPlaybook, onShowHistory, aborted }: HomeScreenProps) {
  return (
    <main className="home-shell">
      <section className="hero" aria-labelledby="hero-title">
        <div className="eyebrow"><span /> 1日60秒のキーボード習慣</div>
        <h1 id="hero-title">タイピングを、<br /><em>習慣に。</em></h1>
        <p className="hero-copy">正確さを積み重ねれば、速さはあとからついてくる。<br className="desktop-only" />迷わず始められる、短く濃いトレーニング。</p>
        {aborted && <p className="notice" role="status">セッションを終了しました。準備ができたら、もう一度。</p>}
        <div className="hero-actions">
          <button className="primary-button" type="button" onClick={onStart}>
            <span>60秒トレーニング</span><kbd>Enter</kbd>
          </button>
          <button className="secondary-button" type="button" onClick={onStartConsulting}>コンサル用語モード</button>
          {history.length > 0 && (
            <button className="text-button" type="button" onClick={onShowHistory}>練習履歴を見る <span aria-hidden="true">→</span></button>
          )}
        </div>
        <button className="playbook-link" type="button" onClick={onShowPlaybook}><span>NEW</span> コンサル実務辞典を開く <i>327語を練習</i></button>
      </section>

      <aside className="home-card" aria-label="トレーニング概要">
        <div className="home-card-top">
          <span className="mode-number">60</span>
          <span className="mode-unit">SEC<br />FOCUS</span>
          <span className="card-chip">JAPANESE</span>
        </div>
        <div className="key-visual" aria-hidden="true">
          <span>F</span><span>D</span><span>S</span><span>A</span>
          <i className="pulse-dot" />
        </div>
        <div className="home-card-stats">
          <div><span>BEST WPM</span><strong>{best?.metrics.wpm ?? "—"}</strong></div>
          <div><span>ACCURACY</span><strong>{best ? `${best.metrics.accuracy}%` : "—"}</strong></div>
        </div>
        <p>登録不要。記録はこのデバイスだけに保存されます。</p>
      </aside>

      <div className="home-footer-note"><span>01</span> 正確に打つ <i /> <span>02</span> リズムをつくる <i /> <span>03</span> 昨日を超える</div>
    </main>
  );
}
