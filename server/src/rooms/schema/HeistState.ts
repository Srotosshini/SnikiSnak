// The state every client sees (PLAN.md Section 9, "Synced state").
// Keep it small: only what clients draw. Everything else stays in plain server objects.
//
// Colyseus schema 5 defines state with `schema({...})` instead of the @type
// decorators shown in PLAN.md; the fields and their meaning are the same.
// Fields are added phase by phase as the game needs them.

import { schema, t, type SchemaType } from "@colyseus/schema";

export const PlayerState = schema({
  id: t.string().default(""),            // player id: the sessionId (or "solo-<role>" in dev mode)
  owner: t.string().default(""),         // sessionId of the client that controls this character
  name: t.string().default(""),
  role: t.string().default(""),          // "kiwi" | "mochi" | "pip" | ""
  ready: t.boolean().default(false),
  connected: t.boolean().default(true),
  x: t.number().default(0),
  z: t.number().default(0),
  facing: t.number().default(0),
  moving: t.boolean().default(false),
  sneaking: t.boolean().default(false),
  hidden: t.boolean().default(false),    // computed by the server
  seen: t.number().default(0),           // this player's detection meter, 0..1
  jarred: t.boolean().default(false),
  rescue: t.number().default(0),         // rescue progress on this player's jar, 0..1
  carrying: t.string().default(""),      // item id
  mode: t.string().default(""),          // "" | vent | ledge | roomba | covering | covered
  holdKind: t.string().default(""),      // what the current hold is doing: "" | rescue | exit | pick | latch
  hold: t.number().default(0),           // its progress, 0..1
});
export type PlayerState = SchemaType<typeof PlayerState>;

export const CatState = schema({
  x: t.number().default(0),
  z: t.number().default(0),
  facing: t.number().default(0),
  headYaw: t.number().default(0),        // perch sweep and look-around
  state: t.string().default("SLEEP"),
  alert: t.number().default(0),
  targetId: t.string().default(""),
  vision: t.number().default(0),         // current view range in tiles; 0 = eyes shut
  bubble: t.string().default(""),
  bubbleSeq: t.number().default(0),
});
export type CatState = SchemaType<typeof CatState>;

export const ItemState = schema({
  id: t.string().default(""),
  kind: t.string().default(""),          // "small" | "heavy" | "croissant"
  x: t.number().default(0),
  z: t.number().default(0),
  carriedBy: t.string().default(""),
  onLedge: t.boolean().default(false),
  visible: t.boolean().default(true),
});
export type ItemState = SchemaType<typeof ItemState>;

export const DoorState = schema({
  id: t.string().default(""),
  open: t.boolean().default(false),
  pick: t.number().default(0),           // lock-pick progress, 0..1
});
export type DoorState = SchemaType<typeof DoorState>;

export const HeistState = schema({
  phase: t.string().default("lobby"),
  level: t.number().default(1),
  /** Seconds left in the intro or briefing. */
  timer: t.number().default(0),
  /** Goes up every time a level starts or restarts, so clients know to rebuild. */
  run: t.number().default(0),
  hostId: t.string().default(""),
  code: t.string().default(""),
  solo: t.boolean().default(false),
  /** "Hold F — Call it a night" is available (2+ free players in the exit zone, item delivered). */
  exitReady: t.boolean().default(false),
  exitHold: t.number().default(0),
  anyoneJarred: t.boolean().default(false),
  stars: t.number().default(0),
  players: t.map(PlayerState),
  cat: t.ref(CatState),
  items: t.map(ItemState),
  doors: t.map(DoorState),
});
export type HeistState = SchemaType<typeof HeistState>;
