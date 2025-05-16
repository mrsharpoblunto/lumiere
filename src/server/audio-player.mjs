/**
 * @format
 */
import {AUDIO_COMMAND, VOLUME_COMMAND, AUDIO_ARGS} from './config.mjs';
import {spawn, exec} from 'child_process';
import kill from 'tree-kill';

export class AudioPlayer {
  constructor() {
    this._current = null;
    this._currentFile = null;
    this._queuedFile = null;
    this._shouldRequeue = true;
  }

  volume(volume) {
    exec(`${VOLUME_COMMAND} ${volume}%`, (error) => {
      if (error) {
        console.error(`exec error setting volume: ${error}`);
        return;
      }
    });
  }

  play(file) {
    this.stop();
    this._currentFile = file;
    this._playFile(file, volume);
  }
  
  queue(file) {
    this._queuedFile = file;
    if (!this._current) {
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
    this._current = spawn(AUDIO_COMMAND, [...AUDIO_ARGS, `audio/${file}`]);

    this._current.stdout.on('data', data => {
      console.log(`audio stdout:\n${data}`);
    });

    this._current.stderr.on('data', data => {
      console.error(`audio stderr: ${data}`);
    });
    this._current.on('error', err => {
      console.log(`audio error: ${err.message}`);
    });
    this._current.on('close', code => {
      if (code !== 0) {
        console.log(`audio player exited with code ${code}`);
      }
      this._current = null;
      if (this._shouldRequeue) {
        this._playQueuedFile();
      }
    });
  }

  stop() {
    this._shouldRequeue = false;
    if (this._current) {
      kill(this._current.pid);
    }
    this._current = null;
  }
}
