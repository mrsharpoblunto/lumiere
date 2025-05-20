export type RGBAColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export interface IOutput {
  width: () => number;
  height: () => number;
  drawBuffer(buffer: Buffer | Uint8Array, w?: number, h?: number): this;
}

export type Asset = {
  width: number;
  height: number;
  data: number[];
};

type BlendFunc = (
  srcBuffer: Uint8Array | number[],
  srcOffset: number,
  destBuffer: Uint8Array | number[],
  destOffset: number,
  blendOp: number
) => void;

export function alphaBlend(
  srcBuffer: Uint8Array | number[],
  srcOffset: number,
  destBuffer: Uint8Array | number[],
  destOffset: number,
  srcOpacity: number
): void {
  const srcR = srcBuffer[srcOffset];
  const srcG = srcBuffer[srcOffset + 1];
  const srcB = srcBuffer[srcOffset + 2];
  const srcA = (srcBuffer[srcOffset + 3] / 255) * srcOpacity;
  const destR = destBuffer[destOffset];
  const destG = destBuffer[destOffset + 1];
  const destB = destBuffer[destOffset + 2];
  if (srcBuffer[srcOffset + 3] > 0) {
    const outR = srcR * srcA + destR * (1 - srcA);
    const outG = srcG * srcA + destG * (1 - srcA);
    const outB = srcB * srcA + destB * (1 - srcA);
    destBuffer[destOffset] = Math.round(outR);
    destBuffer[destOffset + 1] = Math.round(outG);
    destBuffer[destOffset + 2] = Math.round(outB);
  }
}

export function alphaAdditiveBlend(
  srcBuffer: Uint8Array | number[],
  srcOffset: number,
  destBuffer: Uint8Array | number[],
  destOffset: number,
  srcOpacity: number
): void {
  const srcR = srcBuffer[srcOffset];
  const srcG = srcBuffer[srcOffset + 1];
  const srcB = srcBuffer[srcOffset + 2];
  const srcA = (srcBuffer[srcOffset + 3] / 255) * srcOpacity;
  const destR = destBuffer[destOffset];
  const destG = destBuffer[destOffset + 1];
  const destB = destBuffer[destOffset + 2];
  if (srcBuffer[srcOffset + 3] > 0) {
    const outR = Math.min(255, srcR * srcA + destR);
    const outG = Math.min(255, srcG * srcA + destG);
    const outB = Math.min(255, srcB * srcA + destB);
    destBuffer[destOffset] = Math.round(outR);
    destBuffer[destOffset + 1] = Math.round(outG);
    destBuffer[destOffset + 2] = Math.round(outB);
  }
}

export class Backbuffer {
  private _backbuffer: Uint8Array;
  private _tmp: Uint8Array;
  private _width: number;
  private _height: number;

  constructor(width: number, height: number) {
    this._width = width;
    this._height = height;
    this._backbuffer = new Uint8Array(this._width * this._height * 3);
    this._tmp = new Uint8Array(4);

    for (let i = 0; i < this._width * this._height * 3; i += 3) {
      this._backbuffer[i] = 0;
      this._backbuffer[i + 1] = 0;
      this._backbuffer[i + 2] = 0;
    }
  }

  drawAsset(
    x0: number,
    y0: number,
    asset: Asset,
    blendFunc: BlendFunc = alphaBlend,
    blendOp: number = 1.0
  ): this {
    for (let y = 0; y < asset.height; y++) {
      for (let x = 0; x < asset.width; x++) {
        if (
          x + x0 < 0 ||
          x + x0 >= this._width ||
          y + y0 < 0 ||
          y + y0 >= this._height
        ) {
          continue; // Skip pixels outside the backbuffer
        }
        const srcIndex = (y * asset.width + x) * 4;
        const destIndex = this._getIndex(x + x0, y + y0);
        if (blendFunc) {
          blendFunc(asset.data, srcIndex, this._backbuffer, destIndex, blendOp);
        } else {
          this._backbuffer[destIndex] = asset.data[srcIndex];
          this._backbuffer[destIndex + 1] = asset.data[srcIndex + 1];
          this._backbuffer[destIndex + 2] = asset.data[srcIndex + 2];
        }
      }
    }

    return this;
  }

