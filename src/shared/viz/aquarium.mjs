/**
 * @format
 */
import {lerp, mul, vecLength, vecNormalize} from './helpers.mjs';
import {FlowGrid} from './flow-grid.mjs';

const FLOOR_LAYERS = 8;
const SAND_BASE = {r: 128, g: 128, b: 64};
const SAND_DARK = {r: 64, g: 64, b: 16};
const SAND_TEXTURE_DENSITY = 5;
const KELP = {r: 0, g: 102, b: 0};
const KELP_DENSITY = 4;
const WATER = {r: 0, g: 16, b: 96};
const WATER_BASE = {r: 0, g: 32, b: 64};
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
  constructor(top, left, bottom, right) {
    this._x = 0;
    this._y = 0;
    this._xo = 1.0;
    this._yo = 1.0;
    this.xOffset = left;
    this.yOffset = top;
    this.width = right - left;
    this.height = bottom - top;
    this.vx = 1;
    this.vy = 1;
  }

  setVelocity(x, y) {
    this._vx = x;
    this._vy = y;
  }

  setPosition(x, y) {
    this._x = x;
    this._y = y;
  }

  movePosition(dt) {
    this._x += this._xo * this._vx * (dt / 1000);
    this._y += this._yo * this._vy * (dt / 1000);
  }

  getPosition() {
    return {x: this._x, y: this._y};
  }

  getBoundingRect() {
    return {
      top: this._y + this.yOffset,
      left: this._x + this.xOffset,
      bottom: this._y + this.yOffset + this.height,
      right: this._x + this.xOffset + this.width,
    };
  }

  setOrientation(x, y) {
    this._xo = x;
    this._yo = y;
  }

  getOrientation() {
    return {x: this._xo, y: this._yo};
  }

  x(x) {
    return this._x + x * this._xo;
  }

  y(y) {
    return this._y + y * this._yo;
  }
}

class ArawanaFish extends Movable {
  constructor() {
    super(-6, -22, 7, 15);
  }

  draw(matrix) {
    matrix
      .fgColor(this._mainBright)
      .drawLine(this.x(-8), this.y(-5), this.x(15), this.y(-5))
      .fgColor(this._main)
      .fill(this.x(-7), this.y(-4), this.x(10), this.y(4))
      .fill(this.x(11), this.y(-4), this.x(14), this.y(-2))
      .fill(this.x(11), this.y(-2), this.x(13), this.y(0))
      .fill(this.x(11), this.y(0), this.x(12), this.y(2))
      .setPixel(this.x(11), this.y(3))
      .drawLine(this.x(-17), this.y(0), this.x(-8), this.y(0))
      .drawLine(this.x(-15), this.y(-1), this.x(-8), this.y(-1))
      .drawLine(this.x(-13), this.y(-2), this.x(-8), this.y(-2))
      .drawLine(this.x(-11), this.y(-3), this.x(-8), this.y(-3))
      .drawLine(this.x(-9), this.y(-4), this.x(-8), this.y(-4))
      .drawLine(this.x(-15), this.y(1), this.x(-8), this.y(1))
      .drawLine(this.x(-13), this.y(2), this.x(-8), this.y(2))
      .drawLine(this.x(-11), this.y(3), this.x(-8), this.y(3))
      .drawLine(this.x(-9), this.y(4), this.x(-8), this.y(4))
      .fgColor(this._mainDark)
      .drawLine(this.x(15), this.y(-4), this.x(15), this.y(-2))
      .drawLine(this.x(15), this.y(-2), this.x(14), this.y(-2))
      .drawLine(this.x(14), this.y(-2), this.x(14), this.y(0))
      .drawLine(this.x(14), this.y(0), this.x(13), this.y(0))
      .drawLine(this.x(13), this.y(0), this.x(13), this.y(2))
      .drawLine(this.x(13), this.y(2), this.x(12), this.y(3))
      .drawLine(this.x(12), this.y(3), this.x(11), this.y(4))
      .drawLine(this.x(11), this.y(4), this.x(10), this.y(5))
      .drawLine(this.x(10), this.y(5), this.x(-7), this.y(5))
      // fin
      .fgColor(this._fin)
      .drawLine(this.x(-16), this.y(-6), this.x(-4), this.y(-6))
      .drawLine(this.x(-14), this.y(-5), this.x(-7), this.y(-5))
      .drawLine(this.x(-16), this.y(6), this.x(-4), this.y(6))
      .drawLine(this.x(-14), this.y(5), this.x(-2), this.y(5))

      .drawLine(this.x(-22), this.y(0), this.x(-18), this.y(0))
      .drawLine(this.x(-20), this.y(-1), this.x(-16), this.y(-1))
      .drawLine(this.x(-18), this.y(-2), this.x(-14), this.y(-2))
      .drawLine(this.x(-16), this.y(-3), this.x(-12), this.y(-3))
      .drawLine(this.x(-14), this.y(-4), this.x(-10), this.y(-4))
      .drawLine(this.x(-20), this.y(1), this.x(-16), this.y(1))
      .drawLine(this.x(-18), this.y(2), this.x(-14), this.y(2))
      .drawLine(this.x(-16), this.y(3), this.x(-12), this.y(3))
      .drawLine(this.x(-14), this.y(4), this.x(-10), this.y(4))

      .drawLine(this.x(8), this.y(3), this.x(3), this.y(7))
      // eye
      .fgColor({r: 0, g: 0, b: 0})
      .drawLine(this.x(10), this.y(-3), this.x(12), this.y(-3));
  }

