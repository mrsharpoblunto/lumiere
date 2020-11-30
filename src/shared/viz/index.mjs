import aquarium from './aquarium.mjs';
import fire from './fire.mjs';

export default function(width, height) {
  return [
    aquarium(width, height),
    fire(width, height),
  ];
}
