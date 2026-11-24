// The moonlit rooftop (PLAN.md Sections 3 and 13): Queen Corvina on her throne
// of tin cans, the three smugglers on the roof edge, string lights, and the Big
// House in the background with a lit window. Used behind the start screen and
// lobby (the camera slowly circles) and for the opening cutscene (camera shots).

import * as THREE from "three";
import type { Role } from "@snikisnak/shared";
import { PALETTE } from "../render/palette";
import { toonMesh } from "../render/Toon";
import { Character } from "./Characters";
import type { Renderer } from "../render/Renderer";
import type { Shot } from "../content/cutscenes";

function ellipsoid(rx: number, ry: number, rz: number, seg = 18): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)).scale(rx, ry, rz);
}

/** Queen Corvina: a black crow with a bottle-cap crown and a tiny red cape. */
function buildCrow(): { root: THREE.Group; head: THREE.Group; crown: THREE.Object3D } {
  const root = new THREE.Group();
  const body = toonMesh(ellipsoid(0.22, 0.26, 0.3), PALETTE.crow);
  body.position.y = 0.35;
  const sheen = toonMesh(ellipsoid(0.2, 0.18, 0.26), PALETTE.crowSheen, { outline: false });
  sheen.position.set(0, 0.42, -0.04);
  const cape = toonMesh(new THREE.ConeGeometry(0.3, 0.45, 16, 1, true, Math.PI * 0.6, Math.PI * 0.8), PALETTE.jam);
  cape.position.set(0, 0.33, -0.05);
  const tail = toonMesh(new THREE.ConeGeometry(0.12, 0.35, 6), PALETTE.crow);
  tail.position.set(0, 0.25, -0.35);
  tail.rotation.x = -1.9;
  root.add(body, sheen, cape, tail);
  for (const sx of [-1, 1]) {
    const leg = toonMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6), PALETTE.ink);
    leg.position.set(sx * 0.08, 0.09, 0);
    root.add(leg);
  }
  const head = new THREE.Group();
  head.position.set(0, 0.68, 0.12);
  head.add(toonMesh(ellipsoid(0.15, 0.14, 0.15), PALETTE.crow));
  const beak = toonMesh(new THREE.ConeGeometry(0.05, 0.2, 8), PALETTE.pip);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.02, 0.2);
  head.add(beak);
  for (const sx of [-1, 1]) {
    const eye = toonMesh(ellipsoid(0.03, 0.03, 0.02, 10), PALETTE.paper, { outline: false });
    eye.position.set(sx * 0.07, 0.04, 0.12);
    const pupil = toonMesh(ellipsoid(0.014, 0.016, 0.01, 8), PALETTE.ink, { outline: false });
    pupil.position.set(sx * 0.07, 0.04, 0.14);
    head.add(eye, pupil);
  }
  const crown = toonMesh(new THREE.CylinderGeometry(0.1, 0.11, 0.06, 14), PALETTE.gold);
  crown.position.set(0, 0.16, 0);
  head.add(crown);
  root.add(head);
  return { root, head, crown };
}

export class Rooftop {
  readonly root = new THREE.Group();
  private readonly crow = buildCrow();
  private readonly smugglers: Character[] = [];
  private readonly catShadow: THREE.Mesh;
  private readonly lights: THREE.Mesh[] = [];
  private t = 0;
  private shot: Shot | "orbit" = "orbit";
  private shotTime = 0;
  private catWalk = -1;
  private readonly lookAt = new THREE.Vector3();
  private readonly camPos = new THREE.Vector3(8, 4, 8);
  private attachedTo: Renderer | null = null;

