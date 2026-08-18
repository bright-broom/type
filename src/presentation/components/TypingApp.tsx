"use client";

import { lazy, Suspense, useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { saveSessionArchive } from "../../application/session/session-archive.ts";
import type { CompletedSession } from "../../application/session/session-types.ts";
import type { TrainingSet } from "../../domain/prompts/prompt-types.ts";
import { BrowserSessionArchiveSink } from "../../infrastructure/persistence/browser-session-archive-sink.ts";
import { LocalSessionRepository } from "../../infrastructure/persistence/local-session-repository.ts";
import { useKeyboardInput } from "../hooks/useKeyboardInput.ts";
import { useKeyboardInset } from "../hooks/useKeyboardInset.ts";
import { useTypingSession } from "../hooks/useTypingSession.ts";
import { AppHeader } from "./AppHeader.tsx";
import { HomeScreen } from "./home/HomeScreen.tsx";
import { CountdownScreen } from "./game/CountdownScreen.tsx";
import { GameScreen } from "./game/GameScreen.tsx";
import { PauseDialog } from "./game/PauseDialog.tsx";
import { TypingInput } from "./game/TypingInput.tsx";
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
  const typingFieldRef = useRef<HTMLInputElement>(null);
  useKeyboardInset();

  /**
   * A software keyboard only opens while a user gesture is still being handled, so
   * the field is focused synchronously from the tap that starts or resumes play.
   * The field is mounted for the whole app lifetime for the same reason: focusing
   * an element that React has not created yet would land outside the gesture.
   */
  const focusTypingField = useCallback(() => typingFieldRef.current?.focus(), []);

  const start = (trainingSet: TrainingSet = "japanese") => {
    focusTypingField();
    setPreviousBest(session.bests[trainingSet]);
    setOverlay("none");
    session.start(trainingSet);
  };

  const resume = () => {
    focusTypingField();
    session.resume();
  };

  const goHome = () => {
    typingFieldRef.current?.blur();
    setOverlay("none");
    session.home();
  };

  const saveHistory = useCallback(async () => {
    try {
      await saveSessionArchive(new LocalSessionRepository(), new BrowserSessionArchiveSink(), Date.now());
      return true;
    } catch {
      return false;
    }
  }, []);

  /**
   * Recovery path: tapping the play area re-opens a dismissed software keyboard.
   * The default pointer-down action moves focus to the tapped element, which would
   * undo this, so it is suppressed for taps that hit no control of their own.
   */
  const onFramePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (session.clock.status !== "playing") return;
    // `.prompt-description` scrolls, so leave its drag gestures alone.
    const OWN_GESTURE = "button, a, input, select, textarea, .prompt-description";
    if (event.target instanceof Element && event.target.closest(OWN_GESTURE)) return;
    event.preventDefault();
    focusTypingField();
  };

  useKeyboardInput({
    onKey: session.typeText,
    onEnter: () => {
      if (overlay !== "none") {
        setOverlay("none");
        return;
      }
      if (RESTARTABLE.includes(session.clock.status)) start(session.trainingSet);
      else if (session.clock.status === "paused") resume();
      else session.enter();
    },
    onEscape: () => {
      if (overlay !== "none") setOverlay("none");
      else if (session.clock.status === "paused") resume();
      else session.escape();
    },
  });

  const active = ["countdown", "playing", "paused"].includes(session.clock.status);
  return (
    <div className={`app-frame state-${session.clock.status}`} onPointerDown={onFramePointerDown}>
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
        <HistoryScreen sessions={session.history} onBack={() => setOverlay("none")} onSave={saveHistory} />
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
          {session.clock.status === "paused" && <PauseDialog onResume={resume} onAbort={session.abort} />}
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
      <TypingInput inputRef={typingFieldRef} active={active} onText={session.typeText} />

      <footer className="site-footer">
        <span>TYPELOOP / 60 SEC TRAINING</span>
        <span>LOCAL FIRST · NO ACCOUNT</span>
      </footer>
    </div>
  );
}
