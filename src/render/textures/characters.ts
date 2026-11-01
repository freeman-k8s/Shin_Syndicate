import type Phaser from 'phaser';
import type { Vec2 } from '../../core/types.ts';
import { AGENT_ACCENTS, CSS, GUARD_ACCENT } from '../palette.ts';
import { makeCanvas, registerCanvas, withAlpha } from './canvas.ts';

/**
 * Procedural character sprites, drawn facing screen-right. The ground point
 * (between the feet) sits at FOOT within each texture.
 */
export const CHARACTER_SIZE = { width: 96, height: 124 } as const;
const FOOT = { x: 44, y: 114 } as const;

export const CHARACTER_ORIGIN = { x: FOOT.x / CHARACTER_SIZE.width, y: FOOT.y / CHARACTER_SIZE.height } as const;

/** Muzzle position relative to the ground point, for a sprite facing right. */
export const MUZZLE_OFFSET: Readonly<Record<'agent' | 'guard', Vec2>> = {
  agent: { x: 40, y: -60 },
  guard: { x: 46, y: -60 },
};

export const AGENT_TEXTURES = ['agent-0', 'agent-1'] as const;
export const GUARD_TEXTURE = 'guard';
export const PORTRAIT_TEXTURES = ['portrait-0', 'portrait-1'] as const;

interface AgentLook {
  readonly accent: string;
  readonly skin: string;
  readonly hood: boolean;
}

const LOOKS: readonly AgentLook[] = [
  { accent: AGENT_ACCENTS[0].css, skin: '#c9967a', hood: false },
  { accent: AGENT_ACCENTS[1].css, skin: '#8a6450', hood: true },
];

export function createCharacterTextures(scene: Phaser.Scene): void {
  LOOKS.forEach((look, i) => {
    const { canvas, ctx } = makeCanvas(CHARACTER_SIZE.width, CHARACTER_SIZE.height);
    paintAgent(ctx, look);
    registerCanvas(scene, AGENT_TEXTURES[i], canvas);
    const portrait = makeCanvas(84, 84);
    paintPortrait(portrait.ctx, look, 84);
    registerCanvas(scene, PORTRAIT_TEXTURES[i], portrait.canvas);
  });
  const { canvas, ctx } = makeCanvas(CHARACTER_SIZE.width, CHARACTER_SIZE.height);
  paintGuard(ctx);
  registerCanvas(scene, GUARD_TEXTURE, canvas);
}

function glowStroke(ctx: CanvasRenderingContext2D, color: string, width: number, blur: number, draw: () => void): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  draw();
  ctx.stroke();
  ctx.restore();
}

