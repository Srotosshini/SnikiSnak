// The Colyseus connection (PLAN.md Sections 9 and 10).
//
// In development the game socket goes through Vite's HTTPS server at
// /colyseus (see vite.config.ts). In production the server serves the client
// itself, so it lives at the page's own origin. ?server=wss://host:port overrides both.

import { Client, type Room } from "@colyseus/sdk";
import type { JoinOptions } from "@snikisnak/shared";

/** What the client reads from the synced state (server/src/rooms/schema/HeistState.ts). */
export interface PlayerView {
  id: string; owner: string; name: string; role: string; ready: boolean; connected: boolean;
  x: number; z: number; facing: number; moving: boolean; sneaking: boolean;
  hidden: boolean; seen: number; jarred: boolean; rescue: number; carrying: string;
  mode: string; holdKind: string; hold: number;
}
export interface DoorView { id: string; open: boolean; pick: number; }
export interface CatView {
  x: number; z: number; facing: number; headYaw: number; state: string; alert: number;
  targetId: string; vision: number; bubble: string; bubbleSeq: number;
}
export interface ItemView {
  id: string; kind: string; x: number; z: number; carriedBy: string; onLedge: boolean; visible: boolean;
}
interface MapView<T> {
  size: number;
  get(key: string): T | undefined;
  forEach(cb: (value: T, key: string) => void): void;
}
export interface HeistView {
  phase: string; level: number; run: number; timer: number; hostId: string; code: string; solo: boolean;
  exitReady: boolean; exitHold: number; anyoneJarred: boolean; stars: number;
  players: MapView<PlayerView>;
  cat: CatView;
  items: MapView<ItemView>;
  doors: MapView<DoorView>;
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
