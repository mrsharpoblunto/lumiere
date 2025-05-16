/**
 * @format
 */
import {colorEquals, lerpColor, vecLength, vecNormalize} from './helpers.mjs';
import * as background from '../assets/cherry-blossom-background.mjs';
import * as foliage from '../assets/cherry-blossom-foliage.mjs';
import * as cloud1 from '../assets/cherry-blossom-cloud-1.mjs';
import * as cloud2 from '../assets/cherry-blossom-cloud-2.mjs';
import * as cloud3 from '../assets/cherry-blossom-cloud-3.mjs';
import * as cloud4 from '../assets/cherry-blossom-cloud-4.mjs';
import * as cloud5 from '../assets/cherry-blossom-cloud-5.mjs';
import * as backgroundNight from '../assets/cherry-blossom-background-night.mjs';
import * as foliageNight from '../assets/cherry-blossom-foliage-night.mjs';
import * as cloud1Night from '../assets/cherry-blossom-cloud-1-night.mjs';
import * as cloud2Night from '../assets/cherry-blossom-cloud-2-night.mjs';
import * as cloud3Night from '../assets/cherry-blossom-cloud-3-night.mjs';
import * as cloud4Night from '../assets/cherry-blossom-cloud-4-night.mjs';
import * as cloud5Night from '../assets/cherry-blossom-cloud-5-night.mjs';
import * as foliageSunset from '../assets/cherry-blossom-foliage-sunset.mjs';
import * as backgroundSunset from '../assets/cherry-blossom-background-sunset.mjs';
import * as cloud1Sunset from '../assets/cherry-blossom-cloud-1-sunset.mjs';
import * as cloud2Sunset from '../assets/cherry-blossom-cloud-2-sunset.mjs';
import * as cloud3Sunset from '../assets/cherry-blossom-cloud-3-sunset.mjs';
import * as cloud4Sunset from '../assets/cherry-blossom-cloud-4-sunset.mjs';
import * as cloud5Sunset from '../assets/cherry-blossom-cloud-5-sunset.mjs';
import * as moon from '../assets/moon.mjs';

import { LATITUDE, LONGITUDE } from '../config.mjs';
import SunCalc from 'suncalc';

import {FlowGrid} from './flow-grid.mjs';
import { drawAsset, drawAssetsLerp } from './helpers.mjs';

