import { h, header, fmtTime, viewWidth, viewHeight } from '../../js/ui.js';
import { load, save, remove } from '../../js/storage.js';
import * as playtimer from '../../js/playtimer.js';
import { autosave } from '../../js/autosave.js';
import { generateLevel, neighbours, counts, flood, DIFFICULTIES, SIZES } from './engine.js';
import { stats } from './stats.js';

const HOME = '#/game/mines';
const SAVE_KEY = 'games.mines.saved';
// Random levels: board sizes by difficulty, with a bigger board now and then.
const RANDOM_SIZES = { easy: ['tiny', 'tiny', 'tiny', 'small'], medium: ['tiny', 'small', 'small', 'medium'], hard: ['small', 'medium', 'medium', 'large'] };
// Number squares, from calm to alarming. Hidden squares are slate blue.
const NUM_COLOURS = [null, '#90be6d', '#f9c74f', '#f8961e', '#f94144', '#f3722c', '#43aa8b', '#4d908e', '#ffffff'];
const FLAG = '<svg viewBox="0 0 24 24"><path d="M7 3v18" stroke="#000" stroke-width="2.2" stroke-linecap="round"/><path d="M8 4h10l-3 4 3 4H8z" fill="#f94144"/></svg>';
const MINE = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="#000"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" stroke="#000" stroke-width="2" stroke-linecap="round"/></svg>';
const HIDDEN = 0, OPEN = 1, FLAGGED = 2;
const LONG_PRESS = 380; // ms held to flag

export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const getSavedGame = () => load(SAVE_KEY, null);
// Older saves and stats may name a size that no longer exists.
export const sizeLabel = s => (SIZES[s] ? `${SIZES[s].w}×${SIZES[s].h}` : '');
const pick = a => a[Math.floor(Math.random() * a.length)];

export function optsFromQuery(query) {
  if (query.get('mode') !== 'custom') {
    const r = Math.random();
    const difficulty = r < 0.2 ? 'easy' : r < 0.6 ? 'medium' : 'hard';
    return { size: pick(RANDOM_SIZES[difficulty]), difficulty };
  }
  return {
    size: SIZES[query.get('s')] ? query.get('s') : 'medium',
    difficulty: DIFFICULTIES.includes(query.get('d')) ? query.get('d') : 'medium',
  };
}
export const customHref = o => `${HOME}/play?mode=custom&s=${o.size}&d=${o.difficulty}`;

