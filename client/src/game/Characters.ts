// The three smugglers as primitive "toys" (PLAN.md Section 11, Route B), with
// procedural animation instead of rigging: breathing, blinking, walk bounce,
// roll and squash, and a low lean while sneaking.
//
// Each model is built facing +Z with its feet at y = 0. Sizes: Kiwi about 0.5
// long, Mochi 0.35 tall, Pip 0.7 tall.

import * as THREE from "three";
import { type Role, TUNING } from "@snikisnak/shared";
import { PALETTE } from "../render/palette";
import { toonMesh } from "../render/Toon";
import { blobShadowTexture } from "../render/textures";

/** Mochi's pink nose and ears: a tint between jam red and paper (Section 2 asks for pink). */
const MOCHI_PINK = new THREE.Color(PALETTE.jam).lerp(new THREE.Color(PALETTE.paper), 0.45).getHex();

// --- geometry helpers: scale the geometry itself, so outlines keep an even thickness ---

function ellipsoid(rx: number, ry: number, rz: number, seg = 20): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)).scale(rx, ry, rz);
}

function part(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, outline = true): THREE.Mesh {
  const m = toonMesh(geo, color, { outline });
  m.position.set(x, y, z);
  return m;
}

interface Model {
  /** Everything that bounces and squashes. */
  body: THREE.Group;
  /** Eye meshes to scale for blinking. */
  eyes: THREE.Object3D[];
  /** Optional tail that swishes. */
  tail?: THREE.Object3D;
}

function buildKiwi(): Model {
  const body = new THREE.Group();
  body.add(part(ellipsoid(0.13, 0.11, 0.2), PALETTE.leaf, 0, 0.15, 0));
  body.add(part(ellipsoid(0.1, 0.05, 0.16), PALETTE.mochi, 0, 0.09, 0.01, false)); // cream belly
  body.add(part(ellipsoid(0.1, 0.09, 0.11), PALETTE.leaf, 0, 0.2, 0.2));             // head
  const eyes: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sx * 0.075, 0.25, 0.24);
    eye.add(part(ellipsoid(0.045, 0.045, 0.045, 14), PALETTE.leaf, 0, 0, 0));
    eye.add(part(ellipsoid(0.02, 0.02, 0.012, 10), PALETTE.ink, sx * 0.012, 0.004, 0.038, false));
    body.add(eye);
    eyes.push(eye);
  }
  for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    body.add(part(ellipsoid(0.035, 0.05, 0.035, 10), PALETTE.leaf, lx * 0.11, 0.05, lz * 0.1));
  }
  body.add(part(new THREE.BoxGeometry(0.1, 0.07, 0.09), PALETTE.darkWood, 0, 0.26, -0.03)); // satchel
  const tail = new THREE.Group();
  tail.position.set(0, 0.13, -0.2);
  const curl = toonMesh(new THREE.TorusGeometry(0.065, 0.024, 8, 20, Math.PI * 1.6), PALETTE.leaf);
  curl.rotation.y = Math.PI / 2;
  curl.position.set(0, 0, -0.04);
  tail.add(curl);
  body.add(tail);
  return { body, eyes, tail };
}

function buildMochi(): Model {
  const body = new THREE.Group();
  body.add(part(ellipsoid(0.15, 0.15, 0.14), PALETTE.mochi, 0, 0.16, 0));
  body.add(part(ellipsoid(0.1, 0.09, 0.05), PALETTE.paper, 0, 0.13, 0.1, false)); // white tummy
  for (const sx of [-1, 1]) {
    body.add(part(ellipsoid(0.065, 0.06, 0.06, 14), PALETTE.paper, sx * 0.11, 0.17, 0.07)); // cheeks
    const ear = part(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 14), MOCHI_PINK, sx * 0.09, 0.3, -0.01);
    ear.rotation.set(Math.PI / 2, 0, sx * 0.4);
    body.add(ear);
  }
  const eyes: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const eye = part(ellipsoid(0.018, 0.022, 0.012, 10), PALETTE.ink, sx * 0.05, 0.22, 0.13, false);
    body.add(eye);
    eyes.push(eye);
  }
  body.add(part(ellipsoid(0.018, 0.014, 0.014, 10), MOCHI_PINK, 0, 0.19, 0.145, false)); // nose
  body.add(part(new THREE.BoxGeometry(0.11, 0.1, 0.06), PALETTE.blueberry, 0, 0.18, -0.15)); // tiny backpack
  for (const sx of [-1, 1]) body.add(part(ellipsoid(0.04, 0.025, 0.05, 10), MOCHI_PINK, sx * 0.07, 0.02, 0.05));
  return { body, eyes };
}

