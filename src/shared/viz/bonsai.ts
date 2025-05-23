import {
  colorLuminance,
  colorEquals,
  lerp,
  vecLength,
  vecNormalize,
} from "./helpers.ts";
import * as background from "../assets/cherry-blossom-background.ts";
import * as foliage from "../assets/cherry-blossom-foliage.ts";
import * as cloud1 from "../assets/cherry-blossom-cloud-1.ts";
import * as cloud2 from "../assets/cherry-blossom-cloud-2.ts";
import * as cloud3 from "../assets/cherry-blossom-cloud-3.ts";
import * as cloud4 from "../assets/cherry-blossom-cloud-4.ts";
import * as cloud5 from "../assets/cherry-blossom-cloud-5.ts";
import * as backgroundNight from "../assets/cherry-blossom-background-night.ts";
import * as foliageNight from "../assets/cherry-blossom-foliage-night.ts";
import * as cloud1Night from "../assets/cherry-blossom-cloud-1-night.ts";
import * as cloud2Night from "../assets/cherry-blossom-cloud-2-night.ts";
import * as cloud3Night from "../assets/cherry-blossom-cloud-3-night.ts";
import * as cloud4Night from "../assets/cherry-blossom-cloud-4-night.ts";
import * as cloud5Night from "../assets/cherry-blossom-cloud-5-night.ts";
import * as foliageSunset from "../assets/cherry-blossom-foliage-sunset.ts";
import * as backgroundSunset from "../assets/cherry-blossom-background-sunset.ts";
import * as cloud1Sunset from "../assets/cherry-blossom-cloud-1-sunset.ts";
import * as cloud2Sunset from "../assets/cherry-blossom-cloud-2-sunset.ts";
import * as cloud3Sunset from "../assets/cherry-blossom-cloud-3-sunset.ts";
import * as cloud4Sunset from "../assets/cherry-blossom-cloud-4-sunset.ts";
import * as cloud5Sunset from "../assets/cherry-blossom-cloud-5-sunset.ts";
import * as moon from "../assets/moon.ts";

import { LATITUDE, LONGITUDE } from "../config.ts";
import SunCalc from "suncalc";

import { FlowGrid } from "./flow-grid.ts";
import {
  alphaBlend,
  alphaAdditiveBlend,
  Backbuffer,
} from "./back-buffer.ts";
import type { RGBAColor } from "./back-buffer.ts";
import type { IAudioPlayer } from "../audio-player-type.ts";
import type { IVisualization } from "./visualization-type.ts";

const MAX_STARS = 96;
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
const BASE_FRAME_TIME = 16;

type AttractorType = {
  x: number;
  y: number;
  maxDistance: number;
  strength: number;
  dx: number;
};

function applyPointAttractors(
  grid: FlowGrid,
  attractors: Array<AttractorType>
) {
  grid.map((x, y, v) => {
    v.y = 1;
    v.x = PARTICLE_MIN_X;
    for (let a of attractors) {
      const attractorDirection = { x: a.x - x, y: a.y - y };
      const distance = vecLength(attractorDirection);
      if (distance !== 0) {
        const scaledDistance =
          Math.min(distance, a.maxDistance) / a.maxDistance;
        v.x += (1.0 - scaledDistance) * a.strength;
      }
    }
    vecNormalize(v);
  });
}

type SunInfo = {
  sunRiseStart: number;
  sunRisePeak: number;
  sunRiseEnd: number;
  sunSetStart: number;
  sunSetPeak: number;
  sunSetEnd: number;
};

function getDayPeriod(
  t: number,
  day: SunInfo
):
  | "SunriseStart"
  | "SunriseEnd"
  | "Day"
  | "SunsetStart"
  | "SunsetEnd"
  | "Night" {
  if (t >= day.sunRiseStart && t <= day.sunRisePeak) {
    return "SunriseStart";
  } else if (t > day.sunRisePeak && t < day.sunRiseEnd) {
    return "SunriseEnd";
  } else if (t > day.sunRiseEnd && t < day.sunSetStart) {
    return "Day";
  } else if (t >= day.sunSetStart && t <= day.sunSetPeak) {
    return "SunsetStart";
  } else if (t > day.sunSetPeak && t < day.sunSetEnd) {
    return "SunsetEnd";
  } else {
    return "Night";
  }
}

