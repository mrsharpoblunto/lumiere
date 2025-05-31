import { IAudioPlayer } from "../shared/audio-player-type.ts";

export class NullAudio implements IAudioPlayer {
  constructor(_masterVolume: number = 1.0) {}
  volume(_volume: number) {}
  masterVolume(_volume: number) {}
  play(_file: string) {}
  queue(_file: string) {}
  stop() {}
}

export class BrowserAudio implements IAudioPlayer {
  private _audioElement: HTMLAudioElement;
  private _currentFile: string | null;
  private _queuedFile: string | null;
  private _onAudioNotPermitted?: () => void;
  private _masterVolume: number;
  private _currentVolume: number = 100;
  cleanup: () => void;

  constructor(
    audioElement: HTMLAudioElement,
    masterVolume: number,
    onAudioNotPermitted?: () => void
  ) {
    this._audioElement = audioElement;
    this._currentFile = null;
    this._queuedFile = null;
    this._onAudioNotPermitted = onAudioNotPermitted;
    this._masterVolume = masterVolume;

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
    this._currentVolume = volume;
    const adjustedVolume = (volume / 100) * this._masterVolume;
    this._audioElement.volume = adjustedVolume;
  }

  masterVolume(volume: number) {
    this._masterVolume = volume;
    this.volume(this._currentVolume);
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
