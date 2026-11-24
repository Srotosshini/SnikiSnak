// Animalese-style blip voices (PLAN.md Section 12, "Blip voices").
//
// Each letter of a line plays one short tone; the letter picks the pitch
// (semitone = charCode % range, added to the speaker's base note). Spaces,
// commas and full stops are pauses. A word in CAPITALS is shouted: 3 semitones
// higher and 30% louder. Text can be revealed letter by letter in time.

import type { Speaker } from "../content/script";
import type { AudioBus } from "./AudioBus";

interface VoiceDef {
  base: number;      // Hz
  range: number;     // semitones
  waves: OscillatorType[];
  noteMs: number;
  gapMs: number;
  lowpass: number;   // Hz
  gain: number;
  vibrato?: { hz: number; cents: number };
  dip?: boolean;     // each note dips slightly in pitch
  caw?: boolean;     // a "caw" on every "!"
}

/** Section 12's table. */
const VOICES: Record<Exclude<Speaker, "crumbs">, VoiceDef> = {
  kiwi: { base: 330, range: 7, waves: ["triangle"], noteMs: 55, gapMs: 25, lowpass: 2500, gain: 0.12, vibrato: { hz: 6, cents: 15 } },
  mochi: { base: 620, range: 9, waves: ["square"], noteMs: 38, gapMs: 15, lowpass: 3500, gain: 0.06 },
  pip: { base: 165, range: 5, waves: ["sawtooth"], noteMs: 70, gapMs: 30, lowpass: 1200, gain: 0.12, dip: true },
  crow: { base: 220, range: 6, waves: ["sawtooth", "triangle"], noteMs: 80, gapMs: 35, lowpass: 1800, gain: 0.1, caw: true },
};

const PAUSE_MS: Record<string, number> = { " ": 60, ",": 150, ".": 250, "!": 250, "?": 250 };

export interface Speech {
  /** Total length in seconds. */
  duration: number;
  stop(): void;
}

export class Blips {
  private enabled = true;

  constructor(private readonly bus: AudioBus) {}

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  /**
   * Speak a line. `onReveal(n)` is called as the first n characters become
   * visible, in time with the blips. With maxSeconds, a long line is spoken a bit
   * faster so it fits. Sir Crumbs never speaks (thought bubbles only).
   */
  speak(who: Speaker, text: string, onReveal?: (n: number) => void, maxSeconds?: number): Speech {
    const timers: number[] = [];
    const nodes: AudioScheduledSourceNode[] = [];
    const def = who === "crumbs" ? null : VOICES[who];
    const ctx = this.bus.ctx;
    const out = ctx.createBiquadFilter();
    out.type = "lowpass";
    out.frequency.value = def?.lowpass ?? 2000;
    out.connect(this.bus.bus("blips"));

    // First lay out the line (ms from now), then squeeze it if it must fit in maxSeconds.
    type Ev = { at: number; n: number; note?: { semitone: number; loud: number }; caw?: boolean };
    const events: Ev[] = [];
    let t = 0;
    let index = 0;
    for (const word of text.split(/(s+)/)) {
      const shout = word.length > 1 && /[A-Z]/.test(word) && word === word.toUpperCase();
      for (const ch of word) {
        index++;
        const ev: Ev = { at: t, n: index };
        events.push(ev);
        const pause = PAUSE_MS[ch];
        if (pause !== undefined) {
          if (ch === "!" && def?.caw) ev.caw = true;
          t += pause;
          continue;
        }
        if (!/[a-z0-9]/i.test(ch)) continue;
        if (def) ev.note = { semitone: ch.charCodeAt(0) % def.range + (shout ? 3 : 0), loud: shout ? 1.3 : 1 };
        t += def ? def.noteMs + def.gapMs : 50;
      }
    }
    const k = maxSeconds && t > maxSeconds * 1000 ? (maxSeconds * 1000) / t : 1;
    const play = def && this.enabled && ctx.state === "running";
    for (const ev of events) {
      const at = ev.at * k;
      if (onReveal) timers.push(window.setTimeout(() => onReveal(ev.n), at));
      if (play && ev.caw) this.caw(out, at / 1000);
      if (play && def && ev.note) nodes.push(...this.note(def, out, at / 1000, ev.note.semitone, ev.note.loud, k));
    }
    const total = t * k;
    if (onReveal) timers.push(window.setTimeout(() => onReveal(text.length), total));
    const disconnect = window.setTimeout(() => out.disconnect(), total + 500);
    return {
      duration: total / 1000,
      stop: () => {
        for (const id of [...timers, disconnect]) clearTimeout(id);
        for (const n of nodes) { try { n.stop(); } catch { /* already stopped */ } }
        onReveal?.(text.length);
        out.disconnect();
      },
    };
  }

  private note(def: VoiceDef, out: AudioNode, offset: number, semitone: number, loud: number, squeeze = 1): AudioScheduledSourceNode[] {
    const ctx = this.bus.ctx;
    const start = ctx.currentTime + offset;
    const dur = (def.noteMs * squeeze) / 1000;
    const freq = def.base * Math.pow(2, semitone / 12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(def.gain * loud / def.waves.length, start + 0.005);
    env.gain.linearRampToValueAtTime(0, start + dur);
    env.connect(out);
    const made: AudioScheduledSourceNode[] = [];
    for (const wave of def.waves) {
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, start);
      if (def.dip) osc.frequency.linearRampToValueAtTime(freq * 0.94, start + dur);
      if (def.vibrato) {
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = def.vibrato.hz;
        depth.gain.value = freq * (Math.pow(2, def.vibrato.cents / 1200) - 1);
        lfo.connect(depth).connect(osc.frequency);
        lfo.start(start);
        lfo.stop(start + dur);
        made.push(lfo);
      }
      osc.connect(env);
      osc.start(start);
      osc.stop(start + dur + 0.02);
      made.push(osc);
    }
    return made;
  }

  /** The Crow's short "caw" on exclamations. */
  private caw(out: AudioNode, offset: number): void {
    const ctx = this.bus.ctx;
    const start = ctx.currentTime + offset;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(700, start);
    osc.frequency.exponentialRampToValueAtTime(380, start + 0.18);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    osc.connect(env).connect(out);
    osc.start(start);
    osc.stop(start + 0.22);
  }
}
