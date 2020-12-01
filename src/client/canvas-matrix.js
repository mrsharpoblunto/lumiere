/**
 * @flow
 */

export class CanvasMatrix {
  constructor(width, height, canvas) {
    this._ctx = canvas.getContext('2d');
    this._ctx.lineWidth = 1.0;
    this._ctx.translate(0.5, 0.5);
    this._width = width;
    this._height = height;
    this._bgColor = {r:0,g:0,b:0};
    this.fgColor({r:0,g:0,b:0});
    this._brightness = 255;
    this._afterSync = null;
  }

  bgColor(color) {
    if (color) {
      this._bgColor = color;
      return this;
    } else {
      return this._bgColor;
    }
  }

  brightness(brightness) {
    if (typeof(brightness) === 'undefined') {
      return this.brightness;
    } else {
      this._brightness = brightness;
      return this;
    }
  }

  clear(...args) {
    if (args.length === 0) {
      this._ctx.fillStyle = `rgb(${this._bgColor.r},${this._bgColor.g},${this._bgColor.b})`;
      this._ctx.fillRect(0,0,this._width-1, this._height-1);
      this._ctx.fillStyle = `rgb(${this._fgColor.r},${this._fgColor.g},${this._fgColor.b})`;
    } else {
      this._ctx.fillStyle = `rgb(${this._bgColor.r},${this._bgColor.g},${this._bgColor.b})`;
      this._ctx.fillRect(Math.floor(args[0]),Math.floor(args[1]),Math.floor(args[2]), Math.floor(args[3]));
      this._ctx.fillStyle = `rgb(${this._fgColor.r},${this._fgColor.g},${this._fgColor.b})`;
    }
    return this;
  }

  drawBuffer(buffer, w, h) {
    throw new Exception('Not implemented');
  }

  drawCircle(x, y, r) {
    this._ctx.beginPath();
    this._ctx.arc(x,y,r, 0, Math.PI * 2, true);
    this._ctx.stroke();
    return this;
  }

  drawLine(x0, y0, x1, y1) {
    this._ctx.beginPath();
    this._ctx.moveTo(Math.floor(x0),Math.floor(y0));
    this._ctx.lineTo(Math.floor(x1), Math.floor(y1));
    this._ctx.stroke();
    return this;
  }

  drawRect(x0, y0, width, height) {
    this._ctx.strokeRect(Math.floor(x0),Math.floor(y0),Math.floor(width), Math.floor(height));
    return this;
  }

  drawText(text, x, y, kerning) {
    throw new Exception('Not implemented');
  }

  fgColor(color) {
    if (color) {
      this._fgColor = color;
      this._ctx.fillStyle = `rgb(${this._fgColor.r},${this._fgColor.g},${this._fgColor.b})`;
      this._ctx.strokeStyle = `rgb(${this._fgColor.r},${this._fgColor.g},${this._fgColor.b})`;
      return this;
    } else {
      return this._fgColor;
    }
  }

  fill(...args) {
    if (args.length === 0) {
      this._ctx.fillRect(0,0,this._width-1, this._height-1);
    } else {
      const width = Math.floor(args[2] - args[0]);
      const height = Math.floor(args[3] - args[1]);
      if (width === 0 || height === 0) {
      this._ctx.strokeRect(Math.floor(args[0]),Math.floor(args[1]), width, height);
      } else {
      this._ctx.fillRect(Math.floor(args[0]),Math.floor(args[1]),width, height);
      }
    }
    return this;
  }

  font(font) {
    throw new Exception('Not implemented');
  }

  font() {
    throw new Exception('Not implemented');
  }

  height() {
    return this._height;
  }

  luminanceCorrect(correct) {
    throw new Exception('Not implemented');
  }

  pwmBits(pwmBits) {
    throw new Exception('Not implemented');
  }

  setPixel(x, y) {
    this._ctx.strokeRect(Math.floor(x),Math.floor(y),0.5,0.5);
    return this;
  }

  afterSync(cb) {
    this._afterSync = cb;
    return this;
  }

  sync() {
    if (this._afterSync) {
      this._afterSync(this,16, Date.now()); 
    }
  }

  width() {
    return this._width;
  }
}
