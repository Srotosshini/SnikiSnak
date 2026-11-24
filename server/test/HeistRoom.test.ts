import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { TUNING } from "@snikisnak/shared";

import appConfig from "../src/app.config.js";
import { CODE_LETTERS, makeRoomCode, normalizeCode } from "../src/rooms/roomCode.js";
import type { HeistRoom } from "../src/rooms/HeistRoom.js";

/** Wait until a condition holds (patches only arrive when something changes, so don't wait for one). */
async function waitFor(cond: () => boolean, ms = 2000): Promise<void> {
  const until = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > until) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 10));
  }
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("room codes", () => {
  it("are 4 consonants", () => {
    for (let i = 0; i < 200; i++) {
      const code = makeRoomCode(new Set());
      assert.match(code, new RegExp(`^[${CODE_LETTERS}]{4}$`));
    }
  });

  it("skip codes that are taken", () => {
    let calls = 0;
    // The first 4 random numbers spell BBBB (taken), the next 4 spell CCCC.
    const rand = (): number => (calls++ < 4 ? 0 : 1 / CODE_LETTERS.length);
    assert.strictEqual(makeRoomCode(new Set(["BBBB"]), rand), "CCCC");
  });

  it("normalize what players type", () => {
    assert.strictEqual(normalizeCode(" bc-df "), "BCDF");
  });
});

