"use client";

import type { RefObject } from "react";

type TypingInputProps = {
  /** Owned by the session composition so focus can ride a user gesture. */
  inputRef: RefObject<HTMLInputElement | null>;
  /** True while a session is running and the field should accept input. */
  active: boolean;
  onText: (text: string) => void;
};

export function TypingInput({ inputRef, active, onText }: TypingInputProps) {
  /**
   * Read and clear in one step. Clearing first keeps the field empty even if
   * `onText` triggers a re-render, so no character is ever consumed twice.
   */
  const consume = (element: HTMLInputElement) => {
    const raw = element.value;
    element.value = "";
    if (raw) onText(raw);
  };

  return (
    <div className="typing-input-dock" data-active={active ? "true" : "false"}>
      <label className="touch-typing-input">
        <span>タップしてローマ字入力</span>
        <input
          ref={inputRef}
          aria-hidden={active ? undefined : true}
          aria-label="タイピング入力"
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          data-typing-input="true"
          enterKeyHint="done"
          inputMode="text"
          // While an IME is composing, the field holds provisional text. Clearing it
          // then would cancel the composition, so wait for the commit.
          onCompositionEnd={(event) => consume(event.currentTarget)}
          onInput={(event) => {
            if ((event.nativeEvent as InputEvent).isComposing) return;
            consume(event.currentTarget);
          }}
          placeholder="ローマ字を入力"
          spellCheck={false}
          tabIndex={active ? 0 : -1}
          type="text"
        />
      </label>
    </div>
  );
}
