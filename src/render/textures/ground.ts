import type Phaser from 'phaser';
import { buildingAt, groundAt, PROP_BLOCKS_SIGHT, type CityMap, type GroundKind } from '../../core/cityMap.ts';
import { TILE_HEIGHT, TILE_WIDTH, worldToScreen } from '../../core/iso.ts';
import { LIGHT_POOLS } from '../cityStyle.ts';
import { CSS } from '../palette.ts';
import { makeCanvas, mix, polygon, registerCanvas, seededRandom, withAlpha, type Point } from './canvas.ts';

export interface GroundTexture {
  readonly key: string;
  /** World-pixel position of the canvas' top-left corner. */
  readonly left: number;
  readonly top: number;
}

/** Tiles of street drawn beyond the playable map so the district does not end abruptly. */
const EXTENSION = 2;

/**
 * Paints all static ground detail (pavement, roads, markings, puddles, light
 * pools and contact shadows) into one large texture.
 */
export function createGroundTexture(scene: Phaser.Scene, map: CityMap): GroundTexture {
  const corners = [
    worldToScreen({ x: -EXTENSION, y: -EXTENSION }),
    worldToScreen({ x: map.width + EXTENSION, y: -EXTENSION }),
    worldToScreen({ x: map.width + EXTENSION, y: map.height + EXTENSION }),
    worldToScreen({ x: -EXTENSION, y: map.height + EXTENSION }),
  ];
  const left = Math.min(...corners.map((c) => c.x)) - 4;
  const top = Math.min(...corners.map((c) => c.y)) - 4;
  const right = Math.max(...corners.map((c) => c.x)) + 4;
  const bottom = Math.max(...corners.map((c) => c.y)) + 4;
  const { canvas, ctx } = makeCanvas(right - left, bottom - top);
  const project = (x: number, y: number): Point => {
    const s = worldToScreen({ x, y });
    return { x: s.x - left, y: s.y - top };
  };
  const diamond = (x: number, y: number, inset = 0): Point[] => [
    project(x + inset, y + inset),
    project(x + 1 - inset, y + inset),
    project(x + 1 - inset, y + 1 - inset),
    project(x + inset, y + 1 - inset),
  ];
  const rand = seededRandom(1337);

  // 1. Base tiles, including faded streets beyond the map edge.
  for (let y = -EXTENSION; y < map.height + EXTENSION; y++) {
    for (let x = -EXTENSION; x < map.width + EXTENSION; x++) {
      const inside = x >= 0 && y >= 0 && x < map.width && y < map.height;
      const kind = inside ? (groundAt(map, x, y) ?? 'sidewalk') : extendedGround(map, x, y);
      const outside = Math.max(-x, -y, x - map.width + 1, y - map.height + 1, 0);
      ctx.globalAlpha = inside ? 1 : Math.max(0, 0.55 - outside * 0.2);
      paintTile(ctx, kind, x, y, diamond, project, rand);
    }
  }
  ctx.globalAlpha = 1;

  // 2. Lane markings and curbs (inside the map only).
  paintLaneMarkings(ctx, map, project);
  paintCurbs(ctx, map, project);

  // 3. Wet patches.
  for (let i = 0; i < 46; i++) {
    const x = rand() * map.width;
    const y = rand() * map.height;
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    if (buildingAt(map, tileX, tileY)) continue;
    const c = project(x, y);
    const radius = 18 + rand() * 46;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(1, 0.5);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, 'rgba(120, 170, 255, 0.10)');
    gradient.addColorStop(0.7, 'rgba(90, 140, 220, 0.05)');
    gradient.addColorStop(1, 'rgba(90, 140, 220, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 4. Contact shadows around buildings and tall props.
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetX = 10000;
  ctx.fillStyle = '#000';
  for (const b of map.buildings) {
    const pts = [project(b.x, b.y), project(b.x + b.w, b.y), project(b.x + b.w, b.y + b.h), project(b.x, b.y + b.h)];
    polygon(ctx, pts.map((p) => ({ x: p.x - 10000, y: p.y })));
    ctx.fill();
  }
  ctx.shadowBlur = 12;
  for (const prop of map.props) {
    const pts = diamond(prop.x, prop.y, PROP_BLOCKS_SIGHT[prop.kind] ? 0.18 : 0.08);
    polygon(ctx, pts.map((p) => ({ x: p.x - 10000, y: p.y })));
    ctx.fill();
  }
  ctx.restore();

  // 5. Coloured light pools from lamps and neon signage.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const light of LIGHT_POOLS) {
    const c = project(light.x, light.y);
    const radius = light.radius * TILE_WIDTH * 0.5;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(1, TILE_HEIGHT / TILE_WIDTH);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, withAlpha(light.color, light.strength));
    gradient.addColorStop(0.45, withAlpha(light.color, light.strength * 0.35));
    gradient.addColorStop(1, withAlpha(light.color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // 6. A faint boundary line around the playable block.
  ctx.save();
  ctx.strokeStyle = withAlpha(CSS.cyan, 0.16);
  ctx.lineWidth = 2;
  polygon(ctx, [project(0, 0), project(map.width, 0), project(map.width, map.height), project(0, map.height)]);
  ctx.stroke();
  ctx.restore();

  registerCanvas(scene, 'ground', canvas);
  return { key: 'ground', left, top };
}

/** Streets continue past the map edge; everything else becomes pavement. */
function extendedGround(map: CityMap, x: number, y: number): GroundKind {
  const edgeX = Math.min(Math.max(x, 0), map.width - 1);
  const edgeY = Math.min(Math.max(y, 0), map.height - 1);
  const kind = groundAt(map, edgeX, edgeY);
  const leavesAlongRoad = (x < 0 || x >= map.width) !== (y < 0 || y >= map.height);
  return leavesAlongRoad && (kind === 'road' || kind === 'crosswalk') ? 'road' : 'sidewalk';
}

function paintTile(
  ctx: CanvasRenderingContext2D,
  kind: GroundKind,
  x: number,
  y: number,
  diamond: (x: number, y: number, inset?: number) => Point[],
  project: (x: number, y: number) => Point,
  rand: () => number,
): void {
  const jitter = (rand() - 0.5) * 0.08;
  if (kind === 'road' || kind === 'crosswalk') {
    ctx.fillStyle = mix(CSS.asphalt, CSS.asphaltLight, 0.35 + jitter * 4);
    polygon(ctx, diamond(x, y, -0.01));
    ctx.fill();
    // Aggregate speckles.
    for (let i = 0; i < 26; i++) {
      const p = project(x + rand(), y + rand());
      ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.25)';
      ctx.fillRect(p.x, p.y, 2, 1);
    }
    if (kind === 'crosswalk') paintCrosswalk(ctx, x, y, project);
    return;
  }

  if (kind === 'plaza') {
    const base = mix(CSS.plaza, '#232c3f', 0.4 + jitter * 3);
    ctx.fillStyle = base;
    polygon(ctx, diamond(x, y, -0.01));
    ctx.fill();
    // Polished stone sheen.
    const top = project(x, y);
    const bottom = project(x + 1, y + 1);
    const sheen = ctx.createLinearGradient(top.x, top.y, bottom.x, bottom.y);
    sheen.addColorStop(0, 'rgba(255,255,255,0.05)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    polygon(ctx, diamond(x, y, 0.04));
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1.5;
    polygon(ctx, diamond(x, y));
    ctx.stroke();
    // Inlaid light strip on every second seam.
    if ((x + y) % 2 === 0) {
      ctx.save();
      ctx.strokeStyle = withAlpha(CSS.plazaInlay, 0.35);
      ctx.shadowColor = CSS.plazaInlay;
      ctx.shadowBlur = 6;
      ctx.lineWidth = 1.2;
      const a = project(x, y + 1);
      const b = project(x + 1, y + 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  // Sidewalk: 2 × 2 pavers per tile with dark seams.
  for (let py = 0; py < 2; py++) {
    for (let px = 0; px < 2; px++) {
      const shade = 0.25 + (rand() - 0.5) * 0.3;
      ctx.fillStyle = mix(CSS.sidewalk, '#243046', Math.max(0, shade));
      const pts = [
        project(x + px * 0.5, y + py * 0.5),
        project(x + px * 0.5 + 0.5, y + py * 0.5),
        project(x + px * 0.5 + 0.5, y + py * 0.5 + 0.5),
        project(x + px * 0.5, y + py * 0.5 + 0.5),
      ];
      polygon(ctx, pts);
      ctx.fill();
    }
  }
  ctx.strokeStyle = CSS.sidewalkSeam;
  ctx.lineWidth = 1.4;
  for (const t of [0, 0.5]) {
    const a = project(x + t, y);
    const b = project(x + t, y + 1);
    const c = project(x, y + t);
    const d = project(x + 1, y + t);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }
}

function paintCrosswalk(ctx: CanvasRenderingContext2D, x: number, y: number, project: (x: number, y: number) => Point): void {
  // Stripes run parallel to the traffic: column roads (x = 5, 6) carry traffic along y.
  const trafficAlongY = x === 5 || x === 6;
  ctx.fillStyle = withAlpha(CSS.crosswalk, 0.55);
  for (let i = 0; i < 4; i++) {
    const a = 0.08 + i * 0.24;
    const b = a + 0.13;
    const pts = trafficAlongY
      ? [project(x + a, y + 0.12), project(x + b, y + 0.12), project(x + b, y + 0.88), project(x + a, y + 0.88)]
      : [project(x + 0.12, y + a), project(x + 0.88, y + a), project(x + 0.88, y + b), project(x + 0.12, y + b)];
    polygon(ctx, pts);
    ctx.fill();
  }
}

function paintLaneMarkings(ctx: CanvasRenderingContext2D, map: CityMap, project: (x: number, y: number) => Point): void {
  ctx.save();
  ctx.strokeStyle = withAlpha(CSS.laneMark, 0.6);
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 18]);
  // Centre line of the column avenue (between x = 5 and x = 6), skipping the junction.
  for (const [from, to] of [
    [-EXTENSION, 8],
    [12, map.height + EXTENSION],
  ]) {
    const a = project(6, from);
    const b = project(6, to);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Centre line of the row avenue (between y = 9 and y = 10).
  for (const [from, to] of [
    [-EXTENSION, 4],
    [8, map.width + EXTENSION],
  ]) {
    const a = project(from, 10);
    const b = project(to, 10);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function paintCurbs(ctx: CanvasRenderingContext2D, map: CityMap, project: (x: number, y: number) => Point): void {
  const isRoad = (x: number, y: number): boolean => {
    const kind = groundAt(map, x, y);
    return kind === 'road' || kind === 'crosswalk';
  };
  ctx.save();
  ctx.lineCap = 'round';
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (isRoad(x, y) || buildingAt(map, x, y)) continue;
      const edges: [Point, Point, boolean][] = [
        [project(x + 1, y), project(x + 1, y + 1), isRoad(x + 1, y)],
        [project(x, y), project(x, y + 1), isRoad(x - 1, y)],
        [project(x, y + 1), project(x + 1, y + 1), isRoad(x, y + 1)],
        [project(x, y), project(x + 1, y), isRoad(x, y - 1)],
      ];
      for (const [a, b, road] of edges) {
        if (!road) continue;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y + 2);
        ctx.lineTo(b.x, b.y + 2);
        ctx.stroke();
        ctx.strokeStyle = CSS.curb;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