const MAX_STARS = 64;
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
  const dayPalette = {
    skyBottom: {r: 179, g: 206, b: 191},
    skyTop: {r: 98, g: 175, b: 203},
    foliageDark: {r: 132, g: 96, b: 99},
    foliageMid: {r: 202, g: 104, b: 107},
    foliageLight: {r: 227, g: 171, b: 173},
    background,
    foliage,
    availableClouds: [
      cloud1,
      cloud2,
      cloud3,
      cloud4,
      cloud5,
    ],
  };
  const sunxPalette = {
    skyBottom: {r: 251, g: 66, b: 1},
    skyTop: {r: 30, g: 51, b: 100},
    foliageDark: {r: 134, g: 60, b: 83},
    foliageMid: {r: 233, g: 28, b: 84},
    foliageLight: {r: 227, g: 111, b: 142},
    background: backgroundSunset,
    foliage: foliageSunset,
    availableClouds: [
      cloud1Sunset,
      cloud2Sunset,
      cloud3Sunset,
      cloud4Sunset,
      cloud5Sunset,
    ],
  };
  const nightPalette = {
    skyBottom: {r: 17, g: 45, b: 77},
    skyTop: {r: 11, g: 31, b: 36},
    foliageDark: {r: 28, g: 37, b: 63},
    foliageMid: {r: 27, g: 51, b: 178},
    foliageLight: {r: 116, g: 140, b: 228},
    background: backgroundNight,
    foliage: foliageNight,
    availableClouds: [
      cloud1Night,
      cloud2Night,
      cloud3Night,
      cloud4Night,
      cloud5Night,
    ],
  };

  const clouds = [];
  const foliageFlicker = [];
  const particles = [];
  const stars = [];
  let prevDate = null;
  let sunRiseStart = null;
  let sunRisePeak = null;
  let sunRiseEnd = null;
  let sunSetStart = null;
  let sunSetPeak = null;
  let sunSetEnd = null;

  return {
    name: 'Bonsai',
    light: {
      bri: 204,
      hue: 35680,
      sat: 133,
    },
    volume: 12,
    run: (matrix, audio, _dt, _t) => {
      let now = new Date();
      if (!prevDate || now.getDay() !== prevDate.getDay()) {
        const times = SunCalc.getTimes(new Date(),LATITUDE, LONGITUDE);
        prevDate = now;
        sunRiseStart = times.sunrise.getTime();
        sunRiseEnd = times.goldenHourEnd.getTime();
        sunRisePeak = sunRiseStart + ((sunRiseEnd - sunRiseStart) / 2);
        sunSetStart = times.sunsetStart.getTime();
        sunSetEnd = times.night.getTime();
        sunSetPeak = sunSetStart + ((sunSetEnd - sunSetStart) / 2);
      }

      let palette1 = dayPalette;
      let palette2 = dayPalette;
      let paletteLerp = 1.0;

      now = now.getTime();
      if (now >= sunRiseStart && now <= sunRisePeak) {
        // night -> sunrise
        palette1 = nightPalette;
        palette2 = sunxPalette;
        paletteLerp = (now - sunRiseStart) / (sunRisePeak - sunRiseStart);
        audio.queue('bonsai.mp3');
      } else if (now > sunRisePeak && now < sunRiseEnd) {
        // sunrise -> day
        palette1 = sunxPalette;
        palette2 = dayPalette;
        paletteLerp = (now - sunRisePeak) / (sunRiseEnd - sunRisePeak);
        audio.queue('bonsai.mp3');
      } else if (now > sunRiseEnd && now < sunSetStart) {
        audio.queue('bonsai.mp3');
        // day
      } else if (now >= sunSetStart && now <= sunSetPeak) {
        // day -> sunset
        palette1 = dayPalette;
        palette2 = sunxPalette;
        paletteLerp = (now - sunSetStart) / (sunSetPeak - sunSetStart);
        audio.queue('bonsai-night.mp3');
      } else if (now > sunSetPeak && now < sunSetEnd) {
        // sunset -> night
        palette1 = sunxPalette;
        palette2 = nightPalette;
        paletteLerp = (now - sunSetPeak) / (sunSetEnd - sunSetPeak);
        audio.queue('bonsai-night.mp3');
      } else {
        // night
        palette1 = palette2 = nightPalette;
        const interval = 86400*1000 - (sunSetEnd - sunRiseStart);
        if (now < sunSetEnd) {
          paletteLerp = (now + (86400*1000 - sunSetEnd)) / interval;
        } else {
          paletteLerp = (now - sunSetEnd) / interval;
        }
        audio.queue('bonsai-night.mp3');
      }

      // update clouds
      for (let i = 0; i < clouds.length; ++i) {
        const cloud = clouds[i];
        if (cloud.cloud>=0) {
          cloud.x += cloud.vx;
          if (cloud.x > width) {
            clouds.splice(i, 1);
            --i;
          }
        }
      }
      const firstRun = clouds.length === 0;
      while (clouds.length < MAX_CLOUDS) {
        const index = Math.floor(Math.random() * palette1.availableClouds.length);
        const vx = Math.random() * (MAX_CLOUD_SPEED - MIN_CLOUD_SPEED) + MIN_CLOUD_SPEED;
        if (index < palette1.availableClouds.length) {
          const cloud = palette1.availableClouds[index];
          clouds.push({
            cloud: index,
            x: -cloud.width + (firstRun ? Math.random() * width: 0),
            y: Math.floor(Math.random() * (height - cloud.height) - 3),
            vx,
          });
        } else {
          clouds.push({
            cloud: -1,
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
            if (colorEquals(foliageColor, dayPalette.foliageDark)) {
              foliageColor = lerpColor(palette1.foliageMid, palette2.foliageMid, paletteLerp);
            } else if (colorEquals(foliageColor, dayPalette.foliageMid)) {
              foliageColor = lerpColor(palette1.foliageLight, palette2.foliageLight, paletteLerp);
            } else if (colorEquals(foliageColor, dayPalette.foliageLight)) {
              foliageColor = Math.random() < 0.5 ? 
                lerpColor(palette1.foliageMid, palette2.foliageMid, paletteLerp) :
                lerpColor(
                  lerpColor(palette1.skyBottom, palette2.skyBottom, paletteLerp),
                  lerpColor(palette1.skyTop, palette2.skyTop, paletteLerp),
                  1.0 - ((y+1) / height));
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
              color: lerpColor(
                lerpColor(palette1.foliageMid, palette2.foliageMid, paletteLerp),
                lerpColor(palette1.foliageLight, palette2.foliageLight, paletteLerp),
                Math.random()),
            });
          }
        }
      }


      matrix.brightness(80).clear();

      // draw background
      for (let y = 0; y < height; y++) {
        matrix.fgColor(
          lerpColor(
            lerpColor(palette1.skyBottom, palette2.skyBottom, paletteLerp),
            lerpColor(palette1.skyTop, palette2.skyTop, paletteLerp),
            1.0 - ((y+1) / height))
        ).drawLine(0, y, width, y);
      }

      if (palette1 === nightPalette || palette2 === nightPalette) {
        if (stars.length === 0) {
          for (let i = 0; i < MAX_STARS; ++i) {
            stars.push({
              x: Math.floor(Math.random() * width),
              y: Math.floor(Math.pow(Math.random(), 2) * height),
              color: lerpColor({
                r: 33,
                g: 55,
                b: 71,
              }, {
                r: 88,
                g: 99,
                b: 108,
              },Math.random())
            });
          }
        }
        const l = palette1 === nightPalette && palette2 !== nightPalette ? 
          1.0 - paletteLerp : 
          palette1 === nightPalette && palette2 === nightPalette ? 1.0 : paletteLerp;
        for (let i = 0; i < stars.length; ++i) {
          const star = stars[i];
          const color = lerpColor(
            star.color,
            lerpColor(
              lerpColor(palette1.skyBottom, palette2.skyBottom, paletteLerp),
              lerpColor(palette1.skyTop, palette2.skyTop, paletteLerp),
              1.0 - ((star.y+1) / height)),
            Math.pow(star.y / height, l)
          );
          matrix.fgColor(color).setPixel(star.x, star.y);
        }
      }

      // draw the moon
      if (palette1 === nightPalette && palette2 === nightPalette) {
        drawAsset(matrix, cx + 5 + Math.pow(paletteLerp * 3,2)*cx, height - (height * paletteLerp * 3), moon);
      }

      // draw clouds
      for (let i = 0; i < clouds.length; ++i) {
        const cloud = clouds[i];
        if (cloud.cloud>=0) {
          drawAssetsLerp(
            matrix, 
            cloud.x, 
            cloud.y, 
            palette1.availableClouds[cloud.cloud], 
            palette2.availableClouds[cloud.cloud], 
            paletteLerp
          );
        }
      }

      // draw background
      drawAssetsLerp(matrix, 0, 0, palette1.background, palette2.background, paletteLerp);

      // draw foliage
      drawAssetsLerp(matrix, cx - foliage.width / 2, 1, palette1.foliage, palette2.foliage, paletteLerp);
      for (let i = 0; i < foliageFlicker.length; ++i) {
        const f = foliageFlicker[i];
        matrix.fgColor(f.color).setPixel(f.x, f.y);
      }

      // draw particles
      for (let i = 0; i < particles.length; ++i) {
        let p = particles[i];
        const vec = grid.getVector(p.x, p.y);
        p.y += vec.y * PARTICLE_FALL_SPEED;
        p.x += vec.x * PARTICLE_FALL_SPEED;
        matrix.fgColor(p.color).setPixel(Math.floor(p.x), Math.floor(p.y));
      }
    },
  };
}
