import type { IAudioPlayer } from "../audio-player-type.ts";
import type { Backbuffer } from "../back-buffer.ts";

export interface IVisualization {
  name: string;
  audio?: string;
  volume: number;
  run: (
    backbuffer: Backbuffer,
    audio: IAudioPlayer,
    dt: number,
    t: number
  ) => void;
}
