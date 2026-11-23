// The tile grid (PLAN.md Sections 4.1 and 5).
//
// A level map is a list of strings, one character per tile. Tile (x, y) is
// column x, row y. In the 3D world it covers X from x to x+1 and Z from y to
// y+1, so its centre is (x + 0.5, y + 0.5). Y is up.
//
// Everything here is pure and deterministic so the server and the client run
// exactly the same collision, line-of-sight and path-finding code.

import { TUNING } from "./tuning.js";
import type { FoodKind, SurfaceColor } from "./types.js";

export interface Tile { x: number; y: number; }
export interface Vec2 { x: number; z: number; }

/** A connected area of B (big furniture) or T (hide spot) tiles. */
export interface TileGroup {
  kind: "B" | "T";
  /** "x,y" of the group's bounding-box top-left; this is the key used by LevelDef.props. */
  key: string;
  x: number; y: number; w: number; h: number;
  tiles: Tile[];
}

/** Neighbouring D tiles form one door. */
export interface DoorDef { id: string; tiles: Tile[]; latch: Tile | null; }

export interface FoodSpot { kind: FoodKind; tile: Tile; }

export interface Waypoint { n: number; tile: Tile; }

export interface Grid {
  width: number;
  height: number;
  rows: readonly string[];
  spawns: Tile[];
  catStart: Tile | null;
  exits: Tile[];
  /** Sorted by number. */
  waypoints: Waypoint[];
  /** All vents in reading order. */
  vents: Tile[];
  /** 1st with 2nd, 3rd with 4th... A leftover odd vent is not paired. */
  ventPairs: Array<[Tile, Tile]>;
  doors: DoorDef[];
  /** Latches that have no door next to them (a map error). */
  orphanLatches: Tile[];
  latches: Tile[];
  breadbox: Tile[];
  plates: Tile[];
  wires: Tile[];
  smallItems: Tile[];
  heavyItems: Tile[];
  ledges: Tile[];
  food: FoodSpot[];
  squeaks: Tile[];
  roombaDock: Tile | null;
  groups: TileGroup[];
  /** Tile index -> door id, for every D tile. */
  doorIdAt: ReadonlyMap<number, string>;
  /** Tile index -> paired vent tile. */
  ventPartnerAt: ReadonlyMap<number, Tile>;
}

/** Ids of things that are currently open: door ids, and BREADBOX_ID. */
export type OpenSet = ReadonlySet<string>;
export const BREADBOX_ID = "breadbox";
export const ALL_CLOSED: OpenSet = new Set<string>();

/** Every character allowed in a map (PLAN.md Section 5, map legend). */
export const LEGEND = "#.SEZ123456789BT~^DlVW$HCPRYUNrybO";

const FOOD_BY_CHAR: Readonly<Record<string, FoodKind>> = { r: "strawberry", y: "cheese", b: "blueberry" };
const RUG_BY_CHAR: Readonly<Record<string, SurfaceColor>> = { R: "red", Y: "yellow", U: "blue", N: "green" };

