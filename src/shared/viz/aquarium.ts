import type { Vec2 } from "./helpers.ts";
import { lerp, mul, vecLength, vecNormalize } from "./helpers.ts";
import type { IVisualization } from "./visualization-type.ts";
import { FlowGrid } from "./flow-grid.ts";
import type { IAudioPlayer } from "../audio-player-type.ts";
import type { Backbuffer, RGBAColor } from "../back-buffer.ts";

const FLOOR_LAYERS = 8;
const SAND_BASE = { r: 128, g: 128, b: 64, a: 255 };
const SAND_DARK = { r: 64, g: 64, b: 16, a: 255 };
const SAND_TEXTURE_DENSITY = 5;
const KELP = { r: 0, g: 102, b: 0, a: 255 };
const KELP_DENSITY = 4;
const WATER = { r: 0, g: 16, b: 96, a: 255 };
const WATER_BASE = { r: 0, g: 32, b: 64, a: 255 };
const FISH_COUNT = 2;
const FISH_VELOCITY = 10;
const FLOW_GRID_RESOLUTION = 8;
const BUBBLE_DENSITY = 1;
const BUBBLE_RISING_SPEED = 0.2;
const MAX_WAVE_DEPTH = 6;
const WAVE_STRENGTH = 0.6;
const WAVE_SPEED = 0.06;
const ITERATIONS = 1;

class Movable {
  _x: number;
  _y: number;
  _xo: number;
  _yo: number;
  _vx: number;
  _vy: number;
  xOffset: number;
  yOffset: number;
  width: number;
  height: number;

  draw(_backbuffer: Backbuffer) {}

  constructor(top: number, left: number, bottom: number, right: number) {
    this._x = 0;
    this._y = 0;
    this._xo = 1.0;
    this._yo = 1.0;
    this.xOffset = left;
    this.yOffset = top;
    this.width = right - left;
    this.height = bottom - top;
    this._vx = 0;
    this._vy = 0;
  }

  setVelocity(x: number, y: number) {
    this._vx = x;
    this._vy = y;
  }

  setPosition(x: number, y: number) {
    this._x = x;
    this._y = y;
  }

  movePosition(dt: number) {
    this._x += this._xo * this._vx * (dt / 1000);
    this._y += this._yo * this._vy * (dt / 1000);
  }

  getPosition(): Vec2 {
    return { x: this._x, y: this._y };
  }

  getBoundingRect(): {
    top: number;
    left: number;
    bottom: number;
    right: number;
  } {
    return {
      top:
        this._yo >= 0
          ? this._y + this.yOffset
          : this._y - this.yOffset - this.height,
      left:
        this._xo >= 0
          ? this._x + this.xOffset
          : this._x - this.xOffset - this.width,
      bottom:
        this._yo >= 0
          ? this._y + this.yOffset + this.height
          : this._y - this.yOffset,
      right:
        this._xo >= 0
          ? this._x + this.xOffset + this.width
          : this._x - this.xOffset,
    };
  }

  setOrientation(x: number, y: number) {
    this._xo = x;
    this._yo = y;
  }

  getOrientation(): Vec2 {
    return { x: this._xo, y: this._yo };
  }

  x(x: number): number {
    return this._x + x * this._xo;
  }

  y(y: number): number {
    return this._y + y * this._yo;
  }
}

class ArawanaFish extends Movable {
  _main?: RGBAColor;
  _mainBright?: RGBAColor;
  _mainDark?: RGBAColor;
  _fin?: RGBAColor;

  constructor() {
    super(-6, -22, 7, 15);
  }

