// Turns a level map into meshes: an oak plank floor, tiled-and-plastered walls
// with dark cut-away tops, loose squeaky planks, the way out (a door with a
// glowing cat flap and a doormat arrow), rugs, vents, latches and the
// furniture (game/Furniture.ts). Everything that blocks you looks solid; hide
// spots are tables with open, shadowed space underneath.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { type DoorDef, type Grid, type LevelDef, type TileGroup, charAt, surfaceColorAt } from "@snikisnak/shared";
import { PALETTE, RUG_COLORS } from "../render/palette";
import { toon, toonGradient, toonMesh } from "../render/Toon";
import { rugTexture, ventTexture } from "../render/textures";
import {
  floorMaterial, glowMaterial, metalMaterial, plainMaterial, plasterMaterial, tileWallMaterial, wallCapMaterial,
  woodMaterial,
} from "../render/materials";
import { buildFurniturePiece } from "./Furniture";
import { buildDecor } from "./Decor";

const WALL_HEIGHT = 3;
/** The south wall (nearest the camera) is a low cut-away. */
const SOUTH_WALL_HEIGHT = 0.4;
/** Subway tiles up to here, then plaster, with a wooden rail between. */
const TILE_HEIGHT = 1.1;

export interface BuiltLevel {
  root: THREE.Group;
  width: number;
  depth: number;
  doors: Map<string, DoorView>;
}

export function buildLevel(level: LevelDef, grid: Grid): BuiltLevel {
  const root = new THREE.Group();
  root.name = `level-${level.key}`;
  root.add(buildFloor(grid));
  root.add(buildWalls(grid));
  root.add(buildTileDecals(grid));
  root.add(buildSqueakyPlanks(grid));
  root.add(buildExits(grid));
  for (const group of grid.groups) root.add(buildGroup(group, level));
  root.add(buildDecor(level, grid));
  const doors = new Map<string, DoorView>();
  for (const d of grid.doors) {
    const view = new DoorView(grid, d);
    doors.set(d.id, view);
    root.add(view.root);
  }
  return { root, width: grid.width, depth: grid.height, doors };
}

function buildFloor(grid: Grid): THREE.Mesh {
  const mat = floorMaterial(grid.width, grid.height);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(grid.width, grid.height), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(grid.width / 2, 0, grid.height / 2);
  floor.receiveShadow = true;
  floor.name = "floor";
  return floor;
}

/**
 * Walls: tiles below, plaster above, a wooden rail between, and a dark cap on
 * top (the "cut-away" diorama look). Each material is one merged mesh.
 */
function buildWalls(grid: Grid): THREE.Group {
  const lower: THREE.BufferGeometry[] = [], upper: THREE.BufferGeometry[] = [];
  const rails: THREE.BufferGeometry[] = [], caps: THREE.BufferGeometry[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (charAt(grid, x, y) !== "#") continue;
      const h = y === grid.height - 1 ? SOUTH_WALL_HEIGHT : WALL_HEIGHT;
      const lowH = Math.min(h, TILE_HEIGHT);
      const lo = new THREE.BoxGeometry(1, lowH, 1);
      lo.translate(x + 0.5, lowH / 2, y + 0.5);
      lower.push(lo);
      if (h > TILE_HEIGHT) {
        const up = new THREE.BoxGeometry(1, h - TILE_HEIGHT, 1);
        up.translate(x + 0.5, TILE_HEIGHT + (h - TILE_HEIGHT) / 2, y + 0.5);
        upper.push(up);
        const rail = new THREE.BoxGeometry(1.03, 0.07, 1.03);
        rail.translate(x + 0.5, TILE_HEIGHT, y + 0.5);
        rails.push(rail);
      }
      const cap = new THREE.BoxGeometry(1.0, 0.03, 1.0);
      cap.translate(x + 0.5, h + 0.015, y + 0.5);
      caps.push(cap);
    }
  }
  const g = new THREE.Group();
  g.name = "walls";
  const add = (parts: THREE.BufferGeometry[], mat: THREE.Material, shadows = true): void => {
    if (!parts.length) return;
    const m = new THREE.Mesh(mergeGeometries(parts), mat);
    m.castShadow = shadows;
    m.receiveShadow = true;
    g.add(m);
  };
  add(lower, tileWallMaterial());
  add(upper, plasterMaterial());
  add(rails, woodMaterial("walnut"));
  add(caps, wallCapMaterial(), false);
  return g;
}

