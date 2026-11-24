// Furniture builders (PLAN.md Section 11: "each name in a level's props maps to
// a builder function"). Each builder fills its tile rectangle exactly, so what
// you see is what blocks you: big furniture (B) is solid all the way down, and
// hide spots (T) always have visible legs and open, shadowed space underneath.
//
// Level 1 is the bakery's back room: flour sacks (with the boots on top), the
// baker's bench, Sir Crumbs's wicker bed, bread crates, a little table and
// milk churns. Names without a builder get a wooden crate (B) or table (T).

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  breadMaterial, burlapMaterial, contactShadowMaterial, flourMaterial, ginghamMaterial, metalMaterial,
  plainMaterial, rubberMaterial, wickerMaterial, woodMaterial,
} from "../render/materials";
import { seeded } from "../render/textures";

export interface Rect { x: number; y: number; w: number; h: number; }

type Builder = (r: Rect, rand: () => number) => THREE.Group;

/** Hide spots are tables with this much open space under the top. */
export const HIDE_TOP = 0.78;

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A soft dark patch on the floor under a piece of furniture. */
function contact(w: number, d: number, strength = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), contactShadowMaterial());
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.renderOrder = 1;
  m.scale.setScalar(strength);
  return m;
}

function ellipsoid(rx: number, ry: number, rz: number, seg = 20): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)).scale(rx, ry, rz);
}

/** A slumped burlap sack lying on its side. */
function sack(len: number, rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new RoundedBoxGeometry(len, 0.38, 0.56, 4, 0.17), burlapMaterial());
  // Slump: squash the top a little and bulge the sides.
  const pos = body.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), x = pos.getX(i);
    const bulge = 1 + 0.12 * Math.cos((x / len) * Math.PI);
    pos.setZ(i, pos.getZ(i) * bulge);
    if (y > 0) pos.setY(i, y * (0.85 + 0.15 * Math.cos((x / len) * Math.PI)));
  }
  body.geometry.computeVertexNormals();
  body.position.y = 0.19;
  const tie = mesh(new THREE.ConeGeometry(0.12, 0.22, 10), burlapMaterial(), len / 2 + 0.06, 0.2, 0);
  tie.rotation.z = -Math.PI / 2;
  g.add(body, tie);
  g.rotation.y = (rand() - 0.5) * 0.25;
  return g;
}

function boot(color: number): THREE.Group {
  const g = new THREE.Group();
  const mat = rubberMaterial(color);
  g.add(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.42, 14), mat, 0, 0.21, 0));
  const foot = mesh(new RoundedBoxGeometry(0.2, 0.1, 0.32, 3, 0.04), mat, 0, 0.05, 0.08);
  g.add(foot);
  return g;
}

function loaf(len: number): THREE.Mesh {
  const m = mesh(ellipsoid(len / 2, 0.08, 0.1), breadMaterial());
  m.position.y = 0.07;
  return m;
}

function baguette(len: number): THREE.Mesh {
  return mesh(new THREE.CapsuleGeometry(0.045, len, 4, 10), breadMaterial());
}

/** A table or bench top on four legs, with a cross bar at the back only. */
function tableFrame(r: Rect, top: number, wood: THREE.Material, thick = 0.09): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(r.w - 0.04, thick, r.h - 0.04, 3, 0.03), wood, 0, top, 0));
  const legGeo = new THREE.CylinderGeometry(0.045, 0.035, top, 10);
  const lx = r.w / 2 - 0.13, lz = r.h / 2 - 0.13;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(mesh(legGeo, wood, sx * lx, top / 2, sz * lz));
  // Back stretcher only, so the open front clearly says "crawl under here".
  g.add(mesh(new THREE.BoxGeometry(r.w - 0.3, 0.05, 0.05), wood, 0, top * 0.35, -lz));
  return g;
}

// ---------------------------------------------------------------------------

