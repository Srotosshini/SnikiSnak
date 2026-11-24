// The level intro and the briefing (PLAN.md Sections 1, 3 and 13).
//
// Intro: the tin-can phone panel with the Crow's lines, after a title card.
// Briefing: a kitchen-timer countdown while the camera looks down at the room.
// Both have a Ready button (or Enter); when everyone is ready, the server moves on.
// Tutorial cards and the drawn tin-can portrait arrive in Phase 5.

import { type LevelDef, TUNING } from "@snikisnak/shared";
import { SPEAKER_NAMES, hasLine, line } from "../content/script";
import { el } from "./dom";

export class FlowOverlay {
  private readonly root: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly readyBtn: HTMLButtonElement;
  private readonly readyCount: HTMLSpanElement;
  private phase = "";
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === "Enter" && !this.root.hidden) this.onReady();
  };

  constructor(parent: HTMLElement, private readonly level: LevelDef, private readonly onReady: () => void) {
    this.root = el("div", "flow-overlay", parent);
    this.panel = el("div", "card flow-panel", this.root);
    this.body = el("div", "flow-body", this.panel);
    const foot = el("div", "flow-foot", this.panel);
    this.readyBtn = el("button", "paper-button primary", foot, "Ready");
    this.readyBtn.type = "button";
    this.readyBtn.onclick = () => this.onReady();
    this.readyCount = el("span", "ready-count", foot);
    window.addEventListener("keydown", this.onKey);
  }

  /** phase: "intro" | "briefing" | anything else (hidden). */
  update(phase: string, timer: number, ready: number, total: number, meReady: boolean): void {
    const visible = phase === "intro" || phase === "briefing";
    this.root.hidden = !visible;
    if (!visible) { this.phase = phase; return; }
    this.root.classList.toggle("briefing", phase === "briefing");
    if (phase !== this.phase) {
      this.phase = phase;
      this.body.replaceChildren();
      if (phase === "intro") this.buildIntro(); else this.buildBriefing();
    }
    if (phase === "intro") this.updateIntro(timer);
    else this.body.querySelector(".kitchen-timer")!.textContent = `0:${String(Math.ceil(timer)).padStart(2, "0")}`;
    this.readyBtn.disabled = meReady;
    this.readyBtn.textContent = meReady ? "Ready!" : "Ready";
    this.readyCount.textContent = `${ready}/${total} ready`;
  }

  private buildIntro(): void {
    const title = el("div", "title-card", this.body);
    el("div", "title-level", title, `Level ${this.level.id}`);
    el("div", "title-name", title, this.level.name);
    el("div", "title-item", title, this.level.listItem ? `"${this.level.listItem.name}"` : "\"Get in. Don't get eaten.\"");
    const phone = el("div", "tin-can", this.body);
    for (const id of this.level.intro) {
      if (!hasLine(id)) continue;
      const l = line(id);
      const row = el("p", `phone-line who-${l.who}`, phone);
      row.dataset.id = id;
      el("strong", "", row, `${SPEAKER_NAMES[l.who]}: `);
      row.append(l.emote ? `(${l.emote}) ${l.text}` : l.text);
      row.hidden = true;
    }
  }

  /** Reveal the Crow's lines one by one as the intro timer runs down. */
  private updateIntro(timer: number): void {
    const total = TUNING.flow.introTitle + this.level.intro.length * TUNING.flow.introPerLine;
    const elapsed = total - timer;
    const shown = Math.floor((elapsed - TUNING.flow.introTitle) / TUNING.flow.introPerLine) + 1;
    this.body.querySelectorAll<HTMLElement>(".phone-line").forEach((row, i) => { row.hidden = i >= shown; });
  }

  private buildBriefing(): void {
    el("div", "briefing-title", this.body, "Briefing");
    el("div", "kitchen-timer", this.body, "0:20");
    el("p", "briefing-hint", this.body, "The gold thing is the list item. Paw prints show Sir Crumbs's route. The arrow is the way out. Make a plan!");
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKey);
    this.root.remove();
  }
}