  setColors(main, fin) {
    this._main = main;
    this._mainBright = mul({...main}, 1.2, 255);
    this._mainDark = mul({...main}, 0.8, 255);
    this._fin = mul({...main}, 0.6, 255);
  }
}

class SunFish extends Movable {
  constructor() {
    super(-7, -9, 7, 8);
  }

  draw(matrix) {
    matrix
      .fgColor(this._main)
      .fill(this.x(-7), this.y(-5), this.x(6), this.y(5))
      .fgColor(this._mainDark)
      .drawLine(this.x(8), this.y(-1), this.x(8), this.y(1))
      .drawLine(this.x(8), this.y(1), this.x(6), this.y(1))
      .drawLine(this.x(6), this.y(1), this.x(6), this.y(5))
      .drawLine(this.x(6), this.y(5), this.x(-7), this.y(5))
      .drawLine(this.x(-7), this.y(5), this.x(-7), this.y(7))
      .drawLine(this.x(-7), this.y(-7), this.x(-7), this.y(-5))
      .drawLine(this.x(-7), this.y(7), this.x(-9), this.y(7))
      //fin 1
      .drawLine(this.x(-2), this.y(5), this.x(-2), this.y(8))
      .drawLine(this.x(-2), this.y(8), this.x(0), this.y(8))
      .drawLine(this.x(0), this.y(8), this.x(0), this.y(5))
      .fgColor(this._mainBright)
      .drawLine(this.x(-9), this.y(7), this.x(-9), this.y(-7))
      .drawLine(this.x(-9), this.y(-7), this.x(-7), this.y(-7))
      .drawLine(this.x(-7), this.y(-5), this.x(6), this.y(-5))
      .drawLine(this.x(6), this.y(-5), this.x(6), this.y(-1))
      .drawLine(this.x(6), this.y(-1), this.x(8), this.y(-1))
      // fin 2
      .drawLine(this.x(-2), this.y(-5), this.x(-2), this.y(-8))
      .drawLine(this.x(-2), this.y(-8), this.x(0), this.y(-8))
      .drawLine(this.x(0), this.y(-8), this.x(0), this.y(-5))
      // eye
      .fgColor(this._fin)
      .setPixel(this.x(4), this.y(-3))
      // fin 2 fill
      .fill(this.x(-1), this.y(6), this.x(-1), this.y(7))
      // fin 2 fill
      .fill(this.x(-1), this.y(-7), this.x(-1), this.y(-6))
      // tail fill
      .fill(this.x(-8), this.y(-6), this.x(-8), this.y(6))
      //nose
      .fgColor(this._nose)
      .setPixel(this.x(7), this.y(0));
  }