  constructor() {
    this.root.name = "rooftop";
    this.root.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.8));
    const moonLight = new THREE.DirectionalLight(PALETTE.moon, 1.6);
    moonLight.position.set(-6, 10, -8);
    this.root.add(moonLight);

    // The flat roof, a low parapet, a chimney and a drainpipe.
    const roof = toonMesh(new THREE.BoxGeometry(10, 0.4, 6), PALETTE.darkWood, { outline: false });
    roof.position.y = -0.2;
    this.root.add(roof);
    const parapet = toonMesh(new THREE.BoxGeometry(10, 0.3, 0.25), PALETTE.plaster);
    parapet.position.set(0, 0.15, 2.9);
    this.root.add(parapet);
    const chimney = toonMesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), PALETTE.plaster);
    chimney.position.set(-3.5, 0.8, -1.8);
    this.root.add(chimney);
    const pipe = toonMesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 10), PALETTE.pip);
    pipe.position.set(4.6, -1.7, 3.05);
    this.root.add(pipe);

    // The throne of tin cans, and the Queen on top.
    const cans: Array<[number, number, number]> = [[-0.45, 0, 0], [0, 0, 0], [0.45, 0, 0], [-0.22, 0.42, 0], [0.22, 0.42, 0], [0, 0.84, 0]];
    for (const [x, y, z] of cans) {
      const can = toonMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 16), y > 0.5 ? PALETTE.jam : PALETTE.pip);
      can.position.set(x, y + 0.2, z - 0.5);
      this.root.add(can);
    }
    this.crow.root.position.set(0, 1.05, -0.5);
    this.root.add(this.crow.root);

    // The three smugglers along the roof edge.
    (["kiwi", "mochi", "pip"] as Role[]).forEach((role, i) => {
      const c = new Character(role);
      c.setPose(-1.4 + i * 1.4, 1.8, Math.PI);
      c.root.position.y = 0;
      this.root.add(c.root);
      this.smugglers.push(c);
    });

    // String lights between two poles.
    for (const x of [-4.5, 4.5]) {
      const pole = toonMesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), PALETTE.darkWood);
      pole.position.set(x, 1.1, -2.6);
      this.root.add(pole);
    }
    for (let i = 0; i <= 18; i++) {
      const k = i / 18;
      const x = -4.5 + k * 9;
      const y = 2.15 - Math.sin(k * Math.PI) * 0.6;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? PALETTE.cheese : PALETTE.lamp }));
      bulb.position.set(x, y, -2.6);
      this.root.add(bulb);
      this.lights.push(bulb);
    }

    // The Big House behind, with lit windows.
    const house = toonMesh(new THREE.BoxGeometry(12, 7, 4), PALETTE.plaster, { outline: false });
    house.position.set(0, -1.5, -14);
    this.root.add(house);
    const houseRoof = toonMesh(new THREE.ConeGeometry(8.6, 3.5, 4), PALETTE.darkWood, { outline: false });
    houseRoof.rotation.y = Math.PI / 4;
    houseRoof.scale.set(1, 1, 0.33);
    houseRoof.position.set(0, 3.75, -14);
    this.root.add(houseRoof);
    const windowMat = new THREE.MeshBasicMaterial({ color: PALETTE.lamp });
    for (const [x, y] of [[-3.5, 0.5], [3.5, 0.5], [0, -2.2]] as const) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), windowMat);
      w.position.set(x, y, -11.98);
      this.root.add(w);
    }
    // A cat silhouette that crosses the left window now and then.
    const cat = new THREE.Shape();
    cat.absellipse(0, 0, 0.55, 0.28, 0, Math.PI * 2, false, 0);
    const catGeo = new THREE.ShapeGeometry(cat);
    this.catShadow = new THREE.Mesh(catGeo, new THREE.MeshBasicMaterial({ color: PALETTE.ink }));
    const head = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), this.catShadow.material);
    head.position.set(0.55, 0.22, 0);
    for (const ex of [-0.12, 0.12]) {
      const ear = new THREE.Mesh(new THREE.CircleGeometry(0.1, 3), this.catShadow.material);
      ear.position.set(0.55 + ex, 0.42, 0);
      ear.rotation.z = Math.PI / 2;
      this.catShadow.add(ear);
    }
    this.catShadow.add(head);
    this.catShadow.position.set(-5, 0.2, -11.96);
    this.catShadow.visible = false;
    this.root.add(this.catShadow);

    // Stars and the moon.
    const stars = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.2;
      stars.set([Math.cos(a) * 60, Math.sin(e) * 40, Math.sin(a) * 60 - 20], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(stars, 3));
    this.root.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: PALETTE.paper, size: 0.25 })));
    const moon = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: PALETTE.paper }));
    moon.position.set(-14, 16, -40);
    moon.lookAt(0, 0, 0);
    this.root.add(moon);
  }

  /** Show the rooftop and take over the camera. */
  attach(renderer: Renderer): void {
    if (this.attachedTo) return;
    this.attachedTo = renderer;
    renderer.scene.add(this.root);
    renderer.setManualCamera((camera, dt) => this.update(camera, dt));
  }

  detach(): void {
    if (!this.attachedTo) return;
    this.attachedTo.setManualCamera(null);
    this.root.removeFromParent();
    this.attachedTo = null;
  }

  setShot(shot: Shot | "orbit"): void {
    this.shot = shot;
    this.shotTime = 0;
  }

  /** The cat silhouette walks across the left window (cutscene, and now and then on the start screen). */
  catCrossing(): void {
    this.catWalk = 0;
  }

  private update(camera: THREE.PerspectiveCamera, dt: number): void {
    this.t += dt;
    this.shotTime += dt;

    // The Queen tilts her head and her crown wobbles.
    this.crow.head.rotation.z = Math.sin(this.t * 0.9) * 0.15;
    this.crow.head.rotation.y = Math.sin(this.t * 0.4) * 0.3;
    this.crow.crown.rotation.z = Math.sin(this.t * 5) * 0.08;
    for (const s of this.smugglers) s.update(dt, { moving: false, sneaking: false, speed: 0 });
    this.lights.forEach((b, i) => b.scale.setScalar(0.8 + 0.25 * Math.sin(this.t * 2 + i)));

    if (this.catWalk >= 0) {
      this.catWalk += dt;
      this.catShadow.visible = true;
      this.catShadow.position.x = -5 + this.catWalk * 0.9;
      if (this.catWalk > 3.4) { this.catWalk = -1; this.catShadow.visible = false; }
    } else if (this.shot === "orbit" && Math.random() < dt / 20) {
      this.catCrossing();
    }

    // Camera shots.
    let pos: THREE.Vector3, look: THREE.Vector3, fov = 40;
    switch (this.shot) {
      case "orbit": {
        const a = this.t * 0.08;
        pos = new THREE.Vector3(Math.sin(a) * 7, 3.2, Math.cos(a) * 7 + 1);
        look = new THREE.Vector3(0, 0.9, 0);
        break;
      }
      case "wide": {
        const k = Math.min(1, this.shotTime / 4);
        pos = new THREE.Vector3(0, 3.5 - k, 10 - k * 3);
        look = new THREE.Vector3(0, 1, -2);
        break;
      }
      case "throne":
        pos = new THREE.Vector3(0.6, 1.9, 2.4);
        look = new THREE.Vector3(0, 1.6, -0.5);
        fov = 32;
        break;
      case "roof":
        pos = new THREE.Vector3(0, 1.4, 4.6);
        look = new THREE.Vector3(0, 0.4, 1.8);
        fov = 34;
        break;
      case "house":
        pos = new THREE.Vector3(-1, 2.2, 4);
        look = new THREE.Vector3(-3.5, 0.5, -12);
        fov = 30;
        break;
      case "drainpipe":
        pos = new THREE.Vector3(6.5, 1, 6);
        look = new THREE.Vector3(4.6, -0.5, 3);
        fov = 38;
        break;
    }
    const ease = 1 - Math.exp(-dt * (this.shot === "orbit" ? 1.5 : 4));
    this.camPos.lerp(pos, ease);
    this.lookAt.lerp(look, ease);
    camera.position.copy(this.camPos);
    camera.lookAt(this.lookAt);
    if (Math.abs(camera.fov - fov) > 0.1) {
      camera.fov += (fov - camera.fov) * ease;
      camera.updateProjectionMatrix();
    }
  }
}
