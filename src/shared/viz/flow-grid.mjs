/**
 * @flow
 */
import { vecLength, vecNormalize } from "./helpers.mjs";

export class FlowGrid {
  constructor(width, height, resolution) {
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

  getVector(x, y) {
    const ry = Math.floor((y / this.height) * this.resolution.y);
    const rx = Math.floor((x / this.width) * this.resolution.x);
    return this.vectors[ry * this.resolution.x + rx];
  }
}
