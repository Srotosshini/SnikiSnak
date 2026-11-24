// The opening cutscene's paper layer (PLAN.md Sections 3 and 13): paper-strip
// letterbox bars, speech bubbles with blip voices, the smugglers' name cards,
// the list unrolling like a receipt, the title card, and "Hold Space to skip (n/3)".
// The rooftop (game/Rooftop.ts) does the camera shots; the server keeps the clock.

import { TUNING } from "@snikisnak/shared";
import { OPENING, type Beat } from "../content/cutscenes";
import { SPEAKER_NAMES, line } from "../content/script";
import type { Rooftop } from "../game/Rooftop";
import type { GameAudio } from "../audio";
import type { Speech } from "../audio/Blips";
import { el } from "./dom";

const LIST = [
  "THE ROYAL SHOPPING LIST",
  "(by order of Her Most Shiny Majesty)",
  "",
  "1. Get in. Don't get eaten.",
  "2. One silver thimble (for my crown collection)",
  "3. A jar of honey. The BIG one.",
  "4. The golden pen nib from the study",
  "5. The blue button. Only the blue one.",
  "6. One sparkly sock. Just one. Socks come in ones.",
  "7. The music-box key (under the bed, probably)",
  "8. THE GOLDEN CROISSANT",
];

export class CutsceneOverlay {
  private readonly root: HTMLDivElement;
  private readonly bubble: HTMLDivElement;
  private readonly who: HTMLSpanElement;
  private readonly text: HTMLSpanElement;
  private readonly stage: HTMLDivElement;
  private readonly skip: HTMLDivElement;
  private played = 0;
  private speech: Speech | null = null;
  private holding = false;
  private readonly onKey = (e: KeyboardEvent, down: boolean): void => {
    if (e.code !== "Space") return;
    e.preventDefault();
    if (e.repeat || down === this.holding) return;
    this.holding = down;
    this.sendSkip(down);
  };
  private readonly keyDown = (e: KeyboardEvent): void => this.onKey(e, true);
  private readonly keyUp = (e: KeyboardEvent): void => this.onKey(e, false);

  constructor(parent: HTMLElement, private readonly rooftop: Rooftop, private readonly sound: GameAudio,
              private readonly sendSkip: (holding: boolean) => void) {
    this.root = el("div", "cutscene");
    parent.appendChild(this.root);
    el("div", "letterbox top", this.root);
    el("div", "letterbox bottom", this.root);
    this.stage = el("div", "cut-stage", this.root);
    this.bubble = el("div", "card cut-bubble", this.root);
    this.who = el("span", "cut-who", this.bubble);
    this.text = el("span", "cut-text", this.bubble);
    this.bubble.hidden = true;
    this.skip = el("div", "cut-skip", this.root);
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("keyup", this.keyUp);
  }

  /** Called every state patch and frame with the server's timer. */
  update(timer: number, skipping: number, players: number): void {
    const elapsed = TUNING.flow.cutscene - timer;
    while (this.played < OPENING.length && OPENING[this.played].at <= elapsed) {
      const beat = OPENING[this.played++];
      // Joining late (or a slow patch): don't replay old lines all at once.
      if (elapsed - beat.at < 2 || beat.kind === "shot") this.play(beat);
    }
    this.skip.textContent = `Hold Space to skip (${skipping}/${players})`;
    this.skip.classList.toggle("holding", this.holding);
  }

  private play(beat: Beat): void {
    switch (beat.kind) {
      case "shot": this.rooftop.setShot(beat.shot); break;
      case "fanfare": this.sound.music.fanfare(); break;
      case "silhouette": this.rooftop.catCrossing(); this.sound.sfx.play("bell"); break;
      case "line": this.say(beat.lineId, this.timeUntilNextLine(beat.at)); break;
      case "namecards": this.nameCards(); break;
      case "list": this.list(); break;
      case "grey": break; // Kiwi turning grey is in the line's stage direction for now.
      case "title": this.title(); break;
    }
  }

  /** Seconds until the next line starts, so this one can be said in time. */
  private timeUntilNextLine(at: number): number {
    const next = OPENING.find((b) => b.at > at && (b.kind === "line" || b.kind === "namecards" || b.kind === "list" || b.kind === "title"));
    return next ? next.at - at - 0.4 : 4;
  }

  private say(id: string, maxSeconds: number): void {
    const l = line(id);
    this.speech?.stop();
    this.bubble.hidden = false;
    this.bubble.dataset.who = l.who;
    this.who.textContent = SPEAKER_NAMES[l.who];
    const full = l.emote ? `(${l.emote}) ${l.text}` : l.text;
    const offset = l.emote ? l.emote.length + 3 : 0;
    this.text.textContent = "";
    this.speech = this.sound.blips.speak(l.who, l.text, (n) => { this.text.textContent = full.slice(0, offset + n); }, maxSeconds);
  }

  private nameCards(): void {
    this.bubble.hidden = true;
    const row = el("div", "name-cards", this.stage);
    const cards: Array<[string, string]> = [["KIWI", "Professional Worrier"], ["MOCHI", "Will Eat That"], ["PIP", "'Professional'"]];
    cards.forEach(([name, tag], i) => {
      const c = el("div", "card name-card boil", row);
      el("div", "nc-name", c, name);
      el("div", "nc-tag", c, tag);
      c.style.animationDelay = `${i * 1.6}s`;
      window.setTimeout(() => this.sound.sfx.play("stamp", undefined, 0.6, "ui"), i * 1600 + 200);
    });
    window.setTimeout(() => row.remove(), 6000);
  }

  private list(): void {
    this.bubble.hidden = true;
    const receipt = el("div", "receipt cut-list", this.stage);
    for (const text of LIST) el("div", "receipt-line", receipt, text);
    el("div", "receipt-line crayon", receipt, "9. snacks for mochi");
    this.sound.sfx.play("cardFlip", undefined, 1, "ui");
    window.setTimeout(() => this.sound.sfx.play("scribble", undefined, 1, "ui"), 13000);
    window.setTimeout(() => receipt.remove(), 15500);
  }

  private title(): void {
    this.bubble.hidden = true;
    this.speech?.stop();
    const t = el("div", "cut-title boil", this.stage);
    el("div", "title-big", t, "SnikiSnak");
    el("div", "title-small", t, "Midnight Sneaky Snack");
    this.sound.music.fanfare();
  }

  dispose(): void {
    this.speech?.stop();
    if (this.holding) this.sendSkip(false);
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
    this.root.remove();
  }
}
