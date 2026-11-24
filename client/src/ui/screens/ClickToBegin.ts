// "Click to begin" (PLAN.md Section 13): a paper note taped to dark wood.
// The click unlocks audio (browsers won't play sound before one).

import { type Screen, el } from "../dom";

export class ClickToBegin implements Screen {
  private readonly root: HTMLDivElement;
  private readonly onKey = (e: KeyboardEvent): void => { if (e.key === "Enter" || e.key === " ") this.go(); };

  constructor(parent: HTMLElement, private readonly onBegin: () => void) {
    this.root = el("div", "screen click-to-begin", parent);
    const note = el("button", "card begin-note", this.root);
    note.type = "button";
    el("span", "begin-text boil", note, "Click to begin");
    el("span", "begin-sub", note, "headphones recommended");
    note.onclick = () => this.go();
    window.addEventListener("keydown", this.onKey);
  }

  private go(): void {
    window.removeEventListener("keydown", this.onKey);
    this.onBegin();
  }

  unmount(): void {
    window.removeEventListener("keydown", this.onKey);
    this.root.remove();
  }
}