  draw(backbuffer: Backbuffer) {
    if (!this._main || !this._mainBright || !this._mainDark || !this._fin) {
      return;
    }

    backbuffer
      .drawLine(
        this.x(-8),
        this.y(-5),
        this.x(15),
        this.y(-5),
        this._mainBright
      )
      .fill(this.x(-7), this.y(-4), this.x(9), this.y(4), this._main)
      .fill(this.x(10), this.y(-4), this.x(14), this.y(-2), this._main)
      .fill(this.x(10), this.y(-2), this.x(13), this.y(0), this._main)
      .fill(this.x(10), this.y(0), this.x(12), this.y(2), this._main)
      .fill(this.x(10), this.y(0), this.x(12), this.y(2), this._main)
      .drawLine(this.x(10), this.y(3), this.x(11), this.y(3), this._main)
      .setPixel(this.x(10), this.y(4), this._main)
      .drawLine(this.x(-17), this.y(0), this.x(-8), this.y(0), this._main)
      .drawLine(this.x(-15), this.y(-1), this.x(-8), this.y(-1), this._main)
      .drawLine(this.x(-13), this.y(-2), this.x(-8), this.y(-2), this._main)
      .drawLine(this.x(-11), this.y(-3), this.x(-8), this.y(-3), this._main)
      .drawLine(this.x(-9), this.y(-4), this.x(-8), this.y(-4), this._main)
      .drawLine(this.x(-15), this.y(1), this.x(-8), this.y(1), this._main)
      .drawLine(this.x(-13), this.y(2), this.x(-8), this.y(2), this._main)
      .drawLine(this.x(-11), this.y(3), this.x(-8), this.y(3), this._main)
      .drawLine(this.x(-9), this.y(4), this.x(-8), this.y(4), this._main)
      .drawLine(this.x(15), this.y(-4), this.x(15), this.y(-2), this._mainDark)
      .drawLine(this.x(15), this.y(-2), this.x(14), this.y(-2), this._mainDark)
      .drawLine(this.x(14), this.y(-2), this.x(14), this.y(0), this._mainDark)
      .drawLine(this.x(14), this.y(0), this.x(13), this.y(0), this._mainDark)
      .drawLine(this.x(13), this.y(0), this.x(13), this.y(2), this._mainDark)
      .drawLine(this.x(13), this.y(2), this.x(12), this.y(3), this._mainDark)
      .drawLine(this.x(12), this.y(3), this.x(11), this.y(4), this._mainDark)
      .drawLine(this.x(11), this.y(4), this.x(9), this.y(5), this._mainDark)
      .drawLine(this.x(9), this.y(5), this.x(-7), this.y(5), this._mainDark)
      // fin
      .drawLine(this.x(-16), this.y(-6), this.x(-4), this.y(-6), this._fin)
      .drawLine(this.x(-14), this.y(-5), this.x(-7), this.y(-5), this._fin)
      .drawLine(this.x(-16), this.y(6), this.x(-4), this.y(6), this._fin)
      .drawLine(this.x(-14), this.y(5), this.x(-2), this.y(5), this._fin)
      .drawLine(this.x(-22), this.y(0), this.x(-18), this.y(0), this._fin)
      .drawLine(this.x(-20), this.y(-1), this.x(-16), this.y(-1), this._fin)
      .drawLine(this.x(-18), this.y(-2), this.x(-14), this.y(-2), this._fin)
      .drawLine(this.x(-16), this.y(-3), this.x(-12), this.y(-3), this._fin)
      .drawLine(this.x(-14), this.y(-4), this.x(-10), this.y(-4), this._fin)
      .drawLine(this.x(-20), this.y(1), this.x(-16), this.y(1), this._fin)
      .drawLine(this.x(-18), this.y(2), this.x(-14), this.y(2), this._fin)
      .drawLine(this.x(-16), this.y(3), this.x(-12), this.y(3), this._fin)
      .drawLine(this.x(-14), this.y(4), this.x(-10), this.y(4), this._fin)
      .drawLine(this.x(8), this.y(3), this.x(3), this.y(7), this._fin)
      .drawLine(this.x(7), this.y(3), this.x(2), this.y(7), this._fin)
      // eye
      .drawLine(this.x(11), this.y(-3), this.x(12), this.y(-3), {
        r: 0,
        g: 0,
        b: 0,
        a: 255,
      });
  }

  setColors(main: RGBAColor) {
    this._main = main;
    this._mainBright = mul(main, 1.2, 255);
    this._mainDark = mul(main, 0.8, 255);
    this._fin = mul(main, 0.6, 255);
  }
}

class PufferFish extends Movable {
  _puffed: boolean;
  _main?: RGBAColor;
  _mainBright?: RGBAColor;
  _mainDark?: RGBAColor;

  constructor() {
    super(-6, -8, 5, 5);
    this._puffed = false;
  }

