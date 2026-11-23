// Level 8 — The Kitchen (PLAN.md Section 7).
// The map is copied character for character from PLAN.md. Don't edit it by hand
// without updating PLAN.md too: shared/test/levels.test.ts compares them.

import type { LevelDef } from "../types.js";

export const L8: LevelDef = {
  id: 8, key: "kitchen", name: "The Kitchen",
  listItem: { kind: "croissant", name: "THE GOLDEN CROISSANT", model: "croissant" },
  map: [
    "############################",
    "#S.....#.........UUUU.....W#",
    "#S..T..#..1......UUPU......#",
    "#S..T..#.........UUUU...2..#",
    "#......Dl..................#",
    "#..V...#.......BBBB.b......#",
    "#......#.......BBBB........#",
    "#..BB..#.......BBBB.....Z..#",
    "#..BB..#.......BBBB........#",
    "#......#...................#",
    "#.TT...#..4.............3..#",
    "E......#..V.......~~.......#",
    "E......#..........~~...CC..#",
    "#......#..P.....TT.....CC..#",
    "#......#........TT.........#",
    "############################",
  ],
  cat: { mode: "patrol", walk: 2.2, chase: 4.4, range: 6.5, darkRange: 2.5, fov: 90, hearing: 1.2, giveUpAfter: 7, huntEvery: 5, huntOffset: 3, checksHides: true },
  lights: [
    { x: 17, z: 7, radius: 3.5, kind: "lamp" },
    { x: 24, z: 11.5, radius: 2.5, kind: "lamp" },
    { x: 18.5, z: 1.5, radius: 3, kind: "moon" },
  ],
  props: {
    "15,5": "kitchen_island",
    "3,7": "crates",
    "4,2": "sack",
    "2,10": "low_shelf",
    "16,13": "kitchen_table",
  },
  intro: ["l8_crow_1", "l8_pip_1", "l8_crow_2", "l8_kiwi_1", "l8_crow_3"],
  cards: ["tap_pads", "hunt", "plan_it"],
  music: "tense",
};
