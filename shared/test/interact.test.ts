// "What would E do here?" (PLAN.md Sections 2 and 4.8).

import { describe, expect, it } from "vitest";
import { ALL_CLOSED, WRONG_ROLE_BARKS, getLevel, interactTarget, parseMap, tileCenter } from "../src/index.js";

describe("interaction targets", () => {
  const g4 = parseMap(getLevel(4).map);
  const g3 = parseMap(getLevel(3).map);
  const door = g4.doors[0];

  it("Pip next to the Level 4 door can pick the lock; Kiwi and Mochi can't", () => {
    const at = tileCenter({ x: 11, y: 6 });
    const pip = interactTarget(g4, ALL_CLOSED, [], "pip", at)!;
    expect(pip.kind).toBe("door");
    expect(pip.action).toBe("pickLock");
    expect(pip.allowed).toBe(true);
    const kiwi = interactTarget(g4, ALL_CLOSED, [], "kiwi", at)!;
    expect(kiwi.allowed).toBe(false);
    expect(kiwi.canBeDoneBy).toEqual(["pip"]);
  });

  it("an open door is no longer a target", () => {
    expect(interactTarget(g4, new Set([door.id]), [], "pip", tileCenter({ x: 11, y: 6 }))).toBeNull();
  });

  it("standing on the latch, the latch wins over the door next to it", () => {
    const t = interactTarget(g4, ALL_CLOSED, [], "mochi", tileCenter({ x: 13, y: 6 }))!;
    expect(t.kind).toBe("latch");
    expect(t.doorId).toBe(door.id);
    expect(t.allowed).toBe(true);
  });

  it("vents lead to their partner", () => {
    const t = interactTarget(g4, ALL_CLOSED, [], "mochi", tileCenter({ x: 8, y: 5 }))!;
    expect(t.kind).toBe("vent");
    expect(t.ventTo).toEqual({ x: 15, y: 8 });
    expect(interactTarget(g4, ALL_CLOSED, [], "pip", tileCenter({ x: 8, y: 5 }))!.allowed).toBe(false);
  });

  it("only Pip can lift heavy loot", () => {
    const honey = tileCenter(g3.heavyItems[0]);
    const item = { id: "item", kind: "heavy", ...honey, carriedBy: "", onLedge: false, visible: true };
    const pos = { x: honey.x - 0.6, z: honey.z };
    expect(interactTarget(g3, ALL_CLOSED, [item], "pip", pos)!.allowed).toBe(true);
    expect(interactTarget(g3, ALL_CLOSED, [item], "kiwi", pos)!.allowed).toBe(false);
    expect(interactTarget(g3, ALL_CLOSED, [item], "mochi", pos)!.action).toBe("liftHeavy");
  });

  it("carried or far-away items aren't targets", () => {
    const item = { id: "item", kind: "small", x: 5, z: 5, carriedBy: "kiwi", onLedge: false, visible: true };
    expect(interactTarget(g3, ALL_CLOSED, [item], "pip", { x: 5, z: 5 })).toBeNull();
    expect(interactTarget(g3, ALL_CLOSED, [{ ...item, carriedBy: "" }], "pip", { x: 7, z: 5 })).toBeNull();
  });

  it("every wrong-role target in Section 3 has a bark", () => {
    expect(WRONG_ROLE_BARKS.mochi.liftHeavy).toBeDefined();
    expect(WRONG_ROLE_BARKS.mochi.pickLock).toBeDefined();
    expect(WRONG_ROLE_BARKS.kiwi.pickLock).toBeDefined();
    expect(WRONG_ROLE_BARKS.kiwi.liftHeavy).toBeDefined();
    expect(WRONG_ROLE_BARKS.kiwi.vent).toBeDefined();
    expect(WRONG_ROLE_BARKS.pip.vent).toBeDefined();
    expect(WRONG_ROLE_BARKS.pip.chewWire).toBeDefined();
  });
});
