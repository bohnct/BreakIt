import { h, header, toast, fmtTime } from '../../js/ui.js';
import * as playtimer from '../../js/playtimer.js';
import { generate, DIFFICULTIES } from './generator.js';
import { recordStart, recordWin } from './stats.js';

const HOME = '#/game/pans';
const EMPTY = 0, CROSS = 1, PAN = 2;
// coolors.co/palette/f94144-f3722c-f8961e-f9c74f-90be6d-43aa8b-577590,
// topped up from the same palette's 10-colour version for grids above 7×7.
const PALETTE = ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'];
const EXTRA = ['#f9844a', '#4d908e', '#277da1'];

const PAN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9.5" cy="14" r="7" fill="currentColor"/><circle cx="9.5" cy="14" r="4.6" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/><path d="M14.8 8.7 21 2.5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>';
const CROSS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

const cap = s => s[0].toUpperCase() + s.slice(1);
const pick = a => a[Math.floor(Math.random() * a.length)];

function shuffled(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Several palette colours are close (the oranges, the teals), so pick the colour order
// that keeps similar shades away from bordering regions.
function assignColours(n, regions) {
  const palette = n <= PALETTE.length ? PALETTE : [...PALETTE, ...EXTRA.slice(0, n - PALETTE.length)];
  const rgb = palette.map(c => [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16)));
  const near = palette.map((_, a) => palette.map((_, b) => {
    const d = Math.hypot(...rgb[a].map((v, k) => v - rgb[b][k]));
    return a !== b && d < 90 ? 90 - d : 0;
  }));
  const pairs = new Set();
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n;
    for (const j of [r < n - 1 && i + n, c < n - 1 && i + 1]) {
      if (j !== false && regions[i] !== regions[j]) pairs.add(Math.min(regions[i], regions[j]) * n + Math.max(regions[i], regions[j]));
    }
  }
  const adj = [...pairs].map(p => [Math.floor(p / n), p % n]);
  let best = null, bestScore = Infinity;
  for (let t = 0; t < 400 && bestScore > 0; t++) {
    const order = shuffled([...palette.keys()]);
    const score = adj.reduce((s, [a, b]) => s + near[order[a]][order[b]], 0);
    if (score < bestScore) { best = order; bestScore = score; }
  }
  return best.map(k => palette[k]);
}

// Generate off the main thread so the loading screen stays responsive; fall back if workers fail.
function generateAsync(n, difficulty) {
  return new Promise(resolve => {
    const fallback = () => setTimeout(() => resolve(generate(n, difficulty)), 30);
    let worker;
    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    } catch {
      return fallback();
    }
    worker.onmessage = e => { worker.terminate(); resolve(e.data); };
    worker.onerror = () => { worker.terminate(); fallback(); };
    worker.postMessage({ n, difficulty });
  });
}

