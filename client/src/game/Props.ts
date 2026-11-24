// Items and jars (PLAN.md Sections 4.6, 4.7 and 11).
//
// Items: a small gold model on the floor, or on the carrier's back.
// Jars: a see-through glass dome over a jarred player, with a ring that fills
// while two friends hold F to free them.

import * as THREE from "three";
import { PALETTE } from "../render/palette";
import { toon, toonMesh } from "../render/Toon";

/** Placeholder item models by name (Route B). GLB models replace these in Phase 8. */
function buildItem(model: string): THREE.Group {
  const g = new THREE.Group();
  if (model === "thimble") {
    const cup = toonMesh(new THREE.CylinderGeometry(0.075, 0.095, 0.15, 16), PALETTE.gold);
    cup.position.y = 0.075;
    const dimples = toonMesh(new THREE.SphereGeometry(0.075, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), PALETTE.gold);
    dimples.position.y = 0.15;
    g.add(cup, dimples);
  } else if (model === "honey_jar") {
    // The big jar with the bee on it.
    const jar = toonMesh(new THREE.CylinderGeometry(0.17, 0.15, 0.32, 18), PALETTE.cheese);
    jar.position.y = 0.16;
    const lid = toonMesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 18), PALETTE.gold);
    lid.position.y = 0.35;
    const label = toonMesh(new THREE.CylinderGeometry(0.175, 0.175, 0.12, 18, 1, true), PALETTE.paper, { outline: false });
    label.position.y = 0.17;
    const bee = toonMesh(new THREE.SphereGeometry(0.04, 10, 8).scale(1.3, 1, 1), PALETTE.ink, { outline: false });
    bee.position.set(0, 0.18, 0.18);
    g.add(jar, lid, label, bee);
  } else if (model === "pen_nib") {
    const nib = toonMesh(new THREE.ConeGeometry(0.06, 0.24, 4).scale(1, 1, 0.35), PALETTE.gold);
    nib.rotation.z = Math.PI / 2;
    nib.position.y = 0.05;
    g.add(nib);
  } else {
    const box = toonMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), PALETTE.gold);
    box.position.y = 0.08;
    g.add(box);
  }
  return g;
}

export class ItemView {
  readonly root: THREE.Group;
  private t = Math.random() * 6;

  constructor(readonly id: string, model: string) {
    this.root = buildItem(model);
    this.root.name = `item-${id}`;
  }

  /** On the floor: gently bob and turn so it catches the eye. */
  onFloor(x: number, z: number, dt: number): void {
    this.t += dt;
    this.root.position.set(x, 0.03 + Math.sin(this.t * 2.5) * 0.03, z);
    this.root.rotation.y += dt * 0.8;
  }

  /** Carried: sits on the carrier's back (heavy loot is held up higher). */
  onBack(carrier: THREE.Object3D, height: number, heavy = false): void {
    if (this.root.parent !== carrier) carrier.add(this.root);
    this.root.position.set(0, heavy ? height + 0.15 : height, heavy ? -0.05 : -0.14);
    this.root.rotation.set(0, 0, 0);
  }
}

const glass = new THREE.MeshToonMaterial({ color: PALETTE.paper, transparent: true, opacity: 0.35, depthWrite: false });

export class JarView {
  readonly root = new THREE.Group();
  private readonly ring: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private shownProgress = -1;

  constructor() {
    this.root.name = "jar";
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.6, 1), glass);
    dome.renderOrder = 3;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 8, 32), toon(PALETTE.paper));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.02;
    // One highlight streak.
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.28), new THREE.MeshBasicMaterial({ color: PALETTE.paper, transparent: true, opacity: 0.8 }));
    streak.position.set(-0.17, 0.3, 0.24);
    streak.rotation.set(0, -0.6, 0.25);
    this.root.add(dome, rim, streak);

    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.27, 32, 1, 0, 0.01), new THREE.MeshBasicMaterial({
      color: PALETTE.leaf, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide,
    }));
    this.ring.position.y = 0.9;
    this.ring.renderOrder = 11;
    this.root.add(this.ring);
  }

  update(x: number, z: number, rescue: number, camera: THREE.Camera): void {
    this.root.position.set(x, 0, z);
    this.ring.visible = rescue > 0.001;
    if (this.ring.visible) {
      this.ring.quaternion.copy(camera.quaternion);
      if (Math.abs(rescue - this.shownProgress) > 0.01) {
        this.ring.geometry.dispose();
        // Start at the top and fill clockwise.
        this.ring.geometry = new THREE.RingGeometry(0.2, 0.27, 32, 1, Math.PI / 2 - rescue * Math.PI * 2, rescue * Math.PI * 2);
        this.shownProgress = rescue;
      }
    }
  }
}

/** A ring that fills clockwise, always facing the camera: rescue and lock-pick progress. */
export class ProgressRing {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private shown = -1;

  constructor(color: number = PALETTE.leaf, private readonly inner = 0.2, private readonly outer = 0.27) {
    this.mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 32, 1, 0, 0.01), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide,
    }));
    this.mesh.renderOrder = 11;
    this.mesh.visible = false;
  }

  update(progress: number, camera: THREE.Camera): void {
    this.mesh.visible = progress > 0.001 && progress < 1;
    if (!this.mesh.visible) return;
    this.mesh.quaternion.copy(camera.quaternion);
    if (Math.abs(progress - this.shown) > 0.01) {
      this.mesh.geometry.dispose();
      // Start at the top and fill clockwise.
      this.mesh.geometry = new THREE.RingGeometry(this.inner, this.outer, 32, 1, Math.PI / 2 - progress * Math.PI * 2, progress * Math.PI * 2);
      this.shown = progress;
    }
  }
}
