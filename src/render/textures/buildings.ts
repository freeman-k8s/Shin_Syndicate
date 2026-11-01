import type Phaser from 'phaser';
import type { Building, CityMap } from '../../core/cityMap.ts';
import { TILE_HEIGHT, TILE_WIDTH, worldToScreen } from '../../core/iso.ts';
import { BUILDING_STYLES, LEVEL_HEIGHT, type BuildingStyle, type FaceSide, type SignStyle } from '../cityStyle.ts';
import { hashString, inflate, makeCanvas, mix, polygon, registerCanvas, seededRandom, withAlpha, type Point } from './canvas.ts';
import { drawBox, type Projector } from './isoDraw.ts';

/**
 * Buildings are cut into one sprite per tile so that they depth-sort
 * correctly against units walking around them. Walls are painted once per
 * building and sliced per tile; the roof is painted per tile, clipped to the
 * tile's column, so the pieces join seamlessly.
 */
export interface TileSprite {
  readonly key: string;
  readonly tileX: number;
  readonly tileY: number;
  readonly originX: number;
  readonly originY: number;
}

const PAD = 8;
/** Space above the roof for antennae and rooftop equipment. */
const ROOF_SPACE = 70;
const HALF_W = TILE_WIDTH / 2;
const HALF_H = TILE_HEIGHT / 2;
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

export function buildingHeight(building: Building): number {
  return building.levels * LEVEL_HEIGHT + 6;
}

export function createBuildingTextures(scene: Phaser.Scene, map: CityMap): TileSprite[] {
  const sprites: TileSprite[] = [];
  for (const building of map.buildings) {
    const style = BUILDING_STYLES[building.id];
    if (!style) throw new Error(`No style for building ${building.id}`);
    const height = buildingHeight(building);
    const walls: Walls = {
      sw: paintWall(building, style, 'sw', building.w, height),
      se: paintWall(building, style, 'se', building.h, height),
    };
    for (let ty = building.y; ty < building.y + building.h; ty++) {
      for (let tx = building.x; tx < building.x + building.w; tx++) {
        sprites.push(paintBuildingTile(scene, building, style, walls, height, tx, ty));
      }
    }
  }
  return sprites;
}

interface Walls {
  readonly sw: HTMLCanvasElement;
  readonly se: HTMLCanvasElement;
}

/** Paints a whole wall once, unskewed: x runs along the wall, the ground is at the bottom edge. */
function paintWall(b: Building, style: BuildingStyle, side: FaceSide, tiles: number, height: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(tiles * HALF_W, height);
  ctx.translate(0, height);
  paintFace(ctx, b, style, side, tiles, height);
  return canvas;
}

/**
 * Copies the slice of a wall that belongs to one tile, sheared onto the
 * isometric wall plane. `slope` is +0.5 for south-west walls, -0.5 for south-east walls.
 */
function drawWallSlice(ctx: CanvasRenderingContext2D, wall: HTMLCanvasElement, index: number, origin: Point, slope: number): void {
  const start = Math.max(0, index * HALF_W - 1);
  const end = Math.min(wall.width, (index + 1) * HALF_W + 1);
  ctx.save();
  ctx.setTransform(1, slope, 0, 1, origin.x, origin.y);
  ctx.drawImage(wall, start, 0, end - start, wall.height, start, -wall.height, end - start, wall.height);
  ctx.restore();
}

function paintBuildingTile(
  scene: Phaser.Scene,
  b: Building,
  style: BuildingStyle,
  walls: Walls,
  height: number,
  tx: number,
  ty: number,
): TileSprite {
  const width = TILE_WIDTH + PAD * 2;
  const texHeight = PAD + ROOF_SPACE + height + TILE_HEIGHT + PAD;
  const ox = PAD + HALF_W;
  const oy = PAD + ROOF_SPACE + height + HALF_H;
  const centre = worldToScreen({ x: tx + 0.5, y: ty + 0.5 });
  const project: Projector = (x, y, z = 0) => {
    const s = worldToScreen({ x, y });
    return { x: s.x - centre.x + ox, y: s.y - centre.y + oy - z };
  };
  const { canvas, ctx } = makeCanvas(width, texHeight);

  // Roof first, clipped to the column above this tile so rooftop equipment can rise above it.
  // (Painting it before the walls matters: on some GPU-accelerated canvases a clipped draw
  // with shadows can disturb pixels outside the clip.)
  {
    const l = project(tx, ty + 1, height);
    const bottom = project(tx + 1, ty + 1, height);
    const r = project(tx + 1, ty, height);
    ctx.save();
    polygon(ctx, inflate([l, bottom, r, { x: r.x, y: r.y - ROOF_SPACE - HALF_H }, { x: l.x, y: l.y - ROOF_SPACE - HALF_H }], 0.8));
    ctx.clip();
    paintRoof(ctx, b, style, height, project);
    ctx.restore();
  }

  // South-west wall (looks towards +y) on the building's last row.
  if (ty === b.y + b.h - 1) {
    drawWallSlice(ctx, walls.sw, tx - b.x, project(b.x, b.y + b.h), HALF_H / HALF_W);
  }
  // South-east wall (looks towards +x) on the building's last column.
  if (tx === b.x + b.w - 1) {
    drawWallSlice(ctx, walls.se, b.y + b.h - 1 - ty, project(b.x + b.w, b.y + b.h), -HALF_H / HALF_W);
  }

  const key = `building-${tx}-${ty}`;
  registerCanvas(scene, key, canvas);
  return { key, tileX: tx, tileY: ty, originX: ox / width, originY: oy / texHeight };
}

