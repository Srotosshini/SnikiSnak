// Realistic materials for the rooms, drawn in code (no image files, so the
// game still works offline). Each texture is painted on a canvas once and
// cached; materials are MeshStandardMaterial so the warm lamps, the moonlight
// and the soft shadows read like a real (if tiny-scale) bakery at night.

import * as THREE from "three";
import { seeded } from "./textures";

type Paint = (g: CanvasRenderingContext2D, w: number, h: number, rand: () => number) => void;

const texCache = new Map<string, THREE.CanvasTexture>();
const matCache = new Map<string, THREE.Material>();

function canvasTex(key: string, w: number, h: number, paint: Paint, color = true): THREE.CanvasTexture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  paint(g, w, h, seeded(key.length * 7919 + key.charCodeAt(0)));
  const tex = new THREE.CanvasTexture(c);
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  texCache.set(key, tex);
  return tex;
}

function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

/** Scatter fine noise over a canvas (dirt, grain, plaster). */
function speckle(g: CanvasRenderingContext2D, w: number, h: number, rand: () => number, count: number, dark: string, light: string): void {
  for (let i = 0; i < count; i++) {
    g.fillStyle = rand() < 0.5 ? dark : light;
    const s = 1 + rand() * 2;
    g.fillRect(rand() * w, rand() * h, s, s);
  }
}

// ---------------------------------------------------------------------------
// Floor: honey-coloured oak planks, 4 per tile, one texture covers 2×2 tiles.
// ---------------------------------------------------------------------------

function paintPlanks(bump: boolean): Paint {
  return (g, w, h, rand) => {
    const rows = 8;
    const rowH = h / rows;
    g.fillStyle = bump ? "#000" : hsl(28, 40, 22);
    g.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) {
      let x = -rand() * w * 0.6;
      while (x < w) {
        const len = w * (0.35 + rand() * 0.5);
        const y0 = r * rowH + 2, y1 = y0 + rowH - 3;
        if (bump) {
          g.fillStyle = "#c8c8c8";
          g.fillRect(x + 2, y0, len - 3, y1 - y0);
        } else {
          const hue = 30 + rand() * 8, light = 44 + rand() * 12, sat = 45 + rand() * 12;
          const grad = g.createLinearGradient(0, y0, 0, y1);
          grad.addColorStop(0, hsl(hue, sat, light + 4));
          grad.addColorStop(0.5, hsl(hue, sat, light));
          grad.addColorStop(1, hsl(hue, sat, light - 6));
          g.fillStyle = grad;
          g.fillRect(x + 2, y0, len - 3, y1 - y0);
          // Grain: long wavy streaks.
          for (let i = 0; i < 14; i++) {
            const yy = y0 + rand() * (y1 - y0);
            g.strokeStyle = hsl(hue - 4, sat, light - 14 - rand() * 8, 0.25 + rand() * 0.2);
            g.lineWidth = 0.6 + rand() * 1.2;
            g.beginPath();
            g.moveTo(x, yy);
            const amp = 1 + rand() * 3;
            for (let t = 0; t <= 1.001; t += 0.05) g.lineTo(x + len * t, yy + Math.sin(t * 9 + i) * amp);
            g.stroke();
          }
          // A knot now and then.
          if (rand() < 0.35) {
            const kx = x + len * (0.2 + rand() * 0.6), ky = y0 + (y1 - y0) * (0.3 + rand() * 0.4);
            for (let k = 5; k > 0; k--) {
              g.strokeStyle = hsl(hue - 6, sat, light - 10 - k * 3, 0.5);
              g.beginPath();
              g.ellipse(kx, ky, 3 + k * 3, 1.5 + k * 1.2, 0, 0, Math.PI * 2);
              g.stroke();
            }
          }
          // Worn, slightly darker plank ends.
          g.fillStyle = hsl(hue, sat, 20, 0.35);
          g.fillRect(x + len - 6, y0, 4, y1 - y0);
        }
        x += len;
      }
    }
    if (!bump) speckle(g, w, h, rand, 3000, "rgba(40,20,10,0.12)", "rgba(255,230,190,0.08)");
  };
}

export function floorMaterial(tilesX: number, tilesZ: number): THREE.MeshStandardMaterial {
  const map = canvasTex("planks", 1024, 1024, paintPlanks(false)).clone();
  const bump = canvasTex("planks-bump", 1024, 1024, paintPlanks(true), false).clone();
  for (const t of [map, bump]) { t.repeat.set(tilesX / 2, tilesZ / 2); t.needsUpdate = true; }
  return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.2, roughness: 0.62, metalness: 0 });
}

