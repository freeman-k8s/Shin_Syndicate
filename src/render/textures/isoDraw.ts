import { polygon, type Point } from './canvas.ts';

/** Maps a 3D point (x, y in tiles, z in pixels upwards) to canvas pixels. */
export type Projector = (x: number, y: number, z?: number) => Point;

export interface BoxColors {
  readonly top: string | CanvasGradient;
  /** Face looking towards +y (lower-left on screen). */
  readonly left: string | CanvasGradient;
  /** Face looking towards +x (lower-right on screen). */
  readonly right: string | CanvasGradient;
}

export interface BoxFaces {
  readonly top: Point[];
  readonly left: Point[];
  readonly right: Point[];
}

/** Corner points of the three visible faces of an axis-aligned box. */
export function boxFaces(project: Projector, x: number, y: number, w: number, d: number, z: number, h: number): BoxFaces {
  return {
    top: [project(x, y, z + h), project(x + w, y, z + h), project(x + w, y + d, z + h), project(x, y + d, z + h)],
    left: [project(x, y + d, z), project(x + w, y + d, z), project(x + w, y + d, z + h), project(x, y + d, z + h)],
    right: [project(x + w, y + d, z), project(x + w, y, z), project(x + w, y, z + h), project(x + w, y + d, z + h)],
  };
}

export function drawBox(
  ctx: CanvasRenderingContext2D,
  project: Projector,
  x: number,
  y: number,
  w: number,
  d: number,
  z: number,
  h: number,
  colors: BoxColors,
): BoxFaces {
  const faces = boxFaces(project, x, y, w, d, z, h);
  ctx.fillStyle = colors.left;
  polygon(ctx, faces.left);
  ctx.fill();
  ctx.fillStyle = colors.right;
  polygon(ctx, faces.right);
  ctx.fill();
  ctx.fillStyle = colors.top;
  polygon(ctx, faces.top);
  ctx.fill();
  return faces;
}

/** Projector for a single-tile sprite whose tile centre sits at canvas (ox, oy); x, y are 0..1 within the tile. */
export function tileProjector(ox: number, oy: number, halfWidth: number, halfHeight: number): Projector {
  return (x, y, z = 0) => ({
    x: ox + (x - y) * halfWidth,
    y: oy + (x + y - 1) * halfHeight - z,
  });
}
