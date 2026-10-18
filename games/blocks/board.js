import { h, header, fmtTime, viewWidth, viewHeight, zoom } from '../../js/ui.js';
import { load, save, remove } from '../../js/storage.js';
import { SORT_COLOURS } from '../../js/colours.js';
import * as playtimer from '../../js/playtimer.js';
import { autosave } from '../../js/autosave.js';
import { generateLevel, maxBlocks, buildOcc, fits, setOcc, doorAt, stepsFor, FREE, DIFFICULTIES } from './engine.js';
import { stats } from './stats.js';

const HOME = '#/game/blocks';
const SAVE_KEY = 'games.blocks.saved';
const PAD = 14; // frame padding in px; doors sit inside it
const DOOR = 8; // door thickness in px
// Colours from the same coolors palette, ordered so the first few are easy to tell apart.
const COLOURS = SORT_COLOURS; // high-contrast set, see js/colours.js
export const SIZES = [[5, 5], [6, 6], [6, 8], [7, 7], [7, 9], [8, 8], [8, 10], [9, 11]];
// Random levels: harder means a bigger board, packed fuller.
const RANDOM_SIZES = { medium: [[6, 8], [7, 7], [7, 9]], hard: [[8, 8], [8, 10], [9, 11]] };
const RANDOM_FILL = { medium: [0.8, 0.95], hard: [1, 1] };
export const OBSTACLES = [
  { value: 'arrows', label: 'Arrows', key: 'a' },
  { value: 'ice', label: 'Ice', key: 'i' },
  { value: 'layers', label: 'Layers', key: 'l' },
  { value: 'walls', label: 'Walls', key: 'w' },
];

const ARROW = {
  h: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  v: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export const getSavedGame = () => load(SAVE_KEY, null);

export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');

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

const shuffled = a => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Level settings from the URL (custom) or picked at random.
export function optsFromQuery(query) {
  if (query.get('mode') !== 'custom') {
    const difficulty = Math.random() < 0.5 ? 'medium' : 'hard';
    const sizes = RANDOM_SIZES[difficulty], [lo, hi] = RANDOM_FILL[difficulty];
    const [w, hgt] = sizes[Math.floor(Math.random() * sizes.length)];
    const blocks = Math.max(4, Math.round(maxBlocks(w, hgt) * (lo + Math.random() * (hi - lo))));
    const o = {
      w, h: hgt, blocks, difficulty,
      colours: Math.min(blocks, difficulty === 'hard' ? 4 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 3)),
    };
    for (const ob of OBSTACLES) o[ob.value] = Math.random() < 0.35;
    return o;
  }
  const [w, hgt] = SIZES.find(([a, b]) => `${a}x${b}` === query.get('s')) || SIZES[2];
  const max = maxBlocks(w, hgt);
  const blocks = Math.min(max, Math.max(3, parseInt(query.get('b'), 10) || max));
  const o = {
    w, h: hgt, blocks,
    colours: Math.min(blocks, 6, Math.max(2, parseInt(query.get('c'), 10) || 4)),
    difficulty: DIFFICULTIES.includes(query.get('d')) ? query.get('d') : 'medium',
  };
  const ob = query.get('o') || '';
  for (const x of OBSTACLES) o[x.value] = ob.includes(x.key);
  return o;
}

export function customHref(o) {
  const ob = OBSTACLES.filter(x => o[x.value]).map(x => x.key).join('');
  return `${HOME}/play?mode=custom&s=${o.w}x${o.h}&b=${o.blocks}&c=${o.colours}&d=${o.difficulty}&o=${ob}`;
}

