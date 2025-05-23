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
  private _onAudioNotPermitted?: () => void;
  cleanup: () => void;

  constructor(
    audioElement: HTMLAudioElement,
    onAudioNotPermitted?: () => void
  ) {
    this._audioElement = audioElement;
    this._currentFile = null;
    this._queuedFile = null;
    this._onAudioNotPermitted = onAudioNotPermitted;

    const onEnd = () => {
      this._playFile();
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
    this._queuedFile = file;
    this._playFile();
  }

  queue(file: string) {
    this._queuedFile = file;
    if (
      !this._audioElement.src ||
      this._audioElement.paused ||
      this._audioElement.ended
    ) {
      this._playFile();
    }
  }

  stop() {
    this._queuedFile = null;
    this._currentFile = null;
    this._audioElement.pause();
    this._audioElement.currentTime = 0;
  }

  _playFile() {
    if (this._queuedFile) {
      this._currentFile = this._queuedFile;
      this._queuedFile = null;
    }

    if (!this._currentFile) {
      return;
    }

    this._audioElement.src = this._currentFile;

    const playPromise = this._audioElement.play().catch((error) => {
      if (this._onAudioNotPermitted && error.name === 'NotAllowedError') {
        this._onAudioNotPermitted();
      }
    });

    // Handle play() promise rejection (autoplay policies may prevent immediate playback)
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.error(`Play error: ${error}`);
      });
    }
  }
}
