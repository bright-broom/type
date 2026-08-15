export interface AudioService {
  playCorrect(): void;
  playMiss(): void;
  playComplete(): void;
}

export class WebAudioService implements AudioService {
  private context: AudioContext | null = null;
  private enabled = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  private tone(frequency: number, duration: number, gainValue: number) {
    if (!this.enabled || typeof window === "undefined") return;
    try {
      this.context ??= new AudioContext();
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const now = this.context.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(gainValue, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch {
      // Audio is an optional capability.
    }
  }

  playCorrect() {
    this.tone(620, 0.035, 0.018);
  }
  playMiss() {
    this.tone(150, 0.075, 0.025);
  }
  playComplete() {
    this.tone(880, 0.09, 0.03);
  }
}
