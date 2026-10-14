import { generateMap } from './engine.js';

self.onmessage = e => {
  self.postMessage(generateMap(e.data));
};
