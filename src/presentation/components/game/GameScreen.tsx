import type { TypingPrompt } from "../../../domain/prompts/prompt-types.ts";
import type { TypingGuide } from "../../../domain/typing/typing-types.ts";
import type { SessionMetrics } from "../../../domain/scoring/metrics.ts";
import { TypingInput } from "./TypingInput.tsx";

type GameScreenProps = {
  prompt: TypingPrompt;
  guide: TypingGuide;
  remainingMs: number;
  combo: number;
  completedPrompts: number;
  misses: number;
  metrics: SessionMetrics;
  feedback: "correct" | "miss" | "complete" | null;
  onPause: () => void;
  onTypeText: (text: string) => void;
};

export function GameScreen(props: GameScreenProps) {
  const seconds = Math.max(0, Math.ceil(props.remainingMs / 1_000));
  const progress = Math.max(0, Math.min(100, (props.remainingMs / 60_000) * 100));
  const promptLabel = props.prompt.category === "consulting" ? "CONSULTING TERM" : props.prompt.reading;
  return (
    <main className={`game-shell feedback-${props.feedback ?? "none"}`}>
      <div className="game-meta">
        <div className="timer-block">
          <span className="meta-label">TIME</span>
          <strong>
            {String(seconds).padStart(2, "0")}
            <small>.{String(Math.floor((props.remainingMs % 1_000) / 100)).padStart(1, "0")}</small>
          </strong>
        </div>
        <div className="game-progress" aria-label={`残り${seconds}秒`}>
          <i style={{ width: `${progress}%` }} />
        </div>
        <button className="pause-button" type="button" onClick={props.onPause}>
          <kbd>Esc</kbd> 一時停止
        </button>
      </div>

      <section className="prompt-stage" aria-labelledby="current-prompt">
        <div className="prompt-index">
          <span>{String(props.completedPrompts + 1).padStart(2, "0")}</span> / SESSION
        </div>
        <p className="prompt-reading">{promptLabel}</p>
        <h1 id="current-prompt">{props.prompt.displayText}</h1>
        {props.prompt.description && <p className="prompt-description">{props.prompt.description}</p>}
        <div className="roman-line" aria-label={`入力: ${props.guide.full}`}>
          <span className="roman-typed">{props.guide.typed}</span>
          <span className="roman-caret" aria-hidden="true" />
          <span className="roman-remaining">{props.guide.remaining}</span>
        </div>
        <div className="feedback-line" aria-live="polite">
          {props.feedback === "miss"
            ? "MISS — 正しいキーで続けよう"
            : props.combo >= 10
              ? `${props.combo} COMBO`
              : props.prompt.category === "consulting"
                ? "英字で入力"
                : "ローマ字で入力"}
        </div>
      </section>

      <TypingInput onText={props.onTypeText} />

      <div className="live-stats" aria-label="現在の成績">
        <div>
          <span>WPM</span>
          <strong>{Math.round(props.metrics.wpm)}</strong>
        </div>
        <div>
          <span>精度</span>
          <strong>
            {props.metrics.accuracy.toFixed(1)}
            <small>%</small>
          </strong>
        </div>
        <div>
          <span>ミス</span>
          <strong>{props.misses}</strong>
        </div>
        <div className="combo-stat">
          <span>COMBO</span>
          <strong>{props.combo}</strong>
        </div>
      </div>
    </main>
  );
}
