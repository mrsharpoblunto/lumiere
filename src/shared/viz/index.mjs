import aquarium from "./aquarium.mjs";
import fire from "./fire.mjs";
import bonsai from "./bonsai.mjs";

export default function (width, height) {
  return [aquarium(width, height), fire(width, height), bonsai(width, height)];
}