const DIRS4: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export function parseMap(map: readonly string[]): Grid {
  const height = map.length;
  const width = map.reduce((w, row) => Math.max(w, row.length), 0);
  const rows = map.map((r) => r.padEnd(width, "#"));

  const g: Grid = {
    width, height, rows,
    spawns: [], catStart: null, exits: [], waypoints: [], vents: [], ventPairs: [],
    doors: [], orphanLatches: [], latches: [], breadbox: [], plates: [], wires: [],
    smallItems: [], heavyItems: [], ledges: [], food: [], squeaks: [], roombaDock: null,
    groups: [], doorIdAt: new Map(), ventPartnerAt: new Map(),
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = rows[y][x];
      const t = { x, y };
      switch (ch) {
        case "S": g.spawns.push(t); break;
        case "Z": g.catStart = t; break;
        case "E": g.exits.push(t); break;
        case "V": g.vents.push(t); break;
        case "l": g.latches.push(t); break;
        case "C": g.breadbox.push(t); break;
        case "P": g.plates.push(t); break;
        case "W": g.wires.push(t); break;
        case "$": g.smallItems.push(t); break;
        case "H": g.heavyItems.push(t); break;
        case "^": g.ledges.push(t); break;
        case "~": g.squeaks.push(t); break;
        case "O": g.roombaDock = t; break;
        default:
          if (ch >= "1" && ch <= "9") g.waypoints.push({ n: Number(ch), tile: t });
          else if (ch in FOOD_BY_CHAR) g.food.push({ kind: FOOD_BY_CHAR[ch], tile: t });
      }
    }
  }
  g.waypoints.sort((a, b) => a.n - b.n);

  // Vents pair up in reading order.
  const ventPartnerAt = new Map<number, Tile>();
  for (let i = 0; i + 1 < g.vents.length; i += 2) {
    const a = g.vents[i], b = g.vents[i + 1];
    g.ventPairs.push([a, b]);
    ventPartnerAt.set(a.y * width + a.x, b);
    ventPartnerAt.set(b.y * width + b.x, a);
  }
  g.ventPartnerAt = ventPartnerAt;

  // Doors: connected D tiles.
  const doorIdAt = new Map<number, string>();
  for (const comp of components(rows, width, height, (ch) => ch === "D")) {
    const id = `door${g.doors.length}`;
    g.doors.push({ id, tiles: comp, latch: null });
    for (const t of comp) doorIdAt.set(t.y * width + t.x, id);
  }
  g.doorIdAt = doorIdAt;
  for (const l of g.latches) {
    let door: DoorDef | undefined;
    for (const [dx, dy] of DIRS4) {
      const id = doorIdAt.get((l.y + dy) * width + (l.x + dx));
      if (id && inBounds(g, l.x + dx, l.y + dy)) { door = g.doors.find((d) => d.id === id); break; }
    }
    if (door) door.latch = l; else g.orphanLatches.push(l);
  }

  // Furniture groups.
  for (const kind of ["B", "T"] as const) {
    for (const comp of components(rows, width, height, (ch) => ch === kind)) {
      const xs = comp.map((t) => t.x), ys = comp.map((t) => t.y);
      const x = Math.min(...xs), y = Math.min(...ys);
      g.groups.push({
        kind, key: `${x},${y}`, x, y,
        w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1, tiles: comp,
      });
    }
  }
  return g;
}

