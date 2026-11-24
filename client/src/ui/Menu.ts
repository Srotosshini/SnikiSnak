// The Esc menu (PLAN.md Section 13): Settings, Controls, Leave room.
// The game keeps running online behind it.

import type { Voice } from "../net/Voice";
import { CONTROLS, SettingsScreen } from "./screens/SettingsScreen";
import { button, el } from "./dom";

export class Menu {
  private root: HTMLDivElement | null = null;
  private settingsScreen: SettingsScreen | null = null;
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key !== "Escape") return;
    if (this.settingsScreen) { this.settingsScreen.unmount(); this.settingsScreen = null; return; }
    if (this.root) this.close(); else this.open();
  };

  constructor(private readonly parent: HTMLElement, public voice: Voice | null, private readonly onLeave: () => void) {
    window.addEventListener("keydown", this.onKey);
  }

  get isOpen(): boolean {
    return !!this.root;
  }

  open(): void {
    if (this.root) return;
    this.root = el("div", "screen modal menu-screen", this.parent);
    const card = el("div", "card menu-card", this.root);
    el("h2", "", card, "Paused (the heist goes on!)");
    const tabs = el("div", "menu-buttons", card);
    button("Back to the heist", tabs, () => this.close(), "paper-button primary");
    button("Settings", tabs, () => {
      this.settingsScreen = new SettingsScreen(this.parent, this.voice, () => { this.settingsScreen?.unmount(); this.settingsScreen = null; });
    });
    const controls = el("details", "controls-details", card);
    el("summary", "", controls, "Controls");
    const table = el("table", "controls", controls);
    for (const [key, what] of CONTROLS) {
      const tr = el("tr", "", table);
      el("td", "key", tr, key);
      el("td", "", tr, what);
    }
    button("Leave room", tabs, () => { this.close(); this.onLeave(); });
  }

  close(): void {
    this.root?.remove();
    this.root = null;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKey);
    this.settingsScreen?.unmount();
    this.close();
  }
}