describe("heist room", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => { colyseus = await boot(appConfig); });
  after(async () => colyseus.shutdown());
  beforeEach(async () => { await colyseus.cleanup(); });

  describe("lobby and level flow", () => {

    it("uses its 4-letter code as the room id and starts in the lobby", async () => {
      const room = await colyseus.createRoom("heist", {}) as unknown as HeistRoom;
      assert.match(room.roomId, /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
      assert.strictEqual(room.state.code, room.roomId);
      assert.strictEqual(room.state.phase, "lobby");
    });

    it("players join by code; nobody can take a role someone else has; the host hands over", async () => {
      const host = await colyseus.sdk.create("heist", { name: "Ana" });
      const guest = await colyseus.sdk.joinById(host.roomId, { name: "Ben" });
      const room = colyseus.getRoomById(host.roomId) as unknown as HeistRoom;
      await waitFor(() => room.state.players.size === 2);
      assert.strictEqual(room.state.hostId, host.sessionId);
      assert.strictEqual(room.state.players.get(guest.sessionId)?.name, "Ben");

      host.send("role", { role: "pip" });
      await waitFor(() => room.state.players.get(host.sessionId)?.role === "pip");
      guest.send("role", { role: "pip" });
      await pause(80);
      assert.strictEqual(room.state.players.get(guest.sessionId)?.role, "", "refused: Pip is taken");
      guest.send("role", { role: "kiwi" });
      await waitFor(() => room.state.players.get(guest.sessionId)?.role === "kiwi");

      // Giving a role back frees it.
      host.send("role", { role: "" });
      guest.send("role", { role: "pip" });
      await waitFor(() => room.state.players.get(guest.sessionId)?.role === "pip");

      await host.leave();
      await waitFor(() => room.state.hostId === guest.sessionId);
    });

    it("GO needs 3 players with 3 roles, all ready; then intro, briefing, playing; the room locks", async () => {
      const a = await colyseus.sdk.create("heist", { name: "A", level: 3 });
      const b = await colyseus.sdk.joinById(a.roomId, { name: "B" });
      const c = await colyseus.sdk.joinById(a.roomId, { name: "C" });
      const room = colyseus.getRoomById(a.roomId) as unknown as HeistRoom;
      await waitFor(() => room.state.players.size === 3);

      a.send("role", { role: "kiwi" }); b.send("role", { role: "mochi" }); c.send("role", { role: "pip" });
      a.send("ready", { ready: true }); b.send("ready", { ready: true });
      await pause(80);
      a.send("start", {});
      await pause(80);
      assert.strictEqual(room.state.phase, "lobby", "not everyone is ready");

      c.send("ready", { ready: true });
      await waitFor(() => room.canStart());
      b.send("start", {}); // not the host: ignored
      await pause(80);
      assert.strictEqual(room.state.phase, "lobby");
      a.send("start", {});
      await waitFor(() => room.state.phase === "intro");
      assert.strictEqual(room.state.level, 3);
      assert.ok(room.state.timer > 0);
      await assert.rejects(colyseus.sdk.joinById(a.roomId, {}), "locked once the heist starts");

      // Everyone ready skips the intro, then the briefing.
      a.send("ready", { ready: true }); b.send("ready", { ready: true }); c.send("ready", { ready: true });
      await waitFor(() => room.state.phase === "briefing");
      assert.ok(Math.abs(room.state.timer - TUNING.flow.briefing) < 0.5);
      a.send("ready", { ready: true }); b.send("ready", { ready: true }); c.send("ready", { ready: true });
      await waitFor(() => room.state.phase === "playing");

      // Spawns go in role order.
      const kiwi = room.state.players.get(a.sessionId)!;
      assert.deepStrictEqual([kiwi.x, kiwi.z], [1.5, 1.5]);
    });

    it("relays voice signalling only to the named player, adding from", async () => {
      const a = await colyseus.sdk.create("heist", {});
      const b = await colyseus.sdk.joinById(a.roomId, {});
      const c = await colyseus.sdk.joinById(a.roomId, {});
      const got: Record<string, Array<{ from: string; data: unknown }>> = { b: [], c: [] };
      b.onMessage("rtc", (m: { from: string; data: unknown }) => got.b.push(m));
      c.onMessage("rtc", (m: { from: string; data: unknown }) => got.c.push(m));
      a.send("rtc", { to: b.sessionId, data: { type: "offer", sdp: "x" } });
      await waitFor(() => got.b.length === 1);
      await pause(80);
      assert.deepStrictEqual(got.b[0], { from: a.sessionId, data: { type: "offer", sdp: "x" } });
      assert.strictEqual(got.c.length, 0);
    });

    it("shows a muted or missing mic to everyone", async () => {
      const a = await colyseus.sdk.create("heist", {});
      const room = colyseus.getRoomById(a.roomId) as unknown as HeistRoom;
      a.send("mic", { muted: true });
      await waitFor(() => room.state.players.get(a.sessionId)?.micOff === true);
      a.send("mic", { muted: false });
      await waitFor(() => room.state.players.get(a.sessionId)?.micOff === false);
    });

    it("Level 1 starts with the opening cutscene, skipped when everyone holds Space for 1 s", async () => {
      const a = await colyseus.sdk.create("heist", {});
      const b = await colyseus.sdk.joinById(a.roomId, {});
      const c = await colyseus.sdk.joinById(a.roomId, {});
      const room = colyseus.getRoomById(a.roomId) as unknown as HeistRoom;
      await waitFor(() => room.state.players.size === 3);
      a.send("role", { role: "kiwi" }); b.send("role", { role: "mochi" }); c.send("role", { role: "pip" });
      a.send("ready", { ready: true }); b.send("ready", { ready: true }); c.send("ready", { ready: true });
      await waitFor(() => room.canStart());
      a.send("start", {});
      await waitFor(() => room.state.phase === "cutscene");
      a.send("skip", { holding: true }); b.send("skip", { holding: true });
      await pause(1300);
      assert.strictEqual(room.state.phase, "cutscene", "one player isn't holding");
      c.send("skip", { holding: true });
      await waitFor(() => room.state.phase === "intro", 3000);
      assert.strictEqual(room.state.level, 1);
    });

    it("relays pings, at most one per player every 0.5 s", async () => {
      const a = await colyseus.sdk.create("heist", {});
      const b = await colyseus.sdk.joinById(a.roomId, {});
      const pings: Array<{ from: string; kind: number }> = [];
      b.onMessage("ping", (m: { from: string; kind: number }) => pings.push(m));
      a.send("ping", { kind: 2, x: 5, z: 5 });
      a.send("ping", { kind: 3, x: 5, z: 5 });
      a.send("ping", { kind: 9 as unknown as 1, x: 5, z: 5 }); // not a real ping kind: ignored
      await waitFor(() => pings.length === 1);
      await pause(100);
      assert.deepStrictEqual(pings.map((p) => [p.from, p.kind]), [[a.sessionId, 2]]);
    });

    it("the host picks the first level in the lobby", async () => {
      const a = await colyseus.sdk.create("heist", {});
      const b = await colyseus.sdk.joinById(a.roomId, {});
      const room = colyseus.getRoomById(a.roomId) as unknown as HeistRoom;
      a.send("select", { level: 4 });
      await waitFor(() => room.state.level === 4);
      b.send("select", { level: 2 });
      await pause(80);
      assert.strictEqual(room.state.level, 4, "only the host");
    });
  });

  describe("dev mode and movement", () => {

    const solo = async (level = 1) => {
      const c = await colyseus.sdk.create("heist", { solo: true, level });
      const room = colyseus.getRoomById(c.roomId) as unknown as HeistRoom;
      await waitFor(() => room.state.players.size === 3);
      return { c, room };
    };
    const pos = (x: number, z: number, seq: number, who = "solo-kiwi") =>
      ({ x, z, facing: 0, moving: true, sneaking: false, seq, who });

    it("dev mode gives one client all three characters and starts playing at once", async () => {
      const { c, room } = await solo(2);
      assert.strictEqual(room.state.level, 2);
      assert.strictEqual(room.state.phase, "playing");
      const owners = new Set([...room.state.players.values()].map((p) => p.owner));
      assert.deepStrictEqual([...owners], [c.sessionId]);
      await assert.rejects(colyseus.sdk.joinById(c.roomId, {}), "nobody else can join a solo room");
    });

    it("accepts normal moves and corrects a teleport", async () => {
      const { c, room } = await solo();
      const me = room.state.players.get("solo-kiwi")!;
      const start = { x: me.x, z: me.z };
      const corrections: Array<{ x: number; z: number }> = [];
      c.onMessage("correct", (m: { x: number; z: number }) => corrections.push(m));

      c.send("pos", pos(start.x + 0.15, start.z, 1));
      await waitFor(() => Math.abs(me.x - (start.x + 0.15)) < 1e-6);

      c.send("pos", pos(15.5, 5.5, 2));
      await waitFor(() => corrections.length === 1);
      assert.ok(Math.abs(me.x - (start.x + 0.15)) < 1e-6);
      assert.ok(Math.abs(corrections[0].x - (start.x + 0.15)) < 1e-6);
    });

    it("doesn't allow one long jump after standing still", async () => {
      const { c, room } = await solo();
      const me = room.state.players.get("solo-kiwi")!;
      const start = { x: me.x, z: me.z };
      await pause(600);
      c.send("pos", pos(start.x + 1.5, start.z, 1));
      await pause(120);
      assert.strictEqual(me.x, start.x);
    });

    it("rejects a move into a wall", async () => {
      const { c, room } = await solo();
      const me = room.state.players.get("solo-kiwi")!;
      const start = { x: me.x, z: me.z };
      c.send("pos", pos(start.x, 0.9, 1)); // spawn (1, 1): the wall is row 0
      await pause(120);
      assert.strictEqual(me.z, start.z);
    });

    it("makes footstep noise while walking and a squeak on a squeaky board", async () => {
      const { c, room } = await solo();
      const noises: Array<{ kind: string; radius: number }> = [];
      c.onMessage("noise", (m: { kind: string; radius: number }) => noises.push(m));
      // Mochi spawns at (1, 3); squeaky boards at (4, 3) and (5, 3). Walk east along row 3.
      let x = 1.5;
      for (let seq = 1; seq <= 30; seq++) {
        x += 0.15;
        c.send("pos", pos(x, 3.5, seq, "solo-mochi"));
        await room.waitForNextSimulationTick();
      }
      await pause(100);
      const steps = noises.filter((n) => n.kind === "step");
      const squeaks = noises.filter((n) => n.kind === "squeak");
      assert.ok(steps.length >= 2, `expected footsteps, got ${steps.length}`);
      assert.strictEqual(steps[0].radius, 2.5);
      assert.strictEqual(squeaks.length, 2);
      assert.strictEqual(squeaks[0].radius, 7);
    });

    it("broadcasts barks", async () => {
      const { c } = await solo(4);
      const barks: string[] = [];
      c.onMessage("bark", (m: { who: string; lineId: string }) => barks.push(`${m.who}:${m.lineId}`));
      // Kiwi walks to the locked door and presses E: wrong role.
      let z = 1.5;
      for (let seq = 1; z < 6.5; seq++) { z = Math.min(6.5, z + 0.15); c.send("pos", pos(1.5, z, seq)); await pause(55); }
      let x = 1.5;
      for (let seq = 100; x < 11.5; seq++) { x = Math.min(11.5, x + 0.15); c.send("pos", pos(x, 6.5, seq)); await pause(55); }
      c.send("interact", { who: "solo-kiwi" });
      await waitFor(() => barks.length > 0);
      assert.deepStrictEqual(barks, ["kiwi:wrong_kiwi_lock"]);
    });

    it("holds at most 3 players", async () => {
      const a = await colyseus.sdk.create("heist", {});
      await colyseus.sdk.joinById(a.roomId, {});
      await colyseus.sdk.joinById(a.roomId, {});
      await assert.rejects(colyseus.sdk.joinById(a.roomId, {}));
    });
  });
});
