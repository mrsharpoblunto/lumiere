/**
 * @format
 */
import {AUDIO_COMMAND, VOLUME_COMMAND, AUDIO_ARGS} from './config.mjs';
import {spawn, exec} from 'child_process';
import kill from 'tree-kill';

export class AudioPlayer {
  constructor() {
    this._current = null;
  }

  play(file, volume) {
    this.stop();
    this._current = spawn(AUDIO_COMMAND, [...AUDIO_ARGS, file]);
    exec(`${VOLUME_COMMAND} ${volume}%`, (error) => {
      if (error) {
        console.error(`exec error setting volume: ${error}`);
        return;
      }
    });

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
      console.log(`audio player exited with code ${code}`);
    });
  }

  stop() {
    if (this._current) {
      kill(this._current.pid);
    }
    this._current = null;
  }
}
