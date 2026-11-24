// "What would E do here?" (PLAN.md Sections 2 and 4.8). One rule used by the
// server (to act) and the client (to show the prompt), so they always agree.
//
// The nearest thing within reach wins: an item to pick up or lift, a vent, a
// latch, or a locked door. `allowed` says whether this role can do it.

import { TUNING } from "./tuning.js";
import type { Role } from "./types.js";
import { type Action, canDo, whoCan } from "./roles.js";
import { type Grid, type OpenSet, type Tile, type Vec2, tileCenter } from "./grid.js";

export type TargetKind = "item" | "vent" | "latch" | "door";

export interface InteractItem {
  id: string;
  kind: string; // "small" | "heavy" | "croissant"
  x: number;
  z: number;
  carriedBy: string;
  onLedge: boolean;
  visible: boolean;
}

export interface InteractTarget {
  kind: TargetKind;
  /** Item id, door id, or "x,y" of the vent or latch tile. */
  id: string;
  action: Action;
  allowed: boolean;
  /** Roles that can do it (for "Pip can do this"). */
  canBeDoneBy: Role[];
  /** Where the target is. */
  at: Vec2;
  dist: number;
  /** The door a latch opens. */
  doorId?: string;
  /** The vent tile this vent leads to. */
  ventTo?: Tile;
}

const PRIORITY: Record<TargetKind, number> = { item: 0, latch: 1, vent: 2, door: 3 };

function itemAction(kind: string): Action {
  return kind === "heavy" ? "liftHeavy" : kind === "croissant" ? "liftCroissant" : "pickUpSmall";
}

function make(kind: TargetKind, id: string, action: Action, role: Role, at: Vec2, dist: number): InteractTarget {
  return { kind, id, action, allowed: canDo(role, action), canBeDoneBy: whoCan(action), at, dist };
}

/** Every target within reach of a player, nearest first. */
export function interactTargets(
  grid: Grid, open: OpenSet, items: Iterable<InteractItem>, role: Role, pos: Vec2,
): InteractTarget[] {
  const reach = TUNING.player.interactRange;
  const out: InteractTarget[] = [];
  const near = (p: Vec2): number => Math.hypot(p.x - pos.x, p.z - pos.z);

  for (const item of items) {
    if (item.carriedBy || item.onLedge || !item.visible) continue;
    const d = near(item);
    if (d <= reach) out.push(make("item", item.id, itemAction(item.kind), role, { x: item.x, z: item.z }, d));
  }
  for (const [a, b] of grid.ventPairs) {
    for (const [from, to] of [[a, b], [b, a]] as const) {
      const c = tileCenter(from);
      const d = near(c);
      if (d <= reach) out.push({ ...make("vent", `${from.x},${from.y}`, "vent", role, c, d), ventTo: to });
    }
  }
  for (const door of grid.doors) {
    if (open.has(door.id)) continue;
    if (door.latch) {
      const c = tileCenter(door.latch);
      const d = near(c);
      if (d <= reach) out.push({ ...make("latch", `${door.latch.x},${door.latch.y}`, "latch", role, c, d), doorId: door.id });
    }
    // A locked door is picked from a tile right next to it.
    let best = Infinity, at: Vec2 = { x: 0, z: 0 };
    for (const t of door.tiles) {
      const c = tileCenter(t);
      const d = near(c);
      if (d < best) { best = d; at = c; }
    }
    if (best <= reach + 0.05) out.push(make("door", door.id, "pickLock", role, at, best));
  }
  return out.sort((x, y) => x.dist - y.dist || PRIORITY[x.kind] - PRIORITY[y.kind]);
}

/** The single target E acts on: the nearest one. */
export function interactTarget(
  grid: Grid, open: OpenSet, items: Iterable<InteractItem>, role: Role, pos: Vec2,
): InteractTarget | null {
  return interactTargets(grid, open, items, role, pos)[0] ?? null;
}
