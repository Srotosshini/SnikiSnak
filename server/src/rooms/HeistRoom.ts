// The one room type, "heist" (PLAN.md Section 9).
//
// Phases: lobby → cutscene (first run of Level 1 only) → intro (tin-can call) →
// briefing (up to 20 s) → playing → caught or complete → the next level's intro.
// (The ending arrives in Phase 7.)
//
// Lobby: players claim roles (no two the same), tick Ready, and the host
// presses GO once there are 3 players with 3 roles, all ready. The room locks
// when it leaves the lobby. ?dev=1 makes a solo room where one client controls
// all three characters and play starts at once.

import { Room, type Client } from "colyseus";
import {
  LEVELS, ROLES, TUNING, type ClientMessages, type JoinOptions, type NoiseEvent, type Role,
  type ServerMessages, type Vec2, getLevel, parseMap, tileCenter,
} from "@snikisnak/shared";
import { HeistState, PlayerState } from "./schema/HeistState.js";
import { activeCodes, makeRoomCode } from "./roomCode.js";
import { type SimEvents, Simulation } from "../game/Simulation.js";

const RECONNECT_SECONDS = 30;
const MAX_NAME_LENGTH = 16;
const ROLE_NAMES: Record<Role, string> = { kiwi: "Kiwi", mochi: "Mochi", pip: "Pip" };

export class HeistRoom extends Room<{ state: HeistState }> {
  maxClients = 3;
  state = new HeistState();
  sim!: Simulation;
  /** The opening cutscene plays once per room, before Level 1. */
  private cutsceneDone = false;
  /** When each client started holding Space during the cutscene. */
  private readonly skipHeld = new Map<string, number>();
  private elapsed = 0;
  private readonly lastPingAt = new Map<string, number>();

  messages = {
    role: (client: Client, msg: ClientMessages["role"] | { role: "" }) => this.claimRole(client, msg?.role),
    ready: (client: Client, msg: ClientMessages["ready"]) => this.setReady(client, msg?.ready === true),
    start: (client: Client) => {
      if (this.isHost(client) && this.state.phase === "lobby" && this.canStart()) {
        void this.lock();
        if (this.state.level === 1 && !this.cutsceneDone) this.startCutscene();
        else this.startLevel(this.state.level);
      }
    },
    select: (client: Client, msg: ClientMessages["select"]) => {
      const level = Number(msg?.level);
      if (!this.isHost(client) || !LEVELS.some((l) => l.id === level)) return;
      // Level select: from the lobby it picks the first level; after a level it starts that one.
      if (this.state.phase === "lobby") this.state.level = level;
      else if (this.levelOver()) this.startLevel(level);
    },
    retry: (client: Client) => {
      if (this.isHost(client) && this.levelOver()) this.startLevel(this.state.level);
    },
    next: (client: Client) => {
      if (!this.isHost(client) || !this.levelOver()) return;
      const next = this.state.phase === "complete" ? Math.min(this.state.level + 1, LEVELS.length) : this.state.level;
      this.startLevel(next);
    },
    pos: (client: Client, msg: ClientMessages["pos"]) => this.onPos(client, msg),
    // Holding Space during the cutscene: everyone holding for 1 s skips it.
    skip: (client: Client, msg: ClientMessages["skip"]) => {
      if (msg?.holding === true) { if (!this.skipHeld.has(client.sessionId)) this.skipHeld.set(client.sessionId, this.elapsed); }
      else this.skipHeld.delete(client.sessionId);
    },
    // Pings (keys 1-4): "Go here", "Cat!", "Wait", "Help". At most one per player every 0.5 s.
    ping: (client: Client, msg: ClientMessages["ping"]) => {
      const kind = Number(msg?.kind);
      const x = Number(msg?.x), z = Number(msg?.z);
      if (![1, 2, 3, 4].includes(kind) || !Number.isFinite(x) || !Number.isFinite(z)) return;
      const last = this.lastPingAt.get(client.sessionId) ?? -Infinity;
      if (this.elapsed - last < TUNING.flow.pingEvery) return;
      this.lastPingAt.set(client.sessionId, this.elapsed);
      const p = this.ownedPlayer(client, (msg as { who?: string }).who);
      const out: ServerMessages["ping"] = { from: p?.id ?? client.sessionId, kind: kind as 1 | 2 | 3 | 4, x, z };
      this.broadcast("ping", out);
    },
    // Voice chat signalling (Section 10): forward offers, answers and ICE candidates
    // only to the player named in `to`, adding `from`.
    rtc: (client: Client, msg: ClientMessages["rtc"]) => {
      if (!msg || typeof msg.to !== "string" || msg.to === client.sessionId) return;
      const target = this.clients.find((c) => c.sessionId === msg.to);
      const out: ServerMessages["rtc"] = { from: client.sessionId, data: msg.data };
      target?.send("rtc", out);
    },
    mic: (client: Client, msg: ClientMessages["mic"]) => {
      this.forOwned(client, (p) => { p.micOff = msg?.muted === true; });
    },
    interact: (client: Client, msg: ClientMessages["interact"]) => {
      const p = this.ownedPlayer(client, msg?.who);
      if (p && this.state.phase === "playing") this.sim.interact(p.id);
    },
    hold: (client: Client, msg: ClientMessages["hold"]) => {
      const p = this.ownedPlayer(client, msg?.who);
      if (p && msg && typeof msg.key === "string") this.sim.setHold(p.id, msg.key, msg.down === true);
    },
  };

