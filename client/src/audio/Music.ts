// Layered music (PLAN.md Section 12, "Music"), composed in code.
//
// Three loops in the same key and tempo start together and crossfade:
//   calm     pizzicato plucks, soft upright bass, light brushes (always)
//   tension  low string drone and ticking percussion (cat suspicious)
//   chase    drums and brass stabs (cat chasing)
// Gains ramp with setTargetAtTime(target, now, 0.5). During lights out
// everything goes through a 600 Hz low-pass. Plus one-shots: the "Caught!"
// sting, the level-complete jingle and the royal kazoo theme.

import type { AudioBus } from "./AudioBus";

const BPM = 96;
const BEAT = 60 / BPM;
const STEP = BEAT / 2;             // eighth notes
const LOOKAHEAD = 0.15;            // seconds scheduled ahead
const STEPS_PER_BAR = 8;

// D minor: Dm – Bb – F – C, one bar each. MIDI note numbers.
const CHORDS: number[][] = [[62, 65, 69], [58, 62, 65], [65, 69, 72], [60, 64, 67]];
const BASS = [38, 34, 41, 36];

const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

export type Layer = "calm" | "tension" | "chase";

export class Music {
  private readonly out: BiquadFilterNode;
  private readonly layers: Record<Layer, GainNode>;
  private timer = 0;
  private nextTime = 0;
  private step = 0;
  private playing = false;

  constructor(private readonly bus: AudioBus) {
    const ctx = bus.ctx;
    this.out = ctx.createBiquadFilter();
    this.out.type = "lowpass";
    this.out.frequency.value = 20000;
    this.out.connect(bus.bus("music"));
    const make = (v: number): GainNode => {
      const g = ctx.createGain();
      g.gain.value = v;
      g.connect(this.out);
      return g;
    };
    this.layers = { calm: make(1), tension: make(0), chase: make(0) };
  }

