import { lerp, vecLength, vecNormalize } from "./helpers.ts";
import type { IVisualization } from "./visualization-type.ts";
import { FlowGrid } from "./flow-grid.ts";
import { alphaAdditiveBlend } from "./back-buffer.ts";

const MAX_PARTICLES = 128;
const MAX_SIZE = 12;
const MIN_SIZE = 1;
const FLOW_GRID_RESOLUTION = 8;
const MAX_ATTRACTOR_DISTANCE = 6;
const ATTRACTOR_STRENGTH = 40;
const ATTRACTOR_JITTER = 0.01;
const BASE_FRAME_TIME = 16;

type ParticleType = {
  x: number;
  y: number;
  age: number;
  ttl: number;
  size: number;
  bright: {
    r: number;
    g: number;
    b: number;
  };
  dim: {
    r: number;
    g: number;
    b: number;
  };
};

type AttractorType = {
  x: number;
  y: number;
  dx: number;
  strength: number;
  maxDistance: number;
};

function initParticles(): Array<ParticleType> {
  const particles: Array<ParticleType> = [];
  while (particles.length < MAX_PARTICLES) {
    particles.push(
      genParticle({
        x: 0,
        y: 0,
        ttl: 0,
        size: 0,
        age: 0,
        bright: { r: 0, g: 0, b: 0 },
        dim: { r: 0, g: 0, b: 0 },
      })
    );
  }
  return particles;
}

function genParticle(p: ParticleType): ParticleType {
  p.x = Math.random() * 63;
  p.y = 31;
  p.ttl = Math.random() * 32;
  p.bright.r = 0.75 + Math.random() * 0.25;
  p.bright.g = 0.15 + Math.random() * 0.25;
  p.bright.b = 0.025 + Math.random() * 0.125;
  p.dim.r = 0.0;
  p.dim.g = 0.0;
  p.dim.b = 0.0;
  p.size = MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE);
  p.age = 0;
  return p;
}

function applyPointAttractors(
  grid: FlowGrid,
  attractors: Array<AttractorType>
) {
  grid.map((x, y, v) => {
    v.y = -1;
    v.x = 0;
    for (let a of attractors) {
      const attractorDirection = { x: a.x - x, y: a.y - y };
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
  });
}

export default function (width: number, height: number): IVisualization {
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
    name: "Fire",
    audio: "fire.mp3",
    volume: 30,
    run: (backbuffer, _audio, _location, dt, _t) => {
      const speed = dt / BASE_FRAME_TIME;

      // cycle the attractor back and forth
      for (let a of attractors) {
        a.x += a.dx * speed;
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

      backbuffer.clear();

      // draw background gradient
      for (let i = height - 1; i >= 0; --i) {
        const c = {
          r: Math.pow(i / (height - 1), 6) * 255,
          g: Math.pow((i / (height - 1)) * 0.25, 6) * 255,
          b: 0,
          a: 255,
        };
        backbuffer.fgColor(c).drawLine(0, i, width - 1, i);
      }

      // render particles
      backbuffer.blendMode(alphaAdditiveBlend);
      for (let i = 0; i < particles.length; ++i) {
        let p = particles[i];
        p.age += speed;
        if (p.age >= p.ttl) {
          genParticle(p);
        }
        const vec = grid.getVector(p.x, p.y);
        p.y += vec.y * speed;
        p.x += vec.x * speed;

        const l = 1.0 - p.age / p.ttl;
        const size = p.size * l * 0.5;
        const color = {
          r: lerp(p.dim.r, p.bright.r, l) * 255,
          g: lerp(p.dim.g, p.bright.g, l) * 255,
          b: lerp(p.dim.b, p.bright.b, l) * 255,
          a: 128,
        };

        backbuffer
          .fgColor(color)
          .fill(p.x - size, p.y - size, p.x + size, p.y + size);
      }
    },
  };
}
