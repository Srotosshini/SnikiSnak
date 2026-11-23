import { describe, expect, it } from "vitest";
import {
  ALL_CLOSED, BREADBOX_ID, TUNING, blocksVision, charAt, circleOverlapsSolid, exitZone, findPath,
  getLevel, hasLineOfSight, inZone, isSolidForPlayer, isWalkableForCat, isWalkableForPlayer,
  movePlayer, parseMap, playerSolid, raycast, surfaceColorAt, tileCenter, ventPartner, wallBetween,
} from "../src/index.js";

const TEST_MAP = [
  "##########",
  "#S..T..#V#",
  "#S..T.##.#",
  "#S.....#.E",
  "#..B...D.E",
  "#V.B..ZDl#",
  "##########",
];

describe("parseMap", () => {
  const g = parseMap(TEST_MAP);

  it("reads size and special tiles", () => {
    expect(g.width).toBe(10);
    expect(g.height).toBe(7);
    expect(g.spawns).toEqual([{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }]);
    expect(g.catStart).toEqual({ x: 6, y: 5 });
    expect(g.exits).toEqual([{ x: 9, y: 3 }, { x: 9, y: 4 }]);
  });

  it("joins neighbouring D tiles into one door and finds its latch", () => {
    expect(g.doors).toHaveLength(1);
    expect(g.doors[0].tiles).toEqual([{ x: 7, y: 4 }, { x: 7, y: 5 }]);
    expect(g.doors[0].latch).toEqual({ x: 8, y: 5 });
    expect(g.orphanLatches).toEqual([]);
  });

  it("pairs vents in reading order", () => {
    expect(ventPartner(g, 8, 1)).toEqual({ x: 1, y: 5 });
    expect(ventPartner(g, 1, 5)).toEqual({ x: 8, y: 1 });
    expect(ventPartner(g, 2, 2)).toBeUndefined();
  });

  it("groups B and T tiles", () => {
    const keys = g.groups.map((gr) => `${gr.kind}${gr.key}:${gr.w}x${gr.h}`);
    expect(keys).toEqual(["B3,4:1x2", "T4,1:1x2"]);
  });

  it("treats outside the map as wall", () => {
    expect(charAt(g, -1, 0)).toBe("#");
    expect(charAt(g, 100, 100)).toBe("#");
  });

  it("reads rug colours", () => {
    const rugs = parseMap(["#####", "#RYU#", "#NS.#", "#####"]);
    expect(surfaceColorAt(rugs, 1, 1)).toBe("red");
    expect(surfaceColorAt(rugs, 2, 1)).toBe("yellow");
    expect(surfaceColorAt(rugs, 3, 1)).toBe("blue");
    expect(surfaceColorAt(rugs, 1, 2)).toBe("green");
    expect(surfaceColorAt(rugs, 2, 2)).toBeNull();
  });
});

describe("tile rules", () => {
  const g = parseMap(TEST_MAP);
  const doorOpen = new Set([g.doors[0].id]);

  it("walls and furniture are solid; hide spots are not", () => {
    expect(isSolidForPlayer(g, 0, 0)).toBe(true);
    expect(isSolidForPlayer(g, 3, 4)).toBe(true);
    expect(isWalkableForPlayer(g, 4, 1)).toBe(true);
  });

  it("doors are solid until opened", () => {
    expect(isSolidForPlayer(g, 7, 4, ALL_CLOSED)).toBe(true);
    expect(isSolidForPlayer(g, 7, 4, doorOpen)).toBe(false);
    expect(blocksVision(g, 7, 4, ALL_CLOSED)).toBe(true);
    expect(blocksVision(g, 7, 4, doorOpen)).toBe(false);
  });

  it("the breadbox opens too", () => {
    const bb = parseMap(["#####", "#CC.#", "#CC.#", "#####"]);
    expect(isSolidForPlayer(bb, 1, 1)).toBe(true);
    expect(isSolidForPlayer(bb, 1, 1, new Set([BREADBOX_ID]))).toBe(false);
  });

  it("the cat can't enter hide spots or exits", () => {
    expect(isWalkableForCat(g, 4, 1)).toBe(false);
    expect(isWalkableForCat(g, 9, 3)).toBe(false);
    expect(isWalkableForCat(g, 5, 1)).toBe(true);
  });
});

