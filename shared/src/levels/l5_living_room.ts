// Level 5 — The Living Room (PLAN.md Section 7).
// The map is copied character for character from PLAN.md. Don't edit it by hand
// without updating PLAN.md too: shared/test/levels.test.ts compares them.

import type { LevelDef } from "../types.js";

export const L5: LevelDef = {
  id: 5, key: "living_room", name: "The Living Room",
  listItem: { kind: "small", name: "The blue button", model: "blue_button" },
  map: [
    "##########################",
    "#bb.#....BBBBBBBBBB......#",
    "#.V.#....BBBBBBBBBB....T.#",
    "####...........Z.......T.#",
    "#T.......................#",
    "#T...RRRR...UUUU...YYYY..#",
    "#....RRRR...UUUU...YYYY.DE",
    "#....RRRR...UU$U...YYYY.DE",
    "#....RRRR...UUUU...YYYY..#",
    "#........................#",
    "#S...TT.....BB.....TT..y.#",
    "#S...TT.....BB.....TT....#",
    "#S..r.V..................#",
    "#........................#",
    "##########################",
  ],
  cat: { mode: "perch", walk: 2, chase: 4, range: 7, darkRange: 2.5, fov: 70, hearing: 1, giveUpAfter: 5, checksHides: false },
  lights: [
    { x: 22.5, z: 3.5, radius: 3, kind: "lamp" },
    { x: 13.5, z: 7.5, radius: 3, kind: "moon" },
  ],
  props: {
    "9,1": "couch",
    "12,10": "tv_cabinet",
    "23,2": "side_table",
    "1,4": "magazine_rack",
    "5,10": "coffee_table",
    "19,10": "coffee_table",
  },
  intro: ["l5_crow_1", "l5_kiwi_1", "l5_crow_2"],
  cards: ["blend", "closet_vent", "give_food", "pet_door"],
  music: "calm",
};
