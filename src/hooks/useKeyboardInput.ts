"use client";

import { useEffect, useRef } from "react";

type KeyboardInputOptions = {
  onKey: (key: string) => void;
  onEnter: () => void;
  onEscape: () => void;
};

const IGNORED_KEYS = new Set([
  "Meta", "Control", "Alt", "Shift", "CapsLock", "Tab", "Backspace",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
]);

export function useKeyboardInput(options: KeyboardInputOptions) {
  const handlers = useRef(options);

  useEffect(() => {
    handlers.current = options;
  }, [options]);

  useEffect(() => {
    let composing = false;
    const startComposition = () => { composing = true; };
    const endComposition = () => { composing = false; };
    const onKeyDown = (event: KeyboardEvent) => {
      if (composing || event.isComposing || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Enter") { event.preventDefault(); handlers.current.onEnter(); return; }
      if (event.key === "Escape") { event.preventDefault(); handlers.current.onEscape(); return; }
      if (IGNORED_KEYS.has(event.key) || event.key.startsWith("F") || event.key.length !== 1) return;
      if (/^[a-z0-9 ' -]$/i.test(event.key)) {
        event.preventDefault();
        handlers.current.onKey(event.key.toLowerCase());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("compositionstart", startComposition);
    window.addEventListener("compositionend", endComposition);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("compositionstart", startComposition);
      window.removeEventListener("compositionend", endComposition);
    };
  }, []);
}
