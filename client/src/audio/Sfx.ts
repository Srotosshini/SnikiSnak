// Sound effects (PLAN.md Section 12, "Sound effects"), all made in code with
// the Web Audio API: short shaped noise bursts and tones, in the spirit of
// sfxr. Nothing is downloaded, so the LAN Party works offline.
//
// Positional sounds get quieter with distance from the local player
// (refDistance 2, rolloff 1.5) and pan left or right.

import type { AudioBus, BusName } from "./AudioBus";

export interface Pos { x: number; z: number; }

const REF_DISTANCE = 2;
const ROLLOFF = 1.5;

type Maker = (s: Sfx, out: AudioNode, t: number) => void;

export class Sfx {
  private listener: Pos | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private bellTimer = 0;
  private purr: { src: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode } | null = null;

  constructor(readonly bus: AudioBus) {}

  get ctx(): AudioContext { return this.bus.ctx; }

  /** Where the local player is (the ears). */
  setListener(p: Pos | null): void {
    this.listener = p;
  }

  play(name: string, at?: Pos, volume = 1, bus: BusName = "sfx"): void {
    const make = SOUNDS[name];
    if (!make || this.ctx.state !== "running") return;
    const out = this.spatial(at, volume, bus);
    if (!out) return;
    make(this, out, this.ctx.currentTime);
  }

  /** A gain + pan for a position, or null if it's too far to hear. */
  spatial(at: Pos | undefined, volume: number, bus: BusName = "sfx"): AudioNode | null {
    const gain = this.ctx.createGain();
    const pan = this.ctx.createStereoPanner();
    let g = volume;
    if (at && this.listener) {
      const dx = at.x - this.listener.x, dz = at.z - this.listener.z;
      const d = Math.hypot(dx, dz);
      g *= REF_DISTANCE / (REF_DISTANCE + ROLLOFF * Math.max(0, d - REF_DISTANCE));
      pan.pan.value = Math.max(-1, Math.min(1, dx / 6));
    }
    if (g < 0.02) return null;
    gain.gain.value = g;
    gain.connect(pan).connect(this.bus.bus(bus));
    window.setTimeout(() => { gain.disconnect(); pan.disconnect(); }, 4000);
    return gain;
  }

  noise(): AudioBuffer {
    if (!this.noiseBuf) {
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  /** The cat's collar bell while he walks (call every frame with his state). */
  updateCat(at: Pos | null, moving: boolean, asleep: boolean): void {
    if (this.ctx.state !== "running") return;
    if (at && moving && !this.bellTimer) {
      this.play("bell", at, 0.7);
      this.bellTimer = window.setTimeout(() => { this.bellTimer = 0; }, 380);
    }
    // A soft purr loop while he sleeps.
    if (at && asleep) {
      if (!this.purr) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise();
        src.loop = true;
        const lp = this.ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 180;
        const am = this.ctx.createGain();
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 24;
        const lfoDepth = this.ctx.createGain();
        lfoDepth.gain.value = 0.5;
        lfo.connect(lfoDepth).connect(am.gain);
        const gain = this.ctx.createGain();
        const pan = this.ctx.createStereoPanner();
        src.connect(lp).connect(am).connect(gain).connect(pan).connect(this.bus.bus("sfx"));
        src.start();
        lfo.start();
        this.purr = { src, gain, pan };
      }
      const d = this.listener ? Math.hypot(at.x - this.listener.x, at.z - this.listener.z) : 4;
      this.purr.gain.gain.setTargetAtTime(0.5 * REF_DISTANCE / (REF_DISTANCE + ROLLOFF * Math.max(0, d - REF_DISTANCE)), this.ctx.currentTime, 0.2);
      if (this.listener) this.purr.pan.pan.value = Math.max(-1, Math.min(1, (at.x - this.listener.x) / 6));
    } else if (this.purr) {
      this.stopPurr();
    }
  }

  stopPurr(): void {
    if (!this.purr) return;
    try { this.purr.src.stop(); } catch { /* fine */ }
    this.purr.gain.disconnect();
    this.purr = null;
  }
}

// ---------------------------------------------------------------------------
// The sounds
// ---------------------------------------------------------------------------

function tone(s: Sfx, out: AudioNode, t: number, o: {
  type?: OscillatorType; from: number; to?: number; dur: number; gain?: number; attack?: number; at?: number;
}): void {
  const ctx = s.ctx;
  const start = t + (o.at ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.from, start);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, start + o.dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, start + (o.attack ?? 0.005));
  env.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
  osc.connect(env).connect(out);
  osc.start(start);
  osc.stop(start + o.dur + 0.02);
}

