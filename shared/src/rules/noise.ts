// Noise sources (PLAN.md Section 4.2). The server makes noise events from
// authoritative positions; clients only draw them. Hearing comes in Phase 2.

import { TUNING } from "../tuning.js";
import type { NoiseKind } from "../types.js";
import type { Carry } from "./movement.js";
import { type Grid, type Vec2, wallBetween } from "../grid.js";

export interface Noise { radius: number; loudness: number; }

export interface NoiseEvent extends Noise { x: number; z: number; kind: NoiseKind; }

const pair = ([radius, loudness]: readonly [number, number]): Noise => ({ radius, loudness });

/** The noise of one footstep. */
export function footstepNoise(sneaking: boolean, carry: Carry): Noise {
  const n = TUNING.noise;
  if (carry === "croissant") return pair(sneaking ? n.croissantSneak : n.croissant);
  if (carry === "heavy") return pair(sneaking ? n.heavySneak : n.heavy);
  return pair(sneaking ? n.sneak : n.walk);
}

/** Seconds between footsteps while moving. */
export function stepInterval(sneaking: boolean): number {
  return sneaking ? TUNING.noise.sneakStepEvery : TUNING.noise.stepEvery;
}

/** Stepping onto a squeaky board (~). */
export function squeakNoise(sneaking: boolean): Noise {
  return pair(sneaking ? TUNING.noise.squeakSneak : TUNING.noise.squeak);
}

/** Kiwi's cover makes a teammate's noise smaller and quieter. */
export function covered(noise: Noise, isCovered: boolean): Noise {
  if (!isCovered) return noise;
  const m = TUNING.noise.coverMult;
  return { radius: noise.radius * m, loudness: noise.loudness * m };
}

/**
 * How much alert the cat gains from a noise (Section 4.2, "Hearing").
 * The cat hears it if its distance d is at most radius × hearingMult; a wall
 * tile (#) on the straight line between them halves that radius. Doors and
 * furniture don't muffle sound. Gain = loudness × (1 − d / effectiveRadius).
 * Returns 0 if the noise isn't heard.
 */
export function hearingGain(g: Grid, listener: Vec2, noise: NoiseEvent, hearingMult: number): number {
  let effective = noise.radius * hearingMult;
  if (wallBetween(g, listener, noise)) effective *= TUNING.noise.wallMult;
  if (effective <= 0) return 0;
  const d = Math.hypot(noise.x - listener.x, noise.z - listener.z);
  if (d > effective) return 0;
  return noise.loudness * (1 - d / effective);
}

/**
 * Counts time while a player moves and says when the next footstep lands.
 * The first step lands one interval after starting to move.
 */
export class StepTimer {
  private t = 0;

  /** Advance by dt; returns true when a footstep lands this tick. */
  update(dt: number, moving: boolean, sneaking: boolean): boolean {
    if (!moving) { this.t = 0; return false; }
    this.t += dt;
    const every = stepInterval(sneaking);
    if (this.t >= every) { this.t -= every; return true; }
    return false;
  }
}