/**
 * Paints one whole wall in face-local coordinates: u runs along the wall
 * (64 px per tile), v runs up the wall (0 at the ground, -height at the roof).
 */
function paintFace(
  ctx: CanvasRenderingContext2D,
  b: Building,
  style: BuildingStyle,
  side: FaceSide,
  tiles: number,
  height: number,
): void {
  const length = tiles * HALF_W;
  const shade = side === 'sw' ? 0 : 0.28;
  const darken = (color: string) => mix(color, '#000000', shade);
  const rand = seededRandom(hashString(`${b.id}-${side}`));

  const base = ctx.createLinearGradient(0, -height, 0, 0);
  base.addColorStop(0, darken(style.wall[0]));
  base.addColorStop(1, darken(style.wall[1]));
  ctx.fillStyle = base;
  ctx.fillRect(-2, -height - 2, length + 4, height + 4);

  // Street light washing up the lower wall.
  const wash = ctx.createLinearGradient(0, -LEVEL_HEIGHT * 1.6, 0, 0);
  wash.addColorStop(0, 'rgba(120, 200, 255, 0)');
  wash.addColorStop(1, 'rgba(120, 200, 255, 0.08)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, -LEVEL_HEIGHT * 1.6, length, LEVEL_HEIGHT * 1.6);

  // Floor slabs and structural columns.
  for (let level = 1; level < b.levels; level++) {
    const y = -level * LEVEL_HEIGHT;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, y - 1.5, length, 3);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, y + 1.5, length, 1);
  }
  for (let i = 0; i <= tiles; i++) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(i * HALF_W - 2, -height, 4, height);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.fillRect(0, -height, length, 5);

  // Windows (or a glass shop front on the ground floor).
  for (let level = 0; level < b.levels; level++) {
    const floorTop = -(level + 1) * LEVEL_HEIGHT;
    if (level === 0 && style.storefront?.face === side) {
      paintStorefront(ctx, length, style.storefront.color);
      continue;
    }
    for (let i = 0; i < tiles; i++) {
      for (let j = 0; j < 2; j++) {
        const x = i * HALF_W + 9 + j * 26;
        const y = floorTop + 9;
        const w = 19;
        const h = LEVEL_HEIGHT - 16;
        if (rand() < style.litRatio) {
          const color = style.windowColors[Math.floor(rand() * style.windowColors.length)];
          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = 9;
          const glass = ctx.createLinearGradient(0, y, 0, y + h);
          glass.addColorStop(0, withAlpha(color, 0.95));
          glass.addColorStop(1, withAlpha(color, 0.55));
          ctx.fillStyle = glass;
          ctx.fillRect(x, y, w, h);
          ctx.restore();
          // Blinds / silhouettes for variety.
          if (rand() < 0.35) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(x, y, w, h * (0.3 + rand() * 0.4));
          }
        } else {
          const glass = ctx.createLinearGradient(x, y, x + w, y + h);
          glass.addColorStop(0, '#162130');
          glass.addColorStop(1, '#070b11');
          ctx.fillStyle = glass;
          ctx.fillRect(x, y, w, h);
        }
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
      }
    }
  }

  // Neon roof line and front-corner strip.
  if (style.trim) {
    ctx.save();
    ctx.strokeStyle = style.trim;
    ctx.shadowColor = style.trim;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -height + 3);
    ctx.lineTo(length, -height + 3);
    const corner = side === 'sw' ? length - 2 : 2;
    ctx.moveTo(corner, -height + 3);
    ctx.lineTo(corner, -4);
    ctx.stroke();
    ctx.restore();
  }

  for (const sign of style.signs) {
    if (sign.face === side) paintSign(ctx, sign);
  }

  // Corner highlight where the two visible walls meet.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(side === 'sw' ? length - 1.5 : 0, -height, 1.5, height);
}

function paintStorefront(ctx: CanvasRenderingContext2D, length: number, color: string): void {
  const top = -LEVEL_HEIGHT + 5;
  const glass = ctx.createLinearGradient(0, top, 0, 0);
  glass.addColorStop(0, withAlpha(color, 0.18));
  glass.addColorStop(1, withAlpha(color, 0.5));
  ctx.fillStyle = '#05080c';
  ctx.fillRect(4, top, length - 8, LEVEL_HEIGHT - 6);
  ctx.fillStyle = glass;
  ctx.fillRect(4, top, length - 8, LEVEL_HEIGHT - 6);
  // Mullions.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  for (let x = 4; x < length - 4; x += 22) ctx.fillRect(x, top, 2, LEVEL_HEIGHT - 6);
  // Canopy light strip.
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillStyle = color;
  ctx.fillRect(2, top - 3, length - 4, 2.5);
  ctx.restore();
}

