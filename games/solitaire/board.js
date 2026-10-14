import { h, header, fmtTime } from '../../js/ui.js';
import { load, save, remove } from '../../js/storage.js';
import * as playtimer from '../../js/playtimer.js';
import { autosave } from '../../js/autosave.js';
import { suit, rank, SUITS, RANKS, apply, toFoundation, toColumn, canDraw, won, newDeal, clone } from './engine.js';
import { stats } from './stats.js';

const HOME = '#/game/solitaire';
const SAVE_KEY = 'games.solitaire.saved';
const GAP = 5;

export const getSavedGame = () => load(SAVE_KEY, null);
export const passesLabel = p => (p < 0 ? 'Unlimited' : p === 1 ? '1 pass' : `${p} passes`);

export function optsFromQuery(query) {
  if (query.get('mode') !== 'custom') return { draw: Math.random() < 0.5 ? 1 : 3, passes: -1, winnable: true };
  return {
    draw: query.get('d') === '3' ? 3 : 1,
    passes: [-1, 1, 3].includes(+query.get('p')) ? +query.get('p') : -1,
    winnable: query.get('w') !== '0',
  };
}

export const customHref = o => `${HOME}/play?mode=custom&d=${o.draw}&p=${o.passes}&w=${o.winnable ? 1 : 0}`;