/** 4-connected components of tiles whose character matches, in reading order. */
function components(rows: readonly string[], width: number, height: number,
                    match: (ch: string) => boolean): Tile[][] {
  const seen = new Uint8Array(width * height);
  const out: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (seen[y * width + x] || !match(rows[y][x])) continue;
      const comp: Tile[] = [];
      const stack: Tile[] = [{ x, y }];
      seen[y * width + x] = 1;
      while (stack.length) {
        const t = stack.pop()!;
        comp.push(t);
        for (const [dx, dy] of DIRS4) {
          const nx = t.x + dx, ny = t.y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const i = ny * width + nx;
          if (seen[i] || !match(rows[ny][nx])) continue;
          seen[i] = 1;
          stack.push({ x: nx, y: ny });
        }
      }
      comp.sort((a, b) => a.y - b.y || a.x - b.x);
      out.push(comp);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tile queries
// ---------------------------------------------------------------------------

export function inBounds(g: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < g.width && y < g.height;
}

/** The map character at (x, y). Outside the map counts as wall. */
export function charAt(g: Grid, x: number, y: number): string {
  return inBounds(g, x, y) ? g.rows[y][x] : "#";
}

export function tileIndex(g: Grid, x: number, y: number): number { return y * g.width + x; }
export function tileFromIndex(g: Grid, i: number): Tile { return { x: i % g.width, y: Math.floor(i / g.width) }; }
export function worldToTile(x: number, z: number): Tile { return { x: Math.floor(x), y: Math.floor(z) }; }
export function tileCenter(t: Tile): Vec2 { return { x: t.x + 0.5, z: t.y + 0.5 }; }

export function doorIdAt(g: Grid, x: number, y: number): string | undefined {
  return inBounds(g, x, y) ? g.doorIdAt.get(tileIndex(g, x, y)) : undefined;
}

export function ventPartner(g: Grid, x: number, y: number): Tile | undefined {
  return inBounds(g, x, y) ? g.ventPartnerAt.get(tileIndex(g, x, y)) : undefined;
}

export function surfaceColorAt(g: Grid, x: number, y: number): SurfaceColor | null {
  return RUG_BY_CHAR[charAt(g, x, y)] ?? null;
}

/** Solid for everyone: wall, big furniture, ledge, wire, closed door, closed breadbox. */
export function isSolidForPlayer(g: Grid, x: number, y: number, open: OpenSet = ALL_CLOSED): boolean {
  const ch = charAt(g, x, y);
  switch (ch) {
    case "#": case "B": case "^": case "W": return true;
    case "D": return !open.has(doorIdAt(g, x, y) ?? "");
    case "C": return !open.has(BREADBOX_ID);
    default: return false;
  }
}

export function isWalkableForPlayer(g: Grid, x: number, y: number, open: OpenSet = ALL_CLOSED): boolean {
  return !isSolidForPlayer(g, x, y, open);
}

/** The cat can't enter hide spots (T) or the exit gaps (E). */
export function isWalkableForCat(g: Grid, x: number, y: number, open: OpenSet = ALL_CLOSED): boolean {
  if (isSolidForPlayer(g, x, y, open)) return false;
  const ch = charAt(g, x, y);
  return ch !== "T" && ch !== "E";
}

/** Walls, furniture, ledges, wires, closed doors and the closed breadbox block vision. T tiles don't. */
export function blocksVision(g: Grid, x: number, y: number, open: OpenSet = ALL_CLOSED): boolean {
  return isSolidForPlayer(g, x, y, open);
}

// ---------------------------------------------------------------------------
// Collision: circle against tile boxes
// ---------------------------------------------------------------------------

export type SolidFn = (x: number, y: number) => boolean;

export function playerSolid(g: Grid, open: OpenSet = ALL_CLOSED): SolidFn {
  return (x, y) => isSolidForPlayer(g, x, y, open);
}

export function catSolid(g: Grid, open: OpenSet = ALL_CLOSED): SolidFn {
  return (x, y) => !isWalkableForCat(g, x, y, open);
}

const EPS = 1e-6;

/** True if a circle at (x, z) overlaps any solid tile. */
export function circleOverlapsSolid(x: number, z: number, r: number, solid: SolidFn): boolean {
  for (let ty = Math.floor(z - r); ty <= Math.floor(z + r); ty++) {
    for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
      if (!solid(tx, ty)) continue;
      const cx = clamp(x, tx, tx + 1), cz = clamp(z, ty, ty + 1);
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < r * r - EPS) return true;
    }
  }
  return false;
}

/** Push a circle out of every solid tile it overlaps. */
export function resolveCircle(x: number, z: number, r: number, solid: SolidFn): Vec2 {
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (let ty = Math.floor(z - r); ty <= Math.floor(z + r); ty++) {
      for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
        if (!solid(tx, ty)) continue;
        const cx = clamp(x, tx, tx + 1), cz = clamp(z, ty, ty + 1);
        const dx = x - cx, dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-12) {
          const d = Math.sqrt(d2);
          const push = r - d + EPS;
          x += (dx / d) * push;
          z += (dz / d) * push;
        } else {
          // Centre is inside the tile: leave by the shortest way out.
          const left = x - tx, right = tx + 1 - x, top = z - ty, bottom = ty + 1 - z;
          const m = Math.min(left, right, top, bottom);
          if (m === left) x = tx - r - EPS;
          else if (m === right) x = tx + 1 + r + EPS;
          else if (m === top) z = ty - r - EPS;
          else z = ty + 1 + r + EPS;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x, z };
}

/**
 * Move a circle by (dx, dz): move on X and resolve, then move on Z and resolve.
 * Long moves are split into small steps so nothing tunnels through a wall.
 */
