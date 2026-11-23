// The state every client sees (PLAN.md Section 9, "Synced state").
// Keep it small: only what clients draw. Everything else stays in plain server objects.
//
// Colyseus schema 5 defines state with `schema({...})` instead of the @type
// decorators shown in PLAN.md; the fields and their meaning are the same.
// Phase 0 only needs the lobby fields and a position; later phases add the rest.

import { schema, t, type SchemaType } from "@colyseus/schema";

export const PlayerState = schema({
  id: t.string().default(""),            // sessionId
  name: t.string().default(""),
  role: t.string().default(""),          // "kiwi" | "mochi" | "pip" | ""
  ready: t.boolean().default(false),
  connected: t.boolean().default(true),
  x: t.number().default(0),
  z: t.number().default(0),
  facing: t.number().default(0),
  moving: t.boolean().default(false),
  sneaking: t.boolean().default(false),
});
export type PlayerState = SchemaType<typeof PlayerState>;

export const HeistState = schema({
  phase: t.string().default("lobby"),
  level: t.number().default(1),
  hostId: t.string().default(""),
  code: t.string().default(""),
  solo: t.boolean().default(false),
  players: t.map(PlayerState),
});
export type HeistState = SchemaType<typeof HeistState>;
