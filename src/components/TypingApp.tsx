"use client";

import { useState } from "react";
import type { CompletedSession } from "../application/session/session-types.ts";
import { useKeyboardInput } from "../hooks/useKeyboardInput.ts";
import { useTypingSession } from "../hooks/useTypingSession.ts";
import { AppHeader } from "./shared/AppHeader.tsx";
import { HomeScreen } from "./home/HomeScreen.tsx";
import { CountdownScreen } from "./game/CountdownScreen.tsx";
import { GameScreen } from "./game/GameScreen.tsx";
import { PauseDialog } from "./game/PauseDialog.tsx";
import { ResultScreen } from "./result/ResultScreen.tsx";
import { HistoryScreen } from "./history/HistoryScreen.tsx";

export function TypingApp() {
  const session = useTypingSession();
  const [showHistory, setShowHistory] = useState(false);
  const [previousBest, setPreviousBest] = useState<CompletedSession | null>(null);

  const start = () => {
    setPreviousBest(session.best);
    setShowHistory(false);
    session.start();
  };

  useKeyboardInput({
    onKey: session.typeKey,
    onEnter: () => {
      if (showHistory) { setShowHistory(false); return; }
      if (["idle", "finished", "aborted"].includes(session.clock.status)) start();
      else session.enter();
    },
    onEscape: () => {
      if (showHistory) setShowHistory(false);
      else session.escape();
    },
  });

  const active = ["countdown", "playing", "paused"].includes(session.clock.status);
  return (
    <div className={`app-frame state-${session.clock.status}`}>
      <AppHeader
        compact={active}
        soundEnabled={session.settings.soundEnabled}
        onToggleSound={session.toggleSound}
        onShowHome={active ? undefined : () => { setShowHistory(false); session.home(); }}
      />

      {showHistory ? (
        <HistoryScreen sessions={session.history} onBack={() => setShowHistory(false)} />
      ) : session.clock.status === "countdown" ? (
        <CountdownScreen value={session.countdown} />
      ) : session.clock.status === "playing" || session.clock.status === "paused" ? (
        <>
          <GameScreen
            prompt={session.prompt}
            guide={session.guide}
            remainingMs={session.clock.remainingMs}
            combo={session.combo}
            completedPrompts={session.completedPrompts}
            misses={session.misses}
            metrics={session.liveMetrics}
            feedback={session.feedback}
            onPause={session.pause}
          />
          {session.clock.status === "paused" && <PauseDialog onResume={session.resume} onAbort={session.abort} />}
        </>
      ) : session.clock.status === "finished" && session.result ? (
        <ResultScreen
          result={session.result}
          previousBest={previousBest}
          onRetry={start}
          onHistory={() => setShowHistory(true)}
          onHome={() => { setShowHistory(false); session.home(); }}
        />
      ) : (
        <HomeScreen
          best={session.best}
          history={session.history}
          onStart={start}
          onShowHistory={() => setShowHistory(true)}
          aborted={session.clock.status === "aborted"}
        />
      )}
      <footer className="site-footer"><span>TYPELOOP / 60 SEC TRAINING</span><span>LOCAL FIRST · NO ACCOUNT</span></footer>
    </div>
  );
}
