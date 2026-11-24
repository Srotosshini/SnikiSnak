// Lobby (PLAN.md Section 13): a corkboard with the room code, three character
// cards to claim, a Ready checkbox, and for the host the level picker and GO.
// Voice: a Test mic button with a level meter, push-to-talk or open mic, and
// the walkie-talkie filter (Section 10). A speaking player's card bounces.

import { LEVELS, ROLES, type Role } from "@snikisnak/shared";
import type { HeistRoom, HeistView, PlayerView } from "../../net/Net";
import { CHARACTERS } from "../../content/characters";
import { type Screen, button, el } from "../dom";
import { LOCAL_PEER, type Voice, saveVoiceSettings } from "../../net/Voice";

export class LobbyScreen implements Screen {
  private readonly root: HTMLDivElement;
  private readonly cards = new Map<Role, HTMLDivElement>();
  private readonly codeEl: HTMLDivElement;
  private readonly readyBox: HTMLInputElement;
  private readonly readyLabel: HTMLLabelElement;
  private readonly hostArea: HTMLDivElement;
  private readonly levelSelect: HTMLSelectElement;
  private readonly goButton: HTMLButtonElement;
  private readonly status: HTMLParagraphElement;
  private readonly people: HTMLUListElement;
  private readonly micFill: HTMLDivElement | null = null;
  private readonly micStatus: HTMLSpanElement | null = null;
  private readonly speaking = new Set<string>();
  private raf = 0;
  private lastState: HeistView | null = null;

