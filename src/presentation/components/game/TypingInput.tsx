"use client";

import { useRef } from "react";

type TypingInputProps = {
  onText: (text: string) => void;
};

const ACCEPTED_INPUT = /^[a-z0-9 ' -]$/i;

export function TypingInput({ onText }: TypingInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <label className="touch-typing-input">
      <span>タップして入力</span>
      <input
        ref={inputRef}
        aria-label="タイピング入力"
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        enterKeyHint="done"
        inputMode="text"
        onChange={(event) => {
          const text = [...event.currentTarget.value]
            .filter((character) => ACCEPTED_INPUT.test(character))
            .join("")
            .toLowerCase();
          if (text) onText(text);
          event.currentTarget.value = "";
        }}
        onPointerDown={() => inputRef.current?.focus()}
        placeholder="ローマ字を入力"
        spellCheck={false}
        type="text"
      />
    </label>
  );
}
