"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { saveSessionArchive } from "../../application/session/session-archive.ts";
import type { CompletedSession } from "../../application/session/session-types.ts";
import type { TrainingSet } from "../../domain/prompts/prompt-types.ts";
import { BrowserSessionArchiveSink } from "../../infrastructure/persistence/browser-session-archive-sink.ts";
import { LocalSessionRepository } from "../../infrastructure/persistence/local-session-repository.ts";
import type { AppearanceSettings } from "../../application/settings/app-settings.ts";
import {
  readAppearanceCookie,
  writeAppearanceCookie,
} from "../../infrastructure/persistence/browser-appearance-cookie.ts";
import { useKeyboardInput } from "../hooks/useKeyboardInput.ts";
import { useKeyboardInset } from "../hooks/useKeyboardInset.ts";
import { useTypingSession } from "../hooks/useTypingSession.ts";
import { useAppearance } from "../hooks/useAppearance.ts";
import { type AppOverlay, useAppRoute } from "../hooks/useAppRoute.ts";
import { useBrowserSnapshot } from "../hooks/useBrowserSnapshot.ts";
import { AppHeader } from "./AppHeader.tsx";
import { HomeScreen } from "./home/HomeScreen.tsx";
import { CountdownScreen } from "./game/CountdownScreen.tsx";
import { GameScreen } from "./game/GameScreen.tsx";
import { PauseDialog } from "./game/PauseDialog.tsx";
import { TypingInput } from "./game/TypingInput.tsx";
import { ResultScreen } from "./result/ResultScreen.tsx";
import { PageShell } from "./layout/PageShell.tsx";
import { ReferenceOverlay } from "./reference/ReferenceOverlay.tsx";

type FocusReturn = { key: string | null; fallback: "home" | "result" };