/** Rugs, vents and latches. */
function buildTileDecals(grid: Grid): THREE.Group {
  const group = new THREE.Group();
  group.name = "decals";
  const ventMat = new THREE.MeshToonMaterial({ map: ventTexture(), gradientMap: toonGradient(), transparent: true });
  const rugMats = new Map<string, THREE.Material>();
  const tile = new THREE.PlaneGeometry(1, 1);

  const add = (mat: THREE.Material, x: number, y: number, lift: number, size = 1): void => {
    const m = new THREE.Mesh(tile, mat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(size, size, 1);
    m.position.set(x + 0.5, lift, y + 0.5);
    m.receiveShadow = true;
    group.add(m);
  };

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const ch = charAt(grid, x, y);
      const rug = surfaceColorAt(grid, x, y);
      if (rug) {
        let mat = rugMats.get(rug);
        if (!mat) {
          mat = new THREE.MeshToonMaterial({ map: rugTexture(RUG_COLORS[rug]), gradientMap: toonGradient() });
          rugMats.set(rug, mat);
        }
        add(mat, x, y, 0.004);
      } else if (ch === "V") {
        add(ventMat, x, y, 0.006, 0.8);
      } else if (ch === "l") {
        group.add(buildLatch(grid, x, y));
      }
    }
  }
  return group;
}

/** Furniture for a B or T group, from its name in the level's props. */
function buildGroup(group: TileGroup, level: LevelDef): THREE.Group {
  const name = level.props[group.key];
  const hide = group.kind === "T";
  const isRect = group.tiles.length === group.w * group.h;
  if (isRect) return buildFurniturePiece(name, { x: group.x, y: group.y, w: group.w, h: group.h }, hide);
  // Odd shapes (Level 3's island, Level 7's bed frame): tile by tile, no gaps.
  const out = new THREE.Group();
  out.name = name ?? "furniture";
  for (const t of group.tiles) out.add(buildFurniturePiece(undefined, { x: t.x, y: t.y, w: 1, h: 1 }, hide));
  return out;
}

/**
 * Squeaky floorboards (~): pale, loose planks that sit a little proud of the
 * floor, with dark gaps and nail heads, so you can spot them from anywhere.
 */
function buildSqueakyPlanks(grid: Grid): THREE.Group {
  const g = new THREE.Group();
  g.name = "squeaky-boards";
  const plank = new THREE.BoxGeometry(0.97, 0.035, 0.225);
  const pale = woodMaterial("pine");
  const gap = new THREE.PlaneGeometry(1, 1);
  const gapMat = plainMaterial(0x1a110b, 1);
  const nail = new THREE.CylinderGeometry(0.018, 0.018, 0.01, 6);
  const nailMat = metalMaterial();
  let k = 0;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (charAt(grid, x, y) !== "~") continue;
      const under = new THREE.Mesh(gap, gapMat);
      under.rotation.x = -Math.PI / 2;
      under.position.set(x + 0.5, 0.003, y + 0.5);
      g.add(under);
      for (let i = 0; i < 4; i++) {
        const m = new THREE.Mesh(plank, pale);
        const lift = 0.02 + ((k + i) % 3) * 0.008;
        m.position.set(x + 0.5, lift, y + 0.125 + i * 0.25);
        m.rotation.set(((k * 7 + i * 3) % 5 - 2) * 0.02, 0, ((k + i) % 2 ? 1 : -1) * 0.03);
        m.receiveShadow = true;
        m.castShadow = true;
        g.add(m);
        for (const sx of [-0.42, 0.42]) {
          const n = new THREE.Mesh(nail, nailMat);
          n.position.set(x + 0.5 + sx, lift + 0.02, y + 0.125 + i * 0.25);
          g.add(n);
        }
      }
      k++;
    }
  }
  return g;
}

/**
 * The way out: for each run of E tiles on the outer wall, a door frame with a
 * glowing cat flap, warm light spilling across the floor, and a doormat with
 * an arrow pointing out.
 */
