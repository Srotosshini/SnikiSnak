// Tutorial cards (PLAN.md Sections 4.9, 6 and 7). A small taped paper card in
// the top-left corner, shown during the level intro and again the first time
// its situation happens. Seen cards are remembered in localStorage.

export const CARDS: Readonly<Record<string, string>> = {
  // Level 1
  move_sneak: "WASD to move. Hold Shift to sneak: slower, much quieter.",
  squeak: "Cracked boards squeak. Step around them.",
  hide: "Crawl under furniture to hide.",
  goal_escape: "Get all three of you to the cat flap.",
  stirring: "He's stirring! Freeze, or hide.",
  jarred: "Jarred! The other two hold F next to the jar.",
  // Level 2
  cone: "The yellow cone is what Sir Crumbs sees. Orange means suspicious.",
  pick_up: "Press E on the thimble to pick it up.",
  rescue: "Caught? The other two hold F at the jar together.",
  carry_out: "Someone has to carry the thimble out.",
  // Level 3
  heavy_loot: "Only Pip can lift the honey. Heavy loot means loud footsteps.",
  cover: "Kiwi: hold Q next to Pip to cover him. He gets much quieter.",
  distract: "Noise somewhere else pulls the cat away.",
  // Level 4
  pick_lock: "Locked! Pip can pick it: hold E. It clicks.",
  vent_latch: "Or Mochi takes the vent and opens the latch from the other side. Silent.",
  cover_clicks: "Kiwi's cover muffles lock clicks too.",
  // Level 5
  blend: "Kiwi: eat food to change colour. Stand still on the same colour and you're invisible.",
  closet_vent: "The blueberries are in the closet. Only Mochi fits through the vent.",
  give_food: "Mochi: press E on Kiwi to hand her food.",
  pet_door: "The pet door is hooked shut. Pip can pick it.",
  // Level 6
  chew_wire: "Mochi: hold E on a wire for lights out. The cat can barely see, but hears better.",
  boost: "Pip and a friend: both hold F at the machine to boost.",
  ledge_take: "Kiwi takes the sock quietly. Mochi... pushes it off.",
  // Level 7
  roomba: "The Roomba bumps loudly, and Sir Crumbs HATES it. Use that.",
  ride_roomba: "Press E next to the Roomba to ride it. You're silent; it isn't.",
  checks_hides: "Careful: Sir Crumbs now checks hide spots he saw you enter.",
  // Level 8
  tap_pads: "Two tap-pads open the breadbox. Both must be pressed in the same second.",
  hunt: "Lifting the croissant wakes up Sir Crumbs's nose. He follows the smell.",
  plan_it: "Plan it: lights out, cover, careful steps.",
};

const SEEN_KEY = "snikisnak.cardsSeen";

export function seenCards(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]); } catch { return new Set(); }
}

export function markCardSeen(id: string): void {
  const seen = seenCards();
  seen.add(id);
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* fine */ }
}

export function resetCards(): void {
  try { localStorage.removeItem(SEEN_KEY); } catch { /* fine */ }
}
