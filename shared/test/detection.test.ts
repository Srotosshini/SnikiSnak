// Detection and hearing maths (PLAN.md Sections 4.2–4.4).

import { describe, expect, it } from "vitest";
import {
  TUNING, canSee, detectionRate, getLevel, hearingGain, hiddenInHideSpot, inCone, lightAt,
  parseMap, tileCenter, updateMeter,
} from "../src/index.js";

const base = { distance: 0, range: 6, sneaking: false, still: false, light: "normal", carry: "none" } as const;

describe("detection rate", () => {
  it("is 1.6 per second right next to the cat in normal light", () => {
    expect(detectionRate(base)).toBeCloseTo(1.6, 9);
  });

  it("falls off with distance: 0.3× the base at the edge of range", () => {
    expect(detectionRate({ ...base, distance: 6 })).toBeCloseTo(1.6 * 0.3, 9);
    expect(detectionRate({ ...base, distance: 3 })).toBeCloseTo(1.6 * 0.65, 9);
  });

  it("applies every multiplier from Section 4.4", () => {
    expect(detectionRate({ ...base, sneaking: true })).toBeCloseTo(0.8, 9);
    expect(detectionRate({ ...base, still: true })).toBeCloseTo(0.96, 9);
    expect(detectionRate({ ...base, light: "bright" })).toBeCloseTo(2.4, 9);
    expect(detectionRate({ ...base, light: "dark" })).toBeCloseTo(0.96, 9);
    expect(detectionRate({ ...base, carry: "heavy" })).toBeCloseTo(2.08, 9);
    expect(detectionRate({ ...base, carry: "croissant" })).toBeCloseTo(2.56, 9);
    expect(detectionRate({ ...base, blendMoving: true })).toBeCloseTo(0.4, 9);
  });

  it("multiplies them together", () => {
    const r = detectionRate({ ...base, distance: 3, sneaking: true, still: true, light: "dark" });
    expect(r).toBeCloseTo(1.6 * 0.65 * 0.5 * 0.6 * 0.6, 9);
  });

  it("a careless player in the lamp light is spotted in well under a second", () => {
    const r = detectionRate({ ...base, distance: 2, light: "bright" });
    expect(1 / r).toBeLessThan(0.6);
  });
});

describe("detection meter", () => {
  it("rises while visible, drains at 0.35 per second while not, and stays in 0..1", () => {
    expect(updateMeter(0.5, true, 2, 0.1)).toBeCloseTo(0.7, 9);
    expect(updateMeter(0.5, false, 2, 1)).toBeCloseTo(0.15, 9);
    expect(updateMeter(0.95, true, 2, 1)).toBe(1);
    expect(updateMeter(0.1, false, 2, 1)).toBe(0);
  });
});

describe("vision cone", () => {
  const cat = { x: 5, z: 5, look: 0 }; // looking toward +Z

  it("sees ahead within half the field of view", () => {
    expect(inCone(cat, 90, 6, { x: 5, z: 9 })).toBe(true);
    expect(inCone(cat, 90, 6, { x: 8.9, z: 9 })).toBe(true);  // 44° off
    expect(inCone(cat, 90, 6, { x: 9.5, z: 9 })).toBe(false); // 48° off
  });

  it("doesn't see behind or beyond its range", () => {
    expect(inCone(cat, 90, 6, { x: 5, z: 1 })).toBe(false);
    expect(inCone(cat, 90, 6, { x: 5, z: 11.5 })).toBe(false);
  });

  it("walls and furniture block sight; hide spot tables don't", () => {
    const g = parseMap(getLevel(2).map);
    // The cat at waypoint 1 (11, 2) looking south down the middle gap.
    const viewer = { ...tileCenter({ x: 11, y: 2 }), look: 0 };
    expect(canSee(g, viewer, 90, 6, tileCenter({ x: 11, y: 7 }))).toBe(true);
    // Behind the right sideboard (rows 4-6).
    expect(canSee(g, { ...tileCenter({ x: 15, y: 2 }), look: 0 }, 90, 6, tileCenter({ x: 15, y: 7 }))).toBe(false);
    // The hall chair (T) at (10, 7) doesn't block.
    expect(canSee(g, { ...tileCenter({ x: 10, y: 3 }), look: 0 }, 90, 6, tileCenter({ x: 10, y: 8 }))).toBe(true);
  });
});

