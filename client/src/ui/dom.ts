// Tiny helpers for building plain-DOM screens.

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, className = "", parent?: HTMLElement, text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

export function button(label: string, parent: HTMLElement, onClick: () => void, className = "paper-button"): HTMLButtonElement {
  const b = el("button", className, parent, label);
  b.type = "button";
  b.onclick = onClick;
  return b;
}

/** A screen is mounted into the UI root and removed again. */
export interface Screen {
  unmount(): void;
}

const NAME_KEY = "snikisnak.name";

export function savedName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; }
}

export function saveName(name: string): void {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* private mode: fine */ }
}
