// The three smugglers for the lobby cards and the HUD (PLAN.md Section 2).

import type { Role } from "@snikisnak/shared";
import { PALETTE, css } from "../render/palette";

export interface CharacterSheet {
  role: Role;
  name: string;
  tagline: string;
  strengths: [string, string];
  weakness: string;
  color: string;
  /** The two ability cards in the HUD: key and name. */
  abilities: Array<{ key: string; name: string }>;
}

export const CHARACTERS: Record<Role, CharacterSheet> = {
  kiwi: {
    role: "kiwi", name: "Kiwi", tagline: "chameleon. Professional Worrier",
    strengths: ["Blend: eat food to change colour", "Cover (hold Q): a teammate goes quiet"],
    weakness: "Colour fades after 20 s",
    color: css(PALETTE.leaf),
    abilities: [{ key: "Q", name: "Cover" }, { key: "E", name: "Eat food" }],
  },
  mochi: {
    role: "mochi", name: "Mochi", tagline: "hamster. Will Eat That",
    strengths: ["Vents and latches", "Chew wires: lights out"],
    weakness: "Too small to carry list items",
    color: css(PALETTE.mochi),
    abilities: [{ key: "E", name: "Vents & latches" }, { key: "E", name: "Chew wire" }],
  },
  pip: {
    role: "pip", name: "Pip", tagline: "raccoon. 'Professional'",
    strengths: ["Pick locks (noisy clicks)", "Lift heavy loot, boost a friend"],
    weakness: "Loud footsteps with heavy loot",
    color: css(PALETTE.pip),
    abilities: [{ key: "E", name: "Pick lock" }, { key: "E", name: "Lift loot" }],
  },
};
