import EventEmitter from "events";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { AudioPlayer } from "./audio-player.ts";

interface VizState {
  visualization: number;
  on: boolean;
  volume: number;
}

interface VizChangeEvent {
  state: VizState;
  source: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VizController extends EventEmitter {
  childProcess: ChildProcess | null;
  audioPlayer: AudioPlayer;
  state: VizState;
  identifying: boolean;

  constructor(initialState: VizState) {
    super();

    this.childProcess = null;
    this.audioPlayer = new AudioPlayer(initialState.volume);
    this.state = initialState;
    this.identifying = false;

    this._startChildProcess();
  }

  private _startChildProcess(): void {
    const rendererPath = path.resolve(__dirname, "matrix-renderer.ts");

    this.childProcess = spawn("sudo", ["-E", process.execPath, rendererPath], {
      env: { ...process.env },
    });

    this.childProcess.stdout?.on("data", (data) => {
      try {
        const messages = data.toString().split("\n");
        for (const line of messages) {
          if (!line.length) {
            continue;
          }
          const message = JSON.parse(line);
          switch (message.type) {
            case "audio-volume":
              this.audioPlayer.volume(message.volume);
              break;

            case "audio-play":
              this.audioPlayer.play(message.file);
              break;

            case "audio-queue":
              this.audioPlayer.queue(message.file);
              break;

            case "audio-stop":
              this.audioPlayer.stop();
              break;

            case "identify-complete":
              this.identifying = false;
              break;

            default:
              console.error(`Unknown message type: ${message.type}`);
          }
        }
      } catch (err) {
        console.error("Error parsing message from render process:", err);
      }
    });

    this.childProcess.stderr?.on("data", (data) => {
      console.error(`Render process error: ${data}`);
    });

    this.childProcess.on("close", (code) => {
      console.log(`Render process exited with code ${code}`);
      this.childProcess = null;
      if (code !== 0) {
        console.log("Restarting render process...");
        setTimeout(() => this._startChildProcess(), 1000);
      }
    });

    this._sendToChild({
      type: "set-state",
      state: this.state,
    });
  }

  private _sendToChild(message: any): void {
    this.childProcess?.stdin?.write(JSON.stringify(message) + "\n");
  }

  identify(): void {
    this.identifying = true;
    this._sendToChild({ type: "identify" });
  }

  toggleOn(source: string): VizState {
    if (!this.identifying) {
      this.state.on = !this.state.on;
      this._sendToChild({ type: "set-state", state: this.state });
      this.emit("change", { state: this.state, source } as VizChangeEvent);
    }
    return this.state;
  }

  setOn(on: boolean, source: string): VizState {
    if (!this.identifying && on !== this.state.on) {
      this.state.on = on;
      this._sendToChild({
        type: "set-state",
        state: this.state,
      });
      this.emit("change", { state: this.state, source } as VizChangeEvent);
    }
    return this.state;
  }

  setVisualization(viz: number, source: string): VizState {
    this.state.visualization = viz;
    this._sendToChild({
      type: "set-state",
      state: this.state,
    });
    this.emit("change", { state: this.state, source } as VizChangeEvent);
    return this.state;
  }

  setVolume(volume: number, source: string): VizState {
    this.state.volume = volume;
    this.audioPlayer.masterVolume(volume);
    this.emit("change", { state: this.state, source } as VizChangeEvent);
    return this.state;
  }

  getState(): VizState {
    return this.state;
  }
}
