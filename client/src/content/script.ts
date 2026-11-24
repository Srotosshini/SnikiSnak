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


  // In-game barks (Section 3, "In-game barks"). Ids match shared/src/barks.ts.
  { id: "bark_spotted_kiwi_1", who: "kiwi", text: "He sees me. He SEES me." },
  { id: "bark_spotted_kiwi_2", who: "kiwi", text: "I'm a lamp. Just a lamp." },
  { id: "bark_spotted_mochi_1", who: "mochi", text: "Cute AND scary!" },
  { id: "bark_spotted_mochi_2", who: "mochi", text: "Run now, snack later!" },
  { id: "bark_spotted_pip_1", who: "pip", text: "Okay. Plan B." },
  { id: "bark_spotted_pip_2", who: "pip", text: "This is fine. Professionally." },
  { id: "bark_jarred_kiwi_1", who: "kiwi", text: "I'm in a jar. Again." },
  { id: "bark_jarred_mochi_1", who: "mochi", text: "It's roomy in here!" },
  { id: "bark_jarred_pip_1", who: "pip", text: "I meant to do that." },
  { id: "bark_teammateJarred_kiwi_1", who: "kiwi", text: "Hold on, we're coming!" },
  { id: "bark_teammateJarred_mochi_1", who: "mochi", text: "I'll save you! Who's helping me save you?" },
  { id: "bark_teammateJarred_pip_1", who: "pip", text: "Nobody panic. I'm panicking a little." },
  { id: "bark_rescued_kiwi_1", who: "kiwi", text: "Thank you thank you thank you." },
  { id: "bark_rescued_mochi_1", who: "mochi", text: "Freedom! Snacks?" },
  { id: "bark_rescued_pip_1", who: "pip", text: "Took you long enough. ...Thanks." },
  { id: "bark_grab_kiwi_1", who: "kiwi", text: "Got it. Can we go home now?" },
  { id: "bark_grab_mochi_1", who: "mochi", text: "I can't carry it, but I believe in it." },
  { id: "bark_grab_pip_1", who: "pip", text: "Smooth. Like butter." },
  { id: "bark_lightsOut_kiwi_1", who: "kiwi", text: "It's dark. I don't like dark." },
  { id: "bark_lightsOut_mochi_1", who: "mochi", text: "Crunch. Oops. You're welcome." },
  { id: "bark_lightsOut_pip_1", who: "pip", text: "Now we're talking." },
  { id: "bark_hiding_kiwi_1", who: "kiwi", text: "I am a shoe. I am a shoe." },
  { id: "bark_hiding_mochi_1", who: "mochi", text: "Hidey hole!" },
  { id: "bark_hiding_pip_1", who: "pip", text: "Blending in. Kind of." },
  { id: "bark_squeak_kiwi_1", who: "kiwi", text: "Sorry! Sorry, floor." },
  { id: "bark_squeak_mochi_1", who: "mochi", text: "Was that me? That was me." },
  { id: "bark_squeak_pip_1", who: "pip", text: "That board had it coming." },
  { id: "bark_catGivesUp_kiwi_1", who: "kiwi", text: "Is he gone? He's gone. Is he?" },
  { id: "bark_catGivesUp_mochi_1", who: "mochi", text: "Bye, kitty!" },
  { id: "bark_catGivesUp_pip_1", who: "pip", text: "Lost him." },
  { id: "bark_leftBehind_kiwi_1", who: "kiwi", text: "I'm so sorry, I'll bring you a raisin." },
  { id: "bark_leftBehind_mochi_1", who: "mochi", text: "I'm leaving you my imaginary snacks." },
  { id: "bark_leftBehind_pip_1", who: "pip", text: "We'll come back for you. Probably tomorrow." },
  { id: "bark_idle_kiwi_1", who: "kiwi", text: "Does anyone else hear the fridge humming?" },
  { id: "bark_idle_mochi_1", who: "mochi", text: "Are we there yet?" },
  { id: "bark_idle_pip_1", who: "pip", text: "I could do this in my sleep. Not literally." },
  { id: "ability_kiwi_blend_1", who: "kiwi", text: "Just a rug. Nothing to see." },
  { id: "ability_kiwi_blend_2", who: "kiwi", text: "I'm blue now. Emotionally too." },
  { id: "ability_mochi_roomba", who: "mochi", text: "WHEEE... wheee.", emote: "whispers" },

  // Sir Crumbs's thought bubbles (Section 3). He never speaks.
  { id: "cat_sleep_1", who: "crumbs", text: "zzz" },
  { id: "cat_sleep_2", who: "crumbs", text: "...tuna..." },
  { id: "cat_stir_1", who: "crumbs", text: "hm?" },
  { id: "cat_investigate_1", who: "crumbs", text: "what was that" },
  { id: "cat_investigate_2", who: "crumbs", text: "a snack?" },
  { id: "cat_spotted_1", who: "crumbs", text: "!!" },
  { id: "cat_chase_1", who: "crumbs", text: "mine mine mine" },
  { id: "cat_search_1", who: "crumbs", text: "i know you're here" },
  { id: "cat_giveup_1", who: "crumbs", text: "...probably nothing" },
  { id: "cat_giveup_2", who: "crumbs", text: "eh. nap." },
  { id: "cat_catch_1", who: "crumbs", text: "for the collection." },
  { id: "cat_lightsout_1", who: "crumbs", text: "who turned off the moon" },
  { id: "cat_roomba_1", who: "crumbs", text: "THE ENEMY" },
  { id: "cat_croissant_1", who: "crumbs", text: "...do i smell BUTTER" },

  // Opening cutscene "The Royal Errand" (Section 3).
  { id: "cut_crow_1", who: "crow", text: "Ahem. AHEM." },
  { id: "cut_crow_2", who: "crow", text: "Kneel before Her Most Shiny Majesty, Queen Corvina, Keeper of Ninety-Nine Bottle Caps!" },
  { id: "cut_pip_1", who: "pip", text: "Ninety-eight. I still owe you one." },
  { id: "cut_crow_3", who: "crow", text: "...Ninety-eight and a HALF. Silence." },
  { id: "cut_crow_4", who: "crow", text: "Smugglers. Tonight the Big House sleeps. The humans snore. The pantry is FULL." },
  { id: "cut_crow_5", who: "crow", text: "And I... am peckish." },
  { id: "cut_kiwi_1", who: "kiwi", text: "That's a very long list." },
  { id: "cut_crow_6", who: "crow", text: "It's a CURATED list." },
  { id: "cut_mochi_1", who: "mochi", text: "Is 'snacks for Mochi' on there?" },
  { id: "cut_crow_7", who: "crow", text: "No." },
  { id: "cut_mochi_2", who: "mochi", text: "...Now it is.", emote: "scribbles with a crayon stub" },
  { id: "cut_crow_8", who: "crow", text: "Be warned. The house has a guard. Sir Crumbs." },
  { id: "cut_crow_9", who: "crow", text: "He has never lost a mouse." },
  { id: "cut_kiwi_2", who: "kiwi", text: "I'm a chameleon.", emote: "turns grey" },
  { id: "cut_crow_10", who: "crow", text: "He has never lost a chameleon either. Probably." },
  { id: "cut_pip_2", who: "pip", text: "Relax. I'm a professional. Item one: 'Get in. Don't get eaten.' Easy.", emote: "reads the list" },
  { id: "cut_crow_11", who: "crow", text: "And above all... bring me... THE GOLDEN CROISSANT." },
  { id: "cut_mochi_3", who: "mochi", text: "Which item is that?" },
  { id: "cut_crow_12", who: "crow", text: "Item eight. READ the list." },
  { id: "cut_crow_13", who: "crow", text: "Now go! And if you get caught... I have never met you." },

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
