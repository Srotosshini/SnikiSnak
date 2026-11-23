// Level 2 — The Hallway (PLAN.md Section 6).
// The map is copied character for character from PLAN.md. Don't edit it by hand
// without updating PLAN.md too: shared/test/levels.test.ts compares them.

import type { LevelDef } from "../types.js";

export const L2: LevelDef = {
  id: 2, key: "hallway", name: "The Hallway",
  listItem: { kind: "small", name: "One silver thimble", model: "thimble" },
  map: [
    "######################",
    "#.....T......BB....$.#",
    "#..........1.......2.#",
    "#..........Z.........#",
    "#..BBBBBBB..BBBBBBB..#",
    "#..BBBBBBB..BBBBBBB.~#",
    "#..BBBBBBB..BBBBBBB.~#",
    "#.........T..........E",
    "#.~~.......4.......3.E",
    "#....................#",
    "#S....BB....TT....BB.#",
    "#S....BB....TT....BB.#",
    "#S...................#",
    "######################",
  ],
  cat: { mode: "patrol", walk: 1.8, chase: 4, range: 6, darkRange: 2.5, fov: 90, hearing: 1, giveUpAfter: 5, checksHides: false },
  lights: [
    { x: 19.5, z: 4.5, radius: 2.5, kind: "lamp" },
    { x: 3.5, z: 8.5, radius: 3, kind: "moon" },
  ],
  props: {
    "13,1": "sewing_basket",
    "3,4": "sideboard",
    "12,4": "sideboard",
    "6,10": "shoe_cabinet",
    "18,10": "plant_pot",
    "6,1": "umbrella_stand",
    "10,7": "hall_chair",
    "12,10": "bench",
  },
  intro: ["l2_crow_1", "l2_mochi_1", "l2_crow_2"],
  cards: ["cone", "pick_up", "rescue", "carry_out"],
  music: "calm",
};
