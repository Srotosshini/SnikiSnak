// The Colyseus connection (PLAN.md Sections 9 and 10).
//
// In development the game socket goes through Vite's HTTPS server at
// /colyseus (see vite.config.ts). In production the server serves the client
// itself, so it lives at the page's own origin. ?server=wss://host:port overrides both.

import { Client, type Room } from "@colyseus/sdk";
import type { JoinOptions } from "@snikisnak/shared";

/** What the client reads from the synced state in Phase 0 (server/src/rooms/schema/HeistState.ts). */
export interface PlayerView {
  id: string; name: string; role: string; ready: boolean; connected: boolean;
  x: number; z: number; facing: number;
}
export interface HeistView {
  phase: string; level: number; hostId: string; code: string; solo: boolean;
  players: { size: number; forEach(cb: (p: PlayerView, id: string) => void): void };
  toJSON(): unknown;
}

export type HeistRoom = Room<unknown, HeistView>;

export function serverUrl(params: URLSearchParams): string {
  const override = params.get("server");
  if (override) return override.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  return import.meta.env.DEV ? `${location.origin}/colyseus` : location.origin;
}

export class Net {
  readonly client: Client;
  room: HeistRoom | null = null;

  constructor(url: string) {
    this.client = new Client(url);
  }

  async host(options: JoinOptions): Promise<HeistRoom> {
    this.room = await this.client.create<HeistView>("heist", options);
    return this.room;
  }

  async join(code: string, options: JoinOptions): Promise<HeistRoom> {
    this.room = await this.client.joinById<HeistView>(code.toUpperCase(), options);
    return this.room;
  }

  async leave(): Promise<void> {
    await this.room?.leave();
    this.room = null;
  }
}