  draw(backbuffer: Backbuffer) {
    if (!this._main || !this._mainBright || !this._mainDark) {
      return;
    }

    if (!this._puffed && Math.random() < 0.002) {
      this._puffed = !this._puffed;
      this._vy = -6;
      this._vx *= 0.5;
    }

    backbuffer.fill(
      this.x(-4),
      this.y(-3),
      this.x(4),
      this.y(2),
      this._main
    )
      .drawLine(this.x(5), this.y(-2), this.x(5), this.y(0), this._main)
      .drawLine(this.x(-5), this.y(-2), this.x(-5), this.y(1), this._main);
      backbuffer.fill(
      this.x(-8),
      this.y(-4),
      this.x(-6),
      this.y(-2),
      this._main
    )
      backbuffer.fill(
      this.x(-8),
      this.y(0),
      this.x(-6),
      this.y(2),
      this._main
    )
      .drawLine(this.x(-4), this.y(-3), this.x(4), this.y(-3), this._mainBright)
      .drawLine(this.x(-4), this.y(2), this.x(4), this.y(2), this._mainDark)
      .drawLine(this.x(4), this.y(1), this.x(4), this.y(2), this._mainDark)
    // eye
    backbuffer.fill( this.x(1), this.y(-2), this.x(3), this.y(0), {
      r: 255,
      g: 255,
      b: 255,
      a: 255,
    }).setPixel(this.x(2), this.y(-1), { r: 0, g: 0, b: 0, a: 255 });

    if (this._puffed) {
        backbuffer.fill(
        this.x(-2),
        this.y(3),
        this.x(4),
        this.y(6),
        this._mainDark
      )
        .drawLine(this.x(5), this.y(1), this.x(5), this.y(4), this._mainDark)
        .drawLine(this.x(-4), this.y(3), this.x(-4), this.y(4), this._mainDark)
        .drawLine(this.x(-3), this.y(3), this.x(-3), this.y(5), this._mainDark)
        .drawLine(
          this.x(-2),
          this.y(-4),
          this.x(2),
          this.y(-4),
          this._mainBright
        )
        .setPixel(this.x(-2), this.y(-5), this._mainBright)
        .setPixel(this.x(1), this.y(-5), this._mainBright)
        .setPixel(this.x(4), this.y(-4), this._mainBright)
        .setPixel(this.x(-4), this.y(5), this._mainBright)
        .setPixel(this.x(-1), this.y(6), this._mainBright)
        .setPixel(this.x(2), this.y(6), this._mainBright)
        .setPixel(this.x(5), this.y(3), this._mainBright)
        .setPixel(this.x(6), this.y(-1), this._mainBright)
        // eye
        .setPixel(this.x(0), this.y(-1), { r: 255, g: 255, b: 255, a: 255 })
        .setPixel(this.x(4), this.y(-1), { r: 255, g: 255, b: 255, a: 255 })
        .setPixel(this.x(2), this.y(-3), { r: 255, g: 255, b: 255, a: 255 })
        .setPixel(this.x(2), this.y(1), { r: 255, g: 255, b: 255, a: 255 });
    }
  }

  setColors(main: RGBAColor) {
    this._main = main;
    this._mainBright = mul(main, 1.3, 255);
    this._mainDark = mul(main, 0.6, 255);
  }
}

class SunFish extends Movable {
  _main?: RGBAColor;
  _mainBright?: RGBAColor;
  _mainDark?: RGBAColor;
  _fin?: RGBAColor;
  _nose?: RGBAColor;

  constructor() {
    super(-7, -9, 7, 8);
  }

