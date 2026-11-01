import type Phaser from 'phaser';
import type { PropKind } from '../../core/cityMap.ts';
import { TILE_HEIGHT, TILE_WIDTH } from '../../core/iso.ts';
import { CSS } from '../palette.ts';
import { makeCanvas, polygon, registerCanvas, withAlpha } from './canvas.ts';
import { drawBox, tileProjector, type Projector } from './isoDraw.ts';

export interface PropTexture {
  readonly key: string;
  readonly originX: number;
  readonly originY: number;
}

const PAD = 10;
const TOP_SPACE = 140;
const HALF_W = TILE_WIDTH / 2;
const HALF_H = TILE_HEIGHT / 2;

const PAINTERS: Readonly<Record<PropKind, (ctx: CanvasRenderingContext2D, project: Projector, ox: number, oy: number) => void>> = {
  barrier: paintBarrier,
  planter: paintPlanter,
  crates: paintCrates,
  adPillar: paintAdPillar,
  vending: paintVending,
};

/** One texture per prop kind, anchored at the tile centre. */
export function createPropTextures(scene: Phaser.Scene): Record<PropKind, PropTexture> {
  const result = {} as Record<PropKind, PropTexture>;
  for (const kind of Object.keys(PAINTERS) as PropKind[]) {
    const width = TILE_WIDTH + PAD * 2;
    const height = TOP_SPACE + TILE_HEIGHT + PAD;
    const ox = PAD + HALF_W;
    const oy = TOP_SPACE + HALF_H;
    const { canvas, ctx } = makeCanvas(width, height);
    PAINTERS[kind](ctx, tileProjector(ox, oy, HALF_W, HALF_H), ox, oy);
    const key = `prop-${kind}`;
    registerCanvas(scene, key, canvas);
    result[kind] = { key, originX: ox / width, originY: oy / height };
  }
  return result;
}

