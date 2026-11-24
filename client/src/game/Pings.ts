// Pings (PLAN.md Sections 2 and 11): keys 1–4 drop a hand-drawn stamp on the
// floor at the mouse cursor: 1 "Go here" (arrow), 2 "Cat!" (exclamation),
// 3 "Wait" (hand), 4 "Help" ("?"). Stamps bounce in and fade after 4 s.

import * as THREE from "three";
import { PALETTE, css } from "../render/palette";

const LIFE = 4;
const COLORS: Record<number, number> = { 1: PALETTE.leaf, 2: PALETTE.jam, 3: PALETTE.cheese, 4: PALETTE.blueberry };

const textures = new Map<number, THREE.CanvasTexture>();

function stampTexture(kind: number): THREE.CanvasTexture {
  let tex = textures.get(kind);
  if (tex) return tex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.lineWidth = 9;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = css(PALETTE.ink);
  g.fillStyle = css(COLORS[kind]);
  // A wobbly round stamp.
  g.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 52 + Math.sin(i * 2.3) * 3;
    const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.fill();
  g.stroke();
  g.fillStyle = css(PALETTE.ink);
  if (kind === 1) {
    // Arrow pointing down at the spot.
    g.beginPath(); g.moveTo(64, 28); g.lineTo(64, 92); g.stroke();
    g.beginPath(); g.moveTo(40, 70); g.lineTo(64, 96); g.lineTo(88, 70); g.stroke();
  } else if (kind === 3) {
    // A raised hand.
    g.beginPath(); g.arc(64, 78, 18, 0, Math.PI * 2); g.stroke();
    for (const x of [48, 58, 70, 80]) { g.beginPath(); g.moveTo(x, 66); g.lineTo(x + (x - 64) * 0.2, 34); g.stroke(); }
  } else {
    g.font = "bold 86px 'Caveat Brush', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(kind === 2 ? "!" : "?", 64, 70);
  }
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textures.set(kind, tex);
  return tex;
}

interface Stamp { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; age: number; }

export class Pings {
  readonly root = new THREE.Group();
  private readonly stamps: Stamp[] = [];
  private readonly ray = new THREE.Raycaster();
  private readonly floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  /** Where on the floor the mouse points, or null. */
  floorPoint(mouseX: number, mouseY: number, camera: THREE.Camera): THREE.Vector3 | null {
    const ndc = new THREE.Vector2((mouseX / window.innerWidth) * 2 - 1, -(mouseY / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.floor, hit);
  }

  add(kind: number, x: number, z: number): void {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ map: stampTexture(kind), transparent: true, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.04, z);
    mesh.renderOrder = 5;
    this.root.add(mesh);
    this.stamps.push({ mesh, age: 0 });
  }

  update(dt: number): void {
    for (let i = this.stamps.length - 1; i >= 0; i--) {
      const s = this.stamps[i];
      s.age += dt;
      // Drop in with a bounce, then fade over the last second.
      const k = Math.min(1, s.age / 0.35);
      const bounce = k < 1 ? 1.6 - 0.6 * k + Math.sin(k * Math.PI) * 0.3 : 1;
      s.mesh.scale.setScalar(bounce);
      s.mesh.material.opacity = Math.min(1, (LIFE - s.age) / 1);
      if (s.age >= LIFE) {
        s.mesh.removeFromParent();
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        this.stamps.splice(i, 1);
      }
    }
  }
}
