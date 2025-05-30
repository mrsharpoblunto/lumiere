import * as M from "rpi-led-matrix";
import type { LedMatrixInstance } from "rpi-led-matrix";
import * as readline from "readline";
import visualizations from "../shared/viz/index.ts";
import type { IVisualization } from "../shared/viz/visualization-type.ts";
import { MATRIX_WIDTH, MATRIX_HEIGHT } from "../shared/config.ts";
import type { IAudioPlayer } from "../shared/audio-player-type.ts";
import { Backbuffer } from "../shared/viz/back-buffer.ts";
import { ServerLocationService } from "./location-service.ts";

interface MatrixState {
  visualization: number;
  on: boolean;
}

class AudioPlayerProxy implements IAudioPlayer {
  volume(volume: number) {
    console.log(JSON.stringify({ type: "audio-volume", volume }));
  }

  masterVolume(_: number) {
    // visualizations can't set the master volume
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
  matrix: LedMatrixInstance;
  state: MatrixState;
  activeTimeout: NodeJS.Timeout | number;
  identifying: boolean;
  visualizations: IVisualization[];
  rl: readline.Interface;
  audioPlayer: IAudioPlayer;
  backbuffer: Backbuffer;
  locationService: ServerLocationService;

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
    this.backbuffer = new Backbuffer(this.matrix.width(), this.matrix.height());

    this.state = initialState;
    this.activeTimeout = 0;
    this.identifying = false;
    this.visualizations = visualizations(
      this.matrix.width(),
      this.matrix.height()
    );
    this.audioPlayer = new AudioPlayerProxy();
    this.locationService = new ServerLocationService();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });
    this.rl.on("line", (line) => {
      try {
        const message = JSON.parse(line);

        switch (message.type) {
          case "set-state":
            const prevState = this.state;
            this.state = message.state;
            this._updateViz(prevState);
            break;

          case "identify":
            this.identify();
            break;

          default:
            console.error(`Unknown message type: ${message.type}`);
        }
      } catch (err) {
        console.error("Error processing message:", err);
      }
    });

    this._updateViz(null);
  }

  sendToParent(message: any): void {
    console.log(JSON.stringify(message));
  }

  identify(): void {
    const wasOn = this.state.on;
    if (wasOn) {
      const prev = { ...this.state };
      this.state.on = false;
      this._updateViz(prev);
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
          const prev = { ...this.state };
          this.state.on = true;
          this._updateViz(prev);
          console.log(JSON.stringify({ type: "identify-complete" }));
        }
      }
    };
    this.matrix.afterSync(flash);
    flash();
  }

  _afterSync(_matrix: LedMatrixInstance, dt: number, _t: number): void {
    const viz = this.visualizations[this.state.visualization];
    viz.run(
      this.backbuffer,
      this.audioPlayer,
      this.locationService,
      dt,
      new Date().getTime()
    );
    this.backbuffer.present(this.matrix);
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

  _updateViz(prevState: MatrixState | null): void {
    if (!this.state.on) {
      if (this.activeTimeout) {
        clearTimeout(this.activeTimeout as NodeJS.Timeout);
        this.activeTimeout = 0;
      }
      this.audioPlayer.stop();
      this.matrix
        .afterSync(() => {})
        .clear()
        .sync();
    } else if (this.state.on) {
      if (!prevState || prevState?.visualization !== this.state.visualization) {
        const viz = this.visualizations[this.state.visualization];
        this.audioPlayer.volume(viz.volume);
        if (viz.audio) {
          this.audioPlayer.play(viz.audio);
        } else {
          this.audioPlayer.stop();
        }
      }

      if (!prevState?.on) {
        this.matrix.afterSync(this._afterSync.bind(this)).clear().sync();
      }
    }
  }
}

const renderer = new MatrixRenderer({
  visualization: 0,
  on: false,
});

process.on("SIGINT", () => {
  if (renderer.activeTimeout) {
    clearTimeout(renderer.activeTimeout as NodeJS.Timeout);
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (renderer.activeTimeout) {
    clearTimeout(renderer.activeTimeout as NodeJS.Timeout);
  }
  process.exit(0);
});
