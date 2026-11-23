// Level 1 — The Mudroom (PLAN.md Section 6).
// The map is copied character for character from PLAN.md. Don't edit it by hand
// without updating PLAN.md too: shared/test/levels.test.ts compares them.

import type { LevelDef } from "../types.js";

export const L1: LevelDef = {
  id: 1, key: "mudroom", name: "The Mudroom",
  listItem: null,
  map: [
    "####################",
    "#S...BB......TTT...#",
    "#....BB......TTT...#",
    "#S..~~..........~..#",
    "#...~~.....B....~~.E",
    "#.........Z.......~E",
    "#S..~~.....B....~~.#",
    "#...~~..........~..#",
    "#....BB...TT.......#",
    "#....BB...TT....BB.#",
    "####################",
  ],
  cat: { mode: "sleep", walk: 1.6, chase: 3.8, range: 5, darkRange: 2.5, fov: 100, hearing: 1, giveUpAfter: 4, wakeAt: 0.35, checksHides: false },
  lights: [
    { x: 10.5, z: 5.5, radius: 2.5, kind: "lamp" },
    { x: 14.5, z: 3.5, radius: 3, kind: "moon" },
  ],
  props: {
    "5,1": "boot_pile",
    "13,1": "shoe_bench",
    "11,4": "basket_side",
    "11,6": "basket_side",
    "5,8": "laundry_basket",
    "10,8": "stool",
    "16,9": "watering_can",
  },
  intro: ["l1_crow_1", "l1_pip_1", "l1_kiwi_1"],
  cards: ["move_sneak", "squeak", "hide", "goal_escape"],
  music: "calm",
};
