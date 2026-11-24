// The tutorial card slot (PLAN.md Sections 4.9 and 13): a small taped paper
// card in the top-left corner. Each card hides after 6 s or on Enter, and isn't
// shown again once seen (unless reset in Settings).

import { CARDS, markCardSeen, seenCards } from "../content/cards";
import type { GameAudio } from "../audio";
import { el } from "./dom";

const SHOW_MS = 6000;

export class Cards {
  private readonly root: HTMLDivElement;
  private readonly queue: string[] = [];
  private current: { id: string; div: HTMLDivElement; timer: number } | null = null;
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === "Enter" && this.current) this.next();
  };

  constructor(parent: HTMLElement, private readonly sound: GameAudio) {
    this.root = el("div", "card-slot", parent);
    window.addEventListener("keydown", this.onKey);
  }

  /** Queue cards to show one at a time; seen ones are skipped. */
  show(ids: readonly string[]): void {
    const seen = seenCards();
    for (const id of ids) {
      if (!CARDS[id] || seen.has(id) || this.queue.includes(id) || this.current?.id === id) continue;
      this.queue.push(id);
    }
    if (!this.current) this.next();
  }

  private next(): void {
    if (this.current) {
      clearTimeout(this.current.timer);
      this.current.div.remove();
      this.current = null;
    }
    const id = this.queue.shift();
    if (!id) return;
    markCardSeen(id);
    const div = el("div", "card tutorial-card", this.root);
    el("div", "tc-text", div, CARDS[id]);
    el("div", "tc-hint", div, "Enter to dismiss");
    this.sound.sfx.play("cardFlip", undefined, 0.7, "ui");
    this.current = { id, div, timer: window.setTimeout(() => this.next(), SHOW_MS) };
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKey);
    if (this.current) clearTimeout(this.current.timer);
    this.root.remove();
  }
}
