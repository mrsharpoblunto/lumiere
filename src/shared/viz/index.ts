import aquarium from "./aquarium.ts";
import fire from "./fire.ts";
import bonsai from "./bonsai.ts";
import { IVisualization } from "./visualization-type.ts";

export default function (width: number, height: number): IVisualization[] {
  return [aquarium(width, height), fire(width, height), bonsai(width, height)];
}
