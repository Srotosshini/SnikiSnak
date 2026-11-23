// 4-letter room codes made only of consonants, so they can't spell words
// (PLAN.md Section 9, "Room and room codes").

export const CODE_LETTERS = "BCDFGHJKLMNPQRSTVWXZ";
export const CODE_LENGTH = 4;

/** Codes of rooms that are currently open on this server. */
export const activeCodes = new Set<string>();

export function makeRoomCode(taken: ReadonlySet<string> = activeCodes, rand: () => number = Math.random): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_LETTERS[Math.floor(rand() * CODE_LETTERS.length)];
    if (!taken.has(code)) return code;
  }
  throw new Error("Could not find a free room code");
}

/** Clean up what a player typed: upper case, letters only. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z]/g, "");
}
