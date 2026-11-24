// Set dressing that doesn't affect play: things on the walls (shelves, a
// window, a chalkboard, aprons on hooks) and small touches on the floor (Sir
// Crumbs's cushion). It never covers a walkable tile with anything that looks
// solid, so what you see still matches where you can walk.

import * as THREE from "three";
import type { Grid, LevelDef } from "@snikisnak/shared";
import {
  breadMaterial, ginghamMaterial, glowMaterial, metalMaterial, plainMaterial, woodMaterial,
} from "../render/materials";

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

const glass = (color: number): THREE.MeshPhysicalMaterial =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.1, transmission: 0.6, thickness: 0.2, transparent: true, opacity: 0.85 });

/** A wall shelf along the north wall's inside face, with things on it. */
function shelf(x0: number, x1: number, y: number, z: number, items: (x: number) => THREE.Object3D | null): THREE.Group {
  const g = new THREE.Group();
  const w = x1 - x0;
  g.add(mesh(new THREE.BoxGeometry(w, 0.06, 0.32), woodMaterial("walnut"), x0 + w / 2, y, z + 0.16));
  for (const bx of [x0 + 0.2, x1 - 0.2]) {
    const bracket = mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), metalMaterial(), bx, y - 0.13, z + 0.1);
    g.add(bracket);
  }
  for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.42) {
    const item = items(x);
    if (item) { item.position.x = x; item.position.y += y + 0.03; item.position.z += z + 0.16; g.add(item); }
  }
  return g;
}

function jar(color: number, h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, h, 16), glass(color), 0, h / 2, 0, false));
  g.add(mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.05, 16), plainMaterial(0xc8843f, 0.5), 0, h + 0.02, 0));
  // Something inside: jam, honey, sugar.
  g.add(mesh(new THREE.CylinderGeometry(0.095, 0.095, h * 0.7, 14), plainMaterial(color, 0.6), 0, h * 0.36, 0, false));
  return g;
}

function canister(label: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.34, 18), plainMaterial(0xefe6d2, 0.45), 0, 0.17, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.04, 18), metalMaterial(), 0, 0.36, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.132, 0.132, 0.08, 18, 1, true), plainMaterial(label, 0.6), 0, 0.17, 0, false));
  return g;
}

function loaf(): THREE.Mesh {
  const m = mesh(new THREE.SphereGeometry(1, 16, 10).scale(0.18, 0.09, 0.11), breadMaterial());
  m.position.y = 0.08;
  return m;
}

/** A moonlit window in the north wall, with gingham curtains. */
function windowOnNorth(cx: number, width: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const y0 = 1.35, h = 1.3;
  const pane = mesh(new THREE.PlaneGeometry(width, h), glowMaterial(0x6f86c9), cx, y0 + h / 2, z + 0.005, false);
  g.add(pane);
  // Stars and a slice of moon behind the glass.
  const moon = mesh(new THREE.CircleGeometry(0.16, 20), glowMaterial(0xf3e7cf), cx + width * 0.25, y0 + h * 0.72, z + 0.01, false);
  g.add(moon);
  const frame = woodMaterial("painted");
  const bar = (w: number, hh: number, x: number, y: number): void => { g.add(mesh(new THREE.BoxGeometry(w, hh, 0.08), frame, x, y, z + 0.04)); };
  bar(width + 0.16, 0.08, cx, y0);
  bar(width + 0.16, 0.08, cx, y0 + h);
  bar(0.08, h, cx - width / 2, y0 + h / 2);
  bar(0.08, h, cx + width / 2, y0 + h / 2);
  bar(0.05, h, cx, y0 + h / 2);
  bar(width, 0.05, cx, y0 + h / 2);
  g.add(mesh(new THREE.BoxGeometry(width + 0.3, 0.06, 0.22), frame, cx, y0 - 0.04, z + 0.1)); // sill
  for (const side of [-1, 1]) {
    const curtain = mesh(new THREE.PlaneGeometry(0.42, h + 0.25, 6, 1), ginghamMaterial(), cx + side * (width / 2 + 0.12), y0 + h / 2 + 0.05, z + 0.12, false);
    // Gentle folds.
    const pos = curtain.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 22) * 0.025);
    curtain.geometry.computeVertexNormals();
    (curtain.material as THREE.Material).side = THREE.DoubleSide;
    g.add(curtain);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, width + 1.2, 6), metalMaterial(), cx, y0 + h + 0.2, z + 0.13));
  (g.children.at(-1) as THREE.Mesh).rotation.z = Math.PI / 2;
  return g;
}

