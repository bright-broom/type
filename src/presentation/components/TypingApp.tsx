"use client";

import { lazy, Suspense, useState } from "react";
import type { CompletedSession, TrainingSet } from "../../application/session/session-types.ts";
import { useKeyboardInput } from "../hooks/useKeyboardInput.ts";
import { useTypingSession } from "../hooks/useTypingSession.ts";
import { AppHeader } from "./AppHeader.tsx";
import { HomeScreen } from "./home/HomeScreen.tsx";
import { CountdownScreen } from "./game/CountdownScreen.tsx";
import { GameScreen } from "./game/GameScreen.tsx";
import { PauseDialog } from "./game/PauseDialog.tsx";
import { ResultScreen } from "./result/ResultScreen.tsx";
import { HistoryScreen } from "./history/HistoryScreen.tsx";

const ConsultingPlaybook = lazy(() =>
  import("./consulting/ConsultingPlaybook.tsx").then((module) => ({ default: module.ConsultingPlaybook })),
);
const TakkenGlossary = lazy(() =>
  import("./takken/TakkenGlossary.tsx").then((module) => ({ default: module.TakkenGlossary })),
);

export function TypingApp() {
  const session = useTypingSession();
  const [showHistory, setShowHistory] = useState(false);
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [showTakkenGlossary, setShowTakkenGlossary] = useState(false);
  const [previousBest, setPreviousBest] = useState<CompletedSession | null>(null);

  const start = (trainingSet: TrainingSet = "japanese") => {
    setPreviousBest(session.bests[trainingSet]);
    setShowHistory(false);
    setShowPlaybook(false);
    setShowTakkenGlossary(false);
    session.start(trainingSet);
  };

  useKeyboardInput({
    onKey: session.typeText,
    onEnter: () => {
      if (showHistory || showPlaybook || showTakkenGlossary) {
        setShowHistory(false);
        setShowPlaybook(false);
        setShowTakkenGlossary(false);
        return;
      }
      if (["idle", "finished", "aborted"].includes(session.clock.status)) start(session.trainingSet);
      else session.enter();
    },
    onEscape: () => {
      if (showHistory || showPlaybook || showTakkenGlossary) {
        setShowHistory(false);
        setShowPlaybook(false);
        setShowTakkenGlossary(false);
      } else session.escape();
    },
  });

  const active = ["countdown", "playing", "paused"].includes(session.clock.status);
  return (
    <div className={`app-frame state-${session.clock.status}`}>
      <AppHeader
        compact={active}
        soundEnabled={session.settings.soundEnabled}
        onToggleSound={session.toggleSound}
        onShowHome={
          active
            ? undefined
            : () => {
                setShowHistory(false);
                setShowPlaybook(false);
                setShowTakkenGlossary(false);
                session.home();
              }
        }
      />

      {showTakkenGlossary ? (
        <Suspense
          fallback={
            <main className="playbook-loading" role="status">
              宅建用語集を読み込んでいます…
            </main>
          }
        >
          <TakkenGlossary onBack={() => setShowTakkenGlossary(false)} onStart={() => start("takken")} />
        </Suspense>
      ) : showPlaybook ? (
        <Suspense
          fallback={
            <main className="playbook-loading" role="status">
              実務辞典を読み込んでいます…
            </main>
          }
        >
          <ConsultingPlaybook onBack={() => setShowPlaybook(false)} onStart={() => start("consulting")} />
        </Suspense>
      ) : showHistory ? (
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
            onTypeText={session.typeText}
          />
          {session.clock.status === "paused" && <PauseDialog onResume={session.resume} onAbort={session.abort} />}
        </>
      ) : session.clock.status === "finished" && session.result ? (
        <ResultScreen
          result={session.result}
          previousBest={previousBest}
          onRetry={() => start(session.trainingSet)}
          onHistory={() => setShowHistory(true)}
          onHome={() => {
            setShowHistory(false);
            session.home();
          }}
        />
      ) : (
        <HomeScreen
          best={session.bests.japanese}
          history={session.history}
          onStart={() => start()}
          onStartConsulting={() => start("consulting")}
          onStartTakken={() => start("takken")}
          onShowPlaybook={() => setShowPlaybook(true)}
          onShowTakkenGlossary={() => setShowTakkenGlossary(true)}
          onShowHistory={() => setShowHistory(true)}
          aborted={session.clock.status === "aborted"}
        />
      )}
      <footer className="site-footer">
        <span>TYPELOOP / 60 SEC TRAINING</span>
        <span>LOCAL FIRST · NO ACCOUNT</span>
      </footer>
    </div>
  );
}