function paintSign(ctx: CanvasRenderingContext2D, sign: SignStyle): void {
  const cx = sign.at * HALF_W;
  const cy = -sign.level * LEVEL_HEIGHT;
  ctx.save();
  ctx.font = `700 ${sign.size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = sign.vertical ? [...sign.text] : [sign.text];
  const lineHeight = sign.size * 1.02;
  const textWidth = Math.max(...chars.map((c) => ctx.measureText(c).width));
  const boxW = textWidth + sign.size * 0.8;
  const boxH = lineHeight * chars.length + sign.size * 0.45;

  ctx.fillStyle = 'rgba(4, 6, 10, 0.82)';
  ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
  ctx.strokeStyle = sign.color;
  ctx.shadowColor = sign.color;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);

  ctx.shadowBlur = 16;
  ctx.fillStyle = sign.color;
  chars.forEach((char, i) => {
    const y = cy - ((chars.length - 1) * lineHeight) / 2 + i * lineHeight;
    ctx.fillText(char, cx, y);
  });
  // Hot core of the neon tubes.
  ctx.shadowBlur = 0;
  ctx.fillStyle = withAlpha('#ffffff', 0.55);
  chars.forEach((char, i) => {
    const y = cy - ((chars.length - 1) * lineHeight) / 2 + i * lineHeight;
    ctx.fillText(char, cx, y);
  });
  ctx.restore();
}

function paintRoof(ctx: CanvasRenderingContext2D, b: Building, style: BuildingStyle, height: number, project: Projector): void {
  const outline = [
    project(b.x, b.y, height),
    project(b.x + b.w, b.y, height),
    project(b.x + b.w, b.y + b.h, height),
    project(b.x, b.y + b.h, height),
  ];
  ctx.fillStyle = mix(style.roof, '#ffffff', 0.12);
  polygon(ctx, outline);
  ctx.fill();

  const inset = 0.12;
  const inner: Point[] = [
    project(b.x + inset, b.y + inset, height - 3),
    project(b.x + b.w - inset, b.y + inset, height - 3),
    project(b.x + b.w - inset, b.y + b.h - inset, height - 3),
    project(b.x + inset, b.y + b.h - inset, height - 3),
  ];
  const floor = ctx.createLinearGradient(inner[0].x, inner[0].y, inner[2].x, inner[2].y);
  floor.addColorStop(0, mix(style.roof, '#000000', 0.15));
  floor.addColorStop(1, style.roof);
  ctx.fillStyle = floor;
  polygon(ctx, inner);
  ctx.fill();

  // Front edge highlight.
  ctx.save();
  ctx.strokeStyle = style.trim ? withAlpha(style.trim, 0.7) : 'rgba(255, 255, 255, 0.12)';
  if (style.trim) {
    ctx.shadowColor = style.trim;
    ctx.shadowBlur = 8;
  }
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(outline[3].x, outline[3].y);
  ctx.lineTo(outline[2].x, outline[2].y);
  ctx.lineTo(outline[1].x, outline[1].y);
  ctx.stroke();
  ctx.restore();

  const rand = seededRandom(hashString(`${b.id}-roof`));
  const unit = { top: '#3a4456', left: '#232a37', right: '#191f2a' };

  if (b.id === 'D') {
    // Corporate helipad.
    const c = project(b.x + b.w / 2, b.y + b.h / 2, height);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(1, HALF_H / HALF_W);
    ctx.strokeStyle = withAlpha('#3ef2ff', 0.75);
    ctx.shadowColor = '#3ef2ff';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.transform(1, 0.5, -1, 0.5, 0, 0);
    ctx.fillStyle = withAlpha('#d8f6ff', 0.45);
    ctx.font = `800 34px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', 0, 0);
    ctx.restore();
    drawBox(ctx, project, b.x + 0.25, b.y + 0.3, 0.5, 0.4, height, 14, unit);
    drawBox(ctx, project, b.x + b.w - 0.8, b.y + 0.3, 0.5, 0.5, height, 12, unit);
  } else {
    const count = Math.max(1, Math.floor((b.w * b.h) / 3));
    for (let i = 0; i < count; i++) {
      const w = 0.3 + rand() * 0.35;
      const d = 0.3 + rand() * 0.3;
      const x = b.x + 0.2 + rand() * Math.max(0, b.w - w - 0.4);
      const y = b.y + 0.2 + rand() * Math.max(0, b.h - d - 0.4);
      const faces = drawBox(ctx, project, x, y, w, d, height, 10 + rand() * 10, unit);
      // Fan grille.
      const top = faces.top;
      const cx = (top[0].x + top[2].x) / 2;
      const cy = (top[0].y + top[2].y) / 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (b.id === 'A') {
    // Antenna mast with a red aviation light.
    const base = project(b.x + 1, b.y + 1, height);
    ctx.strokeStyle = '#4a5468';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(base.x, base.y - 58);
    ctx.stroke();
    ctx.save();
    ctx.fillStyle = '#ff3b4e';
    ctx.shadowColor = '#ff3b4e';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(base.x, base.y - 60, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
