// All sound here is procedurally synthesized via Web Audio — no external
// audio files, matching the "originals only" rule the rest of the asset
// pipeline follows (see the Phase 1 copyright note in PROGRESS.md).

export type FootstepMaterial = 'stone' | 'wood' | 'dirt' | 'sand' | 'grass' | 'water' | 'default';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientNodes: { stop: () => void } | null = null;

  private masterVolume = 0.8;
  private sfxVolume = 0.8;
  private musicVolume = 0.35;

  /** Must be called from a user-gesture handler (click) — browsers block
   * AudioContext until then. Safe to call repeatedly. */
  ensureStarted() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.masterGain);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.masterGain);
  }

  setVolumes(master: number, sfx: number, music: number) {
    this.masterVolume = master;
    this.sfxVolume = sfx;
    this.musicVolume = music;
    if (this.masterGain) this.masterGain.gain.value = master;
    if (this.sfxGain) this.sfxGain.gain.value = sfx;
    if (this.musicGain) this.musicGain.gain.value = music;
  }

  private noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private playNoiseBurst(freq: number, q: number, duration: number, gainAmount: number) {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainAmount, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(filter).connect(gain).connect(this.sfxGain);
    src.start();
    src.stop(ctx.currentTime + duration);
  }

  private playTone(freq: number, duration: number, gainAmount: number, type: OscillatorType = 'sine') {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainAmount, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(this.sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  private static readonly MATERIAL_FREQ: Record<FootstepMaterial, number> = {
    stone: 900, wood: 500, dirt: 350, sand: 1400, grass: 600, water: 700, default: 500,
  };

  footstep(material: FootstepMaterial) {
    this.playNoiseBurst(SoundEngine.MATERIAL_FREQ[material], 2.2, 0.08, 0.18);
  }

  breakBlock() {
    this.playNoiseBurst(400, 1.2, 0.15, 0.28);
  }

  placeBlock() {
    this.playNoiseBurst(600, 1.8, 0.09, 0.22);
  }

  hit() {
    this.playTone(140, 0.12, 0.3, 'square');
  }

  damage() {
    this.playTone(90, 0.25, 0.35, 'sawtooth');
  }

  uiClick() {
    this.playTone(880, 0.06, 0.15, 'sine');
  }

  craft() {
    this.playTone(660, 0.07, 0.18, 'triangle');
    setTimeout(() => this.playTone(990, 0.08, 0.15, 'triangle'), 60);
  }

  startAmbient() {
    if (!this.ctx || !this.musicGain || this.ambientNodes) return;
    const ctx = this.ctx;
    const notes = [65.4, 98.0, 130.8]; // low C2/G2/C3 drone
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    for (const freq of notes) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = 0.2;
      osc.connect(gain).connect(this.musicGain);
      osc.start();
      oscs.push(osc);
      gains.push(gain);
    }
    // slow filter LFO on the top voice for a bit of movement
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 8;
    lfo.connect(lfoGain).connect(oscs[2].frequency);
    lfo.start();

    this.ambientNodes = {
      stop: () => {
        for (const o of oscs) o.stop();
        lfo.stop();
      },
    };
  }

  stopAmbient() {
    this.ambientNodes?.stop();
    this.ambientNodes = null;
  }
}

export const soundEngine = new SoundEngine();
