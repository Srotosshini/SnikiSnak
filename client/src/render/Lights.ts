// Lights for a level (PLAN.md Section 11, "Shading and lighting").
// Phase 1: hemisphere light, the moon with soft shadows, and a point light for
// each light in the level file. Light-pool decals and lights-out come in Phase 5/6.
//
// Section 11 gives the hemisphere intensity as 0.6. Current Three.js uses
// physical light units, where that reads almost black with toon materials, so
// the intensities here are scaled up to give the same mood. Tune them in Phase 5.

import * as THREE from "three";
import type { LightDef } from "@snikisnak/shared";
import { PALETTE } from "./palette";

const HEMI_INTENSITY = 2.2;
const MOON_INTENSITY = 1.8;
const LAMP_INTENSITY = 9;
const MOON_POOL_INTENSITY = 4;

export function buildLights(lights: readonly LightDef[], width: number, depth: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "lights";

  group.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, HEMI_INTENSITY));

  // The moon: high in the north-east, casting soft shadows over the whole room.
  const moon = new THREE.DirectionalLight(PALETTE.moon, MOON_INTENSITY);
  moon.position.set(width * 0.75, 14, -4);
  moon.target.position.set(width / 2, 0, depth / 2);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const half = Math.max(width, depth) * 0.75;
  Object.assign(moon.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 60 });
  moon.shadow.radius = 4;
  moon.shadow.bias = -0.0005;
  group.add(moon, moon.target);

  // Up to 4 lamp/moon pools per level, as point lights without shadows.
  for (const l of lights.slice(0, 4)) {
    const isLamp = l.kind === "lamp";
    const point = new THREE.PointLight(
      isLamp ? PALETTE.lamp : PALETTE.moon,
      isLamp ? LAMP_INTENSITY : MOON_POOL_INTENSITY,
      l.radius * 2,
      1.2,
    );
    point.position.set(l.x, isLamp ? 1.4 : 2.4, l.z);
    group.add(point);
  }
  return group;
}
