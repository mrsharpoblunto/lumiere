import { IAudioPlayer } from "../shared/audio-player-type.ts";

export class NullAudio implements IAudioPlayer {
  volume(_volume: number) {}
  play(_file: string) {}
  queue(_file: string) {}
  stop() {}
}

export class BrowserAudio implements IAudioPlayer {
  private _audioElement: HTMLAudioElement;
  private _currentFile: string | null;
  private _queuedFile: string | null;
  private _shouldRequeue: boolean;
  cleanup: () => void;

  constructor(audioElement: HTMLAudioElement) {
    this._audioElement = audioElement;
    this._currentFile = null;
    this._queuedFile = null;
    this._shouldRequeue = true;

    const onEnd = () => {
      if (this._shouldRequeue) {
        this._playQueuedFile();
      }
    };

    this._audioElement.addEventListener("ended", onEnd);
    this.cleanup = () => {
      this._audioElement.removeEventListener("ended", onEnd);
      this.stop();
    };
  }

  volume(volume: number) {
    this._audioElement.volume = volume / 100;
  }

  play(file: string) {
    this.stop();
    this._currentFile = file;
    this._playFile(file);
  }

  queue(file: string) {
    this._queuedFile = file;

    if (
      !this._audioElement.src ||
      this._audioElement.paused ||
      this._audioElement.ended
    ) {
      this._playQueuedFile();
    }
  }

  _playQueuedFile() {
    if (this._queuedFile) {
      this._currentFile = this._queuedFile;
      this._queuedFile = null;
    }
    if (this._currentFile) {
      this._playFile(this._currentFile);
    }
  }

  _playFile(file: string) {
    this._shouldRequeue = true;
    this._audioElement.src = file;

    const playPromise = this._audioElement.play();

    // Handle play() promise rejection (autoplay policies may prevent immediate playback)
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.error(`Play error: ${error}`);
      });
    }
  }

  stop() {
    this._shouldRequeue = false;
    this._audioElement.pause();
    this._audioElement.currentTime = 0;
  }
}