describe("light", () => {
  const lights = getLevel(1).lights; // lamp (10.5, 5.5) r2.5, moon (14.5, 3.5) r3

  it("lamp pools are bright, moon pools normal, everything else dark", () => {
    expect(lightAt(lights, 10.5, 5.5)).toBe("bright");
    expect(lightAt(lights, 12.2, 5.5)).toBe("bright");
    expect(lightAt(lights, 14.5, 1.5)).toBe("normal");
    expect(lightAt(lights, 1.5, 1.5)).toBe("dark");
  });

  it("lights out makes everything dark", () => {
    expect(lightAt(lights, 10.5, 5.5, true)).toBe("dark");
  });
});

describe("hearing", () => {
  const g = parseMap(getLevel(4).map);
  const noise = (x: number, z: number, radius: number, loudness: number) =>
    ({ x, z, radius, loudness, kind: "step" as const });

  it("gain = loudness × (1 − d / radius)", () => {
    const listener = { x: 18.5, z: 3.5 };
    expect(hearingGain(g, listener, noise(18.5, 3.5, 5, 0.3), 1)).toBeCloseTo(0.3, 9);
    expect(hearingGain(g, listener, noise(20.5, 3.5, 5, 0.3), 1)).toBeCloseTo(0.3 * 0.6, 9);
  });

  it("isn't heard beyond the radius", () => {
    expect(hearingGain(g, { x: 14.5, z: 1.5 }, noise(20.5, 1.5, 5, 0.3), 1)).toBe(0);
  });

  it("the hearing multiplier stretches the radius", () => {
    expect(hearingGain(g, { x: 14.5, z: 1.5 }, noise(20.5, 1.5, 5, 0.3), 1.2)).toBeCloseTo(0, 9);
    expect(hearingGain(g, { x: 14.5, z: 1.5 }, noise(19.5, 1.5, 5, 0.3), 1.2)).toBeCloseTo(0.3 * (1 - 5 / 6), 9);
  });

  it("a wall between halves the radius", () => {
    // Lock clicks at (11, 6) in the corridor, heard from (13, 5) in the study:
    // the line crosses the wall tile (12, 5), so the radius of 5 becomes 2.5.
    const click = noise(11.5, 6.5, TUNING.noise.lockClick[0], TUNING.noise.lockClick[1]);
    const d = Math.hypot(2, 1);
    expect(hearingGain(g, { x: 13.5, z: 5.5 }, click, 1)).toBeCloseTo(0.3 * (1 - d / 2.5), 9);
  });

  it("doors don't muffle sound", () => {
    // Straight through the closed door at (12, 6).
    const click = noise(11.5, 6.5, 5, 0.3);
    expect(hearingGain(g, { x: 13.5, z: 6.5 }, click, 1)).toBeCloseTo(0.3 * (1 - 2 / 5), 9);
  });
});

describe("hide spots", () => {
  const g = parseMap(getLevel(1).map);
  const bench = tileCenter({ x: 13, y: 1 });

  it("hide you while sneaking or standing still", () => {
    expect(hiddenInHideSpot(g, bench, false, false)).toBe(true);
    expect(hiddenInHideSpot(g, bench, true, true)).toBe(true);
    expect(hiddenInHideSpot(g, bench, false, true)).toBe(false);
    expect(hiddenInHideSpot(g, tileCenter({ x: 12, y: 1 }), false, false)).toBe(false);
  });
});