function paintLegs(ctx: CanvasRenderingContext2D, color: string, boot: string): void {
  const x = FOOT.x;
  const y = FOOT.y;
  ctx.fillStyle = color;
  // Back leg.
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 40);
  ctx.lineTo(x - 2, y - 40);
  ctx.lineTo(x - 4, y - 4);
  ctx.lineTo(x - 11, y - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // the back leg sits in shadow
  ctx.fill();
  // Front leg.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 40);
  ctx.lineTo(x + 8, y - 40);
  ctx.lineTo(x + 10, y - 4);
  ctx.lineTo(x + 3, y - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = boot;
  ctx.fillRect(x - 13, y - 7, 10, 7);
  ctx.fillRect(x + 2, y - 7, 12, 7);
}

function paintAgent(ctx: CanvasRenderingContext2D, look: AgentLook): void {
  const x = FOOT.x;
  const y = FOOT.y;
  paintLegs(ctx, '#0f141d', '#07090d');

  // Long coat.
  const coat = ctx.createLinearGradient(x - 16, y - 76, x + 16, y - 24);
  coat.addColorStop(0, '#273246');
  coat.addColorStop(1, '#0b0f17');
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(x - 13, y - 78);
  ctx.lineTo(x + 13, y - 78);
  ctx.lineTo(x + 16, y - 46);
  ctx.lineTo(x + 19, y - 22);
  ctx.lineTo(x + 2, y - 26);
  ctx.lineTo(x - 18, y - 21);
  ctx.lineTo(x - 15, y - 50);
  ctx.closePath();
  ctx.fill();
  // Neon piping along the coat's front edge and hem.
  glowStroke(ctx, look.accent, 1.6, 7, () => {
    ctx.moveTo(x + 9, y - 74);
    ctx.lineTo(x + 13, y - 46);
    ctx.lineTo(x + 18, y - 23);
    ctx.moveTo(x - 17, y - 22);
    ctx.lineTo(x + 1, y - 27);
  });

  // Chest rig and belt.
  ctx.fillStyle = '#2f3a50';
  ctx.fillRect(x - 9, y - 74, 18, 20);
  ctx.fillStyle = withAlpha('#ffffff', 0.12);
  ctx.fillRect(x - 9, y - 74, 18, 3);
  ctx.fillStyle = '#10141c';
  ctx.fillRect(x - 12, y - 52, 25, 5);
  ctx.save();
  ctx.fillStyle = look.accent;
  ctx.shadowColor = look.accent;
  ctx.shadowBlur = 6;
  ctx.fillRect(x - 2, y - 51, 5, 3);
  ctx.restore();

  // Back arm.
  ctx.strokeStyle = '#141a26';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 72);
  ctx.lineTo(x + 6, y - 60);
  ctx.lineTo(x + 18, y - 58);
  ctx.stroke();

  // SMG.
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(x + 12, y - 64, 26, 8);
  ctx.fillRect(x + 36, y - 62, 6, 3);
  ctx.fillRect(x + 20, y - 57, 5, 10);
  ctx.fillStyle = '#323b4d';
  ctx.fillRect(x + 12, y - 64, 26, 2);
  glowStroke(ctx, look.accent, 1.2, 5, () => {
    ctx.moveTo(x + 15, y - 59);
    ctx.lineTo(x + 34, y - 59);
  });

  // Front arm.
  ctx.strokeStyle = '#1d2534';
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(x + 7, y - 74);
  ctx.lineTo(x + 14, y - 62);
  ctx.lineTo(x + 26, y - 61);
  ctx.stroke();

  // Head.
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.ellipse(x + 1, y - 87, 8, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (look.hood) {
    ctx.fillStyle = '#171d2b';
    ctx.beginPath();
    ctx.moveTo(x - 11, y - 76);
    ctx.quadraticCurveTo(x - 13, y - 100, x + 1, y - 100);
    ctx.quadraticCurveTo(x + 12, y - 99, x + 11, y - 88);
    ctx.lineTo(x + 6, y - 90);
    ctx.quadraticCurveTo(x, y - 93, x - 4, y - 84);
    ctx.lineTo(x - 2, y - 76);
    ctx.closePath();
    ctx.fill();
    // Lower face mask.
    ctx.fillStyle = '#0d1119';
    ctx.fillRect(x + 1, y - 84, 9, 6);
  } else {
    // Swept-back hair.
    ctx.fillStyle = '#12151c';
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 84);
    ctx.quadraticCurveTo(x - 10, y - 99, x + 2, y - 98);
    ctx.quadraticCurveTo(x + 10, y - 97, x + 9, y - 91);
    ctx.quadraticCurveTo(x, y - 93, x - 5, y - 86);
    ctx.closePath();
    ctx.fill();
  }
  // Glowing visor.
  ctx.save();
  ctx.fillStyle = look.accent;
  ctx.shadowColor = look.accent;
  ctx.shadowBlur = 9;
  ctx.fillRect(x + 1, y - 91, 10, 3.5);
  ctx.restore();

  // Rim light on the back of the silhouette.
  glowStroke(ctx, withAlpha(look.accent, 0.45), 1, 4, () => {
    ctx.moveTo(x - 13, y - 77);
    ctx.lineTo(x - 15, y - 50);
    ctx.lineTo(x - 18, y - 22);
  });
}

function paintGuard(ctx: CanvasRenderingContext2D): void {
  const x = FOOT.x;
  const y = FOOT.y;
  const accent = GUARD_ACCENT.css;
  paintLegs(ctx, '#1a1519', '#0a0809');

  // Armoured torso.
  const armour = ctx.createLinearGradient(x - 16, y - 80, x + 16, y - 40);
  armour.addColorStop(0, '#463840');
  armour.addColorStop(1, '#1b1519');
  ctx.fillStyle = armour;
  ctx.beginPath();
  ctx.moveTo(x - 16, y - 78);
  ctx.lineTo(x + 15, y - 78);
  ctx.lineTo(x + 13, y - 44);
  ctx.lineTo(x - 13, y - 42);
  ctx.closePath();
  ctx.fill();
  // Thigh guards.
  ctx.fillStyle = '#2a2126';
  ctx.fillRect(x - 12, y - 44, 10, 12);
  ctx.fillRect(x + 1, y - 44, 11, 12);
  // Chest plate with insignia.
  ctx.fillStyle = '#5a4650';
  ctx.fillRect(x - 10, y - 74, 20, 16);
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 6;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 70);
  ctx.lineTo(x + 4, y - 70);
  ctx.lineTo(x, y - 62);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  // Shoulder pads with warning lamps.
  ctx.fillStyle = '#3a2e35';
  ctx.beginPath();
  ctx.ellipse(x - 14, y - 77, 8, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 13, y - 77, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.fillStyle = CSS.amber;
  ctx.shadowColor = '#ff8a3d';
  ctx.shadowBlur = 8;
  ctx.fillRect(x - 17, y - 80, 4, 3);
  ctx.fillRect(x + 12, y - 80, 4, 3);
  ctx.restore();
  // Belt.
  ctx.fillStyle = '#7a1f2a';
  ctx.fillRect(x - 13, y - 46, 26, 4);

  // Back arm and carbine.
  ctx.strokeStyle = '#231b20';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 72);
  ctx.lineTo(x + 6, y - 60);
  ctx.lineTo(x + 20, y - 58);
  ctx.stroke();
  ctx.fillStyle = '#0c0a0c';
  ctx.fillRect(x + 8, y - 64, 36, 7);
  ctx.fillRect(x + 42, y - 62, 6, 3);
  ctx.fillRect(x + 16, y - 58, 6, 11);
  ctx.fillStyle = '#4a3a42';
  ctx.fillRect(x + 8, y - 64, 36, 2);
  ctx.save();
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 6;
  ctx.fillRect(x + 30, y - 61, 3, 2);
  ctx.restore();
  ctx.strokeStyle = '#30262c';
  ctx.lineWidth = 7.5;
  ctx.beginPath();
  ctx.moveTo(x + 8, y - 74);
  ctx.lineTo(x + 14, y - 62);
  ctx.lineTo(x + 28, y - 61);
  ctx.stroke();

  // Helmet with a red visor band.
  const helmet = ctx.createRadialGradient(x - 3, y - 94, 2, x, y - 88, 12);
  helmet.addColorStop(0, '#4c4048');
  helmet.addColorStop(1, '#17121a');
  ctx.fillStyle = helmet;
  ctx.beginPath();
  ctx.ellipse(x, y - 88, 10.5, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 10;
  ctx.fillRect(x - 1, y - 91, 12, 4);
  ctx.restore();
}

