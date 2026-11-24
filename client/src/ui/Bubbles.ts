// Speech bubbles over characters' heads (PLAN.md Section 3, "In-game barks"),
// and the little sound waves over whoever is talking on voice chat (Section 10).
// Each bark shows for TUNING.bark.show seconds. The blip voice comes in Phase 5.

import * as THREE from "three";
import { TUNING } from "@snikisnak/shared";
import { el } from "./dom";

interface Bubble { div: HTMLDivElement; target: THREE.Object3D; height: number; until: number; }
interface Waves { div: HTMLDivElement; target: THREE.Object3D; height: number; }

export class Bubbles {
  private readonly root: HTMLDivElement;
  private readonly bubbles: Bubble[] = [];
  private readonly v = new THREE.Vector3();
  private readonly waves = new Map<THREE.Object3D, Waves>();

  constructor(parent: HTMLElement) {
    this.root = el("div", "bubbles", parent);
  }

  /** Show a line over an object (one bubble per object at a time). */
  say(target: THREE.Object3D, height: number, speaker: string, text: string): void {
    for (const b of this.bubbles.filter((x) => x.target === target)) this.remove(b);
    const div = el("div", "bubble", this.root);
    el("span", "bubble-who", div, speaker);
    el("span", "bubble-text", div, text);
    this.bubbles.push({ div, target, height, until: performance.now() + TUNING.bark.show * 1000 });
  }

  /** Little sound waves over someone who is talking on voice chat (Section 10). */
  setTalking(target: THREE.Object3D, height: number, on: boolean): void {
    const w = this.waves.get(target);
    if (on && !w) {
      const div = el("div", "talk-waves", this.root);
      for (let i = 0; i < 3; i++) el("span", "wave", div);
      this.waves.set(target, { div, target, height });
    } else if (!on && w) {
      w.div.remove();
      this.waves.delete(target);
    }
  }

  private place(div: HTMLElement, target: THREE.Object3D, height: number, camera: THREE.Camera): void {
    target.getWorldPosition(this.v);
    this.v.y += height;
    this.v.project(camera);
    const x = (this.v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.v.y * 0.5 + 0.5) * window.innerHeight;
    div.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  update(camera: THREE.Camera): void {
    for (const w of this.waves.values()) {
      w.div.hidden = !w.target.parent || this.bubbles.some((x) => x.target === w.target);
      this.place(w.div, w.target, w.height + 0.1, camera);
    }
    const now = performance.now();
    for (const b of [...this.bubbles]) {
      if (now > b.until || !b.target.parent) { this.remove(b); continue; }
      this.place(b.div, b.target, b.height, camera);
    }
  }

  private remove(b: Bubble): void {
    b.div.remove();
    const i = this.bubbles.indexOf(b);
    if (i >= 0) this.bubbles.splice(i, 1);
  }

  dispose(): void {
    this.root.remove();
  }
}
