import type { Vec2 } from "./helpers.ts";

export class FlowGrid {
  resolution: Vec2;
  vectors: Array<Vec2>;
  width: number;
  height: number;

  constructor(width: number, height: number, resolution: Vec2) {
    this.vectors = [];
    this.width = width;
    this.height = height;
    this.resolution = resolution;

    for (let y = 0; y < this.resolution.y; ++y) {
      for (let x = 0; x < this.resolution.x; ++x) {
        this.vectors.push({ x: 0.0, y: -1.0 });
      }
    }
  }

  getVector(x: number, y: number): Vec2 {
    const ry = Math.floor((y / this.height) * this.resolution.y);
    const rx = Math.floor((x / this.width) * this.resolution.x);
    return this.vectors[ry * this.resolution.x + rx];
  }

  map(cb: (x: number, y: number, v: Vec2) => void) {
    for (let y = 0; y < this.resolution.y; ++y) {
      for (let x = 0; x < this.resolution.x; ++x) {
        const v = this.vectors[y * this.resolution.y + x];
        cb(x, y, v);
      }
    }
  }
}
