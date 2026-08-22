"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppRoute } from "./useAppRoute.ts";
import type { AppOverlay } from "./reference-route.ts";

type FocusFallback = "home" | "result";
type FocusReturn = { key: string | null; fallback: FocusFallback };

function focusKeyFromActiveElement(): string | null {
  if (!(document.activeElement instanceof HTMLElement)) return null;
  return document.activeElement.closest<HTMLElement>("[data-focus-key]")?.dataset.focusKey ?? null;
}

function focusElementForKey(key: string): HTMLElement | null {
  return (
    [...document.querySelectorAll<HTMLElement>("[data-focus-key]")].find(
      (element) => element.dataset.focusKey === key,
    ) ?? null
  );
}

export function useReferenceSurface(initialOverlay: AppOverlay, fallback: FocusFallback) {
  const focusReturnRef = useRef<FocusReturn | null>(null);
  const onRoutePopState = useCallback(
    (next: AppOverlay, returnFocusKey: string | null) => {
      focusReturnRef.current =
        next === "none"
          ? {
              key: returnFocusKey,
              fallback,
            }
          : null;
    },
    [fallback],
  );
  const { overlay, navigate, close } = useAppRoute(initialOverlay, onRoutePopState);

  const navigateSurface = useCallback(
    (next: AppOverlay, mode: "push" | "replace" = "push", returnFocusKey?: string) => {
      if (next !== "none") {
        focusReturnRef.current = {
          key: returnFocusKey ?? focusKeyFromActiveElement(),
          fallback,
        };
      }
      window.scrollTo(0, 0);
      navigate(next, mode, focusReturnRef.current?.key ?? null);
    },
    [fallback, navigate],
  );

  const closeSurface = useCallback(() => {
    focusReturnRef.current ??= { key: null, fallback };
    window.scrollTo(0, 0);
    close();
  }, [close, fallback]);

  const clearReturnFocus = useCallback(() => {
    focusReturnRef.current = null;
  }, []);

  useEffect(() => {
    if (overlay === "none") {
      const focusReturn = focusReturnRef.current;
      if (!focusReturn) return;
      let focusFrame = 0;
      const renderFrame = window.requestAnimationFrame(() => {
        focusFrame = window.requestAnimationFrame(() => {
          const trigger = focusReturn.key ? focusElementForKey(focusReturn.key) : null;
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

  return { overlay, navigateSurface, closeSurface, clearReturnFocus } as const;
}
