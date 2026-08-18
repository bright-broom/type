"use client";

import { useEffect, useRef } from "react";
import { TYPABLE_CHARACTER } from "../../domain/typing/typed-text.ts";

type KeyboardInputOptions = {
  onKey: (key: string) => void;
  onEnter: () => void;
  onEscape: () => void;
};

const IGNORED_KEYS = new Set([
  "Meta",
  "Control",
  "Alt",
  "Shift",
  "CapsLock",
  "Tab",
  "Backspace",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || Boolean(target.closest("button, a[href], input, select, textarea"));
}

function isForeignEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || Boolean(target.closest("input, select, textarea"));
}

/** The session's own typing field, which stays focused while a session runs. */
function isTypingField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.dataset.typingInput === "true";
}

/** A quick-start radio keeps the global Enter shortcut after mode selection. */
function isStartShortcutTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.dataset.startShortcut === "true";
}

export function useKeyboardInput(options: KeyboardInputOptions) {
  const handlers = useRef(options);

  useEffect(() => {
    handlers.current = options;
  }, [options]);

  useEffect(() => {
    let composing = false;
    const startComposition = () => {
      composing = true;
    };
    const endComposition = () => {
      composing = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (composing || event.isComposing || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      // Preserve native Escape behavior such as clearing a focused search field.
      if (event.key === "Escape" && isForeignEditableTarget(event.target) && !isTypingField(event.target)) return;
      // Escape is application navigation even when a native control has focus.
      if (event.key === "Escape") {
        event.preventDefault();
        handlers.current.onEscape();
        return;
      }
      // The typing field is deliberately not treated as a foreign editable target:
      // it holds focus for the whole session, so Enter and Escape must still work
      // for players using a hardware keyboard alongside a touch device.
      if (
        isInteractiveTarget(event.target) &&
        !isTypingField(event.target) &&
        !(isStartShortcutTarget(event.target) && event.key === "Enter")
      )
        return;
      if (event.key === "Enter") {
        event.preventDefault();
        handlers.current.onEnter();
        return;
      }
      if (IGNORED_KEYS.has(event.key) || event.key.startsWith("F") || event.key.length !== 1) return;
      // Characters typed into the typing field arrive through its input event.
      if (isTypingField(event.target)) return;
      if (TYPABLE_CHARACTER.test(event.key)) {
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
