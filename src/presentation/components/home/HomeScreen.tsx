import type { CompletedSession } from "../../../application/session/session-types.ts";
import type { TrainingSet } from "../../../domain/prompts/prompt-types.ts";

type HomeScreenProps = {
  best: CompletedSession | null;
  history: ReadonlyArray<CompletedSession>;
  selectedMode: TrainingSet;
  onSelectMode: (mode: TrainingSet) => void;
  onStart: () => void;
  onShowPlaybook: () => void;
  onShowTakkenGlossary: () => void;
  onShowAisGlossary: () => void;
  onShowHistory: () => void;
  aborted: boolean;
};

const MODES: ReadonlyArray<{
  id: TrainingSet;
  label: string;
  detail: string;
}> = [
  { id: "japanese", label: "日本語", detail: "基礎と日常語" },
  { id: "consulting", label: "コンサル", detail: "実務用語" },
  { id: "takken", label: "宅建", detail: "試験用語" },
  { id: "ais", label: "会議", detail: "定例会議用語" },
  { id: "git", label: "Git", detail: "公式コマンド" },
];

const MODE_LABELS: Record<TrainingSet, string> = {
  japanese: "日本語",
  consulting: "コンサル用語",
  takken: "宅建用語",
  ais: "会議用語",
  git: "Gitコマンド",
};

export function HomeScreen({
  best,
  history,
  selectedMode,
  onSelectMode,
  onStart,
  onShowPlaybook,
  onShowTakkenGlossary,
  onShowAisGlossary,
  onShowHistory,
  aborted,
}: HomeScreenProps) {
  const latest = history[0];

  const nextFocus = latest
    ? latest.metrics.accuracy >= 97
      ? "精度は安定。次は一定のリズムを意識。"
      : "速さより正確さ。ミスを1つ減らすところから。"
    : "まずは60秒。結果を見て次の一手を決めよう。";

  return (
    <main className="home-shell focus-home" data-home-root tabIndex={-1}>
      <section className="hero focus-hero" aria-labelledby="hero-title">
        <div className="eyebrow">
          <span /> NO LOGIN · START IN ONE TAP
        </div>
        <h1 id="hero-title">
          60秒で、
          <br />
          <em>昨日より軽く。</em>
        </h1>
        <p className="hero-copy">迷う時間をなくして、正確さとリズムだけに集中するタイピング習慣。</p>

        {aborted ? (
          <p className="notice" role="status">
            セッションを終了しました。モードを選んですぐ再開できます。
          </p>
        ) : null}

        <section className="quick-start-panel" aria-labelledby="mode-title">
          <div className="quick-start-head">
            <div>
              <span className="section-index">QUICK START</span>
              <h2 id="mode-title">練習モードを選ぶ</h2>
            </div>
            <span>各60秒</span>
          </div>
          <fieldset className="mode-picker" aria-label="練習モード">
            {MODES.map((mode) => (
              <label className={`mode-option ${selectedMode === mode.id ? "mode-option--selected" : ""}`} key={mode.id}>
                <input
                  type="radio"
                  name="training-mode"
                  value={mode.id}
                  checked={selectedMode === mode.id}
                  data-start-shortcut="true"
                  onChange={() => onSelectMode(mode.id)}
                />
                <span>{mode.label}</span>
                <small>{mode.detail}</small>
              </label>
            ))}
          </fieldset>
          <div className="start-row">
            <button className="primary-button start-button" type="button" onClick={onStart}>
              <span>60秒トレーニングを始める</span>
              <kbd>Enter</kbd>
            </button>
            <p>
              {MODE_LABELS[selectedMode]}を選択中 <i aria-hidden="true" /> 記録は端末内に保存
            </p>
          </div>
        </section>

        <section className="resource-hub" aria-labelledby="resource-title">
          <div className="resource-heading">
            <div>
              <span className="section-index">REFERENCE</span>
              <h2 id="resource-title">言葉を見てから練習</h2>
            </div>
            <span>すべて端末内で検索</span>
          </div>
          <div className="resource-grid">
            <button
              data-focus-key="home-playbook"
              type="button"
              onClick={onShowPlaybook}
              aria-label="コンサル実務辞典を開く"
            >
              <span>コンサル実務辞典</span>
              <small>327語</small>
              <i aria-hidden="true">→</i>
            </button>
            <button
              data-focus-key="home-takken"
              type="button"
              onClick={onShowTakkenGlossary}
              aria-label="宅建試験 完全用語一覧を開く"
            >
              <span>宅建用語集</span>
              <small>446語</small>
              <i aria-hidden="true">→</i>
            </button>
            <button
              data-focus-key="home-ais"
              type="button"
              onClick={onShowAisGlossary}
              aria-label="週次定例会議 用語辞典を開く"
            >
              <span>会議用語辞典</span>
              <small>154語</small>
              <i aria-hidden="true">→</i>
            </button>
          </div>
        </section>
      </section>

      <aside className="progress-card" aria-label="トレーニング進捗">
        <header>
          <div>
            <span className="progress-kicker">YOUR PROGRESS</span>
            <h2>{latest ? "前回の60秒" : "最初の60秒"}</h2>
          </div>
          {history.length > 0 ? (
            <button data-focus-key="home-history" type="button" onClick={onShowHistory}>
              すべて見る <span aria-hidden="true">→</span>
            </button>
          ) : null}
        </header>

        {latest ? (
          <>
            <div className="progress-primary">
              <span>LAST WPM</span>
              <strong>{latest.metrics.wpm}</strong>
              <small>{MODE_LABELS[latest.trainingSet ?? "japanese"]}</small>
            </div>
            <div className="progress-metrics">
              <div>
                <span>精度</span>
                <strong>{latest.metrics.accuracy}%</strong>
              </div>
              <div>
                <span>日本語 BEST</span>
                <strong>{best?.metrics.wpm ?? "—"}</strong>
              </div>
              <div>
                <span>最近の記録</span>
                <strong>{history.length}</strong>
              </div>
            </div>
          </>
        ) : (
          <ol className="onboarding-steps">
            <li>
              <span>01</span>
              <strong>モードを選ぶ</strong>
            </li>
            <li>
              <span>02</span>
              <strong>60秒だけ集中</strong>
            </li>
            <li>
              <span>03</span>
              <strong>結果から1つ改善</strong>
            </li>
          </ol>
        )}

        <div className="progress-insight">
          <span>NEXT FOCUS</span>
          <p>{nextFocus}</p>
        </div>
        <p className="privacy-note">
          <span aria-hidden="true">●</span> アカウント不要。入力内容と記録はこのデバイスだけに保存されます。
        </p>
      </aside>
    </main>
  );
}
