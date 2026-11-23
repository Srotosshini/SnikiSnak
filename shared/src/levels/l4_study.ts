// Level 4 — The Study (PLAN.md Section 6).
// The map is copied character for character from PLAN.md. Don't edit it by hand
// without updating PLAN.md too: shared/test/levels.test.ts compares them.

import type { LevelDef } from "../types.js";

export const L4: LevelDef = {
  id: 4, key: "study", name: "The Study",
  listItem: { kind: "small", name: "The golden pen nib", model: "pen_nib" },
  map: [
    "##########################",
    "#S....BB....#..1.......2.#",
    "#S....BB....#............#",
    "#S..........#.....$......#",
    "#..T........#..BB....~~..#",
    "#..T....V...#..BB....~~..#",
    "#...........Dl......T....#",
    "#..BB.......#.......T....E",
    "#..BB....~~.#..V.........E",
    "#........~~.#..........3.#",
    "#.TT........#...BB.......#",
    "#.TT........#.4.BB.......#",
    "#...........#.....Z......#",
    "##########################",
  ],
  cat: { mode: "patrol", walk: 2, chase: 4, range: 6, darkRange: 2.5, fov: 90, hearing: 1, giveUpAfter: 5, checksHides: false },
  lights: [
    { x: 17.5, z: 3.5, radius: 3, kind: "lamp" },
    { x: 23.5, z: 7.5, radius: 3, kind: "moon" },
  ],
  props: {
    "6,1": "hat_stand",
    "15,4": "desk",
    "3,7": "filing_boxes",
    "16,10": "armchair",
    "3,4": "coat_rack",
    "20,6": "desk_chair",
    "2,10": "bench",
  },
  intro: ["l4_crow_1", "l4_mochi_1", "l4_crow_2"],
  cards: ["pick_lock", "vent_latch", "cover_clicks"],
  music: "calm",
};
