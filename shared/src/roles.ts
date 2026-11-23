// Who may do what (PLAN.md Section 2). One table, used by the server's role
// checks and by the client's interaction prompts ("Pip can do this").

import type { Role } from "./types.js";

export type Action =
  | "pickUpSmall"     // pick up / drop a small list item
  | "liftHeavy"       // carry a heavy item (honey jar)
  | "liftCroissant"   // carry the Golden Croissant
  | "eatFood"         // Kiwi eats food on the spot
  | "pouchFood"       // Mochi stores food in cheek pouches
  | "giveFood"        // Mochi hands food to Kiwi
  | "vent"            // crawl through a vent
  | "latch"           // open a door's latch from the inside
  | "chewWire"        // lights out
  | "pickLock"        // open a locked door, noisily
  | "cover"           // hold Q: make a teammate quieter and hidden
  | "boost"           // hold F with a teammate at a ledge (Pip is the booster)
  | "ledgeTake"       // on a ledge: take the item quietly
  | "ledgePush"       // on a ledge: push the item off with a crash
  | "rideRoomba"
  | "rescue"
  | "callItANight"
  | "hide";

const EVERYONE: readonly Action[] = ["rideRoomba", "rescue", "callItANight", "hide"];

export const ROLE_ACTIONS: Readonly<Record<Role, readonly Action[]>> = {
  kiwi: [...EVERYONE, "pickUpSmall", "eatFood", "cover", "ledgeTake"],
  mochi: [...EVERYONE, "pouchFood", "giveFood", "vent", "latch", "chewWire", "ledgePush"],
  pip: [...EVERYONE, "pickUpSmall", "liftHeavy", "liftCroissant", "pickLock", "boost"],
};

export function canDo(role: Role, action: Action): boolean {
  return ROLE_ACTIONS[role].includes(action);
}

/** Roles that can do an action, in the order kiwi, mochi, pip. */
export function whoCan(action: Action): Role[] {
  return (Object.keys(ROLE_ACTIONS) as Role[]).filter((r) => canDo(r, action));
}