export function mountBoard(el, query) {
  const saved = query.get('resume') ? getSavedGame() : null;
  remove(SAVE_KEY); // resumed, or replaced by this new game
  const mode = saved ? saved.mode : query.get('mode') === 'custom' ? 'custom' : 'random';
  const opts = saved ? saved.opts : optsFromQuery(query);
  const level = saved ? saved.level : generateLevel(opts);
  if (!saved) stats.recordStart();
  const { w, h: rows, mines, start } = level;
  const N = w * rows, nb = neighbours(w, rows), num = counts(w, rows, mines, nb);
  const total = mines.reduce((a, b) => a + b, 0);
  let shown = saved ? Uint8Array.from(saved.shown) : new Uint8Array(N);
  if (!saved) flood(start, num, nb, shown);
  let acc = saved ? saved.acc : 0, mistakes = saved ? saved.mistakes : 0, failed = saved ? saved.failed : false;
  let flagMode = false, boom = -1, over = false, last = Date.now();
  const cleanups = [];

  const timerEl = h('span', { class: 'timer' }, fmtTime(acc / 1000));
  const bar = header(`${w}×${rows} · ${cap(opts.difficulty)}`, HOME);
  bar.querySelector('.bar-right').append(timerEl);
  const limitEl = h('div', { class: 'limit muted' });
  const showLimit = rem => { limitEl.textContent = rem == null ? '' : `Play time left ${fmtTime(rem / 1000)}`; };
  showLimit(playtimer.remainingMs());
  cleanups.push(playtimer.onTick(showLimit));

  const digBtn = h('button', { class: 'btn', onclick: () => setMode(false) }, 'Dig');
  const flagBtn = h('button', { class: 'btn', onclick: () => setMode(true) }, 'Flag');
  const controls = h('div', { class: 'controls' }, digBtn, flagBtn);
  const countEl = h('div', { class: 'mn-count' });
  const cells = [];
  const grid = h('div', { class: 'mn-grid', style: `--w:${w};--h:${rows}` });
  for (let i = 0; i < N; i++) {
    const c = h('div', { class: 'mn-cell', 'data-i': i });
    cells.push(c);
    grid.append(c);
  }
  const stage = h('div', { class: 'stage mn-stage' }, controls, countEl, grid);
  el.append(bar, limitEl, stage);

  function setMode(f) {
    flagMode = f;
    digBtn.classList.toggle('on', !f);
    flagBtn.classList.toggle('on', f);
  }

  const size = () => {
    const c = Math.floor(Math.min((viewWidth() - 32) / w, (viewHeight() - 230) / rows, 46));
    grid.style.setProperty('--c', `${Math.max(22, c)}px`);
  };

  function render() {
    let flags = 0;
    for (let i = 0; i < N; i++) {
      const c = cells[i], s = shown[i];
      let cls = 'mn-cell', html = '', bg = '';
      if (i === boom) { cls += ' boom'; html = MINE; }
      else if (s === OPEN) {
        cls += ' open';
        if (num[i] > 0) { cls += ' num'; html = String(num[i]); bg = NUM_COLOURS[num[i]]; }
      } else if (s === FLAGGED || (over && mines[i])) { cls += ' hid flag'; html = FLAG; flags++; }
      else cls += ' hid';
      if (c.className !== cls) c.className = cls;
      if (c.dataset.html !== html) { c.innerHTML = html; c.dataset.html = html; }
      if (c.style.background !== bg) c.style.background = bg;
    }
    countEl.textContent = `${over ? total : flags}/${total}`;
  }

  // --- Play ---
  const openCount = () => shown.reduce((k, s) => k + (s === OPEN), 0);
  function dig(list) {
    const hit = list.find(j => shown[j] === HIDDEN && mines[j]);
    if (hit != null) return explode(hit);
    for (const j of list) if (shown[j] === HIDDEN) flood(j, num, nb, shown);
    render();
    if (openCount() === N - total) finish();
  }
  function act(i, flag) {
    if (over || boom >= 0) return;
    if (shown[i] === OPEN) {
      // Tapping a number whose mines are all flagged opens the rest of its neighbours.
      if (num[i] > 0 && nb[i].filter(j => shown[j] === FLAGGED).length === num[i]) dig(nb[i].filter(j => shown[j] === HIDDEN));
      return;
    }
    if (flag) { shown[i] = shown[i] === FLAGGED ? HIDDEN : FLAGGED; render(); return; }
    if (shown[i] === FLAGGED) return; // flagged squares are safe from stray taps
    dig([i]);
  }

  let press = null;
  grid.addEventListener('pointerdown', e => {
    const c = e.target.closest('.mn-cell');
    if (!c || over || boom >= 0) return;
    const i = +c.dataset.i;
    press = { i, x: e.clientX, y: e.clientY, done: false };
    press.timer = setTimeout(() => {
      if (!press || shown[i] === OPEN) return;
      press.done = true;
      navigator.vibrate?.(15);
      act(i, true);
    }, LONG_PRESS);
  });
  grid.addEventListener('pointermove', e => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) { clearTimeout(press.timer); press = null; }
  });
  const release = e => {
    if (!press) return;
    clearTimeout(press.timer);
    const p = press;
    press = null;
    if (e.type === 'pointerup' && !p.done) act(p.i, flagMode);
  };
  grid.addEventListener('pointerup', release);
  grid.addEventListener('pointercancel', release);
  grid.addEventListener('contextmenu', e => e.preventDefault());

  function explode(i) {
    boom = i;
    mistakes++;
    if (!failed) { failed = true; stats.recordFail(); }
    render();
    grid.classList.add('shake');
    setTimeout(() => grid.classList.remove('shake'), 400);
    const card = h('div', { class: 'win card' },
      h('h2', {}, 'Boom'),
      h('p', { class: 'muted' }, 'Every mine here can be found by logic, so this was a slip. Take it back and look again.'),
      h('div', { class: 'row-btns' },
        h('button', { class: 'btn big', onclick: () => { boom = -1; card.remove(); render(); } }, 'Take it back'),
        h('a', { class: 'btn big ghost', href: nextHref() }, 'New level')));
    stage.append(card);
  }

  const nextHref = () => `${mode === 'custom' ? customHref(opts) : `${HOME}/play?mode=random`}&k=${Date.now()}`;
  function finish() {
    over = true;
    remove(SAVE_KEY);
    playtimer.stop();
    controls.hidden = true;
    render();
    const seconds = Math.round(acc / 1000);
    stats.recordWin({ s: seconds, m: mode, d: opts.difficulty, z: opts.size, x: mistakes });
    setTimeout(() => stage.append(h('div', { class: 'win card' },
      h('h2', {}, 'Cleared'),
      h('p', { class: 'win-time' }, fmtTime(seconds)),
      mistakes ? h('p', { class: 'muted' }, mistakes === 1 ? '1 slip taken back' : `${mistakes} slips taken back`) : null,
      h('div', { class: 'row-btns' },
        h('a', { class: 'btn big', href: nextHref() }, 'Next level'),
        h('a', { class: 'btn big ghost', href: HOME }, 'Menu')))), 500);
  }

  const clock = setInterval(() => {
    const now = Date.now();
    if (!document.hidden && !over && boom < 0) acc += Math.max(0, now - last);
    last = now;
    timerEl.textContent = fmtTime(Math.floor(acc / 1000));
  }, 250);
  cleanups.push(() => clearInterval(clock));
  cleanups.push(autosave(() => { if (!over) save(SAVE_KEY, { mode, opts, level, shown: Array.from(shown), acc, mistakes, failed }); }));

  setMode(false);
  size();
  render();
  window.addEventListener('resize', size);
  cleanups.push(() => window.removeEventListener('resize', size));
  playtimer.start();

  return { unmount() { clearTimeout(press?.timer); cleanups.forEach(fn => fn()); } };
}
