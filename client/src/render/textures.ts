// Canvas-made textures: wooden floor planks, cracked squeaky boards, rug stripes
// and soft blob shadows (PLAN.md Section 11). Everything is drawn in code so the
// game works offline with no image files.

import * as THREE from "three";
import { PALETTE, css } from "./palette";

/** Small deterministic random generator, so textures look the same every load. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, size: number) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function mix(a: number, b: number, t: number): string {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
}

/**
 * Wooden planks running east-west. One texture covers 2×2 tiles, 3 planks per
 * tile (a tile is about 30 cm of real floor).
 */
export function plankTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(512, (g, size) => {
    const rand = seeded(7);
    const rows = 6;
    const rowH = size / rows;
    for (let r = 0; r < rows; r++) {
      // Each row has a few planks of different lengths and shades.
      let x = -rand() * size * 0.5;
      while (x < size) {
        const len = size * (0.45 + rand() * 0.55);
        g.fillStyle = mix(PALETTE.wood, PALETTE.darkWood, rand() * 0.35);
        g.fillRect(x, r * rowH, len, rowH);
        // Fine grain lines.
        g.strokeStyle = mix(PALETTE.darkWood, PALETTE.ink, 0.2);
        g.globalAlpha = 0.18;
        g.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const y = r * rowH + rand() * rowH;
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + len * 0.3, y + (rand() - 0.5) * 4, x + len * 0.7, y + (rand() - 0.5) * 4, x + len, y);
          g.stroke();
        }
        g.globalAlpha = 1;
        // Plank end joint.
        g.fillStyle = css(PALETTE.ink);
        g.globalAlpha = 0.45;
        g.fillRect(x + len - 1.5, r * rowH, 2, rowH);
        g.globalAlpha = 1;
        x += len;
      }
      // Gap between rows.
      g.fillStyle = css(PALETTE.ink);
      g.globalAlpha = 0.55;
      g.fillRect(0, r * rowH, size, 2);
      g.globalAlpha = 1;
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** A single tile of cracked, slightly lifted board for squeaky floorboards (~). */
export function squeakTexture(): THREE.CanvasTexture {
  return canvasTexture(128, (g, size) => {
    const rand = seeded(42);
    g.clearRect(0, 0, size, size);
    const rowH = size / 3;
    // Lighter, worn boards so they stand out from the floor.
    for (let r = 0; r < 3; r++) {
      g.fillStyle = mix(PALETTE.wood, PALETTE.tape, 0.28 + rand() * 0.12);
      g.fillRect(2, r * rowH + 2, size - 4, rowH - 3);
    }
    // Ink cracks.
    g.strokeStyle = css(PALETTE.ink);
    g.lineWidth = 2.5;
    g.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      let x = size * (0.15 + rand() * 0.2), y = rowH * i + rowH * (0.3 + rand() * 0.4);
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += size * (0.1 + rand() * 0.08);
        y += (rand() - 0.5) * rowH * 0.6;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // Nail heads.
    g.fillStyle = css(PALETTE.ink);
    for (const [nx, ny] of [[8, 8], [size - 8, 8], [8, size - 8], [size - 8, size - 8]]) {
      g.beginPath(); g.arc(nx, ny, 2.5, 0, Math.PI * 2); g.fill();
    }
  });
}

/** Simple striped rug in one palette colour. */
export function rugTexture(color: number): THREE.CanvasTexture {
  const tex = canvasTexture(64, (g, size) => {
    g.fillStyle = css(color);
    g.fillRect(0, 0, size, size);
    g.fillStyle = mix(color, PALETTE.paper, 0.35);
    for (let y = 4; y < size; y += 16) g.fillRect(0, y, size, 4);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

let blob: THREE.CanvasTexture | null = null;

/** A soft round shadow to put under characters. */
export function blobShadowTexture(): THREE.CanvasTexture {
  if (!blob) {
    blob = canvasTexture(64, (g, size) => {
      const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, "rgba(43,29,22,0.85)");
      grad.addColorStop(0.6, "rgba(43,29,22,0.45)");
      grad.addColorStop(1, "rgba(43,29,22,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
    });
  }
  return blob;
}

/** A metal vent grate on the floor (Mochi's vents). */
export function ventTexture(): THREE.CanvasTexture {
  return canvasTexture(128, (g, size) => {
    g.clearRect(0, 0, size, size);
    g.fillStyle = css(PALETTE.ink);
    g.fillRect(6, 6, size - 12, size - 12);
    g.fillStyle = mix(PALETTE.plaster, PALETTE.ink, 0.25);
    for (let y = 18; y < size - 18; y += 16) g.fillRect(16, y, size - 32, 7);
    g.strokeStyle = mix(PALETTE.plaster, PALETTE.ink, 0.1);
    g.lineWidth = 5;
    g.strokeRect(8, 8, size - 16, size - 16);
  });
}
