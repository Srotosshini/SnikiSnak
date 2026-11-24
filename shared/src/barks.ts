// Which bark lines belong to which moment (PLAN.md Section 3, "In-game barks").
// Only the line ids live here, so the server can pick one; the words are in
// client/src/content/script.ts. More bark events are added in Phase 5.

import type { Role } from "./types.js";
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
} as const satisfies Record<string, Partial<Record<Role, readonly string[]>>>;

export type AbilityBark = keyof typeof ABILITY_BARKS;
