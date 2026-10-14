// Per-game stats stored in localStorage: levels started, completed, failed and completion times.
import { load, save } from './storage.js';

const MAX_RESULTS = 2000;

export function createStats(key) {
  const get = () => ({ started: 0, completed: 0, failed: 0, results: [], ...load(key, {}) });
  const update = fn => {
    const s = get();
    fn(s);
    save(key, s);
  };
  return {
    get,
    recordStart: () => update(s => { s.started++; }),
    recordFail: () => update(s => { s.failed++; }),
    // result: { s (seconds), m ('random' | 'custom'), ...game-specific fields }
    recordWin: result => update(s => {
      s.completed++;
      s.results.push({ ...result, at: Date.now() });
      if (s.results.length > MAX_RESULTS) s.results.splice(0, s.results.length - MAX_RESULTS);
    }),
  };
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
