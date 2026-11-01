import { CSS } from './palette.ts';

/** Purely visual dressing for the mission map (signage, lamps, light pools). */

export type FaceSide = 'sw' | 'se';

export interface SignStyle {
  readonly face: FaceSide;
  readonly text: string;
  /** Centre of the sign along the face, in tiles from the face's left end. */
  readonly at: number;
  /** Centre height of the sign, in storeys above the ground. */
  readonly level: number;
  readonly color: string;
  readonly size: number;
  readonly vertical?: boolean;
}

export interface BuildingStyle {
  readonly name: string;
  /** Wall gradient (top, bottom) for the brighter south-west face. */
  readonly wall: readonly [string, string];
  readonly roof: string;
  readonly windowColors: readonly string[];
  /** Fraction of windows that are lit. */
  readonly litRatio: number;
  /** Neon strip along the roof line. */
  readonly trim?: string;
  /** Glass shop front on the ground floor of these faces. */
  readonly storefront?: { readonly face: FaceSide; readonly color: string };
  readonly signs: readonly SignStyle[];
}

export const LEVEL_HEIGHT = 34;

export const BUILDING_STYLES: Readonly<Record<string, BuildingStyle>> = {
  A: {
    name: 'Kaigan Tower',
    wall: ['#1a2236', '#232d45'],
    roof: '#121826',
    windowColors: [CSS.coolWindow, '#a9b8ff', CSS.warmWindow],
    litRatio: 0.45,
    trim: CSS.violet,
    signs: [
      { face: 'se', text: 'KAIGAN', at: 1.5, level: 2.65, color: CSS.violet, size: 22, vertical: true },
      { face: 'sw', text: 'DATA', at: 3.4, level: 3.4, color: CSS.cyan, size: 22, vertical: true },
    ],
  },
  B: {
    name: 'Residential stack',
    wall: ['#1f1d2b', '#2a2737'],
    roof: '#15141d',
    windowColors: [CSS.warmWindow, '#ffd9a8', '#ff9f7a'],
    litRatio: 0.55,
    signs: [{ face: 'se', text: 'HOTEL', at: 2, level: 2.5, color: CSS.amber, size: 20 }],
  },
  C: {
    name: 'Velvet Static',
    wall: ['#24142a', '#311a38'],
    roof: '#160d1a',
    windowColors: ['#ff7ad9'],
    litRatio: 0.3,
    trim: CSS.magenta,
    storefront: { face: 'se', color: CSS.magenta },
    signs: [{ face: 'se', text: 'VELVET STATIC', at: 1.5, level: 1.45, color: CSS.magenta, size: 19 }],
  },
  D: {
    name: 'Halcyon Dynamics',
    wall: ['#16232f', '#1d2f3d'],
    roof: '#0f1820',
    windowColors: [CSS.coolWindow, '#c4f4ff'],
    litRatio: 0.6,
    trim: CSS.cyan,
    storefront: { face: 'sw', color: CSS.cyan },
    signs: [
      { face: 'sw', text: 'HALCYON', at: 2.5, level: 3.2, color: CSS.cyan, size: 30 },
      { face: 'se', text: 'DYNAMICS', at: 2, level: 3.2, color: CSS.teal, size: 20 },
    ],
  },
  E: {
    name: 'Night market annex',
    wall: ['#22201a', '#2d2a22'],
    roof: '#16150f',
    windowColors: [CSS.warmWindow, '#9dff8a'],
    litRatio: 0.5,
    storefront: { face: 'sw', color: '#9dff8a' },
    signs: [{ face: 'sw', text: '24/7', at: 0.5, level: 2.2, color: '#9dff8a', size: 18 }],
  },
  F: {
    name: 'Soba kiosk',
    wall: ['#2a1d14', '#35261a'],
    roof: '#1a130d',
    windowColors: [CSS.warmWindow],
    litRatio: 1,
    trim: CSS.amber,
    storefront: { face: 'sw', color: CSS.amber },
    signs: [{ face: 'se', text: 'SOBA', at: 1, level: 0.62, color: CSS.amber, size: 16 }],
  },
};

export interface LightPool {
  /** World position (tiles). */
  readonly x: number;
  readonly y: number;
  readonly color: string;
  /** Radius in tiles. */
  readonly radius: number;
  readonly strength: number;
}

export interface LampPost {
  readonly x: number;
  readonly y: number;
  readonly color: string;
}

export const LAMP_POSTS: readonly LampPost[] = [
  { x: 4.8, y: 11.2, color: CSS.coolWindow },
  { x: 7.2, y: 8.8, color: CSS.amber },
  { x: 7.2, y: 13.6, color: CSS.coolWindow },
  { x: 4.8, y: 2.4, color: CSS.amber },
  { x: 12.4, y: 8.2, color: CSS.coolWindow },
  { x: 1.4, y: 11.2, color: CSS.amber },
];

export const LIGHT_POOLS: readonly LightPool[] = [
  ...LAMP_POSTS.map((lamp) => ({ x: lamp.x, y: lamp.y, color: lamp.color, radius: 2.1, strength: 0.32 })),
  { x: 3.3, y: 14.2, color: CSS.magenta, radius: 2.6, strength: 0.42 },
  { x: 11.5, y: 4.4, color: CSS.cyan, radius: 3, strength: 0.38 },
  { x: 4.3, y: 1.4, color: CSS.violet, radius: 2.2, strength: 0.3 },
  { x: 15.5, y: 4.3, color: '#9dff8a', radius: 1.6, strength: 0.25 },
  { x: 13, y: 15.3, color: CSS.amber, radius: 2, strength: 0.35 },
  { x: 9.5, y: 8.6, color: CSS.cyan, radius: 1.2, strength: 0.3 },
  { x: 13.5, y: 8.6, color: CSS.magenta, radius: 1.1, strength: 0.28 },
  { x: 3.5, y: 12.6, color: CSS.cyan, radius: 1.1, strength: 0.25 },
  { x: 7.5, y: 2.6, color: CSS.magenta, radius: 1.1, strength: 0.25 },
];
