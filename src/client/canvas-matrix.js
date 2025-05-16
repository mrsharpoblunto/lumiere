/**
 * @flow
 */

export class CanvasMatrix {
  constructor(width, height, canvas) {
    this._ctx = canvas.getContext("2d", { alpha: false });
    this._width = width;
    this._height = height;
    this._bgColor = { r: 0, g: 0, b: 0 };
    this.fgColor({ r: 0, g: 0, b: 0 });
    this._brightness = 255;
    this._afterSync = null;
    this._image = this._ctx.createImageData(width, height);
    this._buffer = this._image.data;
  }

  bgColor(color) {
    if (color) {
      this._bgColor = color;
      return this;
    } else {
      return this._bgColor;
    }
  }

  fgColor(color) {
    if (color) {
      this._fgColor = color;
      return this;
    } else {
      return this._fgColor;
    }
  }

  brightness(brightness) {
    if (typeof brightness === "undefined") {
      return this.brightness;
    } else {
      this._brightness = brightness;
      return this;
    }
  }

  drawBuffer(buffer, w, h) {
    // Calculate dimensions to copy (the smaller of source and destination)
    const copyWidth = Math.min(w, this._width);
    const copyHeight = Math.min(h, this._height);
    for (let y = 0; y < copyHeight; y++) {
      for (let x = 0; x < copyWidth; x++) {
        const srcIndex = (y * w + x) * 3;
        const destIndex = this._getIndex(x, y);
        this._buffer[destIndex] = buffer[srcIndex];
        this._buffer[destIndex + 1] = buffer[srcIndex + 1];
        this._buffer[destIndex + 2] = buffer[srcIndex + 2];
        this._buffer[destIndex + 3] = 255;
      }
    }

    return this;
  }

  drawCircle(x, y, r) {
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

  drawLine(x0, y0, x1, y1) {
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

  drawRect(x0, y0, width, height) {
    // Draw the outline of a rectangle using pixel-perfect lines
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

  clear(...args) {
    return this._fillWithColor(this._bgColor, ...args);
  }

  fill(...args) {
    return this._fillWithColor(this._fgColor, ...args);
  }

  _fillWithColor(color, ...args) {
    if (args.length === 0) {
      // Fill entire canvas
      for (let y = 0; y < this._height; y++) {
        for (let x = 0; x < this._width; x++) {
          this._setPixel(x, y, color);
        }
      }
    } else if (args.length === 4) {
      // Fill specified region
      let x0 = Math.floor(args[0]);
      let y0 = Math.floor(args[1]);
      let x1 = Math.floor(args[2]);
      let y1 = Math.floor(args[3]);

      // Ensure x0 <= x1 and y0 <= y1 for proper loop execution
      if (x0 > x1) {
        [x0, x1] = [x1, x0]; // Swap x coordinates
      }

      if (y0 > y1) {
        [y0, y1] = [y1, y0]; // Swap y coordinates
      }

      // Now fill the rectangle with the proper bounds
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          this._setPixel(x, y, color);
        }
      }
    } else if (args.length === 2) {
      // Set a single pixel
      const x = Math.floor(args[0]);
      const y = Math.floor(args[1]);
      this._setPixel(x, y, color);
    }
    return this;
  }

  setPixel(x, y) {
    return this._setPixel(x, y, this._fgColor);
  }

  _setPixel(x, y, color) {
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
      return this;
    }
    const index = this._getIndex(x, y);
    this._buffer[index] = color.r;
    this._buffer[index + 1] = color.g;
    this._buffer[index + 2] = color.b;
    this._buffer[index + 3] = 255;
    return this;
  }

  _getIndex(x, y) {
    return (Math.floor(x) + Math.floor(y) * this._width) * 4;
  }

  afterSync(cb) {
    this._afterSync = cb;
    return this;
  }

  sync() {
    this._ctx.putImageData(this._image, 0, 0);
    if (this._afterSync) {
      this._afterSync(this, 16, Date.now());
    }
  }

  height() {
    return this._height;
  }

  width() {
    return this._width;
  }

  drawText(text, x, y, kerning) {
    throw new Exception("Not implemented");
  }

  font(font) {
    throw new Exception("Not implemented");
  }

  font() {
    throw new Exception("Not implemented");
  }

  luminanceCorrect(correct) {
    throw new Exception("Not implemented");
  }

  pwmBits(pwmBits) {
    throw new Exception("Not implemented");
  }
}
