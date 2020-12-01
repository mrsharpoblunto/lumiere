/**
 * @format
 */
import {lerp} from './helpers.mjs';
const FLOOR_LAYERS = 8;
const SAND_BASE = {r: 255, g: 255, b: 128};
const SAND_DARK = {r: 200, g: 200, b: 32};
const SAND_TEXTURE_DENSITY = 5;
const KELP = {r: 0, g: 102, b: 0};
const KELP_DENSITY = 4;
const WATER = {r: 32, g: 96, b: 255};
const WATER_BASE = {r: 0, g: 64, b: 128};
const FISH_COUNT = 2;
const FISH_VELOCITY = 10;

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

class Fish extends Movable {
  constructor() {
    super(-7, -9, 7, 8);
  }

  draw(matrix) {
    matrix
      .fgColor(this._main)
      .drawLine(this.x(8), this.y(-1), this.x(8), this.y(1))
      .drawLine(this.x(8), this.y(1), this.x(6), this.y(1))
      .drawLine(this.x(6), this.y(1), this.x(6), this.y(5))
      .drawLine(this.x(6), this.y(5), this.x(-7), this.y(5))
      .drawLine(this.x(-7), this.y(5), this.x(-7), this.y(7))
      .drawLine(this.x(-7), this.y(7), this.x(-9), this.y(7))
      .drawLine(this.x(-9), this.y(7), this.x(-9), this.y(-7))
      .drawLine(this.x(-9), this.y(-7), this.x(-7), this.y(-7))
      .drawLine(this.x(-7), this.y(-7), this.x(-7), this.y(-5))
      .drawLine(this.x(-7), this.y(-5), this.x(6), this.y(-5))
      .drawLine(this.x(6), this.y(-5), this.x(6), this.y(-1))
      .drawLine(this.x(6), this.y(-1), this.x(8), this.y(-1))
      .fill(this.x(-7), this.y(-5), this.x(6), this.y(5))
      //fin 1
      .drawLine(this.x(-2), this.y(5), this.x(-2), this.y(8))
      .drawLine(this.x(-2), this.y(8), this.x(0), this.y(8))
      .drawLine(this.x(0), this.y(8), this.x(0), this.y(5))
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
    this._fin = fin;
    this._nose = nose;
  }
}

class Kelp {
  constructor(anchorX, anchorY, layer, length) {
    this._anchorX = anchorX;
    this._anchorY = anchorY;
    this._length = length;
    this._color = {...KELP};
    this._color.g += (Math.random() - 0.5) * KELP.g * 0.1;
    this._lerpFactor = 1.0 - layer / FLOOR_LAYERS;
  }

  draw(matrix, water) {
    const color = lerp(this._color, water, this._lerpFactor);

    matrix
      .fgColor(color)
      .drawLine(
        this._anchorX,
        this._anchorY - this._length,
        this._anchorX,
        this._anchorY,
      );
  }
}

function spawnFish(movable, width, height) {
  const m = new Fish();

  const layer = Math.round(Math.random() * (FLOOR_LAYERS - 1));
  const orientation = Math.sign(Math.random() - 0.5);
  const y =
    Math.random() * (height - m.height - FLOOR_LAYERS + layer) - m.yOffset;
  const xOffset = (Math.random() + 0.5) * Math.abs(m.xOffset);

  m.setVelocity(FISH_VELOCITY * (Math.random() + 0.5), 0.0);
  m.setOrientation(orientation, 1);

  m.setPosition(orientation > 0 ? -xOffset : width + xOffset, y);
  m.setColors(
    lerp(
      WATER_BASE,
      {
        r: Math.round(Math.random() * 255),
        g: Math.round(Math.random() * 255),
        b: Math.round(Math.random() * 255),
      },
      layer / FLOOR_LAYERS,
    ),
    lerp(
      WATER_BASE,
      {
        r: Math.round(Math.random() * 64),
        g: Math.round(Math.random() * 64),
        b: Math.round(Math.random() * 64),
      },
      layer / FLOOR_LAYERS,
    ),
    lerp(
      WATER_BASE,
      {
        r: Math.round(Math.random() * 255),
        g: Math.round(Math.random() * 255),
        b: Math.round(Math.random() * 255),
      },
      layer / FLOOR_LAYERS,
    ),
  );
  movable[layer].push(m);
}

export default function (width, height) {
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
          height - FLOOR_LAYERS + i,
          i,
          Math.random() * height - i,
        ),
      );
    }
    kelp.push(kelpLayer);
    movable.push([]);
  }

  for (let i = 0; i < FISH_COUNT; ++i) {
    spawnFish(movable, width, height);
  }

  return {
    name: 'Aquarium',
    run: (matrix, dt, t) => {
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
        const water = {r: WATER.r - y, g: WATER.g - y, b: WATER.b - y * 4};
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
      }
    },
  };
}
