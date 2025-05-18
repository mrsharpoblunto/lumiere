import type { Color, LedMatrixInstance } from "./visualization-type.ts";

export type Vec2 = {
  x: number;
  y: number;
};

export function lerp<T extends number | Vec2 | Color>(
  v0: T,
  v1: T,
  t: number
): T {
  if (typeof v0 === "number" && typeof v1 === "number") {
    return (v0 * (1 - t) + v1 * t) as T;
  } else if (
    typeof v0 === "object" &&
    "x" in v0 &&
    "y" in v0 &&
    typeof v1 === "object" &&
    "x" in v1 &&
    "y" in v1
  ) {
    return {
      x: lerp(v0.x, v1.x, t),
      y: lerp(v0.y, v1.y, t),
    } as T;
  } else if (
    typeof v0 === "object" &&
    "r" in v0 &&
    "g" in v0 &&
    "b" in v0 &&
    typeof v1 === "object" &&
    "r" in v1 &&
    "g" in v1 &&
    "b" in v1
  ) {
    return {
      r: lerp(v0.r, v1.r, t),
      g: lerp(v0.g, v1.g, t),
      b: lerp(v0.b, v1.b, t),
    } as T;
  } else {
    throw new Error("Invalid types for lerp");
  }
}

export function mul<T extends number | Vec2 | Color>(
  v0: T,
  f: number,
  max: number
): T {
  if (typeof v0 === "number") {
    return Math.min(v0 * f, max) as T;
  } else if (typeof v0 === "object" && "x" in v0 && "y" in v0) {
    return {
      x: Math.min(v0.x * f, max),
      y: Math.min(v0.y * f, max),
    } as T;
  } else if (typeof v0 === "object" && "r" in v0 && "g" in v0 && "b" in v0) {
    return {
      r: Math.min(v0.r * f, max),
      g: Math.min(v0.g * f, max),
      b: Math.min(v0.b * f, max),
    } as T;
  } else {
    throw new Error("Invalid types for lerp");
  }
}

export function colorEquals(c0: Color, c1: Color): boolean {
  return c0.r === c1.r && c0.g === c1.g && c0.b === c1.b;
}

export function vecNormalize(v: Vec2): Vec2 {
  const l = vecLength(v);
  v.x /= l;
  v.y /= l;
  return v;
}

export function vecLength(v: Vec2): number {
  return Math.sqrt(Math.pow(v.x, 2) + Math.pow(v.y, 2));
}

export type Asset = {
  width: number;
  height: number;
  data: number[];
};

export function drawAsset(
  matrix: LedMatrixInstance,
  x: number,
  y: number,
  asset: Asset
): LedMatrixInstance {
  const { width, height, data } = asset;

  const FUCHSIA = [255, 0, 255];

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      // Calculate index in the data array (3 values per pixel - r,g,b)
      const idx = (py * width + px) * 3;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Skip fuchsia (transparent) pixels
      if (r === FUCHSIA[0] && g === FUCHSIA[1] && b === FUCHSIA[2]) {
        continue;
      }

      const targetX = x + px;
      const targetY = y + py;
      if (targetX >= 0 && targetY >= 0) {
        matrix.fgColor({ r, g, b }).setPixel(targetX, targetY);
      }
    }
  }

  return matrix;
}

export function drawAssetsLerp(
  matrix: LedMatrixInstance,
  x: number,
  y: number,
  asset1: Asset,
  asset2: Asset,
  l: number
) {
  const { width, height, data } = asset1;

  const FUCHSIA = [255, 0, 255];

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      // Calculate index in the data array (3 values per pixel - r,g,b)
      const idx = (py * width + px) * 3;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Skip fuchsia (transparent) pixels
      if (r === FUCHSIA[0] && g === FUCHSIA[1] && b === FUCHSIA[2]) {
        continue;
      }

      const targetX = x + px;
      const targetY = y + py;
      if (targetX >= 0 && targetY >= 0) {
        const c = {
          r: asset2.data[idx],
          g: asset2.data[idx + 1],
          b: asset2.data[idx + 2],
        };
        matrix.fgColor(lerp({ r, g, b }, c, l)).setPixel(targetX, targetY);
      }
    }
  }

  return matrix;
}