function buildPip(): Model {
  const body = new THREE.Group();
  body.add(part(new THREE.CapsuleGeometry(0.13, 0.16, 6, 16), PALETTE.pip, 0, 0.26, 0));
  body.add(part(ellipsoid(0.08, 0.1, 0.04), PALETTE.paper, 0, 0.24, 0.1, false)); // pale chest
  body.add(part(ellipsoid(0.14, 0.125, 0.13), PALETTE.pip, 0, 0.53, 0.01));         // head
  body.add(part(ellipsoid(0.05, 0.04, 0.06, 12), PALETTE.paper, 0, 0.5, 0.13));     // muzzle
  body.add(part(ellipsoid(0.02, 0.016, 0.016, 8), PALETTE.ink, 0, 0.515, 0.19, false)); // nose
  // The black mask: a band across the eyes.
  const mask = part(ellipsoid(0.145, 0.04, 0.13, 18), PALETTE.ink, 0, 0.56, 0.015, false);
  body.add(mask);
  const eyes: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sx * 0.055, 0.565, 0.13);
    eye.add(part(ellipsoid(0.025, 0.025, 0.012, 10), PALETTE.paper, 0, 0, 0, false));
    eye.add(part(ellipsoid(0.012, 0.014, 0.008, 8), PALETTE.ink, 0, 0, 0.008, false));
    body.add(eye);
    eyes.push(eye);
    const ear = part(new THREE.ConeGeometry(0.045, 0.08, 10), PALETTE.pip, sx * 0.09, 0.66, -0.01);
    ear.rotation.z = -sx * 0.35;
    body.add(ear);
  }
  // Striped scarf.
  const scarf = part(new THREE.TorusGeometry(0.11, 0.035, 8, 20), PALETTE.jam, 0, 0.41, 0);
  scarf.rotation.x = Math.PI / 2;
  body.add(scarf);
  for (const sx of [-1, 1]) body.add(part(ellipsoid(0.045, 0.06, 0.045, 10), PALETTE.pip, sx * 0.07, 0.04, 0.02));
  // Ringed tail.
  const tail = new THREE.Group();
  tail.position.set(0, 0.18, -0.12);
  tail.rotation.x = -0.9;
  for (let i = 0; i < 5; i++) {
    const ring = part(new THREE.CylinderGeometry(0.05 - i * 0.004, 0.052 - i * 0.004, 0.06, 12), i % 2 ? PALETTE.ink : PALETTE.pip, 0, -i * 0.058, 0);
    tail.add(ring);
  }
  body.add(tail);
  return { body, eyes, tail };
}

const BUILDERS: Record<Role, () => Model> = { kiwi: buildKiwi, mochi: buildMochi, pip: buildPip };
const SHADOW_SIZE: Record<Role, number> = { kiwi: 0.55, mochi: 0.45, pip: 0.55 };
export const ROLE_COLOR: Record<Role, number> = { kiwi: PALETTE.leaf, mochi: PALETTE.mochi, pip: PALETTE.pip };

/** How much bigger the smugglers are drawn than PLAN.md's sizes (readability on small screens). */
export const CHARACTER_SCALE = 1.35;

export interface AnimInput {
  moving: boolean;
  sneaking: boolean;
  /** Tiles per second, for the walk cycle speed. */
  speed: number;
}

/** Walk-cycle frequency per tile/s of speed: at walk speed a footfall lands about every 0.38 s. */
const STRIDE = Math.PI / (TUNING.noise.stepEvery * TUNING.player.walk);
const SQUASH_TIME = 0.06;
/** Where the "you" arrow floats. */
const ARROW_HEIGHT: Record<Role, number> = { kiwi: 0.85, mochi: 0.85, pip: 1.3 };
/** How fast a character turns to face where it moves (1/seconds). */
const TURN_RATE = 18;