export function mountBoard(el, query) {
  const mode = query.get('mode') === 'custom' ? 'custom' : 'random';
  let n, difficulty;
  if (mode === 'custom') {
    n = Math.min(10, Math.max(5, parseInt(query.get('n'), 10) || 7));
    difficulty = DIFFICULTIES.includes(query.get('d')) ? query.get('d') : 'medium';
  } else {
    n = 5 + Math.floor(Math.random() * 5);
    difficulty = pick(DIFFICULTIES);
  }

  let alive = true;
  const cleanups = [];
  const timerEl = h('span', { class: 'timer' }, '0:00');
  const bar = header(`${n}×${n} · ${cap(difficulty)}`, HOME);
  bar.querySelector('.bar-right').append(timerEl);
  const limitEl = h('div', { class: 'limit muted' });
  const stage = h('div', { class: 'stage' }, h('div', { class: 'loading' }, h('div', { class: 'spinner' }), 'Carter is hiding the pans…'));
  el.append(bar, limitEl, stage);

  const showLimit = rem => {
    limitEl.textContent = rem == null ? '' : `Play time left ${fmtTime(rem / 1000)}`;
  };
  showLimit(playtimer.remainingMs());

  generateAsync(n, difficulty).then(puzzle => {
    if (!alive) return;
    recordStart();
    startGame(puzzle);
  });

  function startGame(puzzle) {
    const { regions, solution } = puzzle;
    const N = n * n;
    const colours = assignColours(n, regions);
    const isSolution = i => solution[Math.floor(i / n)] === i % n;
    const state = new Uint8Array(N);
    const history = [];
    let seconds = 0, hints = 0, won = false;

    playtimer.start();
    cleanups.push(playtimer.onTick(showLimit));

    let last = Date.now(), acc = 0;
    const clock = setInterval(() => {
      const now = Date.now();
      if (!document.hidden && !won) acc += now - last;
      last = now;
      seconds = Math.floor(acc / 1000);
      timerEl.textContent = fmtTime(seconds);
    }, 250);
    const onVis = () => { last = Date.now(); };
    document.addEventListener('visibilitychange', onVis);
    cleanups.push(() => { clearInterval(clock); document.removeEventListener('visibilitychange', onVis); });

    const grid = h('div', { class: 'grid', style: `--n:${n}`, role: 'grid', 'aria-label': 'Puzzle grid' });
    const cells = [];
    for (let i = 0; i < N; i++) {
      const r = Math.floor(i / n), c = i % n;
      const style = [`background:${colours[regions[i]]}`];
      if (r > 0) style.push(regions[i - n] !== regions[i] ? 'border-top:3px solid #000' : 'border-top:1px solid rgba(0,0,0,.28)');
      if (c > 0) style.push(regions[i - 1] !== regions[i] ? 'border-left:3px solid #000' : 'border-left:1px solid rgba(0,0,0,.28)');
      const cell = h('div', { class: 'cell', 'data-i': i, role: 'gridcell', style: style.join(';') });
      cells.push(cell);
      grid.append(cell);
    }

    const draw = () => {
      // Conflicts: two pans sharing a row, column or region, or touching.
      const bad = new Set();
      const pans = [];
      for (let i = 0; i < N; i++) if (state[i] === PAN) pans.push(i);
      for (let a = 0; a < pans.length; a++) {
        for (let b = a + 1; b < pans.length; b++) {
          const i = pans[a], j = pans[b];
          const ri = Math.floor(i / n), ci = i % n, rj = Math.floor(j / n), cj = j % n;
          if (ri === rj || ci === cj || regions[i] === regions[j] || (Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1)) {
            bad.add(i); bad.add(j);
          }
        }
      }
      for (let i = 0; i < N; i++) {
        const cell = cells[i];
        const want = state[i] === PAN ? PAN_SVG : state[i] === CROSS ? CROSS_SVG : '';
        if (cell.dataset.s !== String(state[i])) {
          cell.innerHTML = want;
          cell.dataset.s = state[i];
        }
        cell.classList.toggle('bad', bad.has(i));
      }
      if (!won && pans.length === n && bad.size === 0) win();
    };

    const apply = batch => {
      if (!batch.length) return;
      history.push(batch);
      draw();
    };
    const set = (i, v, batch) => {
      if (state[i] === v) return;
      batch.push({ i, prev: state[i] });
      state[i] = v;
    };

    // Tap cycles empty → ✕ → pan → empty; dragging from a square marks ✕ on empty squares.
    let press = null;
    const cellAt = e => {
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cell');
      return t && grid.contains(t) ? +t.dataset.i : null;
    };
    grid.addEventListener('pointerdown', e => {
      if (won) return;
      const i = cellAt(e);
      if (i == null) return;
      e.preventDefault();
      grid.setPointerCapture(e.pointerId);
      press = { i, last: i, drag: false, batch: [] };
    });
    grid.addEventListener('pointermove', e => {
      if (!press) return;
      const j = cellAt(e);
      if (j == null || j === press.last) return;
      if (!press.drag) {
        press.drag = true;
        if (state[press.i] === EMPTY) set(press.i, CROSS, press.batch);
      }
      // Fast swipes skip cells between pointer events, so fill in the path.
      const r0 = Math.floor(press.last / n), c0 = press.last % n, r1 = Math.floor(j / n), c1 = j % n;
      const steps = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
      for (let s = 1; s <= steps; s++) {
        const k = Math.round(r0 + (r1 - r0) * s / steps) * n + Math.round(c0 + (c1 - c0) * s / steps);
        if (state[k] === EMPTY) set(k, CROSS, press.batch);
      }
      press.last = j;
      draw();
    });
    const release = () => {
      if (!press) return;
      if (press.drag) {
        if (press.batch.length) history.push(press.batch);
      } else {
        const batch = [];
        set(press.i, (state[press.i] + 1) % 3, batch);
        apply(batch);
      }
      press = null;
      draw();
    };
    grid.addEventListener('pointerup', release);
    grid.addEventListener('pointercancel', release);

    const undo = () => {
      const batch = history.pop();
      if (!batch || won) return;
      for (let k = batch.length - 1; k >= 0; k--) state[batch[k].i] = batch[k].prev;
      draw();
    };
    const clear = () => {
      if (won) return;
      const batch = [];
      for (let i = 0; i < N; i++) set(i, EMPTY, batch);
      apply(batch);
    };
    const flash = i => {
      cells[i].classList.remove('flash');
      void cells[i].offsetWidth;
      cells[i].classList.add('flash');
    };
    const hint = () => {
      if (won) return;
      for (let i = 0; i < N; i++) {
        if ((state[i] === PAN && !isSolution(i)) || (state[i] === CROSS && isSolution(i))) {
          flash(i);
          toast(state[i] === PAN ? 'No pan there' : 'Look under that ✕');
          return;
        }
      }
      const rows = shuffled([...Array(n).keys()]).filter(r => state[r * n + solution[r]] !== PAN);
      if (!rows.length) return;
      const i = rows[0] * n + solution[rows[0]];
      hints++;
      const batch = [];
      set(i, PAN, batch);
      apply(batch);
      flash(i);
    };

    function win() {
      won = true;
      playtimer.stop();
      recordWin({ n, d: difficulty, s: seconds, m: mode, hints });
      grid.classList.add('won');
      stage.querySelector('.controls')?.remove();
      const nextHref = mode === 'custom'
        ? `${HOME}/play?mode=custom&n=${n}&d=${difficulty}&k=${Date.now()}`
        : `${HOME}/play?mode=random&k=${Date.now()}`;
      stage.append(h('div', { class: 'win card' },
        h('h2', {}, 'Found them all'),
        h('p', { class: 'win-time' }, fmtTime(seconds)),
        hints ? h('p', { class: 'muted' }, `${hints} hint${hints > 1 ? 's' : ''} used`) : null,
        h('div', { class: 'row-btns' },
          h('a', { class: 'btn big', href: nextHref }, 'Next level'),
          h('a', { class: 'btn big ghost', href: HOME }, 'Menu'))));
    }

    stage.replaceChildren(
      grid,
      h('div', { class: 'controls' },
        h('button', { class: 'btn', onclick: undo }, 'Undo'),
        h('button', { class: 'btn', onclick: clear }, 'Clear'),
        h('button', { class: 'btn', onclick: hint }, 'Hint')));
    draw();
  }

  return {
    unmount() {
      alive = false;
      cleanups.forEach(fn => fn());
    },
  };
}
