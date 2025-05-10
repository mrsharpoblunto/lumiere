/**
 * @format
 */
import {lerp, vecLength, vecNormalize} from './helpers.mjs';
import {FlowGrid} from './flow-grid.mjs';

const MAX_PARTICLES = 64;
const MAX_SIZE = 10;
const MIN_SIZE = 1;
const FLOW_GRID_RESOLUTION = 8;
const MAX_ATTRACTOR_DISTANCE = 6;
const ATTRACTOR_STRENGTH = 40;
const ATTRACTOR_JITTER = 0.01;

function initParticles() {
  const particles = [];
  while (particles.length < MAX_PARTICLES) {
    particles.push(genParticle({bright: {}, dim: {}}));
  }
  return particles;
}

function genParticle(p) {
  p.x = Math.random() * 63;
  p.y = 31;
  p.ttl = Math.random() * 24;
  p.bright.r = 0.75 + Math.random() * 0.25;
  p.bright.g = 0.15 + Math.random() * 0.25;
  p.bright.b = 0.025 + Math.random() * 0.125;
  p.dim.r = p.dim.g = p.dim.b = 0.0;
  p.size = MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE);
  p.age = 0;
  return p;
}

function applyPointAttractors(grid, attractors) {
  for (let y = 0; y < grid.resolution.y; ++y) {
    for (let x = 0; x < grid.resolution.x; ++x) {
      const v = grid.vectors[y * grid.resolution.y + x];
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

export default function (width, height) {
  /**
  const particles = initParticles();
  const grid = new FlowGrid(width, height, {
    x: FLOW_GRID_RESOLUTION,
    y: FLOW_GRID_RESOLUTION,
  });
  const attractors = [
    {
      x: 0,
      y: -1,
      dx: Math.random() * 0.04 - 0.02,
      strength: ATTRACTOR_STRENGTH,
      maxDistance: MAX_ATTRACTOR_DISTANCE,
    },
    {
      x: FLOW_GRID_RESOLUTION - 1,
      y: -1,
      dx: Math.random() * 0.04 - 0.02,
      strength: ATTRACTOR_STRENGTH,
      maxDistance: MAX_ATTRACTOR_DISTANCE,
    },
  ];
  */

  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);

  // colors
  const lightBrown = {r: 137, g: 91, b: 54};
  const midBrown = {r: 87, g: 56, b: 34};
  const darkBrown = {r: 71, g: 46, b: 31};
  const background = {r: 106, g: 156, b: 156};
  const shadow = {r: background.r - 25, g: background.g - 25, b: background.b - 25};

  return {
    name: 'Bonsai',
    audio: 'audio/fire.mp3',
    light: {
      bri: 254,
      hue: 65440,
      sat: 202,
    },
    run: (matrix, _dt, _t) => {
      matrix.clear();

      // draw background
      matrix.fgColor(background).fill();

      // tray shadow
      matrix.fgColor(shadow)
        .drawLine(cx - 12, height - 3, cx + 12, height - 3)
        .drawLine(cx - 10, height - 2, cx + 10, height - 2);

      // draw bonsai tray
      matrix.fgColor({ r: 58, g: 82, b: 36}).drawLine(cx - 9, height - 7, cx + 9, height - 7);
      matrix.fgColor(lightBrown).drawLine(cx - 12, height - 6, cx + 12, height - 6);
      matrix.fgColor(darkBrown).drawLine(cx - 11, height - 5, cx + 11, height - 5);
      matrix.fgColor(midBrown).drawLine(cx - 10, height - 4, cx + 10, height - 4);
      matrix.fgColor(darkBrown).drawLine(cx - 10, height - 3, cx - 7, height - 3);
      matrix.fgColor(darkBrown).drawLine(cx + 7, height - 3, cx + 10, height - 3);

      // bonsai trunk
      matrix.fgColor(darkBrown).drawLine(cx - 4, height - 7, cx - 1, height - 7);
      matrix.fgColor(darkBrown).drawLine(cx+1, height - 7, cx + 3, height - 7);
      matrix.fgColor(midBrown).setPixel(cx+4, height - 7);
      matrix.fgColor(darkBrown).setPixel(cx+6, height - 7);


    },
  };
}
