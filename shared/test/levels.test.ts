// The map checks from PLAN.md Section 5. If any map breaks them, the build fails.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LEVELS, type Grid, type Tile, getLevel, parseMap, playerReach, reachableOrAdjacent,
  tileIndex, validateMap,
} from "../src/index.js";

describe.each(LEVELS.map((l) => [l.id, l.name, l] as const))("Level %i — %s", (_id, _name, level) => {
  it("passes every map check", () => {
    expect(validateMap(level.map)).toEqual([]);
  });

  it("every props key points at a B or T group", () => {
    const g = parseMap(level.map);
    const keys = new Set(g.groups.map((gr) => gr.key));
    for (const key of Object.keys(level.props)) expect(keys, `props key ${key}`).toContain(key);
  });

  it("lights sit inside the map", () => {
    const g = parseMap(level.map);
    for (const l of level.lights) {
      expect(l.x).toBeGreaterThan(0); expect(l.x).toBeLessThan(g.width);
      expect(l.z).toBeGreaterThan(0); expect(l.z).toBeLessThan(g.height);
    }
  });

  it("the cat's base mode has what it needs", () => {
    const g = parseMap(level.map);
    if (level.cat.mode === "patrol") expect(g.waypoints.length).toBeGreaterThanOrEqual(2);
    if (level.cat.mode === "sleep") expect(level.cat.wakeAt).toBeTypeOf("number");
  });
});

describe("map checks catch broken maps", () => {
  const good = getLevel(1).map;

  it("ragged rows", () => {
    const bad = [...good]; bad[3] = bad[3].slice(0, -1);
    expect(validateMap(bad).join()).toMatch(/wide/);
  });

  it("wrong spawn count", () => {
    const bad = good.map((r) => r.replace("S", "."));
    expect(validateMap(bad).join()).toMatch(/3 spawns/);
  });

  it("an exit that isn't on the border, and a hole in the border", () => {
    const bad = [...good];
    bad[5] = bad[5].slice(0, 3) + "E" + bad[5].slice(4);
    bad[0] = "." + bad[0].slice(1);
    const errors = validateMap(bad).join("\n");
    expect(errors).toMatch(/not on the border/);
    expect(errors).toMatch(/must be # or E/);
  });

  it("a spawn walled in", () => {
    const bad = [...good];
    // Box in the spawn at (1, 1): (2, 1) and (1, 2) become walls.
    bad[1] = "#S#" + bad[1].slice(3);
    bad[2] = "##" + bad[2].slice(2);
    expect(validateMap(bad).join()).toMatch(/spawn \(1, 1\) can't reach an exit/);
  });

  it("an odd number of vents", () => {
    const bad = [...good]; bad[2] = "#V" + bad[2].slice(2);
    expect(validateMap(bad).join()).toMatch(/even number of vents/);
  });
});

// 6. Gating works as intended.
describe("gating", () => {
  const reaches = (g: Grid, targets: Tile[], doorsOpen: boolean, vents: boolean): boolean => {
    const reach = playerReach(g, { doorsOpen, vents });
    return targets.every((t) => reachableOrAdjacent(g, reach, t));
  };

  it("Level 4: the study is reached only through the door or the vent", () => {
    const g = parseMap(getLevel(4).map);
    const study = [...g.smallItems, ...g.exits];
    expect(reaches(g, study, false, false)).toBe(false);
    expect(reaches(g, study, true, false)).toBe(true);
    expect(reaches(g, study, false, true)).toBe(true);
  });

  it("Level 8: the kitchen is reached only through the door or the vent", () => {
    const g = parseMap(getLevel(8).map);
    const kitchen = [...g.plates, ...g.breadbox, ...g.wires];
    expect(kitchen.length).toBeGreaterThan(0);
    expect(reaches(g, kitchen, false, false)).toBe(false);
    expect(reaches(g, kitchen, true, false)).toBe(true);
    expect(reaches(g, kitchen, false, true)).toBe(true);
  });

  it("Level 5: the blueberry closet is reached only through the vent", () => {
    const g = parseMap(getLevel(5).map);
    const closet = g.food.filter((f) => f.kind === "blueberry").map((f) => f.tile);
    expect(closet.length).toBe(2);
    const reach = playerReach(g, { doorsOpen: true, vents: false });
    expect(closet.some((t) => reach.has(tileIndex(g, t.x, t.y)))).toBe(false);
    expect(reaches(g, closet, true, true)).toBe(true);
  });

  it("Level 5: the pet door must be picked to reach the exit", () => {
    const g = parseMap(getLevel(5).map);
    const reachClosed = playerReach(g, { doorsOpen: false, vents: true });
    expect(g.exits.some((e) => reachClosed.has(tileIndex(g, e.x, e.y)))).toBe(false);
    expect(reaches(g, g.exits, true, true)).toBe(true);
  });
});

// The maps must match PLAN.md character for character.
const planPath = fileURLToPath(new URL("../../PLAN.md", import.meta.url));
describe.skipIf(!existsSync(planPath))("maps match PLAN.md", () => {
  const plan = existsSync(planPath) ? readFileSync(planPath, "utf8") : "";
  const parts = plan.split(/^### Level (\d) — .*\((\d+)×(\d+)\)\s*$/m);
  const fromPlan = new Map<number, { map: string[]; w: number; h: number }>();
  // split() with 3 capture groups gives [before, n, w, h, body, n, w, h, body, ...].
  for (let i = 1; i + 3 < parts.length; i += 4) {
    const block = parts[i + 3]?.match(/```\r?\n([\s\S]*?)```/);
    if (block) {
      fromPlan.set(Number(parts[i]), {
        map: block[1].split(/\r?\n/).filter((l) => l.length > 0),
        w: Number(parts[i + 1]), h: Number(parts[i + 2]),
      });
    }
  }

  it("finds all 8 maps in PLAN.md", () => {
    expect([...fromPlan.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it.each(LEVELS.map((l) => [l.id, l] as const))("Level %i", (id, level) => {
    const p = fromPlan.get(id)!;
    expect(level.map).toEqual(p.map);
    expect(level.map.length).toBe(p.h);
    expect(level.map[0].length).toBe(p.w);
  });
});
