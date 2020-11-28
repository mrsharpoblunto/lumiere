import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as M from 'rpi-led-matrix';
import * as config from './config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VizController extends EventEmitter {
  constructor(selectedVisualization) {
    super();

    this.matrix = new M.LedMatrix(
      {
        ...M.LedMatrix.defaultMatrixOptions(),
        rows: 32,
        cols: 64,
        hardwareMapping: M.GpioMapping.AdafruitHatPwm,
      },
      {
        ...M.LedMatrix.defaultRuntimeOptions(),
        gpioSlowdown: 3,
      },
    );

    this.state = {
      visualization: selectedVisualization,
      on: false,
    };
    this.activeTimeout = 0;
    this.identifying = false;
  }

  async loadVisualizations() {
    this.visualizations = await Promise.all(fs.readdirSync(path.join(__dirname, "viz"))
      .map(async file => {
        const i = await import("./viz/" + file)
        return i.default(this.matrix.width(), this.matrix.height());
      }));
  }

  identify() {
    const wasOn = this.state.on;
    if (wasOn) {
      this.setOn(false, config.WEB_USER);
    }
    this.identifying = true;

    let count = 10;
    let status = 1;
    const flash = () => {
      if (count >= 0) {
        this.matrix
          .clear()
          .fgColor(status ? 0x000000 : 0xffffff)
          .fill(0, 0, this.matrix.width() - 1, this.matrix.height() - 1);
        --count;
        status = status ? 0 : 1;
        setTimeout(() => this.matrix.sync(), 100);
      } else {
        this.identifying = false;
        if (wasOn) {
        this.setOn(true, config.WEB_USER);
      }
      }
    };
    this.matrix.afterSync(flash);
    flash();
  }

  _afterSync(matrix, dt, t) {
    const viz = this.visualizations[this.state.visualization];
    viz.run(this.matrix, dt, t);
    this.activeTimeout = setTimeout(() => {
      if (this.state.on) { 
        this.matrix.sync(); 
      }
    }, 16 - dt);
  }

  _updateViz() {
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = 0;
    }
    if (!this.state.on) {
      this.matrix
        .afterSync(() =>{})
        .clear()
        .sync();
    } else {
      this.matrix.afterSync(this._afterSync.bind(this));
      const viz = this.visualizations[this.state.visualization];
      viz.run(this.matrix, 0, 0);
      this.matrix.sync();
    }
  }

  toggleOn(source) {
    if (!this.identifying) {
      this.state.on = !this.state.on;
      this._updateViz();
      this.emit('change', {state: this.state, source});
    }
    return this.state;
  }

  setOn(on, source) {
    if (!this.identifying && on !== this.state.on) {
      this.state.on = on;
      this._updateViz();
      this.emit('change', {state: this.state, source});
    }
    return this.state;
  }

  setVisualization(viz, source) {
    if (viz >= 0 && viz < this.visualizations.length && this.state.visualization !== viz) {
      this.state.visualization = viz;
      this._updateViz();
      this.emit('change', {state: this.state, source});
    }
    return this.state;
  }

  getState() {
    return this.state;
  }
}
