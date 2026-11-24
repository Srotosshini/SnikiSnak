// Player settings (PLAN.md Section 13, "Settings"), saved in this browser.

export interface Settings {
  volumes: { master: number; music: number; sfx: number; blips: number; voice: number };
  lowGraphics: boolean;
  micDevice: string;
}

const KEY = "snikisnak.settings";

const DEFAULTS: Settings = {
  volumes: { master: 0.8, music: 0.5, sfx: 0.8, blips: 0.7, voice: 1 },
  lowGraphics: false,
  micDevice: "",
};

let current: Settings = load();
const listeners: Array<(s: Settings) => void> = [];

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Settings>;
      return { ...DEFAULTS, ...saved, volumes: { ...DEFAULTS.volumes, ...(saved.volumes ?? {}) } };
    }
  } catch { /* fine */ }
  // ?low=1 starts with Low graphics on (handy on slow school laptops).
  return { ...DEFAULTS, lowGraphics: new URLSearchParams(location.search).get("low") === "1" };
}

export function settings(): Settings {
  return current;
}

export function updateSettings(change: Partial<Settings>): void {
  current = { ...current, ...change, volumes: { ...current.volumes, ...(change.volumes ?? {}) } };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* fine */ }
  for (const l of listeners) l(current);
}

export function onSettings(cb: (s: Settings) => void): void {
  listeners.push(cb);
  cb(current);
}