  draw(backbuffer: Backbuffer) {
    if (
      !this._main ||
      !this._mainBright ||
      !this._mainDark ||
      !this._fin ||
      !this._nose
    ) {
      return;
    }

    backbuffer
      .fill(this.x(-7), this.y(-5), this.x(6), this.y(5), this._main)
      .drawLine(this.x(8), this.y(-1), this.x(8), this.y(1), this._mainDark)
      .drawLine(this.x(8), this.y(1), this.x(6), this.y(1), this._mainDark)
      .drawLine(this.x(6), this.y(1), this.x(6), this.y(5), this._mainDark)
      .drawLine(this.x(6), this.y(5), this.x(-7), this.y(5), this._mainDark)
      .drawLine(this.x(-7), this.y(5), this.x(-7), this.y(7), this._mainDark)
      .drawLine(this.x(-7), this.y(-7), this.x(-7), this.y(-5), this._mainDark)
      .drawLine(this.x(-7), this.y(7), this.x(-9), this.y(7), this._mainDark)
      //fin 1
      .drawLine(this.x(-2), this.y(5), this.x(-2), this.y(8), this._mainDark)
      .drawLine(this.x(-2), this.y(8), this.x(0), this.y(8), this._mainDark)
      .drawLine(this.x(0), this.y(8), this.x(0), this.y(5), this._mainDark)
      .drawLine(this.x(-9), this.y(7), this.x(-9), this.y(-7), this._mainBright)
      .drawLine(
        this.x(-9),
        this.y(-7),
        this.x(-7),
        this.y(-7),
        this._mainBright
      )
      .drawLine(this.x(-7), this.y(-5), this.x(6), this.y(-5), this._mainBright)
      .drawLine(this.x(6), this.y(-5), this.x(6), this.y(-1), this._mainBright)
      .drawLine(this.x(6), this.y(-1), this.x(8), this.y(-1), this._mainBright)
      // fin 2
      .drawLine(
        this.x(-2),
        this.y(-5),
        this.x(-2),
        this.y(-8),
        this._mainBright
      )
      .drawLine(this.x(-2), this.y(-8), this.x(0), this.y(-8), this._mainBright)
      .drawLine(this.x(0), this.y(-8), this.x(0), this.y(-5), this._mainBright)
      // eye
      .setPixel(this.x(4), this.y(-3), this._fin)
      // fin 2 fill
      .fill(this.x(-1), this.y(6), this.x(-1), this.y(7), this._fin)
      // fin 2 fill
      .fill(this.x(-1), this.y(-7), this.x(-1), this.y(-6), this._fin)
      // tail fill
      .fill(this.x(-8), this.y(-6), this.x(-8), this.y(6), this._fin)
      //nose
      .setPixel(this.x(7), this.y(0), this._nose);
  }

  setColors(main: RGBAColor, fin: RGBAColor, nose: RGBAColor) {
    this._main = main;
    this._mainBright = mul({ ...main }, 1.3, 255);
    this._mainDark = mul({ ...main }, 0.6, 255);
    this._fin = fin;
    this._nose = nose;
  }
}

type Effector = Vec2 & { l: number };

class Kelp {
  chain: Array<Effector>;
  _color: RGBAColor;
  _lerpFactor: number;

  constructor(
    anchorX: number,
    anchorY: number,
    layer: number,
    length: number,
    segments: number
  ) {
    const segmentLength = length / segments;
    this.chain = [{ x: anchorX, y: anchorY, l: segmentLength }];
    while (segments-- > 0) {
      const last = this.chain[this.chain.length - 1];
      const current = {
        x: last.x,
        y: last.y - segmentLength,
        l: segmentLength,
      };
      this.chain.push(current);
    }
    this._color = { ...KELP };
    this._color.g += (Math.random() - 0.5) * KELP.g * 0.1;
    this._lerpFactor = 1.0 - layer / FLOOR_LAYERS;
  }

  draw(backbuffer: Backbuffer, water: RGBAColor) {
    const color = lerp(this._color, water, this._lerpFactor);

    let prev = this.chain[0];
    for (let i = 1; i < this.chain.length; ++i) {
      backbuffer.drawLine(
        prev.x,
        prev.y,
        this.chain[i].x,
        this.chain[i].y,
        color
      );
      prev = this.chain[i];
    }
  }

  getEffector(): Effector {
    return this.chain[this.chain.length - 1];
  }
}

class Bubble {
  x: number;
  y: number;
  r: number;
  _lerpFactor: number;

  constructor(x: number, y: number, layer: number, size: number) {
    this.x = x;
    this.y = y;
    this.r = size;
    this._lerpFactor = 1.0 - layer / FLOOR_LAYERS;
  }
  draw(backbuffer: Backbuffer) {
    const color = { r: 0, g: 32, b: 128, a: 128 * this._lerpFactor };
    backbuffer.drawCircle(this.x, this.y, this.r, color);
  }
}

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