function buildExits(grid: Grid): THREE.Group {
  const g = new THREE.Group();
  g.name = "exits";
  const seen = new Set<string>();
  for (const e of grid.exits) {
    if (seen.has(`${e.x},${e.y}`)) continue;
    // Collect this run of E tiles along the border.
    const run = grid.exits.filter((o) => (o.x === e.x && Math.abs(o.y - e.y) <= 2) || (o.y === e.y && Math.abs(o.x - e.x) <= 2));
    for (const o of run) seen.add(`${o.x},${o.y}`);
    const vertical = run.every((o) => o.x === e.x);
    const minX = Math.min(...run.map((o) => o.x)), maxX = Math.max(...run.map((o) => o.x)) + 1;
    const minY = Math.min(...run.map((o) => o.y)), maxY = Math.max(...run.map((o) => o.y)) + 1;
    const cx = (minX + maxX) / 2, cz = (minY + maxY) / 2;
    // Which way is "out": toward the nearest edge of the map.
    let out = new THREE.Vector2(0, 0);
    if (vertical) out = new THREE.Vector2(e.x === 0 ? -1 : 1, 0);
    else out = new THREE.Vector2(0, e.y === 0 ? -1 : 1);
    const len = vertical ? maxY - minY : maxX - minX;

    const exit = new THREE.Group();
    exit.position.set(cx, 0, cz);
    exit.rotation.y = Math.atan2(out.x, out.y); // local +Z points out of the room
    // Door frame and the outside door, with the cat flap opening glowing warm.
    const wood = woodMaterial("walnut");
    const frameH = e.y === grid.height - 1 ? SOUTH_WALL_HEIGHT : 2.6;
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, frameH, 0.3), wood);
      post.position.set(side * (len / 2 + 0.02), frameH / 2, 0.3);
      post.castShadow = true;
      exit.add(post);
    }
    if (frameH > 1) {
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(len + 0.2, 0.14, 0.3), wood);
      lintel.position.set(0, frameH, 0.3);
      exit.add(lintel);
      const door = new THREE.Mesh(new THREE.BoxGeometry(len, frameH - 0.62, 0.08), woodMaterial("painted"));
      door.position.set(0, 0.62 + (frameH - 0.62) / 2, 0.45);
      door.castShadow = true;
      exit.add(door);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), metalMaterial());
      knob.position.set(len * 0.35, 1.2, 0.38);
      exit.add(knob);
    }
    // The opening itself: a warm glow, like a light left on outside.
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.92, 0.6), glowMaterial(0xffc27a));
    glow.position.set(0, 0.3, 0.49);
    glow.rotation.y = Math.PI;
    exit.add(glow);
    const flapLight = new THREE.PointLight(0xffb66b, 3, 3.5, 1.5);
    flapLight.position.set(0, 0.4, 0.2);
    exit.add(flapLight);
    // Light spilling onto the floor.
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(len + 0.6, 2.2), new THREE.MeshBasicMaterial({
      color: 0xffb66b, map: spillTexture(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(0, 0.008, -0.6);
    spill.renderOrder = 1;
    exit.add(spill);
    // A doormat just inside, with a gold arrow pointing out.
    // On the exit tiles themselves, so it never covers a squeaky board.
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.95, 0.9), new THREE.MeshStandardMaterial({ map: doormatTexture(), roughness: 1 }));
    mat.rotation.set(-Math.PI / 2, 0, Math.PI); // the arrow (texture "up") points out of the room
    mat.position.set(0, 0.012, -0.05);
    mat.receiveShadow = true;
    exit.add(mat);
    g.add(exit);
  }
  return g;
}

let spillTex: THREE.CanvasTexture | null = null;
function spillTexture(): THREE.CanvasTexture {
  if (!spillTex) {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 128, 0, 0);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 128);
    spillTex = new THREE.CanvasTexture(c);
  }
  return spillTex;
}

