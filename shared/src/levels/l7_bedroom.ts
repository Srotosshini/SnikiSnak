// Level 7 — The Bedroom (PLAN.md Section 7).
// The map is copied character for character from PLAN.md. Don't edit it by hand
// without updating PLAN.md too: shared/test/levels.test.ts compares them.

import type { LevelDef } from "../types.js";

export const L7: LevelDef = {
  id: 7, key: "bedroom", name: "The Bedroom",
  listItem: { kind: "small", name: "The music-box key", model: "music_key" },
  map: [
    "##########################",
    "#........BBBBBBBB........#",
    "#..TT....BTTTTTTB........#",
    "#..TT....TTTTTTTT...~~...#",
    "#........BTTT$TTB...~~...#",
    "#....~~..BTTTTTTB........#",
    "#....~~..BBBTTBBB........#",
    "#..1.......Z.........2...#",
    "#..~~.......~~.........TTE",
    "#..~~.......~~...BB....TTE",
    "#S...............BB...~~.#",
    "#S...4....YYYY.......3~~.#",
    "#S........YYYY...O.......#",
    "#....y...................#",
    "##########################",
  ],
  cat: { mode: "patrol", walk: 2.2, chase: 4.4, range: 6.5, darkRange: 2.5, fov: 90, hearing: 1.2, giveUpAfter: 6, checksHides: true },
  lights: [
    { x: 17.5, z: 2.5, radius: 3, kind: "lamp" },
    { x: 11.5, z: 12.5, radius: 3, kind: "moon" },
  ],
  props: {
    "9,1": "bed_head",
    "9,4": "bed_side",
    "14,4": "bed_side",
    "17,9": "toy_chest",
    "3,2": "armchair",
    "9,2": "under_bed",
    "23,8": "desk",
  },
  intro: ["l7_crow_1", "l7_kiwi_1", "l7_crow_2", "l7_mochi_1"],
  cards: ["roomba", "ride_roomba", "checks_hides"],
  music: "tense",
};
