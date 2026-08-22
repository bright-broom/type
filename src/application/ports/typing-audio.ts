export interface TypingAudio {
  setEnabled(enabled: boolean): void;
  playCorrect(): void;
  playMiss(): void;
  playComplete(): void;
}