// Deal off the main thread: checking a deal is winnable can take a moment.
function dealAsync(opts) {
  return new Promise(resolve => {
    const fallback = () => setTimeout(() => resolve(newDeal(opts)), 30);
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

function cardFace(c) {
  const s = SUITS[suit(c)] + '︎', r = RANKS[rank(c)];
  return `<span class="sol-corner">${r}<br>${s}</span><span class="sol-pip">${s}</span>`;
}

export function mountBoard(el, query) {
  const saved = query.get('resume') ? getSavedGame() : null;
  const mode = saved ? saved.mode : query.get('mode') === 'custom' ? 'custom' : 'random';
  const opts = saved ? saved.opts : optsFromQuery(query);

  let alive = true;
  const cleanups = [];
  const timerEl = h('span', { class: 'timer' }, '0:00');
  const bar = header(`Draw ${opts.draw}${opts.passes < 0 ? '' : ` · ${passesLabel(opts.passes)}`}`, HOME);
  bar.querySelector('.bar-right').append(timerEl);
  const limitEl = h('div', { class: 'limit muted' });
  const stage = h('div', { class: 'stage' }, h('div', { class: 'loading' }, h('div', { class: 'spinner' }), 'Baba is shuffling…'));
  el.append(bar, limitEl, stage);

  const showLimit = rem => { limitEl.textContent = rem == null ? '' : `Play time left ${fmtTime(rem / 1000)}`; };
  showLimit(playtimer.remainingMs());
  cleanups.push(playtimer.onTick(showLimit));

  remove(SAVE_KEY); // resumed, or replaced by this new game
  if (saved) {
    start(saved.initial, saved.state, saved.acc);
  } else {
    dealAsync(opts).then(({ state }) => {
      if (!alive) return;
      stats.recordStart();
      start(state);
    });
  }

  function start(initial, resumeState, resumeAcc = 0) {
    let s = clone(resumeState || initial);
    let history = [], over = false, acc = resumeAcc, last = Date.now(), finishing = null;

    const table = h('div', { class: 'sol-table' });
    const status = h('div', { class: 'sol-status muted' });
    const els = new Map();
    for (let c = 1; c <= 52; c++) {
      const e = h('div', { class: `sol-card s${suit(c)}`, 'data-c': c, html: cardFace(c) });
      els.set(c, e);
      table.append(e);
    }
    const slots = [];
    const slot = (cls, label = '') => {
      const e = h('div', { class: `sol-slot ${cls}` }, label);
      table.prepend(e);
      slots.push(e);
      return e;
    };
    const stockSlot = slot('stock');
    const foundSlots = [0, 1, 2, 3].map(k => slot('found', SUITS[k] + '︎'));
    const colSlots = [0, 1, 2, 3, 4, 5, 6].map(() => slot('col'));

    // --- Layout ---
    let cw = 40, ch = 56;
    const size = () => {
      const W = Math.min(window.innerWidth - 32, 528);
      cw = Math.floor((W - GAP * 6) / 7);
      ch = Math.round(cw * 1.42);
      table.style.width = `${W}px`;
      table.style.setProperty('--cw', `${cw}px`);
      table.style.setProperty('--ch', `${ch}px`);
      render();
    };
    const colX = i => i * (cw + GAP);
    const tabY = () => ch + GAP * 3;

    function columnOffsets(p) {
      const maxH = Math.max(ch * 2, window.innerHeight - table.getBoundingClientRect().top - tabY() - 110);
      let down = ch * 0.14, up = ch * 0.3;
      const need = p.reduce((a, c, i) => a + (i === p.length - 1 ? 0 : c < 0 ? down : up), 0) + ch;
      if (need > maxH) {
        const k = (maxH - ch) / (need - ch);
        down *= k;
        up *= k;
      }
      return { down, up };
    }

    function render() {
      const place = (c, x, y, z, faceUp) => {
        const e = els.get(Math.abs(c));
        e.style.transform = `translate(${x}px, ${y}px)`;
        e.style.zIndex = z;
        e.classList.toggle('back', !faceUp);
        e.hidden = false;
      };
      stockSlot.style.transform = `translate(${colX(0)}px, 0)`;
      stockSlot.textContent = s.stock.length ? '' : canDraw(s) ? '↻' : '';
      foundSlots.forEach((e, k) => { e.style.transform = `translate(${colX(3 + k)}px, 0)`; });
      colSlots.forEach((e, k) => { e.style.transform = `translate(${colX(k)}px, ${tabY()}px)`; });

      s.stock.forEach((c, i) => place(c, colX(0), 0, 10 + i, false));
      const fan = s.draw === 3 ? Math.min(3, s.waste.length) : 1;
      s.waste.forEach((c, i) => {
        const fromEnd = s.waste.length - 1 - i;
        const shift = fromEnd < fan ? (fan - 1 - fromEnd) * cw * 0.32 : 0;
        place(c, colX(1) + shift, 0, 100 + i, true);
      });
      s.found.forEach((n, k) => {
        for (let r = 1; r <= 13; r++) {
          const c = k * 13 + r;
          if (r <= n) place(c, colX(3 + k), 0, 200 + r, true);
        }
      });
      s.tab.forEach((p, col) => {
        const { down, up } = columnOffsets(p);
        let y = tabY();
        p.forEach((c, i) => {
          place(c, colX(col), y, 300 + i, c > 0);
          y += c < 0 ? down : up;
        });
      });
      // Highest point the table reaches, so the page leaves room for it.
      let bottom = tabY() + ch;
      s.tab.forEach(p => {
        const { down, up } = columnOffsets(p);
        bottom = Math.max(bottom, tabY() + p.slice(0, -1).reduce((a, c) => a + (c < 0 ? down : up), 0) + ch);
      });
      table.style.height = `${bottom}px`;
      const passesLeft = s.passes < 0 ? '' : ` · ${Math.max(0, s.passes - 1 - s.passesUsed)} passes left`;
      status.textContent = `Moves ${s.moves}${passesLeft}`;
    }

    // --- Moves ---
    const commit = next => {
      history.push(s);
      s = next;
      render();
      if (won(s)) return win();
      maybeFinish();
    };

    // Where a card currently is.
    function locate(c) {
      if (s.waste[s.waste.length - 1] === c) return { from: 'waste' };
      if (s.found[suit(c)] === rank(c)) return { from: 'found', suit: suit(c) };
      for (let col = 0; col < 7; col++) {
        const i = s.tab[col].indexOf(c);
        if (i >= 0) return { from: col, index: i };
      }
      return null;
    }

    const lead = loc => (loc.from === 'waste' ? s.waste[s.waste.length - 1]
      : loc.from === 'found' ? loc.suit * 13 + s.found[loc.suit] : s.tab[loc.from][loc.index]);
    const single = loc => typeof loc.from !== 'number' || loc.index === s.tab[loc.from].length - 1;

    function tryMove(loc, to) {
      const c = lead(loc);
      if (to === 'found') {
        if (!single(loc) || loc.from === 'found' || !toFoundation(s, c)) return false;
      } else if (to === loc.from || !toColumn(s, c, to)) return false;
      commit(apply(s, { ...loc, to }));
      return true;
    }

    // Tap: send the card to the best place it can go.
    function smartMove(loc) {
      if (loc.from === 'found') return false; // drag a foundation card down; a tap shouldn't
      if (tryMove(loc, 'found')) return true;
      const cols = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => (s.tab[a].length ? 0 : 1) - (s.tab[b].length ? 0 : 1));
      // Don't shuffle a king (with its run) from the bottom of a column to another empty one.
      for (const col of cols) {
        if (typeof loc.from === 'number' && loc.index === 0 && !s.tab[col].length) continue;
        if (tryMove(loc, col)) return true;
      }
      return false;
    }

    const shake = c => {
      const e = els.get(c);
      e.classList.remove('shake');
      void e.offsetWidth;
      e.classList.add('shake');
    };

    // Once everything is face up and the stock is used, finish the game for the player.
    function maybeFinish() {
      if (finishing || over || s.stock.length || s.waste.length || s.tab.some(p => p.some(c => c < 0))) return;
      finishing = setInterval(() => {
        for (let col = 0; col < 7; col++) {
          const p = s.tab[col], c = p[p.length - 1];
          if (c != null && toFoundation(s, c)) { commit(apply(s, { from: col, index: p.length - 1, to: 'found' })); return; }
        }
      }, 110);
      cleanups.push(() => clearInterval(finishing));
    }

    // --- Input: tap or drag ---
    let drag = null;
    const pointIn = (e, x, y, w, hh) => {
      const r = table.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      return px >= x && px <= x + w && py >= y && py <= y + hh;
    };
    table.addEventListener('pointerdown', e => {
      if (over || finishing) return;
      const cardEl = e.target.closest('.sol-card');
      if (!cardEl) {
        if (e.target === stockSlot && canDraw(s)) commit(apply(s, { draw: true }));
        return;
      }
      const c = +cardEl.dataset.c;
      if (s.stock.includes(c)) { if (canDraw(s)) commit(apply(s, { draw: true })); return; }
      const loc = locate(c);
      if (!loc || (typeof loc.from === 'number' && s.tab[loc.from][loc.index] < 0)) return;
      e.preventDefault();
      table.setPointerCapture(e.pointerId);
      const group = typeof loc.from === 'number' ? s.tab[loc.from].slice(loc.index) : [c];
      drag = { loc, c, group, sx: e.clientX, sy: e.clientY, moved: false };
    });
    table.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      drag.group.forEach((c, i) => {
        const el2 = els.get(c);
        el2.classList.add('dragging');
        el2.style.zIndex = 1000 + i;
        el2.style.translate = `${dx}px ${dy}px`;
      });
    });
    const endDrag = e => {
      if (!drag) return;
      const d = drag;
      drag = null;
      d.group.forEach(c => {
        const el2 = els.get(c);
        el2.classList.remove('dragging');
        el2.style.translate = '';
      });
      if (!d.moved) {
        if (!smartMove(d.loc)) shake(d.c);
        return;
      }
      // Dropped on a foundation, or on a column.
      for (let k = 0; k < 4; k++) {
        if (pointIn(e, colX(3 + k) - GAP, -GAP, cw + GAP * 2, ch + GAP * 2) && tryMove(d.loc, 'found')) return;
      }
      const r = table.getBoundingClientRect();
      const col = Math.max(0, Math.min(6, Math.floor((e.clientX - r.left + GAP / 2) / (cw + GAP))));
      if (e.clientY - r.top > tabY() - GAP && tryMove(d.loc, col)) return;
      render();
    };
    table.addEventListener('pointerup', endDrag);
    table.addEventListener('pointercancel', () => { drag = null; render(); });

    // --- Clock, controls and end of game ---
    const clock = setInterval(() => {
      const now = Date.now();
      if (!document.hidden && !over) acc += Math.max(0, now - last);
      last = now;
      timerEl.textContent = fmtTime(Math.floor(acc / 1000));
    }, 250);
    cleanups.push(() => clearInterval(clock));

    const undo = () => {
      if (over || finishing || !history.length) return;
      s = history.pop();
      render();
    };
    const restart = () => {
      if (over || finishing) return;
      history.push(s);
      s = clone(initial);
      render();
    };
    const nextHref = () => `${mode === 'custom' ? customHref(opts) : `${HOME}/play?mode=random`}&k=${Date.now()}`;
    const controls = h('div', { class: 'controls' },
      h('button', { class: 'btn', onclick: undo }, 'Undo'),
      h('button', { class: 'btn', onclick: restart }, 'Restart'),
      h('a', { class: 'btn', href: nextHref() }, 'New deal'));

    function win() {
      over = true;
      clearInterval(finishing);
      remove(SAVE_KEY);
      playtimer.stop();
      controls.hidden = true;
      const seconds = Math.round(acc / 1000);
      stats.recordWin({ s: seconds, m: mode, d: opts.draw, moves: s.moves });
      stage.append(h('div', { class: 'win card' },
        h('h2', {}, 'Baba would be proud'),
        h('p', { class: 'win-time' }, fmtTime(seconds)),
        h('p', { class: 'muted' }, `${s.moves} moves`),
        h('div', { class: 'row-btns' },
          h('a', { class: 'btn big', href: nextHref() }, 'Next deal'),
          h('a', { class: 'btn big ghost', href: HOME }, 'Menu'))));
    }

    cleanups.push(autosave(() => {
      if (!over) save(SAVE_KEY, { mode, opts, initial, state: s, acc });
    }));

    stage.replaceChildren(status, table, controls);
    size();
    window.addEventListener('resize', size);
    cleanups.push(() => window.removeEventListener('resize', size));
    playtimer.start();
    maybeFinish();
  }

  return {
    unmount() {
      alive = false;
      cleanups.forEach(fn => fn());
    },
  };
}
