import { colorLuminance, lerp, vecLength, vecNormalize } from "./helpers.ts";
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



// Snow particles (from bonsai pattern)
const SNOW_SPAWN_RATE = 0.08;
const SNOW_FALL_SPEED = 0.03;
const SNOW_PARTICLE_MIN_X = 0.2;


// Snow flow grid (from bonsai pattern)
const SNOW_GRID_RESOLUTION = 8;
const SNOW_ATTRACTOR_DISTANCE = 8;
const SNOW_ATTRACTOR_STRENGTH = 0.7;
const SNOW_ATTRACTOR_MIN_VELOCITY = 0.02;
const SNOW_ATTRACTOR_MAX_VELOCITY = 0.04;

// Stars
const MAX_STARS = 96;

// Smoke
const SMOKE_EMIT_INTERVAL = 60;
const SMOKE_RISE_SPEED = 0.04;
const SMOKE_INITIAL_SIZE = 2;
const SMOKE_TTL = 240;

// Aurora
const AURORA_CONTROL_POINTS = 7;
const AURORA_SAMPLES = 16;
const AURORA_FALLOFF_UP = 12.0;
const AURORA_FALLOFF_DOWN = 12.0;
const AURORA_MAX_INTENSITY = 0.7;
const AURORA_DRIFT_SPEED = 0.001;
const AURORA_REGION_BOTTOM = 26;

const BASE_FRAME_TIME = 16;

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

// Aurora bézier helpers
type AuroraControlPoint = {
  baseY: number;
  // Multiple oscillation layers per point for non-uniform motion
  oscillations: Array<{ phase: number; freq: number; amp: number }>;
};

type AuroraCurve = {
  points: AuroraControlPoint[];
  hueOffset: number;
  hueDrift: number;
};

type CurveSample = { x: number; y: number; t: number };

function catmullRomSegment(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  t: number
): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function sampleSpline(points: Vec2[], numSamples: number): Array<CurveSample> {
  const n = points.length;
  const segments = n - 1;
  const samples: Array<CurveSample> = [];
  for (let si = 0; si <= numSamples; si++) {
    const globalT = si / numSamples;
    const scaled = globalT * segments;
    const seg = Math.min(Math.floor(scaled), segments - 1);
    const localT = scaled - seg;
    const p0 = points[Math.max(0, seg - 1)];
    const p1 = points[seg];
    const p2 = points[Math.min(n - 1, seg + 1)];
    const p3 = points[Math.min(n - 1, seg + 2)];
    const pt = catmullRomSegment(p0, p1, p2, p3, localT);
    samples.push({ x: pt.x, y: pt.y, t: globalT });
  }
  return samples;
}

// For a given px, find the curve's y by linearly interpolating between the
// two nearest samples that straddle it. Returns curveY and curveT.
function curveYAtX(
  px: number,
  samples: Array<CurveSample>
): { curveY: number; curveT: number } {
  // Clamp to the first/last sample if outside range
  if (px <= samples[0].x) return { curveY: samples[0].y, curveT: samples[0].t };
  const last = samples[samples.length - 1];
  if (px >= last.x) return { curveY: last.y, curveT: last.t };

  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    if (px >= a.x && px <= b.x) {
      const f = (px - a.x) / (b.x - a.x);
      return {
        curveY: a.y + (b.y - a.y) * f,
        curveT: a.t + (b.t - a.t) * f,
      };
    }
  }
  return { curveY: last.y, curveT: last.t };
}

// Integer hash → pseudo-random 0..1
function hash(x: number, y: number): number {
  let n = x * 374761393 + y * 668265263;
  n = ((n >> 13) ^ n) * 1274126177;
  return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
}

// Smooth 2D value noise, returns 0..1
function valueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  // Hermite smoothing
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash(ix, iy);
  const n10 = hash(ix + 1, iy);
  const n01 = hash(ix, iy + 1);
  const n11 = hash(ix + 1, iy + 1);
  return (
    n00 * (1 - sx) * (1 - sy) +
    n10 * sx * (1 - sy) +
    n01 * (1 - sx) * sy +
    n11 * sx * sy
  );
}

function auroraShimmer(px: number, curveY: number, time: number): number {
  const t1 = time * 0.00004;
  const t2 = time * 0.00003;
  const t3 = time * 0.00002;
  const n1 = valueNoise2D(px * 0.35 + t1 * 0.7, curveY * 0.6 - t1 * 1.1);
  const n2 = valueNoise2D(px * 0.7 - t2 * 0.9, curveY * 0.4 + t2 * 0.6);
  // Broad low-frequency opacity layer for larger bright/dim regions
  const n3 = valueNoise2D(px * 0.1 + t3 * 1.2, curveY * 0.15 - t3 * 0.7);
  const detail = n1 * 0.4 + n2 * 0.2;
  const broad = 0.15 + n3 * 0.85;
  return (0.15 + 0.85 * detail) * broad;
}

