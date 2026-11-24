// Lights for a level (PLAN.md Section 11, "Shading and lighting" and "Effects").
//
// - a hemisphere light and the moon (one directional light with soft shadows),
// - a point light for each lamp or moon pool in the level file, plus a pool
//   decal on the floor (an additive plane with a radial gradient),
// - soft moon shafts (additive cones at 8% opacity) over each moon pool,
// - about 200 dust motes, visible only inside the light pools,
// - lights out: lamps flicker and fade to 0, ambient drops to 0.35 (Phase 6 uses it).
//
// Section 11 gives the hemisphere intensity as 0.6. Current Three.js uses
// physical light units, where that reads almost black with toon materials, so
// the intensities here are scaled up to give the same mood.

import * as THREE from "three";
import type { LightDef } from "@snikisnak/shared";
import { PALETTE } from "./palette";

const HEMI_INTENSITY = 2.2;
const MOON_INTENSITY = 1.8;
const LAMP_INTENSITY = 9;
const MOON_POOL_INTENSITY = 4;
const DUST_COUNT = 200;

let poolTexture: THREE.CanvasTexture | null = null;

function poolTex(): THREE.CanvasTexture {
  if (!poolTexture) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.4)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    poolTexture = new THREE.CanvasTexture(c);
  }
  return poolTexture;
}

export class LightRig {
  readonly root = new THREE.Group();
  private readonly hemi: THREE.HemisphereLight;
  private readonly moon: THREE.DirectionalLight;
  private readonly lamps: Array<{ light: THREE.PointLight; pool: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; base: number }> = [];
  private readonly dust: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly dustHome: Float32Array;
  private t = 0;
  private dark = 0;
  private darkTarget = 0;

  constructor(private readonly lights: readonly LightDef[], width: number, depth: number) {
    this.root.name = "lights";
    this.hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, HEMI_INTENSITY);
    this.root.add(this.hemi);

    // The moon: high in the north-east, casting soft shadows over the whole room.
    this.moon = new THREE.DirectionalLight(PALETTE.moon, MOON_INTENSITY);
    this.moon.position.set(width * 0.75, 14, -4);
    this.moon.target.position.set(width / 2, 0, depth / 2);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(2048, 2048);
    const half = Math.max(width, depth) * 0.75;
    Object.assign(this.moon.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 60 });
    this.moon.shadow.radius = 4;
    this.moon.shadow.bias = -0.0005;
    this.root.add(this.moon, this.moon.target);

    for (const l of lights.slice(0, 4)) {
      const isLamp = l.kind === "lamp";
      const color = isLamp ? PALETTE.lamp : PALETTE.moon;
      const base = isLamp ? LAMP_INTENSITY : MOON_POOL_INTENSITY;
      const light = new THREE.PointLight(color, base, l.radius * 2, 1.2);
      light.position.set(l.x, isLamp ? 1.4 : 2.4, l.z);
      // The pool on the floor.
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(l.radius * 2, l.radius * 2),
        new THREE.MeshBasicMaterial({
          color, map: poolTex(), transparent: true, opacity: isLamp ? 0.35 : 0.22,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(l.x, 0.012, l.z);
      pool.renderOrder = 1;
      this.root.add(light, pool);
      this.lamps.push({ light, pool, base });
      if (!isLamp) this.root.add(moonShaft(l));
      if (isLamp) {
        // A small glowing bulb so bloom has something to catch.
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: PALETTE.paper }));
        bulb.position.copy(light.position);
        this.root.add(bulb);
      }
    }

    // Dust motes drifting in the light pools.
    const pos = new Float32Array(DUST_COUNT * 3);
    this.dustHome = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      const l = lights[i % Math.max(1, lights.length)];
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (l?.radius ?? 2) * 0.8;
      const x = (l?.x ?? width / 2) + Math.cos(a) * r, z = (l?.z ?? depth / 2) + Math.sin(a) * r;
      const y = 0.3 + Math.random() * 1.8;
      this.dustHome.set([x, y, z], i * 3);
      pos.set([x, y, z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({
      color: PALETTE.paper, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false,
    }));
    this.dust.frustumCulled = false;
    this.root.add(this.dust);
  }

  /** Lights out (Phase 6): lamps fade to 0 over 0.3 s; back on over 1 s. */
  setLightsOut(on: boolean): void {
    this.darkTarget = on ? 1 : 0;
  }

  update(dt: number): void {
    this.t += dt;
    const rate = this.darkTarget > this.dark ? dt / 0.3 : dt / 1;
    this.dark = this.darkTarget > this.dark ? Math.min(this.darkTarget, this.dark + rate) : Math.max(this.darkTarget, this.dark - rate);
    const flicker = this.dark > 0 && this.dark < 1 ? (Math.sin(this.t * 60) > 0 ? 1 : 0.3) : 1;
    for (const l of this.lamps) {
      const isLamp = l.light.color.getHex() === PALETTE.lamp;
      const k = isLamp ? (1 - this.dark) * flicker : 1;
      l.light.intensity = l.base * k;
      l.pool.material.opacity = (isLamp ? 0.35 : 0.22) * k;
    }
    this.hemi.intensity = HEMI_INTENSITY * (1 - this.dark * 0.65);

    // Drift the dust gently around where it started.
    const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < DUST_COUNT; i++) {
      const hx = this.dustHome[i * 3], hy = this.dustHome[i * 3 + 1], hz = this.dustHome[i * 3 + 2];
      pos.setXYZ(i,
        hx + Math.sin(this.t * 0.3 + i) * 0.15,
        hy + Math.sin(this.t * 0.2 + i * 1.7) * 0.2,
        hz + Math.cos(this.t * 0.25 + i * 0.5) * 0.15);
    }
    pos.needsUpdate = true;
    this.dust.material.opacity = 0.55 * (1 - this.dark * 0.8);
  }
}

let shaftTexture: THREE.CanvasTexture | null = null;

/** Fades from full at the floor to nothing at the top, so the shaft has no hard edge. */
function shaftTex(): THREE.CanvasTexture {
  if (!shaftTexture) {
    const c = document.createElement("canvas");
    c.width = 4; c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(1, "rgba(255,255,255,1)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 64);
    shaftTexture = new THREE.CanvasTexture(c);
  }
  return shaftTexture;
}

/** A soft cone of moonlight from above, at 8% opacity, fading out toward the ceiling. */
function moonShaft(l: LightDef): THREE.Mesh {
  const h = 3;
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(l.radius * 0.3, l.radius * 0.9, h, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: PALETTE.moon, map: shaftTex(), transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  cone.position.set(l.x, h / 2, l.z);
  cone.renderOrder = 2;
  return cone;
}
