import type { IOutput } from "../shared/back-buffer.ts";

export class CanvasOutput implements IOutput {
  private _ctx: CanvasRenderingContext2D;
  private _width: number;
  private _height: number;
  private _image: ImageData;
  private _buffer: Uint8ClampedArray;

  constructor(width: number, height: number, canvas: HTMLCanvasElement) {
    this._ctx = canvas.getContext("2d", { alpha: false })!;
    this._width = width;
    this._height = height;
    this._image = this._ctx.createImageData(width, height);
    this._buffer = this._image.data;
  }

  width(): number {
    return this._width;
  }

  height(): number {
    return this._height;
  }

  drawBuffer(buffer: Buffer | Uint8Array, w?: number, h?: number): this {
    if (typeof w === "undefined" || typeof h === "undefined") {
      return this;
    }

    const copyWidth = Math.min(w, this._width);
    const copyHeight = Math.min(h, this._height);
    for (let y = 0; y < copyHeight; y++) {
      for (let x = 0; x < copyWidth; x++) {
        const srcIndex = (y * w + x) * 3;
        const destIndex = (y * w + x) * 4;
        this._buffer[destIndex] = buffer[srcIndex];
        this._buffer[destIndex + 1] = buffer[srcIndex + 1];
        this._buffer[destIndex + 2] = buffer[srcIndex + 2];
        this._buffer[destIndex + 3] = 255;
      }
    }
    this._ctx.putImageData(this._image, 0, 0);

    return this;
  }
}