  onCreate(options: JoinOptions = {}): void {
    const code = makeRoomCode(activeCodes);
    activeCodes.add(code);
    this.roomId = code; // players join with client.joinById(code)
    this.state.code = code;
    this.state.solo = options.solo === true;
    if (this.state.solo) this.maxClients = 1;

    // ?level=N picks the first level (the host can change it in the lobby).
    this.state.level = LEVELS.some((l) => l.id === options.level) ? options.level! : 1;
    this.sim = this.makeSim(this.state.level);
    this.state.phase = "lobby";
    if (this.state.solo) this.startLevel(this.state.level);

    this.setSimulationInterval((ms) => this.tick(ms / 1000), 1000 / TUNING.tickHz);
    console.log(`[heist ${code}] created, level ${this.state.level}${this.state.solo ? " (solo dev mode)" : ""}`);
  }

  onJoin(client: Client, options: JoinOptions = {}): void {
    if (this.state.solo) {
      // Dev mode: three characters, all controlled by this one client.
      for (const role of ROLES) this.addPlayer(`solo-${role}`, client.sessionId, ROLE_NAMES[role], role);
    } else {
      const name = cleanName(options.name) || `Smuggler ${this.state.players.size + 1}`;
      this.addPlayer(client.sessionId, client.sessionId, name, "");
    }
    if (!this.state.hostId) this.state.hostId = client.sessionId;
    console.log(`[heist ${this.state.code}] ${client.sessionId} joined (${this.clients.length}/${this.maxClients})`);
  }

  onDrop(client: Client): void {
    this.forOwned(client, (p) => { p.connected = false; p.moving = false; });
    // Colyseus calls onLeave itself if the seat expires. The promise only
    // rejects early when the room is shutting down, which is fine to ignore.
    Promise.resolve(this.allowReconnection(client, RECONNECT_SECONDS)).catch(() => undefined);
  }

  onReconnect(client: Client): void {
    this.forOwned(client, (p) => { p.connected = true; });
  }

  onLeave(client: Client): void {
    const ids: string[] = [];
    this.forOwned(client, (p) => ids.push(p.id));
    for (const id of ids) {
      this.state.players.delete(id);
      this.sim.removePlayer(id);
    }
    if (this.state.hostId === client.sessionId) {
      // The next player becomes host.
      const next = this.clients.find((c) => c.sessionId !== client.sessionId);
      this.state.hostId = next?.sessionId ?? "";
    }
    console.log(`[heist ${this.state.code}] ${client.sessionId} left (${this.clients.length}/${this.maxClients})`);
  }

