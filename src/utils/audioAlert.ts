// Audio Notification Engine using Web Audio API (browser native, no external audio files required)
import { AlertSeverity } from '../types';

export type SoundChimeType = 'chime' | 'radar' | 'ping' | 'pulse';

class SoundAlertManager {
  private ctx: AudioContext | null = null;
  private soundEnabled = true;
  private soundVolume = 0.75; // 0.0 to 1.0
  private soundChime: SoundChimeType = 'chime';

  constructor() {
    // Initialize preferences from localStorage if available
    if (typeof window !== 'undefined') {
      const savedEnabled = localStorage.getItem('alert_sound_enabled');
      if (savedEnabled !== null) {
        this.soundEnabled = savedEnabled === 'true';
      }
      const savedVol = localStorage.getItem('alert_sound_volume');
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        if (!isNaN(parsed)) this.soundVolume = Math.max(0, Math.min(1, parsed / 100));
      }
      const savedChime = localStorage.getItem('alert_sound_chime') as SoundChimeType;
      if (savedChime && ['chime', 'radar', 'ping', 'pulse'].includes(savedChime)) {
        this.soundChime = savedChime;
      }
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('alert_sound_enabled', String(enabled));
    }
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public setVolume(volumePct: number) {
    this.soundVolume = Math.max(0, Math.min(1, volumePct / 100));
    if (typeof window !== 'undefined') {
      localStorage.setItem('alert_sound_volume', String(volumePct));
    }
  }

  public getVolume(): number {
    return Math.round(this.soundVolume * 100);
  }

  public setChimeStyle(chime: SoundChimeType) {
    this.soundChime = chime;
    if (typeof window !== 'undefined') {
      localStorage.setItem('alert_sound_chime', chime);
    }
  }

  public getChimeStyle(): SoundChimeType {
    return this.soundChime;
  }

  /**
   * Plays alert tone customized by severity and selected sound profile
   */
  public playAlertChime(
    severity: AlertSeverity = 'MEDIUM',
    customStyle?: SoundChimeType,
    customVolume?: number
  ) {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const effectiveVolume = customVolume !== undefined
        ? Math.max(0, Math.min(1, customVolume / 100))
        : this.soundVolume;

      if (effectiveVolume <= 0) return;

      const style = customStyle || this.soundChime;
      const now = ctx.currentTime;

      // Master gain node
      const masterGain = ctx.createGain();
      const peakVolume = (severity === 'CRITICAL' ? 0.35 : severity === 'HIGH' ? 0.25 : 0.18) * effectiveVolume;

      masterGain.connect(ctx.destination);

      if (style === 'radar') {
        // High-tech radar sweep
        const osc = ctx.createOscillator();
        const baseFreq = severity === 'CRITICAL' ? 880 : 660;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 2, now + 0.15);

        masterGain.gain.setValueAtTime(0.001, now);
        masterGain.gain.linearRampToValueAtTime(peakVolume * 0.8, now + 0.03);
        masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (style === 'ping') {
        // Crisp crystal sonar ping
        const osc = ctx.createOscillator();
        const baseFreq = severity === 'CRITICAL' ? 1500 : 1200;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, now);

        masterGain.gain.setValueAtTime(0.001, now);
        masterGain.gain.linearRampToValueAtTime(peakVolume, now + 0.015);
        masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (style === 'pulse') {
        // Dual pulse urgent notification
        const osc = ctx.createOscillator();
        osc.type = severity === 'CRITICAL' ? 'square' : 'triangle';
        const baseFreq = severity === 'CRITICAL' ? 659.25 : 440; // E5 or A4
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.setValueAtTime(baseFreq * 1.25, now + 0.12);

        masterGain.gain.setValueAtTime(0.001, now);
        masterGain.gain.linearRampToValueAtTime(peakVolume, now + 0.02);
        masterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        masterGain.gain.linearRampToValueAtTime(peakVolume, now + 0.14);
        masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.35);
      } else {
        // Default harmonious melodic chime (880Hz -> 1320Hz + 1760Hz)
        const baseFreq = severity === 'CRITICAL' ? 987.77 : 880; // B5 for critical, A5 normal
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(baseFreq, now);
        osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.12);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(baseFreq * 2, now + 0.12);

        masterGain.gain.setValueAtTime(0.001, now);
        masterGain.gain.linearRampToValueAtTime(peakVolume, now + 0.04);
        masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc1.connect(masterGain);
        osc2.connect(masterGain);

        osc1.start(now);
        osc2.start(now + 0.12);
        osc1.stop(now + 0.38);
        osc2.stop(now + 0.38);
      }
    } catch {
      // Audio context might be restricted before user interaction
    }
  }

  /**
   * Preview a sound profile with test playback
   */
  public testSound(style: SoundChimeType, volumePct: number = 75) {
    this.playAlertChime('HIGH', style, volumePct);
  }
}

export const soundAlert = new SoundAlertManager();
