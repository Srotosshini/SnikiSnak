// Cat vision and the detection meter (PLAN.md Sections 4.3 and 4.4). Pure functions.

import { TUNING } from "../tuning.js";
import type { LightDef } from "../types.js";
import { type Grid, type OpenSet, type Vec2, ALL_CLOSED, charAt, hasLineOfSight, worldToTile } from "../grid.js";
import type { Carry } from "./movement.js";

export type LightLevel = "bright" | "normal" | "dark";

/**
 * How lit a position is. Tiles inside a lit lamp pool are bright, tiles inside
 * only a moon pool are normal, and tiles outside every pool are dark. During
 * lights out everything is dark. Measured from the centre of the tile.
 */
export function lightAt(lights: readonly LightDef[], x: number, z: number, lightsOut = false): LightLevel {
  if (lightsOut) return "dark";
  const t = worldToTile(x, z);
  const cx = t.x + 0.5, cz = t.y + 0.5;
  let level: LightLevel = "dark";
  for (const l of lights) {
    if (Math.hypot(cx - l.x, cz - l.z) > l.radius) continue;
    if (l.kind === "lamp") return "bright";
    level = "normal";
  }
  return level;
}

export interface Viewer { x: number; z: number; /** Where the cat looks, in radians (0 = +Z). */ look: number; }

/** True if the target is within the cone's angle and range (ignores walls). */
export function inCone(viewer: Viewer, fovDeg: number, range: number, target: Vec2): boolean {
  const dx = target.x - viewer.x, dz = target.z - viewer.z;
  const d = Math.hypot(dx, dz);
  if (d > range) return false;
  if (d < 1e-6) return true;
  const angle = Math.atan2(dx, dz);
  const diff = Math.abs(Math.atan2(Math.sin(angle - viewer.look), Math.cos(angle - viewer.look)));
  return diff <= (fovDeg * Math.PI) / 360;
}

/** In the cone and nothing solid in the way. Hidden players are handled by the caller. */
export function canSee(g: Grid, viewer: Viewer, fovDeg: number, range: number, target: Vec2, open: OpenSet = ALL_CLOSED): boolean {
  return inCone(viewer, fovDeg, range, target) && hasLineOfSight(g, viewer, target, open);
}

export interface DetectionInput {
  distance: number;
  range: number;
  sneaking: boolean;
  still: boolean;
  light: LightLevel;
  carry: Carry;
  /** Kiwi sneaking across a surface matching her colour. */
  blendMoving?: boolean;
}

/** How fast the detection meter rises per second while the player is visible (Section 4.4). */
export function detectionRate(i: DetectionInput): number {
  const d = TUNING.detect;
  const falloff = 1 - d.distFalloff * Math.min(1, i.distance / i.range);
  return d.base * falloff
    * (i.sneaking ? d.sneak : 1)
    * (i.still ? d.still : 1)
    * (i.light === "bright" ? d.bright : i.light === "dark" ? d.dark : 1)
    * (i.carry === "heavy" ? d.heavy : i.carry === "croissant" ? d.croissant : 1)
    * (i.blendMoving ? d.blendMoving : 1);
}

/** One tick of a detection meter: rises while visible, drains while not. Kept in 0..1. */
export function updateMeter(meter: number, visible: boolean, rate: number, dt: number): number {
  const next = visible ? meter + rate * dt : meter - TUNING.detect.drain * dt;
  return Math.min(1, Math.max(0, next));
}

/** A player in a T tile who is sneaking or standing still is hidden (Section 4.3, rule 1). */
export function hiddenInHideSpot(g: Grid, p: Vec2, sneaking: boolean, moving: boolean): boolean {
  const t = worldToTile(p.x, p.z);
  return charAt(g, t.x, t.y) === "T" && (sneaking || !moving);
}

export function inHideSpot(g: Grid, p: Vec2): boolean {
  const t = worldToTile(p.x, p.z);
  return charAt(g, t.x, t.y) === "T";
}
