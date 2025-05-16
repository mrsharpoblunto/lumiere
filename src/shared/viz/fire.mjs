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

  return {
    name: 'Fire',
    audio: 'fire.mp3',
    light: {
      bri: 254,
      hue: 65440,
      sat: 202,
    },
    volume: 30,
    run: (matrix, audio, dt, t) => {
      matrix.brightness(100).clear();

      // cycle the attractor back and forth
      for (let a of attractors) {
        a.x += a.dx;
        if (Math.random() < ATTRACTOR_JITTER) {
          a.dx *= -1;
        }
        if (a.x > grid.resolution.x - 1) {
          a.dx = Math.abs(a.dx) * -1;
        }
        if (a.x < 0) {
          a.dx = Math.abs(a.dx);
        }
      }
      applyPointAttractors(grid, attractors);

      // draw background gradient
      for (let i = height - 1; i >= 0; --i) {
        const c = {
          r: Math.pow(i / (height - 1), 6) * 255,
          g: Math.pow((i / (height - 1)) * 0.25, 6) * 255,
          b: 0,
        };
        matrix.fgColor(c).drawLine(0, i, width - 1, i);
      }

      // render particles
      for (let i = 0; i < particles.length; ++i) {
        let p = particles[i];
        if (++p.age >= p.ttl) {
          genParticle(p);
        }
        const vec = grid.getVector(p.x, p.y);
        p.y += vec.y;
        p.x += vec.x;

        const l = 1.0 - p.age / p.ttl;
        const size = p.size * l * 0.5;
        const color = {
          r: lerp(p.dim.r, p.bright.r, l) * 255,
          g: lerp(p.dim.g, p.bright.g, l) * 255,
          b: lerp(p.dim.b, p.bright.b, l) * 255,
        };

        matrix
          .fgColor(color)
          .fill(p.x - size, p.y - size, p.x + size, p.y + size);
      }

      if (process.env.NODE_ENV !== 'production') {
        matrix.fgColor({r: 255, g: 255, b: 255});
        for (let a of attractors) {
          matrix.setPixel(
            ((a.x + 0.5) / grid.resolution.x) * matrix.width(),
            1,
          );
        }
        matrix.fgColor({r: 0, g: 0, b: 255});
        for (let y = 0; y < grid.resolution.y; ++y) {
          for (let x = 0; x < grid.resolution.x; ++x) {
            const v = grid.vectors[y * grid.resolution.x + x];
            const center = {
              x: ((x + 0.5) / grid.resolution.x) * matrix.width(),
              y: ((y + 0.5) / grid.resolution.y) * matrix.height(),
            };
            matrix.drawLine(
              center.x - v.x,
              center.y - v.y,
              center.x + v.x,
              center.y + v.y,
            );
          }
        }
      }
    },
  };
}