// ---------------------------------------------------------------------------
// Walls: cream subway tiles below, warm plaster above, dark cut-away caps.
// ---------------------------------------------------------------------------

function paintTiles(bump: boolean): Paint {
  return (g, w, h, rand) => {
    g.fillStyle = bump ? "#222" : hsl(36, 20, 62);
    g.fillRect(0, 0, w, h);
    const cols = 4, rows = 8, tw = w / cols, th = h / rows;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? tw / 2 : 0;
      for (let c = -1; c <= cols; c++) {
        const x = c * tw + off + 2, y = r * th + 2;
        if (bump) {
          g.fillStyle = "#ddd";
        } else {
          const grad = g.createLinearGradient(x, y, x, y + th);
          const l = 86 + rand() * 6;
          grad.addColorStop(0, hsl(40, 35, l + 3));
          grad.addColorStop(1, hsl(38, 30, l - 6));
          g.fillStyle = grad;
        }
        g.beginPath();
        g.roundRect(x, y, tw - 4, th - 4, 4);
        g.fill();
      }
    }
  };
}

const paintPlaster: Paint = (g, w, h, rand) => {
  g.fillStyle = hsl(34, 38, 80);
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = hsl(32, 30, 70 + rand() * 18, 0.12);
    g.beginPath();
    g.arc(rand() * w, rand() * h, 8 + rand() * 40, 0, Math.PI * 2);
    g.fill();
  }
  speckle(g, w, h, rand, 2500, "rgba(90,60,40,0.10)", "rgba(255,255,240,0.15)");
};

export function tileWallMaterial(): THREE.MeshStandardMaterial {
  return cachedMat("tiles", () => new THREE.MeshStandardMaterial({
    map: canvasTex("tiles", 256, 256, paintTiles(false)),
    bumpMap: canvasTex("tiles-bump", 256, 256, paintTiles(true), false),
    bumpScale: 1.5, roughness: 0.35, metalness: 0,
  }));
}

export function plasterMaterial(): THREE.MeshStandardMaterial {
  return cachedMat("plaster", () => new THREE.MeshStandardMaterial({ map: canvasTex("plaster", 256, 256, paintPlaster), roughness: 0.92 }));
}

/** The dark top of a cut-away wall, like an architect's model. */
export function wallCapMaterial(): THREE.MeshStandardMaterial {
  return cachedMat("wallcap", () => new THREE.MeshStandardMaterial({ color: 0x2b1d16, roughness: 0.9 }));
}

// ---------------------------------------------------------------------------
// Wood for furniture, burlap, wicker, metal, gingham, bread.
// ---------------------------------------------------------------------------

function paintWood(hue: number, sat: number, light: number): Paint {
  return (g, w, h, rand) => {
    g.fillStyle = hsl(hue, sat, light);
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      const y = rand() * h;
      g.strokeStyle = hsl(hue - 3, sat, light - 8 - rand() * 10, 0.35);
      g.lineWidth = 0.5 + rand() * 1.5;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.04 + i) * 2);
      g.stroke();
    }
    speckle(g, w, h, rand, 600, "rgba(40,20,10,0.12)", "rgba(255,230,190,0.08)");
  };
}

export function woodMaterial(kind: "oak" | "walnut" | "pine" | "painted" = "oak"): THREE.MeshStandardMaterial {
  const spec = { oak: [30, 45, 45], walnut: [22, 40, 26], pine: [36, 50, 62], painted: [150, 18, 58] }[kind];
  return cachedMat(`wood-${kind}`, () => new THREE.MeshStandardMaterial({
    map: canvasTex(`wood-${kind}`, 256, 256, paintWood(spec[0], spec[1], spec[2])),
    roughness: kind === "painted" ? 0.55 : 0.7,
  }));
}

