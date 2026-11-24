// Sir Crumbs on screen (PLAN.md Sections 4.4 and 11): the big orange tabby
// built from primitives, his vision cone on the floor, and the "?" and "!"
// marks over his head. Everything here only draws what the server decided.

import * as THREE from "three";
import { type Grid, type OpenSet, ALL_CLOSED, blocksVision, raycast } from "@snikisnak/shared";
import { PALETTE } from "../render/palette";
import { toonMesh } from "../render/Toon";
import { blobShadowTexture } from "../render/textures";
import { Interp, INTERP_DELAY_MS, angleDiff } from "../net/Interp";
import type { CatView as CatSnapshot } from "../net/Net";

const STRIPE = new THREE.Color(PALETTE.crumbs).lerp(new THREE.Color(PALETTE.darkWood), 0.4).getHex();
/** Pale yellow while calm, orange while suspicious, red while chasing (Section 4.4). */
const CONE_CALM = PALETTE.tape;
const CONE_SUSPICIOUS = PALETTE.crumbs;
const CONE_CHASE = PALETTE.jam;
const CONE_RAYS = 48;

function ellipsoid(rx: number, ry: number, rz: number, seg = 20): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)).scale(rx, ry, rz);
}

function part(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, outline = true): THREE.Mesh {
  const m = toonMesh(geo, color, { outline });
  m.position.set(x, y, z);
  return m;
}

/** Build the cat facing +Z: about 2.2 long and 1.2 tall at the shoulder. */
function buildCat(): { root: THREE.Group; body: THREE.Group; head: THREE.Group; tail: THREE.Group; eyes: THREE.Mesh[] } {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  body.add(part(ellipsoid(0.52, 0.46, 0.95), PALETTE.crumbs, 0, 0.72, 0));
  body.add(part(ellipsoid(0.36, 0.3, 0.5), PALETTE.paper, 0, 0.58, 0.45, false)); // pale chest
  for (const z of [-0.45, -0.1, 0.25]) {
    const stripe = part(new THREE.TorusGeometry(0.47, 0.05, 6, 24, Math.PI), STRIPE, 0, 0.76, z, false);
    stripe.rotation.y = Math.PI / 2;
    stripe.rotation.z = Math.PI / 2;
    body.add(stripe);
  }
  for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    body.add(part(new THREE.CylinderGeometry(0.11, 0.13, 0.5, 10), PALETTE.crumbs, lx * 0.28, 0.25, lz * 0.58));
    body.add(part(ellipsoid(0.13, 0.07, 0.16, 10), PALETTE.paper, lx * 0.28, 0.04, lz * 0.58 + 0.04, false));
  }

  const head = new THREE.Group();
  head.position.set(0, 1.0, 0.95);
  head.add(part(ellipsoid(0.42, 0.37, 0.38), PALETTE.crumbs, 0, 0, 0));
  head.add(part(ellipsoid(0.2, 0.13, 0.12), PALETTE.paper, 0, -0.1, 0.32, false)); // muzzle
  head.add(part(ellipsoid(0.05, 0.035, 0.03, 10), PALETTE.jam, 0, -0.03, 0.42, false)); // nose
  const eyes: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const ear = part(new THREE.ConeGeometry(0.13, 0.26, 4), PALETTE.crumbs, sx * 0.22, 0.36, -0.02);
    ear.rotation.set(0, Math.PI / 4, -sx * 0.25);
    head.add(ear);
    // Smug, half-closed eyes.
    const eye = part(ellipsoid(0.08, 0.025, 0.03, 12), PALETTE.ink, sx * 0.15, 0.07, 0.34, false);
    eye.rotation.z = sx * 0.15;
    head.add(eye);
    eyes.push(eye);
  }
  // Collar and bell.
  const collar = part(new THREE.TorusGeometry(0.3, 0.05, 8, 24), PALETTE.jam, 0, -0.27, -0.12);
  collar.rotation.x = Math.PI / 2 - 0.3;
  head.add(collar);
  head.add(part(ellipsoid(0.07, 0.07, 0.07, 12), PALETTE.gold, 0, -0.36, 0.14));
  body.add(head);

  // Tail: a chain of spheres curving up from the back.
  const tail = new THREE.Group();
  tail.position.set(0, 0.8, -0.9);
  for (let i = 0; i < 7; i++) {
    const a = i * 0.22;
    const r = 0.11 - i * 0.008;
    tail.add(part(ellipsoid(r, r, r, 10), i === 6 ? STRIPE : PALETTE.crumbs, 0, Math.sin(a) * 0.55, -Math.cos(a) * 0.12 * i, i > 4));
  }
  body.add(tail);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 2.6),
    new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.009;
  root.add(shadow);
  return { root, body, head, tail, eyes };
}