export class Character {
  readonly root = new THREE.Group();
  private readonly model: Model;
  private t = Math.random() * 10;
  private phase = 0;
  private squash = 0;
  private nextBlink = 2 + Math.random() * 3;
  private blink = 0;
  private lowered = 0;
  private lastSin = 0;
  private readonly ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly arrow: THREE.Mesh;
  private local = false;
  private targetFacing = 0;

  constructor(readonly role: Role) {
    this.model = BUILDERS[role]();
    // Drawn a bit bigger than their collision circle, so they read on a laptop screen.
    const holder = new THREE.Group();
    holder.scale.setScalar(CHARACTER_SCALE);
    holder.add(this.model.body);
    this.root.add(holder);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(SHADOW_SIZE[role] * CHARACTER_SCALE, SHADOW_SIZE[role] * CHARACTER_SCALE),
      new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.008;
    shadow.renderOrder = 1;
    this.root.add(shadow);

    // A ring in the character's colour, so everyone is easy to spot and tell apart.
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.36, 40),
      new THREE.MeshBasicMaterial({ color: ROLE_COLOR[role], transparent: true, opacity: 0.8, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.012;
    this.ring.renderOrder = 2;
    this.root.add(this.ring);

    // Your own character also gets a bobbing gold arrow overhead.
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), new THREE.MeshBasicMaterial({ color: PALETTE.gold }));
    this.arrow.rotation.x = Math.PI;
    this.arrow.position.y = ARROW_HEIGHT[role];
    this.arrow.visible = false;
    this.root.add(this.arrow);
  }

  setLocal(local: boolean): void {
    this.local = local;
    this.arrow.visible = local;
    this.ring.material.opacity = local ? 1 : 0.7;
    this.ring.scale.setScalar(local ? 1.15 : 1);
  }

  /** Hide the ground ring (the rooftop scenes don't need it). */
  setRing(visible: boolean): void {
    this.ring.visible = visible;
  }

  setPose(x: number, z: number, facing: number): void {
    this.root.position.set(x, 0, z);
    this.targetFacing = facing;
  }

  update(dt: number, a: AnimInput): void {
    this.t += dt;
    if (this.local) {
      this.arrow.position.y = ARROW_HEIGHT[this.role] + Math.abs(Math.sin(this.t * 3)) * 0.12;
      this.arrow.rotation.y += dt * 2;
    }
    // Turn smoothly toward the facing direction, the short way round.
    const diff = Math.atan2(Math.sin(this.targetFacing - this.root.rotation.y), Math.cos(this.targetFacing - this.root.rotation.y));
    this.root.rotation.y += diff * Math.min(1, dt * TURN_RATE);
    const body = this.model.body;

    // Sneaking: lower the body and lean forward.
    this.lowered += ((a.sneaking ? 1 : 0) - this.lowered) * Math.min(1, dt * 10);
    const lean = THREE.MathUtils.degToRad(10) * this.lowered;
    const low = 1 - 0.15 * this.lowered;

    let bounce = 0, roll = 0, sy = 1, sxz = 1;
    if (a.moving && a.speed > 0.01) {
      this.phase += dt * a.speed * STRIDE;
      const s = Math.sin(this.phase);
      bounce = Math.abs(s) * 0.06 * low;
      roll = THREE.MathUtils.degToRad(6) * s;
      // A footfall lands each time the bounce touches the ground.
      if (Math.sign(s) !== Math.sign(this.lastSin)) this.squash = SQUASH_TIME;
      this.lastSin = s;
    } else {
      this.phase = 0;
      // Idle breathing.
      sy = 1 + 0.03 * Math.sin(this.t * Math.PI * 2 * 1.2);
    }
    if (this.squash > 0) {
      this.squash -= dt;
      sy *= 0.92; sxz *= 1.04;
    }
    body.position.y = bounce;
    body.rotation.set(lean, 0, roll);
    body.scale.set(sxz, sy * low, sxz);

    // Blink every 3–6 s.
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blink = 0.12; this.nextBlink = 3 + Math.random() * 3; }
    const eyeY = this.blink > 0 ? 0.15 : 1;
    if (this.blink > 0) this.blink -= dt;
    for (const e of this.model.eyes) e.scale.y = eyeY;

    if (this.model.tail) this.model.tail.rotation.y = Math.sin(this.t * (a.moving ? 6 : 2)) * 0.35;
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
