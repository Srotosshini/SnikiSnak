// Every bark and thought-bubble id the server can send has words in the
// client's script, and every tutorial card a level lists exists.

import { describe, expect, it } from "vitest";
import { ABILITY_BARKS, CAT_BUBBLES, CAT_MOMENT_BUBBLES, EVENT_BARKS, LEVELS, SITUATION_CARDS, WRONG_ROLE_BARKS } from "../src/index.js";
import { LINES } from "../../client/src/content/script.js";
import { CARDS } from "../../client/src/content/cards.js";

const ids = new Set(LINES.map((l) => l.id));

describe("bark and bubble lines exist", () => {
  it("event barks", () => {
    for (const byRole of Object.values(EVENT_BARKS)) for (const list of Object.values(byRole)) for (const id of list) expect(ids, id).toContain(id);
  });
  it("wrong-role and ability barks", () => {
    for (const byAction of Object.values(WRONG_ROLE_BARKS)) for (const id of Object.values(byAction)) expect(ids, id).toContain(id);
    for (const byRole of Object.values(ABILITY_BARKS)) for (const list of Object.values(byRole) as string[][]) for (const id of list) expect(ids, id).toContain(id);
  });
  it("cat bubbles", () => {
    for (const list of Object.values(CAT_BUBBLES)) for (const id of list ?? []) expect(ids, id).toContain(id);
    for (const id of Object.values(CAT_MOMENT_BUBBLES)) expect(ids, id).toContain(id);
  });
  it("level intro lines", () => {
    for (const l of LEVELS) for (const id of l.intro) expect(ids, id).toContain(id);
  });
  it("line ids are unique", () => {
    expect(ids.size).toBe(LINES.length);
  });
});

describe("tutorial cards exist", () => {
  it("for every level and situation", () => {
    for (const l of LEVELS) for (const id of l.cards) expect(CARDS, id).toHaveProperty(id);
    for (const id of Object.values(SITUATION_CARDS)) expect(CARDS, id).toHaveProperty(id);
  });
});