  setColors(main, fin, nose) {
    this._main = main;
    this._mainBright = mul({...main}, 1.2, 255);
    this._mainDark = mul({...main}, 0.8, 255);
    this._fin = fin;
    this._nose = nose;
  }
}

class Kelp {
  constructor(anchorX, anchorY, layer, length, segments) {
    const segmentLength = length / segments;
    this.chain = [{x: anchorX, y: anchorY, l: segmentLength}];
    while (segments-- > 0) {
      const last = this.chain[this.chain.length - 1];
      const current = {
        x: last.x,
        y: last.y - segmentLength,
        l: segmentLength,
      };
      this.chain.push(current);
    }
    this._color = {...KELP};
    this._color.g += (Math.random() - 0.5) * KELP.g * 0.1;
    this._lerpFactor = 1.0 - layer / FLOOR_LAYERS;
  }

  draw(matrix, water) {
    const color = lerp(this._color, water, this._lerpFactor);

    matrix.fgColor(color);
    let prev = this.chain[0];
    for (let i = 1; i < this.chain.length; ++i) {
      matrix.drawLine(prev.x, prev.y, this.chain[i].x, this.chain[i].y);
      prev = this.chain[i];
    }
  }

  getEffector() {
    return this.chain[this.chain.length - 1];
  }
}

class Bubble {
  constructor(x, y, layer, size) {
    this.x = x;
    this.y = y;
    this.r = size;
    this._lerpFactor = 1.0 - layer / FLOOR_LAYERS;
  }
  draw(matrix, water) {
    const color = lerp({r: 0, g: 0, b: 64}, water, this._lerpFactor);
    matrix.fgColor(color).drawCircle(this.x, this.y, this.r);
  }
}

function fabrikSolve(chain, goal, iterations) {
  const anchorGoal = {...chain[0]};
  while (iterations-- > 0) {
    for (let i = chain.length - 1; i > 0; --i) {
      const c = chain[i];
      const p = chain[i - 1];
      c.x = goal.x;
      c.y = goal.y;
      const newSegment = {x: c.x - p.x, y: c.y - p.y};
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
      const newSegment = {x: c.x - p.x, y: c.y - p.y};
      vecNormalize(newSegment);
      p.x = goal.x - p.l * newSegment.x;
      p.y = goal.y - p.l * newSegment.y;
      goal = p;
    }
  }
}

function spawnFish(movable, width, height) {
  const layer = Math.round(Math.random() * (FLOOR_LAYERS - 1));
  const lerpFactor = Math.min(layer / FLOOR_LAYERS + 0.5, 1.0);

  const spawn = Math.random();
  let m = 0;
  if (spawn > 0) {
    m = new ArawanaFish();
    m.setColors(
      lerp(
        WATER_BASE,
        {
          r: Math.round(Math.random() * 255),
          g: Math.round(Math.random() * 255),
          b: Math.round(Math.random() * 255),
        },
        lerpFactor,
      ),
      lerp(
        WATER_BASE,
        {
          r: Math.round(Math.random() * 64),
          g: Math.round(Math.random() * 64),
          b: Math.round(Math.random() * 64),
        },
        lerpFactor,
      ),
    );
  } else {
    m = new SunFish();
    m.setColors(
      lerp(
        WATER_BASE,
        {
          r: Math.round(Math.random() * 255),
          g: Math.round(Math.random() * 255),
          b: Math.round(Math.random() * 255),
        },
        lerpFactor,
      ),
      lerp(
        WATER_BASE,
        {
          r: Math.round(Math.random() * 64),
          g: Math.round(Math.random() * 64),
          b: Math.round(Math.random() * 64),
        },
        lerpFactor,
      ),
      lerp(
        WATER_BASE,
        {
          r: Math.round(Math.random() * 255),
          g: Math.round(Math.random() * 255),
          b: Math.round(Math.random() * 255),
        },
        lerpFactor,
      ),
    );
  }

  const orientation = Math.sign(Math.random() - 0.5);
  const y =
    Math.random() * (height - m.height - FLOOR_LAYERS + layer) - m.yOffset;
  const xOffset = m.width + m.xOffset;
  m.setVelocity(FISH_VELOCITY * (Math.random() + 0.5), 0.0);
  m.setOrientation(orientation, 1);
  m.setPosition(orientation > 0 ? -xOffset : width + xOffset, y);
  movable[layer].push(m);
}

