import type { CompletedSession } from "../../../application/session/session-types.ts";
import type { TrainingSet } from "../../../domain/prompts/prompt-types.ts";

type HomeScreenProps = {
  best: CompletedSession | null;
  history: ReadonlyArray<CompletedSession>;
  selectedMode: TrainingSet;
  onSelectMode: (mode: TrainingSet) => void;
  onStart: () => void;
  startPending: boolean;
  startError: string | null;
  persistenceWarning?: string | null;
  onShowPlaybook: () => void;
  onShowTakkenGlossary: () => void;
  onShowAisGlossary: () => void;
  onShowHistory: () => void;
  aborted: boolean;
};

const MODES: ReadonlyArray<{
  id: TrainingSet;
  index: string;
  category: string;
  label: string;
  detail: string;
}> = [
  { id: "japanese", index: "01", category: "BASIC", label: "日本語", detail: "基礎と日常語" },
  { id: "consulting", index: "02", category: "WORK", label: "コンサル", detail: "実務用語" },
  { id: "takken", index: "03", category: "LICENSE", label: "宅建", detail: "試験用語" },
  { id: "ais", index: "04", category: "MEETING", label: "会議", detail: "定例会議用語" },
  { id: "git", index: "05", category: "DEV", label: "Git", detail: "公式コマンド" },
  { id: "tokyo", index: "06", category: "TOKYO", label: "東京地名", detail: "7,254件・読み補完あり" },
];

const MODE_LABELS: Record<TrainingSet, string> = {
  japanese: "日本語",
  consulting: "コンサル用語",
  takken: "宅建用語",
  ais: "会議用語",
  git: "Gitコマンド",
  tokyo: "東京地名",
};

export function HomeScreen({
  best,
  history,
  selectedMode,
  onSelectMode,
  onStart,
  startPending,
  startError,
  persistenceWarning,
  onShowPlaybook,
  onShowTakkenGlossary,
  onShowAisGlossary,
  onShowHistory,
  aborted,
}: HomeScreenProps) {
  const latest = history.find((session) => session.metricsAvailable !== false);
  const selectedModeDetail = MODES.find((mode) => mode.id === selectedMode)?.detail ?? "";

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
              <h2 id="mode-title">今日は、何を鍛える？</h2>
            </div>
            <span>6 MODES / 60 SEC</span>
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
                  disabled={startPending}
                  onChange={() => onSelectMode(mode.id)}
                />
                <span className="mode-option__meta" aria-hidden="true">
                  <b>{mode.index}</b>
                  <i>{mode.category}</i>
                </span>
                <span className="mode-option__label">{mode.label}</span>
                <small>{mode.detail}</small>
                <span className="mode-option__state" aria-hidden="true">
                  {selectedMode === mode.id ? "選択中" : ""}
                </span>
                {selectedMode === mode.id ? (
                  <span className="mode-option__check" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </label>
            ))}
          </fieldset>
          <div className="start-row">
            <div className="mode-selection-summary">
              <span>SELECTED MODE</span>
              <strong>{MODE_LABELS[selectedMode]}</strong>
              <small>{selectedModeDetail} · 記録は端末内に保存</small>
            </div>
            <button className="primary-button start-button" type="button" onClick={onStart} disabled={startPending}>
              <span>{startPending ? "地名データを読み込んでいます…" : "60秒トレーニングを始める"}</span>
              <kbd>Enter</kbd>
            </button>
          </div>
          <span className="mode-loading-status" role="status">
            {startPending ? "地名データを読み込んでいます" : ""}
          </span>
          {startError ? (
            <p className="notice" role="alert">
              {startError}
            </p>
          ) : null}
          {persistenceWarning ? (
            <p className="notice" role="alert">
              {persistenceWarning}
            </p>
          ) : null}
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
                <strong>{best?.metricsAvailable === false ? "—" : (best?.metrics.wpm ?? "—")}</strong>
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
