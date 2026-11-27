import { h, header, fmtTime, viewWidth, viewHeight, zoom } from '../../js/ui.js';
import { load, save, remove } from '../../js/storage.js';
import * as playtimer from '../../js/playtimer.js';
import { autosave } from '../../js/autosave.js';
import { generateLevel, DIFFICULTIES, SIZES } from './engine.js';
import { stats } from './stats.js';

const HOME = '#/game/links';
const SAVE_KEY = 'games.links.saved';
// Random levels: board sizes by difficulty, with a bigger board now and then.
const RANDOM_SIZES = { easy: [5, 5, 6, 6, 7], medium: [6, 7, 7, 7, 8], hard: [7, 8, 8, 8, 9] };

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

// A pair is linked when its path runs from one of its dots to the other.
export const linked = (level, paths) => paths.filter((p, c) => p.length > 1 && level.ends[c].includes(p[0]) && level.ends[c].includes(p[p.length - 1])).length;

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
  const stage = h('div', { class: 'stage' }, h('div', { class: 'loading' }, h('div', { class: 'spinner' }), 'Laying out the colours…'));
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
    const { n, ends, colours } = level;
    const N = n * n, K = ends.length;
    const endAt = new Int16Array(N).fill(-1);
    ends.forEach(([a, b], c) => { endAt[a] = c; endAt[b] = c; });
    let paths = resume ? resume.paths : ends.map(() => []);
    let history = resume ? resume.history || [] : [];
    let acc = resume ? resume.acc : 0, over = false, drag = null, last = Date.now();
    let W = 0;

    const countEl = h('div', { class: 'lk-count' });
    const hintEl = h('div', { class: 'lk-hint muted' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'lk-board');
    svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
    const controls = h('div', { class: 'controls' },
      h('button', { class: 'btn', onclick: () => undo() }, 'Undo'),
      h('button', { class: 'btn', onclick: () => restart() }, 'Restart'));
    stage.classList.add('lk-stage');
    stage.replaceChildren(controls, countEl, hintEl, svg);

    const size = () => {
      W = Math.floor(Math.min(viewWidth() - 32, 528, Math.max(260, viewHeight() - 250)));
      svg.setAttribute('width', W);
      svg.setAttribute('height', W);
    };

    const ownerMap = () => {
      const own = new Int16Array(N).fill(-1);
      paths.forEach((p, c) => p.forEach(i => { own[i] = c; }));
      return own;
    };
    const isLinked = c => {
      const p = paths[c];
      return p.length > 1 && endAt[p[0]] === c && endAt[p[p.length - 1]] === c;
    };

    function render() {
      const own = ownerMap();
      const covered = i => own[i] >= 0 && paths[own[i]].length > 1;
      let done = 0, filled = 0;
      for (let c = 0; c < K; c++) if (isLinked(c)) done++;
      for (let i = 0; i < N; i++) if (covered(i)) filled++;
      // Every pair joined but squares left over: the level isn't solved yet, so point at the gaps.
      const gaps = done === K && filled < N && !drag;
      let out = '';
      for (let i = 0; i < N; i++) {
        const x = i % n, y = Math.floor(i / n);
        out += `<rect x="${x + 0.05}" y="${y + 0.05}" width=".9" height=".9" rx=".18" fill="var(--tile)"/>`;
        // A faint wash of the path's colour on every square it covers, so gaps stand out.
        if (covered(i)) out += `<rect x="${x + 0.05}" y="${y + 0.05}" width=".9" height=".9" rx=".18" fill="${colours[own[i]]}" fill-opacity=".24"/>`;
        else if (gaps) out += `<rect class="lk-gap" x="${x + 0.1}" y="${y + 0.1}" width=".8" height=".8" rx=".15" fill="none" stroke="var(--fg)" stroke-width=".06"/>`;
      }
      paths.forEach((p, c) => {
        if (p.length < 2) return;
        const pts = p.map(i => `${(i % n) + 0.5},${Math.floor(i / n) + 0.5}`).join(' ');
        out += `<polyline points="${pts}" fill="none" stroke="${colours[c]}" stroke-width=".34" stroke-linecap="round" stroke-linejoin="round"/>`;
      });
      ends.forEach(([a, b], c) => {
        for (const i of [a, b]) out += `<circle cx="${(i % n) + 0.5}" cy="${Math.floor(i / n) + 0.5}" r=".34" fill="${colours[c]}"/>`;
      });
      svg.innerHTML = out;
      countEl.textContent = `${done}/${K}`;
      hintEl.textContent = gaps ? `All joined, but ${N - filled === 1 ? '1 square is' : `${N - filled} squares are`} still empty` : '';
      if (!over && !drag && done === K && filled === N) finish();
    }

    // --- Drawing ---
    const cellAt = e => {
      const r = svg.getBoundingClientRect(), z = zoom();
      const x = (e.clientX - r.left) / z, y = (e.clientY - r.top) / z, cs = W / n;
      const col = Math.floor(x / cs), row = Math.floor(y / cs);
      return col < 0 || row < 0 || col >= n || row >= n ? null : row * n + col;
    };
    // The drawn path takes over any squares it crosses: other paths are cut short there. Working
    // from the paths as they were when the finger went down means a cut path comes back if the
    // finger backs off again.
    const apply = () => {
      const mine = new Set(drag.cur);
      paths = drag.base.map((p, d) => {
        if (d === drag.c) return drag.cur.slice();
        const k = p.findIndex(i => mine.has(i));
        return k < 0 ? p : p.slice(0, k);
      });
      render();
    };
    // Try to add square x to the path being drawn. Returns false if it can't go there.
    const extend = x => {
      const cur = drag.cur, c = drag.c, end = cur[cur.length - 1];
      if (Math.abs(x - end) !== n && !(Math.abs(x - end) === 1 && Math.floor(x / n) === Math.floor(end / n))) return false;
      const k = cur.indexOf(x);
      if (k >= 0) { cur.length = k + 1; return true; } // backing up
      if (cur.length > 1 && endAt[end] === c) return false; // already joined
      if (endAt[x] >= 0 && endAt[x] !== c) return false; // another colour's dot
      cur.push(x);
      return true;
    };
    // One square from a toward b, along the longer direction first, then the other.
    const steps = (a, b) => {
      const ra = Math.floor(a / n), ca = a % n, rb = Math.floor(b / n), cb = b % n;
      const v = rb === ra ? null : a + Math.sign(rb - ra) * n, hz = cb === ca ? null : a + Math.sign(cb - ca);
      return (Math.abs(rb - ra) >= Math.abs(cb - ca) ? [v, hz] : [hz, v]).filter(x => x != null);
    };

    svg.addEventListener('pointerdown', e => {
      if (over) return;
      const i = cellAt(e);
      if (i == null) return;
      const own = ownerMap();
      const c = endAt[i] >= 0 ? endAt[i] : own[i];
      if (c < 0) return;
      e.preventDefault();
      svg.setPointerCapture(e.pointerId);
      const base = paths.map(p => p.slice());
      // Start fresh from a dot, or carry on from any square of an existing path.
      const cur = endAt[i] === c ? [i] : paths[c].slice(0, paths[c].indexOf(i) + 1);
      drag = { c, base, cur };
      apply();
    });
    svg.addEventListener('pointermove', e => {
      if (!drag) return;
      const j = cellAt(e);
      if (j == null) return;
      // Fast swipes skip squares between events, so walk there one square at a time.
      for (let guard = 0; guard < 2 * n && drag.cur[drag.cur.length - 1] !== j; guard++) {
        if (!steps(drag.cur[drag.cur.length - 1], j).some(extend)) break;
      }
      apply();
    });
    const release = () => {
      if (!drag) return;
      const before = JSON.stringify(drag.base);
      if (JSON.stringify(paths) !== before) {
        history.push(drag.base);
        if (history.length > 200) history.shift();
      }
      drag = null;
      render();
    };
    svg.addEventListener('pointerup', release);
    svg.addEventListener('pointercancel', release);

    function undo() {
      if (over || !history.length) return;
      paths = history.pop();
      render();
    }
    function restart() {
      if (over || paths.every(p => p.length < 2)) return;
      history.push(paths);
      paths = ends.map(() => []);
      render();
    }

    const nextHref = () => `${mode === 'custom' ? customHref(opts) : `${HOME}/play?mode=random`}&k=${Date.now()}`;
    function finish() {
      over = true;
      remove(SAVE_KEY);
      playtimer.stop();
      controls.hidden = true;
      const seconds = Math.round(acc / 1000);
      stats.recordWin({ s: seconds, m: mode, d: opts.difficulty, n });
      setTimeout(() => stage.append(h('div', { class: 'win card' },
        h('h2', {}, 'All linked'),
        h('p', { class: 'win-time' }, fmtTime(seconds)),
        h('div', { class: 'row-btns' },
          h('a', { class: 'btn big', href: nextHref() }, 'Next level'),
          h('a', { class: 'btn big ghost', href: HOME }, 'Menu')))), 500);
    }

    const clock = setInterval(() => {
      const now = Date.now();
      if (!document.hidden && !over) acc += Math.max(0, now - last);
      last = now;
      timerEl.textContent = fmtTime(Math.floor(acc / 1000));
    }, 250);
    cleanups.push(() => clearInterval(clock));
    cleanups.push(autosave(() => { if (!over) save(SAVE_KEY, { mode, opts, level, paths, history: history.slice(-50), acc }); }));

    size();
    render();
    window.addEventListener('resize', size);
    cleanups.push(() => window.removeEventListener('resize', size));
    playtimer.start();
  }

  return { unmount() { alive = false; cleanups.forEach(fn => fn()); } };
}
