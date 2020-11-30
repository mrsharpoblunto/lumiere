/**
 * @format
 */
const VELOCITY = 10 / 1000.0;

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

  setPosition(x, y) {
    this._x = x;
    this._y = y;
  }

  movePosition(x, y) {
    this._x += x * this._xo;
    this._y += y * this._yo;
  }

  getPosition() {
    return {x: this._x, y: this._y};
  }

  getBoundingRect() {
    return {
      top: this._y + this._yOffset,
      left: this._x + this._xOffset,
      bottom: this._y + this._yOffset + this._height,
      right: this._x + this._xOffset + this._width,
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

class Fish extends Drawable {
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
      .fill(this.x(6), this.y(-5), this.x(-7), this.y(5))
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

export default function (width, height) {
  const fish = new Fish();
  fish.setPosition(-8, 9 + Math.round(Math.random() * 14.0));
  fish.setColors(
    {r: 255, g: 255, b: 0},
    {r: 0, g: 0, b: 0},
    {r: 255, g: 0, b: 0},
  );

  return {
    name: 'Aquarium',
    run: (matrix, dt, t) => {
      fish.movePosition(Math.min(VELOCITY * dt, 1), 0);
      const rect = fish.getBoundingRect();
      if (rect.right < 0 || rect.left > width - 1) {
        const orientation = fish.getOrientation();
        fish.setOrientation(orientation.x * -1, orientation.y);
        const position = fish.getPosition();
        fish.setPosition(position.x, 9 + Math.round(Math.random() * 14.0));
        fish.setColors(
          {
            r: Math.round(Math.random() * 255),
            g: Math.round(Math.random() * 255),
            b: Math.round(Math.random() * 255),
          },
          {
            r: Math.round(Math.random() * 64),
            g: Math.round(Math.random() * 64),
            b: Math.round(Math.random() * 64),
          },
          {
            r: Math.round(Math.random() * 255),
            g: Math.round(Math.random() * 255),
            b: Math.round(Math.random() * 255),
          },
        );
      }

      matrix.clear().fgColor({r: 34, g: 34, b: 119}).fill();

      const x = fish.getPosition().x;

      for (let i = 0; i < 16; ++i) {
        const offset =
          Math.sin((i / 16.0 + (x + 17) / 81.0) * 2.0 * (Math.PI * 2)) * 8;
        matrix
          .fgColor(i % 2 == 0 ? {r: 0, g: 102, b: 0} : {r: 68, g: 153, b: 68})
          .drawLine(i * 4, 2 + offset, i * 4, matrix.height() - 1);
      }

      fish.draw(matrix);
    },
  };
}
