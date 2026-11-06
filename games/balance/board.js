import { h, header, fmtTime, viewWidth } from '../../js/ui.js';
import { load, save, remove } from '../../js/storage.js';
import * as playtimer from '../../js/playtimer.js';
import { autosave } from '../../js/autosave.js';
import { DIFFICULTIES, POS, newLevel, torque, solved } from './engine.js';
import { stats } from './stats.js';

const HOME = '#/game/balance';
const SAVE_KEY = 'games.balance.saved';
const TILT = 6; // degrees; the same whatever the imbalance, so it only says which side is heavy

export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const getSavedGame = () => load(SAVE_KEY, null);

export function optsFromQuery(query) {
  if (query.get('mode') !== 'custom') {
    const r = Math.random();
    return { difficulty: r < 0.2 ? 'easy' : r < 0.6 ? 'medium' : 'hard' };
  }
  return { difficulty: DIFFICULTIES.includes(query.get('d')) ? query.get('d') : 'medium' };
}
export const customHref = o => `${HOME}/play?mode=custom&d=${o.difficulty}`;

const blockEl = (b, i) => h('div', { class: 'bp-block', 'data-i': i, style: `--cols:${b.shape[0].length};--rows:${b.shape.length}` },
  b.shape.flatMap(row => [...row].map(ch => h('span', { class: ch === '#' ? 'bp-cell' : 'bp-gap', style: ch === '#' ? `background:${b.colour}` : null }))));

