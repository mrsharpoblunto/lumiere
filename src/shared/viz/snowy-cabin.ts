import {
  colorLuminance,
  lerp,
  vecLength,
  vecNormalize,
} from "./helpers.ts";
import type { Vec2 } from "./helpers.ts";
import SunCalc from "suncalc";
import { FlowGrid } from "./flow-grid.ts";
import { alphaBlend, alphaAdditiveBlend } from "./back-buffer.ts";
import type { Backbuffer, RGBAColor } from "./back-buffer.ts";
import type { IAudioPlayer } from "../audio-player-type.ts";
import type {
  ILocationService,
  GeoLocationCoordinates,
} from "../location-service-type.ts";
import type { IVisualization } from "./visualization-type.ts";

// Scene layout
const GROUND_HEIGHT = 5;
const CABIN_WIDTH = 12;
const CABIN_WALL_HEIGHT = 6;
const CABIN_ROOF_HEIGHT = 4;
const CHIMNEY_WIDTH = 2;

// Trees
const TREE_LAYERS = 3;
const TREES_PER_LAYER = 3;
const TREE_SEGMENTS = 4;
const TREE_MIN_HEIGHT = 8;
const TREE_MAX_HEIGHT = 18;
const TREE_MAX_BRANCH_LENGTH = 5;

// Snow particles (from bonsai pattern)
const MAX_SNOW_PARTICLES = 24;
const SNOW_FALL_SPEED = 0.03;
const SNOW_PARTICLE_MIN_X = 0.2;

// Wind (from aquarium pattern)
const WIND_GRID_RESOLUTION = 8;
const WIND_WAVE_SPEED = 0.04;
const WIND_WAVE_STRENGTH = 0.4;
const WIND_MAX_DEPTH = 6;
const IK_ITERATIONS = 1;

// Snow flow grid (from bonsai pattern)
const SNOW_GRID_RESOLUTION = 8;
const SNOW_ATTRACTOR_DISTANCE = 8;
const SNOW_ATTRACTOR_STRENGTH = 0.5;
const SNOW_ATTRACTOR_MIN_VELOCITY = 0.02;
const SNOW_ATTRACTOR_MAX_VELOCITY = 0.04;

// Stars
const MAX_STARS = 96;

// Smoke
const MAX_SMOKE_PARTICLES = 6;
const SMOKE_RISE_SPEED = 0.04;
const SMOKE_SPAWN_RATE = 0.15;
const SMOKE_INITIAL_RADIUS = 1.5;
const SMOKE_MAX_RADIUS = 3.5;
const SMOKE_TTL = 120;

const BASE_FRAME_TIME = 16;

// FABRIK IK solver (from aquarium)
type Effector = Vec2 & { l: number };

function fabrikSolve(chain: Array<Effector>, goal: Vec2, iterations: number) {
  const anchorGoal = { ...chain[0] };
  while (iterations-- > 0) {
    for (let i = chain.length - 1; i > 0; --i) {
      const c = chain[i];
      const p = chain[i - 1];
      c.x = goal.x;
      c.y = goal.y;
      const newSegment = { x: c.x - p.x, y: c.y - p.y };
      vecNormalize(newSegment);
      p.x = goal.x - p.l * newSegment.x;
      p.y = goal.y - p.l * newSegment.y;
      goal = p;
    }

    goal = anchorGoal;
    for (let i = 0; i < chain.length - 1; ++i) {
      const c = chain[i];
      const p = chain[i + 1];
      c.x = goal.x;
      c.y = goal.y;
      const newSegment = { x: c.x - p.x, y: c.y - p.y };
      vecNormalize(newSegment);
      p.x = goal.x - p.l * newSegment.x;
      p.y = goal.y - p.l * newSegment.y;
      goal = p;
    }
  }
}

class PineTree {
  chain: Array<Effector>;
  maxBranchLength: number;

  constructor(
    anchorX: number,
    anchorY: number,
    treeHeight: number,
    segments: number,
    maxBranchLength: number
  ) {
    const segmentLength = treeHeight / segments;
    this.chain = [{ x: anchorX, y: anchorY, l: segmentLength }];
    for (let i = 0; i < segments; i++) {
      const last = this.chain[this.chain.length - 1];
      this.chain.push({
        x: last.x,
        y: last.y - segmentLength,
        l: segmentLength,
      });
    }
    this.maxBranchLength = maxBranchLength;
  }