  onDispose(): void {
    activeCodes.delete(this.state.code);
    console.log(`[heist ${this.state.code}] disposed`);
  }

  // -------------------------------------------------------------------------
  // Lobby
  // -------------------------------------------------------------------------

  private claimRole(client: Client, role: unknown): void {
    if (this.state.phase !== "lobby") return;
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (role === "") { p.role = ""; p.ready = false; return; }
    if (!ROLES.includes(role as Role)) return;
    // The server refuses a role someone else already has.
    let taken = false;
    this.state.players.forEach((o) => { if (o.id !== p.id && o.role === role) taken = true; });
    if (!taken) p.role = role as Role;
  }

  private setReady(client: Client, ready: boolean): void {
    const phase = this.state.phase;
    if (phase === "lobby") {
      const p = this.state.players.get(client.sessionId);
      if (p) p.ready = ready && p.role !== "";
    } else if (phase === "intro" || phase === "briefing") {
      this.forOwned(client, (p) => { p.ready = ready; });
    }
  }

  /** 3 players, 3 different roles, everyone ready. */
  canStart(): boolean {
    const players = [...this.state.players.values()];
    const roles = new Set(players.map((p) => p.role).filter((r) => r !== ""));
    return players.length === 3 && roles.size === 3 && players.every((p) => p.ready);
  }

  // -------------------------------------------------------------------------
  // Level flow
  // -------------------------------------------------------------------------

  /** Start (or restart) a level: everyone back to the spawns, a fresh cat, then the intro. */
  startLevel(id: number): void {
    const level = getLevel(id);
    const spawns = parseMap(level.map).spawns;
    this.state.level = id;
    this.state.run += 1;
    this.state.exitReady = false;
    this.state.exitHold = 0;
    this.state.anyoneJarred = false;
    this.state.stars = 0;
    this.sim = this.makeSim(id);

    // Spawns go in role order: Kiwi, Mochi, Pip.
    const players = [...this.state.players.values()].sort((a, b) => ROLES.indexOf(a.role as Role) - ROLES.indexOf(b.role as Role));
    players.forEach((p, i) => {
      const s = tileCenter(spawns[i % spawns.length]);
      p.assign({ x: s.x, z: s.z, facing: 0, moving: false, sneaking: false, hidden: false, seen: 0,
                 jarred: false, rescue: 0, carrying: "", mode: "", holdKind: "", hold: 0, ready: false });
      this.sim.addPlayer(p);
    });

    if (this.state.solo) {
      // Dev mode skips the intro and briefing.
      this.state.phase = "playing";
      this.state.timer = 0;
    } else {
      this.state.phase = "intro";
      this.state.timer = TUNING.flow.introTitle + level.intro.length * TUNING.flow.introPerLine;
    }
  }

  /** The opening cutscene "The Royal Errand" (Section 3). */
  private startCutscene(): void {
    this.state.phase = "cutscene";
    this.state.timer = TUNING.flow.cutscene;
    this.skipHeld.clear();
  }

  private endCutscene(): void {
    this.cutsceneDone = true;
    this.state.skipping = 0;
    this.skipHeld.clear();
    this.startLevel(1);
  }

  private tick(dt: number): void {
    const s = this.state;
    this.elapsed += dt;
    if (s.phase === "cutscene") {
      s.timer = Math.max(0, s.timer - dt);
      const everyoneHolding = this.clients.length > 0 && this.clients.every((c) => {
        const since = this.skipHeld.get(c.sessionId);
        return since !== undefined && this.elapsed - since >= TUNING.flow.skipHold;
      });
      s.skipping = this.clients.filter((c) => this.skipHeld.has(c.sessionId)).length;
      if (s.timer <= 0 || everyoneHolding) this.endCutscene();
      return;
    }
    if (s.phase === "intro" || s.phase === "briefing") {
      s.timer = Math.max(0, s.timer - dt);
      const allReady = s.players.size > 0 && [...s.players.values()].every((p) => p.ready);
      if (s.timer <= 0 || allReady) {
        s.players.forEach((p) => { p.ready = false; });
        if (s.phase === "intro") {
          s.phase = "briefing";
          s.timer = TUNING.flow.briefing;
        } else {
          s.phase = "playing";
          s.timer = 0;
        }
      }
    } else if (s.phase === "playing") {
      this.sim.tick(dt);
    }
  }

