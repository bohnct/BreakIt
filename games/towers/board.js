import { h, header, fmtTime, toast } from '../../js/ui.js';
import { load, save, remove } from '../../js/storage.js';
import * as playtimer from '../../js/playtimer.js';
import { autosave } from '../../js/autosave.js';
import { W, H, PLAYER, DIFFICULTIES, newGame, step, send, clearPath, generateMap, level, radius } from './engine.js';
import { stats } from './stats.js';

const HOME = '#/game/towers';
const SAVE_KEY = 'games.towers.saved';
// Player first, then opponents. From the same coolors palette.
const SIDE_COLOURS = [null, '#90be6d', '#f94144', '#f8961e', '#f9c74f'];
export const TOWER_COUNTS = [8, 10, 12, 14, 16, 18];

export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const getSavedGame = () => load(SAVE_KEY, null);
export const maxEnemies = towers => Math.min(3, Math.floor(towers / 4));

export function optsFromQuery(query) {
  if (query.get('mode') !== 'custom') {
    const towers = 9 + Math.floor(Math.random() * 7);
    return {
      towers,
      enemies: Math.min(maxEnemies(towers), Math.random() < 0.6 ? 1 : towers >= 13 && Math.random() < 0.4 ? 3 : 2),
      difficulty: Math.random() < 0.5 ? 'medium' : 'hard',
      walls: Math.random() < 0.5,
      factories: Math.random() < 0.6,
    };
  }
  const towers = TOWER_COUNTS.includes(+query.get('n')) ? +query.get('n') : 12;
  const ob = query.get('o') || '';
  return {
    towers,
    enemies: Math.min(maxEnemies(towers), Math.max(1, +query.get('e') || 1)),
    difficulty: DIFFICULTIES.includes(query.get('d')) ? query.get('d') : 'medium',
    walls: ob.includes('w'),
    factories: ob.includes('f'),
  };
}

export function customHref(o) {
  return `${HOME}/play?mode=custom&n=${o.towers}&e=${o.enemies}&d=${o.difficulty}&o=${o.walls ? 'w' : ''}${o.factories ? 'f' : ''}`;
}

