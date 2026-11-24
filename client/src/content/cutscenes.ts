// Cutscene timelines (PLAN.md Section 3). Each beat starts at `at` seconds.
// The server keeps the clock (state.timer), so every player sees the same beat.

export type Shot = "throne" | "wide" | "house" | "roof" | "drainpipe";

export type Beat =
  | { at: number; kind: "line"; lineId: string }
  | { at: number; kind: "shot"; shot: Shot }
  | { at: number; kind: "fanfare" }
  | { at: number; kind: "namecards" }
  | { at: number; kind: "list" }
  | { at: number; kind: "silhouette" }
  | { at: number; kind: "grey" }
  | { at: number; kind: "title" };

/** "The Royal Errand": about 86 s, skippable by everyone holding Space. */
export const OPENING: readonly Beat[] = [
  { at: 0, kind: "shot", shot: "wide" },
  { at: 0.3, kind: "fanfare" },
  { at: 4, kind: "shot", shot: "throne" },
  { at: 4, kind: "line", lineId: "cut_crow_1" },
  { at: 6.5, kind: "line", lineId: "cut_crow_2" },
  { at: 11.5, kind: "shot", shot: "roof" },
  { at: 11.5, kind: "line", lineId: "cut_pip_1" },
  { at: 14.5, kind: "shot", shot: "throne" },
  { at: 14.5, kind: "line", lineId: "cut_crow_3" },
  { at: 18, kind: "namecards" },
  { at: 24, kind: "line", lineId: "cut_crow_4" },
  { at: 29, kind: "line", lineId: "cut_crow_5" },
  { at: 32, kind: "list" },
  { at: 36, kind: "shot", shot: "roof" },
  { at: 36, kind: "line", lineId: "cut_kiwi_1" },
  { at: 38.5, kind: "line", lineId: "cut_crow_6" },
  { at: 41, kind: "line", lineId: "cut_mochi_1" },
  { at: 44, kind: "line", lineId: "cut_crow_7" },
  { at: 45.5, kind: "line", lineId: "cut_mochi_2" },
  { at: 48, kind: "shot", shot: "house" },
  { at: 48, kind: "silhouette" },
  { at: 51, kind: "line", lineId: "cut_crow_8" },
  { at: 55, kind: "line", lineId: "cut_crow_9" },
  { at: 57.5, kind: "shot", shot: "roof" },
  { at: 57.5, kind: "grey" },
  { at: 57.5, kind: "line", lineId: "cut_kiwi_2" },
  { at: 59.5, kind: "line", lineId: "cut_crow_10" },
  { at: 63, kind: "line", lineId: "cut_pip_2" },
  { at: 68, kind: "shot", shot: "throne" },
  { at: 68, kind: "line", lineId: "cut_crow_11" },
  { at: 72, kind: "line", lineId: "cut_mochi_3" },
  { at: 74, kind: "line", lineId: "cut_crow_12" },
  { at: 76.5, kind: "line", lineId: "cut_crow_13" },
  { at: 80.5, kind: "shot", shot: "drainpipe" },
  { at: 82, kind: "title" },
];
