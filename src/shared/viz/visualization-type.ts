import type { IAudioPlayer } from "../audio-player-type.ts";
import type { ILocationService } from "../location-service-type.ts";
import type { Backbuffer } from "./back-buffer.ts";

export type DebugParamTime = { value: number; type: "time" };
export type DebugParamNumber = {
  value: number;
  type: "number";
  min: number;
  max: number;
  increment: number;
};
export type DebugParam = DebugParamTime | DebugParamNumber;

export interface IVisualization {
  name: string;
  audio?: string;
  volume: number;
  run: (
    backbuffer: Backbuffer,
    audio: IAudioPlayer,
    location: ILocationService,
    dt: number,
    t: number
  ) => void;
}
