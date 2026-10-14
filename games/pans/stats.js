import { load, save } from '../../js/storage.js';

const KEY = 'games.pans.stats';
const MAX_RESULTS = 2000;

export function getStats() {
  return { started: 0, completed: 0, results: [], ...load(KEY, {}) };
}

export function recordStart() {
  const s = getStats();
  s.started++;
  save(KEY, s);
}

// result: { n, d, s (seconds), m ('random' | 'custom'), hints }
export function recordWin(result) {
  const s = getStats();
  s.completed++;
  s.results.push({ ...result, at: Date.now() });
  if (s.results.length > MAX_RESULTS) s.results.splice(0, s.results.length - MAX_RESULTS);
  save(KEY, s);
}

export function summarize(results) {
  if (!results.length) return { count: 0, avg: null, min: null, max: null };
  const times = results.map(r => r.s);
  return {
    count: times.length,
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
  };
}