export function TypingApp({ initialOverlay = "none" }: { initialOverlay?: AppOverlay }) {
  const session = useTypingSession();
  const focusReturnRef = useRef<FocusReturn | null>(null);
  const onRoutePopState = useCallback(
    (next: AppOverlay, returnFocusKey: string | null) => {
      if (next !== "none") {
        focusReturnRef.current = null;
        return;
      }
      focusReturnRef.current = {
        key: returnFocusKey,
        fallback: session.clock.status === "finished" ? "result" : "home",
      };
    },
    [session.clock.status],
  );
  const appearanceCookie = useBrowserSnapshot(() => document.cookie, "");
  const browserReady = useBrowserSnapshot(() => true, false);
  const restoredAppearance = useMemo(() => readAppearanceCookie(appearanceCookie), [appearanceCookie]);
  const [appearanceOverride, setAppearanceOverride] = useState<AppearanceSettings | null>(null);
  const appearance = appearanceOverride ?? restoredAppearance;
  useAppearance(appearance, browserReady);

  /** Persist where the parser-blocking bootstrap can read it before application paint. */
  const updateAppearance = useCallback((next: AppearanceSettings) => {
    setAppearanceOverride(next);
    writeAppearanceCookie(next);
  }, []);
  const { overlay, navigate, close } = useAppRoute(initialOverlay, onRoutePopState);
  const routeTrainingSet = useBrowserSnapshot<TrainingSet>(
    () => (new URLSearchParams(window.location.search).get("training") === "takken" ? "takken" : "japanese"),
    "japanese",
  );
  const [trainingSetOverride, setSelectedTrainingSet] = useState<TrainingSet | null>(null);
  const selectedTrainingSet = trainingSetOverride ?? routeTrainingSet;
  const [previousBest, setPreviousBest] = useState<CompletedSession | null>(null);
  const typingFieldRef = useRef<HTMLInputElement>(null);
  useKeyboardInset();

  const navigateOverlay = useCallback(
    (next: AppOverlay, mode: "push" | "replace" = "push", returnFocusKey?: string) => {
      if (next !== "none") {
        const trigger =
          document.activeElement instanceof HTMLElement
            ? document.activeElement.closest<HTMLElement>("[data-focus-key]")
            : null;
        focusReturnRef.current = {
          key: returnFocusKey ?? trigger?.dataset.focusKey ?? null,
          fallback: session.clock.status === "finished" ? "result" : "home",
        };
      }
      window.scrollTo(0, 0);
      navigate(next, mode, focusReturnRef.current?.key ?? null);
    },
    [navigate, session.clock.status],
  );

  const closeOverlay = useCallback(() => {
    focusReturnRef.current ??= {
      key: null,
      fallback: session.clock.status === "finished" ? "result" : "home",
    };
    window.scrollTo(0, 0);
    close();
  }, [close, session.clock.status]);

  useEffect(() => {
    if (overlay === "none") {
      const focusReturn = focusReturnRef.current;
      if (!focusReturn) return;
      let focusFrame = 0;
      const renderFrame = window.requestAnimationFrame(() => {
        focusFrame = window.requestAnimationFrame(() => {
          const trigger = focusReturn.key
            ? document.querySelector<HTMLElement>(`[data-focus-key="${focusReturn.key}"]`)
            : null;
          trigger?.focus({ preventScroll: true });
          if (document.activeElement !== trigger) {
            document.querySelector<HTMLElement>(`[data-${focusReturn.fallback}-root]`)?.focus({ preventScroll: true });
          }
          focusReturnRef.current = null;
        });
      });
      return () => {
        window.cancelAnimationFrame(renderFrame);
        window.cancelAnimationFrame(focusFrame);
      };
    }
    const focusOverlay = () => {
      const root = document.querySelector<HTMLElement>("[data-overlay-root]");
      root?.focus({ preventScroll: true });
      return Boolean(root);
    };
    if (focusOverlay()) return;
    const observer = new MutationObserver(() => {
      if (focusOverlay()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [overlay]);

  useEffect(() => {
    if (session.clock.status === "finished") {
      document.querySelector<HTMLElement>("[data-result-root]")?.focus({ preventScroll: true });
    }
  }, [session.clock.status, session.result]);

  /**
   * A software keyboard only opens while a user gesture is still being handled, so
   * the field is focused synchronously from the tap that starts or resumes play.
   * The field is mounted for the whole app lifetime for the same reason: focusing
   * an element that React has not created yet would land outside the gesture.
   */
  const focusTypingField = useCallback(() => typingFieldRef.current?.focus(), []);

  const start = (trainingSet: TrainingSet = "japanese") => {
    focusTypingField();
    focusReturnRef.current = null;
    setSelectedTrainingSet(trainingSet);
    setPreviousBest(session.bests[trainingSet]);
    navigateOverlay("none", "replace");
    session.start(trainingSet);
  };

  const resume = () => {
    focusTypingField();
    session.resume();
  };

  const goHome = () => {
    typingFieldRef.current?.blur();
    navigateOverlay("none", "replace");
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
      if (overlay === "playbook") start("consulting");
      else if (overlay === "takken") start("takken");
      else if (overlay === "ais") start("ais");
      else if (overlay !== "none") {
        closeOverlay();
      } else if (session.clock.status === "idle" || session.clock.status === "aborted") start(selectedTrainingSet);
      else if (session.clock.status === "finished") start(session.trainingSet);
      else if (session.clock.status === "paused") resume();
      else session.enter();
    },
    onEscape: () => {
      if (overlay !== "none") closeOverlay();
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
        showQuickStartShortcut={
          !active && overlay === "none" && (session.clock.status === "idle" || session.clock.status === "aborted")
        }
        onShowHistory={
          !active && overlay !== "history" && session.history.length > 0
            ? () => navigateOverlay("history", "push", "header-history")
            : undefined
        }
        onShowSettings={
          !active && overlay !== "settings" ? () => navigateOverlay("settings", "push", "header-settings") : undefined
        }
      />

      {overlay !== "none" ? (
        <Suspense
          fallback={
            <PageShell width="wide" spacing="none" centered className="playbook-loading" role="status">
              参照画面を読み込んでいます…
            </PageShell>
          }
        >
          <ReferenceOverlay
            overlay={overlay}
            appearance={appearance}
            appearanceReady={browserReady}
            sessions={session.history}
            onAppearanceChange={updateAppearance}
            onBack={closeOverlay}
            onSave={saveHistory}
            onStart={start}
          />
        </Suspense>
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
          onHistory={() => navigateOverlay("history", "push", "result-history")}
          onHome={goHome}
        />
      ) : (
        <HomeScreen
          best={session.bests.japanese}
          history={session.history}
          selectedMode={selectedTrainingSet}
          onSelectMode={setSelectedTrainingSet}
          onStart={() => start(selectedTrainingSet)}
          onShowPlaybook={() => navigateOverlay("playbook", "push", "home-playbook")}
          onShowTakkenGlossary={() => navigateOverlay("takken", "push", "home-takken")}
          onShowAisGlossary={() => navigateOverlay("ais", "push", "home-ais")}
          onShowHistory={() => navigateOverlay("history", "push", "home-history")}
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
