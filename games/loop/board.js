import { h, header, fmtTime, toast, viewWidth, viewHeight, zoom } from '../../js/ui.js';
import { load, save, remove } from '../../js/storage.js';
import { SORT_COLOURS } from '../../js/colours.js';
import * as playtimer from '../../js/playtimer.js';
import { autosave } from '../../js/autosave.js';
import { DIFFICULTIES, TRUCK, generateLevel, newGame, tick, tap, canTap, cubeSpot, onTrack, trackFull } from './engine.js';
import { stats } from './stats.js';

const HOME = '#/game/loop';
const SAVE_KEY = 'games.loop.saved';
const STEP_MS = 260; // one track step at normal speed
const PALETTE = SORT_COLOURS; // high-contrast set, see js/colours.js
export const OBSTACLES = [
  { value: 'roof', label: 'Roof colours', key: 'r' },
  { value: 'ice', label: 'Ice', key: 'i' },
  { value: 'hidden', label: 'Hidden', key: 'h' },
];

export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const getSavedGame = () => load(SAVE_KEY, null);

// Hard always hides the cubes below the top of some trucks.
export function optsFromQuery(query) {
  if (query.get('mode') !== 'custom') {
    const difficulty = Math.random() < 0.5 ? 'medium' : 'hard';
    const hard = difficulty === 'hard';
    return {
      difficulty,
      roof: Math.random() < (hard ? 0.5 : 0.3),
      ice: Math.random() < (hard ? 0.4 : 0.25),
      hidden: hard || Math.random() < 0.3,
    };
  }
  const ob = query.get('o') || '';
  const o = { difficulty: DIFFICULTIES.includes(query.get('d')) ? query.get('d') : 'medium' };
  for (const x of OBSTACLES) o[x.value] = ob.includes(x.key);
  if (o.difficulty === 'hard') o.hidden = true;
  return o;
}
export const customHref = o => `${HOME}/play?mode=custom&d=${o.difficulty}&o=${OBSTACLES.filter(x => o[x.value]).map(x => x.key).join('')}`;

// Generate off the main thread; if the worker can't run or goes quiet, generate here.
function generateAsync(opts) {
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done) { done = true; resolve(r); } };
    const fallback = () => setTimeout(() => finish(generateLevel(opts, 800)), 30);
    let worker;
    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    } catch {
      return fallback();
    }
    const watchdog = setTimeout(() => { worker.terminate(); fallback(); }, 7000);
    worker.onmessage = e => { clearTimeout(watchdog); worker.terminate(); finish(e.data); };
    worker.onerror = () => { clearTimeout(watchdog); worker.terminate(); fallback(); };
    worker.postMessage(opts);
  });
}

