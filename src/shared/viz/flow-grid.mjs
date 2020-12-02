/**
 * @flow
 */
import {vecLength, vecNormalize} from './helpers.mjs';

export class FlowGrid {
  constructor(width, height, resolution) {
    this.vectors = [];
    this.width = width;
    this.height = height;
    this.resolution = resolution;

    for (let y = 0; y < this.resolution.y; ++y) {
      for (let x = 0; x < this.resolution.x; ++x) {
        this.vectors.push({x: 0.0, y: -1.0});
      }
    }
  }

  adjust(attractors) {
    for (let y = 0; y < this.resolution.y; ++y) {
      for (let x = 0; x < this.resolution.x; ++x) {
        const v = this.vectors[y * this.resolution.y + x];
        v.y = -1;
        v.x = 0;
        for (let a of attractors) {
          const attractorDirection = {x: a.x - x, y: a.y - y};
          const distance = vecLength(attractorDirection);
          if (distance !== 0) {
            attractorDirection.x /= distance;
            attractorDirection.y /= distance;
            const scaledDistance =
              Math.min(distance, a.maxDistance) / a.maxDistance;
            v.x += attractorDirection.x * (1.0 - scaledDistance) * a.strength;
            v.y += attractorDirection.y * (1.0 - scaledDistance) * a.strength;
          }
        }
        vecNormalize(v);
      }
    }
  }

  getVector(x, y) {
    const ry = Math.floor((y / this.height) * this.resolution.y);
    const rx = Math.floor((x / this.width) * this.resolution.x);
    return this.vectors[ry * this.resolution.x + rx];
  }
}
