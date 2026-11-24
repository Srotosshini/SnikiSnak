// HUD basics (PLAN.md Section 13, "HUD during play"):
//   top centre   the Sir Crumbs meter: a cat face whose eyes open as he gets suspicious
//   top right    the level name and the list item, crossed out when it reaches the exit
//   bottom left  three teammate portraits with status (yours bigger, with your detection meter)
//   bottom centre the interaction prompt with its hold progress
//   bottom right your two ability cards with their keys
// plus toasts and the "Caught!" / "Level complete" cards with the host's buttons.
// The tutorial card slot, talking icons and the paper-and-marker art pass come in Phases 4–5.

import { LEVELS, ROLES, type Role } from "@snikisnak/shared";
import { line } from "../content/script";
import { CHARACTERS } from "../content/characters";
import { el } from "./dom";

export interface Prompt {
  text: string;
  /** Greyed out: your role can't do it. */
  disabled?: boolean;
  /** Hold progress 0..1, or undefined for no bar. */
  progress?: number;
}

export interface ResultInfo {
  kind: "caught" | "complete";
  stars: number;
  leftBehind: string[];
  isHost: boolean;
  level: number;
}

export interface TeamMember {
  role: Role;
  name: string;
  me: boolean;
  seen: number;
  status: string[];
}

export type CatMood = "asleep" | "calm" | "suspicious" | "angry";

export type HudAction = { type: "retry" } | { type: "next" } | { type: "select"; level: number };

const TOAST_MS = 2000;
const SVG = "http://www.w3.org/2000/svg";

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}

function starSvg(filled: boolean): SVGSVGElement {
  const s = svg("svg", { viewBox: "0 0 24 24", class: filled ? "star filled" : "star" });
  svg("polygon", { points: "12,2 15,9 22,9.5 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9.5 9,9" }, s);
  return s;
}

/** The Sir Crumbs face: ears, head, and eyes that change with his mood. */
function catFace(): { root: SVGSVGElement; setMood(m: CatMood): void } {
  const root = svg("svg", { viewBox: "0 0 64 52", class: "cat-face" });
  svg("polygon", { points: "8,22 14,2 26,14", class: "ear" }, root);
  svg("polygon", { points: "56,22 50,2 38,14", class: "ear" }, root);
  svg("ellipse", { cx: 32, cy: 30, rx: 26, ry: 20, class: "head" }, root);
  const eyes = [svg("ellipse", { cx: 22, cy: 28, rx: 5, ry: 1, class: "eye" }, root), svg("ellipse", { cx: 42, cy: 28, rx: 5, ry: 1, class: "eye" }, root)];
  const brows = [svg("line", { x1: 16, y1: 19, x2: 27, y2: 23, class: "brow" }, root), svg("line", { x1: 48, y1: 19, x2: 37, y2: 23, class: "brow" }, root)];
  svg("polygon", { points: "29,36 35,36 32,39", class: "nose" }, root);
  const setMood = (m: CatMood): void => {
    const ry = m === "asleep" ? 0.6 : m === "calm" ? 2 : m === "suspicious" ? 4 : 5;
    for (const e of eyes) e.setAttribute("ry", String(ry));
    for (const b of brows) b.style.display = m === "angry" ? "" : "none";
    root.dataset.mood = m;
  };
  setMood("asleep");
  return { root, setMood };
}

export class Hud {
  private readonly root: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly promptText: HTMLSpanElement;
  private readonly promptBar: HTMLDivElement;
  private readonly promptFill: HTMLDivElement;
  private readonly toastBox: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly catBox: HTMLDivElement;
  private readonly cat = catFace();
  private readonly catText: HTMLSpanElement;
  private readonly team: HTMLDivElement;
  private readonly abilities: HTMLDivElement;
  private result: HTMLDivElement | null = null;
  private resultKey = "";
  private teamKey = "";
  private abilityRole: Role | "" = "";

  constructor(parent: HTMLElement, private readonly onAction: (a: HudAction) => void) {
    this.root = el("div", "hud", parent);
    this.label = el("div", "card hud-label", this.root);

    this.catBox = el("div", "card hud-cat", this.root);
    this.catBox.appendChild(this.cat.root);
    this.catText = el("span", "cat-text", this.catBox);

    this.prompt = el("div", "card hud-prompt", this.root);
    this.promptText = el("span", "prompt-text", this.prompt);
    this.promptBar = el("div", "prompt-bar", this.prompt);
    this.promptFill = el("div", "prompt-fill", this.promptBar);

    this.toastBox = el("div", "hud-toasts", this.root);
    this.team = el("div", "hud-team", this.root);
    this.abilities = el("div", "hud-abilities", this.root);
  }