  start(): void {
    if (this.playing) return;
    this.playing = true;
    this.nextTime = this.bus.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  stop(): void {
    this.playing = false;
    window.clearInterval(this.timer);
  }

  /** Which layers are up: tension when the cat is suspicious, chase when he chases. */
  setIntensity(tension: boolean, chase: boolean): void {
    const now = this.bus.ctx.currentTime;
    this.layers.tension.gain.setTargetAtTime(tension || chase ? 1 : 0, now, 0.5);
    this.layers.chase.gain.setTargetAtTime(chase ? 1 : 0, now, 0.5);
  }

  /** Lights out: muffle everything; open again over 1 s when the lights return. */
  setMuffled(on: boolean): void {
    this.out.frequency.setTargetAtTime(on ? 600 : 20000, this.bus.ctx.currentTime, on ? 0.1 : 0.33);
  }

  private schedule(): void {
    const ctx = this.bus.ctx;
    if (ctx.state !== "running") { this.nextTime = ctx.currentTime + 0.1; return; }
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime);
      this.step = (this.step + 1) % (STEPS_PER_BAR * CHORDS.length);
      this.nextTime += STEP;
    }
  }

  private playStep(step: number, t: number): void {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const s = step % STEPS_PER_BAR;
    const chord = CHORDS[bar];

    // Calm: a walking pizzicato pattern, bass on beats 1 and 3, brushes on 2 and 4.
    const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
    if (s !== 3 && s !== 7) this.pluck(this.layers.calm, midi(chord[pattern[s]] + (s >= 4 ? 12 : 0)), t, 0.06);
    if (s === 0 || s === 4) this.pluck(this.layers.calm, midi(BASS[bar] + (s === 4 ? 7 : 0)), t, 0.16, "sine", 0.6);
    if (s === 2 || s === 6) this.brush(this.layers.calm, t, 0.05);

    // Tension: a drone each bar and a tick on every eighth.
    if (s === 0) this.drone(this.layers.tension, midi(BASS[bar] + 12), t, STEP * STEPS_PER_BAR);
    this.tick(this.layers.tension, t, s % 2 === 0 ? 0.05 : 0.025);

    // Chase: kick and snare, and brass stabs on the off-beats.
    if (s === 0 || s === 3 || s === 4) this.kick(this.layers.chase, t);
    if (s === 2 || s === 6) this.brush(this.layers.chase, t, 0.2);
    if (s === 1 || s === 5) for (const n of chord) this.stab(this.layers.chase, midi(n), t);
  }

  // --- instruments ---

  private pluck(out: AudioNode, freq: number, t: number, gain: number, type: OscillatorType = "triangle", len = 0.3): void {
    const ctx = this.bus.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + len + 0.02);
  }

  private noiseBurst(out: AudioNode, t: number, gain: number, dur: number, type: BiquadFilterType, freq: number): void {
    const ctx = this.bus.ctx;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(env).connect(out);
    src.start(t);
  }

  private brush(out: AudioNode, t: number, gain: number): void {
    this.noiseBurst(out, t, gain, 0.12, "highpass", 4000);
  }

  private tick(out: AudioNode, t: number, gain: number): void {
    this.noiseBurst(out, t, gain, 0.02, "highpass", 6000);
  }

  private drone(out: AudioNode, freq: number, t: number, dur: number): void {
    const ctx = this.bus.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq / 2;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 500;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.05, t + 0.4);
    env.gain.setValueAtTime(0.05, t + dur - 0.3);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f).connect(env).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private kick(out: AudioNode, t: number): void {
    const ctx = this.bus.ctx;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.35, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  private stab(out: AudioNode, freq: number, t: number): void {
    const ctx = this.bus.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(2500, t);
    f.frequency.exponentialRampToValueAtTime(600, t + 0.15);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.035, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(f).connect(env).connect(out);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // --- one-shots ---

  /** A buzzy kazoo note: sawtooth with vibrato through a narrow band-pass. */
  private kazoo(freq: number, t: number, dur: number, gain = 0.09): void {
    const ctx = this.bus.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6;
    const depth = ctx.createGain();
    depth.gain.value = freq * 0.02;
    lfo.connect(depth).connect(osc.frequency);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq * 3;
    f.Q.value = 2;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.03);
    env.gain.setValueAtTime(gain, t + dur * 0.8);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f).connect(env).connect(this.bus.bus("music"));
    osc.start(t); lfo.start(t);
    osc.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
  }

  private glock(freq: number, t: number): void {
    const ctx = this.bus.ctx;
    for (const mult of [1, 2.76]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq * mult;
      const env = ctx.createGain();
      env.gain.setValueAtTime(mult === 1 ? 0.12 : 0.03, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      osc.connect(env).connect(this.bus.bus("music"));
      osc.start(t);
      osc.stop(t + 0.85);
    }
  }

  /** The royal kazoo fanfare (cutscenes and the start screen). */
  fanfare(): void {
    const t = this.bus.ctx.currentTime + 0.05;
    const notes: Array<[number, number]> = [[62, 0.18], [62, 0.18], [62, 0.18], [67, 0.6], [71, 0.3], [69, 0.3], [74, 0.9]];
    let at = t;
    for (const [n, d] of notes) { this.kazoo(midi(n), at, d * 0.95); at += d; }
  }

  /** Level complete: kazoo and glockenspiel. */
  jingle(): void {
    const t = this.bus.ctx.currentTime + 0.05;
    [72, 76, 79, 84].forEach((n, i) => { this.glock(midi(n), t + i * 0.14); });
    this.kazoo(midi(67), t + 0.56, 0.25);
    this.kazoo(midi(72), t + 0.84, 0.6);
  }

  /** "Caught!": a sad slide down. */
  sting(): void {
    const t = this.bus.ctx.currentTime + 0.05;
    [[67, 0.25], [66, 0.25], [65, 0.25], [64, 0.9]].reduce((at, [n, d]) => { this.kazoo(midi(n), at, d, 0.1); return at + d; }, t);
  }
}
