// Toon materials and ink outlines (PLAN.md Section 11, "Shading and lighting").
//
// Toon shading: MeshToonMaterial with a 3-step gradient (0.45, 0.75, 1.0).
// Outlines: the "inverted hull" trick. Each mesh gets a slightly fatter copy
// of itself that only draws its back faces in ink, so a dark rim shows around it.

import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { PALETTE } from "./palette";

export const OUTLINE_THICKNESS = 0.025;

let gradient: THREE.DataTexture | null = null;

/** The 3×1 gradient map shared by every toon material. */
export function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    const steps = [0.45, 0.75, 1.0].map((v) => Math.round(v * 255));
    gradient = new THREE.DataTexture(new Uint8Array(steps), steps.length, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

const toonCache = new Map<string, THREE.MeshToonMaterial>();

/** A shared toon material for a palette colour. */
export function toon(color: number, opts: { emissive?: number } = {}): THREE.MeshToonMaterial {
  const key = `${color}:${opts.emissive ?? 0}`;
  let m = toonCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
    if (opts.emissive !== undefined) m.emissive = new THREE.Color(opts.emissive);
    toonCache.set(key, m);
  }
  return m;
}

const outlineMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.ink, side: THREE.BackSide });

/**
 * Make an outline mesh for a mesh: vertices are welded so the normals are
 * smooth (no cracks at hard edges), then pushed out along those normals.
 */
export function outlineFor(mesh: THREE.Mesh, thickness = OUTLINE_THICKNESS): THREE.Mesh {
  const src = mesh.geometry.clone();
  for (const name of Object.keys(src.attributes)) if (name !== "position") src.deleteAttribute(name);
  const geo = mergeVertices(src);
  geo.computeVertexNormals();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nor = geo.attributes.normal as THREE.BufferAttribute;
  // Push out in world-size units even if the mesh is scaled.
  const s = mesh.scale;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + (nor.getX(i) * thickness) / s.x,
      pos.getY(i) + (nor.getY(i) * thickness) / s.y,
      pos.getZ(i) + (nor.getZ(i) * thickness) / s.z,
    );
  }
  pos.needsUpdate = true;
  const outline = new THREE.Mesh(geo, outlineMaterial);
  outline.name = "outline";
  outline.raycast = () => undefined;
  return outline;
}

/** Create a toon mesh with an outline child. */
export function toonMesh(geometry: THREE.BufferGeometry, color: number, opts: { outline?: boolean; shadows?: boolean } = {}): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, toon(color));
  if (opts.shadows !== false) { mesh.castShadow = true; mesh.receiveShadow = true; }
  if (opts.outline !== false) mesh.add(outlineFor(mesh));
  return mesh;
}

/** Add outlines to every mesh under an object (call after scaling meshes). */
export function addOutlines(root: THREE.Object3D, thickness = OUTLINE_THICKNESS): void {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => { if (o instanceof THREE.Mesh && o.name !== "outline" && o.userData.noOutline !== true) meshes.push(o); });
  for (const m of meshes) m.add(outlineFor(m, thickness));
}