const BUILDERS: Record<string, Builder> = {
  /** Level 1 "boot_pile": flour sacks stacked up, a pair of boots on top. */
  boot_pile: (r, rand) => {
    const g = new THREE.Group();
    const s1 = sack(r.w * 0.85, rand); s1.position.set(0, 0, -r.h * 0.22);
    const s2 = sack(r.w * 0.85, rand); s2.position.set(0, 0, r.h * 0.22);
    const s3 = sack(r.w * 0.7, rand); s3.position.set(0.05, 0.34, 0);
    s3.rotation.y += 0.4;
    g.add(s1, s2, s3);
    const b1 = boot(0x3d4a3a); b1.position.set(-0.2, 0.62, -0.05); b1.rotation.y = 0.3;
    const b2 = boot(0x3d4a3a); b2.position.set(0.12, 0.6, 0.1); b2.rotation.set(0, -0.2, 1.3);
    g.add(b1, b2);
    // Spilt flour.
    const dust = new THREE.Mesh(new THREE.CircleGeometry(r.w * 0.4, 24), new THREE.MeshBasicMaterial({ color: 0xf6f0e4, transparent: true, opacity: 0.16, depthWrite: false }));
    dust.rotation.x = -Math.PI / 2;
    dust.position.set(0.35, 0.006, 0.45);
    g.add(contact(r.w * 1.15, r.h * 1.15), dust);
    return g;
  },

  /** Level 1 "shoe_bench" (hide spot): the baker's bench with bread on top. */
  shoe_bench: (r) => {
    const g = tableFrame(r, HIDE_TOP, woodMaterial("oak"), 0.11);
    const board = mesh(new RoundedBoxGeometry(r.w * 0.45, 0.04, r.h * 0.6, 2, 0.015), woodMaterial("pine"), -r.w * 0.15, HIDE_TOP + 0.08, 0);
    g.add(board);
    for (let i = 0; i < 3; i++) {
      const l = loaf(0.45);
      l.position.set(-r.w * 0.28 + i * 0.22, HIDE_TOP + 0.1, (i - 1) * 0.18);
      l.rotation.y = 0.3 + i * 0.4;
      g.add(l);
    }
    const pin = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 12), woodMaterial("pine"), r.w * 0.22, HIDE_TOP + 0.11, 0);
    pin.rotation.z = Math.PI / 2;
    pin.rotation.y = 0.5;
    g.add(pin);
    g.add(contact(r.w * 1.05, r.h * 1.05, 1));
    return g;
  },

  /** Level 1 "basket_side": one wicker side of Sir Crumbs's bed. */
  basket_side: (r) => {
    const g = new THREE.Group();
    const wall = mesh(new RoundedBoxGeometry(r.w - 0.06, 0.5, r.h - 0.06, 4, 0.2), wickerMaterial(), 0, 0.25, 0);
    const rim = mesh(new THREE.TorusGeometry(0.38, 0.06, 8, 24), wickerMaterial(), 0, 0.5, 0);
    rim.rotation.x = Math.PI / 2;
    g.add(wall, rim, contact(r.w * 1.2, r.h * 1.2));
    return g;
  },

  /** Level 1 "laundry_basket": stacked bread crates with baguettes. */
  laundry_basket: (r) => {
    const g = new THREE.Group();
    const crate = (w: number, d: number, h: number, y: number): THREE.Group => {
      const c = new THREE.Group();
      const wood = woodMaterial("pine");
      for (const sx of [-1, 1]) c.add(mesh(new THREE.BoxGeometry(0.05, h, d), wood, sx * (w / 2 - 0.025), y + h / 2, 0));
      for (const sz of [-1, 1]) {
        for (let k = 0; k < 3; k++) c.add(mesh(new THREE.BoxGeometry(w, h * 0.22, 0.04), wood, 0, y + h * (0.15 + k * 0.33), sz * (d / 2 - 0.02)));
      }
      c.add(mesh(new THREE.BoxGeometry(w - 0.06, 0.04, d - 0.06), wood, 0, y + 0.03, 0));
      return c;
    };
    g.add(crate(r.w - 0.1, r.h - 0.1, 0.5, 0));
    g.add(crate(r.w - 0.3, r.h - 0.4, 0.42, 0.5));
    for (let i = 0; i < 5; i++) {
      const b = baguette(0.7);
      b.position.set(-0.3 + i * 0.15, 1.05, (i % 2 ? 0.1 : -0.1));
      b.rotation.set(0.35 * (i % 2 ? 1 : -1), 0, 0.25 - i * 0.12);
      g.add(b);
    }
    g.add(contact(r.w * 1.1, r.h * 1.1));
    return g;
  },

  /** Level 1 "stool" (hide spot): a little table with a basket of buns. */
  stool: (r) => {
    const g = tableFrame(r, HIDE_TOP, woodMaterial("walnut"));
    const runner = mesh(new THREE.BoxGeometry(r.w * 0.9, 0.012, r.h * 0.35), ginghamMaterial(), 0, HIDE_TOP + 0.05, 0);
    g.add(runner);
    const basket = mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.18, 18, 1, true), wickerMaterial(), 0, HIDE_TOP + 0.14, 0);
    g.add(basket);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(mesh(ellipsoid(0.1, 0.08, 0.1, 12), breadMaterial(), Math.cos(a) * 0.15, HIDE_TOP + 0.22, Math.sin(a) * 0.15));
    }
    g.add(contact(r.w * 1.05, r.h * 1.05));
    return g;
  },

  /** Level 1 "watering_can": two metal milk churns. */
  watering_can: (r) => {
    const g = new THREE.Group();
    const profile = [
      [0.0, 0], [0.24, 0], [0.26, 0.04], [0.26, 0.5], [0.2, 0.62], [0.12, 0.7], [0.12, 0.8], [0.15, 0.82], [0.15, 0.86], [0, 0.86],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.LatheGeometry(profile, 24);
    for (const sx of [-1, 1]) {
      const churn = mesh(geo, metalMaterial(), sx * r.w * 0.24, 0, 0);
      const handle = mesh(new THREE.TorusGeometry(0.1, 0.018, 6, 14, Math.PI), metalMaterial(), sx * r.w * 0.24, 0.62, 0);
      g.add(churn, handle);
    }
    g.add(contact(r.w * 1.1, r.h * 1.3));
    return g;
  },
};

