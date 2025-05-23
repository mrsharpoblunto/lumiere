import { AUDIO_COMMAND, VOLUME_COMMAND, AUDIO_ARGS } from "./config.ts";
import { spawn, exec, ChildProcess } from "child_process";
import type { IAudioPlayer } from "../shared/audio-player-type.ts";

export class AudioPlayer implements IAudioPlayer {
  private _current: ChildProcess | null;
  private _currentFile: string | null;
  private _queuedFile: string | null;

  constructor() {
    this._current = null;
    this._currentFile = null;
    this._queuedFile = null;
  }

  volume(volume: number): void {
    exec(`${VOLUME_COMMAND} ${volume}%`, (error) => {
      if (error) {
        console.error(`exec error setting volume: ${error}`);
        return;
      }
    });
  }

  play(file: string): void {
    this._queuedFile = file;
    if (this._current) {
      this._current.kill();
    } else {
      this._playFile();
    }
  }

  queue(file: string): void {
    this._queuedFile = file;
    if (!this._current) {
      this._playFile();
    }
  }

  stop(): void {
    this._queuedFile = null;
    this._currentFile = null;
    if (this._current) {
      this._current.kill();
    }
  }

  private _playFile(): void {
    if (this._queuedFile) {
      this._currentFile = this._queuedFile;
      this._queuedFile = null;
    }

    if (!this._currentFile) {
      this._current = null;
      return;
    }

    this._current = spawn(AUDIO_COMMAND, [
      ...AUDIO_ARGS,
      `audio/${this._currentFile}`,
    ]);
    this._current.stdout?.on("data", (data) => {
      console.log(`audio stdout:\n${data}`);
    });
    this._current.stderr?.on("data", (data) => {
      console.error(`audio stderr: ${data}`);
    });
    this._current.on("error", (err) => {
      console.log(`audio error: ${err.message}`);
    });
    this._current.on("close", (code) => {
      if (code !== 0) {
        console.log(`audio player exited with code ${code}`);
      }
      this._playFile();
    });
  }
}