export function mountBoard(el, query) {
  const saved = query.get('resume') ? getSavedGame() : null;
  remove(SAVE_KEY); // resumed, or replaced by this new game
  const mode = saved ? saved.mode : query.get('mode') === 'custom' ? 'custom' : 'random';
  const opts = saved ? saved.opts : optsFromQuery(query);
  const level = saved ? saved.level : newLevel(opts);
  if (!saved) stats.recordStart();
  const { blocks } = level;
  let place = saved ? saved.place : blocks.map(() => -1);
  let acc = saved ? saved.acc : 0;
  let history = [], selected = null, over = false, last = Date.now();
  const cleanups = [];

  const timerEl = h('span', { class: 'timer' }, fmtTime(acc / 1000));
  const bar = header(`${cap(opts.difficulty)} · ${blocks.length} blocks`, HOME);
  bar.querySelector('.bar-right').append(timerEl);
  const limitEl = h('div', { class: 'limit muted' });
  const showLimit = rem => { limitEl.textContent = rem == null ? '' : `Play time left ${fmtTime(rem / 1000)}`; };
  showLimit(playtimer.remainingMs());
  cleanups.push(playtimer.onTick(showLimit));

  // Each side's pull: weight x distance, added up.
  const leftEl = h('span'), rightEl = h('span');
  const totals = h('div', { class: 'bp-totals' }, leftEl, h('i', { class: 'bp-vs' }, ':'), rightEl);
  const els = blocks.map(blockEl);
  const spots = POS.map((p, s) => h('div', { class: 'bp-spot', 'data-s': s },
    h('span', { class: 'bp-dots' }, Array.from({ length: Math.abs(p) }, () => h('i')))));
  const arm = h('div', { class: 'bp-arm' }, spots, h('div', { class: 'bp-beam' }));
  const scale = h('div', { class: 'bp-scale' }, arm, h('div', { class: 'bp-pivot' }));
  // Tray slots stay put while their blocks are out, so the others don't jump about.
  const slots = blocks.map(() => h('div', { class: 'bp-slot' }));
  const tray = h('div', { class: 'bp-tray' }, slots);
  const controls = h('div', { class: 'controls' },
    h('button', { class: 'btn', onclick: () => undo() }, 'Undo'),
    h('button', { class: 'btn', onclick: () => restart() }, 'Restart'));
  const stage = h('div', { class: 'stage bp-stage' }, controls, totals, tray, scale);
  el.append(bar, limitEl, stage);

  // --- Layout ---
  const size = () => {
    const W = Math.min(viewWidth() - 32, 528);
    const unit = W / 7; // spot 3 sits three units out, leaving half a unit past it
    const c = Math.max(12, Math.min(24, Math.floor((unit * 0.86) / 2)));
    stage.style.setProperty('--c', `${c}px`);
    stage.style.setProperty('--w', `${W}px`);
    spots.forEach((s, i) => { s.style.left = `${W / 2 + POS[i] * unit - unit / 2}px`; s.style.width = `${unit}px`; });
  };

  function render() {
    blocks.forEach((b, i) => {
      const home = place[i] < 0 ? slots[i] : spots[place[i]];
      if (els[i].parentNode !== home) home.append(els[i]);
      els[i].classList.toggle('selected', selected === i);
    });
    spots.forEach((s, k) => s.classList.toggle('open', !place.includes(k)));
    stage.classList.toggle('picking', selected != null);
    const t = torque(blocks, place);
    arm.style.transform = `rotate(${t < 0 ? -TILT : t > 0 ? TILT : 0}deg)`;
    const side = sign => blocks.reduce((sum, b, i) => (place[i] >= 0 && Math.sign(POS[place[i]]) === sign ? sum + b.w * Math.abs(POS[place[i]]) : sum), 0);
    leftEl.textContent = side(-1);
    rightEl.textContent = side(1);
  }

  // --- Play ---
  const move = (i, to) => {
    history.push([...place]);
    const other = to < 0 ? -1 : place.indexOf(to);
    if (other >= 0 && other !== i) place[other] = place[i]; // swap with whatever was there
    place[i] = to;
    selected = null;
  };
  stage.addEventListener('click', e => {
    if (over) return;
    const b = e.target.closest('.bp-block'), spot = e.target.closest('.bp-spot');
    if (b && (!spot || selected == null || selected === +b.dataset.i)) {
      const i = +b.dataset.i;
      selected = selected === i ? null : i;
    } else if (spot && selected != null) {
      if (place[selected] !== +spot.dataset.s) move(selected, +spot.dataset.s);
      else selected = null;
    } else if (e.target.closest('.bp-tray') && selected != null && place[selected] >= 0) {
      move(selected, -1);
    } else selected = null;
    render();
    if (solved(blocks, place)) finish();
  });

  function undo() {
    if (over || !history.length) return;
    place = history.pop();
    selected = null;
    render();
  }
  function restart() {
    if (over || place.every(p => p < 0)) return;
    history.push([...place]);
    place = blocks.map(() => -1);
    selected = null;
    render();
  }

  const nextHref = () => `${mode === 'custom' ? customHref(opts) : `${HOME}/play?mode=random`}&k=${Date.now()}`;
  function finish() {
    over = true;
    remove(SAVE_KEY);
    playtimer.stop();
    controls.hidden = true;
    stage.classList.add('done');
    const seconds = Math.round(acc / 1000);
    stats.recordWin({ s: seconds, m: mode, d: opts.difficulty, n: blocks.length });
    // Let the beam settle level before the card appears.
    setTimeout(() => stage.append(h('div', { class: 'win card' },
      h('h2', {}, 'Balanced'),
      h('p', { class: 'win-time' }, fmtTime(seconds)),
      h('div', { class: 'row-btns' },
        h('a', { class: 'btn big', href: nextHref() }, 'Next level'),
        h('a', { class: 'btn big ghost', href: HOME }, 'Menu')))), 700);
  }

  const clock = setInterval(() => {
    const now = Date.now();
    if (!document.hidden && !over) acc += Math.max(0, now - last);
    last = now;
    timerEl.textContent = fmtTime(Math.floor(acc / 1000));
  }, 250);
  cleanups.push(() => clearInterval(clock));
  cleanups.push(autosave(() => { if (!over) save(SAVE_KEY, { mode, opts, level, place, acc }); }));

  size();
  render();
  window.addEventListener('resize', size);
  cleanups.push(() => window.removeEventListener('resize', size));
  playtimer.start();

  return { unmount() { cleanups.forEach(fn => fn()); } };
}
