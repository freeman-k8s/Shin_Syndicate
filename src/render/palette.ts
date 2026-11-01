/** Shared colours. CSS strings are for canvas drawing, numbers for Phaser. */

export const CSS = {
  asphalt: '#0d1119',
  asphaltLight: '#141a25',
  sidewalk: '#1a2130',
  sidewalkSeam: '#0e131c',
  plaza: '#1c2434',
  plazaInlay: '#2de2e6',
  curb: '#4a5a72',
  laneMark: '#c9b458',
  crosswalk: '#c7d2e0',
  cyan: '#3ef2ff',
  teal: '#35f2d0',
  magenta: '#ff3dce',
  violet: '#b98cff',
  amber: '#ffb347',
  crimson: '#ff3b4e',
  warmWindow: '#ffcf8a',
  coolWindow: '#8fd8ff',
} as const;

export const HEX = {
  background: 0x05070d,
  friendly: 0x35f2d0,
  hostile: 0xff3b4e,
  move: 0x35f2d0,
  invalid: 0xff4d6a,
  healthHigh: 0x5cffb0,
  healthMid: 0xffc857,
  healthLow: 0xff3b4e,
} as const;

/** Per-agent accent colours: KESTREL (cyan) and VANTA (violet). */
export const AGENT_ACCENTS = [
  { css: CSS.cyan, hex: 0x3ef2ff },
  { css: CSS.violet, hex: 0xb98cff },
] as const;

export const GUARD_ACCENT = { css: CSS.crimson, hex: 0xff3b4e } as const;

export function healthColor(fraction: number): number {
  if (fraction > 0.6) return HEX.healthHigh;
  if (fraction > 0.3) return HEX.healthMid;
  return HEX.healthLow;
}

/** Linear blend between two 0xRRGGBB colours. */
export function lerpColor(a: number, b: number, t: number): number {
  const channel = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
