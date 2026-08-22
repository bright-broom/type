"use client";

import { useCallback, useEffect, useState } from "react";
import {
  OVERLAY_PATH,
  overlayFromPathname,
  returnFocusKeyFromState,
  type AppOverlay,
  type ReferenceRouteState,
} from "./reference-route.ts";

export type { AppOverlay } from "./reference-route.ts";

function currentRouteState(): ReferenceRouteState {
  return typeof window.history.state === "object" && window.history.state !== null ? window.history.state : {};
}

export function useAppRoute(
  initialOverlay: AppOverlay,
  onPopState?: (overlay: AppOverlay, returnFocusKey: string | null) => void,
) {
  const [overlay, setOverlay] = useState(initialOverlay);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const next = overlayFromPathname(window.location.pathname);
      onPopState?.(next, returnFocusKeyFromState(event.state));
      setOverlay(next);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [onPopState]);

  const navigate = useCallback(
    (next: AppOverlay, mode: "push" | "replace" = "push", returnFocusKey: string | null = null) => {
      if (mode === "push" && next !== "none" && returnFocusKey) {
        window.history.replaceState(
          { ...currentRouteState(), typeloopReturnFocusKey: returnFocusKey },
          "",
          window.location.href,
        );
      }
      const method = mode === "replace" ? "replaceState" : "pushState";
      window.history[method]({ ...currentRouteState(), typeloopOverlay: next }, "", OVERLAY_PATH[next]);
      setOverlay(next);
    },
    [],
  );

  const close = useCallback(() => {
    if ((window.history.state as ReferenceRouteState | null)?.typeloopOverlay) {
      window.history.back();
    } else {
      window.history.replaceState({ ...currentRouteState(), typeloopOverlay: "none" }, "", OVERLAY_PATH.none);
      setOverlay("none");
    }
  }, []);

  return { overlay, navigate, close } as const;
}
