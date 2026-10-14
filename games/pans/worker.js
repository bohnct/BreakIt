import { generate } from './generator.js';

self.onmessage = e => {
  const { n, difficulty } = e.data;
  self.postMessage(generate(n, difficulty));
};
