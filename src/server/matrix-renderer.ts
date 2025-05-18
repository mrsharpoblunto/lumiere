import * as M from "rpi-led-matrix";
import * as readline from "readline";
import visualizations from "../shared/viz/index.ts";
import { type IVisualization } from "../shared/viz/visualization-type.ts";
import { MATRIX_WIDTH, MATRIX_HEIGHT } from "../shared/config.ts";
import { type IAudioPlayer } from "../shared/audio-player-type.ts";

interface MatrixState {
  visualization: number;
  on: boolean;
}

class AudioPlayerProxy implements IAudioPlayer {
  volume(volume: number) {
    console.log(JSON.stringify({ type: "audio-volume", volume }));
  }

  play(file: string) {
    console.log(JSON.stringify({ type: "audio-play", file }));
  }

  queue(file: string) {
    console.log(JSON.stringify({ type: "audio-queue", file }));
  }

  stop() {
    console.log(JSON.stringify({ type: "audio-stop" }));
  }
}

class MatrixRenderer {
  matrix: any;
  state: MatrixState;
  activeTimeout: NodeJS.Timeout | number;
  identifying: boolean;
  visualizations: IVisualization[];
  rl: readline.Interface;
  audioPlayer: IAudioPlayer;

  constructor(initialState: MatrixState) {
    this.matrix = new M.LedMatrix(
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

    this.state = initialState;
    this.activeTimeout = 0;
    this.identifying = false;
    this.visualizations = visualizations(
      this.matrix.width(),
      this.matrix.height()
    );
    this.audioPlayer = new AudioPlayerProxy();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    this.rl.on('line', (line) => {
      try {
        const message = JSON.parse(line);

        switch (message.type) {
          case 'set-state':
            if (
              message.index >= 0 &&
              message.index < this.visualizations.length &&
              this.state.visualization !== message.index
            ) {
              this.state.visualization = message.index;
              this._updateViz();
            }
            break;

          case 'identify':
            this.identify();
            break;

          default:
            console.error(`Unknown message type: ${message.type}`);
        }
      } catch (err) {
        console.error('Error processing message:', err);
      }
    });

    this._updateViz();
  }

  sendToParent(message: any): void {
    console.log(JSON.stringify(message));
  }

  identify(): void {
    const wasOn = this.state.on;
    if (wasOn) {
      this.state.on = false;
      this._updateViz();
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
          this.state.on = true;
          this._updateViz();
          console.log(JSON.stringify({ type: "identify-complete" }));
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
    }, Math.max(16 - dt, 0));
  }

  _updateViz(): void {
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout as NodeJS.Timeout);
      this.activeTimeout = 0;
    }
    if (!this.state.on) {
      this.matrix
        .afterSync(() => { })
        .clear()
        .sync();
      this.audioPlayer.stop();
    } else {
      this.matrix.afterSync(this._afterSync.bind(this));
      const viz = this.visualizations[this.state.visualization];
      this.audioPlayer.volume(viz.volume);
      if (viz.audio) {
        this.audioPlayer.play(viz.audio);
      } else {
        this.audioPlayer.stop();
      }
      viz.run(this.matrix, this.audioPlayer, 0, 0);
      this.matrix.sync();
    }
  }
}

const renderer = new MatrixRenderer({
  visualization: 0,
  on: false
});

process.on('SIGINT', () => {
  if (renderer.activeTimeout) {
    clearTimeout(renderer.activeTimeout as NodeJS.Timeout);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (renderer.activeTimeout) {
    clearTimeout(renderer.activeTimeout as NodeJS.Timeout);
  }
  process.exit(0);
});