  draw(backbuffer: Backbuffer, trunkColor: RGBAColor, branchColor: RGBAColor) {
    // Draw trunk
    backbuffer.fgColor(trunkColor);
    let prev = this.chain[0];
    for (let i = 1; i < this.chain.length; i++) {
      backbuffer.drawLine(
        Math.round(prev.x),
        Math.round(prev.y),
        Math.round(this.chain[i].x),
        Math.round(this.chain[i].y)
      );
      prev = this.chain[i];
    }

    // Draw branches at each joint (skip base anchor)
    backbuffer.fgColor(branchColor);
    for (let i = 1; i < this.chain.length; i++) {
      const joint = this.chain[i];
      const t = i / (this.chain.length - 1);
      const branchLen = (1 - t * 0.8) * this.maxBranchLength;
      if (branchLen < 1) continue;

      const jx = Math.round(joint.x);
      const jy = Math.round(joint.y);
      // Left branch angled down
      backbuffer.drawLine(
        jx,
        jy,
        Math.round(jx - branchLen),
        Math.round(jy + branchLen * 0.4)
      );
      // Right branch angled down
      backbuffer.drawLine(
        jx,
        jy,
        Math.round(jx + branchLen),
        Math.round(jy + branchLen * 0.4)
      );
    }
  }

  getEffector(): Effector {
    return this.chain[this.chain.length - 1];
  }
}

// Wind attractors (directional, from aquarium)
type WindAttractor = {
  x: number;
  y: number;
  dx: number;
  strength: number;
  maxDistance: number;
};

function applyDirectionalAttractors(
  grid: FlowGrid,
  attractors: Array<WindAttractor>
) {
  grid.map((x, y, v) => {
    v.y = -1;
    v.x = 0;
    for (const a of attractors) {
      if (Math.sign(x - a.x) !== Math.sign(a.dx)) {
        const attractorDirection = { x: a.x - x, y: a.y - y };
        const distance = vecLength(attractorDirection);
        if (distance !== 0) {
          attractorDirection.x /= distance;
          const scaledDistance =
            Math.min(distance, a.maxDistance) / a.maxDistance;
          v.x += attractorDirection.x * (1.0 - scaledDistance) * a.strength;
        }
      }
    }
    vecNormalize(v);
  });
}

// Snow attractors (point, from bonsai)
type SnowAttractor = {
  x: number;
  y: number;
  maxDistance: number;
  strength: number;
  dx: number;
};

