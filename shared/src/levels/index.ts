// All levels, in play order.

import type { LevelDef } from "../types.js";
import { L1 } from "./l1_mudroom.js";
import { L2 } from "./l2_hallway.js";
import { L3 } from "./l3_pantry.js";
import { L4 } from "./l4_study.js";
import { L5 } from "./l5_living_room.js";
import { L6 } from "./l6_laundry.js";
import { L7 } from "./l7_bedroom.js";
import { L8 } from "./l8_kitchen.js";

export const LEVELS: readonly LevelDef[] = [L1, L2, L3, L4, L5, L6, L7, L8];

export function getLevel(id: number): LevelDef {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`No level with id ${id}`);
  return level;
}

export { L1, L2, L3, L4, L5, L6, L7, L8 };
