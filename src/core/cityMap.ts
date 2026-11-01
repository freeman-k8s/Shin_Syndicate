export type GroundKind = 'road' | 'crosswalk' | 'sidewalk' | 'plaza';

export type PropKind = 'barrier' | 'planter' | 'crates' | 'adPillar' | 'vending';

/** Low props block movement only; tall props also block line of sight. */
export const PROP_BLOCKS_SIGHT: Readonly<Record<PropKind, boolean>> = {
  barrier: false,
  planter: false,
  crates: false,
  adPillar: true,
  vending: true,
};

export interface Building {
  /** Single-letter identifier used in the layout. */
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Number of storeys; only affects rendering. */
  readonly levels: number;
}

export interface Prop {
  readonly kind: PropKind;
  readonly x: number;
  readonly y: number;
}

export interface CityMap {
  readonly width: number;
  readonly height: number;
  readonly ground: readonly GroundKind[];
  readonly buildings: readonly Building[];
  readonly props: readonly Prop[];
  /** Per tile: index into `buildings`, or -1. */
  readonly buildingIndex: readonly number[];
  /** Per tile: index into `props`, or -1. */
  readonly propIndex: readonly number[];
}

export interface CityLayout {
  /** One string per row (y); one character per column (x). */
  readonly rows: readonly string[];
  /** Storeys for each building letter used in `rows`. */
  readonly buildingLevels: Readonly<Record<string, number>>;
  readonly ground: (x: number, y: number) => GroundKind;
}

const PROP_CHARS: Readonly<Record<string, PropKind>> = {
  b: 'barrier',
  n: 'planter',
  c: 'crates',
  o: 'adPillar',
  v: 'vending',
};

/**
 * Builds a map from an ASCII layout. Upper-case letters are buildings (each
 * letter must form one solid rectangle), lower-case letters from PROP_CHARS are
 * props and '.' is open ground.
 */
export function buildCityMap(layout: CityLayout): CityMap {
  const height = layout.rows.length;
  const width = layout.rows[0]?.length ?? 0;
  const ground: GroundKind[] = [];
  const props: Prop[] = [];
  const propIndex: number[] = [];
  const bounds = new Map<string, { x0: number; y0: number; x1: number; y1: number; count: number }>();

  for (let y = 0; y < height; y++) {
    const row = layout.rows[y];
    if (row.length !== width) {
      throw new Error(`Layout row ${y} has length ${row.length}, expected ${width}`);
    }
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      ground.push(layout.ground(x, y));
      propIndex.push(-1);
      if (ch === '.') continue;
      const propKind = PROP_CHARS[ch];
      if (propKind) {
        propIndex[y * width + x] = props.length;
        props.push({ kind: propKind, x, y });
      } else if (ch >= 'A' && ch <= 'Z') {
        const b = bounds.get(ch);
        if (b) {
          b.x0 = Math.min(b.x0, x);
          b.y0 = Math.min(b.y0, y);
          b.x1 = Math.max(b.x1, x);
          b.y1 = Math.max(b.y1, y);
          b.count++;
        } else {
          bounds.set(ch, { x0: x, y0: y, x1: x, y1: y, count: 1 });
        }
      } else {
        throw new Error(`Unknown layout character '${ch}' at ${x},${y}`);
      }
    }
  }

  const buildings: Building[] = [];
  const buildingIndex: number[] = new Array<number>(width * height).fill(-1);
  for (const [id, b] of bounds) {
    const w = b.x1 - b.x0 + 1;
    const h = b.y1 - b.y0 + 1;
    if (w * h !== b.count) {
      throw new Error(`Building '${id}' is not a solid rectangle`);
    }
    const levels = layout.buildingLevels[id];
    if (levels === undefined) {
      throw new Error(`No storey count given for building '${id}'`);
    }
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        buildingIndex[y * width + x] = buildings.length;
      }
    }
    buildings.push({ id, x: b.x0, y: b.y0, w, h, levels });
  }

  return { width, height, ground, buildings, props, buildingIndex, propIndex };
}

export function inBounds(map: CityMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function buildingAt(map: CityMap, x: number, y: number): Building | undefined {
  if (!inBounds(map, x, y)) return undefined;
  const index = map.buildingIndex[y * map.width + x];
  return index >= 0 ? map.buildings[index] : undefined;
}

export function propAt(map: CityMap, x: number, y: number): Prop | undefined {
  if (!inBounds(map, x, y)) return undefined;
  const index = map.propIndex[y * map.width + x];
  return index >= 0 ? map.props[index] : undefined;
}

export function groundAt(map: CityMap, x: number, y: number): GroundKind | undefined {
  return inBounds(map, x, y) ? map.ground[y * map.width + x] : undefined;
}

export function isWalkable(map: CityMap, x: number, y: number): boolean {
  if (!inBounds(map, x, y)) return false;
  const i = y * map.width + x;
  return map.buildingIndex[i] < 0 && map.propIndex[i] < 0;
}

export function blocksSight(map: CityMap, x: number, y: number): boolean {
  if (!inBounds(map, x, y)) return false;
  if (map.buildingIndex[y * map.width + x] >= 0) return true;
  const prop = propAt(map, x, y);
  return prop !== undefined && PROP_BLOCKS_SIGHT[prop.kind];
}

// ---------------------------------------------------------------------------
// The mission map: a 16 × 16 block of the Meridian Ward business district.
// ---------------------------------------------------------------------------

export const MAP_SIZE = 16;

/** Two-lane avenues: one running along x (rows 9-10), one along y (columns 5-6). */
const AVENUE_COLUMNS = [5, 6];
const AVENUE_ROWS = [9, 10];

function meridianGround(x: number, y: number): GroundKind {
  const onColumnRoad = AVENUE_COLUMNS.includes(x);
  const onRowRoad = AVENUE_ROWS.includes(y);
  if (onColumnRoad && !onRowRoad && (y === 8 || y === 11)) return 'crosswalk';
  if (onRowRoad && !onColumnRoad && (x === 4 || x === 7)) return 'crosswalk';
  if (onColumnRoad || onRowRoad) return 'road';
  if (x >= 9 && y >= 4 && y <= 7) return 'plaza';
  return 'sidewalk';
}

const MERIDIAN_LAYOUT: CityLayout = {
  rows: [
    // x: 0123456789012345
    'AAAA.....DDDDD.E', // y = 0
    'AAAA.....DDDDD.E', // y = 1
    'AAAA...o.DDDDD.E', // y = 2
    '.........DDDDD.E', // y = 3
    'BBB.....n.......', // y = 4
    'BBB.............', // y = 5
    'BBB.............', // y = 6
    'BBB.....n.bbb.n.', // y = 7
    '...c.....v...o..', // y = 8
    '................', // y = 9
    '................', // y = 10
    '...n......n.....', // y = 11
    '...o....c.......', // y = 12
    'CCC.........FF..', // y = 13
    'CCC.........FF..', // y = 14
    'CCC.............', // y = 15
  ],
  buildingLevels: {
    A: 5, // Kaigan Tower
    B: 3, // residential stack
    C: 2, // Velvet Static club
    D: 4, // Halcyon Dynamics regional office
    E: 3, // night market annex
    F: 1, // noodle kiosk
  },
  ground: meridianGround,
};

export function createCityMap(): CityMap {
  return buildCityMap(MERIDIAN_LAYOUT);
}
