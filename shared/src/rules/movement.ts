// Movement speeds and the server's movement check (PLAN.md Sections 2 and 9).

import { TUNING } from "../tuning.js";
import type { Vec2 } from "../grid.js";

/** What a player is carrying, as far as speed and noise care. */
export type Carry = "none" | "heavy" | "croissant";

export interface MoveState {
  sneaking: boolean;
  carry: Carry;
  /** Kiwi holding Q moves at sneak speed. */
  covering?: boolean;
}

/** Speed in tiles per second. */
export function moveSpeed(s: MoveState): number {
  const p = TUNING.player;
  if (s.carry === "croissant") return s.sneaking ? p.croissantSneak : p.croissantWalk;
  if (s.carry === "heavy") return s.sneaking ? p.heavySneak : p.heavyWalk;
  if (s.sneaking || s.covering) return p.sneak;
  return p.walk;
}

/** The fastest a player with this load could legally move (walking, not sneaking). */
export function maxSpeed(carry: Carry): number {
  return moveSpeed({ sneaking: false, carry });
}

/** Slack the server allows on top of max speed: `maxSpeed × dt × 1.3 + 0.1`. */
export const MOVE_SLACK_MULT = 1.3;
export const MOVE_SLACK_ADD = 0.1;

/** The server accepts a new position only if it isn't further than this from the last accepted one. */
export function isMoveAllowed(from: Vec2, to: Vec2, dtSeconds: number, carry: Carry): boolean {
  const limit = maxSpeed(carry) * dtSeconds * MOVE_SLACK_MULT + MOVE_SLACK_ADD;
  return Math.hypot(to.x - from.x, to.z - from.z) <= limit;
}

/**
 * Turn WASD input into a world direction. The camera looks north (toward -Z)
 * from the south, so "up" on the keyboard is -Z and "right" is +X.
 * Returns a unit vector, or null when no keys are held.
 */
export function inputToDirection(up: boolean, down: boolean, left: boolean, right: boolean): Vec2 | null {
  const x = (right ? 1 : 0) - (left ? 1 : 0);
  const z = (down ? 1 : 0) - (up ? 1 : 0);
  if (x === 0 && z === 0) return null;
  const len = Math.hypot(x, z);
  return { x: x / len, z: z / len };
}

/** Facing angle for a direction: 0 faces +Z (toward the camera), PI/2 faces +X. */
export function facingFor(dir: Vec2): number {
  return Math.atan2(dir.x, dir.z);
}
