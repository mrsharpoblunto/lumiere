import EventEmitter from "events";
import * as M from "rpi-led-matrix";
import * as config from "./config.js";
import visualizations from "../shared/viz/index.js";
import { IVisualization } from "../shared/viz/visualization-type.js";
import { MATRIX_WIDTH, MATRIX_HEIGHT } from "../shared/config.js";
import { AudioPlayer } from "./audio-player.js";

interface VizState {
  visualization: number;
  on: boolean;
}

interface VizChangeEvent {
  state: VizState;
  source: string;
}

export class VizController extends EventEmitter {
  matrix: any;
  audioPlayer: AudioPlayer;
  state: VizState;
  activeTimeout: NodeJS.Timeout | number;
  identifying: boolean;
  visualizations: IVisualization[];

  constructor(state: VizState) {
    super();

    this.matrix =
      new M.LedMatrix(
        {
          ...M.LedMatrix.defaultMatrixOptions(),
          rows: MATRIX_HEIGHT,
          cols: MATRIX_WIDTH,
          hardwareMapping: M.GpioMapping.AdafruitHatPwm,
          disableHardwarePulsing: process.env.NODE_ENV !== "production",
        },
        {
          ...M.LedMatrix.defaultRuntimeOptions(),
          dropPrivileges: 0,
          gpioSlowdown: 3,
        }
      );

    this.audioPlayer = new AudioPlayer();

    this.state = state;
    this.activeTimeout = 0;
    this.identifying = false;
    this.visualizations = visualizations(
      this.matrix.width(),
      this.matrix.height()
    );
    this._updateViz();
  }

  identify(): void {
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
          .fgColor(status ? { r: 0, g: 0, b: 0 } : { r: 0, g: 0, b: 0 })
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

  _afterSync(_matrix: any, dt: number, t: number): void {
    const viz = this.visualizations[this.state.visualization];
    try {
      viz.run(this.matrix, this.audioPlayer, dt, t);
    } catch (ex: any) {
      console.error(ex.stack);
    }
    this.activeTimeout = setTimeout(() => {
      if (this.state.on) {
        try {
          this.matrix.sync();
        } catch (ex: any) {
          console.error(ex.stack);
        }
      }
    }, 16 - dt);
  }

  _updateViz(): void {
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout as NodeJS.Timeout);
      this.activeTimeout = 0;
    }
    if (!this.state.on) {
      this.matrix
        .afterSync(() => {})
        .clear()
        .sync();
      this.audioPlayer.stop();
    } else {
      this.matrix.afterSync(this._afterSync.bind(this));
      const viz = this.visualizations[this.state.visualization];
      viz.run(this.matrix, this.audioPlayer, 0, 0);
      this.audioPlayer.volume(viz.volume);
      if (viz.audio) {
        this.audioPlayer.play(viz.audio);
      }
      this.matrix.sync();
    }
  }

  toggleOn(source: string): VizState {
    if (!this.identifying) {
      this.state.on = !this.state.on;
      this._updateViz();
      this.emit("change", { state: this.state, source } as VizChangeEvent);
    }
    return this.state;
  }

  setOn(on: boolean, source: string): VizState {
    if (!this.identifying && on !== this.state.on) {
      this.state.on = on;
      this._updateViz();
      this.emit("change", { state: this.state, source } as VizChangeEvent);
    }
    return this.state;
  }

  setVisualization(viz: number, source: string): Promise<VizState> {
    return new Promise((resolve) => {
      if (
        viz >= 0 &&
        viz < this.visualizations.length &&
        this.state.visualization !== viz
      ) {
        this.state.visualization = viz;
        this._updateViz();
        this.emit("change", { state: this.state, source } as VizChangeEvent);
      }
      resolve(this.state);
    });
  }

  getState(): VizState {
    return this.state;
  }
}