export default function (width: number, height: number): IVisualization {
  const cx = Math.floor(width / 2);

  const grid = new FlowGrid(width, height, {
    x: FLOW_GRID_RESOLUTION,
    y: FLOW_GRID_RESOLUTION,
  });
  const attractors: Array<AttractorType> = [
    {
      x: Math.random() * FLOW_GRID_RESOLUTION,
      y: Math.random() * FLOW_GRID_RESOLUTION,
      dx:
        Math.random() * (ATTRACTOR_MAX_VELOCITY - ATTRACTOR_MIN_VELOCITY) +
        ATTRACTOR_MIN_VELOCITY,
      strength: ATTRACTOR_STRENGTH,
      maxDistance: MAX_ATTRACTOR_DISTANCE,
    },
    {
      x: Math.random() * FLOW_GRID_RESOLUTION,
      y: Math.random() * FLOW_GRID_RESOLUTION,
      dx:
        Math.random() * (ATTRACTOR_MAX_VELOCITY - ATTRACTOR_MIN_VELOCITY) +
        ATTRACTOR_MIN_VELOCITY,
      strength: ATTRACTOR_STRENGTH,
      maxDistance: MAX_ATTRACTOR_DISTANCE,
    },
  ];

  // colors
  const dayPalette = {
    skyBottom: { r: 179, g: 206, b: 191, a: 255 },
    skyTop: { r: 98, g: 175, b: 203, a: 255 },
    foliageDark: { r: 132, g: 96, b: 99, a: 255 },
    foliageMid: { r: 202, g: 104, b: 107, a: 255 },
    foliageLight: { r: 227, g: 171, b: 173, a: 255 },
    background,
    foliage,
    availableClouds: [cloud1, cloud2, cloud3, cloud4, cloud5],
  };
  const sunxPalette = {
    skyBottom: { r: 251, g: 66, b: 1, a: 255 },
    skyTop: { r: 30, g: 51, b: 100, a: 255 },
    foliageDark: { r: 134, g: 60, b: 83, a: 255 },
    foliageMid: { r: 233, g: 28, b: 84, a: 255 },
    foliageLight: { r: 227, g: 111, b: 142, a: 255 },
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
    skyBottom: { r: 17, g: 45, b: 77, a: 255 },
    skyTop: { r: 11, g: 31, b: 36, a: 255 },
    foliageDark: { r: 28, g: 37, b: 63, a: 255 },
    foliageMid: { r: 27, g: 51, b: 178, a: 255 },
    foliageLight: { r: 116, g: 140, b: 228, a: 255 },
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

  const clouds: Array<{
    cloud: number;
    x: number;
    y: number;
    vx: number;
  }> = [];
  const foliageFlicker: Array<{
    x: number;
    y: number;
    ttl: number;
    color: RGBAColor;
  }> = [];
  const particles: Array<{
    x: number;
    y: number;
    color: RGBAColor;
  }> = [];
  const stars: Array<{
    x: number;
    y: number;
    color: RGBAColor;
  }> = [];
  let prevDate: Date | null = null;

  let day: SunInfo | null = null;

  return {
    name: "Bonsai",
    volume: 12,
    run: (
      backbuffer: Backbuffer,
      audio: IAudioPlayer,
      dt: number,
      t: number
    ) => {
      const speed = dt / BASE_FRAME_TIME;

      const now = new Date(t);
      if (!prevDate || now.getDay() !== prevDate.getDay()) {
        // get the time from the middle of the day - suncalc will sometimes
        // return the wrong day if we are close to midnight
        const times = SunCalc.getTimes(
          new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0),
          LATITUDE,
          LONGITUDE
        );
        if (times.sunrise.getDay() === now.getDay()) {
          const sunRiseStart = times.sunrise.getTime();
          const sunRiseEnd = times.goldenHourEnd.getTime();
          const sunSetStart = times.sunsetStart.getTime();
          const sunSetEnd = times.night.getTime();
          day = {
            sunRiseStart,
            sunRiseEnd,
            sunSetStart,
            sunSetEnd,
            sunRisePeak: sunRiseStart + (sunRiseEnd - sunRiseStart) / 2,
            sunSetPeak: sunSetStart + (sunSetEnd - sunSetStart) / 2,
          };
          prevDate = now;
        }
      }

      if (!day) {
        return;
      }

      let palette1 = dayPalette;
      let palette2 = dayPalette;
      let paletteLerp = 1.0;

      const dayPeriod = getDayPeriod(t, day);
      switch (dayPeriod) {
        case "SunriseStart":
          palette1 = nightPalette;
          palette2 = sunxPalette;
          paletteLerp =
            (t - day.sunRiseStart) / (day.sunRisePeak - day.sunRiseStart);
          break;
        case "SunriseEnd":
          palette1 = sunxPalette;
          palette2 = dayPalette;
          paletteLerp =
            (t - day.sunRisePeak) / (day.sunRiseEnd - day.sunRisePeak);
          break;
        case "Day":
          break;
        case "SunsetStart":
          palette1 = dayPalette;
          palette2 = sunxPalette;
          paletteLerp =
            (t - day.sunSetStart) / (day.sunSetPeak - day.sunSetStart);
          break;
        case "SunsetEnd":
          palette1 = sunxPalette;
          palette2 = nightPalette;
          paletteLerp = (t - day.sunSetPeak) / (day.sunSetEnd - day.sunSetPeak);
          break;
        case "Night":
          palette1 = palette2 = nightPalette;
          const interval = 86400 * 1000 - (day.sunSetEnd - day.sunRiseStart);
          if (t < day.sunSetEnd) {
            paletteLerp = (t + (86400 * 1000 - day.sunSetEnd)) / interval;
          } else {
            paletteLerp = (t - day.sunSetEnd) / interval;
          }
          break;
      }

      if (
        dayPeriod === "Night" ||
        dayPeriod === "SunsetEnd" ||
        dayPeriod === "SunriseStart"
      ) {
        audio.queue("bonsai-night.mp3");
      } else {
        audio.queue("bonsai.mp3");
      }

      // update clouds
      for (let i = 0; i < clouds.length; ) {
        const cloud = clouds[i];
        if (cloud.cloud >= 0) {
          cloud.x += cloud.vx * speed;
          if (cloud.x > width) {
            clouds.splice(i, 1);
            continue;
          }
        }
        ++i;
      }
      const firstRun = clouds.length === 0;
      while (clouds.length < MAX_CLOUDS) {
        const index = Math.floor(
          Math.random() * palette1.availableClouds.length
        );
        const vx =
          Math.random() * (MAX_CLOUD_SPEED - MIN_CLOUD_SPEED) + MIN_CLOUD_SPEED;
        if (index < palette1.availableClouds.length) {
          const cloud = palette1.availableClouds[index];
          clouds.push({
            cloud: index,
            x:
              -cloud.width + (firstRun ? Math.floor(Math.random() * width) : 0),
            y: Math.floor(Math.random() * (height - cloud.height) - 3),
            vx,
          });
        } else {
          clouds.push({
            cloud: -1,
            x: firstRun ? Math.random() * width : 0,
            y: 0,
            vx,
          });
        }
      }

      // update foliage flicker
      for (let i = 0; i < foliageFlicker.length; ) {
        const f = foliageFlicker[i];
        f.ttl -= speed;
        if (f.ttl <= 0) {
          foliageFlicker.splice(i, 1);
          continue;
        }
        ++i;
      }
      if (foliageFlicker.length < FOLIAGE_ADJUSTMENTS) {
        const additions = FOLIAGE_ADJUSTMENTS - foliageFlicker.length;
        for (let i = 0; i < additions; ++i) {
          const x = Math.floor(Math.random() * (foliage.width - 1));
          const y = Math.floor(Math.random() * (foliage.height - 1));
          const foliageIndex = (y * foliage.width + x) * 4;
          let foliageColor = {
            r: foliage.data[foliageIndex],
            g: foliage.data[foliageIndex + 1],
            b: foliage.data[foliageIndex + 2],
            a: foliage.data[foliageIndex + 3],
          };
          // check its not transparent
          if (foliageColor.a > 0) {
            if (colorEquals(foliageColor, dayPalette.foliageDark)) {
              foliageColor = lerp(
                palette1.foliageMid,
                palette2.foliageMid,
                paletteLerp
              );
            } else if (colorEquals(foliageColor, dayPalette.foliageMid)) {
              foliageColor = lerp(
                palette1.foliageLight,
                palette2.foliageLight,
                paletteLerp
              );
            } else if (colorEquals(foliageColor, dayPalette.foliageLight)) {
              foliageColor =
                Math.random() < 0.5
                  ? lerp(palette1.foliageMid, palette2.foliageMid, paletteLerp)
                  : { r: 0, g: 0, b: 0, a: 0 };
            }
            foliageFlicker.push({
              x: cx - foliage.width / 2 + x,
              y: y + 1,
              ttl: Math.floor(
                Math.random() * (MAX_FOLIAGE_TTL - MIN_FOLIAGE_TTL) +
                  MIN_FOLIAGE_TTL
              ),
              color: foliageColor,
            });
          }
        }
      }

      // update attractors
      for (let i = 0; i < attractors.length; ++i) {
        const a = attractors[i];
        a.x += a.dx * speed;
        if (a.x > grid.resolution.x) {
          a.x = 0;
          a.y = Math.random() * FLOW_GRID_RESOLUTION;
        }
      }

      // update particles
      applyPointAttractors(grid, attractors);
      for (let i = 0; i < particles.length; ) {
        const p = particles[i];
        if (p.y < 0 || p.y >= height || p.x < 0 || p.x >= width) {
          particles.splice(i, 1);
          continue;
        }
        ++i;
      }
      if (particles.length < MAX_PARTICLES) {
        const additions = MAX_PARTICLES - particles.length;
        for (let i = 0; i < additions; ++i) {
          const x = Math.floor(Math.random() * (foliage.width - 1));
          const y = Math.floor(Math.random() * (foliage.height - 1));
          const foliageIndex = (y * foliage.width + x) * 4;
          // check its not transparent
          if (foliage.data[foliageIndex + 3] > 0) {
            particles.push({
              x: cx - foliage.width / 2 + x,
              y: y + 1,
              color: {
                ...lerp(
                  lerp(palette1.foliageMid, palette2.foliageMid, paletteLerp),
                  lerp(
                    palette1.foliageLight,
                    palette2.foliageLight,
                    paletteLerp
                  ),
                  Math.random()
                ),
                a: 200,
              },
            });
          }
        }
      }

      backbuffer.clear();

      // draw background
      for (let y = 0; y < height; y++) {
        backbuffer
          .fgColor(
            lerp(
              lerp(palette1.skyBottom, palette2.skyBottom, paletteLerp),
              lerp(palette1.skyTop, palette2.skyTop, paletteLerp),
              1.0 - (y + 1) / height
            )
          )
          .drawLine(0, y, width, y);
      }

      if (palette1 === nightPalette || palette2 === nightPalette) {
        if (stars.length === 0) {
          for (let i = 0; i < MAX_STARS; ++i) {
            stars.push({
              x: Math.floor(Math.random() * (width - 1)),
              y: Math.floor(Math.pow(Math.random(), 2) * (height - 1)),
              color: lerp(
                {
                  r: 3,
                  g: 15,
                  b: 31,
                  a: 64,
                },
                {
                  r: 38,
                  g: 49,
                  b: 58,
                  a: 128,
                },
                Math.random()
              ),
            });
          }
        }

        backbuffer.blendMode(alphaAdditiveBlend);
        for (let i = 0; i < stars.length; ++i) {
          const star = stars[i];
          const skyPixel = backbuffer.getPixel(star.x, star.y);
          const skyLuminance = colorLuminance(skyPixel);
          const starLuminance = colorLuminance(star.color);
          if (starLuminance > skyLuminance) {
            backbuffer.fgColor(star.color).setPixel(star.x, star.y);
          }
        }
      }

      // draw the moon
      backbuffer.blendMode(alphaBlend);
      if (palette1 === nightPalette && palette2 === nightPalette) {
        backbuffer.drawAsset(
          cx + 5 + Math.pow(paletteLerp * 3, 2) * cx,
          height - height * paletteLerp * 3,
          moon
        );
      }

      // draw clouds
      for (let i = 0; i < clouds.length; ++i) {
        const cloud = clouds[i];
        if (cloud.cloud >= 0) {
          backbuffer.drawAsset(
            cloud.x,
            cloud.y,
            palette1.availableClouds[cloud.cloud]
          );
          backbuffer
            .blendMode(alphaBlend, paletteLerp)
            .drawAsset(cloud.x, cloud.y, palette2.availableClouds[cloud.cloud])
            .blendMode(alphaBlend);
        }
      }

      // draw background
      backbuffer.drawAsset(0, 0, palette1.background);
      backbuffer
        .blendMode(alphaBlend, paletteLerp)
        .drawAsset(0, 0, palette2.background)
        .blendMode(alphaBlend);

      // draw foliage
      backbuffer.drawAsset(cx - foliage.width / 2, 1, palette1.foliage);
      backbuffer
        .blendMode(alphaBlend, paletteLerp)
        .drawAsset(cx - foliage.width / 2, 1, palette2.foliage)
        .blendMode(alphaBlend);
      for (let i = 0; i < foliageFlicker.length; ++i) {
        const f = foliageFlicker[i];
        backbuffer.fgColor(f.color).setPixel(f.x, f.y);
      }

      // draw particles
      for (let i = 0; i < particles.length; ++i) {
        let p = particles[i];
        const vec = grid.getVector(p.x, p.y);
        p.y += vec.y * PARTICLE_FALL_SPEED * speed;
        p.x += vec.x * PARTICLE_FALL_SPEED * speed;
        backbuffer.fgColor(p.color).setPixel(Math.floor(p.x), Math.floor(p.y));
      }
    },
  };
}
