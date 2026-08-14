type AppHeaderProps = {
  soundEnabled: boolean;
  onToggleSound: () => void;
  onShowHome?: () => void;
  compact?: boolean;
};

export function AppHeader({ soundEnabled, onToggleSound, onShowHome, compact = false }: AppHeaderProps) {
  return (
    <header className={`app-header ${compact ? "app-header--compact" : ""}`}>
      <button className="brand" type="button" onClick={onShowHome} disabled={!onShowHome} aria-label="TypeLoop ホーム">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>TypeLoop</span>
      </button>
      <button className="icon-button" type="button" onClick={onToggleSound} aria-pressed={soundEnabled}>
        <span aria-hidden="true">{soundEnabled ? "♪" : "×"}</span>
        <span>{soundEnabled ? "サウンド ON" : "サウンド OFF"}</span>
      </button>
    </header>
  );
}