/** A chalkboard menu on the wall. */
function chalkboard(cx: number, z: number): THREE.Group {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 192;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#26302a";
  ctx.fillRect(0, 0, 256, 192);
  ctx.fillStyle = "rgba(243,231,207,0.9)";
  ctx.textAlign = "center";
  ctx.font = "34px 'Caveat Brush', cursive";
  ctx.fillText("Today's bakes", 128, 44);
  ctx.font = "24px 'Caveat Brush', cursive";
  ctx.fillText("croissants .... sold out", 128, 92);
  ctx.fillText("honey buns ....... 2c", 128, 126);
  ctx.fillText("NO CATS IN THE FLOUR", 128, 168);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.5, 1.1, 0.06), woodMaterial("walnut"), cx, 1.95, z + 0.03));
  g.add(mesh(new THREE.PlaneGeometry(1.36, 0.96), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), cx, 1.95, z + 0.065, false));
  return g;
}

/** Aprons and a baker's hat hanging on the west wall. */
function apronHooks(x: number, z0: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.06, 0.08, 1.4), woodMaterial("walnut"), x + 0.03, 1.95, z0 + 0.7));
  const apron = new THREE.MeshStandardMaterial({ color: 0xf3e7cf, roughness: 0.95, side: THREE.DoubleSide });
  for (const [dz, color] of [[0.35, 0xf3e7cf], [0.95, 0xd9534f]] as const) {
    const m = color === 0xf3e7cf ? apron : new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide });
    const a = mesh(new THREE.PlaneGeometry(0.4, 0.7), m, x + 0.05, 1.55, z0 + dz);
    a.rotation.y = Math.PI / 2;
    g.add(a);
  }
  // The baker's hat.
  const hat = new THREE.Group();
  hat.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16), plainMaterial(0xf8f4ea, 0.9), 0, 0, 0));
  hat.add(mesh(new THREE.SphereGeometry(0.17, 14, 10).scale(1, 0.7, 1), plainMaterial(0xf8f4ea, 0.9), 0, 0.1, 0));
  hat.position.set(x + 0.17, 2.1, z0 + 1.25);
  g.add(hat);
  return g;
}

/** The bakery's back room (Level 1). */
function mudroom(grid: Grid): THREE.Group {
  const g = new THREE.Group();
  const north = 1; // inside face of the north wall
  g.add(shelf(2, 8, 1.55, north, (x) => {
    const k = Math.round(x * 10) % 4;
    return k === 0 ? jar(0xd9534f, 0.24) : k === 1 ? canister(0xd9534f) : k === 2 ? jar(0xf2c14e, 0.3) : canister(0x4a6fd1);
  }));
  g.add(shelf(2, 8, 2.25, north, (x) => (Math.round(x * 10) % 3 === 0 ? null : loaf())));
  g.add(chalkboard(10.2, north));
  g.add(windowOnNorth(14.5, 1.9, north));
  g.add(apronHooks(1, 4));
  // Sir Crumbs's gingham cushion, between the wicker sides of his bed.
  if (grid.catStart) {
    const cushion = mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.1, 28), ginghamMaterial(), grid.catStart.x + 0.6, 0.05, grid.catStart.y + 0.5);
    cushion.scale.set(1, 1, 1.55);
    g.add(cushion);
  }
  return g;
}

const DECOR: Record<string, (grid: Grid) => THREE.Group> = { mudroom };

export function buildDecor(level: LevelDef, grid: Grid): THREE.Group {
  const g = DECOR[level.key]?.(grid) ?? new THREE.Group();
  g.name = "decor";
  return g;
}