function paintBarrier(ctx: CanvasRenderingContext2D, project: Projector): void {
  const faces = drawBox(ctx, project, 0.03, 0.34, 0.94, 0.32, 0, 24, {
    top: '#b9a24a',
    left: '#8c7a30',
    right: '#6b5d25',
  });
  // Hazard chevrons on the visible long side.
  ctx.save();
  polygon(ctx, faces.left);
  ctx.clip();
  ctx.fillStyle = '#121212';
  for (let i = -2; i < 8; i++) {
    const a = project(0.03 + i * 0.16, 0.66, 0);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x + 11, a.y + 5.5);
    ctx.lineTo(a.x + 23, a.y - 18.5);
    ctx.lineTo(a.x + 12, a.y - 24);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Warning lamp.
  const lamp = project(0.5, 0.5, 26);
  ctx.save();
  ctx.fillStyle = CSS.amber;
  ctx.shadowColor = CSS.amber;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintPlanter(ctx: CanvasRenderingContext2D, project: Projector): void {
  const faces = drawBox(ctx, project, 0.12, 0.12, 0.76, 0.76, 0, 20, {
    top: '#151b17',
    left: '#2b3342',
    right: '#202734',
  });
  // Teal light strip along the visible base edges.
  ctx.save();
  ctx.strokeStyle = withAlpha(CSS.teal, 0.85);
  ctx.shadowColor = CSS.teal;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 1.6;
  const a = project(0.12, 0.88, 4);
  const b = project(0.88, 0.88, 4);
  const c = project(0.88, 0.12, 4);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.stroke();
  ctx.restore();
  // Shrubs.
  const centre = { x: (faces.top[0].x + faces.top[2].x) / 2, y: (faces.top[0].y + faces.top[2].y) / 2 };
  const blobs = [
    [-22, -4, 15],
    [18, -2, 14],
    [-4, -12, 17],
    [4, 6, 13],
    [-14, 6, 11],
  ];
  for (const [dx, dy, r] of blobs) {
    const g = ctx.createRadialGradient(centre.x + dx - 4, centre.y + dy - 10, 2, centre.x + dx, centre.y + dy - 6, r);
    g.addColorStop(0, '#3f7a5c');
    g.addColorStop(1, '#0f2a1f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(centre.x + dx, centre.y + dy - 6, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintCrates(ctx: CanvasRenderingContext2D, project: Projector): void {
  const wood = { top: '#8a5a33', left: '#6a4224', right: '#4f311b' };
  const steel = { top: '#55657c', left: '#3a4658', right: '#2b3442' };
  // Back-to-front so the nearer steel case overlaps the wooden stack.
  drawBox(ctx, project, 0.08, 0.12, 0.5, 0.55, 0, 30, wood);
  drawBox(ctx, project, 0.14, 0.2, 0.36, 0.36, 30, 22, wood);
  drawBox(ctx, project, 0.5, 0.45, 0.42, 0.42, 0, 24, steel);
  // Stencil stripe.
  const a = project(0.6, 0.87, 10);
  const b = project(0.92, 0.87, 10);
  ctx.strokeStyle = withAlpha(CSS.amber, 0.7);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function paintAdPillar(ctx: CanvasRenderingContext2D, _project: Projector, ox: number, oy: number): void {
  const rx = 21;
  const ry = 10.5;
  const height = 118;
  const body = ctx.createLinearGradient(ox - rx, 0, ox + rx, 0);
  body.addColorStop(0, '#2e3648');
  body.addColorStop(0.45, '#1b2130');
  body.addColorStop(1, '#0c1018');
  ctx.fillStyle = body;
  ctx.fillRect(ox - rx, oy - height, rx * 2, height);
  ctx.beginPath();
  ctx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI);
  ctx.fill();

  // Illuminated advertisement band.
  const bandTop = oy - height + 22;
  const bandHeight = 66;
  const ad = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandHeight);
  ad.addColorStop(0, '#ff3dce');
  ad.addColorStop(1, '#6b2bff');
  ctx.save();
  ctx.shadowColor = CSS.magenta;
  ctx.shadowBlur = 18;
  ctx.fillStyle = ad;
  ctx.fillRect(ox - rx + 3, bandTop, rx * 2 - 6, bandHeight);
  ctx.restore();
  // Cylindrical shading over the band.
  const shading = ctx.createLinearGradient(ox - rx, 0, ox + rx, 0);
  shading.addColorStop(0, 'rgba(255,255,255,0.25)');
  shading.addColorStop(0.4, 'rgba(255,255,255,0)');
  shading.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = shading;
  ctx.fillRect(ox - rx + 3, bandTop, rx * 2 - 6, bandHeight);
  // Simple graphic: a ring and the product name.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ox - 2, bandTop + 22, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 11px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NEO', ox - 2, bandTop + 52);

  // Cap.
  ctx.fillStyle = '#3a4357';
  ctx.beginPath();
  ctx.ellipse(ox, oy - height, rx + 2, ry + 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#121722';
  ctx.beginPath();
  ctx.ellipse(ox, oy - height - 1, rx - 3, ry - 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintVending(ctx: CanvasRenderingContext2D, project: Projector): void {
  const faces = drawBox(ctx, project, 0.22, 0.3, 0.56, 0.42, 0, 66, {
    top: '#2c3646',
    left: '#1a2230',
    right: '#121822',
  });
  // Glowing front panel on the side facing the street (+y).
  const panel = [project(0.27, 0.72, 10), project(0.73, 0.72, 10), project(0.73, 0.72, 60), project(0.27, 0.72, 60)];
  ctx.save();
  ctx.shadowColor = CSS.cyan;
  ctx.shadowBlur = 16;
  const glow = ctx.createLinearGradient(panel[3].x, panel[3].y, panel[0].x, panel[0].y);
  glow.addColorStop(0, '#9ff8ff');
  glow.addColorStop(1, '#1aa6c4');
  ctx.fillStyle = glow;
  polygon(ctx, panel);
  ctx.fill();
  ctx.restore();
  // Product rows.
  const colors = ['#ff3dce', '#ffb347', '#5cffb0', '#ffffff'];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const p = project(0.31 + col * 0.11, 0.72, 52 - row * 10);
      ctx.fillStyle = colors[(row + col) % colors.length];
      ctx.fillRect(p.x - 2, p.y - 3, 4, 5);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  polygon(ctx, faces.left);
  ctx.stroke();
}

/** Street lamp drawn in white so each lamp can be tinted; origin at the foot of the pole. */
export const LAMP_HEAD_HEIGHT = 112;

export function createLampTexture(scene: Phaser.Scene): PropTexture {
  const width = 48;
  const height = 132;
  const foot = { x: 24, y: 126 };
  const { canvas, ctx } = makeCanvas(width, height);
  // Base plate and pole.
  ctx.fillStyle = '#1b2130';
  ctx.beginPath();
  ctx.ellipse(foot.x, foot.y, 7, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const pole = ctx.createLinearGradient(foot.x - 2, 0, foot.x + 2, 0);
  pole.addColorStop(0, '#5b6578');
  pole.addColorStop(1, '#1d2330');
  ctx.fillStyle = pole;
  ctx.fillRect(foot.x - 2, foot.y - LAMP_HEAD_HEIGHT, 4, LAMP_HEAD_HEIGHT);
  // Lamp head.
  ctx.fillStyle = '#2a3242';
  ctx.fillRect(foot.x - 14, foot.y - LAMP_HEAD_HEIGHT - 4, 28, 5);
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 10;
  ctx.fillRect(foot.x - 12, foot.y - LAMP_HEAD_HEIGHT + 1, 24, 2.5);
  ctx.restore();
  registerCanvas(scene, 'lamp-post', canvas);
  return { key: 'lamp-post', originX: foot.x / width, originY: foot.y / height };
}
