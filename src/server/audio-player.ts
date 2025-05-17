/**
 * @format
 */
import { AUDIO_COMMAND, VOLUME_COMMAND, AUDIO_ARGS } from "./config.ts";
import { spawn, exec, ChildProcess } from "child_process";
import kill from "tree-kill";
import { IAudioPlayer } from "../shared/audio-player-type.ts";

export class AudioPlayer implements IAudioPlayer {
  private _current: ChildProcess | null;
  private _currentFile: string | null;
  private _queuedFile: string | null;
  private _shouldRequeue: boolean;

  constructor() {
    this._current = null;
    this._currentFile = null;
    this._queuedFile = null;
    this._shouldRequeue = true;
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
    this.stop();
    this._currentFile = file;
    this._playFile(file);
  }

  queue(file: string): void {
    this._queuedFile = file;
    if (!this._current) {
      this._playQueuedFile();
    }
  }

  private _playQueuedFile(): void {
    if (this._queuedFile) {
      this._currentFile = this._queuedFile;
      this._queuedFile = null;
    }
    if (this._currentFile) {
      this._playFile(this._currentFile);
    }
  }

  private _playFile(file: string): void {
    this._shouldRequeue = true;
    this._current = spawn(AUDIO_COMMAND, [...AUDIO_ARGS, `audio/${file}`]);

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
      this._current = null;
      if (this._shouldRequeue) {
        this._playQueuedFile();
      }
    });
  }

  stop(): void {
    this._queuedFile = null;
    this._shouldRequeue = false;
    if (this._current && this._current.pid) {
      kill(this._current.pid);
    }
    this._current = null;
  }
}