describe("collision", () => {
  const g = parseMap(TEST_MAP);
  const r = TUNING.player.radius;

  it("stops at a wall", () => {
    const p = movePlayer(g, { x: 2.5, z: 1.5 }, 0, -2);
    expect(p.z).toBeCloseTo(1 + r, 4);
    expect(p.x).toBeCloseTo(2.5, 6);
  });

  it("slides along a wall when moving diagonally", () => {
    const p = movePlayer(g, { x: 2.5, z: 1.5 }, 0.5, -1);
    expect(p.z).toBeCloseTo(1 + r, 4);
    expect(p.x).toBeCloseTo(3.0, 4);
  });

  it("can't pass through furniture", () => {
    // B at (3, 4) and (3, 5). Walk east from (2.5, 4.5).
    const p = movePlayer(g, { x: 2.5, z: 4.5 }, 2, 0);
    expect(p.x).toBeCloseTo(3 - r, 4);
  });

  it("walks under hide spots", () => {
    const p = movePlayer(g, { x: 3.5, z: 1.5 }, 1, 0);
    expect(p.x).toBeCloseTo(4.5, 6);
  });

  it("doesn't tunnel through a wall on a huge move", () => {
    const p = movePlayer(g, { x: 5.5, z: 3.5 }, 10, 0);
    expect(p.x).toBeLessThan(7 - r + 1e-3);
  });

  it("passes through an open door", () => {
    const open = new Set([g.doors[0].id]);
    const p = movePlayer(g, { x: 6.5, z: 4.5 }, 2, 0, open);
    expect(p.x).toBeCloseTo(8.5, 6);
    const blocked = movePlayer(g, { x: 6.5, z: 4.5 }, 2, 0);
    expect(blocked.x).toBeCloseTo(7 - r, 4);
  });

  it("never ends overlapping a solid tile", () => {
    const solid = playerSolid(g);
    let p = { x: 2.5, z: 3.5 };
    for (let i = 0; i < 400; i++) {
      const a = i * 2.399; // golden-angle walk around the room
      p = movePlayer(g, p, Math.cos(a) * 0.17, Math.sin(a) * 0.17);
      expect(circleOverlapsSolid(p.x, p.z, r, solid)).toBe(false);
    }
  });
});

describe("raycast and line of sight", () => {
  const g = parseMap(TEST_MAP);

  it("sees across open floor", () => {
    expect(hasLineOfSight(g, tileCenter({ x: 2, y: 3 }), tileCenter({ x: 6, y: 3 }))).toBe(true);
  });

  it("furniture blocks sight; hide spots don't", () => {
    expect(hasLineOfSight(g, tileCenter({ x: 2, y: 4 }), tileCenter({ x: 5, y: 4 }))).toBe(false);
    expect(hasLineOfSight(g, tileCenter({ x: 3, y: 1 }), tileCenter({ x: 6, y: 1 }))).toBe(true);
  });

  it("closed doors block sight; open doors don't", () => {
    const a = tileCenter({ x: 5, y: 4 }), b = tileCenter({ x: 8, y: 4 });
    expect(hasLineOfSight(g, a, b)).toBe(false);
    expect(hasLineOfSight(g, a, b, new Set([g.doors[0].id]))).toBe(true);
  });

  it("reports the first blocking tile", () => {
    const hit = raycast(2.5, 4.5, 6.5, 4.5, (x, y) => blocksVision(g, x, y));
    expect(hit.hit).toBe(true);
    expect(hit.tile).toEqual({ x: 3, y: 4 });
    expect(hit.dist).toBeCloseTo(0.5, 6);
  });

  it("walks diagonals and steep lines", () => {
    const empty = parseMap(["######", "#....#", "#....#", "#....#", "######"]);
    const visited: string[] = [];
    raycast(1.5, 1.5, 4.5, 3.2, (x, y) => { visited.push(`${x},${y}`); return false; });
    expect(visited[0]).toBe("1,1");
    expect(visited[visited.length - 1]).toBe("4,3");
    // Each step moves one tile horizontally or vertically.
    for (let i = 1; i < visited.length; i++) {
      const [ax, ay] = visited[i - 1].split(",").map(Number);
      const [bx, by] = visited[i].split(",").map(Number);
      expect(Math.abs(bx - ax) + Math.abs(by - ay)).toBe(1);
    }
    expect(hasLineOfSight(empty, { x: 1.5, z: 1.5 }, { x: 4.5, z: 3.5 })).toBe(true);
  });

  it("is blocked by a diagonal gap between two solid tiles", () => {
    const m = parseMap(["#####", "#.B.#", "#B..#", "#####"]);
    expect(hasLineOfSight(m, { x: 1.5, z: 1.5 }, { x: 2.5, z: 2.5 })).toBe(false);
  });

  it("the Level 2 sideboard blocks the cat's view", () => {
    const l2 = parseMap(getLevel(2).map);
    // From above the right sideboard (15, 3) to below it (15, 7).
    expect(hasLineOfSight(l2, tileCenter({ x: 15, y: 3 }), tileCenter({ x: 15, y: 7 }))).toBe(false);
    // Down the middle gap (10, 3) -> (10, 8) is clear.
    expect(hasLineOfSight(l2, tileCenter({ x: 10, y: 3 }), tileCenter({ x: 10, y: 8 }))).toBe(true);
  });

  it("finds walls between two points for sound muffling", () => {
    expect(wallBetween(g, tileCenter({ x: 5, y: 1 }), tileCenter({ x: 5, y: 3 }))).toBe(false);
    expect(wallBetween(g, tileCenter({ x: 5, y: 3 }), tileCenter({ x: 8, y: 1 }))).toBe(true);
  });
});

