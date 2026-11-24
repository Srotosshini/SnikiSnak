// Start screen (PLAN.md Section 13): your smuggler name on a luggage tag, and
// paper tabs to host a heist, join one with a code, or open Settings. The live
// 3D rooftop shows behind it (game/Rooftop.ts). Your hand-drawn logo goes here in Phase 8.

import { type Screen, button, el, saveName, savedName } from "../dom";

export interface StartActions {
  host(name: string): void;
  join(name: string): void;
  settings?(): void;
}

export class StartScreen implements Screen {
  private readonly root: HTMLDivElement;

  constructor(parent: HTMLElement, actions: StartActions, error = "") {
    this.root = el("div", "screen start-screen", parent);
    const card = el("div", "card start-card", this.root);
    el("h1", "logo", card, "SnikiSnak");
    el("p", "subtitle", card, "Midnight Sneaky Snack");

    const tag = el("label", "luggage-tag", card);
    el("span", "tag-label", tag, "Your smuggler name");
    const input = el("input", "tag-input", tag);
    input.maxLength = 16;
    input.value = new URLSearchParams(location.search).get("name") ?? savedName();
    input.placeholder = "Smuggler";
    const name = (): string => {
      const n = input.value.trim();
      saveName(n);
      return n;
    };

    const tabs = el("div", "tabs", card);
    button("Host a heist", tabs, () => actions.host(name()), "paper-button primary");
    button("Join with code", tabs, () => actions.join(name()));
    if (actions.settings) button("Settings", tabs, () => actions.settings?.());
    if (error) el("p", "error-card", card, error);
    input.focus();
    input.onkeydown = (e) => { if (e.key === "Enter") actions.host(name()); };
  }

  unmount(): void {
    this.root.remove();
  }
}
