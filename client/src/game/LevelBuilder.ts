// Turns a level map into meshes: floor, walls, rugs, squeaky boards, exit gaps
// and placeholder furniture (PLAN.md Sections 8 and 11).
//
// Furniture is a plain rounded box in a warm colour for now. Hide spots (T)
// are little tables with visible legs and open space underneath, so players can
// read that they fit. Named furniture builders come in Phase 8.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { type DoorDef, type Grid, type LevelDef, type TileGroup, charAt, surfaceColorAt } from "@snikisnak/shared";
import { PALETTE, RUG_COLORS } from "../render/palette";
import { toon, toonGradient, toonMesh } from "../render/Toon";
import { plankTexture, rugTexture, seeded, squeakTexture, ventTexture } from "../render/textures";

const WALL_HEIGHT = 3;
/** The south wall (nearest the camera) is a low cut-away. */
const SOUTH_WALL_HEIGHT = 0.4;
const HIDE_TOP_HEIGHT = 0.8;

/** Rough heights for the furniture named in level files (placeholder boxes). */
const PROP_HEIGHTS: Record<string, number> = {
  boot_pile: 0.8, basket_side: 0.55, laundry_basket: 1.0, watering_can: 0.9,
  sideboard: 1.6, shoe_cabinet: 1.3, plant_pot: 1.4, sewing_basket: 0.7,
  couch: 2.5, bed_head: 2.2, bed_side: 1.4, washer: 2.2, dryer: 2.2,
};

const FURNITURE_COLORS = [PALETTE.wood, PALETTE.darkWood, PALETTE.plaster, PALETTE.tape];

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
  for (const group of grid.groups) {
    root.add(group.kind === "B" ? buildFurniture(group, level) : buildHideSpot(group));
  }
  const doors = new Map<string, DoorView>();
  for (const d of grid.doors) {
    const view = new DoorView(grid, d);
    doors.set(d.id, view);
    root.add(view.root);
  }
  return { root, width: grid.width, depth: grid.height, doors };
}

function buildFloor(grid: Grid): THREE.Mesh {
  const tex = plankTexture();
  tex.repeat.set(grid.width / 2, grid.height / 2);
  const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient() });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(grid.width, grid.height), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(grid.width / 2, 0, grid.height / 2);
  floor.receiveShadow = true;
  floor.name = "floor";
  return floor;
}

/** All wall tiles merged into one mesh (one draw call). */
function buildWalls(grid: Grid): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (charAt(grid, x, y) !== "#") continue;
      const h = y === grid.height - 1 ? SOUTH_WALL_HEIGHT : WALL_HEIGHT;
      const box = new THREE.BoxGeometry(1, h, 1);
      box.translate(x + 0.5, h / 2, y + 0.5);
      parts.push(box);
    }
  }
  const walls = new THREE.Mesh(mergeGeometries(parts), toon(PALETTE.plaster));
  walls.castShadow = true;
  walls.receiveShadow = true;
  walls.name = "walls";
  return walls;
}

/** Rugs, squeaky boards and exit gaps, drawn just above the floor. */
function buildTileDecals(grid: Grid): THREE.Group {
  const group = new THREE.Group();
  group.name = "decals";
  const squeakMat = new THREE.MeshToonMaterial({
    map: squeakTexture(), gradientMap: toonGradient(), transparent: true,
  });
  const exitMat = new THREE.MeshBasicMaterial({ color: PALETTE.midnight });
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
      } else if (ch === "~") {
        add(squeakMat, x, y, 0.006, 0.96);
      } else if (ch === "E") {
        add(exitMat, x, y, 0.003);
      } else if (ch === "V") {
        add(ventMat, x, y, 0.006, 0.8);
      } else if (ch === "l") {
        group.add(buildLatch(grid, x, y));
      }
    }
  }
  return group;
}

function propName(group: TileGroup, level: LevelDef): string | undefined {
  return level.props[group.key];
}

/** Big furniture: a rounded box per group (or per tile for odd shapes). */
function buildFurniture(group: TileGroup, level: LevelDef): THREE.Group {
  const out = new THREE.Group();
  const name = propName(group, level) ?? "furniture";
  out.name = name;
  const rand = seeded(group.x * 31 + group.y * 17 + 3);
  const height = PROP_HEIGHTS[name] ?? 0.9 + rand() * 0.7;
  const color = FURNITURE_COLORS[Math.floor(rand() * FURNITURE_COLORS.length)];
  const isRectShape = group.tiles.length === group.w * group.h;
  // Odd-shaped groups are built tile by tile with no gaps, so they read as one piece.
  const inset = isRectShape ? 0.08 : 0;

  const isRect = group.tiles.length === group.w * group.h;
  const boxes = isRect ? [{ x: group.x, y: group.y, w: group.w, h: group.h }] : group.tiles.map((t) => ({ x: t.x, y: t.y, w: 1, h: 1 }));
  for (const b of boxes) {
    const geo = new RoundedBoxGeometry(b.w - inset, height, b.h - inset, 3, 0.08);
    const mesh = toonMesh(geo, color);
    mesh.position.set(b.x + b.w / 2, height / 2, b.y + b.h / 2);
    out.add(mesh);
  }
  return out;
}

/** Hide spot: a table top on four legs, with room to crawl underneath. */
function buildHideSpot(group: TileGroup): THREE.Group {
  const out = new THREE.Group();
  out.name = "hide-spot";
  const isRect = group.tiles.length === group.w * group.h;
  const boxes = isRect ? [{ x: group.x, y: group.y, w: group.w, h: group.h }] : group.tiles.map((t) => ({ x: t.x, y: t.y, w: 1, h: 1 }));
  const color = PALETTE.darkWood;
  for (const b of boxes) {
    const cx = b.x + b.w / 2, cz = b.y + b.h / 2;
    const top = toonMesh(new RoundedBoxGeometry(b.w - 0.06, 0.12, b.h - 0.06, 2, 0.04), color);
    top.position.set(cx, HIDE_TOP_HEIGHT, cz);
    out.add(top);
    const legGeo = new THREE.CylinderGeometry(0.045, 0.045, HIDE_TOP_HEIGHT, 8);
    const lx = b.w / 2 - 0.12, lz = b.h / 2 - 0.12;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = toonMesh(legGeo, color);
      leg.position.set(cx + sx * lx, HIDE_TOP_HEIGHT / 2, cz + sz * lz);
      out.add(leg);
    }
  }
  return out;
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
