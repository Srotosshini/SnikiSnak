// The one room type, "heist" (PLAN.md Section 9).
//
// Phase 0: create a room with a 4-letter code, let up to 3 players join by that
// code, keep a host, and keep a dropped player's seat for 30 s. Role claiming,
// the level flow and the game tick arrive in later phases.

import { Room, type Client } from "colyseus";
import { ROLES, type JoinOptions, type Role, getLevel, parseMap, tileCenter } from "@snikisnak/shared";
import { HeistState, PlayerState } from "./schema/HeistState.js";
import { activeCodes, makeRoomCode } from "./roomCode.js";

const RECONNECT_SECONDS = 30;
const MAX_NAME_LENGTH = 16;

export class HeistRoom extends Room<{ state: HeistState }> {
  maxClients = 3;
  state = new HeistState();

  messages = {};

  onCreate(options: JoinOptions = {}): void {
    const code = makeRoomCode(activeCodes);
    activeCodes.add(code);
    this.roomId = code; // players join with client.joinById(code)
    this.state.code = code;
    this.state.solo = options.solo === true;
    console.log(`[heist ${code}] created${this.state.solo ? " (solo dev mode)" : ""}`);
  }

  onJoin(client: Client, options: JoinOptions = {}): void {
    const name = cleanName(options.name) || `Smuggler ${this.state.players.size + 1}`;
    const spawn = this.spawnFor(this.state.players.size);
    const player = new PlayerState().assign({
      id: client.sessionId,
      name,
      // Phase 0 auto-assigns the first free role; real role claiming comes in Phase 3.
      role: this.firstFreeRole() ?? "",
      x: spawn.x,
      z: spawn.z,
    });
    this.state.players.set(client.sessionId, player);
    if (!this.state.hostId) this.state.hostId = client.sessionId;
    console.log(`[heist ${this.state.code}] ${name} joined (${this.state.players.size}/3)`);
  }

  onDrop(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    // Colyseus calls onLeave itself if the seat expires. The promise only
    // rejects early when the room is shutting down, which is fine to ignore.
    Promise.resolve(this.allowReconnection(client, RECONNECT_SECONDS)).catch(() => undefined);
  }

  onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = true;
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    if (this.state.hostId === client.sessionId) {
      // The next player becomes host.
      const next = this.state.players.keys().next();
      this.state.hostId = next.done ? "" : next.value;
    }
    console.log(`[heist ${this.state.code}] ${client.sessionId} left (${this.state.players.size}/3)`);
  }

  onDispose(): void {
    activeCodes.delete(this.state.code);
    console.log(`[heist ${this.state.code}] disposed`);
  }

  private firstFreeRole(): Role | undefined {
    const taken = new Set<string>();
    this.state.players.forEach((p) => taken.add(p.role));
    return ROLES.find((r) => !taken.has(r));
  }

  /** Spawn tiles come from the current level's map, in reading order. */
  private spawnFor(index: number): { x: number; z: number } {
    const grid = parseMap(getLevel(this.state.level).map);
    const tile = grid.spawns[index % grid.spawns.length];
    return tileCenter(tile);
  }
}

function cleanName(name: unknown): string {
  return typeof name === "string" ? name.trim().slice(0, MAX_NAME_LENGTH) : "";
}
