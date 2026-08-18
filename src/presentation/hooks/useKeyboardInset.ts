"use client";

import { useEffect } from "react";
import { isKeyboardOpen, keyboardInsetFrom } from "./keyboard-inset.ts";

/**
 * Publish software-keyboard geometry to CSS.
 *
 * iOS Safari does not reflow `position: fixed` content for the keyboard, and no
 * media query reports it, so the only reliable source is `visualViewport`. The
 * measurements are exposed as `--keyboard-inset` and `data-keyboard` on the root
 * element, keeping the reaction to them in the stylesheet.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    const apply = () => {
      const geometry = {
        layoutHeight: window.innerHeight,
        visualHeight: viewport.height,
        offsetTop: viewport.offsetTop,
      };
      root.style.setProperty("--keyboard-inset", `${keyboardInsetFrom(geometry)}px`);
      root.dataset.keyboard = isKeyboardOpen(geometry) ? "open" : "closed";
    };

    apply();
    viewport.addEventListener("resize", apply);
    viewport.addEventListener("scroll", apply);
    return () => {
      viewport.removeEventListener("resize", apply);
      viewport.removeEventListener("scroll", apply);
      root.style.removeProperty("--keyboard-inset");
      delete root.dataset.keyboard;
    };
  }, []);
}
