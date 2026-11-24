// Which bark lines belong to which moment (PLAN.md Section 3, "In-game barks",
// and "Sir Crumbs's thought bubbles"). Only the line ids live here, so the server
// can pick one; the words are in client/src/content/script.ts.

import type { Role, CatStateName } from "./types.js";
import type { Action } from "./roles.js";

/** Wrong-role barks: pressing E on something your role can't use. */
export const WRONG_ROLE_BARKS: Readonly<Record<Role, Partial<Record<Action, string>>>> = {
  mochi: {
    pickUpSmall: "wrong_mochi_item",
    liftHeavy: "wrong_mochi_item",
    liftCroissant: "wrong_mochi_item",
    pickLock: "wrong_mochi_lock",
  },
  kiwi: {
    pickLock: "wrong_kiwi_lock",
    liftHeavy: "wrong_kiwi_heavy",
    liftCroissant: "wrong_kiwi_heavy",
    vent: "wrong_kiwi_vent",
  },
  pip: {
    vent: "wrong_pip_vent",
    chewWire: "wrong_pip_wire",
  },
};

/** Ability barks: one of these is picked at random. */
export const ABILITY_BARKS = {
  lockStart: { pip: ["ability_pip_lock"] },
  ventEnter: { mochi: ["ability_mochi_vent_1", "ability_mochi_vent_2"] },
  blended: { kiwi: ["ability_kiwi_blend_1", "ability_kiwi_blend_2"] },
  rideRoomba: { mochi: ["ability_mochi_roomba"] },
} as const satisfies Record<string, Partial<Record<Role, readonly string[]>>>;

export type AbilityBark = keyof typeof ABILITY_BARKS;

/** The events in Section 3's bark table. */
export type BarkEvent =
  | "spotted" | "jarred" | "teammateJarred" | "rescued" | "grab" | "lightsOut"
  | "hiding" | "squeak" | "catGivesUp" | "leftBehind" | "idle";

const ids = (event: string, role: Role, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `bark_${event}_${role}_${i + 1}`);

/** Line ids for each event and character (two variants where Section 3 gives two). */
export const EVENT_BARKS: Readonly<Record<BarkEvent, Record<Role, string[]>>> = {
  spotted: { kiwi: ids("spotted", "kiwi", 2), mochi: ids("spotted", "mochi", 2), pip: ids("spotted", "pip", 2) },
  jarred: { kiwi: ids("jarred", "kiwi", 1), mochi: ids("jarred", "mochi", 1), pip: ids("jarred", "pip", 1) },
  teammateJarred: { kiwi: ids("teammateJarred", "kiwi", 1), mochi: ids("teammateJarred", "mochi", 1), pip: ids("teammateJarred", "pip", 1) },
  rescued: { kiwi: ids("rescued", "kiwi", 1), mochi: ids("rescued", "mochi", 1), pip: ids("rescued", "pip", 1) },
  grab: { kiwi: ids("grab", "kiwi", 1), mochi: ids("grab", "mochi", 1), pip: ids("grab", "pip", 1) },
  lightsOut: { kiwi: ids("lightsOut", "kiwi", 1), mochi: ids("lightsOut", "mochi", 1), pip: ids("lightsOut", "pip", 1) },
  hiding: { kiwi: ids("hiding", "kiwi", 1), mochi: ids("hiding", "mochi", 1), pip: ids("hiding", "pip", 1) },
  squeak: { kiwi: ids("squeak", "kiwi", 1), mochi: ids("squeak", "mochi", 1), pip: ids("squeak", "pip", 1) },
  catGivesUp: { kiwi: ids("catGivesUp", "kiwi", 1), mochi: ids("catGivesUp", "mochi", 1), pip: ids("catGivesUp", "pip", 1) },
  leftBehind: { kiwi: ids("leftBehind", "kiwi", 1), mochi: ids("leftBehind", "mochi", 1), pip: ids("leftBehind", "pip", 1) },
  idle: { kiwi: ids("idle", "kiwi", 1), mochi: ids("idle", "mochi", 1), pip: ids("idle", "pip", 1) },
};

/** Sir Crumbs's thought bubbles when he changes state (at most one every 3 s). */
export const CAT_BUBBLES: Partial<Record<CatStateName, string[]>> = {
  SLEEP: ["cat_sleep_1", "cat_sleep_1", "cat_sleep_1", "cat_sleep_2"], // "...tuna..." is rare
  STIR: ["cat_stir_1"],
  INVESTIGATE: ["cat_investigate_1", "cat_investigate_2"],
  CHASE: ["cat_spotted_1"],
  SEARCH: ["cat_search_1"],
  GIVE_UP: ["cat_giveup_1", "cat_giveup_2"],
  CATCH: ["cat_catch_1"],
};

/** Bubbles for special moments (Phases 6 and 7). */
export const CAT_MOMENT_BUBBLES = {
  chasing: "cat_chase_1",
  lightsOut: "cat_lightsout_1",
  roomba: "cat_roomba_1",
  croissant: "cat_croissant_1",
} as const;

/** Tutorial cards that appear the first time their situation happens (Section 4.9). */
export const SITUATION_CARDS = {
  squeak: "squeak",
  stir: "stirring",
  jarred: "jarred",
  spotted: "cone",
} as const;

export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}
