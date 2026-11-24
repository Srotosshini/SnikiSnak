import { describe, expect, it } from "vitest";
import {
  StepTimer, TUNING, covered, facingFor, footstepNoise, inputToDirection, isMoveAllowed,
  maxSpeed, moveSpeed, squeakNoise,
} from "../src/index.js";

describe("movement speeds", () => {
  it("match Section 2", () => {
    expect(moveSpeed({ sneaking: false, carry: "none" })).toBe(3.6);
    expect(moveSpeed({ sneaking: true, carry: "none" })).toBe(1.8);
    expect(moveSpeed({ sneaking: false, carry: "heavy" })).toBe(2.4);
    expect(moveSpeed({ sneaking: true, carry: "heavy" })).toBe(1.4);
    expect(moveSpeed({ sneaking: false, carry: "croissant" })).toBe(1.6);
    expect(moveSpeed({ sneaking: true, carry: "croissant" })).toBe(1.2);
    expect(moveSpeed({ sneaking: false, carry: "none", covering: true })).toBe(1.8);
    expect(maxSpeed("none")).toBe(TUNING.player.walk);
  });
});

describe("server movement check", () => {
  it("allows a normal 50 ms step and rejects a teleport", () => {
    const from = { x: 2, z: 2 };
    expect(isMoveAllowed(from, { x: 2 + 3.6 * 0.05, z: 2 }, 0.05, "none")).toBe(true);
    expect(isMoveAllowed(from, { x: 4, z: 2 }, 0.05, "none")).toBe(false);
  });

  it("uses maxSpeed × dt × 1.3 + 0.1 as the limit", () => {
    const limit = 3.6 * 0.1 * 1.3 + 0.1;
    expect(isMoveAllowed({ x: 0, z: 0 }, { x: limit - 1e-6, z: 0 }, 0.1, "none")).toBe(true);
    expect(isMoveAllowed({ x: 0, z: 0 }, { x: limit + 1e-3, z: 0 }, 0.1, "none")).toBe(false);
  });

  it("is stricter while carrying heavy loot", () => {
    const to = { x: 0.5, z: 0 };
    expect(isMoveAllowed({ x: 0, z: 0 }, to, 0.1, "none")).toBe(true);
    expect(isMoveAllowed({ x: 0, z: 0 }, to, 0.1, "croissant")).toBe(false);
  });
});

describe("input", () => {
  it("W is north (-Z), D is east (+X), diagonals are normalised", () => {
    expect(inputToDirection(true, false, false, false)).toEqual({ x: 0, z: -1 });
    expect(inputToDirection(false, false, false, true)).toEqual({ x: 1, z: 0 });
    const d = inputToDirection(true, false, false, true)!;
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(1, 9);
    expect(inputToDirection(true, true, false, false)).toBeNull();
  });

  it("facing 0 looks toward +Z", () => {
    expect(facingFor({ x: 0, z: 1 })).toBeCloseTo(0, 9);
    expect(facingFor({ x: 1, z: 0 })).toBeCloseTo(Math.PI / 2, 9);
  });
});

describe("noise", () => {
  it("footsteps match Section 4.2", () => {
    expect(footstepNoise(false, "none")).toEqual({ radius: 2.5, loudness: 0.15 });
    expect(footstepNoise(true, "none")).toEqual({ radius: 0.8, loudness: 0.05 });
    expect(footstepNoise(false, "heavy").radius).toBe(4.0);
    expect(footstepNoise(true, "heavy").radius).toBe(2.5);
    expect(footstepNoise(false, "croissant").radius).toBe(6.0);
    expect(footstepNoise(true, "croissant").radius).toBe(4.0);
  });

  it("squeaky boards are loud, less so when sneaking", () => {
    expect(squeakNoise(false)).toEqual({ radius: 7.0, loudness: 0.8 });
    expect(squeakNoise(true).radius).toBe(4.0);
  });

  it("cover multiplies radius and loudness by 0.4", () => {
    const n = covered({ radius: 6, loudness: 0.35 }, true);
    expect(n.radius).toBeCloseTo(2.4, 9);
    expect(n.loudness).toBeCloseTo(0.14, 9);
    expect(covered({ radius: 6, loudness: 0.35 }, false)).toEqual({ radius: 6, loudness: 0.35 });
  });

  it("a footstep lands every 0.38 s walking and 0.5 s sneaking", () => {
    const count = (sneaking: boolean, seconds: number): number => {
      const t = new StepTimer();
      let steps = 0;
      for (let i = 0; i < seconds * 20; i++) if (t.update(0.05, true, sneaking)) steps++;
      return steps;
    };
    // Measured off exact multiples of the interval, to avoid float edge cases.
    expect(count(false, 4.0)).toBe(10); // 10 × 0.38 = 3.8 s
    expect(count(true, 5.2)).toBe(10);  // 10 × 0.5 = 5.0 s
  });

  it("standing still resets the step timer", () => {
    const t = new StepTimer();
    for (let i = 0; i < 7; i++) t.update(0.05, true, false); // 0.35 s
    t.update(0.05, false, false);
    expect(t.update(0.05, true, false)).toBe(false);
  });
});