const paintBurlap: Paint = (g, w, h, rand) => {
  g.fillStyle = hsl(38, 38, 62);
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 4) {
    g.fillStyle = hsl(36, 35, 52 + rand() * 8, 0.6);
    g.fillRect(0, y, w, 1.5);
  }
  for (let x = 0; x < w; x += 4) {
    g.fillStyle = hsl(36, 30, 50 + rand() * 8, 0.5);
    g.fillRect(x, 0, 1.5, h);
  }
  // "FLOUR" stamped in faded red.
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate(-0.06);
  g.fillStyle = "rgba(160, 50, 40, 0.75)";
  g.font = "bold 46px 'Courier Prime', 'Courier New', monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("FLOUR", 0, -6);
  g.font = "bold 18px 'Courier Prime', 'Courier New', monospace";
  g.fillText("~ 25 KG ~", 0, 30);
  g.restore();
  speckle(g, w, h, rand, 1200, "rgba(60,40,20,0.15)", "rgba(255,255,255,0.25)");
};

export function burlapMaterial(): THREE.MeshStandardMaterial {
  return cachedMat("burlap", () => new THREE.MeshStandardMaterial({ map: canvasTex("burlap", 256, 256, paintBurlap), roughness: 1 }));
}

const paintWicker: Paint = (g, w, h, rand) => {
  g.fillStyle = hsl(32, 45, 30);
  g.fillRect(0, 0, w, h);
  const s = 16;
  for (let y = 0; y < h; y += s) {
    for (let x = 0; x < w; x += s) {
      const over = ((x + y) / s) % 2 === 0;
      const grad = over ? g.createLinearGradient(x, y, x + s, y) : g.createLinearGradient(x, y, x, y + s);
      const l = 48 + rand() * 10;
      grad.addColorStop(0, hsl(34, 50, l - 10));
      grad.addColorStop(0.5, hsl(36, 55, l + 6));
      grad.addColorStop(1, hsl(34, 50, l - 10));
      g.fillStyle = grad;
      g.beginPath();
      g.roundRect(x + 1, y + 1, s - 2, s - 2, 5);
      g.fill();
    }
  }
};

export function wickerMaterial(): THREE.MeshStandardMaterial {
  return cachedMat("wicker", () => new THREE.MeshStandardMaterial({ map: canvasTex("wicker", 128, 128, paintWicker), roughness: 0.85 }));
}

export function metalMaterial(): THREE.MeshStandardMaterial {
  return cachedMat("metal", () => new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.35, metalness: 0.85 }));
}

const paintGingham: Paint = (g, w, h) => {
  g.fillStyle = "#f3e7cf";
  g.fillRect(0, 0, w, h);
  const s = w / 8;
  for (let i = 0; i < 8; i += 2) {
    g.fillStyle = "rgba(217, 83, 79, 0.55)";
    g.fillRect(i * s, 0, s, h);
    g.fillRect(0, i * s, w, s);
  }
};

export function ginghamMaterial(): THREE.MeshStandardMaterial {
  return cachedMat("gingham", () => new THREE.MeshStandardMaterial({ map: canvasTex("gingham", 128, 128, paintGingham), roughness: 0.95 }));
}

export function breadMaterial(): THREE.MeshStandardMaterial {
  return cachedMat("bread", () => new THREE.MeshStandardMaterial({ color: 0xc8843f, roughness: 0.8 }));
}

export function flourMaterial(): THREE.MeshStandardMaterial {
  return cachedMat("flour", () => new THREE.MeshStandardMaterial({ color: 0xf6f0e4, roughness: 1 }));
}

export function rubberMaterial(color: number): THREE.MeshStandardMaterial {
  return cachedMat(`rubber-${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.55 }));
}

export function plainMaterial(color: number, roughness = 0.8): THREE.MeshStandardMaterial {
  return cachedMat(`plain-${color}-${roughness}`, () => new THREE.MeshStandardMaterial({ color, roughness }));
}

export function glowMaterial(color: number): THREE.MeshBasicMaterial {
  return cachedMat(`glow-${color}`, () => new THREE.MeshBasicMaterial({ color })) as THREE.MeshBasicMaterial;
}

function cachedMat<T extends THREE.Material>(key: string, make: () => T): T {
  let m = matCache.get(key) as T | undefined;
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}

/** A soft dark blob for contact shadows under furniture (fakes ambient occlusion). */
export function contactShadowMaterial(): THREE.MeshBasicMaterial {
  return cachedMat("contact", () => {
    const tex = canvasTex("contact", 128, 128, (g, w, h) => {
      const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grad.addColorStop(0, "rgba(20,12,8,0.75)");
      grad.addColorStop(0.65, "rgba(20,12,8,0.35)");
      grad.addColorStop(1, "rgba(20,12,8,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    });
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  }) as THREE.MeshBasicMaterial;
}
