/**
 * @format
 */
import {colorEquals, lerpColor, vecLength, vecNormalize} from './helpers.mjs';
import * as background from '../assets/cherry-blossom-background.mjs';
import * as cloud1 from '../assets/cherry-blossom-cloud-1.mjs';
import * as cloud2 from '../assets/cherry-blossom-cloud-2.mjs';
import * as cloud3 from '../assets/cherry-blossom-cloud-3.mjs';
import * as cloud4 from '../assets/cherry-blossom-cloud-4.mjs';
import * as cloud5 from '../assets/cherry-blossom-cloud-5.mjs';
import * as foliage from '../assets/cherry-blossom-foliage.mjs';

import {FlowGrid} from './flow-grid.mjs';
import { drawAsset } from './helpers.mjs';

const MAX_CLOUDS = 4;
const MIN_CLOUD_SPEED = 0.005;
const MAX_CLOUD_SPEED = 0.01;
const MIN_FOLIAGE_TTL = 128;
const MAX_FOLIAGE_TTL = 256;
const FOLIAGE_ADJUSTMENTS = 16;

const MAX_PARTICLES = 8;
const PARTICLE_FALL_SPEED = 0.05;
const PARTICLE_MIN_X = 0.3;

const FLOW_GRID_RESOLUTION = 8;
const MAX_ATTRACTOR_DISTANCE = 8;
const ATTRACTOR_STRENGTH = 1;
const ATTRACTOR_MIN_VELOCITY = 0.02;
const ATTRACTOR_MAX_VELOCITY = 0.04;

function applyPointAttractors(grid, attractors) {
  for (let y = 0; y < grid.resolution.y; ++y) {
    for (let x = 0; x < grid.resolution.x; ++x) {
      const v = grid.vectors[y * grid.resolution.y + x];
      v.y = 1;
      v.x = PARTICLE_MIN_X;
      for (let a of attractors) {
        const attractorDirection = {x: a.x - x, y: a.y - y};
        const distance = vecLength(attractorDirection);
        if (distance !== 0) {
          const scaledDistance =
            Math.min(distance, a.maxDistance) / a.maxDistance;
          v.x += (1.0 - scaledDistance) * a.strength;
        }
      }
      vecNormalize(v);
    }
  }
}