  constructor(parent: HTMLElement, private readonly room: HeistRoom, private readonly voice: Voice | null = null) {
    this.root = el("div", "screen lobby-screen", parent);
    const board = el("div", "corkboard", this.root);

    const note = el("div", "card sticky", board);
    el("div", "sticky-label", note, "Heist code");
    this.codeEl = el("div", "sticky-code", note, room.roomId);
    button("Copy", note, () => {
      void navigator.clipboard?.writeText(room.roomId).catch(() => undefined);
    }, "paper-button small");
    this.people = el("ul", "people", note);

    const row = el("div", "character-row", board);
    for (const role of ROLES) {
      const sheet = CHARACTERS[role];
      const card = el("div", "card character-card", row);
      card.dataset.role = role;
      const portrait = el("div", "portrait", card);
      portrait.style.background = sheet.color;
      portrait.textContent = sheet.name[0];
      el("div", "char-name", card, sheet.name);
      el("div", "char-tag", card, sheet.tagline);
      const list = el("ul", "char-traits", card);
      for (const s of sheet.strengths) el("li", "strength", list, s);
      el("li", "weakness", list, sheet.weakness);
      el("div", "claimed-by", card);
      card.onclick = () => this.claim(role);
      this.cards.set(role, card);
    }

    const controls = el("div", "card lobby-controls", board);
    this.readyLabel = el("label", "ready-check", controls);
    this.readyBox = el("input", "", this.readyLabel);
    this.readyBox.type = "checkbox";
    el("span", "", this.readyLabel, "Ready");
    this.readyBox.onchange = () => room.send("ready", { ready: this.readyBox.checked });

    this.hostArea = el("div", "host-area", controls);
    const pick = el("label", "level-pick", this.hostArea);
    el("span", "", pick, "Start at ");
    this.levelSelect = el("select", "", pick);
    for (const l of LEVELS) {
      const o = el("option", "", this.levelSelect, `${l.id}. ${l.name}`);
      o.value = String(l.id);
    }
    this.levelSelect.onchange = () => room.send("select", { level: Number(this.levelSelect.value) });
    this.goButton = button("GO!", this.hostArea, () => room.send("start", {}), "paper-button go-stamp");
    this.status = el("p", "lobby-status", controls);

    if (voice) {
      const v = el("div", "voice-box", controls);
      const row = el("div", "voice-row", v);
      button("Test mic", row, () => void voice.askMic().then(() => this.refreshVoice()), "paper-button small");
      const bar = el("div", "meter-bar mic-meter", row);
      this.micFill = el("div", "meter-fill", bar);
      this.micStatus = el("span", "mic-status", row);
      const opts = el("div", "voice-row", v);
      const ptt = el("label", "", opts);
      const pttBox = el("input", "", ptt);
      pttBox.type = "checkbox";
      pttBox.checked = voice.settings.pushToTalk;
      el("span", "", ptt, " Push-to-talk (hold V)");
      pttBox.onchange = () => { voice.setSettings({ pushToTalk: pttBox.checked }); saveVoiceSettings(voice.settings); this.refreshVoice(); };
      const walkie = el("label", "", opts);
      const walkieBox = el("input", "", walkie);
      walkieBox.type = "checkbox";
      walkieBox.checked = voice.settings.walkie;
      el("span", "", walkie, " Walkie-talkie filter");
      walkieBox.onchange = () => { voice.setSettings({ walkie: walkieBox.checked }); saveVoiceSettings(voice.settings); };
      el("p", "voice-hint", v, "Headphones stop echo. No mic? You can still play: pings and barks carry the basics.");
      this.refreshVoice();
      const tick = (): void => {
        if (this.micFill) this.micFill.style.width = `${Math.min(100, Math.round(voice.micLevel * 400))}%`;
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }
  }

  private refreshVoice(): void {
    if (!this.voice || !this.micStatus) return;
    const v = this.voice;
    this.micStatus.textContent = v.hasMic
      ? (v.isMuted ? "Muted (M)" : v.settings.pushToTalk ? "Mic on. Hold V to talk." : "Open mic.")
      : v.micError === "denied" ? "Mic blocked: allow it in the address bar."
      : v.micError === "missing" ? "No mic found."
      : "Click Test mic.";
  }

  /** Bounce the card of whoever is talking. */
  setSpeaking(peerId: string, on: boolean): void {
    const id = peerId === LOCAL_PEER ? this.room.sessionId : peerId;
    if (on) this.speaking.add(id); else this.speaking.delete(id);
    if (this.lastState) this.update(this.lastState);
  }

  private claim(role: Role): void {
    const me = this.room.state.players.get(this.room.sessionId);
    if (!me) return;
    this.room.send("role", { role: me.role === role ? "" : role });
  }

  update(state: HeistView): void {
    this.lastState = state;
    this.refreshVoice();
    const me = state.players.get(this.room.sessionId);
    const players: PlayerView[] = [];
    state.players.forEach((p) => players.push(p));
    const isHost = state.hostId === this.room.sessionId;

    this.codeEl.textContent = state.code || this.room.roomId;
    this.people.replaceChildren();
    for (const p of players) {
      const li = el("li", p.ready ? "ready" : "", this.people, `${p.name}${p.id === state.hostId ? " (host)" : ""}${p.ready ? " — ready" : ""}`);
      if (p.id === this.room.sessionId) li.classList.add("me");
    }

    for (const role of ROLES) {
      const card = this.cards.get(role)!;
      const owner = players.find((p) => p.role === role);
      card.classList.toggle("claimed", !!owner);
      card.classList.toggle("mine", owner?.id === this.room.sessionId);
      card.classList.toggle("speaking", !!owner && this.speaking.has(owner.id));
      card.querySelector(".claimed-by")!.textContent = owner ? owner.name : "Click to claim";
      card.classList.toggle("mic-off", !!owner?.micOff);
    }

    this.readyBox.checked = !!me?.ready;
    this.readyBox.disabled = !me?.role;
    this.readyLabel.classList.toggle("disabled", !me?.role);

    this.hostArea.hidden = !isHost;
    this.levelSelect.value = String(state.level);
    const roles = new Set(players.map((p) => p.role).filter(Boolean));
    const canStart = players.length === 3 && roles.size === 3 && players.every((p) => p.ready);
    this.goButton.disabled = !canStart;

    let status: string;
    if (players.length < 3) status = `Waiting for ${3 - players.length} more smuggler${players.length === 2 ? "" : "s"}. Share the code!`;
    else if (roles.size < 3) status = "Everyone picks a different smuggler.";
    else if (!players.every((p) => p.ready)) status = "Tick Ready when you're set.";
    else status = isHost ? "Everyone's ready. Press GO!" : "Waiting for the host to press GO.";
    this.status.textContent = status;
  }

  unmount(): void {
    cancelAnimationFrame(this.raf);
    this.root.remove();
  }
}