function applyPointAttractors(
  grid: FlowGrid,
  attractors: Array<SnowAttractor>
) {
  grid.map((x, y, v) => {
    v.y = 1;
    v.x = SNOW_PARTICLE_MIN_X;
    for (const a of attractors) {
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

// Day period detection (from bonsai)
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
  const groundY = height - GROUND_HEIGHT;

  // Wind flow grid (for tree sway via IK)
  const windGrid = new FlowGrid(width, height, {
    x: WIND_GRID_RESOLUTION,
    y: WIND_GRID_RESOLUTION,
  });
  const windAttractors: Array<WindAttractor> = [
    {
      x: 0,
      y: -1,
      dx: WIND_WAVE_SPEED,
      strength: WIND_WAVE_STRENGTH,
      maxDistance: WIND_MAX_DEPTH,
    },
  ];

  // Snow flow grid (for falling snow particles)
  const snowGrid = new FlowGrid(width, height, {
    x: SNOW_GRID_RESOLUTION,
    y: SNOW_GRID_RESOLUTION,
  });
  const snowAttractors: Array<SnowAttractor> = [
    {
      x: Math.random() * SNOW_GRID_RESOLUTION,
      y: Math.random() * SNOW_GRID_RESOLUTION,
      dx:
        Math.random() * (SNOW_ATTRACTOR_MAX_VELOCITY - SNOW_ATTRACTOR_MIN_VELOCITY) +
        SNOW_ATTRACTOR_MIN_VELOCITY,
      strength: SNOW_ATTRACTOR_STRENGTH,
      maxDistance: SNOW_ATTRACTOR_DISTANCE,
    },
    {
      x: Math.random() * SNOW_GRID_RESOLUTION,
      y: Math.random() * SNOW_GRID_RESOLUTION,
      dx:
        Math.random() * (SNOW_ATTRACTOR_MAX_VELOCITY - SNOW_ATTRACTOR_MIN_VELOCITY) +
        SNOW_ATTRACTOR_MIN_VELOCITY,
      strength: SNOW_ATTRACTOR_STRENGTH,
      maxDistance: SNOW_ATTRACTOR_DISTANCE,
    },
  ];

  // Color palettes for day/night cycle
  const dayPalette = {
    skyTop: { r: 110, g: 170, b: 220, a: 255 },
    skyBottom: { r: 180, g: 210, b: 235, a: 255 },
    ground: { r: 220, g: 225, b: 235, a: 255 },
    groundDark: { r: 190, g: 200, b: 215, a: 255 },
    trunk: { r: 80, g: 50, b: 30, a: 255 },
    branch: { r: 50, g: 75, b: 35, a: 255 },
    cabinWall: { r: 120, g: 70, b: 40, a: 255 },
    cabinWallDark: { r: 90, g: 50, b: 25, a: 255 },
    cabinRoof: { r: 210, g: 215, b: 225, a: 255 },
    cabinDoor: { r: 70, g: 40, b: 20, a: 255 },
    cabinWindow: { r: 200, g: 180, b: 120, a: 255 },
    cabinChimney: { r: 100, g: 55, b: 30, a: 255 },
    snow: { r: 230, g: 235, b: 245, a: 180 },
  };
  const sunxPalette = {
    skyTop: { r: 40, g: 50, b: 100, a: 255 },
    skyBottom: { r: 230, g: 100, b: 40, a: 255 },
    ground: { r: 200, g: 190, b: 200, a: 255 },
    groundDark: { r: 170, g: 155, b: 170, a: 255 },
    trunk: { r: 50, g: 30, b: 25, a: 255 },
    branch: { r: 30, g: 40, b: 25, a: 255 },
    cabinWall: { r: 100, g: 55, b: 35, a: 255 },
    cabinWallDark: { r: 70, g: 35, b: 20, a: 255 },
    cabinRoof: { r: 180, g: 160, b: 160, a: 255 },
    cabinDoor: { r: 50, g: 25, b: 15, a: 255 },
    cabinWindow: { r: 220, g: 180, b: 80, a: 255 },
    cabinChimney: { r: 70, g: 35, b: 20, a: 255 },
    snow: { r: 210, g: 200, b: 210, a: 180 },
  };
  const nightPalette = {
    skyTop: { r: 8, g: 15, b: 30, a: 255 },
    skyBottom: { r: 15, g: 30, b: 55, a: 255 },
    ground: { r: 40, g: 50, b: 75, a: 255 },
    groundDark: { r: 25, g: 35, b: 55, a: 255 },
    trunk: { r: 20, g: 15, b: 15, a: 255 },
    branch: { r: 15, g: 25, b: 20, a: 255 },
    cabinWall: { r: 35, g: 25, b: 20, a: 255 },
    cabinWallDark: { r: 25, g: 15, b: 12, a: 255 },
    cabinRoof: { r: 45, g: 55, b: 75, a: 255 },
    cabinDoor: { r: 20, g: 12, b: 8, a: 255 },
    cabinWindow: { r: 220, g: 190, b: 100, a: 255 },
    cabinChimney: { r: 25, g: 15, b: 12, a: 255 },
    snow: { r: 50, g: 60, b: 90, a: 180 },
  };

  // Create pine trees across 3 layers
  // Layer 0: behind cabin, Layer 1: beside cabin, Layer 2: in front
  const cabinLeft = cx - Math.floor(CABIN_WIDTH / 2);
  const cabinRight = cx + Math.floor(CABIN_WIDTH / 2);
  const trees: Array<Array<PineTree>> = [];

  for (let layer = 0; layer < TREE_LAYERS; layer++) {
    const layerTrees: Array<PineTree> = [];
    for (let j = 0; j < TREES_PER_LAYER; j++) {
      let x: number;
      if (layer === 0) {
        // Behind cabin - spread across
        x = Math.random() * (width - 4) + 2;
      } else if (layer === 1) {
        // Beside cabin - left or right of cabin
        if (j % 2 === 0) {
          x = Math.random() * (cabinLeft - 4) + 2;
        } else {
          x = cabinRight + 2 + Math.random() * (width - cabinRight - 4);
        }
      } else {
        // In front - edges of screen
        if (j % 2 === 0) {
          x = Math.random() * (cabinLeft - 6) + 1;
        } else {
          x = cabinRight + 4 + Math.random() * (width - cabinRight - 6);
        }
      }

      const treeHeight =
        TREE_MIN_HEIGHT + Math.random() * (TREE_MAX_HEIGHT - TREE_MIN_HEIGHT);
      const branchLength = TREE_MAX_BRANCH_LENGTH * (0.5 + Math.random() * 0.5);

      layerTrees.push(
        new PineTree(x, groundY - 1, treeHeight, TREE_SEGMENTS, branchLength)
      );
    }
    trees.push(layerTrees);
  }

  // Snow particles
  const snowParticles: Array<{ x: number; y: number; color: RGBAColor }> = [];

  // Stars
  const stars: Array<{ x: number; y: number; color: RGBAColor }> = [];

  // Ground texture (snow variation)
  const groundTexture: Array<{ x: number; layer: number }> = [];
  for (let i = 0; i < GROUND_HEIGHT * 3; i++) {
    groundTexture.push({
      x: Math.floor(Math.random() * width),
      layer: Math.floor(Math.random() * GROUND_HEIGHT),
    });
  }

  // Smoke particles
  const smokeParticles: Array<{
    x: number;
    y: number;
    age: number;
    ttl: number;
    radius: number;
  }> = [];

  let prevDate: Date | null = null;
  let prevLocation: GeoLocationCoordinates | null = null;
  let day: SunInfo | null = null;

  return {
    name: "Snowy Cabin",
    volume: 12,
    run: (
      backbuffer: Backbuffer,
      audio: IAudioPlayer,
      location: ILocationService,
      dt: number,
      t: number
    ) => {
      const speed = dt / BASE_FRAME_TIME;

      // === Day/night cycle calculation (from bonsai) ===
      const now = new Date(t);
      if (
        !prevDate ||
        now.getDay() !== prevDate.getDay() ||
        prevLocation?.latitude !== location.getLocation().latitude ||
        prevLocation?.longitude !== location.getLocation().longitude
      ) {
        prevLocation = location.getLocation();
        const midday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          12,
          0,
          0
        );
        const times = SunCalc.getTimes(
          midday,
          prevLocation.latitude,
          prevLocation.longitude
        );
        if (times.sunrise.getDay() === now.getDay()) {
          const sunRiseStart = times.sunrise.getTime();
          const sunRiseEnd = times.goldenHourEnd.getTime();
          const sunSetStart = times.goldenHour.getTime();
          const sunSetEnd = times.sunset.getTime();
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

      // Palette interpolation
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
          paletteLerp =
            (t - day.sunSetPeak) / (day.sunSetEnd - day.sunSetPeak);
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

      // Audio blending (stub - reuse bonsai audio for now)
      if (
        dayPeriod === "Night" ||
        dayPeriod === "SunsetEnd" ||
        dayPeriod === "SunriseStart"
      ) {
        audio.queue("bonsai-night.mp3");
      } else {
        audio.queue("bonsai.mp3");
      }

      // === UPDATE ===

      // Update wind attractors & tree IK
      for (const a of windAttractors) {
        a.x += a.dx * speed;
        if (a.x > windGrid.resolution.x + 2 || a.x < -3) {
          a.dx *= -1;
        }
      }
      applyDirectionalAttractors(windGrid, windAttractors);

      for (let layer = 0; layer < TREE_LAYERS; layer++) {
        for (const tree of trees[layer]) {
          const effector = { ...tree.getEffector() };
          const vec = windGrid.getVector(
            Math.min(width - 1, Math.max(0, effector.x)),
            Math.min(height - 1, Math.max(0, effector.y))
          );
          const endEffector = {
            x: effector.x + vec.x,
            y: effector.y + vec.y,
          };
          fabrikSolve(tree.chain, endEffector, IK_ITERATIONS);
        }
      }

      // Update snow attractors & particles
      for (const a of snowAttractors) {
        a.x += a.dx * speed;
        if (a.x > snowGrid.resolution.x) {
          a.x = 0;
          a.y = Math.random() * SNOW_GRID_RESOLUTION;
        }
      }
      applyPointAttractors(snowGrid, snowAttractors);

      for (let i = 0; i < snowParticles.length; ) {
        const p = snowParticles[i];
        if (p.y >= height || p.x < 0 || p.x >= width) {
          snowParticles.splice(i, 1);
          continue;
        }
        ++i;
      }
      while (snowParticles.length < MAX_SNOW_PARTICLES) {
        snowParticles.push({
          x: Math.random() * width,
          y: -Math.random() * 4,
          color: {
            ...lerp(
              lerp(palette1.snow, palette2.snow, paletteLerp),
              { r: 255, g: 255, b: 255, a: 200 },
              Math.random() * 0.3
            ),
          },
        });
      }

      // Update smoke particles
      const chimneySpawnX = cx + Math.floor(CABIN_WIDTH / 2) - 3 + CHIMNEY_WIDTH / 2;
      const chimneySpawnY = groundY - CABIN_WALL_HEIGHT - CABIN_ROOF_HEIGHT - 2;
      for (let i = 0; i < smokeParticles.length; ) {
        const s = smokeParticles[i];
        s.age += speed;
        if (s.age >= s.ttl) {
          smokeParticles.splice(i, 1);
          continue;
        }
        const life = s.age / s.ttl;
        // Rise and drift with wind
        const windVec = windGrid.getVector(
          Math.min(width - 1, Math.max(0, s.x)),
          Math.min(height - 1, Math.max(0, s.y))
        );
        s.y -= SMOKE_RISE_SPEED * (1 - life * 0.5) * speed;
        s.x += windVec.x * 0.03 * speed;
        // Grow radius over lifetime
        s.radius = SMOKE_INITIAL_RADIUS + (SMOKE_MAX_RADIUS - SMOKE_INITIAL_RADIUS) * life;
        ++i;
      }
      if (smokeParticles.length < MAX_SMOKE_PARTICLES && Math.random() < SMOKE_SPAWN_RATE) {
        smokeParticles.push({
          x: chimneySpawnX + (Math.random() - 0.5),
          y: chimneySpawnY,
          age: 0,
          ttl: SMOKE_TTL * (0.8 + Math.random() * 0.4),
          radius: SMOKE_INITIAL_RADIUS,
        });
      }

      // === DRAWING ===
      backbuffer.clear();

      // Sky gradient
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

      // Stars (night)
      if (palette1 === nightPalette || palette2 === nightPalette) {
        if (stars.length === 0) {
          for (let i = 0; i < MAX_STARS; i++) {
            stars.push({
              x: Math.floor(Math.random() * (width - 1)),
              y: Math.floor(Math.pow(Math.random(), 2) * (groundY - 1)),
              color: lerp(
                { r: 3, g: 15, b: 31, a: 64 },
                { r: 38, g: 49, b: 58, a: 128 },
                Math.random()
              ),
            });
          }
        }
        backbuffer.blendMode(alphaAdditiveBlend);
        for (const star of stars) {
          const skyPixel = backbuffer.getPixel(star.x, star.y);
          const skyLuminance = colorLuminance(skyPixel);
          const starLuminance = colorLuminance(star.color);
          if (starLuminance > skyLuminance) {
            backbuffer.fgColor(star.color).setPixel(star.x, star.y);
          }
        }
      }

      backbuffer.blendMode(alphaBlend);

      // Ground (snow-covered)
      const groundColor = lerp(palette1.ground, palette2.ground, paletteLerp);
      const groundDarkColor = lerp(
        palette1.groundDark,
        palette2.groundDark,
        paletteLerp
      );
      for (let y = groundY; y < height; y++) {
        backbuffer.fgColor(groundColor).drawLine(0, y, width - 1, y);
      }
      for (const tex of groundTexture) {
        backbuffer
          .fgColor(groundDarkColor)
          .setPixel(tex.x, groundY + tex.layer);
      }

      // Trees behind cabin (layer 0)
      const trunkColor = lerp(palette1.trunk, palette2.trunk, paletteLerp);
      const branchColor = lerp(palette1.branch, palette2.branch, paletteLerp);
      for (const tree of trees[0]) {
        tree.draw(backbuffer, trunkColor, branchColor);
      }

      // Cabin
      const cl = cx - Math.floor(CABIN_WIDTH / 2);
      const cr = cl + CABIN_WIDTH;
      const cabinBase = groundY;
      const cabinWallTop = cabinBase - CABIN_WALL_HEIGHT;
      const cabinRoofPeak = cabinWallTop - CABIN_ROOF_HEIGHT;

      // Walls
      const wallColor = lerp(
        palette1.cabinWall,
        palette2.cabinWall,
        paletteLerp
      );
      const wallDarkColor = lerp(
        palette1.cabinWallDark,
        palette2.cabinWallDark,
        paletteLerp
      );
      backbuffer
        .fgColor(wallColor)
        .fill(cl, cabinWallTop, cr - 1, cabinBase - 1);
      backbuffer
        .fgColor(wallDarkColor)
        .drawLine(cl, cabinWallTop, cl, cabinBase - 1)
        .drawLine(cr - 1, cabinWallTop, cr - 1, cabinBase - 1);

      // Roof (triangular)
      const roofColor = lerp(
        palette1.cabinRoof,
        palette2.cabinRoof,
        paletteLerp
      );
      backbuffer.fgColor(roofColor);
      for (let ry = 0; ry < CABIN_ROOF_HEIGHT; ry++) {
        const roofY = cabinRoofPeak + ry;
        const halfWidth =
          Math.floor(
            ((ry + 1) * (CABIN_WIDTH / 2)) / CABIN_ROOF_HEIGHT
          ) + 1;
        backbuffer.drawLine(cx - halfWidth, roofY, cx + halfWidth, roofY);
      }

      // Chimney
      const chimneyColor = lerp(
        palette1.cabinChimney,
        palette2.cabinChimney,
        paletteLerp
      );
      const chimneyX = cr - 3;
      backbuffer
        .fgColor(chimneyColor)
        .fill(chimneyX, cabinRoofPeak - 1, chimneyX + CHIMNEY_WIDTH - 1, cabinRoofPeak + 1);

      // Chimney smoke
      backbuffer.blendMode(alphaBlend);
      for (const s of smokeParticles) {
        const life = s.age / s.ttl;
        const alpha = Math.round(60 * (1 - life));
        backbuffer
          .fgColor({ r: 180, g: 180, b: 190, a: alpha })
          .drawCircle(Math.round(s.x), Math.round(s.y), Math.round(s.radius));
      }
      backbuffer.blendMode(null);

      // Door
      const doorColor = lerp(
        palette1.cabinDoor,
        palette2.cabinDoor,
        paletteLerp
      );
      backbuffer
        .fgColor(doorColor)
        .fill(cx - 1, cabinBase - 4, cx + 1, cabinBase - 1);

      // Window (warm glow)
      const windowColor = lerp(
        palette1.cabinWindow,
        palette2.cabinWindow,
        paletteLerp
      );
      backbuffer
        .fgColor(windowColor)
        .fill(cl + 2, cabinWallTop + 2, cl + 4, cabinWallTop + 4);

      // Trees beside cabin (layer 1)
      for (const tree of trees[1]) {
        tree.draw(backbuffer, trunkColor, branchColor);
      }

      // Trees in front (layer 2)
      for (const tree of trees[2]) {
        tree.draw(backbuffer, trunkColor, branchColor);
      }

      // Snow particles
      backbuffer.blendMode(alphaBlend);
      for (const p of snowParticles) {
        const vec = snowGrid.getVector(
          Math.min(width - 1, Math.max(0, p.x)),
          Math.min(height - 1, Math.max(0, p.y))
        );
        p.y += vec.y * SNOW_FALL_SPEED * speed;
        p.x += vec.x * SNOW_FALL_SPEED * speed;
        backbuffer.fgColor(p.color).setPixel(Math.floor(p.x), Math.floor(p.y));
      }
      backbuffer.blendMode(null);
    },
  };
}