let matTex: THREE.CanvasTexture | null = null;
function doormatTexture(): THREE.CanvasTexture {
  if (!matTex) {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#7a5432";
    g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = Math.random() < 0.5 ? "rgba(40,25,10,0.25)" : "rgba(200,160,110,0.2)";
      g.fillRect(Math.random() * 256, Math.random() * 128, 2, 2);
    }
    g.strokeStyle = "#3b2516";
    g.lineWidth = 6;
    g.strokeRect(8, 8, 240, 112);
    // Arrow pointing toward the door (up in texture space = out of the room).
    g.fillStyle = "#e8b923";
    g.beginPath();
    g.moveTo(128, 18); g.lineTo(168, 62); g.lineTo(144, 62); g.lineTo(144, 108);
    g.lineTo(112, 108); g.lineTo(112, 62); g.lineTo(88, 62); g.closePath();
    g.fill();
    matTex = new THREE.CanvasTexture(c);
    matTex.colorSpace = THREE.SRGBColorSpace;
  }
  return matTex;
}

const DOOR_HEIGHT = 2.4;
const DOOR_THICK = 0.14;
/** How fast a door swings open (fraction per second). */
const DOOR_SWING = 2.5;

/**
 * A locked door: one wooden panel across its D tiles, hinged at one end. It
 * swings open when the server says so, and stays open.
 */
export class DoorView {
  readonly root = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private openness = 0;
  private target = 0;
  /** Centre of the door, for the lock-pick ring. */
  readonly centre: THREE.Vector3;

  constructor(grid: Grid, door: DoorDef) {
    const xs = door.tiles.map((t) => t.x), ys = door.tiles.map((t) => t.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs) + 1, minY = Math.min(...ys), maxY = Math.max(...ys) + 1;
    // If the wall runs north-south (walls above and below), the panel spans Z.
    const first = door.tiles[0];
    const spansZ = charAt(grid, first.x, minY - 1) === "#" || charAt(grid, first.x, maxY) === "#";
    const length = spansZ ? maxY - minY : maxX - minX;
    const geo = new RoundedBoxGeometry(spansZ ? DOOR_THICK : length - 0.04, DOOR_HEIGHT, spansZ ? length - 0.04 : DOOR_THICK, 2, 0.03);
    const panel = toonMesh(geo, PALETTE.darkWood);
    // Hinge at the low end; the panel hangs off it.
    if (spansZ) {
      this.pivot.position.set((minX + maxX) / 2, 0, minY);
      panel.position.set(0, DOOR_HEIGHT / 2, length / 2);
    } else {
      this.pivot.position.set(minX, 0, (minY + maxY) / 2);
      panel.position.set(length / 2, DOOR_HEIGHT / 2, 0);
    }
    const knob = toonMesh(new THREE.SphereGeometry(0.06, 10, 8), PALETTE.gold);
    knob.position.set(spansZ ? DOOR_THICK : length * 0.4, -0.25, spansZ ? length * 0.4 : DOOR_THICK);
    panel.add(knob);
    this.pivot.add(panel);
    this.root.add(this.pivot);
    this.root.name = door.id;
    this.centre = new THREE.Vector3((minX + maxX) / 2, DOOR_HEIGHT + 0.3, (minY + maxY) / 2);
  }

  setOpen(open: boolean): void {
    this.target = open ? 1 : 0;
  }

  update(dt: number): void {
    if (this.openness === this.target) return;
    const step = DOOR_SWING * dt;
    this.openness = this.target > this.openness ? Math.min(this.target, this.openness + step) : Math.max(this.target, this.openness - step);
    // Ease out, swinging 100° away from the camera.
    const k = 1 - (1 - this.openness) * (1 - this.openness);
    this.pivot.rotation.y = -k * (100 * Math.PI) / 180;
  }
}

/** A small gold hook on the latch tile, on the side next to its door. */
function buildLatch(grid: Grid, x: number, y: number): THREE.Group {
  const g = new THREE.Group();
  const hook = toonMesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12, Math.PI * 1.4), PALETTE.gold);
  const post = toonMesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), PALETTE.gold);
  post.position.y = 0.15;
  hook.position.y = 0.32;
  g.add(post, hook);
  let dx = 0, dz = 0;
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (charAt(grid, x + ax, y + az) === "D") { dx = ax; dz = az; }
  }
  g.position.set(x + 0.5 + dx * 0.38, 0, y + 0.5 + dz * 0.38);
  return g;
}