function spawnFish(
  movable: Array<Array<Movable>>,
  width: number,
  height: number
) {
  const layer = Math.round(Math.random() * (FLOOR_LAYERS - 1));
  const lerpFactor = Math.min(layer / FLOOR_LAYERS + 0.5, 1.0);

  const spawn = Math.random();
  const m = (() => {
    if (spawn < 0.2) {
      const m = new PufferFish();
      m.setColors(
        lerp(
          WATER_BASE,
          {
            r: Math.round(Math.random() * 255),
            g: Math.round(Math.random() * 255),
            b: Math.round(Math.random() * 255),
            a: 255,
          },
          lerpFactor
        )
      );
      return m;
    } else if (spawn < 0.4) {
      const m = new ArawanaFish();
      m.setColors(
        lerp(
          WATER_BASE,
          {
            r: Math.round(Math.random() * 255),
            g: Math.round(Math.random() * 255),
            b: Math.round(Math.random() * 255),
            a: 255,
          },
          lerpFactor
        )
      );
      return m;
    } else {
      const m = new SunFish();
      m.setColors(
        lerp(
          WATER_BASE,
          {
            r: Math.round(Math.random() * 255),
            g: Math.round(Math.random() * 255),
            b: Math.round(Math.random() * 255),
            a: 255,
          },
          lerpFactor
        ),
        lerp(
          WATER_BASE,
          {
            r: Math.round(Math.random() * 64),
            g: Math.round(Math.random() * 64),
            b: Math.round(Math.random() * 64),
            a: 255,
          },
          lerpFactor
        ),
        lerp(
          WATER_BASE,
          {
            r: Math.round(Math.random() * 255),
            g: Math.round(Math.random() * 255),
            b: Math.round(Math.random() * 255),
            a: 255,
          },
          lerpFactor
        )
      );
      return m;
    }
  })();

  const orientation = Math.sign(Math.random() - 0.5);
  const y =
    Math.random() * (height - m.height - FLOOR_LAYERS + layer) - m.yOffset;
  const xOffset = m.width + m.xOffset;
  m.setVelocity(FISH_VELOCITY * (Math.random() + 0.5), 0.0);
  m.setOrientation(orientation, 1);
  m.setPosition(orientation > 0 ? -xOffset : width + xOffset, y);
  movable[layer].push(m);
}

type Attractor = {
  x: number;
  y: number;
  dx: number;
  strength: number;
  maxDistance: number;
};

function applyDirectionalAttractors(
  grid: FlowGrid,
  attractors: Array<Attractor>
) {
  grid.map((x, y, v) => {
    v.y = -1;
    v.x = 0;
    for (let a of attractors) {
      if (Math.sign(x - a.x) != Math.sign(a.dx)) {
        const attractorDirection = { x: a.x - x, y: a.y - y };
        const distance = vecLength(attractorDirection);
        if (distance !== 0) {
          attractorDirection.x /= distance;
          attractorDirection.y /= distance;
          const scaledDistance =
            Math.min(distance, a.maxDistance) / a.maxDistance;
          v.x += attractorDirection.x * (1.0 - scaledDistance) * a.strength;
        }
      }
    }
    vecNormalize(v);
  });
}

