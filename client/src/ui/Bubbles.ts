// Speech bubbles over characters' heads (PLAN.md Section 3, "In-game barks").
// Each bark shows for TUNING.bark.show seconds. The blip voice comes in Phase 5.

import * as THREE from "three";
import { TUNING } from "@snikisnak/shared";
import { el } from "./dom";

interface Bubble { div: HTMLDivElement; target: THREE.Object3D; height: number; until: number; }

export class Bubbles {
  private readonly root: HTMLDivElement;
  private readonly bubbles: Bubble[] = [];
  private readonly v = new THREE.Vector3();

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

  update(camera: THREE.Camera): void {
    const now = performance.now();
    for (const b of [...this.bubbles]) {
      if (now > b.until || !b.target.parent) { this.remove(b); continue; }
      b.target.getWorldPosition(this.v);
      this.v.y += b.height;
      this.v.project(camera);
      const x = (this.v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-this.v.y * 0.5 + 0.5) * window.innerHeight;
      b.div.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
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
