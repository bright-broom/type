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
const AisGlossary = lazy(() => import("./ais/AisGlossary.tsx").then((module) => ({ default: module.AisGlossary })));

/** Reference screens layered over the session flow. Only one is ever open. */
type Overlay = "none" | "history" | "playbook" | "takken" | "ais";

const RESTARTABLE = ["idle", "finished", "aborted"];

export function TypingApp() {
  const session = useTypingSession();
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [previousBest, setPreviousBest] = useState<CompletedSession | null>(null);

  const start = (trainingSet: TrainingSet = "japanese") => {
    setPreviousBest(session.bests[trainingSet]);
    setOverlay("none");
    session.start(trainingSet);
  };

  const goHome = () => {
    setOverlay("none");
    session.home();
  };

  useKeyboardInput({
    onKey: session.typeText,
    onEnter: () => {
      if (overlay !== "none") {
        setOverlay("none");
        return;
      }
      if (RESTARTABLE.includes(session.clock.status)) start(session.trainingSet);
      else session.enter();
    },
    onEscape: () => {
      if (overlay !== "none") setOverlay("none");
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
        onShowHome={active ? undefined : goHome}
      />

      {overlay === "ais" ? (
        <Suspense
          fallback={
            <main className="playbook-loading" role="status">
              AIS会議用語辞典を読み込んでいます…
            </main>
          }
        >
          <AisGlossary onBack={() => setOverlay("none")} onStart={() => start("ais")} />
        </Suspense>
      ) : overlay === "takken" ? (
        <Suspense
          fallback={
            <main className="playbook-loading" role="status">
              宅建用語集を読み込んでいます…
            </main>
          }
        >
          <TakkenGlossary onBack={() => setOverlay("none")} onStart={() => start("takken")} />
        </Suspense>
      ) : overlay === "playbook" ? (
        <Suspense
          fallback={
            <main className="playbook-loading" role="status">
              実務辞典を読み込んでいます…
            </main>
          }
        >
          <ConsultingPlaybook onBack={() => setOverlay("none")} onStart={() => start("consulting")} />
        </Suspense>
      ) : overlay === "history" ? (
        <HistoryScreen sessions={session.history} onBack={() => setOverlay("none")} />
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
          onHistory={() => setOverlay("history")}
          onHome={goHome}
        />
      ) : (
        <HomeScreen
          best={session.bests.japanese}
          history={session.history}
          onStart={() => start()}
          onStartConsulting={() => start("consulting")}
          onStartTakken={() => start("takken")}
          onStartAis={() => start("ais")}
          onShowPlaybook={() => setOverlay("playbook")}
          onShowTakkenGlossary={() => setOverlay("takken")}
          onShowAisGlossary={() => setOverlay("ais")}
          onShowHistory={() => setOverlay("history")}
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
