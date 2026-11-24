// F1 debug overlay (PLAN.md Section 9, "Dev mode"): grid lines, frames per
// second, each player's position, tile, detection meter and hide status, the
// cat's state and alert, and recent noise radii.

import * as THREE from "three";
import { type Grid, charAt, worldToTile } from "@snikisnak/shared";
import { PALETTE } from "../render/palette";

const NOISE_LOG_MS = 3000;

export interface DebugPlayer {
  id: string; name: string; role: string; x: number; z: number;
  moving: boolean; sneaking: boolean; controlled: boolean;
  seen: number; hidden: boolean; jarred: boolean;
}

export interface DebugInfo { code: string; players: DebugPlayer[]; extra: string[]; }

export class DevPanel {
  readonly root = new THREE.Group();
  private readonly el: HTMLDivElement;
  private visible = false;
  private frames = 0;
  private fpsTime = 0;
  private fps = 0;
  private noises: Array<{ kind: string; radius: number; at: number }> = [];
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.code === "F1") { e.preventDefault(); this.toggle(); }
  };

  constructor(private readonly grid: Grid, parent: HTMLElement, private readonly info: () => DebugInfo) {
    this.root.name = "dev-panel";
    this.root.add(gridLines(grid));
    this.root.visible = false;

    this.el = document.createElement("div");
    this.el.className = "card dev-panel";
    this.el.hidden = true;
    parent.appendChild(this.el);
    window.addEventListener("keydown", this.onKey);
  }

  /** Remember a noise for a few seconds so its radius shows in the overlay. */
  logNoise(kind: string, radius: number): void {
    this.noises.push({ kind, radius, at: performance.now() });
    if (this.noises.length > 8) this.noises.shift();
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.visible = this.visible;
    this.el.hidden = !this.visible;
  }

  update(dt: number): void {
    this.frames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.frames / this.fpsTime);
      this.frames = 0;
      this.fpsTime = 0;
    }
    if (!this.visible) return;
    const { code, players, extra } = this.info();
    const lines = [`room ${code}   ${this.fps} fps`, ...extra];
    const now = performance.now();
    this.noises = this.noises.filter((n) => now - n.at < NOISE_LOG_MS);
    if (this.noises.length) lines.push(`noise: ${this.noises.map((n) => `${n.kind} r${n.radius}`).join(", ")}`);
    for (const p of players) {
      const t = worldToTile(p.x, p.z);
      const flags = [
        p.jarred ? "JARRED" : p.moving ? "moving" : "still", p.sneaking ? "sneak" : "", p.hidden ? "hidden" : "",
        p.controlled ? "you" : "",
      ].filter(Boolean).join(" ");
      lines.push(`${p.role.padEnd(5)} ${p.name.slice(0, 8).padEnd(8)} (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) ${t.x},${t.y}'${charAt(this.grid, t.x, t.y)}' seen ${p.seen.toFixed(2)} ${flags}`);
    }
    this.el.textContent = lines.join("\n");
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKey);
    this.el.remove();
    this.root.removeFromParent();
  }
}

function gridLines(grid: Grid): THREE.LineSegments {
  const pts: number[] = [];
  for (let x = 0; x <= grid.width; x++) pts.push(x, 0, 0, x, 0, grid.height);
  for (let z = 0; z <= grid.height; z++) pts.push(0, 0, z, grid.width, 0, z);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: PALETTE.paper, transparent: true, opacity: 0.35 }));
  lines.position.y = 0.03;
  return lines;
}
