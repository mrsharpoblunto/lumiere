export type RGBAColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export interface IOutput {
  width: () => number;
  height: () => number;
  drawBuffer(buffer: Uint8Array, w?: number, h?: number): this;
}

export type Asset = {
  width: number;
  height: number;
  data: Uint8Array;
};

type BlendFunc = (
  srcBuffer: Uint8Array,
  srcOffset: number,
  destBuffer: Uint8Array,
  destOffset: number,
  blendOp: number
) => void;

export function alphaBlend(
  srcBuffer: Uint8Array,
  srcOffset: number,
  destBuffer: Uint8Array,
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
  srcBuffer: Uint8Array,
  srcOffset: number,
  destBuffer: Uint8Array,
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
  private _color: Uint8Array;
  private _width: number;
  private _height: number;
  private _blendFunc: BlendFunc | null = null;
  private _blendOp: number = 1.0;

  constructor(width: number, height: number) {
    this._width = width;
    this._height = height;
    this._backbuffer = new Uint8Array(this._width * this._height * 3);
    this._color = new Uint8Array(4);
  }

  fgColor(color: RGBAColor | [number, number, number, number]): this {
    if (Array.isArray(color)) {
      this._color.set(color);
    } else {
      this._color[0] = color.r;
      this._color[1] = color.g;
      this._color[2] = color.b;
      this._color[3] = color.a;
    }
    return this;
  }

  blendMode(blendFunc: BlendFunc | null, blendOp: number = 1.0): this {
    this._blendFunc = blendFunc;
    this._blendOp = blendOp;
    return this;
  }

  drawAsset(x0: number, y0: number, asset: Asset): this {
    const x0i = Math.floor(x0);
    const y0i = Math.floor(y0);
    const minX = Math.max(0, -x0i);
    const minY = Math.max(0, -y0i);
    const maxX = Math.min(asset.width + x0i, this._width) - x0i;
    const maxY = Math.min(asset.height + y0i, this._height) - y0i;

    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const srcIndex = (y * asset.width + x) * 4;
        const destIndex = ((y + y0i) * this._width + x + x0i) * 3;
        if (this._blendFunc) {
          this._blendFunc(
            asset.data,
            srcIndex,
            this._backbuffer,
            destIndex,
            this._blendOp
          );
        } else {
          this._backbuffer[destIndex] = asset.data[srcIndex];
          this._backbuffer[destIndex + 1] = asset.data[srcIndex + 1];
          this._backbuffer[destIndex + 2] = asset.data[srcIndex + 2];
        }
      }
    }

    return this;
  }

  drawCircle(x: number, y: number, r: number): this {
    // Midpoint circle algorithm for pixel-perfect circle
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const ri = Math.floor(r);

    let xPos = 0;
    let yPos = ri;
    let decision = 1 - ri;

    // Draw initial points in all 8 octants
    this.setPixel(xi + xPos, yi + yPos);
    this.setPixel(xi - xPos, yi + yPos);
    this.setPixel(xi + xPos, yi - yPos);
    this.setPixel(xi - xPos, yi - yPos);
    this.setPixel(xi + yPos, yi + xPos);
    this.setPixel(xi - yPos, yi + xPos);
    this.setPixel(xi + yPos, yi - xPos);
    this.setPixel(xi - yPos, yi - xPos);

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
        this.setPixel(xi + xPos, yi + yPos);
        this.setPixel(xi - xPos, yi + yPos);
        this.setPixel(xi + xPos, yi - yPos);
        this.setPixel(xi - xPos, yi - yPos);
        this.setPixel(xi + yPos, yi + xPos);
        this.setPixel(xi - yPos, yi + xPos);
        this.setPixel(xi + yPos, yi - xPos);
        this.setPixel(xi - yPos, yi - xPos);
      }
    }

    return this;
  }

  drawLine(x0: number, y0: number, x1: number, y1: number): this {
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
      this.setPixel(x0i, y0i);

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

  drawRect(x0: number, y0: number, width: number, height: number): this {
    const x0i = Math.floor(x0);
    const y0i = Math.floor(y0);
    const wi = Math.floor(width);
    const hi = Math.floor(height);

    this.drawLine(x0i, y0i, x0i + wi, y0i);
    this.drawLine(x0i + wi, y0i, x0i + wi, y0i + hi);
    this.drawLine(x0i, y0i + hi, x0i + wi, y0i + hi);
    this.drawLine(x0i, y0i, x0i, y0i + hi);

    return this;
  }

  clear(): this {
    this._backbuffer.fill(0);
    this._color.fill(0);
    this._blendFunc = null;
    this._blendOp = 1.0;
    return this;
  }

  fill(x0: number, y0: number, x1: number, y1: number): this {
    // Ensure x0 <= x1 and y0 <= y1 for proper loop execution
    if (x0 > x1) {
      [x0, x1] = [x1, x0]; // Swap x coordinates
    }
    if (y0 > y1) {
      [y0, y1] = [y1, y0]; // Swap y coordinates
    }

    const x0i = Math.max(0, Math.floor(x0));
    const x1i = Math.min(this._width - 1, Math.floor(x1));
    const y0i = Math.max(0, Math.floor(y0));
    const y1i = Math.min(this._height - 1, Math.floor(y1));

    if (x0i > x1i || y0i > y1i) {
      return this;
    }

    for (let y = y0i; y <= y1i; y++) {
      for (let x = x0i; x <= x1i; x++) {
        this.setPixel(x, y);
      }
    }
    return this;
  }

  getPixel(x: number, y: number): RGBAColor {
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const index = (yi * this._width + xi) * 3;
    return {
      r: this._backbuffer[index],
      g: this._backbuffer[index + 1],
      b: this._backbuffer[index + 2],
      a: 255,
    };
  }

  setPixel(x: number, y: number): this {
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
      return this;
    }
    return this._setPixel(Math.floor(x), Math.floor(y));
  }

  _setPixel(x: number, y: number): this {
    const index = (y * this._width + x) * 3;
    if (this._blendFunc) {
      this._blendFunc(this._color, 0, this._backbuffer, index, this._blendOp);
    } else {
      this._backbuffer.set(this._color.subarray(0, 3), index);
    }
    return this;
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