function applyDirectionalAttractors(grid, attractors) {
  for (let y = 0; y < grid.resolution.y; ++y) {
    for (let x = 0; x < grid.resolution.x; ++x) {
      const v = grid.vectors[y * grid.resolution.y + x];
      v.y = -1;
      v.x = 0;
      for (let a of attractors) {
        if (Math.sign(x - a.x) != Math.sign(a.dx)) {
          const attractorDirection = {x: a.x - x, y: a.y - y};
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
    }
  }
}

export default function (width, height) {
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

  const sandTexture = [];
  for (let i = 0; i < SAND_TEXTURE_DENSITY * FLOOR_LAYERS; ++i) {
    sandTexture.push(Math.random() * (width - 1));
  }

  const kelp = [];
  const movable = [];
  for (let i = 0; i < FLOOR_LAYERS; ++i) {
    const kelpLayer = [];
    for (let j = 0; j < KELP_DENSITY; ++j) {
      kelpLayer.push(
        new Kelp(
          Math.random() * (width - 1),
          height - 1 - FLOOR_LAYERS + i,
          i,
          Math.random() * (height - 1 - FLOOR_LAYERS + i),
          4,
        ),
      );
    }
    kelp.push(kelpLayer);
    movable.push([]);
  }

  for (let i = 0; i < FISH_COUNT; ++i) {
    spawnFish(movable, width, height);
  }

  const bubbles = [];
  for (let i = 0; i < FLOOR_LAYERS; ++i) {
    const bubbleLayer = [];
    const maxHeight = height - 1 - FLOOR_LAYERS + i;
    for (let j = 0; j < BUBBLE_DENSITY; ++j) {
      bubbleLayer.push(
        new Bubble(
          Math.random() * (width - 1),
          Math.random() * maxHeight,
          i,
          Math.random() * 2,
        ),
      );
    }
    bubbles.push(bubbleLayer);
  }

  return {
    name: 'Aquarium',
    run: (matrix, dt, t) => {
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
          const startEffector = {...k.getEffector()};
          const vec = grid.getVector(
            Math.min(width - 1, Math.max(0, startEffector.x)),
            Math.min(height - 1, Math.max(0, startEffector.y)),
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
            Math.min(height - 1, Math.max(0, b.y)),
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
          if (rect.right < 0 || rect.left > width - 1) {
            movable[layer].splice(i, 1);
            respawn++;
          }
        }
      }
      while (respawn-- > 0) {
        spawnFish(movable, width, height);
      }

      matrix.clear();

      //background
      for (let y = 0; y < height; ++y) {
        const water = {
          r: Math.max(0, WATER.r - y),
          g: Math.max(0, WATER.g - y),
          b: Math.max(0, WATER.b - y * 2),
        };
        if (y > height - FLOOR_LAYERS) {
          const layer = y - (height - FLOOR_LAYERS);
          const light = lerp(water, SAND_BASE, layer / FLOOR_LAYERS);
          const dark = lerp(water, SAND_DARK, layer / FLOOR_LAYERS);
          matrix
            .fgColor(light)
            .drawLine(0, y, width - 1, y)
            .fgColor(dark);
          for (let i = 0; i < SAND_TEXTURE_DENSITY; ++i) {
            matrix.setPixel(sandTexture[layer * SAND_TEXTURE_DENSITY + i], y);
          }
        } else {
          matrix.fgColor(water).drawLine(0, y, width - 1, y);
        }
      }

      for (let layer = 0; layer < FLOOR_LAYERS; ++layer) {
        for (let k of kelp[layer]) {
          k.draw(matrix, WATER_BASE);
        }
        for (let m of movable[layer]) {
          m.draw(matrix);
        }
        for (let b of bubbles[layer]) {
          b.draw(matrix, WATER_BASE);
        }
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