export function mountBoard(el, query) {
  const saved = query.get('resume') ? getSavedGame() : null;
  if (saved) remove(SAVE_KEY);
  const mode = saved ? saved.mode : query.get('mode') === 'custom' ? 'custom' : 'random';
  const opts = saved ? saved.opts : optsFromQuery(query);

  let alive = true;
  const cleanups = [];
  const timerEl = h('span', { class: 'timer' }, '');
  const bar = header(`${opts.w}×${opts.h}`, HOME);
  bar.querySelector('.bar-right').append(timerEl);
  const limitEl = h('div', { class: 'limit muted' });
  const stage = h('div', { class: 'stage' }, h('div', { class: 'loading' }, h('div', { class: 'spinner' }), 'Kelsey is boxing you in…'));
  el.append(bar, limitEl, stage);

  const showLimit = rem => { limitEl.textContent = rem == null ? '' : `Play time left ${fmtTime(rem / 1000)}`; };
  showLimit(playtimer.remainingMs());

  if (saved) {
    start(saved.level, saved.palette, saved);
  } else {
    generateAsync(opts).then(level => {
      if (!alive) return;
      stats.recordStart();
      remove(SAVE_KEY); // a new game replaces any unfinished one
      start(level, shuffled(COLOURS).slice(0, opts.colours));
    });
  }

  function start(level, palette, resume) {
    const { w, h: H } = level;
    bar.querySelector('h1').textContent = `${w}×${H} · ${cap(level.difficulty)}`;

    let blocks, occ, cleared, acc, over, history, drag = null;
    const els = [];

    const frame = h('div', { class: 'bj-frame' });
    const floor = h('div', { class: 'bj-floor', style: `width:calc(var(--cell) * ${w});height:calc(var(--cell) * ${H})` });
    frame.append(floor);

    const sizeBoard = () => {
      const availW = Math.min(viewWidth() - 32, 528) - 2 * PAD - 4;
      const availH = viewHeight() - 250 - 2 * PAD;
      frame.style.setProperty('--cell', `${Math.max(26, Math.floor(Math.min(availW / w, availH / H)))}px`);
    };
    sizeBoard();
    window.addEventListener('resize', sizeBoard);
    cleanups.push(() => window.removeEventListener('resize', sizeBoard));
    const cellPx = () => parseFloat(frame.style.getPropertyValue('--cell'));

    const walls = new Set(level.walls);
    // Floor tiles, and hatched walls (squares no block can move into).
    for (let i = 0; i < w * H; i++) {
      floor.append(h('div', { class: walls.has(i) ? 'bj-tile bj-wall' : 'bj-tile', style: `left:calc(var(--cell) * ${i % w});top:calc(var(--cell) * ${Math.floor(i / w)})` }));
    }
    for (const d of level.doors) {
      const along = `calc(var(--cell) * ${d.at} + 4px)`, len = `calc(var(--cell) * ${d.len} - 8px)`;
      const off = PAD - DOOR - 2;
      const pos = {
        t: `left:${along};top:-${PAD - off}px;width:${len};height:${DOOR}px`,
        b: `left:${along};bottom:-${PAD - off}px;width:${len};height:${DOOR}px`,
        l: `top:${along};left:-${PAD - off}px;height:${len};width:${DOOR}px`,
        r: `top:${along};right:-${PAD - off}px;height:${len};width:${DOOR}px`,
      }[d.side];
      floor.append(h('div', { class: 'bj-door', style: `${pos};background:${palette[d.colour]}` }));
    }
    const blockLayer = h('div', { class: 'bj-blocks' });
    floor.append(blockLayer);

    const place = (el, b) => {
      el.style.transform = `translate(calc(var(--cell) * ${b.x}), calc(var(--cell) * ${b.y}))`;
    };

    const paint = id => {
      const b = blocks[id], el = els[id];
      el.style.setProperty('--c', palette[b.colour]);
      el.style.setProperty('--ci', b.inner == null ? 'transparent' : palette[b.inner]);
      el.classList.toggle('layered', b.inner != null);
      const ice = Math.max(0, b.ice - cleared);
      el.classList.toggle('iced', ice > 0);
      el.querySelector('.bj-ice').textContent = ice || '';
    };

    const makeBlock = id => {
      const b = blocks[id];
      const has = new Set(b.cells.map(([x, y]) => `${x},${y}`));
      const el = h('div', { class: 'bj-block', 'data-id': id });
      b.cells.forEach(([cx, cy], k) => {
        // Joined sides touch so the block reads as one piece; open sides get a gap and
        // rounded outer corners.
        const open = [!has.has(`${cx},${cy - 1}`), !has.has(`${cx + 1},${cy}`), !has.has(`${cx},${cy + 1}`), !has.has(`${cx - 1},${cy}`)];
        const g = open.map(o => (o ? 3 : 0));
        const r = (a, c) => (open[a] && open[c] ? 'var(--r-block)' : '0');
        // Inside corners (an L's bend): this cell is joined on both sides but the diagonal cell
        // isn't in the block. Its neighbours stop 3px short there, so trim the same 3px square
        // off this cell's corner or it pokes out as a little notch.
        const inner = (dx, dy) => has.has(`${cx + dx},${cy}`) && has.has(`${cx},${cy + dy}`) && !has.has(`${cx + dx},${cy + dy}`);
        const G = 3, e = `calc(100% - ${G}px)`;
        const pts = [
          ...(inner(-1, -1) ? [`0 ${G}px`, `${G}px ${G}px`, `${G}px 0`] : ['0 0']),
          ...(inner(1, -1) ? [`${e} 0`, `${e} ${G}px`, `100% ${G}px`] : ['100% 0']),
          ...(inner(1, 1) ? [`100% ${e}`, `${e} ${e}`, `${e} 100%`] : ['100% 100%']),
          ...(inner(-1, 1) ? [`${G}px 100%`, `${G}px ${e}`, `0 ${e}`] : ['0 100%']),
        ];
        const clip = pts.length > 4 ? `polygon(${pts.join(', ')})` : '';
        const cell = h('div', {
          class: 'bj-cell',
          style: `left:calc(var(--cell) * ${cx} + ${g[3]}px);top:calc(var(--cell) * ${cy} + ${g[0]}px);` +
            `width:calc(var(--cell) - ${g[1] + g[3]}px);height:calc(var(--cell) - ${g[0] + g[2]}px);` +
            `border-radius:${r(0, 3)} ${r(0, 1)} ${r(2, 1)} ${r(2, 3)}` +
            (clip ? `;-webkit-clip-path:${clip};clip-path:${clip}` : ''),
        });
        cell.append(h('span', { class: 'bj-stud', html: b.axis ? ARROW[b.axis] : null }));
        if (k === 0) cell.append(h('span', { class: 'bj-ice' }));
        el.append(cell);
      });
      place(el, b);
      return el;
    };

    const rebuild = () => {
      occ = buildOcc(level, blocks);
      blockLayer.replaceChildren();
      blocks.forEach((b, id) => {
        els[id] = makeBlock(id);
        if (!b.gone) blockLayer.append(els[id]);
        paint(id);
      });
    };

    const snapshot = () => ({ blocks: blocks.map(({ x, y, colour, inner, gone }) => ({ x, y, colour, inner, gone })), cleared });
    const restore = s => {
      blocks = level.blocks.map((b, id) => ({ ...b, gone: false, ...(s ? s.blocks[id] : {}) }));
      cleared = s ? s.cleared : 0;
      rebuild();
    };

    // Elapsed time, for stats.
    let last = Date.now();
    const showClock = () => { timerEl.textContent = fmtTime(Math.floor(acc / 1000)); };
    const clock = setInterval(() => {
      const now = Date.now();
      if (!document.hidden && !over) acc += Math.max(0, now - last);
      last = now;
      showClock();
    }, 200);
    const onVis = () => { last = Date.now(); };
    document.addEventListener('visibilitychange', onVis);
    cleanups.push(() => { clearInterval(clock); document.removeEventListener('visibilitychange', onVis); });
    cleanups.push(playtimer.onTick(showLimit));

    const reset = s => {
      restore(s?.state);
      acc = s?.acc ?? 0;
      last = Date.now();
      over = false;
      history = [];
      stage.querySelector('.win')?.remove();
      frame.classList.remove('done');
      controls.hidden = false;
      showClock();
      playtimer.start();
    };

    cleanups.push(autosave(() => {
      if (!over) save(SAVE_KEY, { mode, opts, level, palette, state: snapshot(), acc });
    }));

    // --- Moving blocks ---
    const exit = (id, door) => {
      const b = blocks[id], el = els[id];
      setOcc(level, occ, b, FREE);
      b.gone = true;
      cleared++;
      const span = Math.max(...b.cells.map(c => c[0])) + 2, spanY = Math.max(...b.cells.map(c => c[1])) + 2;
      const [dx, dy] = { t: [0, -spanY], b: [0, spanY], l: [-span, 0], r: [span, 0] }[door.side];
      el.classList.add('leaving');
      el.style.transform = `translate(calc(var(--cell) * ${b.x + dx}), calc(var(--cell) * ${b.y + dy}))`;
      setTimeout(() => el.remove(), 260);
      blocks.forEach((_, k) => { if (!blocks[k].gone) paint(k); });
      if (blocks.every(x => x.gone)) win();
    };

    // Returns true if the block left the board.
    const checkDoor = id => {
      const b = blocks[id];
      const door = doorAt(level, occ, b, id, b.x, b.y, b.colour);
      if (!door) return false;
      if (b.inner != null) {
        b.colour = b.inner;
        b.inner = null;
        paint(id);
        els[id].classList.remove('peel');
        void els[id].offsetWidth;
        els[id].classList.add('peel');
        return false;
      }
      exit(id, door);
      return true;
    };

    // Walk the block one cell at a time toward the finger, sliding along whatever is in the way.
    const moveToward = (id, tx, ty) => {
      const b = blocks[id];
      const allowed = stepsFor(b.axis);
      for (let k = 0; k < 40; k++) {
        const dx = Math.sign(tx - b.x), dy = Math.sign(ty - b.y);
        if (!dx && !dy) return false;
        const order = Math.abs(tx - b.x) >= Math.abs(ty - b.y) ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
        let stepped = false;
        for (const [mx, my] of order) {
          if (!mx && !my) continue;
          if (!allowed.some(([ax, ay]) => ax === mx && ay === my)) continue;
          if (!fits(level, occ, b, id, b.x + mx, b.y + my)) continue;
          setOcc(level, occ, b, FREE);
          b.x += mx;
          b.y += my;
          setOcc(level, occ, b, id);
          stepped = true;
          if (checkDoor(id)) return true;
          break;
        }
        if (!stepped) return false;
      }
      return false;
    };

    floor.addEventListener('pointerdown', e => {
      if (over || drag) return;
      const el = e.target.closest('.bj-block');
      if (!el || el.classList.contains('leaving')) return;
      const id = +el.dataset.id;
      e.preventDefault();
      if (blocks[id].ice > cleared) {
        el.classList.remove('shake');
        void el.offsetWidth;
        el.classList.add('shake');
        return;
      }
      floor.setPointerCapture(e.pointerId);
      drag = { id, sx: e.clientX, sy: e.clientY, ox: blocks[id].x, oy: blocks[id].y, snap: snapshot(), moved: false };
      el.classList.add('lift');
    });
    floor.addEventListener('pointermove', e => {
      const d = drag;
      if (!d) return;
      const cp = cellPx() * zoom(), b = blocks[d.id];
      const tx = d.ox + Math.round((e.clientX - d.sx) / cp);
      const ty = d.oy + Math.round((e.clientY - d.sy) / cp);
      const fromX = b.x, fromY = b.y;
      const left = moveToward(d.id, tx, ty);
      if (b.x !== fromX || b.y !== fromY || left) d.moved = true;
      if (left) return endDrag(d);
      place(els[d.id], b);
    });
    // The last block leaving ends the level, which clears `drag` first; finish this drag anyway.
    const endDrag = (d = drag) => {
      if (!d) return;
      if (d.moved && !over) history.push(d.snap);
      els[d.id].classList.remove('lift');
      drag = null;
    };
    floor.addEventListener('pointerup', () => endDrag());
    floor.addEventListener('pointercancel', () => endDrag());

    const undo = () => {
      if (over || !history.length) return;
      restore(history.pop());
    };

    function finish(card) {
      over = true;
      remove(SAVE_KEY);
      drag = null;
      playtimer.stop();
      frame.classList.add('done');
      controls.hidden = true;
      stage.append(card);
    }

    const nextHref = () => `${mode === 'custom' ? customHref(opts) : `${HOME}/play?mode=random`}&k=${Date.now()}`;

    function win() {
      const seconds = Math.round(acc / 1000);
      stats.recordWin({ s: seconds, m: mode, w, h: H, b: level.blocks.length, d: level.difficulty });
      finish(h('div', { class: 'win card' },
        h('h2', {}, 'Free at last'),
        h('p', { class: 'win-time' }, fmtTime(seconds)),
        h('div', { class: 'row-btns' },
          h('a', { class: 'btn big', href: nextHref() }, 'Next level'),
          h('a', { class: 'btn big ghost', href: HOME }, 'Menu'))));
    }

    const controls = h('div', { class: 'controls' },
      h('button', { class: 'btn', onclick: undo }, 'Undo'),
      h('button', { class: 'btn', onclick: () => { if (!over) reset(); } }, 'Restart'));

    stage.replaceChildren(frame, controls);
    reset(resume);
  }

  return {
    unmount() {
      alive = false;
      cleanups.forEach(fn => fn());
    },
  };
}