export function moveCircle(pos: Vec2, dx: number, dz: number, r: number, solid: SolidFn): Vec2 {
  const maxStep = r * 0.8;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / maxStep));
  let p: Vec2 = { x: pos.x, z: pos.z };
  for (let i = 0; i < steps; i++) {
    p = resolveCircle(p.x + dx / steps, p.z, r, solid);
    p = resolveCircle(p.x, p.z + dz / steps, r, solid);
  }
  return p;
}

/** Convenience: move a player-sized circle on a grid. */
export function movePlayer(g: Grid, pos: Vec2, dx: number, dz: number, open: OpenSet = ALL_CLOSED): Vec2 {
  return moveCircle(pos, dx, dz, TUNING.player.radius, playerSolid(g, open));
}

// ---------------------------------------------------------------------------
// Raycast (DDA grid traversal)
// ---------------------------------------------------------------------------

export interface RayHit {
  hit: boolean;
  /** The blocking tile, or null. */
  tile: Tile | null;
  /** Distance travelled before the hit, or the full length when nothing was hit. */
  dist: number;
}

/**
 * Walk every tile the segment (x0,z0)->(x1,z1) passes through, in order, and
 * stop at the first tile for which `blocks` is true. A ray passing exactly
 * through a corner between two blocking tiles is blocked.
 */
export function raycast(x0: number, z0: number, x1: number, z1: number, blocks: SolidFn): RayHit {
  let tx = Math.floor(x0), ty = Math.floor(z0);
  const endX = Math.floor(x1), endY = Math.floor(z1);
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (blocks(tx, ty)) return { hit: true, tile: { x: tx, y: ty }, dist: 0 };
  if (len === 0) return { hit: false, tile: null, dist: 0 };

  const stepX = Math.sign(dx), stepY = Math.sign(dz);
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tMaxX = dx > 0 ? (tx + 1 - x0) / dx : dx < 0 ? (x0 - tx) / -dx : Infinity;
  let tMaxY = dz > 0 ? (ty + 1 - z0) / dz : dz < 0 ? (z0 - ty) / -dz : Infinity;

  let guard = Math.abs(endX - tx) + Math.abs(endY - ty) + 2;
  while ((tx !== endX || ty !== endY) && guard-- > 0) {
    let t: number;
    if (tMaxX < tMaxY) {
      t = tMaxX; tMaxX += tDeltaX; tx += stepX;
    } else if (tMaxY < tMaxX) {
      t = tMaxY; tMaxY += tDeltaY; ty += stepY;
    } else {
      // Exactly through a corner.
      t = tMaxX;
      if (blocks(tx + stepX, ty) && blocks(tx, ty + stepY)) {
        return { hit: true, tile: { x: tx + stepX, y: ty }, dist: t * len };
      }
      tMaxX += tDeltaX; tMaxY += tDeltaY; tx += stepX; ty += stepY;
    }
    if (t > 1) break;
    if (blocks(tx, ty)) return { hit: true, tile: { x: tx, y: ty }, dist: t * len };
  }
  return { hit: false, tile: null, dist: len };
}

export function hasLineOfSight(g: Grid, a: Vec2, b: Vec2, open: OpenSet = ALL_CLOSED): boolean {
  return !raycast(a.x, a.z, b.x, b.z, (x, y) => blocksVision(g, x, y, open)).hit;
}

/** True if a wall tile (#) lies on the straight line between a and b (used to muffle sound). */
export function wallBetween(g: Grid, a: Vec2, b: Vec2): boolean {
  return raycast(a.x, a.z, b.x, b.z, (x, y) => charAt(g, x, y) === "#").hit;
}

// ---------------------------------------------------------------------------
// A* path finding (8 directions, no corner cutting)
// ---------------------------------------------------------------------------

/**
 * Shortest path from start to goal over passable tiles. Returns the tiles to
 * walk through, excluding start and including goal ([] if start === goal),
 * or null if the goal can't be reached.
 */
