// Shared type names used by both the server and the client.

export type Role = "kiwi" | "mochi" | "pip";
export const ROLES: readonly Role[] = ["kiwi", "mochi", "pip"];

/** Kinds of things a player can carry or pick up (PLAN.md Section 4.7). */
export type ItemKind = "small" | "heavy" | "croissant";
export type FoodKind = "strawberry" | "cheese" | "blueberry";
export type SurfaceColor = "red" | "yellow" | "blue" | "green";

/** Every state of Sir Crumbs's brain (PLAN.md Section 4.5). */
export type CatStateName =
  | "SLEEP" | "STIR" | "PATROL" | "PERCH" | "INVESTIGATE" | "CHASE"
  | "POUNCE" | "CATCH" | "SEARCH" | "GIVE_UP" | "RETURN" | "HUNT";

export type CatMode = "sleep" | "patrol" | "perch";

export type Phase =
  | "lobby" | "cutscene" | "intro" | "briefing" | "playing" | "caught" | "complete" | "ending";

/** "" means the player is in no special mode. */
export type PlayerMode = "" | "vent" | "ledge" | "roomba" | "covering" | "covered";

export type NoiseKind =
  | "step" | "squeak" | "lockClick" | "crash" | "jarBreak" | "wobble"
  | "chew" | "roomba" | "breadboxDing";

export type PingKind = 1 | 2 | 3 | 4; // 1 "Go here", 2 "Cat!", 3 "Wait", 4 "Help"
export type HoldKey = "E" | "F" | "Q";

// ---------------------------------------------------------------------------
// Level data (PLAN.md Section 8, "Level data format")
// ---------------------------------------------------------------------------

/** Positions are in world units. lamp = bright and warm; moon = normal light, cool. */
export interface LightDef { x: number; z: number; radius: number; kind: "lamp" | "moon"; }

export interface CatSettings {
  mode: CatMode;
  walk: number;
  chase: number;
  range: number;
  darkRange: number;
  fov: number;            // degrees
  hearing: number;
  giveUpAfter: number;    // seconds
  wakeAt?: number;        // sleep mode only
  checksHides: boolean;
  huntEvery?: number;     // Level 8 override of TUNING.cat.huntEvery
  huntOffset?: number;    // Level 8 override of TUNING.cat.huntOffset
}

export interface ListItemDef {
  kind: "small" | "heavy" | "ledge" | "croissant";
  name: string;
  model: string;
}

export interface LevelDef {
  id: number;
  key: string;
  name: string;
  listItem: ListItemDef | null;
  map: string[];
  cat: CatSettings;
  lights: LightDef[];
  /** "x,y" of a B/T group's top-left tile -> model name. */
  props: Record<string, string>;
  /** Line ids from client/src/content/script.ts. */
  intro: string[];
  /** Tutorial card ids. */
  cards: string[];
  music: "calm" | "tense";
}

// ---------------------------------------------------------------------------
// Network message payloads (PLAN.md Section 9, "Messages")
// ---------------------------------------------------------------------------

export interface ClientMessages {
  /** "" gives the role back. */
  role: { role: Role | "" };
  ready: { ready: boolean };
  start: Record<string, never>;
  skip: { holding: boolean };
  pos: { x: number; z: number; facing: number; moving: boolean; sneaking: boolean; seq: number; who?: string };
  interact: { who?: string };
  hold: { key: HoldKey; down: boolean; who?: string };
  ping: { kind: PingKind; x: number; z: number };
  rtc: { to: string; data: unknown };
  mic: { muted: boolean };
  next: { level?: number };
  retry: { level?: number };
  select: { level?: number };
}

export interface ServerMessages {
  noise: { x: number; z: number; radius: number; kind: NoiseKind };
  bark: { who: Role; lineId: string };
  toast: { text: string };
  sfx: { name: string; x?: number; z?: number };
  ping: { from: string; kind: PingKind; x: number; z: number };
  rtc: { from: string; data: unknown };
  correct: { x: number; z: number; who?: string };
  card: { cardId: string };
  complete: { stars: number; leftBehind: string[]; home: string[]; time: number };
  caught: Record<string, never>;
}

/** Options sent with client.create / client.joinById. */
export interface JoinOptions {
  name?: string;
  /** Dev mode: one client controls all three characters. */
  solo?: boolean;
  /** Dev mode only: start at this level. */
  level?: number;
}
