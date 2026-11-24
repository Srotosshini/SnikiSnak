// Visual effects (PLAN.md Section 11, "Effects"). Phase 1: noise rings.
//
// Every noise the server broadcasts becomes a hand-drawn ink circle that grows
// to the noise radius and fades out in 0.6 s. Footstep rings smaller than 1
// tile aren't drawn (Section 4.2), so sneaking leaves no rings.

import * as THREE from "three";
import type { NoiseKind } from "@snikisnak/shared";
import { PALETTE } from "./palette";

const RING_LIFE = 0.6;
/** Section 4.2: footstep rings with radius under 1 are not drawn. */
const RING_MIN_RADIUS = 1;
const SEGMENTS = 72;

interface Ring {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  age: number;
  radius: number;
  width: number;
  wobble: [number, number, number];
}

export class Effects {
  readonly root = new THREE.Group();
  private readonly rings: Ring[] = [];
  private readonly pool: Ring[] = [];

  constructor() {
    this.root.name = "effects";
  }

  noiseRing(x: number, z: number, radius: number, kind: NoiseKind): void {
    if (kind === "step" && radius < RING_MIN_RADIUS) return;
    const ring = this.pool.pop() ?? this.makeRing();
    ring.age = 0;
    ring.radius = radius;
    ring.width = kind === "squeak" ? 0.1 : 0.055;
    ring.wobble = [Math.random() * 6.28, Math.random() * 6.28, 0.03 + Math.random() * 0.03];
    ring.mesh.position.set(x, 0.02, z);
    ring.mesh.visible = true;
    this.rings.push(ring);
    this.shape(ring, 0.05);
  }

  update(dt: number): void {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      const k = r.age / RING_LIFE;
      if (k >= 1) {
        r.mesh.visible = false;
        this.rings.splice(i, 1);
        this.pool.push(r);
        continue;
      }
      // Ease out: grows fast, then slows near full size.
      this.shape(r, 1 - (1 - k) * (1 - k));
      r.mesh.material.opacity = 0.85 * (1 - k);
    }
  }

  private makeRing(): Ring {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 2 * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({
      color: PALETTE.ink, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    this.root.add(mesh);
    return { mesh, age: 0, radius: 1, width: 0.05, wobble: [0, 0, 0] };
  }

  /** Rebuild the ring at a fraction of its full radius, keeping the line width constant. */
  private shape(r: Ring, frac: number): void {
    const pos = r.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const base = Math.max(0.05, r.radius * frac);
    const [p1, p2, amp] = r.wobble;
    for (let i = 0; i <= SEGMENTS; i++) {
      const th = (i / SEGMENTS) * Math.PI * 2;
      const w = 1 + amp * Math.sin(3 * th + p1) + amp * 0.6 * Math.sin(7 * th + p2);
      const outer = base * w, inner = Math.max(0, outer - r.width);
      const c = Math.cos(th), s = Math.sin(th);
      pos.setXYZ(i * 2, c * outer, 0, s * outer);
      pos.setXYZ(i * 2 + 1, c * inner, 0, s * inner);
    }
    pos.needsUpdate = true;
  }
}