export default function (width, height) {
  const cx = Math.floor(width / 2);

  const grid = new FlowGrid(width, height, {
    x: FLOW_GRID_RESOLUTION,
    y: FLOW_GRID_RESOLUTION,
  });
  const attractors = [
    {
      x: Math.random() * FLOW_GRID_RESOLUTION,
      y: Math.random() * FLOW_GRID_RESOLUTION,
      dx: (Math.random() * (ATTRACTOR_MAX_VELOCITY - ATTRACTOR_MIN_VELOCITY)) + ATTRACTOR_MIN_VELOCITY,
      strength: ATTRACTOR_STRENGTH,
      maxDistance: MAX_ATTRACTOR_DISTANCE,
    },
    {
      x: Math.random() * FLOW_GRID_RESOLUTION,
      y: Math.random() * FLOW_GRID_RESOLUTION,
      dx: (Math.random() * (ATTRACTOR_MAX_VELOCITY - ATTRACTOR_MIN_VELOCITY)) + ATTRACTOR_MIN_VELOCITY,
      strength: ATTRACTOR_STRENGTH,
      maxDistance: MAX_ATTRACTOR_DISTANCE,
    },
  ];


  // colors
  const skyBottom = {r: 179, g: 206, b: 191};
  const skyTop = {r: 98, g: 175, b: 203};
  const foliageDark = {r: 132, g: 96, b: 99};
  const foliageMid = {r: 202, g: 104, b: 107}; 
  const foliageLight = {r: 227, g: 171, b: 173};

  const availableClouds = [
    cloud1,
    cloud2,
    cloud3,
    cloud4,
    cloud5,
  ];
  const clouds = [];
  const foliageFlicker = [];
  const particles = [];

  return {
    name: 'Bonsai',
    audio: 'audio/bonsai.mp3',
    light: {
      bri: 254,
      hue: 65440,
      sat: 202,
    },
    run: (matrix, _dt, _t) => {
      // update clouds
      for (let i = 0; i < clouds.length; ++i) {
        const cloud = clouds[i];
        if (cloud.cloud) {
          cloud.x += cloud.vx;
          if (cloud.x > width) {
            clouds.splice(i, 1);
            --i;
          }
        }
      }
      const firstRun = clouds.length === 0;
      while (clouds.length < MAX_CLOUDS) {
        const index = Math.floor(Math.random() * availableClouds.length);
        const vx = Math.random() * (MAX_CLOUD_SPEED - MIN_CLOUD_SPEED) + MIN_CLOUD_SPEED;
        if (index < availableClouds.length) {
          const cloud = availableClouds[index];
          clouds.push({
            cloud,
            x: -cloud.width + (firstRun ? Math.random() * width: 0),
            y: Math.floor(Math.random() * (height - cloud.height) - 3),
            vx,
          });
        } else {
          clouds.push({
            cloud: null,
            x: (firstRun ? Math.random() * width : 0),
            y: 0,
            vx,
          });
        }
      }

      // update foliage flicker
      for (let i = 0; i < foliageFlicker.length; ++i) {
        const f = foliageFlicker[i];
        --f.ttl;
        if (f.ttl <= 0) {
          foliageFlicker.splice(i, 1);
          --i;
        }
      }
      if (foliageFlicker.length < FOLIAGE_ADJUSTMENTS) {
        const additions = FOLIAGE_ADJUSTMENTS - foliageFlicker.length;
        for (let i = 0; i < additions; ++i) {
          const x = Math.floor(Math.random() * (foliage.width - 1));
          const y = Math.floor(Math.random() * (foliage.height - 1));
          const foliageIndex = (y * foliage.width + x) * 3;
          let foliageColor = {
            r: foliage.data[foliageIndex],
            g: foliage.data[foliageIndex + 1],
            b: foliage.data[foliageIndex + 2],
          };
          // check its not transparent
          if (foliageColor.r !== 255 || foliageColor.g !== 0 || foliageColor.b !== 255) {
            if (colorEquals(foliageColor, foliageDark)) {
              foliageColor = foliageMid;
            } else if (colorEquals(foliageColor, foliageMid)) {
              foliageColor = foliageLight;
            } else if (colorEquals(foliageColor, foliageLight)) {
              foliageColor = Math.random() < 0.5 ? 
                foliageMid :
                lerpColor(skyBottom, skyTop, 1.0 - ((y+1) / height));
            }
            foliageFlicker.push({
              x: cx - foliage.width / 2 + x,
              y: y + 1,
              ttl: Math.floor(Math.random() * (MAX_FOLIAGE_TTL - MIN_FOLIAGE_TTL) + MIN_FOLIAGE_TTL),
              color: foliageColor,
            });
          }
        }
      }

      // update attractors
      for (let i = 0; i < attractors.length; ++i) {
        const a = attractors[i];
        a.x += a.dx;
        if (a.x > grid.resolution.x) {
          a.x = 0;
          a.y = Math.random() * FLOW_GRID_RESOLUTION;
        }
      }

      // update particles
      applyPointAttractors(grid, attractors);
      for (let i = 0; i < particles.length; ++i) {
        const p = particles[i];
        if (p.y < 0 || p.y >= height || p.x < 0 || p.x >= width) {
          particles.splice(i, 1);
          --i;
        }
      }
      if (particles.length < MAX_PARTICLES) {
        const additions = MAX_PARTICLES - particles.length;
        for (let i = 0; i < additions; ++i) {
          const x = Math.floor(Math.random() * (foliage.width - 1));
          const y = Math.floor(Math.random() * (foliage.height - 1));
          const foliageIndex = (y * foliage.width + x) * 3;
          let foliageColor = {
            r: foliage.data[foliageIndex],
            g: foliage.data[foliageIndex + 1],
            b: foliage.data[foliageIndex + 2],
          };
          // check its not transparent
          if (foliageColor.r !== 255 || foliageColor.g !== 0 || foliageColor.b !== 255) {
            particles.push({
              x: cx - foliage.width / 2 + x,
              y: y + 1,
              color: lerpColor(foliageMid, foliageLight, Math.random()),
            });
          }
        }
      }

      matrix.clear();

      // draw background
      for (let y = 0; y < height; y++) {
        matrix.fgColor(lerpColor(skyBottom, skyTop, 1.0 - (y / height))).drawLine(0, y, width, y);
      }

      // draw clouds
      for (let i = 0; i < clouds.length; ++i) {
        const cloud = clouds[i];
        if (cloud.cloud) {
          drawAsset(matrix, cloud.x, cloud.y, cloud.cloud);
        }
      }

      // draw background
      drawAsset(matrix, 0, 0, background);

      // draw foliage
      drawAsset(matrix, cx - foliage.width / 2, 1, foliage);
      for (let i = 0; i < foliageFlicker.length; ++i) {
        const f = foliageFlicker[i];
        matrix.setPixel(f.x, f.y, f.color);
      }

      // draw particles
      for (let i = 0; i < particles.length; ++i) {
        let p = particles[i];
        const vec = grid.getVector(p.x, p.y);
        p.y += vec.y * PARTICLE_FALL_SPEED;
        p.x += vec.x * PARTICLE_FALL_SPEED;
        matrix.setPixel(Math.floor(p.x), Math.floor(p.y), p.color);
      }


      if (process.env.NODE_ENV !== 'production') {
        matrix.fgColor({r: 255, g: 255, b: 255});
        for (let a of attractors) {
          matrix.setPixel(
            ((a.x + 0.5) / grid.resolution.x) * width,
            ((a.y + 0.5) / grid.resolution.y) * height,
          );
        }
        matrix.fgColor({r: 0, g: 0, b: 255});
        for (let y = 0; y < grid.resolution.y; ++y) {
          for (let x = 0; x < grid.resolution.x; ++x) {
            const v = grid.vectors[y * grid.resolution.x + x];
            const center = {
              x: ((x + 0.5) / grid.resolution.x) * width,
              y: ((y + 0.5) / grid.resolution.y) * height,
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