/** A sprite with one big hand-lettered character. */
function markSprite(text: string, color: number): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.font = "bold 104px 'Caveat Brush', 'Comic Sans MS', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 14;
  g.strokeStyle = `#${new THREE.Color(PALETTE.ink).getHexString()}`;
  g.strokeText(text, 64, 70);
  g.fillStyle = `#${new THREE.Color(color).getHexString()}`;
  g.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(0.9, 0.9, 1);
  s.renderOrder = 10;
  s.visible = false;
  return s;
}

export class CatView {
  readonly root = new THREE.Group();
  private readonly model = buildCat();
  private readonly interp = new Interp();
  private readonly cone: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly question = markSprite("?", PALETTE.cheese);
  private readonly alarm = markSprite("!", PALETTE.jam);
  private latest: CatSnapshot | null = null;
  private t = 0;
  private markPop = 0;
  private lastMark = "";
  private yaw = 0;

  /** Open doors, so the cone sees through them (set by GameScene). */
  open: OpenSet = ALL_CLOSED;

  constructor(private readonly grid: Grid, private readonly fov: number) {
    this.root.name = "sir-crumbs";
    this.root.add(this.model.root);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((CONE_RAYS + 2) * 3), 3));
    const idx: number[] = [];
    for (let i = 1; i <= CONE_RAYS; i++) idx.push(0, i + 1, i);
    geo.setIndex(idx);
    this.cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: CONE_CALM, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.cone.frustumCulled = false;
    this.cone.renderOrder = 1;
    this.root.add(this.cone);

    this.question.position.y = 2.1;
    this.alarm.position.y = 2.1;
    this.model.root.add(this.question, this.alarm);
  }

  /** Record a server snapshot. */
  push(c: CatSnapshot, now: number): void {
    if (!this.latest) {
      this.interp.reset({ t: now, x: c.x, z: c.z, facing: c.facing, moving: false, sneaking: false });
      this.yaw = c.facing;
    } else {
      this.interp.push({ t: now, x: c.x, z: c.z, facing: c.facing, moving: false, sneaking: false });
    }
    this.latest = { ...c };
  }

  get position(): THREE.Vector3 { return this.model.root.position; }
  /** What thought bubbles hang over. */
  get anchor(): THREE.Object3D { return this.model.root; }

  /** Draw the cat. `suspicious` = some player's detection meter is over 0.35. */
  update(dt: number, suspicious: boolean): void {
    const c = this.latest;
    if (!c) return;
    this.t += dt;
    const pose = this.interp.sample(performance.now() - INTERP_DELAY_MS);
    if (pose) {
      this.model.root.position.set(pose.x, 0, pose.z);
      this.yaw += angleDiff(this.yaw, pose.facing) * Math.min(1, dt * 12);
      this.model.root.rotation.y = this.yaw;
    }
    this.animate(c, dt);
    this.updateCone(c, suspicious);
    this.updateMarks(c, suspicious, dt);
  }

  private animate(c: CatSnapshot, dt: number): void {
    const { body, head, tail, eyes } = this.model;
    const s = c.state;
    const breathe = Math.sin(this.t * Math.PI * 2 * 0.5);
    let sy = 1, sz = 1, tilt = 0, bob = 0, wiggle = 0, headDown = 0;
    const walking = s === "PATROL" || s === "INVESTIGATE" || s === "RETURN" || s === "SEARCH";
    if (s === "SLEEP") { sy = 0.72 + breathe * 0.02; headDown = 0.45; }
    else if (s === "STIR") { tilt = -0.15; }
    else if (s === "CHASE") { sz = 1.12; bob = Math.abs(Math.sin(this.t * 14)) * 0.08; }
    else if (s === "POUNCE") { sy = 0.8; wiggle = Math.sin(this.t * 40) * 0.12; }
    else if (s === "CATCH" || s === "GIVE_UP") { tilt = -0.3; }
    else if (walking) { bob = Math.abs(Math.sin(this.t * 7)) * 0.04; }
    else { sy = 1 + breathe * 0.015; }

    body.scale.set(1, sy, sz);
    body.position.y = bob;
    body.rotation.set(tilt, wiggle, 0);
    head.rotation.set(headDown, c.headYaw, 0);
    tail.rotation.set(s === "SLEEP" ? 1.1 : 0, Math.sin(this.t * (s === "CHASE" ? 9 : 2.2)) * 0.4, 0);
    for (const e of eyes) e.scale.y = s === "SLEEP" ? 0.3 : s === "CHASE" || s === "POUNCE" ? 2.2 : 1;
    void dt;
  }

  /** The vision cone, cut off by walls and furniture using the same raycast as the server. */
  private updateCone(c: CatSnapshot, suspicious: boolean): void {
    const range = c.vision;
    this.cone.visible = range > 0;
    if (!this.cone.visible) return;
    const chasing = c.state === "CHASE" || c.state === "POUNCE";
    this.cone.material.color.setHex(chasing ? CONE_CHASE : suspicious ? CONE_SUSPICIOUS : CONE_CALM);
    this.cone.material.opacity = chasing ? 0.38 : 0.3;

    const origin = this.model.root.position;
    const look = this.yaw + c.headYaw;
    const half = (this.fov * Math.PI) / 360;
    const pos = this.cone.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, origin.x, 0.025, origin.z);
    const blocks = (x: number, y: number): boolean => blocksVision(this.grid, x, y, this.open);
    for (let i = 0; i <= CONE_RAYS; i++) {
      const a = look - half + (i / CONE_RAYS) * half * 2;
      const ex = origin.x + Math.sin(a) * range, ez = origin.z + Math.cos(a) * range;
      const hit = raycast(origin.x, origin.z, ex, ez, blocks);
      const d = hit.hit ? hit.dist : range;
      pos.setXYZ(i + 1, origin.x + Math.sin(a) * d, 0.025, origin.z + Math.cos(a) * d);
    }
    pos.needsUpdate = true;
    this.cone.geometry.computeBoundingSphere();
  }

  private updateMarks(c: CatSnapshot, suspicious: boolean, dt: number): void {
    const chasing = c.state === "CHASE" || c.state === "POUNCE";
    const curious = !chasing && (suspicious || c.state === "INVESTIGATE" || c.state === "STIR" || c.state === "SEARCH");
    const mark = chasing ? "!" : curious ? "?" : "";
    if (mark !== this.lastMark) { this.markPop = 0; this.lastMark = mark; }
    this.markPop = Math.min(1, this.markPop + dt * 6);
    // Quick scale bounce when a mark appears.
    const k = this.markPop;
    const bounce = 0.9 * (k < 0.6 ? k / 0.6 * 1.25 : 1.25 - (k - 0.6) / 0.4 * 0.25);
    this.alarm.visible = mark === "!";
    this.question.visible = mark === "?";
    for (const s of [this.alarm, this.question]) s.scale.set(bounce, bounce, 1);
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