/** Big furniture nobody has drawn yet: a sturdy wooden crate. */
const fallbackSolid: Builder = (r, rand) => {
  const g = new THREE.Group();
  const h = 0.8 + rand() * 0.5;
  g.add(mesh(new RoundedBoxGeometry(r.w - 0.06, h, r.h - 0.06, 3, 0.04), woodMaterial(rand() < 0.5 ? "oak" : "walnut"), 0, h / 2, 0));
  g.add(mesh(new THREE.BoxGeometry(r.w - 0.02, 0.06, r.h - 0.02), woodMaterial("walnut"), 0, h - 0.03, 0));
  g.add(contact(r.w * 1.1, r.h * 1.1));
  return g;
};

/** A hide spot nobody has drawn yet: a plain table. */
const fallbackHide: Builder = (r) => {
  const g = tableFrame(r, HIDE_TOP, woodMaterial("oak"));
  g.add(contact(r.w * 1.05, r.h * 1.05));
  return g;
};

/** Build a piece of furniture centred on its tile rectangle. */
export function buildFurniturePiece(name: string | undefined, r: Rect, hide: boolean): THREE.Group {
  const rand = seeded(r.x * 31 + r.y * 17 + 3);
  const builder = (name && BUILDERS[name]) || (hide ? fallbackHide : fallbackSolid);
  const g = builder(r, rand);
  g.position.set(r.x + r.w / 2, 0, r.y + r.h / 2);
  g.name = name ?? (hide ? "hide-spot" : "furniture");
  return g;
}

