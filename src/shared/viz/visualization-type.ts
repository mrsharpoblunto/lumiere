import { type IAudioPlayer } from "../audio-player-type.ts";
import { type LedMatrixInstance } from "rpi-led-matrix";
export type { Color, LedMatrixInstance } from "rpi-led-matrix";

export interface IVisualization {
  name: string;
  audio?: string;
  volume: number;
  run: (
    matrix: LedMatrixInstance,
    audio: IAudioPlayer,
    dt: number,
    t: number
  ) => void;
}
