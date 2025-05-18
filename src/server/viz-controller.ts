import EventEmitter from "events";
import { spawn, ChildProcess } from "child_process";
import * as readline from "readline";
import path from "path";
import { AudioPlayer } from "./audio-player.ts";

interface VizState {
  visualization: number;
  on: boolean;
}

interface VizChangeEvent {
  state: VizState;
  source: string;
}

export class VizController extends EventEmitter {
  childProcess: ChildProcess | null;
  audioPlayer: AudioPlayer;
  state: VizState;
  rl: readline.Interface | null;
  identifying: boolean;

  constructor(initialState: VizState) {
    super();

    this.childProcess = null;
    this.audioPlayer = new AudioPlayer();
    this.state = initialState;
    this.rl = null;
    this.identifying = false;

    this._startChildProcess();
  }

  private _startChildProcess(): void {
    const rendererPath = path.resolve(__dirname, "matrix-renderer.ts");

    this.childProcess = spawn("sudo", [process.execPath, rendererPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (this.childProcess.stdout) {
      this.rl = readline.createInterface({
        input: this.childProcess.stdout,
        terminal: false,
      });

      this.rl.on("line", (line) => {
        try {
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
        } catch (err) {
          console.error("Error parsing message from render process:", err);
        }
      });
    }

    this.childProcess.stderr?.on("data", (data) => {
      console.error(`Render process error: ${data}`);
    });

    this.childProcess.on("close", (code) => {
      console.log(`Render process exited with code ${code}`);
      if (this.rl) {
        this.rl.close();
        this.rl = null;
      }

      this.childProcess = null;

      if (code !== 0) {
        console.log("Restarting render process...");
        setTimeout(() => this._startChildProcess(), 1000);
      }
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

  getState(): VizState {
    return this.state;
  }
}
