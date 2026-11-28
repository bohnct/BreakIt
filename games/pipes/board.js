import { h, header, fmtTime, viewWidth, viewHeight, zoom } from '../../js/ui.js';
import { load, save, remove } from '../../js/storage.js';
import * as playtimer from '../../js/playtimer.js';
import { autosave } from '../../js/autosave.js';
import { generateLevel, flow, rotate, degree, DR, DC, DIFFICULTIES, SIZES } from './engine.js';
import { stats } from './stats.js';

const HOME = '#/game/pipes';
const SAVE_KEY = 'games.pipes.saved';
// Random levels: garden sizes by difficulty, with a bigger garden now and then.
const RANDOM_SIZES = { easy: [5, 5, 6, 6, 7], medium: [6, 6, 7, 7, 8], hard: [6, 7, 7, 8, 9] };
const WATER = '#3a86ff';
const PETALS = ['#ff70b8', '#ffd60a', '#e5383b', '#a45ee5', '#ff8c1a'];
const HOLD_MS = 450;

export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const getSavedGame = () => load(SAVE_KEY, null);
const pick = a => a[Math.floor(Math.random() * a.length)];

export function optsFromQuery(query) {
  if (query.get('mode') !== 'custom') {
    const r = Math.random();
    const difficulty = r < 0.2 ? 'easy' : r < 0.6 ? 'medium' : 'hard';
    return { n: pick(RANDOM_SIZES[difficulty]), difficulty };
  }
  const n = +query.get('n');
  return {
    n: SIZES.includes(n) ? n : 7,
    difficulty: DIFFICULTIES.includes(query.get('d')) ? query.get('d') : 'medium',
  };
}
export const customHref = o => `${HOME}/play?mode=custom&n=${o.n}&d=${o.difficulty}`;

// The pieces as they stand: each one's starting shape turned by the player's taps.
export const currentMasks = (level, turns) => level.start.map((m, i) => rotate(m, turns[i] & 3));
// Plants (end pieces) that the water reaches.
export function watered(level, turns) {
  const masks = currentMasks(level, turns), f = flow(level.n, masks, level.source);
  let wet = 0, all = 0;
  masks.forEach((m, i) => { if (degree(m) === 1 && i !== level.source) { all++; wet += f.wet[i]; } });
  return { wet, all };
}

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

// One pipe piece, drawn pointing the way its mask says, centred on 0,0 in a 1×1 tile.
function pieceSvg(mask) {
  let arms = '';
  for (let d = 0; d < 4; d++) if (mask >> d & 1) arms += `M0 0L${DC[d] * 0.5} ${DR[d] * 0.5}`;
  // The invisible full-size box keeps the turning centre in the middle of the tile.
  return `<rect x="-.5" y="-.5" width="1" height="1" fill="none"/>` +
    `<rect class="pp-bg" x="-.45" y="-.45" width=".9" height=".9" rx=".14"/>` +
    `<path class="pp-pipe" d="${arms}" stroke-width=".26" fill="none"/>` +
    `<circle class="pp-hub" r=".13"/>`;
}

// A plant on an end piece: a wilted bud while dry, a flower once watered.
function plantSvg(x, y, wet, colour, bloom) {
  const leaves = `<ellipse cx="-.11" cy=".08" rx=".1" ry=".05" transform="rotate(-30 -.11 .08)"/><ellipse cx=".11" cy=".08" rx=".1" ry=".05" transform="rotate(30 .11 .08)"/>`;
  if (!wet) {
    return `<g transform="translate(${x} ${y})"><g fill="var(--muted)">${leaves}</g><circle cy="-.04" r=".09" fill="var(--muted)" stroke="var(--tile)" stroke-width=".03"/></g>`;
  }
  let petals = '';
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    petals += `<circle cx="${(Math.cos(a) * 0.1).toFixed(3)}" cy="${(Math.sin(a) * 0.1 - 0.04).toFixed(3)}" r=".085"/>`;
  }
  return `<g transform="translate(${x} ${y})"><g class="${bloom ? 'pp-bloom' : ''}"${bloom ? ` style="--d:${bloom}ms"` : ''}>` +
    `<g fill="#5cc93f">${leaves}</g><g fill="${colour}">${petals}</g><circle cy="-.04" r=".06" fill="#ffd60a" stroke="#000" stroke-opacity=".25" stroke-width=".02"/></g></g>`;
}

// The tap: a round water tank with a drop on it.
const tapSvg = (x, y) => `<g transform="translate(${x} ${y})"><circle r=".24" fill="${WATER}" stroke="var(--fg)" stroke-width=".045"/>` +
  `<path d="M0 -.13C.05 -.05 .09 0 .09 .04A.09 .09 0 0 1 -.09 .04C-.09 0 -.05 -.05 0 -.13Z" fill="#fff"/></g>`;