function noise(s: Sfx, out: AudioNode, t: number, o: {
  dur: number; gain?: number; type?: BiquadFilterType; freq?: number; freqTo?: number; q?: number; at?: number;
}): void {
  const ctx = s.ctx;
  const start = t + (o.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = s.noise();
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? "bandpass";
  f.frequency.setValueAtTime(o.freq ?? 1000, start);
  if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, start + o.dur);
  f.Q.value = o.q ?? 1;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, start + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
  src.connect(f).connect(env).connect(out);
  src.start(start, Math.random() * 0.5);
  src.stop(start + o.dur + 0.02);
}

const SOUNDS: Record<string, Maker> = {
  // Movement
  step: (s, o, t) => noise(s, o, t, { dur: 0.05, gain: 0.12, freq: 700, q: 2 }),
  stepHeavy: (s, o, t) => { noise(s, o, t, { dur: 0.08, gain: 0.25, freq: 300, q: 1.5 }); tone(s, o, t, { from: 90, to: 60, dur: 0.08, gain: 0.15 }); },
  squeak: (s, o, t) => {
    tone(s, o, t, { type: "square", from: 520, to: 880, dur: 0.18, gain: 0.08, attack: 0.03 });
    tone(s, o, t, { type: "triangle", from: 880, to: 600, dur: 0.14, gain: 0.06, at: 0.15 });
  },
  ventScurry: (s, o, t) => { for (let i = 0; i < 8; i++) noise(s, o, t, { dur: 0.03, gain: 0.08, freq: 3000, q: 4, at: i * 0.05 }); },
  hup: (s, o, t) => tone(s, o, t, { type: "triangle", from: 300, to: 600, dur: 0.12, gain: 0.15 }),
  // Sir Crumbs
  bell: (s, o, t) => {
    for (const [f, d] of [[2600, 0], [3900, 0.01], [3100, 0.06]] as const) tone(s, o, t, { from: f, dur: 0.25, gain: 0.05, at: d });
  },
  chirp: (s, o, t) => tone(s, o, t, { type: "triangle", from: 600, to: 1300, dur: 0.14, gain: 0.15 }),
  meow: (s, o, t) => {
    tone(s, o, t, { type: "sawtooth", from: 500, to: 900, dur: 0.18, gain: 0.08, attack: 0.04 });
    tone(s, o, t, { type: "sawtooth", from: 900, to: 420, dur: 0.3, gain: 0.08, at: 0.16 });
  },
  hiss: (s, o, t) => noise(s, o, t, { dur: 0.45, gain: 0.18, type: "highpass", freq: 3500 }),
  whoosh: (s, o, t) => noise(s, o, t, { dur: 0.3, gain: 0.25, freq: 400, freqTo: 2500, q: 2 }),
  patpat: (s, o, t) => { for (const d of [0, 0.25, 0.9, 1.15]) noise(s, o, t, { dur: 0.06, gain: 0.25, type: "lowpass", freq: 400, at: d }); },
  // Jars
  jarClink: (s, o, t) => { tone(s, o, t, { from: 2400, dur: 0.35, gain: 0.12 }); tone(s, o, t, { from: 3300, dur: 0.3, gain: 0.08, at: 0.08 }); },
  jarPop: (s, o, t) => {
    tone(s, o, t, { from: 300, to: 1200, dur: 0.08, gain: 0.2 });
    for (let i = 0; i < 6; i++) tone(s, o, t, { from: 2000 + Math.random() * 2500, dur: 0.2, gain: 0.05, at: 0.05 + i * 0.04 });
  },
  wobble: (s, o, t) => { tone(s, o, t, { from: 140, to: 90, dur: 0.15, gain: 0.25 }); tone(s, o, t, { from: 1800, dur: 0.15, gain: 0.03 }); },
  // Items
  pickup: (s, o, t) => tone(s, o, t, { from: 500, to: 1100, dur: 0.1, gain: 0.15 }),
  putdown: (s, o, t) => noise(s, o, t, { dur: 0.08, gain: 0.15, type: "lowpass", freq: 500 }),
  crash: (s, o, t) => {
    noise(s, o, t, { dur: 0.5, gain: 0.4, freq: 1800, q: 0.5 });
    tone(s, o, t, { from: 120, to: 50, dur: 0.3, gain: 0.3 });
    for (let i = 0; i < 4; i++) tone(s, o, t, { from: 1500 + Math.random() * 2000, dur: 0.25, gain: 0.04, at: 0.05 + i * 0.05 });
  },
  munch: (s, o, t) => { for (let i = 0; i < 3; i++) noise(s, o, t, { dur: 0.06, gain: 0.2, freq: 1500, q: 3, at: i * 0.11 }); },
  // Doors and wires
  lockClick: (s, o, t) => { noise(s, o, t, { dur: 0.02, gain: 0.3, type: "highpass", freq: 3000 }); tone(s, o, t, { from: 2200, dur: 0.03, gain: 0.08 }); },
  latchClack: (s, o, t) => { noise(s, o, t, { dur: 0.03, gain: 0.25, freq: 2000, q: 3 }); noise(s, o, t, { dur: 0.06, gain: 0.2, type: "lowpass", freq: 600, at: 0.06 }); },
  doorCreak: (s, o, t) => {
    const ctx = s.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t);
    for (let i = 1; i <= 6; i++) osc.frequency.linearRampToValueAtTime(160 + Math.random() * 120, t + i * 0.1);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 6;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(f).connect(env).connect(o);
    osc.start(t); osc.stop(t + 0.72);
  },
  // Pings (keys 1-4)
  ping1: (s, o, t) => tone(s, o, t, { type: "triangle", from: 880, dur: 0.15, gain: 0.15 }),
  ping2: (s, o, t) => { tone(s, o, t, { type: "square", from: 660, dur: 0.1, gain: 0.08 }); tone(s, o, t, { type: "square", from: 660, dur: 0.1, gain: 0.08, at: 0.14 }); },
  ping3: (s, o, t) => tone(s, o, t, { type: "triangle", from: 520, to: 400, dur: 0.25, gain: 0.15 }),
  ping4: (s, o, t) => { tone(s, o, t, { type: "triangle", from: 700, to: 1000, dur: 0.12, gain: 0.15 }); tone(s, o, t, { type: "triangle", from: 1000, to: 1300, dur: 0.12, gain: 0.15, at: 0.13 }); },
  // UI
  pap: (s, o, t) => noise(s, o, t, { dur: 0.06, gain: 0.2, freq: 1200, q: 1 }),
  cardFlip: (s, o, t) => noise(s, o, t, { dur: 0.12, gain: 0.15, freq: 800, freqTo: 3000, q: 1 }),
  scribble: (s, o, t) => { for (let i = 0; i < 5; i++) noise(s, o, t, { dur: 0.07, gain: 0.08, freq: 2500 + i * 200, q: 2, at: i * 0.07 }); },
  stamp: (s, o, t) => { tone(s, o, t, { from: 110, to: 55, dur: 0.2, gain: 0.35 }); noise(s, o, t, { dur: 0.1, gain: 0.25, type: "lowpass", freq: 900 }); },
  // Level 8 (Phase 7)
  breadboxDing: (s, o, t) => { tone(s, o, t, { from: 1568, dur: 1.2, gain: 0.15 }); tone(s, o, t, { from: 3136, dur: 0.8, gain: 0.05 }); },
};
