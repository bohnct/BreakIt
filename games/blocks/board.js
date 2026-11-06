import { h, header, fmtTime, viewWidth, viewHeight, zoom } from '../../js/ui.js';
import { load, save, remove } from '../../js/storage.js';
import * as playtimer from '../../js/playtimer.js';
import { autosave } from '../../js/autosave.js';
import { generateLevel, range, solved, DIFFICULTIES } from './engine.js';
import { stats } from './stats.js';

const HOME = '#/game/blocks';
const SAVE_KEY = 'games.blocks.cars.saved';
const PAD = 14; // frame padding in px, as in .bj-frame
export const SIZES = [6, 7, 8];
// Random levels: Hard is mostly 6×6, sometimes 7×7 and now and then 8×8.
const RANDOM_SIZES = { medium: [6, 6, 6, 7], hard: [6, 6, 6, 6, 7, 7, 7, 8] };
// Your car is red; everything else takes the rest of the palette.
const YOURS = '#f94144';
const COLOURS = ['#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590']; // no orange: too close to red

export const getSavedGame = () => load(SAVE_KEY, null);
export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
const pick = a => a[Math.floor(Math.random() * a.length)];

// Generate off the main thread so the loading screen stays responsive; fall back if workers fail.
function generateAsync(opts) {
  return new Promise(resolve => {
    const fallback = () => setTimeout(() => resolve(generateLevel(opts)), 30);
    let worker;
    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    } catch {
      return fallback();
    }
    worker.onmessage = e => { worker.terminate(); resolve(e.data); };
    worker.onerror = () => { worker.terminate(); fallback(); };
    worker.postMessage(opts);
  });
}

// Level settings from the URL (custom) or picked at random.
export function optsFromQuery(query) {
  if (query.get('mode') !== 'custom') {
    const difficulty = Math.random() < 0.5 ? 'medium' : 'hard';
    return { n: pick(RANDOM_SIZES[difficulty]), difficulty };
  }
  const n = +query.get('n');
  return {
    n: SIZES.includes(n) ? n : 6,
    difficulty: DIFFICULTIES.includes(query.get('d')) ? query.get('d') : 'medium',
  };
}
export const customHref = o => `${HOME}/play?mode=custom&n=${o.n}&d=${o.difficulty}`;

// The look of each vehicle: windows and, for trucks, a cab. Drawn along the vehicle's length
// from its front, as shares of that length.
function details(v) {
  if (v.kind === 'car') return [['cp-glass', 0.16, 0.2], ['cp-glass', 0.66, 0.14]];
  if (v.kind === 'truck') return [['cp-glass', 0.06, 0.13], ['cp-cargo', 0.3, 0.68]];
  const out = [['cp-glass', 0.04, 0.09]];
  for (let k = 0; k < 4; k++) out.push(['cp-pane', 0.2 + k * 0.19, 0.12]);
  return out;
}