export function mountBoard(el, query) {
  const saved = query.get('resume') ? getSavedGame() : null;
  remove(SAVE_KEY); // resumed, or replaced by this new game
  const mode = saved ? saved.mode : query.get('mode') === 'custom' ? 'custom' : 'random';
  const opts = saved ? saved.opts : optsFromQuery(query);

  let alive = true;
  const cleanups = [];
  const timerEl = h('span', { class: 'timer' }, '0:00');
  const bar = header(cap(opts.difficulty), HOME);
  bar.querySelector('.bar-right').append(timerEl);
  const limitEl = h('div', { class: 'limit muted' });
  const showLimit = rem => { limitEl.textContent = rem == null ? '' : `Play time left ${fmtTime(rem / 1000)}`; };
  showLimit(playtimer.remainingMs());
  cleanups.push(playtimer.onTick(showLimit));
  const stage = h('div', { class: 'stage' }, h('div', { class: 'loading' }, h('div', { class: 'spinner' }), 'Laying the track…'));
  el.append(bar, limitEl, stage);

  if (saved) start(saved.level, saved.state, saved.acc);
  else {
    generateAsync(opts).then(level => {
      if (!alive) return;
      stats.recordStart();
      start(level);
    });
  }

  function start(level, resumeState, resumeAcc = 0) {
    let s = resumeState || newGame(level);
    let acc = resumeAcc, over = false, raf = 0;
    let last = performance.now(), sinceStep = 0;
    // Animations: cubes sliding between trucks and the track, and sorted trucks driving off.
    let anims = [];
    const ANIM_MS = 260, LEAVE_MS = 600;
    const ease = p => 1 - (1 - p) ** 3;
    const L = level.loop.length;

    const canvas = h('canvas', { class: 'lp-canvas', 'aria-label': 'Track' });
    const ctx = canvas.getContext('2d');
    // Cubes on the track (or waiting to go out) out of the most allowed at once.
    const status = h('div', { class: 'lp-count' });
    const controls = h('div', { class: 'controls' },
      h('button', { class: 'btn', onclick: () => restart() }, 'Restart'));
    stage.replaceChildren(controls, status, canvas);

    // --- Layout: fitted to the track and the trucks parked round it ---
    let unit = 40, ox = 0, oy = 0;
    const PAD = 0.4;
    const spots = level.trucks.flatMap(t => [...Array(level.cap).keys()].map(k => cubeSpot(level.loop, t, k)));
    const all = [...level.loop, ...spots];
    // The track may be drawn turned on its side (x and y swapped), whichever way round lets it be
    // drawn bigger in the space this screen actually has. (Android browsers leave less height than
    // iPhones, so "always stand it up tall" made boards smaller there.)
    const rawW = Math.max(...all.map(p => p[0])) - Math.min(...all.map(p => p[0]));
    const rawH = Math.max(...all.map(p => p[1])) - Math.min(...all.map(p => p[1]));
    const room = () => [Math.min(viewWidth() - 32, 528), viewHeight() - 250];
    const fit = (w, h) => { const [aw, ah] = room(); return Math.min(aw / (w + PAD * 2), ah / (h + PAD * 2)); };
    const flip = fit(rawH, rawW) > fit(rawW, rawH);
    const turn = ([x, y]) => (flip ? [y, x] : [x, y]);
    const xs = all.map(p => turn(p)[0]), ys = all.map(p => turn(p)[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys), spanX = Math.max(...xs) - minX, spanY = Math.max(...ys) - minY;
    const size = () => {
      const [availW, availH] = room();
      unit = Math.max(12, Math.floor(Math.min(availW / (spanX + PAD * 2), availH / (spanY + PAD * 2), 90)));
      const W = unit * (spanX + PAD * 2), Hh = unit * (spanY + PAD * 2);
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${Hh}px`;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(Hh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ox = unit * (PAD - minX);
      oy = unit * (PAD - minY);
    };
    const px = p => { const [x, y] = turn(p); return [ox + x * unit, oy + y * unit]; };
    const pt = i => px(level.loop[((i % L) + L) % L]);

    const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const rr = (x, y, w, hh, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + hh, r);
      ctx.arcTo(x + w, y + hh, x, y + hh, r);
      ctx.arcTo(x, y + hh, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    const font = (u, w = 700) => `${w} ${unit * u}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    function draw() {
      const fg = css('--fg'), muted = css('--muted'), tile = css('--tile'), line = css('--line');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      // The track: an outlined road with direction marks.
      const road = () => {
        ctx.beginPath();
        level.loop.forEach((_, i) => { const [x, y] = pt(i); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.closePath();
        ctx.stroke();
      };
      // Each truck sits at the end of a short spur off the track, drawn like the road itself, whose
      // fill runs into the main road so the two join up.
      const spurs = () => {
        ctx.beginPath();
        for (const t of s.trucks) {
          if (t.gone) continue;
          const [ax, ay] = pt(t.at), [bx, by] = px(cubeSpot(level.loop, t, 0));
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
        }
        ctx.stroke();
      };
      ctx.strokeStyle = muted;
      ctx.lineWidth = unit * 0.54;
      spurs();
      road();
      ctx.strokeStyle = tile;
      ctx.lineWidth = unit * 0.48;
      road();
      spurs();
      ctx.fillStyle = line;
      for (let i = 0; i < L; i += 2) {
        const [x1, y1] = pt(i), [x2, y2] = pt(i + 1), a = Math.atan2(y2 - y1, x2 - x1);
        ctx.save();
        ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(unit * 0.07, 0);
        ctx.lineTo(-unit * 0.05, -unit * 0.065);
        ctx.lineTo(-unit * 0.05, unit * 0.065);
        ctx.fill();
        ctx.restore();
      }


      // Trucks parked outside the loop. The cube nearest the track is the top one.
      const now = performance.now();
      const truckBox = (t, shift = 0) => {
        const [ax, ay] = px(cubeSpot(level.loop, t, shift)), [bx, by] = px(cubeSpot(level.loop, t, level.cap - 1 + shift));
        const half = (TRUCK.width / 2) * unit;
        return { x: Math.min(ax, bx) - half, y: Math.min(ay, by) - half, w: Math.abs(bx - ax) + half * 2, h: Math.abs(by - ay) + half * 2, half, ax, ay, bx, by };
      };
      s.trucks.forEach((t, i) => {
        if (t.gone) return;
        const box = truckBox(t);
        const live = canTap(s, i) && !trackFull(s, level);
        // Roof colour: the truck is tinted and outlined in the only colour it will take.
        rr(box.x, box.y, box.w, box.h, box.half * 0.6);
        ctx.fillStyle = css('--bg');
        ctx.fill();
        if (t.roof != null) {
          ctx.globalAlpha = 0.22;
          ctx.fillStyle = PALETTE[t.roof];
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.lineWidth = t.roof != null ? 3 : live ? 2 : 1.2;
        ctx.strokeStyle = t.roof != null ? PALETTE[t.roof] : live ? fg : line;
        ctx.stroke();
        // Cubes from the top (k = 0, nearest the track) down. A cube still sliding in isn't drawn
        // in place yet.
        const n = t.cubes.length;
        const arriving = anims.filter(a => a.kind === 'in' && a.truck === i).length;
        for (let k = arriving; k < n; k++) {
          const idx = n - 1 - k, c = t.cubes[idx];
          const unknown = idx < (t.hiddenBelow || 0);
          const [cx, cy] = px(cubeSpot(level.loop, t, k)), cs = unit * TRUCK.cube;
          rr(cx - cs / 2, cy - cs / 2, cs, cs, cs * 0.25);
          ctx.fillStyle = unknown ? muted : PALETTE[c];
          ctx.fill();
          if (unknown) {
            ctx.fillStyle = css('--bg');
            ctx.font = font(0.26);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', cx, cy + 0.5);
          }
        }
        if (t.pending) {
          ctx.fillStyle = fg;
          ctx.font = font(0.18);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const [ex, ey] = px(cubeSpot(level.loop, t, -0.35));
          ctx.fillText(`${t.pending}↑`, ex, ey);
        }
        if (t.ice > s.cleared) {
          rr(box.x, box.y, box.w, box.h, box.half * 0.6);
          ctx.fillStyle = 'rgba(225, 240, 255, .8)';
          ctx.fill();
          ctx.fillStyle = '#0b2a44';
          ctx.font = font(0.34);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(t.ice - s.cleared), (box.ax + box.bx) / 2, (box.ay + box.by) / 2);
        }
      });

      // Cubes on the track, gliding towards their next spot (unless still sliding out of a truck).
      const f = Math.min(1, sinceStep / STEP_MS);
      const glide = i => {
        const [x1, y1] = pt(i), [x2, y2] = pt(i + 1);
        return [x1 + (x2 - x1) * f, y1 + (y2 - y1) * f];
      };
      const cube = (x, y, c, alpha = 1) => {
        const cs = unit * TRUCK.cube;
        ctx.globalAlpha = alpha;
        rr(x - cs / 2, y - cs / 2, cs, cs, cs * 0.25);
        ctx.fillStyle = PALETTE[c];
        ctx.fill();
        ctx.globalAlpha = 1;
      };
      s.slots.forEach((c, i) => {
        if (!c || anims.some(a => a.kind === 'out' && a.cube === c)) return;
        cube(...glide(i), c.c);
      });

      // Animations on top.
      anims = anims.filter(a => now - a.t0 < a.dur);
      for (const a of anims) {
        const p = ease(Math.max(0, Math.min(1, (now - a.t0) / a.dur)));
        if (a.kind === 'out') {
          // From the top of the truck to the cube's current place on the track.
          const idx = s.slots.indexOf(a.cube);
          if (idx < 0) continue;
          const [tx, ty] = glide(idx);
          cube(a.from[0] + (tx - a.from[0]) * p, a.from[1] + (ty - a.from[1]) * p, a.c);
        } else if (a.kind === 'in') {
          // From the track into the top of the truck.
          const t = s.trucks[a.truck];
          const [tx, ty] = px(cubeSpot(level.loop, t, 0));
          cube(a.from[0] + (tx - a.from[0]) * p, a.from[1] + (ty - a.from[1]) * p, a.c);
        } else if (a.kind === 'leave') {
          // A sorted truck drives off, away from the track, fading out.
          const t = s.trucks[a.truck], box = truckBox(t, p * 2.2);
          ctx.globalAlpha = 1 - p;
          rr(box.x, box.y, box.w, box.h, box.half * 0.6);
          ctx.fillStyle = css('--bg');
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = PALETTE[a.c];
          ctx.stroke();
          ctx.globalAlpha = 1;
          for (let k = 0; k < level.cap; k++) cube(...px(cubeSpot(level.loop, t, k + p * 2.2)), a.c, 1 - p);
        }
      }
    }

    // Turn what happened on the last step into animations.
    function animate(events, now) {
      for (const e of events) {
        const t = s.trucks[e.truck];
        if (e.type === 'out') {
          anims.push({ kind: 'out', cube: s.slots[e.slot], c: e.c, from: px(cubeSpot(level.loop, t, 0)), t0: now, dur: ANIM_MS });
        } else if (e.type === 'in') {
          anims.push({ kind: 'in', truck: e.truck, c: e.c, from: pt(e.slot), t0: now, dur: ANIM_MS });
        } else if (e.type === 'leave') {
          // Drive off once the last cube has slid in.
          anims.push({ kind: 'leave', truck: e.truck, c: e.c, t0: now + ANIM_MS, dur: LEAVE_MS });
        }
      }
    }
    const showStatus = () => {
      const riding = onTrack(s) + s.trucks.reduce((a, t) => a + t.pending, 0);
      status.textContent = `${riding}/${level.limit}`;
    };

    // --- Loop ---
    const frame = now => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(200, now - last);
      last = now;
      if (!over && !document.hidden) {
        acc += dt;
        sinceStep += dt;
        // Cubes are drawn gliding from their spot towards the next; when a glide completes the
        // model takes its step.
        while (sinceStep >= STEP_MS) {
          sinceStep -= STEP_MS;
          tick(s, level);
          animate(s.events, now);
          if (s.result) { finish(); break; }
        }
        timerEl.textContent = fmtTime(acc / 1000);
        showStatus();
      }
      draw();
    };
    cleanups.push(() => cancelAnimationFrame(raf));

    // Tap a truck to send its top cube onto the track.
    canvas.addEventListener('click', e => {
      if (over) return;
      const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / zoom(), y = (e.clientY - r.top) / zoom();
      let best = -1, bestD = Infinity;
      s.trucks.forEach((t, i) => {
        if (t.gone) return;
        for (let k = 0; k < level.cap; k++) {
          const [cx, cy] = px(cubeSpot(level.loop, t, k)), d = Math.hypot(cx - x, cy - y);
          if (d < unit * 0.46 && d < bestD) { best = i; bestD = d; }
        }
      });
      if (best < 0) return;
      const t = s.trucks[best];
      if (t.ice > s.cleared) return toast(`Frozen until ${t.ice - s.cleared} more truck${t.ice - s.cleared > 1 ? 's are' : ' is'} sorted`);
      if (trackFull(s, level)) return toast(`The track takes ${level.limit} cube${level.limit > 1 ? 's' : ''} at a time`);
      tap(s, best, level);
    });

    function restart() {
      s = newGame(level);
      anims = [];
      acc = 0;
      over = false;
      showStatus();
      stage.querySelector('.win')?.remove();
      controls.hidden = false;
      playtimer.start();
    }

    const nextHref = () => `${mode === 'custom' ? customHref(opts) : `${HOME}/play?mode=random`}&k=${Date.now()}`;
    function finish() {
      over = true;
      remove(SAVE_KEY);
      playtimer.stop();
      controls.hidden = true;
      const seconds = Math.round(acc / 1000);
      if (s.result === 'win') {
        stats.recordWin({ s: seconds, m: mode, d: opts.difficulty, taps: s.taps });
        stage.append(h('div', { class: 'win card' },
          h('h2', {}, 'All sorted'),
          h('p', { class: 'win-time' }, fmtTime(seconds)),
          h('p', { class: 'muted' }, `${s.taps} taps`),
          h('div', { class: 'row-btns' },
            h('a', { class: 'btn big', href: nextHref() }, 'Next level'),
            h('a', { class: 'btn big ghost', href: HOME }, 'Menu'))));
      } else {
        stats.recordFail();
        stage.append(h('div', { class: 'win card' },
          h('h2', {}, 'Track jammed'),
          h('p', { class: 'muted' }, 'The track filled up with cubes that had nowhere to go.'),
          h('div', { class: 'row-btns' },
            h('button', { class: 'btn big', onclick: () => { restart(); } }, 'Try again'),
            h('a', { class: 'btn big ghost', href: nextHref() }, 'New level'))));
      }
    }

    cleanups.push(autosave(() => { if (!over) save(SAVE_KEY, { mode, opts, level, state: s, acc }); }));
    size();
    window.addEventListener('resize', size);
    cleanups.push(() => window.removeEventListener('resize', size));
    playtimer.start();
    showStatus();
    raf = requestAnimationFrame(frame);
  }

  return { unmount() { alive = false; cleanups.forEach(fn => fn()); } };
}
