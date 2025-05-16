/**
 * @format
 */

export class NullAudio {
  constructor() {
  }

  volume(volume) {
    // No-op
  }

  play(file) {
    // No-op
  }

  queue(file) {
    // No-op
  }

  stop() {
    // No-op
  }
}

export class BrowserAudio {
  constructor(document) {
    this._document = document || window.document;
    this._audioElement = null;
    this._currentFile = null;
    this._queuedFile = null;
    this._shouldRequeue = true;
    this._createAudioElement();
  }
  
  _createAudioElement() {
    if (this._audioElement) {
      this._audioElement.remove();
    }
    
    this._audioElement = this._document.createElement('audio');
    this._audioElement.style.display = 'none';
    this._document.body.appendChild(this._audioElement);
    
    this._audioElement.addEventListener('ended', () => {
      if (this._shouldRequeue) {
        this._playQueuedFile();
      }
    });
    
    this._audioElement.addEventListener('error', (err) => {
      console.log(`audio error: ${err}`);
    });
  }

  volume(volume) {
    if (this._audioElement) {
      this._audioElement.volume = volume / 100;
    }
  }

  play(file) {
    this.stop();
    this._currentFile = file;
    this._playFile(file);
  }
  
  queue(file) {
    this._queuedFile = file;
    
    if (!this._audioElement.src || this._audioElement.paused || this._audioElement.ended) {
      this._playQueuedFile();
    }
  }
  
  _playQueuedFile() {
    if (this._queuedFile) {
      this._currentFile = this._queuedFile;
      this._queuedFile = null;
    }
    this._playFile(this._currentFile);
  }
  
  _playFile(file) {
    this._shouldRequeue = true;
    this._audioElement.src = file;

    const playPromise = this._audioElement.play();
    
    // Handle play() promise rejection (autoplay policies may prevent immediate playback)
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.error(`Play error: ${error}`);
      });
    }
  }

  stop() {
    this._shouldRequeue = false;
    if (this._audioElement) {
      this._audioElement.pause();
      this._audioElement.currentTime = 0;
    }
  }
}