export function mountBoard(el, query) {
  const saved = query.get('resume') ? getSavedGame() : null;
  if (saved) remove(SAVE_KEY);
  const mode = saved ? saved.mode : query.get('mode') === 'custom' ? 'custom' : 'random';
  const opts = saved ? saved.opts : optsFromQuery(query);

  let alive = true;
  const cleanups = [];
  const timerEl = h('span', { class: 'timer' }, '');
  const bar = header(`${opts.n}×${opts.n} · ${cap(opts.difficulty)}`, HOME);
  bar.querySelector('.bar-right').append(timerEl);
  const limitEl = h('div', { class: 'limit muted' });
  const stage = h('div', { class: 'stage' }, h('div', { class: 'loading' }, h('div', { class: 'spinner' }), 'Kelsey is boxing you in…'));
  el.append(bar, limitEl, stage);

  const showLimit = rem => { limitEl.textContent = rem == null ? '' : `Play time left ${fmtTime(rem / 1000)}`; };
  showLimit(playtimer.remainingMs());

  if (saved) start(saved.level, saved);
  else {
    generateAsync(opts).then(level => {
      if (!alive) return;
      level.colours = level.vehicles.map((v, i) => (i === 0 ? YOURS : pick(COLOURS)));
      stats.recordStart();
      remove(SAVE_KEY); // a new game replaces any unfinished one
      start(level);
    });
  }

  function start(level, resume) {
    const { n, vehicles } = level;
    let pos = resume ? resume.pos : level.start.slice();
    let moves = resume ? resume.moves : 0;
    let history = resume ? resume.history : [];
    let acc = resume ? resume.acc : 0, over = false, drag = null;

    const frame = h('div', { class: 'bj-frame cp-frame' });
    const floor = h('div', { class: 'bj-floor', style: `width:calc(var(--cell) * ${n});height:calc(var(--cell) * ${n})` });
    for (let i = 0; i < n * n; i++) {
      floor.append(h('div', { class: 'bj-tile', style: `left:calc(var(--cell) * ${i % n});top:calc(var(--cell) * ${Math.floor(i / n)})` }));
    }
    // The way out: a gap in the right-hand wall level with your car.
    const exitAt = vehicles[0].at;
    frame.append(h('div', { class: 'cp-exit', style: `top:calc(${PAD}px + var(--cell) * ${exitAt})` }));
    const els = vehicles.map((v, i) => {
      const e = h('div', { class: `cp-veh${i === 0 ? ' yours' : ''}${v.h ? ' h' : ' v'}`, 'data-i': i,
        style: `--len:${v.len};background-color:${level.colours[i]}` },
        details(v).map(([cls, at, len]) => h('span', { class: cls, style: `--at:${at};--l:${len}` })));
      floor.append(e);
      return e;
    });
    frame.append(floor);

    const count = h('div', { class: 'cp-count' });
    const controls = h('div', { class: 'controls' },
      h('button', { class: 'btn', onclick: () => undo() }, 'Undo'),
      h('button', { class: 'btn', onclick: () => restart() }, 'Restart'));
    stage.replaceChildren(controls, count, frame);

    const sizeBoard = () => {
      const availW = Math.min(viewWidth() - 32, 528) - 2 * PAD - 4;
      const availH = viewHeight() - 270 - 2 * PAD;
      frame.style.setProperty('--cell', `${Math.max(30, Math.floor(Math.min(availW / n, availH / n)))}px`);
    };
    const cellPx = () => parseFloat(frame.style.getPropertyValue('--cell'));
    sizeBoard();
    window.addEventListener('resize', sizeBoard);
    cleanups.push(() => window.removeEventListener('resize', sizeBoard));

    const place = (i, offset = 0) => {
      const v = vehicles[i];
      const x = v.h ? `calc(var(--cell) * ${pos[i]} + ${offset}px)` : `calc(var(--cell) * ${v.at})`;
      const y = v.h ? `calc(var(--cell) * ${v.at})` : `calc(var(--cell) * ${pos[i]} + ${offset}px)`;
      els[i].style.transform = `translate(${x}, ${y})`;
    };
    const render = () => {
      vehicles.forEach((_, i) => place(i));
      count.textContent = `${moves} move${moves === 1 ? '' : 's'}`;
    };

    // --- Driving ---
    // A vehicle follows the finger along its length, stopping at whatever is in the way, and
    // snaps to the nearest square when let go.
    floor.addEventListener('pointerdown', e => {
      if (over || drag) return;
      const t = e.target.closest('.cp-veh');
      if (!t) return;
      e.preventDefault();
      const i = +t.dataset.i, v = vehicles[i];
      const [lo, hi] = range(level, pos, i);
      floor.setPointerCapture(e.pointerId);
      drag = { i, s: v.h ? e.clientX : e.clientY, lo, hi, offset: 0 };
      t.classList.add('lift');
    });
    floor.addEventListener('pointermove', e => {
      const d = drag;
      if (!d) return;
      const cp = cellPx(), v = vehicles[d.i];
      const raw = ((v.h ? e.clientX : e.clientY) - d.s) / zoom();
      d.offset = Math.max((d.lo - pos[d.i]) * cp, Math.min((d.hi - pos[d.i]) * cp, raw));
      place(d.i, d.offset);
    });
    const endDrag = () => {
      const d = drag;
      if (!d) return;
      drag = null;
      els[d.i].classList.remove('lift');
      const to = pos[d.i] + Math.round(d.offset / cellPx());
      if (to !== pos[d.i]) {
        history.push({ pos: pos.slice(), moves });
        pos[d.i] = to;
        moves++;
      }
      render();
      if (solved(level, pos)) win();
    };
    floor.addEventListener('pointerup', endDrag);
    floor.addEventListener('pointercancel', endDrag);

    function undo() {
      if (over || !history.length) return;
      ({ pos, moves } = history.pop());
      render();
    }
    function restart() {
      if (over || !moves) return;
      history.push({ pos: pos.slice(), moves });
      pos = level.start.slice();
      moves = 0;
      render();
    }

    // Elapsed time, for stats.
    let last = Date.now();
    const showClock = () => { timerEl.textContent = fmtTime(Math.floor(acc / 1000)); };
    const clock = setInterval(() => {
      const now = Date.now();
      if (!document.hidden && !over) acc += Math.max(0, now - last);
      last = now;
      showClock();
    }, 250);
    cleanups.push(() => clearInterval(clock));
    cleanups.push(playtimer.onTick(showLimit));
    cleanups.push(autosave(() => { if (!over) save(SAVE_KEY, { mode, opts, level, pos, moves, history, acc }); }));

    const nextHref = () => `${mode === 'custom' ? customHref(opts) : `${HOME}/play?mode=random`}&k=${Date.now()}`;
    function win() {
      over = true;
      remove(SAVE_KEY);
      playtimer.stop();
      controls.hidden = true;
      frame.classList.add('done');
      // Drive out through the gap.
      els[0].classList.add('leaving');
      els[0].style.transform = `translate(calc(var(--cell) * ${n + 1}), calc(var(--cell) * ${exitAt}))`;
      const seconds = Math.round(acc / 1000);
      stats.recordWin({ s: seconds, m: mode, n, d: level.difficulty, mv: moves, best: level.best });
      setTimeout(() => stage.append(h('div', { class: 'win card' },
        h('h2', {}, 'Free at last'),
        h('p', { class: 'win-time' }, fmtTime(seconds)),
        h('p', { class: 'muted' }, moves === level.best ? `${moves} moves, the fewest possible` : `${moves} moves · fewest possible ${level.best}`),
        h('div', { class: 'row-btns' },
          h('a', { class: 'btn big', href: nextHref() }, 'Next level'),
          h('a', { class: 'btn big ghost', href: HOME }, 'Menu')))), 450);
    }

    render();
    requestAnimationFrame(() => requestAnimationFrame(() => frame.classList.add('ready')));
    showClock();
    playtimer.start();
  }

  return {
    unmount() {
      alive = false;
      cleanups.forEach(fn => fn());
    },
  };
}