// Water spilling out of an open end.
const leakSvg = (x, y) => `<g transform="translate(${x} ${y})" class="pp-leak"><circle r=".1" fill="${WATER}" stroke="var(--bg)" stroke-width=".03"/><circle cx=".13" cy="-.08" r=".045" fill="${WATER}"/><circle cx="-.12" cy="-.09" r=".04" fill="${WATER}"/></g>`;

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
  const stage = h('div', { class: 'stage' }, h('div', { class: 'loading' }, h('div', { class: 'spinner' }), 'Laying the pipes…'));
  el.append(bar, limitEl, stage);

  const showLimit = rem => { limitEl.textContent = rem == null ? '' : `Play time left ${fmtTime(rem / 1000)}`; };
  showLimit(playtimer.remainingMs());
  cleanups.push(playtimer.onTick(showLimit));

  if (saved) start(saved.level, saved);
  else {
    generateAsync(opts).then(level => {
      if (!alive) return;
      stats.recordStart();
      remove(SAVE_KEY); // a new game replaces any unfinished one
      start(level);
    });
  }

  function start(level, resume) {
    const { n, start: startMasks, source } = level;
    const N = n * n;
    // turns: quarter-turns clockwise from the starting position, kept whole (not wrapped to 0-3)
    // so each tap animates forward and each undo animates back.
    let turns = resume ? resume.turns.slice() : new Array(N).fill(0);
    let locked = resume ? resume.locked.slice() : new Array(N).fill(0);
    let history = resume ? resume.history || [] : [];
    let acc = resume ? resume.acc : 0, over = false, last = Date.now();
    let prevWet = null, W = 0;

    const countEl = h('div', { class: 'pp-count' });
    const hintEl = h('div', { class: 'pp-hint muted' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'pp-board');
    svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
    const controls = h('div', { class: 'controls' },
      h('button', { class: 'btn', onclick: () => undo() }, 'Undo'),
      h('button', { class: 'btn', onclick: () => restart() }, 'Restart'));
    stage.classList.add('pp-stage');
    stage.replaceChildren(controls, countEl, hintEl, svg);

    // Each tile is built once; taps only change its rotation and wet state, so turns animate.
    const NS = 'http://www.w3.org/2000/svg';
    const tileLayer = document.createElementNS(NS, 'g');
    const overLayer = document.createElementNS(NS, 'g');
    overLayer.setAttribute('pointer-events', 'none');
    svg.append(tileLayer, overLayer);
    const tiles = [], rots = [];
    for (let i = 0; i < N; i++) {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', `translate(${(i % n) + 0.5} ${Math.floor(i / n) + 0.5})`);
      const r = document.createElementNS(NS, 'g');
      r.setAttribute('class', 'pp-rot');
      r.innerHTML = pieceSvg(startMasks[i]);
      g.append(r);
      tileLayer.append(g);
      tiles.push(g); rots.push(r);
    }

    const size = () => {
      W = Math.floor(Math.min(viewWidth() - 32, 528, Math.max(260, viewHeight() - 250)));
      svg.setAttribute('width', W);
      svg.setAttribute('height', W);
    };

    function render(animate = true) {
      const masks = currentMasks(level, turns);
      const f = flow(n, masks, source);
      let plants = 0, wetPlants = 0, dry = 0, over_ = '';
      for (let i = 0; i < N; i++) {
        const wet = !!f.wet[i];
        if (!wet) dry++;
        // Water spreads outward from the tap, one pipe after another.
        const newly = wet && animate && prevWet && !prevWet[i];
        tiles[i].style.setProperty('--d', newly ? `${120 + f.dist[i] * 35}ms` : '0ms');
        tiles[i].classList.toggle('wet', wet);
        tiles[i].classList.toggle('locked', !!locked[i]);
        rots[i].style.transform = `rotate(${turns[i] * 90}deg)`;
        const x = (i % n) + 0.5, y = Math.floor(i / n) + 0.5;
        if (i === source) over_ += tapSvg(x, y);
        else if (degree(masks[i]) === 1) {
          plants++;
          if (wet) wetPlants++;
          over_ += plantSvg(x, y, wet, PETALS[(i * 7) % PETALS.length], newly ? 120 + f.dist[i] * 35 : 0);
        }
      }
      for (const [i, d] of f.leaks) over_ += leakSvg((i % n) + 0.5 + DC[d] * 0.47, Math.floor(i / n) + 0.5 + DR[d] * 0.47);
      overLayer.innerHTML = over_;
      prevWet = f.wet;
      countEl.textContent = `${wetPlants}/${plants}`;
      const leaks = f.leaks.length;
      hintEl.textContent = !dry && leaks ? `Every pipe has water, but ${leaks === 1 ? '1 end is' : `${leaks} ends are`} leaking`
        : wetPlants === plants && dry ? `Every plant has water, but ${dry === 1 ? '1 pipe is' : `${dry} pipes are`} still dry` : '';
      if (!over && !dry && !leaks) finish();
    }

    // --- Tapping and holding ---
    const cellAt = e => {
      const r = svg.getBoundingClientRect(), z = zoom();
      const x = (e.clientX - r.left) / z, y = (e.clientY - r.top) / z, cs = W / n;
      const col = Math.floor(x / cs), row = Math.floor(y / cs);
      return col < 0 || row < 0 || col >= n || row >= n ? null : row * n + col;
    };
    let press = null;
    svg.addEventListener('pointerdown', e => {
      if (over || press) return;
      const i = cellAt(e);
      if (i == null) return;
      e.preventDefault();
      press = { i, id: e.pointerId, x: e.clientX, y: e.clientY, done: false };
      // Holding a piece locks it (or unlocks it), so it can't be turned by mistake.
      press.timer = setTimeout(() => {
        if (!press) return;
        press.done = true;
        history.push({ lock: press.i });
        locked[press.i] = locked[press.i] ? 0 : 1;
        if (navigator.vibrate) navigator.vibrate(15);
        render();
      }, HOLD_MS);
    });
    svg.addEventListener('pointermove', e => {
      if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) {
        clearTimeout(press.timer);
        press = null;
      }
    });
    const release = e => {
      if (!press || e.pointerId !== press.id) return;
      clearTimeout(press.timer);
      const p = press;
      press = null;
      if (e.type !== 'pointerup' || p.done || over) return;
      if (locked[p.i]) {
        tiles[p.i].classList.remove('nudge');
        void tiles[p.i].getBBox();
        tiles[p.i].classList.add('nudge');
        return;
      }
      turns[p.i]++;
      history.push({ turn: p.i });
      if (history.length > 400) history.shift();
      render();
    };
    svg.addEventListener('pointerup', release);
    svg.addEventListener('pointercancel', release);
    svg.addEventListener('contextmenu', e => e.preventDefault());

    function undo() {
      if (over || !history.length) return;
      const step = history.pop();
      if (step.reset) { turns = step.reset.turns; locked = step.reset.locked; }
      else if (step.lock != null) locked[step.lock] = locked[step.lock] ? 0 : 1;
      else turns[step.turn]--;
      render(false);
    }
    function restart() {
      if (over || (turns.every(t => t === 0) && locked.every(l => !l))) return;
      history.push({ reset: { turns: turns.slice(), locked: locked.slice() } });
      // Turn back to the start the short way, so the tiles don't spin round and round.
      turns = turns.map(t => {
        const r = ((t % 4) + 4) % 4;
        return r === 3 ? t + 1 : t - r;
      });
      locked = new Array(N).fill(0);
      render(false);
    }

    const nextHref = () => `${mode === 'custom' ? customHref(opts) : `${HOME}/play?mode=random`}&k=${Date.now()}`;
    function finish() {
      over = true;
      remove(SAVE_KEY);
      playtimer.stop();
      controls.hidden = true;
      svg.classList.add('won');
      const seconds = Math.round(acc / 1000);
      stats.recordWin({ s: seconds, m: mode, d: opts.difficulty, n });
      setTimeout(() => stage.append(h('div', { class: 'win card' },
        h('h2', {}, 'Garden watered'),
        h('p', { class: 'win-time' }, fmtTime(seconds)),
        h('div', { class: 'row-btns' },
          h('a', { class: 'btn big', href: nextHref() }, 'Next level'),
          h('a', { class: 'btn big ghost', href: HOME }, 'Menu')))), 900);
    }

    const clock = setInterval(() => {
      const now = Date.now();
      if (!document.hidden && !over) acc += Math.max(0, now - last);
      last = now;
      timerEl.textContent = fmtTime(Math.floor(acc / 1000));
    }, 250);
    cleanups.push(() => clearInterval(clock));
    cleanups.push(autosave(() => { if (!over) save(SAVE_KEY, { mode, opts, level, turns, locked, history: history.slice(-100), acc }); }));

    size();
    render(false);
    window.addEventListener('resize', size);
    cleanups.push(() => window.removeEventListener('resize', size));
    playtimer.start();
  }

  return { unmount() { alive = false; cleanups.forEach(fn => fn()); } };
}