export function findPath(g: Grid, start: Tile, goal: Tile, passable: SolidFn): Tile[] | null {
  if (!inBounds(g, start.x, start.y) || !inBounds(g, goal.x, goal.y)) return null;
  if (!passable(goal.x, goal.y)) return null;
  if (start.x === goal.x && start.y === goal.y) return [];

  const n = g.width * g.height;
  const gScore = new Float64Array(n).fill(Infinity);
  const fScore = new Float64Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const inOpen = new Uint8Array(n);
  const open: number[] = [];

  const h = (x: number, y: number): number => {
    const dx = Math.abs(x - goal.x), dy = Math.abs(y - goal.y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };

  const s = tileIndex(g, start.x, start.y);
  const goalI = tileIndex(g, goal.x, goal.y);
  gScore[s] = 0; fScore[s] = h(start.x, start.y);
  open.push(s); inOpen[s] = 1;

  while (open.length) {
    // The grids are small (at most a few hundred tiles), so a linear scan is fine.
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[bi]]) bi = i;
    const cur = open[bi];
    open[bi] = open[open.length - 1]; open.pop();
    inOpen[cur] = 0;
    if (cur === goalI) break;
    closed[cur] = 1;
    const cx = cur % g.width, cy = (cur - cx) / g.width;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!inBounds(g, nx, ny) || !passable(nx, ny)) continue;
        if (dx !== 0 && dy !== 0 && (!passable(cx + dx, cy) || !passable(cx, cy + dy))) continue;
        const ni = tileIndex(g, nx, ny);
        if (closed[ni]) continue;
        const tentative = gScore[cur] + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
        if (tentative >= gScore[ni]) continue;
        parent[ni] = cur;
        gScore[ni] = tentative;
        fScore[ni] = tentative + h(nx, ny);
        if (!inOpen[ni]) { open.push(ni); inOpen[ni] = 1; }
      }
    }
  }

  if (parent[goalI] === -1) return null;
  const path: Tile[] = [];
  for (let i = goalI; i !== s; i = parent[i]) path.push(tileFromIndex(g, i));
  return path.reverse();
}

// ---------------------------------------------------------------------------
// Reachability (flood fill) and the exit zone
// ---------------------------------------------------------------------------

export interface FloodOptions {
  /** Treat paired vents as connected (Mochi). */
  vents?: boolean;
}

/** Every tile reachable from `starts` by 4-neighbour steps over passable tiles. */
export function floodFill(g: Grid, starts: readonly Tile[], passable: SolidFn,
                          opts: FloodOptions = {}): Set<number> {
  const seen = new Set<number>();
  const queue: Tile[] = [];
  const visit = (t: Tile): void => {
    if (!inBounds(g, t.x, t.y) || !passable(t.x, t.y)) return;
    const i = tileIndex(g, t.x, t.y);
    if (seen.has(i)) return;
    seen.add(i);
    queue.push(t);
  };
  starts.forEach(visit);
  while (queue.length) {
    const t = queue.shift()!;
    for (const [dx, dy] of DIRS4) visit({ x: t.x + dx, y: t.y + dy });
    if (opts.vents) {
      const partner = ventPartner(g, t.x, t.y);
      if (partner) visit(partner);
    }
  }
  return seen;
}

/** The E tiles plus every player-walkable tile within TUNING.exit.zoneRange of an E tile. */
export function exitZone(g: Grid, open: OpenSet = ALL_CLOSED): Set<number> {
  const zone = new Set<number>();
  const range = TUNING.exit.zoneRange;
  const reach = Math.ceil(range);
  for (const e of g.exits) {
    zone.add(tileIndex(g, e.x, e.y));
    for (let y = e.y - reach; y <= e.y + reach; y++) {
      for (let x = e.x - reach; x <= e.x + reach; x++) {
        if (!inBounds(g, x, y) || !isWalkableForPlayer(g, x, y, open)) continue;
        if (Math.hypot(x - e.x, y - e.y) <= range) zone.add(tileIndex(g, x, y));
      }
    }
  }
  return zone;
}

export function inZone(g: Grid, zone: ReadonlySet<number>, x: number, z: number): boolean {
  const t = worldToTile(x, z);
  return inBounds(g, t.x, t.y) && zone.has(tileIndex(g, t.x, t.y));
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