  drawCircle(
    x: number,
    y: number,
    r: number,
    color: RGBAColor,
    blendFunc: BlendFunc = alphaBlend,
    blendOp: number = 1.0
  ): this {
    // Midpoint circle algorithm for pixel-perfect circle
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const ri = Math.floor(r);

    let xPos = 0;
    let yPos = ri;
    let decision = 1 - ri;

    // Draw initial points in all 8 octants
    this.setPixel(xi + xPos, yi + yPos, color, blendFunc, blendOp);
    this.setPixel(xi - xPos, yi + yPos, color, blendFunc, blendOp);
    this.setPixel(xi + xPos, yi - yPos, color, blendFunc, blendOp);
    this.setPixel(xi - xPos, yi - yPos, color, blendFunc, blendOp);
    this.setPixel(xi + yPos, yi + xPos, color, blendFunc, blendOp);
    this.setPixel(xi - yPos, yi + xPos, color, blendFunc, blendOp);
    this.setPixel(xi + yPos, yi - xPos, color, blendFunc, blendOp);
    this.setPixel(xi - yPos, yi - xPos, color, blendFunc, blendOp);

    while (xPos < yPos) {
      xPos++;

      if (decision <= 0) {
        decision += 2 * xPos + 1;
      } else {
        yPos--;
        decision += 2 * (xPos - yPos) + 1;
      }

      if (xPos <= yPos) {
        // Draw points in all 8 octants
        this.setPixel(xi + xPos, yi + yPos, color, blendFunc, blendOp);
        this.setPixel(xi - xPos, yi + yPos, color, blendFunc, blendOp);
        this.setPixel(xi + xPos, yi - yPos, color, blendFunc, blendOp);
        this.setPixel(xi - xPos, yi - yPos, color, blendFunc, blendOp);
        this.setPixel(xi + yPos, yi + xPos, color, blendFunc, blendOp);
        this.setPixel(xi - yPos, yi + xPos, color, blendFunc, blendOp);
        this.setPixel(xi + yPos, yi - xPos, color, blendFunc, blendOp);
        this.setPixel(xi - yPos, yi - xPos, color, blendFunc, blendOp);
      }
    }

    return this;
  }

  drawLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: RGBAColor,
    blendFunc: BlendFunc = alphaBlend,
    blendOp: number = 1.0
  ): this {
    // Bresenham's line algorithm for pixel-perfect line drawing
    let x0i = Math.floor(x0);
    let y0i = Math.floor(y0);
    let x1i = Math.floor(x1);
    let y1i = Math.floor(y1);

    const dx = Math.abs(x1i - x0i);
    const dy = -Math.abs(y1i - y0i);
    const sx = x0i < x1i ? 1 : -1;
    const sy = y0i < y1i ? 1 : -1;
    let err = dx + dy;

    while (true) {
      this.setPixel(x0i, y0i, color, blendFunc, blendOp);

      if (x0i === x1i && y0i === y1i) break;

      const e2 = 2 * err;
      if (e2 >= dy) {
        if (x0i === x1i) break;
        err += dy;
        x0i += sx;
      }
      if (e2 <= dx) {
        if (y0i === y1i) break;
        err += dx;
        y0i += sy;
      }
    }

    return this;
  }

  drawRect(
    x0: number,
    y0: number,
    width: number,
    height: number,
    color: RGBAColor,
    blendFunc: BlendFunc = alphaBlend,
    blendOp: number = 1.0
  ): this {
    // Draw the outline of a rectangle using pixel-perfect lines
    const x0i = Math.floor(x0);
    const y0i = Math.floor(y0);
    const wi = Math.floor(width);
    const hi = Math.floor(height);

    this.drawLine(x0i, y0i, x0i + wi, y0i, color, blendFunc, blendOp);
    this.drawLine(x0i + wi, y0i, x0i + wi, y0i + hi, color, blendFunc, blendOp);
    this.drawLine(x0i, y0i + hi, x0i + wi, y0i + hi, color, blendFunc, blendOp);
    this.drawLine(x0i, y0i, x0i, y0i + hi, color, blendFunc, blendOp);

    return this;
  }

  clear(): this {
    return this.fill(0, 0, this._width - 1, this._height - 1, {
      r: 0,
      g: 0,
      b: 0,
      a: 255,
    });
  }

  fill(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: RGBAColor,
    blendFunc: BlendFunc = alphaBlend,
    blendOp: number = 1.0
  ): this {
    // Ensure x0 <= x1 and y0 <= y1 for proper loop execution
    if (x0 > x1) {
      [x0, x1] = [x1, x0]; // Swap x coordinates
    }
    if (y0 > y1) {
      [y0, y1] = [y1, y0]; // Swap y coordinates
    }

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        this._setPixel(x, y, color, blendFunc, blendOp);
      }
    }
    return this;
  }

  getPixel(x: number, y: number): RGBAColor {
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    const index = this._getIndex(x, y);
    return {
      r: this._backbuffer[index],
      g: this._backbuffer[index + 1],
      b: this._backbuffer[index + 2],
      a: 255,
    };
  }

  setPixel(
    x: number,
    y: number,
    color: RGBAColor,
    blendFunc: BlendFunc = alphaBlend,
    blendOp: number = 1.0
  ): this {
    return this._setPixel(x, y, color, blendFunc, blendOp);
  }

  _setPixel(
    x: number,
    y: number,
    color: RGBAColor,
    blendFunc: BlendFunc = alphaBlend,
    blendOp: number = 1.0
  ): this {
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
      return this;
    }
    const index = this._getIndex(x, y);
    this._tmp[0] = color.r;
    this._tmp[1] = color.g;
    this._tmp[2] = color.b;
    this._tmp[3] = color.a;
    blendFunc(this._tmp, 0, this._backbuffer, index, blendOp);
    return this;
  }

  _getIndex(x: number, y: number): number {
    return (Math.floor(x) + Math.floor(y) * this._width) * 3;
  }

  present(output: IOutput): void {
    output.drawBuffer(this._backbuffer, this._width, this._height);
  }

  height(): number {
    return this._height;
  }

  width(): number {
    return this._width;
  }
}
