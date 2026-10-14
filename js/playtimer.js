// Global play-time limit. Counts time while a game board is active and the app is visible;
// when the limit is reached it fires onExpire and resets the counter.
import { load, save } from './storage.js';

const SETTINGS_KEY = 'app.settings';
const ELAPSED_KEY = 'app.playtime';

export const DEFAULT_SETTINGS = { limitEnabled: false, limitMinutes: 15, theme: 'night' };

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...load(SETTINGS_KEY, {}) };
}

export function setSettings(patch) {
  save(SETTINGS_KEY, { ...getSettings(), ...patch });
}

let elapsedMs = load(ELAPSED_KEY, 0);
let interval = null, last = 0;
let expireHandler = () => {};
const tickHandlers = new Set();

export function onExpire(fn) { expireHandler = fn; }
export function onTick(fn) { tickHandlers.add(fn); return () => tickHandlers.delete(fn); }

export function remainingMs() {
  const s = getSettings();
  return s.limitEnabled ? Math.max(0, s.limitMinutes * 60000 - elapsedMs) : null;
}

export function usedMs() { return elapsedMs; }

export function resetPlaytime() {
  elapsedMs = 0;
  save(ELAPSED_KEY, 0);
}

function accumulate() {
  const now = Date.now();
  if (!document.hidden) elapsedMs += now - last;
  last = now;
  save(ELAPSED_KEY, elapsedMs);
}

function tick() {
  accumulate();
  const rem = remainingMs();
  tickHandlers.forEach(fn => fn(rem));
  if (rem === 0) {
    clearInterval(interval);
    interval = null;
    resetPlaytime();
    expireHandler();
  }
}

export function start() {
  if (interval) return;
  last = Date.now();
  interval = setInterval(tick, 1000);
}

export function stop() {
  if (!interval) return;
  accumulate();
  clearInterval(interval);
  interval = null;
}

document.addEventListener('visibilitychange', () => { last = Date.now(); });
