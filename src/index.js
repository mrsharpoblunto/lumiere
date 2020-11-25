/**
 * @format
 */
const M = require('rpi-led-matrix');

const matrix = new M.LedMatrix(
{
  ...M.LedMatrix.defaultMatrixOptions(),
  rows: 32,
  cols: 64,
  hardwareMapping: M.GpioMapping.AdafruitHatPwm
},
{
  ...M.LedMatrix.defaultRuntimeOptions(),
  gpioSlowdown: 3
}
);


class Drawable {
  constructor(top, left, bottom, right) {
    this._x = 0;
    this._y = 0;
    this._xo = 1.0;
    this._yo = 1.0;
    this._xOffset = left;
    this._yOffset = top;
    this._width = right - left;
    this._height = bottom - top;
  }

  setPosition(x,y) {
    this._x = x;
    this._y = y;
  }

  movePosition(x,y) {
    this._x += x*this._xo;
    this._y += y*this._yo;
  }

  getPosition() {
    return { x: this._x, y: this._y };
  }

  getBoundingRect() {
    return { 
      top: this._y + this._yOffset, 
      left: this._x + this._xOffset, 
      bottom: this._y + this._yOffset + this._height,
      right: this._x + this._xOffset + this._width
    };
  }

  setOrientation(x,y) {
    this._xo = x;
    this._yo = y;
  }

  getOrientation() {
    return {x: this._xo, y: this._yo };
  }

  x(x) {
    return this._x + x*this._xo;
  }

  y(y) {
    return this._y + y*this._yo;
  }
}

class Fish extends Drawable {
  constructor() {
    super(-7, -9, 7, 8);
  }

  draw(matrix) {
    matrix
      .fgColor(this._main)
      .drawLine(this.x(8),this.y(-1),this.x(8),this.y(1))
      .drawLine(this.x(8),this.y(1),this.x(6),this.y(1))
      .drawLine(this.x(6),this.y(1),this.x(6),this.y(5))
      .drawLine(this.x(6),this.y(5),this.x(-7),this.y(5))
      .drawLine(this.x(-7),this.y(5),this.x(-7),this.y(7))
      .drawLine(this.x(-7),this.y(7),this.x(-9),this.y(7))
      .drawLine(this.x(-9),this.y(7),this.x(-9),this.y(-7))
      .drawLine(this.x(-9),this.y(-7),this.x(-7),this.y(-7))
      .drawLine(this.x(-7),this.y(-7),this.x(-7),this.y(-5))
      .drawLine(this.x(-7),this.y(-5),this.x(6),this.y(-5))
      .drawLine(this.x(6),this.y(-5),this.x(6),this.y(-1))
      .drawLine(this.x(6),this.y(-1),this.x(8),this.y(-1))
      .fill(this.x(6),this.y(-5),this.x(-7),this.y(5))
      //fin 1
      .drawLine(this.x(-2),this.y(5), this.x(-2), this.y(8))
      .drawLine(this.x(-2),this.y(8), this.x(0), this.y(8))
      .drawLine(this.x(0),this.y(8), this.x(0), this.y(5))
      // fin 2
      .drawLine(this.x(-2),this.y(-5), this.x(-2), this.y(-8))
      .drawLine(this.x(-2),this.y(-8), this.x(0), this.y(-8))
      .drawLine(this.x(0),this.y(-8), this.x(0), this.y(-5))
      // eye
      .fgColor(this._fin)
      .setPixel(this.x(4), this.y(-3))
      // fin 2 fill
      .fill(this.x(-1),this.y(6),this.x(-1),this.y(7))
      // fin 2 fill
      .fill(this.x(-1),this.y(-7),this.x(-1),this.y(-6))
      // tail fill
      .fill(this.x(-8),this.y(-6),this.x(-8),this.y(6))
      //nose
      .fgColor(this._nose)
      .setPixel(this.x(7),this.y(0));
  }

  setColors(main, fin, nose) {
    this._main = main;
    this._fin = fin;
    this._nose = nose;
  }
}

const fish = new Fish();
fish.setPosition(
  -8, 
  9 + Math.round(Math.random() * 14.0)
);
fish.setColors(0xFFFF00, 0x0000FF, 0xFF0000);

setInterval(() => {
  fish.movePosition(1,0);
  const rect = fish.getBoundingRect();
  if (rect.right < 0 || rect.left > matrix.width() -1) {
    const orientation = fish.getOrientation();
    fish.setOrientation(orientation.x * -1, orientation.y);
    const position = fish.getPosition();
    fish.setPosition(
      position.x,
      9 + Math.round(Math.random() * 14.0)
    );
    fish.setColors(
      Math.round(Math.random() * 0xFFFFFF), 
      Math.round(Math.random() * 0x888888), 
      Math.round(Math.random() * 0xFFFFFF)
    );
  }
}, 100);



matrix.afterSync((mat, dt, t) => {
  matrix
    .clear()
    .brightness(32)
    .fgColor(0x222277)
    .fill();

  const x = fish.getPosition().x;

  for (let i = 0;i < 16; ++i) {
    const offset = Math.sin(((i/16.0)+((x+17)/81.0))*2.0 * (Math.PI* 2)) * 8;
    matrix
      .fgColor(i % 2 == 0 ? 0x006600 : 0x449944)
      .fill((i*4),2 + offset,(i*4),matrix.height() - 1);
  }

  matrix.brightness(64);
  fish.draw(matrix);

  setTimeout(() => matrix.sync(), 0);
});

// Get it started
matrix.sync();
