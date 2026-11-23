// Level 6 — The Laundry Room (PLAN.md Section 7).
// The map is copied character for character from PLAN.md. Don't edit it by hand
// without updating PLAN.md too: shared/test/levels.test.ts compares them.

import type { LevelDef } from "../types.js";

export const L6: LevelDef = {
  id: 6, key: "laundry", name: "The Laundry Room",
  listItem: { kind: "ledge", name: "One sparkly sock", model: "sock" },
  map: [
    "##########################",
    "#S.......BBBB^BBBB.....W.#",
    "#S.......................#",
    "#S.......................#",
    "#.......1...........2....#",
    "#....TT.....~~.....TT....#",
    "#....TT.....~~.....TT....#",
    "#........................#",
    "#..BBBB....Z.......BBBB..#",
    "#..BBBB............BBBB..#",
    "#....4.............3.....#",
    "#..........NNNN.........TE",
    "#.W........NNNN.........TE",
    "##########################",
  ],
  cat: { mode: "patrol", walk: 2, chase: 4.2, range: 6, darkRange: 2.5, fov: 90, hearing: 1, giveUpAfter: 6, checksHides: false },
  lights: [
    { x: 13.5, z: 2.5, radius: 4, kind: "lamp" },
    { x: 3.5, z: 11.5, radius: 2, kind: "lamp" },
    { x: 20.5, z: 12.5, radius: 2.5, kind: "moon" },
  ],
  props: {
    "9,1": "dryer",
    "14,1": "washer",
    "3,8": "sink_cabinet",
    "19,8": "detergent_shelf",
    "5,5": "laundry_basket",
    "19,5": "laundry_basket",
    "24,11": "hamper",
  },
  intro: ["l6_crow_1", "l6_pip_1", "l6_mochi_1"],
  cards: ["chew_wire", "boost", "ledge_take"],
  music: "calm",
};