// Generate off the main thread so the loading screen stays responsive; fall back if workers fail.
function generateAsync(opts) {
  return new Promise(resolve => {
    const fallback = () => setTimeout(() => resolve(generateMap(opts)), 30);
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

export function mountBoard(el, query) {
  const saved = query.get('resume') ? getSavedGame() : null;
  if (saved) remove(SAVE_KEY);
  const mode = saved ? saved.mode : query.get('mode') === 'custom' ? 'custom' : 'random';
  const opts = saved ? saved.opts : optsFromQuery(query);

  let alive = true;
  const cleanups = [];
  const timerEl = h('span', { class: 'timer' }, '0:00');
  const vs = opts.enemies === 1 ? '1 rival' : `${opts.enemies} rivals`;
  const bar = header(`${cap(opts.difficulty)} · ${vs}`, HOME);
  bar.querySelector('.bar-right').append(timerEl);
  const limitEl = h('div', { class: 'limit muted' });
  const stage = h('div', { class: 'stage' }, h('div', { class: 'loading' }, h('div', { class: 'spinner' }), 'Carter is building towers…'));
  el.append(bar, limitEl, stage);

  const showLimit = rem => { limitEl.textContent = rem == null ? '' : `Play time left ${fmtTime(rem / 1000)}`; };
  showLimit(playtimer.remainingMs());
  cleanups.push(playtimer.onTick(showLimit));

  if (saved) {
    start(saved.map, saved.state);
  } else {
    generateAsync(opts).then(map => {
      if (!alive) return;
      stats.recordStart();
      remove(SAVE_KEY); // a new game replaces any unfinished one
      start(map);
    });
  }

  function start(map, resumeState) {
    let state = resumeState || newGame(map);
    let paused = false, over = false, drag = null, raf = 0, last = performance.now();

    const canvas = h('canvas', { class: 'tw-canvas', 'aria-label': 'Battle map' });
    const ctx = canvas.getContext('2d');
    let scale = 1;
    const size = () => {
      const availW = Math.min(window.innerWidth - 32, 528);
      const availH = window.innerHeight - 230;
      scale = Math.max(0.5, Math.min(availW / W, availH / H));
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      canvas.width = Math.round(W * scale * dpr);
      canvas.height = Math.round(H * scale * dpr);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    };
    size();
    window.addEventListener('resize', size);
    cleanups.push(() => window.removeEventListener('resize', size));

    // --- Drawing ---
    const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const roundRect = (x, y, w, hh, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + hh, r);
      ctx.arcTo(x + w, y + hh, x, y + hh, r);
      ctx.arcTo(x, y + hh, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    function draw() {
      const fg = css('--fg'), muted = css('--muted'), tile = css('--tile');
      ctx.clearRect(0, 0, W, H);
      const { towers } = state;

      ctx.lineCap = 'round';
      ctx.strokeStyle = muted;
      ctx.lineWidth = 2.4;
      for (const [x1, y1, x2, y2] of state.walls) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      if (drag) {
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 0.8;
        for (const i of drag.sources) {
          const t = towers[i], target = drag.target;
          const blocked = target != null && target !== i && !clearPath(state, i, target);
          ctx.strokeStyle = blocked ? muted : SIDE_COLOURS[PLAYER];
          ctx.beginPath();
          ctx.moveTo(t.x, t.y);
          const end = target != null ? towers[target] : drag;
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      for (const u of state.moving) {
        if (u.p <= 0) continue;
        const a = towers[u.from], b = towers[u.to];
        ctx.fillStyle = SIDE_COLOURS[u.owner];
        ctx.beginPath();
        ctx.arc(a.x + (b.x - a.x) * u.p, a.y + (b.y - a.y) * u.p, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      towers.forEach((t, i) => {
        const r = radius(t);
        ctx.fillStyle = t.owner ? SIDE_COLOURS[t.owner] : tile;
        if (t.factory) roundRect(t.x - r, t.y - r, r * 2, r * 2, r * 0.45);
        else { ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); }
        ctx.fill();
        if (!t.owner) {
          ctx.strokeStyle = muted;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
        if (drag && (drag.sources.includes(i) || drag.target === i)) {
          ctx.strokeStyle = fg;
          ctx.lineWidth = 0.8;
          if (t.factory) roundRect(t.x - r - 1.4, t.y - r - 1.4, r * 2 + 2.8, r * 2 + 2.8, r * 0.6);
          else { ctx.beginPath(); ctx.arc(t.x, t.y, r + 1.4, 0, Math.PI * 2); }
          ctx.stroke();
        }
        // Level pips above the tower.
        const lv = level(t);
        ctx.fillStyle = t.owner ? SIDE_COLOURS[t.owner] : muted;
        for (let k = 0; k < lv; k++) {
          ctx.beginPath();
          ctx.arc(t.x + (k - (lv - 1) / 2) * 2, t.y - r - 2, 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = t.owner ? '#000' : fg;
        ctx.font = `700 ${r * 0.85}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(Math.floor(t.units)), t.x, t.y + 0.3);
      });

      if (paused && !over) {
        ctx.fillStyle = fg;
        ctx.font = '600 7px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Paused', W / 2, H / 2);
      }
    }

    // --- Loop ---
    const tick = now => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!paused && !over && !document.hidden) {
        for (let left = dt; left > 0; left -= 0.05) step(state, Math.min(0.05, left), opts.difficulty);
        timerEl.textContent = fmtTime(state.time);
        if (state.result) finish();
      }
      draw();
    };
    cleanups.push(() => cancelAnimationFrame(raf));

    // --- Input: drag from your towers (sweep across several to pick more) to a target ---
    const toMap = e => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
    };
    const towerAt = ({ x, y }) => {
      let best = null, bestD = Infinity;
      state.towers.forEach((t, i) => {
        const d = Math.hypot(t.x - x, t.y - y);
        if (d < radius(t) + 3.5 && d < bestD) { best = i; bestD = d; }
      });
      return best;
    };
    canvas.addEventListener('pointerdown', e => {
      if (paused || over) return;
      const p = toMap(e), i = towerAt(p);
      if (i == null || state.towers[i].owner !== PLAYER) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      drag = { sources: [i], target: null, ...p };
    });
    canvas.addEventListener('pointermove', e => {
      if (!drag) return;
      const p = toMap(e), i = towerAt(p);
      Object.assign(drag, p);
      // Your towers swept over join in as senders; whichever tower you let go on is the target
      // (it can be your own, to reinforce it, in which case it doesn't send).
      if (i != null && state.towers[i].owner === PLAYER && !drag.sources.includes(i)) drag.sources.push(i);
      drag.target = i != null && !(drag.sources.length === 1 && drag.sources[0] === i) ? i : null;
    });
    const release = () => {
      if (!drag) return;
      const target = drag.target;
      if (target != null) {
        let sent = 0, blocked = 0;
        for (const s of drag.sources) {
          if (s === target) continue;
          if (!clearPath(state, s, target)) { blocked++; continue; }
          sent += send(state, s, target, PLAYER);
        }
        if (!sent && blocked) toast('A wall is in the way');
      }
      drag = null;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', () => { drag = null; });

    // --- Controls and end of game ---
    const nextHref = () => `${mode === 'custom' ? customHref(opts) : `${HOME}/play?mode=random`}&k=${Date.now()}`;
    const pauseBtn = h('button', { class: 'btn', onclick: () => {
      if (over) return;
      paused = !paused;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      if (paused) playtimer.stop(); else playtimer.start();
    } }, 'Pause');
    const restart = () => {
      state = newGame(map);
      over = false;
      paused = false;
      pauseBtn.textContent = 'Pause';
      stage.querySelector('.win')?.remove();
      controls.hidden = false;
      timerEl.textContent = '0:00';
      playtimer.start();
    };
    const controls = h('div', { class: 'controls' },
      pauseBtn,
      h('button', { class: 'btn', onclick: () => { if (!over) restart(); } }, 'Restart'));

    function finish() {
      over = true;
      remove(SAVE_KEY);
      drag = null;
      playtimer.stop();
      controls.hidden = true;
      const seconds = Math.round(state.time);
      if (state.result === 'win') {
        stats.recordWin({ s: seconds, m: mode, d: opts.difficulty, e: opts.enemies, n: opts.towers });
        stage.append(h('div', { class: 'win card' },
          h('h2', {}, 'Every tower is yours'),
          h('p', { class: 'win-time' }, fmtTime(seconds)),
          h('div', { class: 'row-btns' },
            h('a', { class: 'btn big', href: nextHref() }, 'Next battle'),
            h('a', { class: 'btn big ghost', href: HOME }, 'Menu'))));
      } else {
        stats.recordFail();
        stage.append(h('div', { class: 'win card' },
          h('h2', {}, 'Defeated'),
          h('p', { class: 'muted' }, 'Carter took your last tower.'),
          h('div', { class: 'row-btns' },
            h('button', { class: 'btn big', onclick: restart }, 'Try again'),
            h('a', { class: 'btn big ghost', href: nextHref() }, 'New battle'))));
      }
    }

    cleanups.push(autosave(() => {
      if (!over) save(SAVE_KEY, { mode, opts, map, state });
    }));

    stage.replaceChildren(canvas, controls);
    timerEl.textContent = fmtTime(state.time);
    playtimer.start();
    raf = requestAnimationFrame(tick);
  }

  return {
    unmount() {
      alive = false;
      cleanups.forEach(fn => fn());
    },
  };
}