function colorGradientNoise(px: number, curveY: number, time: number): number {
  const t1 = time * 0.00003;
  const t2 = time * 0.00005;
  const n1 = valueNoise2D(px * 0.4 + t1 * 1.3, curveY * 0.08 - t1 * 0.3);
  const n2 = valueNoise2D(px * 0.18 - t2 * 0.6, curveY * 0.04 + t2 * 0.4);
  const n3 = valueNoise2D(px * 0.8 + t1 * 0.4, curveY * 0.06 + t2 * 0.2);
  return (n1 - 0.5) * 0.5 + (n2 - 0.5) * 0.4 + (n3 - 0.5) * 0.2;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const v = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return v * v * (3 - 2 * v);
}

export default function (width: number, height: number): IVisualization {
  const cx = Math.floor(width / 2);
  const groundY = height - GROUND_HEIGHT;

  // Snow flow grid (shared by snow particles and smoke)
  const snowGrid = new FlowGrid(width, height, {
    x: SNOW_GRID_RESOLUTION,
    y: SNOW_GRID_RESOLUTION,
  });
  const snowAttractors: Array<SnowAttractor> = [
    {
      x: Math.random() * SNOW_GRID_RESOLUTION,
      y: Math.random() * SNOW_GRID_RESOLUTION,
      dx:
        Math.random() *
          (SNOW_ATTRACTOR_MAX_VELOCITY - SNOW_ATTRACTOR_MIN_VELOCITY) +
        SNOW_ATTRACTOR_MIN_VELOCITY,
      strength: SNOW_ATTRACTOR_STRENGTH,
      maxDistance: SNOW_ATTRACTOR_DISTANCE,
    },
    {
      x: Math.random() * SNOW_GRID_RESOLUTION,
      y: Math.random() * SNOW_GRID_RESOLUTION,
      dx:
        Math.random() *
          (SNOW_ATTRACTOR_MAX_VELOCITY - SNOW_ATTRACTOR_MIN_VELOCITY) +
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

    cabinWall: { r: 35, g: 25, b: 20, a: 255 },
    cabinWallDark: { r: 25, g: 15, b: 12, a: 255 },
    cabinRoof: { r: 45, g: 55, b: 75, a: 255 },
    cabinDoor: { r: 20, g: 12, b: 8, a: 255 },
    cabinWindow: { r: 220, g: 190, b: 100, a: 255 },
    cabinChimney: { r: 25, g: 15, b: 12, a: 255 },
    snow: { r: 50, g: 60, b: 90, a: 180 },
  };

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
  }> = [];
  let smokeFrameCount = 0;

  // Aurora curve — single spline with many control points for organic shape
  const auroraCurvePoints: AuroraControlPoint[] = [];
  for (let i = 0; i < AURORA_CONTROL_POINTS; i++) {
    const f = i / (AURORA_CONTROL_POINTS - 1);
    const edgeFactor = 1 - Math.abs(f - 0.5) * 1.2;
    // 3 overlapping oscillation layers with independent frequencies per point
    const oscillations: AuroraControlPoint["oscillations"] = [];
    for (let o = 0; o < 3; o++) {
      oscillations.push({
        phase: Math.random() * Math.PI * 2,
        freq: AURORA_DRIFT_SPEED * (0.6 + Math.random() * 1.2),
        amp: (0.5 + Math.random() * 1.5) * edgeFactor,
      });
    }
    auroraCurvePoints.push({
      baseY: 4 + Math.random() * 4 * edgeFactor + Math.sin(f * Math.PI) * 3,
      oscillations,
    });
  }
  const auroraCurve: AuroraCurve = {
    points: auroraCurvePoints,
    hueOffset: Math.random(),
    hueDrift: 0.00005 + Math.random() * 0.0001,
  };

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

      // Update snow attractors
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
      if (Math.random() < SNOW_SPAWN_RATE * speed) {
        let sx: number;
        let sy: number;
        const edge = Math.random();
        if (edge < 0.7) {
          sx = Math.random() * width;
          sy = -Math.random() * 4;
        } else if (edge < 0.85) {
          sx = 0;
          sy = Math.random() * height;
        } else {
          sx = width - 1;
          sy = Math.random() * height;
        }
        snowParticles.push({
          x: sx,
          y: sy,
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
      const chimneySpawnX =
        cx + Math.floor(CABIN_WIDTH / 2) - 3 + CHIMNEY_WIDTH / 2;
      const chimneySpawnY = groundY - CABIN_WALL_HEIGHT - CABIN_ROOF_HEIGHT - 2;
      for (let i = 0; i < smokeParticles.length; ) {
        const s = smokeParticles[i];
        s.age += speed;
        if (s.age >= s.ttl) {
          smokeParticles.splice(i, 1);
          continue;
        }
        const life = s.age / s.ttl;
        const windVec = snowGrid.getVector(
          Math.min(width - 1, Math.max(0, s.x)),
          Math.min(height - 1, Math.max(0, s.y))
        );
        s.y -= SMOKE_RISE_SPEED * (1 - life * 0.5) * speed;
        s.x += windVec.x * SNOW_FALL_SPEED * speed;
        ++i;
      }
      smokeFrameCount++;
      if (smokeFrameCount % SMOKE_EMIT_INTERVAL === 0) {
        smokeParticles.push({
          x: chimneySpawnX + (Math.random() - 0.5),
          y: chimneySpawnY,
          age: 0,
          ttl: SMOKE_TTL * (0.8 + Math.random() * 0.4),
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

      // Aurora (night / near-night only)
      {
        let auroraAlpha = 0;
        if (dayPeriod === "Night") {
          // Use paletteLerp to fade in at start of night, fade out at end
          // paletteLerp goes 0->1 over the night period
          const fadeZone = 0.15;
          if (paletteLerp < fadeZone) {
            auroraAlpha = paletteLerp / fadeZone;
          } else if (paletteLerp > 1 - fadeZone) {
            auroraAlpha = (1 - paletteLerp) / fadeZone;
          } else {
            auroraAlpha = 1.0;
          }
        }

        if (auroraAlpha > 0) {
          // Build animated control points — each point sums its own independent
          // oscillation layers so neighboring points can move in opposite directions
          const controlPoints: Vec2[] = [];
          for (let i = 0; i < AURORA_CONTROL_POINTS; i++) {
            const cp = auroraCurve.points[i];
            let yOffset = 0;
            for (const osc of cp.oscillations) {
              yOffset += Math.sin(t * osc.freq + osc.phase) * osc.amp;
            }
            const xFrac = i / (AURORA_CONTROL_POINTS - 1);
            controlPoints.push({
              x: -2 + (width + 4) * xFrac,
              y: cp.baseY + yOffset,
            });
          }
          const frameSamples = sampleSpline(controlPoints, AURORA_SAMPLES);

          const hue = (auroraCurve.hueOffset + t * auroraCurve.hueDrift) % 1.0;

          backbuffer.blendMode(alphaAdditiveBlend);
          for (let px = 0; px < width; px++) {
            const { curveY } = curveYAtX(px, frameSamples);
            const shimmer = auroraShimmer(px, curveY, t);
            const colorShift = colorGradientNoise(px, curveY, t);

            for (let py = 0; py < AURORA_REGION_BOTTOM; py++) {
              const vertDist = py - curveY;
              const isBelow = vertDist > 0;
              const absDist = Math.abs(vertDist);
              const falloffDist = isBelow
                ? AURORA_FALLOFF_DOWN
                : AURORA_FALLOFF_UP;
              const intensity = 1.0 - smoothstep(0, falloffDist, absDist);
              if (intensity <= 0) continue;

              // Noise shifts color bands along the curtain so pink/purple
              // can appear closer to the curve spine at certain positions
              const rawBelowFactor = isBelow
                ? Math.min(1, vertDist / AURORA_FALLOFF_DOWN)
                : 0;
              const belowFactor = Math.max(
                0,
                Math.min(1, rawBelowFactor + colorShift)
              );

              let r: number;
              let g: number;
              let b: number;
              if (belowFactor < 0.4) {
                const f = belowFactor / 0.4;
                r = 40 + (20 - 40) * f + hue * 30;
                g = 220 + (160 - 220) * f;
                b = 80 + (140 - 80) * f + hue * 40;
              } else {
                const f = (belowFactor - 0.4) / 0.6;
                r = 20 + (120 - 20) * f + hue * 40;
                g = 160 + (40 - 160) * f;
                b = 140 + (180 - 140) * f;
              }

              const finalIntensity =
                intensity * shimmer * AURORA_MAX_INTENSITY * auroraAlpha;

              if (finalIntensity > 0) {
                backbuffer
                  .fgColor({
                    r: Math.min(255, Math.round(r * finalIntensity)),
                    g: Math.min(255, Math.round(g * finalIntensity)),
                    b: Math.min(255, Math.round(b * finalIntensity)),
                    a: 255,
                  })
                  .setPixel(px, py);
              }
            }
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
          Math.floor(((ry + 1) * (CABIN_WIDTH / 2)) / CABIN_ROOF_HEIGHT) + 1;
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
        .fill(
          chimneyX,
          cabinRoofPeak - 1,
          chimneyX + CHIMNEY_WIDTH - 1,
          cabinRoofPeak + 1
        );

      // Chimney smoke — filled squares that shrink and fade
      backbuffer.blendMode(alphaBlend);
      for (const s of smokeParticles) {
        const life = s.age / s.ttl;
        const alpha = Math.round(60 * (1 - life));
        const size = Math.max(1, Math.round(SMOKE_INITIAL_SIZE * (1 - life)));
        const sx = Math.round(s.x);
        const sy = Math.round(s.y);
        backbuffer
          .fgColor({ r: 180, g: 180, b: 190, a: alpha })
          .fill(sx, sy, sx + size - 1, sy + size - 1);
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
