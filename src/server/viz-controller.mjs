import EventEmitter from 'events';
import * as M from 'rpi-led-matrix';
import * as config from './config.mjs';
import visualizations from '../shared/viz/index.mjs';
import {MATRIX_WIDTH, MATRIX_HEIGHT} from '../shared/config.mjs';
import {AudioPlayer} from './audio-player.mjs';
import {patchMatrix} from '../shared/viz/helpers.mjs';

export class VizController extends EventEmitter {
  constructor(state) {
    super();

    this.matrix = patchMatrix(new M.LedMatrix(
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
    ));

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

  _afterSync(_matrix, dt, t) {
    const viz = this.visualizations[this.state.visualization];
    try {
      viz.run(this.matrix, this.audioPlayer, dt, t);
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
      viz.run(this.matrix, this.audioPlayer, 0, 0);
      this.audioPlayer.volume(viz.volume);
      if (this.viz.audio) {
        this.audioPlayer.play(viz.audio, viz.volume);
      }
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