function paintPortrait(ctx: CanvasRenderingContext2D, look: AgentLook, size: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#0d1824');
  bg.addColorStop(1, '#05080d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  const halo = ctx.createRadialGradient(size * 0.5, size * 0.45, 4, size * 0.5, size * 0.45, size * 0.6);
  halo.addColorStop(0, withAlpha(look.accent, 0.28));
  halo.addColorStop(1, withAlpha(look.accent, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);
  // Scan lines.
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let y = 0; y < size; y += 3) ctx.fillRect(0, y, size, 1);

  const cx = size / 2;
  // Shoulders / collar.
  ctx.fillStyle = '#1a2232';
  ctx.beginPath();
  ctx.moveTo(cx - 34, size);
  ctx.quadraticCurveTo(cx - 30, size * 0.7, cx, size * 0.68);
  ctx.quadraticCurveTo(cx + 30, size * 0.7, cx + 34, size);
  ctx.closePath();
  ctx.fill();
  glowStroke(ctx, look.accent, 1.5, 6, () => {
    ctx.moveTo(cx - 12, size * 0.74);
    ctx.lineTo(cx - 4, size);
    ctx.moveTo(cx + 12, size * 0.74);
    ctx.lineTo(cx + 4, size);
  });
  // Neck and face.
  ctx.fillStyle = look.skin;
  ctx.fillRect(cx - 6, size * 0.56, 12, 12);
  ctx.beginPath();
  ctx.ellipse(cx, size * 0.42, 15, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  if (look.hood) {
    ctx.fillStyle = '#161c29';
    ctx.beginPath();
    ctx.moveTo(cx - 24, size * 0.72);
    ctx.quadraticCurveTo(cx - 28, size * 0.08, cx, size * 0.1);
    ctx.quadraticCurveTo(cx + 28, size * 0.08, cx + 24, size * 0.72);
    ctx.lineTo(cx + 15, size * 0.66);
    ctx.quadraticCurveTo(cx + 18, size * 0.28, cx, size * 0.26);
    ctx.quadraticCurveTo(cx - 18, size * 0.28, cx - 15, size * 0.66);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0c1018';
    ctx.fillRect(cx - 14, size * 0.5, 28, 12);
  } else {
    ctx.fillStyle = '#12151c';
    ctx.beginPath();
    ctx.moveTo(cx - 16, size * 0.42);
    ctx.quadraticCurveTo(cx - 18, size * 0.14, cx + 2, size * 0.16);
    ctx.quadraticCurveTo(cx + 18, size * 0.18, cx + 16, size * 0.36);
    ctx.quadraticCurveTo(cx + 2, size * 0.26, cx - 12, size * 0.4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.save();
  ctx.fillStyle = look.accent;
  ctx.shadowColor = look.accent;
  ctx.shadowBlur = 10;
  ctx.fillRect(cx - 14, size * 0.38, 28, 5);
  ctx.restore();
}

/** Soft blob shadow, generic glow sprite and a screen vignette. */
export function createEffectTextures(scene: Phaser.Scene): void {
  {
    const { canvas, ctx } = makeCanvas(96, 48);
    ctx.translate(48, 24);
    ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 46);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.fill();
    registerCanvas(scene, 'fx-shadow', canvas);
  }
  {
    const { canvas, ctx } = makeCanvas(64, 64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    registerCanvas(scene, 'fx-glow', canvas);
  }
  {
    const { canvas, ctx } = makeCanvas(480, 270);
    const g = ctx.createRadialGradient(240, 135, 80, 240, 135, 290);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 480, 270);
    registerCanvas(scene, 'fx-vignette', canvas);
  }
}