  private makeSim(levelId: number): Simulation {
    return new Simulation(this.state, getLevel(levelId), this.simEvents());
  }

  private simEvents(): SimEvents {
    return {
      noise: (n: NoiseEvent) => {
        const msg: ServerMessages["noise"] = { x: n.x, z: n.z, radius: n.radius, kind: n.kind };
        this.broadcast("noise", msg);
      },
      toast: (playerId: string, text: string) => {
        const owner = this.state.players.get(playerId)?.owner;
        const client = this.clients.find((c) => c.sessionId === owner);
        const msg: ServerMessages["toast"] = { text };
        client?.send("toast", msg);
      },
      sfx: (name: string, at?: Vec2) => {
        const msg: ServerMessages["sfx"] = { name, x: at?.x, z: at?.z };
        this.broadcast("sfx", msg);
      },
      bark: (who: Role, lineId: string) => {
        const msg: ServerMessages["bark"] = { who, lineId };
        this.broadcast("bark", msg);
      },
      card: (cardId: string) => {
        const msg: ServerMessages["card"] = { cardId };
        this.broadcast("card", msg);
      },
      complete: (stars: number, leftBehind: string[], home: string[], time: number) => {
        this.state.phase = "complete";
        const msg: ServerMessages["complete"] = { stars, leftBehind, home, time };
        this.broadcast("complete", msg);
        console.log(`[heist ${this.state.code}] level ${this.state.level} complete, ${stars} star(s)`);
      },
      caught: () => {
        this.state.phase = "caught";
        this.broadcast("caught", {});
        console.log(`[heist ${this.state.code}] level ${this.state.level}: caught`);
      },
    };
  }

  private levelOver(): boolean {
    return this.state.phase === "caught" || this.state.phase === "complete";
  }

  private isHost(client: Client): boolean {
    return client.sessionId === this.state.hostId;
  }

  /** The player a message is about: the sender's own, or in dev mode the one named by `who`. */
  private ownedPlayer(client: Client, who: unknown): PlayerState | undefined {
    const id = typeof who === "string" ? who : client.sessionId;
    const p = this.state.players.get(id);
    return p && p.owner === client.sessionId ? p : undefined;
  }

  private onPos(client: Client, msg: ClientMessages["pos"]): void {
    if (this.state.phase !== "playing" || typeof msg !== "object" || msg === null) return;
    const player = this.ownedPlayer(client, msg.who);
    if (!player) return;

    const result = this.sim.receivePos(player.id, {
      x: Number(msg.x), z: Number(msg.z), facing: Number(msg.facing),
      moving: msg.moving === true, sneaking: msg.sneaking === true, seq: Number(msg.seq) || 0,
    });
    if (!result.ok && result.notify) {
      const correct: ServerMessages["correct"] = { x: result.x, z: result.z, who: player.id };
      client.send("correct", correct);
    }
  }

  private addPlayer(id: string, owner: string, name: string, role: Role | ""): void {
    const spawn = this.spawnFor(this.state.players.size);
    const player = new PlayerState().assign({ id, owner, name, role, x: spawn.x, z: spawn.z });
    this.state.players.set(id, player);
    this.sim.addPlayer(player);
  }

  private forOwned(client: Client, fn: (p: PlayerState) => void): void {
    this.state.players.forEach((p) => { if (p.owner === client.sessionId) fn(p); });
  }

  /** Spawn tiles come from the current level's map, in reading order. */
  private spawnFor(index: number): { x: number; z: number } {
    const spawns = parseMap(getLevel(this.state.level).map).spawns;
    return tileCenter(spawns[index % spawns.length]);
  }
}

function cleanName(name: unknown): string {
  return typeof name === "string" ? name.trim().slice(0, MAX_NAME_LENGTH) : "";
}
