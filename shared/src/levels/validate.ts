// Map checks from PLAN.md Section 5. Used by shared/test/levels.test.ts so a
// broken map fails the build, and handy in dev tools too.

import {
  type Grid, type OpenSet, type Tile, ALL_CLOSED, BREADBOX_ID, LEGEND,
  charAt, floodFill, isWalkableForCat, isWalkableForPlayer, parseMap, tileIndex,
} from "../grid.js";

/** Open every door (and the breadbox) in a grid. */
export function allOpen(g: Grid): OpenSet {
  return new Set<string>([...g.doors.map((d) => d.id), BREADBOX_ID]);
}

export interface ReachOptions { doorsOpen: boolean; vents: boolean; }

/** Tiles a player can reach from the spawns. */
export function playerReach(g: Grid, opts: ReachOptions): Set<number> {
  const open = opts.doorsOpen ? allOpen(g) : ALL_CLOSED;
  // The breadbox only opens through the plates, so reachability never walks through it.
  const doorsOnly: OpenSet = new Set([...open].filter((id) => id !== BREADBOX_ID));
  return floodFill(g, g.spawns, (x, y) => isWalkableForPlayer(g, x, y, doorsOnly), { vents: opts.vents });
}

/** True if tile t is reachable, or 4-next to a reachable tile. */
export function reachableOrAdjacent(g: Grid, reach: ReadonlySet<number>, t: Tile): boolean {
  const near: Tile[] = [t, { x: t.x + 1, y: t.y }, { x: t.x - 1, y: t.y }, { x: t.x, y: t.y + 1 }, { x: t.x, y: t.y - 1 }];
  return near.some((n) => n.x >= 0 && n.y >= 0 && n.x < g.width && n.y < g.height && reach.has(tileIndex(g, n.x, n.y)));
}

const fmt = (t: Tile): string => `(${t.x}, ${t.y})`;

/** Returns a list of problems; an empty list means the map is valid. */
export function validateMap(map: readonly string[]): string[] {
  const errors: string[] = [];

  // 1. Every row has the same width.
  const width = map[0]?.length ?? 0;
  map.forEach((row, y) => {
    if (row.length !== width) errors.push(`row ${y} is ${row.length} wide, expected ${width}`);
  });
  if (errors.length) return errors; // the rest assumes a rectangle

  const g = parseMap(map);

  // Every character must be in the legend.
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      if (!LEGEND.includes(charAt(g, x, y))) errors.push(`unknown symbol '${charAt(g, x, y)}' at ${fmt({ x, y })}`);
    }
  }

  // 2. Exactly 3 S and exactly 1 Z; an even number of V.
  if (g.spawns.length !== 3) errors.push(`expected 3 spawns (S), found ${g.spawns.length}`);
  const zCount = map.join("").split("Z").length - 1;
  if (zCount !== 1) errors.push(`expected 1 cat start (Z), found ${zCount}`);
  if (g.vents.length % 2 !== 0) errors.push(`expected an even number of vents (V), found ${g.vents.length}`);

  // 3. The outer border is only # and E, and every E is on the border.
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const border = x === 0 || y === 0 || x === g.width - 1 || y === g.height - 1;
      const ch = charAt(g, x, y);
      if (border && ch !== "#" && ch !== "E") errors.push(`border tile ${fmt({ x, y })} is '${ch}', must be # or E`);
      if (!border && ch === "E") errors.push(`exit E at ${fmt({ x, y })} is not on the border`);
    }
  }
  if (g.exits.length === 0) errors.push("no exit (E)");

  // Latches must sit next to a door; waypoints must be numbered 1, 2, 3... with no gaps or repeats.
  for (const l of g.orphanLatches) errors.push(`latch at ${fmt(l)} has no door next to it`);
  if (g.waypoints.some((w, i) => w.n !== i + 1)) {
    errors.push(`waypoints must be numbered 1..n without gaps; found ${g.waypoints.map((v) => v.n).join(",")}`);
  }

  // 4. With doors open and vents usable, every spawn can reach an exit, and
  //    every $ H ^ P W C l is reachable or next to a reachable tile.
  const open = allOpen(g);
  const doorsOnly: OpenSet = new Set([...open].filter((id) => id !== BREADBOX_ID));
  for (const s of g.spawns) {
    const reach = floodFill(g, [s], (x, y) => isWalkableForPlayer(g, x, y, doorsOnly), { vents: true });
    if (!g.exits.some((e) => reach.has(tileIndex(g, e.x, e.y)))) errors.push(`spawn ${fmt(s)} can't reach an exit`);
  }
  const reach = playerReach(g, { doorsOpen: true, vents: true });
  const targets: Array<[string, Tile[]]> = [
    ["$", g.smallItems], ["H", g.heavyItems], ["^", g.ledges], ["P", g.plates],
    ["W", g.wires], ["C", g.breadbox], ["l", g.latches],
  ];
  for (const [sym, tiles] of targets) {
    for (const t of tiles) {
      if (!reachableOrAdjacent(g, reach, t)) errors.push(`'${sym}' at ${fmt(t)} can't be reached`);
    }
  }

  // 5. The cat can reach every waypoint from Z (doors closed: the cat stays in its room).
  if (g.catStart) {
    const catReach = floodFill(g, [g.catStart], (x, y) => isWalkableForCat(g, x, y, ALL_CLOSED));
    for (const w of g.waypoints) {
      if (!catReach.has(tileIndex(g, w.tile.x, w.tile.y))) errors.push(`cat can't reach waypoint ${w.n} at ${fmt(w.tile)}`);
    }
  }

  return errors;
}
