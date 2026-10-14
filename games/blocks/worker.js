import { generateLevel } from './engine.js';

self.onmessage = e => {
  self.postMessage(generateLevel(e.data));
};
