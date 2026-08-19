import styles from "./AppHeader.module.css";

type AppHeaderProps = {
  soundEnabled: boolean;
  onToggleSound: () => void;
  onShowHome?: () => void;
  onShowHistory?: () => void;
  onShowSettings?: () => void;
  showQuickStartShortcut?: boolean;
  compact?: boolean;
};

export function AppHeader({
  soundEnabled,
  onToggleSound,
  onShowHome,
  onShowHistory,
  onShowSettings,
  showQuickStartShortcut = false,
  compact = false,
}: AppHeaderProps) {
  const focusQuickStart = () => document.querySelector<HTMLElement>("#quick-start")?.focus();

  return (
    <header className={`app-header ${compact ? "app-header--compact" : ""}`}>
      {showQuickStartShortcut ? (
        <button className={styles.skipControl} type="button" onClick={focusQuickStart}>
          練習モードへ移動
        </button>
      ) : null}
      <button className="brand" type="button" onClick={onShowHome} disabled={!onShowHome} aria-label="TypeLoop ホーム">
        <span className="brand-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>TypeLoop</span>
      </button>
      <div className="header-actions">
        {onShowHistory ? (
          <button className="header-link" type="button" data-focus-key="header-history" onClick={onShowHistory}>
            記録
          </button>
        ) : null}
        {onShowSettings ? (
          <button className="header-link" type="button" data-focus-key="header-settings" onClick={onShowSettings}>
            表示設定
          </button>
        ) : null}
        <button
          className="icon-button"
          type="button"
          onClick={onToggleSound}
          aria-pressed={soundEnabled}
          // The text label is hidden on small screens, leaving only the icon.
          aria-label={soundEnabled ? "サウンド ON" : "サウンド OFF"}
        >
          <span aria-hidden="true">{soundEnabled ? "♪" : "×"}</span>
          <span>{soundEnabled ? "サウンド ON" : "サウンド OFF"}</span>
        </button>
      </div>
    </header>
  );
}
