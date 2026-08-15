import { useEffect, useRef } from "react";

type PauseDialogProps = { onResume: () => void; onAbort: () => void };

export function PauseDialog({ onResume, onAbort }: PauseDialogProps) {
  const resumeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    resumeButton.current?.focus();
  }, []);
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="pause-dialog" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <span className="dialog-kicker">SESSION PAUSED</span>
        <h2 id="pause-title">ひと休み。</h2>
        <p>タイマーは止まっています。呼吸を整えたら再開しましょう。</p>
        <button ref={resumeButton} className="primary-button" type="button" onClick={onResume}>
          <span>トレーニングを再開</span>
          <kbd>Enter</kbd>
        </button>
        <button className="text-button danger-text" type="button" onClick={onAbort}>
          セッションを終了
        </button>
      </section>
    </div>
  );
}
