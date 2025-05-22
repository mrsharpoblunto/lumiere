import type { RGBAColor } from "./back-buffer.ts";

export type Vec2 = {
  x: number;
  y: number;
};

export function lerp<T extends number | Vec2 | RGBAColor>(
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
    "a" in v0 &&
    typeof v1 === "object" &&
    "r" in v1 &&
    "g" in v1 &&
    "b" in v1 &&
    "a" in v1
  ) {
    return {
      r: lerp(v0.r, v1.r, t),
      g: lerp(v0.g, v1.g, t),
      b: lerp(v0.b, v1.b, t),
      a: lerp(v0.a, v1.a, t),
    } as T;
  } else {
    throw new Error("Invalid types for lerp");
  }
}

export function mul<T extends number | Vec2 | RGBAColor>(
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
  } else if (
    typeof v0 === "object" &&
    "r" in v0 &&
    "g" in v0 &&
    "b" in v0 &&
    "a" in v0
  ) {
    return {
      r: Math.min(v0.r * f, max),
      g: Math.min(v0.g * f, max),
      b: Math.min(v0.b * f, max),
      a: Math.min(v0.a * f, max),
    } as T;
  } else {
    throw new Error("Invalid types for lerp");
  }
}

export function colorEquals(c0: RGBAColor, c1: RGBAColor): boolean {
  return c0.r === c1.r && c0.g === c1.g && c0.b === c1.b && c0.a === c1.a;
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

export function colorLuminance(color: RGBAColor): number {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