  setLevel(name: string, item: string | null): void {
    this.label.replaceChildren();
    el("div", "level-name", this.label, name);
    el("div", "level-item", this.label, item ?? "Get out alive.");
  }

  setItemDone(done: boolean): void {
    this.label.classList.toggle("done", done);
  }

  /** Show or hide the in-play parts (hidden during the intro, briefing and results). */
  setPlaying(playing: boolean): void {
    this.root.classList.toggle("not-playing", !playing);
  }

  setCat(mood: CatMood, text: string): void {
    this.cat.setMood(mood);
    this.catText.textContent = text;
  }

  setPrompt(p: Prompt | null): void {
    this.prompt.hidden = !p;
    if (!p) return;
    this.promptText.textContent = p.text;
    this.prompt.classList.toggle("disabled", !!p.disabled);
    this.promptBar.hidden = p.progress === undefined;
    if (p.progress !== undefined) this.promptFill.style.width = `${Math.round(p.progress * 100)}%`;
  }

  setTeam(members: TeamMember[]): void {
    const key = members.map((m) => `${m.role}${m.name}${m.me}${m.status.join()}`).join("|");
    if (key !== this.teamKey) {
      this.teamKey = key;
      this.team.replaceChildren();
      const sorted = [...members].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
      for (const m of sorted) {
        const sheet = CHARACTERS[m.role];
        const card = el("div", `card portrait-card${m.me ? " me" : ""}`, this.team);
        card.dataset.role = m.role;
        const face = el("div", "portrait", card, sheet.name[0]);
        face.style.background = sheet.color;
        const info = el("div", "portrait-info", card);
        el("div", "portrait-name", info, m.me ? `${m.name} (you)` : m.name);
        const tags = el("div", "portrait-tags", info);
        for (const s of m.status) el("span", `tag tag-${s.replace(/\s+/g, "-")}`, tags, s);
        if (m.me) {
          const bar = el("div", "meter-bar", info);
          el("div", "meter-fill", bar);
        }
      }
    }
    // The detection meter changes every frame: update it without rebuilding.
    const mine = members.find((m) => m.me);
    const fill = this.team.querySelector<HTMLDivElement>(".portrait-card.me .meter-fill");
    if (mine && fill) {
      fill.style.width = `${Math.round(mine.seen * 100)}%`;
      fill.className = `meter-fill${mine.seen >= 1 ? " alarm" : mine.seen >= 0.35 ? " warn" : ""}`;
    }
  }

  setAbilities(role: Role | ""): void {
    if (role === this.abilityRole) return;
    this.abilityRole = role;
    this.abilities.replaceChildren();
    if (!role) return;
    for (const a of CHARACTERS[role].abilities) {
      const card = el("div", "card ability-card", this.abilities);
      el("span", "ability-key", card, a.key);
      el("span", "ability-name", card, a.name);
    }
  }

  toast(text: string): void {
    const t = el("div", "card hud-toast", this.toastBox, text);
    setTimeout(() => t.remove(), TOAST_MS);
  }

  showResult(info: ResultInfo | null): void {
    const key = info ? `${info.kind}:${info.stars}:${info.isHost}:${info.level}` : "";
    if (key === this.resultKey) return;
    this.resultKey = key;
    this.result?.remove();
    this.result = null;
    if (!info) return;

    const card = el("div", `card hud-result ${info.kind}`, this.root);
    if (info.kind === "caught") {
      el("div", "stamp", card, "CAUGHT!");
      el("p", "crow", card, line("results_caught").text);
    } else {
      el("div", "result-title", card, "Level complete");
      const stars = el("div", "stars", card);
      for (let i = 1; i <= 3; i++) stars.appendChild(starSvg(i <= info.stars));
      el("p", "crow", card, line(`results_${Math.max(1, Math.min(3, info.stars))}`).text);
      if (info.leftBehind.length) el("p", "left-behind", card, `Left behind: ${info.leftBehind.join(", ")}`);
    }
    const buttons = el("div", "buttons", card);
    if (info.isHost) {
      const b = (label: string, a: HudAction, cls = "paper-button"): void => {
        const btn = el("button", cls, buttons, label);
        btn.type = "button";
        btn.onclick = () => this.onAction(a);
      };
      b("Retry", { type: "retry" });
      if (info.kind === "complete" && info.level < LEVELS.length) b("Next level", { type: "next" }, "paper-button primary");
      const pick = el("select", "level-select", buttons);
      el("option", "", pick, "Level select...").value = "";
      for (const l of LEVELS) el("option", "", pick, `${l.id}. ${l.name}`).value = String(l.id);
      pick.onchange = () => { if (pick.value) this.onAction({ type: "select", level: Number(pick.value) }); };
    } else {
      el("p", "waiting", buttons, "Waiting for the host...");
    }
    this.result = card;
  }

  dispose(): void {
    this.root.remove();
  }
}