describe("A* path finding", () => {
  const g = parseMap(TEST_MAP);
  const catPass = (x: number, y: number): boolean => isWalkableForCat(g, x, y);

  it("returns [] when already there and null when unreachable", () => {
    expect(findPath(g, { x: 2, y: 2 }, { x: 2, y: 2 }, catPass)).toEqual([]);
    expect(findPath(g, { x: 2, y: 2 }, { x: 8, y: 3 }, catPass)).toBeNull(); // behind the closed door
    expect(findPath(g, { x: 2, y: 2 }, { x: 4, y: 1 }, catPass)).toBeNull(); // goal is a hide spot
  });

  it("finds a shortest 8-direction path without cutting corners", () => {
    const path = findPath(g, { x: 2, y: 1 }, { x: 6, y: 5 }, catPass)!;
    expect(path).not.toBeNull();
    expect(path[path.length - 1]).toEqual({ x: 6, y: 5 });
    let prev = { x: 2, y: 1 };
    for (const t of path) {
      const dx = t.x - prev.x, dy = t.y - prev.y;
      expect(Math.max(Math.abs(dx), Math.abs(dy))).toBe(1);
      expect(catPass(t.x, t.y)).toBe(true);
      if (dx !== 0 && dy !== 0) {
        expect(catPass(prev.x + dx, prev.y)).toBe(true);
        expect(catPass(prev.x, prev.y + dy)).toBe(true);
      }
      prev = t;
    }
    // The T column at x = 4 (rows 1-2) blocks the cat, so it goes around below it.
    expect(path.length).toBe(5);
  });

  it("finds the cat's Level 2 patrol legs", () => {
    const l2 = parseMap(getLevel(2).map);
    const pass = (x: number, y: number): boolean => isWalkableForCat(l2, x, y);
    const wps = l2.waypoints.map((w) => w.tile);
    for (let i = 0; i < wps.length; i++) {
      expect(findPath(l2, wps[i], wps[(i + 1) % wps.length], pass)).not.toBeNull();
    }
  });
});

describe("exit zone", () => {
  it("covers the E tiles and walkable tiles within 1.5 tiles", () => {
    const g = parseMap(TEST_MAP);
    const zone = exitZone(g);
    expect(inZone(g, zone, 9.5, 3.5)).toBe(true);     // E
    expect(inZone(g, zone, 8.5, 3.5)).toBe(true);     // next to E
    expect(inZone(g, zone, 8.5, 2.5)).toBe(true);     // diagonal, 1.41 away
    expect(inZone(g, zone, 6.5, 3.5)).toBe(false);    // too far
    expect(inZone(g, zone, 7.5, 4.5)).toBe(false);    // closed door is not walkable
  });
});
