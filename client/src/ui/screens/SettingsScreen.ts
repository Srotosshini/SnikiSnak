// Settings (PLAN.md Section 13): five volume sliders drawn as pencil lines,
// mic device, push-to-talk or open mic, walkie-talkie filter, Low graphics,
// reset tutorial cards, and the controls list.

import { settings, updateSettings, type Settings } from "../../settings";
import { resetCards } from "../../content/cards";
import { type Voice, loadVoiceSettings, saveVoiceSettings } from "../../net/Voice";
import { button, el } from "../dom";

const VOLUMES: Array<[keyof Settings["volumes"], string]> = [
  ["master", "Master"], ["music", "Music"], ["sfx", "Sound"], ["blips", "Voices"], ["voice", "Voice chat"],
];

export const CONTROLS: Array<[string, string]> = [
  ["W A S D / arrows", "Move"],
  ["Shift (hold)", "Sneak: half speed, much quieter"],
  ["E", "Use: pick up, drop, vent, latch, lock (hold), lift"],
  ["Q (hold)", "Cover (Kiwi)"],
  ["F (hold)", "Rescue, call it a night"],
  ["1 2 3 4", "Ping at the mouse: Go here, Cat!, Wait, Help"],
  ["V (hold)", "Push-to-talk"],
  ["M", "Mute your mic"],
  ["Esc", "Menu"],
];

export class SettingsScreen {
  private readonly root: HTMLDivElement;

  constructor(parent: HTMLElement, voice: Voice | null, onClose: () => void) {
    this.root = el("div", "screen modal settings-screen", parent);
    const card = el("div", "card settings-card", this.root);
    el("h2", "", card, "Settings");

    const s = settings();
    for (const [key, label] of VOLUMES) {
      const row = el("label", "slider-row", card);
      el("span", "slider-label", row, label);
      const input = el("input", "pencil-slider", row);
      input.type = "range";
      input.min = "0"; input.max = "1"; input.step = "0.05";
      input.value = String(s.volumes[key]);
      input.oninput = () => updateSettings({ volumes: { ...settings().volumes, [key]: Number(input.value) } });
    }

    const vs = voice?.settings ?? loadVoiceSettings();
    const check = (label: string, value: boolean, onChange: (v: boolean) => void): void => {
      const row = el("label", "check-row", card);
      const box = el("input", "", row);
      box.type = "checkbox";
      box.checked = value;
      el("span", "", row, ` ${label}`);
      box.onchange = () => onChange(box.checked);
    };
    check("Push-to-talk (hold V). Off = open mic.", vs.pushToTalk, (v) => {
      const next = { ...vs, pushToTalk: v };
      voice?.setSettings(next);
      saveVoiceSettings(voice?.settings ?? next);
    });
    check("Walkie-talkie filter", vs.walkie, (v) => {
      const next = { ...vs, walkie: v };
      voice?.setSettings(next);
      saveVoiceSettings(voice?.settings ?? next);
    });
    check("Low graphics (faster on old laptops)", s.lowGraphics, (v) => updateSettings({ lowGraphics: v }));

    const micRow = el("label", "slider-row", card);
    el("span", "slider-label", micRow, "Mic");
    const mic = el("select", "", micRow);
    el("option", "", mic, "Default").value = "";
    void navigator.mediaDevices?.enumerateDevices().then((devices) => {
      for (const d of devices.filter((x) => x.kind === "audioinput")) {
        const o = el("option", "", mic, d.label || `Microphone ${mic.options.length}`);
        o.value = d.deviceId;
      }
      mic.value = settings().micDevice;
    }).catch(() => undefined);
    mic.onchange = () => updateSettings({ micDevice: mic.value });

    const buttons = el("div", "tabs", card);
    button("Reset tutorial cards", buttons, () => resetCards(), "paper-button small");

    el("h3", "", card, "Controls");
    const table = el("table", "controls", card);
    for (const [key, what] of CONTROLS) {
      const tr = el("tr", "", table);
      el("td", "key", tr, key);
      el("td", "", tr, what);
    }
    const close = el("div", "tabs", card);
    button("Done", close, onClose, "paper-button primary");
  }

  unmount(): void {
    this.root.remove();
  }
}
