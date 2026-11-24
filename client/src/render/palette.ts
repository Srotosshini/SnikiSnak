// The one palette (PLAN.md Section 11). Use these and nothing else.

export const PALETTE = {
  ink: 0x2b1d16,
  midnight: 0x1d2340,
  moon: 0x9db4ff,
  lamp: 0xffb66b,
  paper: 0xf3e7cf,
  tape: 0xe8d9a8,
  wood: 0x8a5a3b,
  darkWood: 0x5e3b26,
  plaster: 0xc9b8a6,
  jam: 0xd9534f,
  cheese: 0xf2c14e,
  blueberry: 0x4a6fd1,
  leaf: 0x7cc26b,
  mochi: 0xf2d1a0,
  pip: 0x8a8f99,
  crumbs: 0xe8893a,
  crow: 0x1a1a24,
  crowSheen: 0x6b5b95,
  gold: 0xe8b923,
  // Lighting colours given in Section 11 ("Shading and lighting").
  hemiSky: 0x6f86c9,
  hemiGround: 0x2a2233,
} as const;

export const RUG_COLORS = {
  red: PALETTE.jam,
  yellow: PALETTE.cheese,
  blue: PALETTE.blueberry,
  green: PALETTE.leaf,
} as const;

export function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}
