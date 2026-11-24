// Every line of dialogue in the game (PLAN.md Section 3), stored as data so
// the blip voices (Phase 5) can read it. Lines are added as each phase needs them.

export type Speaker = "crow" | "kiwi" | "mochi" | "pip" | "crumbs";

export interface Line {
  id: string;
  who: Speaker;
  text: string;
  emote?: string;
}

export const LINES: readonly Line[] = [
  // Level intros (Section 3, "Level intros (tin-can telephone)").
  { id: "l1_crow_1", who: "crow", text: "Item one. Get in, don't get eaten. Sir Crumbs naps by the boots." },
  { id: "l1_pip_1", who: "pip", text: "Easy. Cats sleep, like, twenty hours a day." },
  { id: "l1_kiwi_1", who: "kiwi", text: "So he's awake for four of them. Which four?" },

  { id: "l2_crow_1", who: "crow", text: "A silver thimble, on the sewing basket. Sir Crumbs walks this hallway at night." },
  { id: "l2_mochi_1", who: "mochi", text: "Fast or slow?" },
  { id: "l2_crow_2", who: "crow", text: "Smugly." },

  { id: "l3_crow_1", who: "crow", text: "Honey. The big jar with the bee on it." },
  { id: "l3_pip_1", who: "pip", text: "Heavy loot. My specialty." },
  { id: "l3_kiwi_1", who: "kiwi", text: "Your specialty is being loud." },
  { id: "l3_pip_2", who: "pip", text: "While carrying heavy loot. Yes." },

  { id: "l4_crow_1", who: "crow", text: "The golden pen nib. The study is locked. Humans lock what they love." },
  { id: "l4_mochi_1", who: "mochi", text: "I love snacks and I never lock them." },
  { id: "l4_crow_2", who: "crow", text: "That's why you never have any." },

  { id: "l5_crow_1", who: "crow", text: "The blue button fell on the blue rug, right in front of Sir Crumbs's cushion." },
  { id: "l5_kiwi_1", who: "kiwi", text: "Right in front of him?" },
  { id: "l5_crow_2", who: "crow", text: "He's watching TV. The TV is off. He's watching the dark." },

  { id: "l6_crow_1", who: "crow", text: "One sparkly sock, on top of the dryer, under the big lamp." },
  { id: "l6_pip_1", who: "pip", text: "The lamp's a problem." },
  { id: "l6_mochi_1", who: "mochi", text: "What lamp?", emote: "crunch" },

  { id: "l7_crow_1", who: "crow", text: "The music-box key is under the bed. Also, Sir Crumbs is awake. And annoyed." },
  { id: "l7_kiwi_1", who: "kiwi", text: "Annoyed at what?" },
  { id: "l7_crow_2", who: "crow", text: "You. Soon." },
  { id: "l7_mochi_1", who: "mochi", text: "Is that a robot? Can I ride the robot?" },

  { id: "l8_crow_1", who: "crow", text: "This is it. The Golden Croissant, in the breadbox. Two buttons open it." },
  { id: "l8_pip_1", who: "pip", text: "And then I carry it?" },
  { id: "l8_crow_2", who: "crow", text: "Gently. Lovingly. Like it's a croissant." },
  { id: "l8_kiwi_1", who: "kiwi", text: "It IS a croissant." },
  { id: "l8_crow_3", who: "crow", text: "Then you understand." },

  // Wrong-role barks (Section 3).
  { id: "wrong_mochi_item", who: "mochi", text: "Too big. My arms are decorative." },
  { id: "wrong_mochi_lock", who: "mochi", text: "I tried licking it. Didn't work." },
  { id: "wrong_kiwi_lock", who: "kiwi", text: "I don't do locks. I do worrying." },
  { id: "wrong_kiwi_heavy", who: "kiwi", text: "I can lift exactly zero of that." },
  { id: "wrong_kiwi_vent", who: "kiwi", text: "Vents are for hamsters and regret." },
  { id: "wrong_pip_vent", who: "pip", text: "My shoulders say no." },
  { id: "wrong_pip_wire", who: "pip", text: "I'm not chewing that. I have standards." },

  // Ability barks (Section 3).
  { id: "ability_pip_lock", who: "pip", text: "Click... click... come on, sweetheart." },
  { id: "ability_mochi_vent_1", who: "mochi", text: "Into the tube!" },
  { id: "ability_mochi_vent_2", who: "mochi", text: "Smells like dust and adventure." },

  // Results lines (Section 3, "Results lines (Crow)").
  { id: "results_3", who: "crow", text: "Flawless. I'm adding you to my collection. Of favourites." },
  { id: "results_2", who: "crow", text: "Everyone home! Mostly in one piece." },
  { id: "results_1", who: "crow", text: "You left one behind? Bold. Fetch them later." },
  { id: "results_caught", who: "crow", text: "Two in jars? I have never met you." },
];

const byId = new Map(LINES.map((l) => [l.id, l]));

export function line(id: string): Line {
  const l = byId.get(id);
  if (!l) throw new Error(`No line with id ${id}`);
  return l;
}

export function hasLine(id: string): boolean {
  return byId.has(id);
}

export const SPEAKER_NAMES: Record<Speaker, string> = {
  crow: "Queen Corvina", kiwi: "Kiwi", mochi: "Mochi", pip: "Pip", crumbs: "Sir Crumbs",
};