export default function (width: number, height: number): IVisualization {
  const grid = new FlowGrid(width, height, {
    x: FLOW_GRID_RESOLUTION,
    y: FLOW_GRID_RESOLUTION,
  });
  const attractors = [
    {
      x: 0,
      y: -1,
      dx: WAVE_SPEED,
      strength: WAVE_STRENGTH,
      maxDistance: MAX_WAVE_DEPTH,
    },
  ];

  const sandTexture: Array<number> = [];
  for (let i = 0; i < SAND_TEXTURE_DENSITY * FLOOR_LAYERS; ++i) {
    sandTexture.push(Math.random() * (width - 1));
  }

  const kelp: Array<Array<Kelp>> = [];
  const movable: Array<Array<Movable>> = [];
  for (let i = 0; i < FLOOR_LAYERS; ++i) {
    const kelpLayer: Array<Kelp> = [];
    for (let j = 0; j < KELP_DENSITY; ++j) {
      kelpLayer.push(
        new Kelp(
          Math.random() * (width - 1),
          height - 1 - FLOOR_LAYERS + i,
          i,
          Math.random() * (height - 1 - FLOOR_LAYERS + i),
          4
        )
      );
    }
    kelp.push(kelpLayer);
    movable.push([]);
  }

  for (let i = 0; i < FISH_COUNT; ++i) {
    spawnFish(movable, width, height);
  }

  const bubbles: Array<Array<Bubble>> = [];
  for (let i = 0; i < FLOOR_LAYERS; ++i) {
    const bubbleLayer: Array<Bubble> = [];
    const maxHeight = height - 1 - FLOOR_LAYERS + i;
    for (let j = 0; j < BUBBLE_DENSITY; ++j) {
      bubbleLayer.push(
        new Bubble(
          Math.random() * (width - 1),
          Math.random() * maxHeight,
          i,
          Math.random() * 2
        )
      );
    }
    bubbles.push(bubbleLayer);
  }

  return {
    name: "Aquarium",
    audio: "aquarium.mp3",
    volume: 18,
    run: (
      backbuffer: Backbuffer,
      _audio: IAudioPlayer,
      dt: number,
      _t: number
    ) => {
      for (let a of attractors) {
        a.x += a.dx;
        if (a.x > grid.resolution.x + 2 || a.x < -3) {
          a.dx *= -1;
        }
      }
      applyDirectionalAttractors(grid, attractors);

      // move kelp & bubbles
      for (let layer = 0; layer < FLOOR_LAYERS; ++layer) {
        for (let k of kelp[layer]) {
          const startEffector = { ...k.getEffector() };
          const vec = grid.getVector(
            Math.min(width - 1, Math.max(0, startEffector.x)),
            Math.min(height - 1, Math.max(0, startEffector.y))
          );

          const endEffector = {
            x: startEffector.x + vec.x,
            y: startEffector.y + vec.y,
          };
          fabrikSolve(k.chain, endEffector, ITERATIONS);
        }

        const maxHeight = height - 1 - FLOOR_LAYERS + layer;
        for (let b of bubbles[layer]) {
          const vec = grid.getVector(
            Math.min(width - 1, Math.max(0, b.x)),
            Math.min(height - 1, Math.max(0, b.y))
          );
          b.x += vec.x;
          if (b.x > width - 1 || b.x < 0) {
            b.x = Math.random() * (width - 1);
          }
          b.y += vec.y * BUBBLE_RISING_SPEED;
          if (b.y > maxHeight || b.y < 0) {
            b.y = maxHeight;
            b.x = Math.random() * (width - 1);
          }
        }
      }

      // move objects around
      let respawn = 0;
      for (let layer = 0; layer < FLOOR_LAYERS; ++layer) {
        for (let i = movable[layer].length - 1; i >= 0; --i) {
          const m = movable[layer][i];
          m.movePosition(dt);
          const rect = m.getBoundingRect();
          if (
            rect.right < 0 ||
            rect.left > width ||
            rect.bottom < 0 ||
            rect.top > height
          ) {
            movable[layer].splice(i, 1);
            respawn++;
          }
        }
      }
      while (respawn-- > 0) {
        spawnFish(movable, width, height);
      }

      backbuffer.clear();

      //background
      for (let y = 0; y < height; ++y) {
        const water = {
          r: Math.max(0, WATER.r - y),
          g: Math.max(0, WATER.g - y),
          b: Math.max(0, WATER.b - y * 2),
          a: 255,
        };
        if (y > height - FLOOR_LAYERS) {
          const layer = y - (height - FLOOR_LAYERS);
          const light = lerp(water, SAND_BASE, layer / FLOOR_LAYERS);
          const dark = lerp(water, SAND_DARK, layer / FLOOR_LAYERS);
          backbuffer.drawLine(0, y, width - 1, y, light);
          for (let i = 0; i < SAND_TEXTURE_DENSITY; ++i) {
            backbuffer.setPixel(
              sandTexture[layer * SAND_TEXTURE_DENSITY + i],
              y,
              dark
            );
          }
        } else {
          backbuffer.drawLine(0, y, width - 1, y, water);
        }
      }

      for (let layer = 0; layer < FLOOR_LAYERS; ++layer) {
        for (let k of kelp[layer]) {
          k.draw(backbuffer, WATER_BASE);
        }
        for (let m of movable[layer]) {
          m.draw(backbuffer);
        }
        for (let b of bubbles[layer]) {
          b.draw(backbuffer);
        }
      }
    },
  };
}
