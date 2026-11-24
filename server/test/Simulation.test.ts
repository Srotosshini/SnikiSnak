// The cat, jars, rescue, items, win and lose, tested by running the server
// tick directly (no network). PLAN.md Sections 4.3–4.9 and the Phase 2 acceptance tests.

import assert from "assert";
import { type Role, TUNING, getLevel, tileCenter } from "@snikisnak/shared";
import { HeistState, PlayerState } from "../src/rooms/schema/HeistState.js";
import { Simulation } from "../src/game/Simulation.js";

const DT = 1 / TUNING.tickHz;

interface Log { noises: string[]; toasts: string[]; sfx: string[]; barks: string[]; complete: Array<{ stars: number; leftBehind: string[] }>; caught: number; }

function setup(levelId: number, roles: Role[] = ["kiwi", "mochi", "pip"]) {
  const state = new HeistState();
  const log: Log = { noises: [], toasts: [], sfx: [], barks: [], complete: [], caught: 0 };
  const sim = new Simulation(state, getLevel(levelId), {
    noise: (n) => log.noises.push(`${n.kind}:${n.radius}`),
    toast: (_id, text) => log.toasts.push(text),
    sfx: (name) => log.sfx.push(name),
    bark: (who, lineId) => log.barks.push(`${who}:${lineId}`),
    complete: (stars, leftBehind) => log.complete.push({ stars, leftBehind }),
    caught: () => { log.caught++; },
  });
  state.phase = "playing";
  sim.grid.spawns.forEach((s, i) => {
    if (i >= roles.length) return;
    const c = tileCenter(s);
    const p = new PlayerState().assign({ id: roles[i], owner: roles[i], name: roles[i], role: roles[i], x: c.x, z: c.z });
    state.players.set(p.id, p);
    sim.addPlayer(p);
  });
  const player = (id: string): PlayerState => state.players.get(id)!;
  /** Put a player somewhere directly (test setup). */
  const place = (id: string, x: number, z: number): void => {
    const p = player(id);
    p.x = x; p.z = z;
    sim.addPlayer(p);
  };
  const run = (seconds: number, each?: (t: number) => void): void => {
    for (let t = 0; t < seconds; t += DT) {
      each?.(t);
      sim.tick(DT);
    }
  };
  /** Walk a player toward a point at a speed, sending real `pos` messages. */
  const walkTo = (id: string, x: number, z: number, sneaking = false): void => {
    const speed = sneaking ? TUNING.player.sneak : TUNING.player.walk;
    for (let i = 0; i < 400; i++) {
      const p = player(id);
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.01) break;
      const step = Math.min(d, speed * DT);
      const r = sim.receivePos(id, { x: p.x + (dx / d) * step, z: p.z + (dz / d) * step, facing: 0, moving: true, sneaking, seq: i });
      assert.ok(r.ok, `move rejected at (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
      sim.tick(DT);
    }
    sim.receivePos(id, { x, z, facing: 0, moving: false, sneaking, seq: 999 });
    sim.tick(DT);
  };
  const skipGrace = (): void => run(TUNING.cat.graceStart + DT);
  return { state, sim, log, player, place, run, walkTo, skipGrace };
}

describe("the cat", () => {
  it("grooms for 5 s at the start: no vision, no hearing", () => {
    const t = setup(2);
    const cat = t.state.cat;
    t.place("kiwi", cat.x, cat.z + 1.5); // right in front of him
    t.run(4.5);
    assert.strictEqual(t.player("kiwi").seen, 0);
    assert.strictEqual(t.state.cat.vision, 0);
  });

  it("Level 1: sleeps through sneaking, wakes up from a run of squeaks", () => {
    const t = setup(1);
    t.skipGrace();
    assert.strictEqual(t.state.cat.state, "SLEEP");
    // Sneak around the left side.
    t.walkTo("kiwi", 3.5, 1.5, true);
    t.walkTo("kiwi", 3.5, 3.5, true);
    assert.strictEqual(t.state.cat.state, "SLEEP");
    // Now stomp back and forth across the squeaky boards at (4-5, 3-4).
    for (let i = 0; i < 3 && t.state.cat.state === "SLEEP"; i++) {
      t.walkTo("kiwi", 6.5, 3.5);
      t.walkTo("kiwi", 3.5, 3.5);
    }
    assert.notStrictEqual(t.state.cat.state, "SLEEP");
    assert.ok(t.log.noises.filter((n) => n.startsWith("squeak:7")).length >= 3);
  });

  it("Level 1: careless walking right next to him wakes him", () => {
    const t = setup(1);
    t.skipGrace();
    t.walkTo("pip", 9.5, 6.5);
    let woke = false;
    // Back and forth one tile from his nose (footsteps: radius 2.5, loudness 0.15).
    for (let i = 0; i < 12 && !woke; i++) {
      t.walkTo("pip", 9.5, 4.5);
      t.walkTo("pip", 9.5, 6.5);
      woke = t.state.cat.state !== "SLEEP";
    }
    assert.ok(woke, "the cat should wake");
  });

  it("Level 2: follows its waypoints in order", () => {
    const t = setup(2);
    // Keep everyone out of the way at the spawns (bottom left, out of his loop).
    const wps = t.sim.grid.waypoints.map((w) => tileCenter(w.tile));
    const visits: number[] = [];
    t.run(60, () => {
      const c = t.state.cat;
      wps.forEach((w, i) => {
        if (Math.hypot(w.x - c.x, w.z - c.z) < 0.3 && visits[visits.length - 1] !== i + 1) visits.push(i + 1);
      });
    });
    const seq = visits.join("");
    assert.ok(seq.includes("12341"), `visited ${seq}`);
    assert.strictEqual(t.state.cat.state, "PATROL");
  });

  it("Level 2: spots a player on its route, chases, pounces and jars them where they stood", () => {
    const t = setup(2);
    t.place("pip", 16.5, 2.5); // on the top leg, between waypoints 1 and 2, in plain sight
    const states = new Set<string>();
    t.run(30, () => states.add(t.state.cat.state));
    assert.ok(states.has("CHASE"), [...states].join(","));
    assert.ok(states.has("POUNCE"));
    const pip = t.player("pip");
    assert.ok(pip.jarred, "pip should be jarred");
    assert.ok(Math.abs(pip.x - 16.5) < 1e-9 && Math.abs(pip.z - 2.5) < 1e-9, "jarred where he stood");
    assert.ok(t.state.anyoneJarred);
    assert.ok(t.log.sfx.includes("jarClink"));
  });

  it("can't see a player standing still under a hide-spot table", () => {
    const t = setup(2);
    t.place("kiwi", 10.5, 7.5); // the hall chair (T) at (10, 7), right on his route from 4 to 1
    t.run(40);
    assert.ok(t.player("kiwi").hidden);
    assert.strictEqual(t.player("kiwi").seen, 0);
    assert.ok(!t.player("kiwi").jarred);
  });

  it("paws at a hide spot it saw you duck into, then leaves", () => {
    const t = setup(2);
    t.skipGrace();
    // Stand where he'll notice, then duck under the hall chair once he's suspicious.
    t.place("kiwi", 10.5, 6.5);
    t.run(20, () => {
      const k = t.player("kiwi");
      if (!k.hidden && k.seen >= 0.4) t.walkTo("kiwi", 10.5, 7.5, true);
    });
    assert.ok(t.log.sfx.includes("patpat"), "the cat should paw at the hide spot");
    assert.ok(!t.player("kiwi").jarred, "hide spots are safe in Levels 1-6");
  });

  it("ignores jarred players", () => {
    const t = setup(2);
    t.skipGrace();
    const k = t.player("kiwi");
    k.jarred = true;
    t.place("kiwi", 16.5, 2.5);
    t.run(15);
    assert.strictEqual(t.player("kiwi").seen, 0);
  });
});

describe("jars and rescue", () => {
  it("two friends holding F for 2.5 s free a jarred player", () => {
    const t = setup(1);
    t.skipGrace();
    const k = t.player("kiwi");
    k.jarred = true;
    t.place("mochi", k.x + 0.8, k.z);
    t.place("pip", k.x, k.z + 1.0);
    t.sim.setHold("mochi", "F", true);
    t.sim.setHold("pip", "F", true);
    t.run(2.4);
    assert.ok(k.jarred, "not yet");
    assert.ok(k.rescue > 0.9);
    assert.strictEqual(t.player("mochi").holdKind, "rescue");
    t.run(0.2);
    assert.ok(!k.jarred, "freed after 2.5 s");
    assert.ok(t.log.noises.includes("jarBreak:3"));
  });

  it("one friend alone can't do it: 'Need one more friend!'", () => {
    const t = setup(1);
    t.skipGrace();
    const k = t.player("kiwi");
    k.jarred = true;
    t.place("mochi", k.x + 0.8, k.z);
    t.sim.setHold("mochi", "F", true);
    t.run(3);
    assert.ok(k.jarred);
    assert.strictEqual(k.rescue, 0);
    assert.deepStrictEqual(t.log.toasts, ["Need one more friend!"]);
  });

  it("progress drains when nobody holds", () => {
    const t = setup(1);
    t.skipGrace();
    const k = t.player("kiwi");
    k.jarred = true;
    k.rescue = 0.5;
    t.run(0.5);
    assert.ok(Math.abs(k.rescue - 0.25) < 0.03);
  });

  it("two jars at once: 'Caught!' after 1.5 s", () => {
    const t = setup(1);
    t.skipGrace();
    t.player("kiwi").jarred = true;
    t.player("mochi").jarred = true;
    t.run(1.4);
    assert.strictEqual(t.log.caught, 0);
    t.run(0.2);
    assert.strictEqual(t.log.caught, 1);
  });

  it("a jarred player can wobble the jar (a decoy noise) every 3 s", () => {
    const t = setup(1);
    t.player("kiwi").jarred = true;
    t.sim.interact("kiwi");
    t.sim.interact("kiwi");
    t.run(0.1);
    assert.deepStrictEqual(t.log.noises.filter((n) => n.startsWith("wobble")), ["wobble:2"]);
  });
});

describe("items", () => {
  it("Kiwi picks up the thimble; Mochi can't", () => {
    const t = setup(2);
    const item = t.state.items.get("item")!;
    t.place("mochi", item.x, item.z + 0.5);
    t.sim.interact("mochi");
    assert.strictEqual(item.carriedBy, "");
    assert.deepStrictEqual(t.log.barks, ["mochi:wrong_mochi_item"]);
    t.place("kiwi", item.x, item.z + 0.5);
    t.sim.interact("kiwi");
    assert.strictEqual(item.carriedBy, "kiwi");
    assert.strictEqual(t.player("kiwi").carrying, "item");
  });

  it("a caught carrier drops the item next to the jar with a crash", () => {
    const t = setup(2);
    const item = t.state.items.get("item")!;
    t.place("kiwi", 16.5, 2.5);
    t.sim.interact("kiwi"); // too far: nothing
    assert.strictEqual(item.carriedBy, "");
    t.place("kiwi", item.x, item.z);
    t.sim.interact("kiwi");
    t.walkTo("kiwi", 16.5, 2.5);
    t.run(30);
    assert.ok(t.player("kiwi").jarred);
    assert.strictEqual(item.carriedBy, "");
    assert.ok(Math.hypot(item.x - t.player("kiwi").x, item.z - t.player("kiwi").z) < 0.6);
    assert.ok(t.log.noises.includes("crash:5"));
  });
});

describe("winning", () => {
  it("Level 1: all three in the exit ends the level at once, 3 stars", () => {
    const t = setup(1);
    t.place("kiwi", 18.5, 4.5);
    t.place("mochi", 18.5, 5.5);
    t.place("pip", 19.5, 4.5);
    t.run(0.6);
    assert.deepStrictEqual(t.log.complete, [{ stars: 3, leftBehind: [] }]);
  });

  it("two in the exit must all hold F for 1.5 s: 1 star, one left behind", () => {
    const t = setup(1);
    t.place("kiwi", 18.5, 4.5);
    t.place("mochi", 18.5, 5.5);
    t.run(1);
    assert.strictEqual(t.log.complete.length, 0);
    assert.ok(t.state.exitReady);
    t.sim.setHold("kiwi", "F", true);
    t.run(1);
    assert.strictEqual(t.log.complete.length, 0, "both must hold");
    t.sim.setHold("mochi", "F", true);
    t.run(1.6);
    assert.deepStrictEqual(t.log.complete, [{ stars: 1, leftBehind: ["pip"] }]);
  });

  it("all home after someone was jarred: 2 stars", () => {
    const t = setup(1);
    t.state.anyoneJarred = true;
    t.place("kiwi", 18.5, 4.5);
    t.place("mochi", 18.5, 5.5);
    t.place("pip", 19.5, 4.5);
    t.run(0.6);
    assert.strictEqual(t.log.complete[0]?.stars, 2);
  });

  it("Level 2: no win until the thimble reaches the exit", () => {
    const t = setup(2);
    t.place("kiwi", 20.5, 7.5);
    t.place("mochi", 20.5, 8.5);
    t.place("pip", 21.5, 7.5);
    t.run(1);
    assert.strictEqual(t.log.complete.length, 0);
    const item = t.state.items.get("item")!;
    item.x = 20.5; item.z = 7.5;
    t.run(0.6);
    assert.strictEqual(t.log.complete.length, 1);
  });
});

describe("Phase 3 abilities", () => {
  it("Level 4: Pip picks the lock in 4 s, clicking every 0.8 s; the door opens and stays open", () => {
    const t = setup(4);
    t.skipGrace();
    t.place("pip", 11.5, 6.5);
    t.sim.interact("pip");
    t.sim.setHold("pip", "E", true);
    t.run(3.9);
    const door = t.state.doors.get("door0")!;
    assert.ok(!door.open && door.pick > 0.9, `pick ${door.pick}`);
    assert.strictEqual(t.player("pip").holdKind, "pick");
    t.run(0.2);
    assert.ok(door.open);
    assert.ok(t.sim.open.has("door0"));
    const clicks = t.log.noises.filter((n) => n.startsWith("lockClick"));
    assert.strictEqual(clicks.length, 6); // at 0, 0.8, 1.6, 2.4, 3.2 and 4.0 s
    assert.strictEqual(clicks[0], "lockClick:5");
    assert.ok(t.log.barks.includes("pip:ability_pip_lock"));
    // Doors stay open: walk through.
    t.walkTo("pip", 13.5, 6.5);
    assert.ok(t.player("pip").x > 13);
  });

  it("letting go keeps the progress for 2 s, then it drains at 10% per second", () => {
    const t = setup(4);
    t.place("pip", 11.5, 6.5);
    t.sim.interact("pip");
    t.sim.setHold("pip", "E", true);
    t.run(2);
    t.sim.setHold("pip", "E", false);
    const door = t.state.doors.get("door0")!;
    const held = door.pick;
    t.run(1.9);
    assert.ok(Math.abs(door.pick - held) < 1e-9, "kept for 2 s");
    t.run(1.1);
    assert.ok(Math.abs(door.pick - (held - 0.1)) < 0.02, `drained to ${door.pick}`);
  });

  it("Kiwi's cover muffles lock clicks to 0.4×", () => {
    const t = setup(4);
    t.place("pip", 11.5, 6.5);
    t.place("kiwi", 11.5, 7.3);
    t.sim.setHold("kiwi", "Q", true);
    t.sim.interact("pip");
    t.sim.setHold("pip", "E", true);
    t.run(1);
    assert.strictEqual(t.player("kiwi").mode, "covering");
    assert.strictEqual(t.player("pip").mode, "covered");
    const click = t.log.noises.find((n) => n.startsWith("lockClick"))!;
    assert.ok(Math.abs(Number(click.split(":")[1]) - 2) < 1e-9, click);
  });

  it("Level 4: Mochi vents into the study in 1.2 s, invisible, then opens the latch in 1 s", () => {
    const t = setup(4);
    t.skipGrace();
    t.place("mochi", 8.5, 5.5);
    t.sim.interact("mochi");
    t.run(0.1);
    const m = t.player("mochi");
    assert.strictEqual(m.mode, "vent");
    assert.ok(m.hidden);
    assert.ok(t.log.barks.some((b) => b.startsWith("mochi:ability_mochi_vent")));
    t.run(1.2);
    assert.strictEqual(m.mode, "");
    assert.deepStrictEqual([m.x, m.z], [15.5, 8.5]);
    t.walkTo("mochi", 15.5, 6.5);
    t.walkTo("mochi", 13.5, 6.5);
    t.sim.interact("mochi");
    t.run(0.9);
    assert.ok(!t.state.doors.get("door0")!.open);
    assert.strictEqual(m.holdKind, "latch");
    t.run(0.2);
    assert.ok(t.state.doors.get("door0")!.open, "latch opened the door");
    assert.ok(t.log.sfx.includes("latchClack"));
  });

  it("walking away cancels the latch", () => {
    const t = setup(4);
    t.place("mochi", 13.5, 6.5);
    t.sim.interact("mochi");
    t.run(0.5);
    t.walkTo("mochi", 15.5, 6.5);
    t.run(1);
    assert.ok(!t.state.doors.get("door0")!.open);
  });

  it("Level 3: only Pip lifts the honey; carrying it makes loud, slower footsteps", () => {
    const t = setup(3);
    const honey = t.state.items.get("item")!;
    assert.strictEqual(honey.kind, "heavy");
    t.place("kiwi", honey.x - 0.6, honey.z);
    t.sim.interact("kiwi");
    assert.strictEqual(honey.carriedBy, "");
    assert.deepStrictEqual(t.log.barks, ["kiwi:wrong_kiwi_heavy"]);
    t.place("pip", honey.x - 0.6, honey.z);
    t.sim.interact("pip");
    assert.strictEqual(honey.carriedBy, "pip");
    assert.strictEqual(t.sim.carryOf(t.player("pip")), "heavy");
    // Walking at heavy speed is allowed; walking at normal speed is not.
    const p = t.player("pip");
    assert.ok(!t.sim.receivePos("pip", { x: p.x, z: p.z + 0.3, facing: 0, moving: true, sneaking: false, seq: 1 }).ok);
    t.walkTo("pip", 22.5, 2.5);
    t.walkTo("pip", 22.5, 6.5, false);
    const steps = t.log.noises.filter((n) => n.startsWith("step"));
    assert.ok(steps.length > 0 && steps.every((n) => n === "step:4"), steps.join(","));
  });

  it("Kiwi covering Pip shrinks his heavy footsteps from 4 to 1.6", () => {
    const t = setup(3);
    const honey = t.state.items.get("item")!;
    t.place("pip", honey.x - 0.6, honey.z);
    t.sim.interact("pip");
    t.place("kiwi", honey.x - 0.6, honey.z + 0.8);
    t.sim.setHold("kiwi", "Q", true);
    t.log.noises.length = 0;
    // Walk Pip a little at heavy speed; Kiwi stays within 1.2 tiles.
    const p = t.player("pip");
    for (let i = 0; i < 20; i++) {
      t.sim.receivePos("pip", { x: p.x, z: p.z + (i % 2 ? 0.1 : -0.1), facing: 0, moving: true, sneaking: false, seq: i });
      t.sim.tick(0.05);
    }
    const steps = t.log.noises.filter((n) => n.startsWith("step"));
    assert.ok(steps.length > 0, "should step");
    assert.ok(steps.every((n) => Math.abs(Number(n.split(":")[1]) - 1.6) < 1e-9), steps.join(","));
  });

  it("covered and both standing still: hidden", () => {
    const t = setup(2);
    t.place("kiwi", 5.5, 8.5);
    t.place("mochi", 5.5, 9.3);
    t.sim.setHold("kiwi", "Q", true);
    t.run(0.2);
    assert.ok(t.player("mochi").hidden);
    assert.ok(!t.player("kiwi").hidden);
    t.sim.setHold("kiwi", "Q", false);
    t.run(0.1);
    assert.ok(!t.player("mochi").hidden);
  });

  it("wrong-role barks are rate limited: one per character every 4 s", () => {
    const t = setup(4);
    t.place("kiwi", 11.5, 6.5);
    t.sim.interact("kiwi");
    t.sim.interact("kiwi");
    t.run(2);
    t.sim.interact("kiwi");
    assert.deepStrictEqual(t.log.barks, ["kiwi:wrong_kiwi_lock"]);
    t.run(2.1);
    t.sim.interact("kiwi");
    assert.strictEqual(t.log.barks.length, 2);
  });

  it("the cat ignores Mochi in a vent", () => {
    const t = setup(4);
    t.skipGrace();
    t.place("mochi", 15.5, 8.5); // the study vent, on his route
    t.sim.interact("mochi");
    t.run(0.5);
    assert.strictEqual(t.player("mochi").seen, 0);
  });
});
