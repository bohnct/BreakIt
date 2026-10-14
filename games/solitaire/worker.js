import { newDeal } from './engine.js';

self.onmessage = e => {
  self.postMessage(newDeal(e.data));
};
