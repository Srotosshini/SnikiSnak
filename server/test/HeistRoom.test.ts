import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";

import appConfig from "../src/app.config.js";
import { CODE_LETTERS, makeRoomCode, normalizeCode } from "../src/rooms/roomCode.js";
import type { HeistRoom } from "../src/rooms/HeistRoom.js";

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

  it("uses its 4-letter code as the room id", async () => {
    const room = await colyseus.createRoom("heist", {});
    assert.match(room.roomId, /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
    assert.strictEqual(room.state.code, room.roomId);
  });

  it("lets players join by code, assigns roles and a host", async () => {
    const host = await colyseus.sdk.create("heist", { name: "Ana" });
    const code = host.roomId;
    const guest = await colyseus.sdk.joinById(code, { name: "Ben" });
    await guest.waitForNextPatch();

    const room = colyseus.getRoomById(code) as unknown as HeistRoom;
    assert.strictEqual(room.state.players.size, 2);
    assert.strictEqual(room.state.hostId, host.sessionId);
    const roles = [...room.state.players.values()].map((p) => p.role).sort();
    assert.deepStrictEqual(roles, ["kiwi", "mochi"]);
    assert.strictEqual(room.state.players.get(guest.sessionId)?.name, "Ben");

    await host.leave();
    await guest.waitForNextPatch();
    assert.strictEqual(room.state.hostId, guest.sessionId, "the next player becomes host");
  });

  it("holds at most 3 players", async () => {
    const a = await colyseus.sdk.create("heist", {});
    await colyseus.sdk.joinById(a.roomId, {});
    await colyseus.sdk.joinById(a.roomId, {});
    await assert.rejects(colyseus.sdk.joinById(a.roomId, {}));
  });
});
