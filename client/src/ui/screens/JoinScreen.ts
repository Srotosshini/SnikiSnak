// Join screen (PLAN.md Section 13): a ticket with 4 letter boxes for the room code.

import { type Screen, button, el } from "../dom";

export interface JoinActions {
  join(code: string): void;
  back(): void;
}

export class JoinScreen implements Screen {
  private readonly root: HTMLDivElement;
  private readonly errorBox: HTMLParagraphElement;
  private readonly boxes: HTMLInputElement[] = [];

  constructor(parent: HTMLElement, private readonly actions: JoinActions) {
    this.root = el("div", "screen join-screen", parent);
    const card = el("div", "card ticket", this.root);
    el("h2", "", card, "Heist code");
    const row = el("div", "code-boxes", card);
    for (let i = 0; i < 4; i++) {
      const box = el("input", "code-box", row);
      box.maxLength = 1;
      box.autocomplete = "off";
      box.oninput = () => {
        box.value = box.value.toUpperCase().replace(/[^A-Z]/g, "");
        if (box.value && i < 3) this.boxes[i + 1].focus();
        if (this.code().length === 4) this.submit();
      };
      box.onkeydown = (e) => {
        if (e.key === "Backspace" && !box.value && i > 0) this.boxes[i - 1].focus();
        if (e.key === "Enter") this.submit();
      };
      box.onpaste = (e) => {
        const text = (e.clipboardData?.getData("text") ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
        if (!text) return;
        e.preventDefault();
        text.split("").forEach((ch, j) => { this.boxes[j].value = ch; });
        if (text.length === 4) this.submit();
      };
      this.boxes.push(box);
    }
    this.errorBox = el("p", "error-card", card);
    this.errorBox.hidden = true;
    const tabs = el("div", "tabs", card);
    button("Back", tabs, () => actions.back());
    button("Join", tabs, () => this.submit(), "paper-button primary");
    this.boxes[0].focus();
  }

  private code(): string {
    return this.boxes.map((b) => b.value).join("");
  }

  private submit(): void {
    const code = this.code();
    if (code.length !== 4) return;
    this.errorBox.hidden = true;
    this.actions.join(code);
  }

  showError(text: string): void {
    this.errorBox.textContent = text;
    this.errorBox.hidden = false;
    for (const b of this.boxes) b.value = "";
    this.boxes[0].focus();
  }

  unmount(): void {
    this.root.remove();
  }
}
