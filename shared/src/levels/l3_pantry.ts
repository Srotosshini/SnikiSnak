// Level 3 — The Pantry (PLAN.md Section 6).
// The map is copied character for character from PLAN.md. Don't edit it by hand
// without updating PLAN.md too: shared/test/levels.test.ts compares them.

import type { LevelDef } from "../types.js";

export const L3: LevelDef = {
  id: 3, key: "pantry", name: "The Pantry",
  listItem: { kind: "heavy", name: "A jar of honey", model: "honey_jar" },
  map: [
    "########################",
    "#S.....BBBBBB.......H..#",
    "#S...1.........BB....2.#",
    "#S.............BB......#",
    "#..TT....BBBBBBBB...~~.#",
    "#..TT....BBBBBBBB...~~.#",
    "#........BBBBBBBB......#",
    "#.~~.....BBBBBBBB....T.#",
    "#.~~.................T.#",
    "#.....4..........Z..3..#",
    "#..BB..................#",
    "#..BB.....TTT.........BE",
    "#.........TTT..........E",
    "########################",
  ],
  cat: { mode: "patrol", walk: 1.8, chase: 4, range: 6, darkRange: 2.5, fov: 90, hearing: 1, giveUpAfter: 5, checksHides: false },
  lights: [
    { x: 20.5, z: 2.5, radius: 3, kind: "lamp" },
    { x: 11.5, z: 12.5, radius: 2.5, kind: "moon" },
  ],
  props: {
    "7,1": "jar_shelf",
    "9,2": "shelving_island",
    "3,10": "potato_sack",
    "22,11": "mop_bucket",
    "3,4": "step_stool",
    "21,7": "crate",
    "10,11": "small_table",
  },
  intro: ["l3_crow_1", "l3_pip_1", "l3_kiwi_1", "l3_pip_2"],
  cards: ["heavy_loot", "cover", "distract"],
  music: "calm",
};
