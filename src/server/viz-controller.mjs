import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as M from 'rpi-led-matrix';
import * as config from './config.mjs';
import visualizations from '../shared/viz/index.mjs';
import {MATRIX_WIDTH, MATRIX_HEIGHT} from '../shared/config.mjs';
import {AudioPlayer} from './audio-player.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VizController extends EventEmitter {
  constructor(state) {
    super();

    this.matrix = new M.LedMatrix(
      {
        ...M.LedMatrix.defaultMatrixOptions(),
        rows: MATRIX_HEIGHT,
        cols: MATRIX_WIDTH,
        hardwareMapping: M.GpioMapping.AdafruitHatPwm,
        disableHardwarePulsing: process.env.NODE_ENV !== 'production',
      },
      {
        ...M.LedMatrix.defaultRuntimeOptions(),
        dropPrivileges: 0,
        gpioSlowdown: 3,
      },
    );

    // Hack: monkeypatch a safe fill function to prevent buffer underflow/overflow
    // when drawing negative y values
    this.matrix.fillSafe = function (x0, y0, x1, y1) {
      if (y1 >= 0) {
        this.fill(x0, Math.max(0,y0), x1, y1);
      }
      return this;
    };

    this.audioPlayer = new AudioPlayer();

    this.state = state;
    this.activeTimeout = 0;
    this.identifying = false;
    this.visualizations = visualizations(this.matrix.width(), this.matrix.height());
    this._updateViz();
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
          .fgColor(status ? {r:0,g:0,b:0} : {r:0, g: 0,b: 0})
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
    try {
      viz.run(this.matrix, dt, t);
    } catch (ex) {
      console.error(ex.stack);
    }
    this.activeTimeout = setTimeout(() => {
      if (this.state.on) { 
        try {
          this.matrix.sync(); 
        } catch (ex) {
          console.error(ex.stack);
        }
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
      this.audioPlayer.stop();
    } else {
      this.matrix.afterSync(this._afterSync.bind(this));
      const viz = this.visualizations[this.state.visualization];
      viz.run(this.matrix, 0, 0);
      this.audioPlayer.play(viz.audio);
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
