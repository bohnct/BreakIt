import { h, header, fmtTime, viewWidth } from '../../js/ui.js';
import { load, save, remove } from '../../js/storage.js';
import { SORT_COLOURS } from '../../js/colours.js';
import * as playtimer from '../../js/playtimer.js';
import { autosave } from '../../js/autosave.js';
import {
  W, H, CY, GARLIC_R, garlicAt, MAX_LEVEL, WEAPONS, WEAPON_ORDER, DIFFICULTIES, DIFF, HEAL_COST, HEAL_AMOUNT,
  generateLevel, newGame, startWave, step, buyWeapon, buyUpgrade, buyHeal, upgradeCost,
} from './engine.js';
import { stats } from './stats.js';

const HOME = '#/game/garlic';
const SAVE_KEY = 'games.garlic.saved';
// Enemy colours from the coolors palette.
const COLOURS = { scout: SORT_COLOURS[1], block: SORT_COLOURS[4], brute: SORT_COLOURS[0], splitter: SORT_COLOURS[3], boss: SORT_COLOURS[2] };
const BLURBS = {
  handgun: 'Steady single shots',
  shotgun: 'New garlic · five pellets, short range',
  sniper: 'New garlic · huge hits anywhere on the map',
  machinegun: 'New garlic · fast, light bullets, long range',
};
export const WAVE_COUNTS = [10, 15, 20, 25, 30, 40];
export const ENEMY_TYPES = [
  { value: 'brutes', label: 'Brutes', key: 'b' },
  { value: 'splitters', label: 'Splitters', key: 's' },
  { value: 'bosses', label: 'Boss', key: 'x' },
];

export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const getSavedGame = () => load(SAVE_KEY, null);

export function optsFromQuery(query) {
  if (query.get('mode') !== 'custom') {
    const difficulty = Math.random() < 0.5 ? 'medium' : 'hard';
    return { difficulty, waves: DIFF[difficulty].waves, brutes: true, splitters: true, bosses: true };
  }
  const difficulty = DIFFICULTIES.includes(query.get('d')) ? query.get('d') : 'medium';
  const ob = query.get('o') ?? 'bsx';
  const o = { difficulty, waves: WAVE_COUNTS.includes(+query.get('w')) ? +query.get('w') : DIFF[difficulty].waves };
  for (const t of ENEMY_TYPES) o[t.value] = ob.includes(t.key);
  return o;
}

export function customHref(o) {
  const ob = ENEMY_TYPES.filter(t => o[t.value]).map(t => t.key).join('');
  return `${HOME}/play?mode=custom&d=${o.difficulty}&w=${o.waves}&o=${ob}`;
}

export function mountBoard(el, query) {
  const saved = query.get('resume') ? getSavedGame() : null;
  remove(SAVE_KEY); // resumed, or replaced by this new game
  const mode = saved ? saved.mode : query.get('mode') === 'custom' ? 'custom' : 'random';
  const opts = saved ? saved.opts : optsFromQuery(query);
  const level = saved ? saved.level : generateLevel(opts);
  if (!saved) stats.recordStart();

  let state = saved ? saved.state : newGame(level);
  let paused = false, fast = false, over = false, raf = 0, last = performance.now(), hurt = 0, shownHearts = state.hearts;
  const cleanups = [];

  const timerEl = h('span', { class: 'timer' }, fmtTime(state.time));
  const bar = header(`${cap(opts.difficulty)} · ${level.waves.length} waves`, HOME);
  bar.querySelector('.bar-right').append(timerEl);
  const limitEl = h('div', { class: 'limit muted' });
  const showLimit = rem => { limitEl.textContent = rem == null ? '' : `Play time left ${fmtTime(rem / 1000)}`; };
  showLimit(playtimer.remainingMs());
  cleanups.push(playtimer.onTick(showLimit));

  const canvas = h('canvas', { class: 'gt-canvas', 'aria-label': 'Garlic defence' });
  const ctx = canvas.getContext('2d');
  const shop = h('div', { class: 'gt-shop card' });
  const wrap = h('div', { class: 'gt-wrap' }, canvas, shop);
  const pauseBtn = h('button', { class: 'btn', onclick: () => {
    if (over) return;
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    if (paused) playtimer.stop(); else playtimer.start();
  } }, 'Pause');
  const fastBtn = h('button', { class: 'btn', 'aria-pressed': 'false', onclick: () => {
    fast = !fast;
    fastBtn.textContent = fast ? 'Speed 2×' : 'Speed 1×';
    fastBtn.setAttribute('aria-pressed', String(fast));
  } }, 'Speed 1×');
  const controls = h('div', { class: 'controls' }, pauseBtn, fastBtn);
  const stage = h('div', { class: 'stage' }, wrap, controls);
  el.append(bar, limitEl, stage);

  let scale = 1;
  const size = () => {
    const availW = Math.min(viewWidth() - 32, 528);
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

  // --- Shop between waves ---
  const coin = n => `● ${n}`;
  function renderShop() {
    shop.hidden = state.phase !== 'shop';
    if (shop.hidden) return;
    const s = state, N = level.waves.length;
    const buy = (fn) => () => { if (fn()) renderShop(); };
    const upBtn = (id, kind, label) => {
      const lv = s.weapons[id][kind === 'dmg' ? 'dl' : 'rl'];
      const maxed = lv >= MAX_LEVEL, c = upgradeCost(kind, lv);
      return h('button', {
        class: 'btn small gt-up', disabled: maxed || s.coins < c,
        onclick: buy(() => buyUpgrade(s, id, kind)),
      }, `${label} ${lv}`, h('span', { class: 'gt-cost' }, maxed ? 'max' : coin(c)));
    };
    shop.replaceChildren(
      h('div', { class: 'gt-shop-head' },
        h('strong', {}, s.wave === 0 ? `${N} waves incoming` : `Wave ${s.wave} cleared`),
        h('span', { class: 'gt-coins' }, coin(s.coins))),
      ...WEAPON_ORDER.map(id => {
        const w = WEAPONS[id], owned = s.weapons[id];
        return h('div', { class: 'gt-row' },
          h('div', { class: 'gt-name' }, h('span', {}, w.name), h('span', { class: 'muted' }, BLURBS[id])),
          owned
            ? h('div', { class: 'gt-btns' }, upBtn(id, 'dmg', 'Dmg'), upBtn(id, 'rate', 'Rate'))
            : h('button', { class: 'btn small gt-up', disabled: s.coins < w.cost, onclick: buy(() => buyWeapon(s, id)) },
              'Buy', h('span', { class: 'gt-cost' }, coin(w.cost))));
      }),
      h('div', { class: 'gt-row' },
        h('div', { class: 'gt-name' }, h('span', {}, `Garlic ♥ ${s.hearts}/${s.maxHearts}`), h('span', { class: 'muted' }, `Heal ${HEAL_AMOUNT} hearts`)),
        h('button', {
          class: 'btn small gt-up', disabled: s.coins < HEAL_COST || s.hearts >= s.maxHearts, onclick: buy(() => buyHeal(s)),
        }, 'Heal', h('span', { class: 'gt-cost' }, coin(HEAL_COST)))),
      h('button', { class: 'btn big', onclick: () => { startWave(s); renderShop(); } }, `Start wave ${s.wave + 1} of ${N}`));
  }

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
  const font = (px, weight = 700) => `${weight} ${px}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  // One garlic per gun, with the gun pointing where it last fired.
  function drawGarlic(id, fg, muted) {
    const R = GARLIC_R, g = garlicAt(id);
    ctx.save();
    ctx.translate(g.x, g.y);
    // Bulb with a pointed top, cloves marked by curved lines.
    ctx.beginPath();
    ctx.moveTo(0, -R * 1.45);
    ctx.bezierCurveTo(R * 0.25, -R * 0.9, R * 1.15, -R * 0.75, R * 1.05, R * 0.15);
    ctx.bezierCurveTo(R, R * 0.85, R * 0.45, R, 0, R);
    ctx.bezierCurveTo(-R * 0.45, R, -R, R * 0.85, -R * 1.05, R * 0.15);
    ctx.bezierCurveTo(-R * 1.15, -R * 0.75, -R * 0.25, -R * 0.9, 0, -R * 1.45);
    ctx.closePath();
    ctx.fillStyle = '#f4efe2';
    ctx.fill();
    ctx.lineWidth = hurt > 0 ? 1.2 : 0.5;
    ctx.strokeStyle = hurt > 0 ? '#f94144' : muted;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120, 100, 70, .45)';
    ctx.lineWidth = 0.45;
    for (const k of [-0.45, 0, 0.45]) {
      ctx.beginPath();
      ctx.moveTo(0, -R * 1.2);
      ctx.quadraticCurveTo(R * k * 2.2, 0, R * k * 0.9, R * 0.95);
      ctx.stroke();
    }
    ctx.restore();
    const a = state.weapons[id].aim ?? -Math.PI / 2;
    const len = { handgun: 3, shotgun: 3.2, sniper: 6, machinegun: 4 }[id];
    ctx.strokeStyle = fg;
    ctx.lineCap = 'round';
    ctx.lineWidth = { handgun: 1.1, shotgun: 2, sniper: 0.9, machinegun: 1.5 }[id];
    ctx.beginPath();
    ctx.moveTo(g.x + Math.cos(a) * (R + 0.5), g.y + Math.sin(a) * (R + 0.5));
    ctx.lineTo(g.x + Math.cos(a) * (R + 0.5 + len), g.y + Math.sin(a) * (R + 0.5 + len));
    ctx.stroke();
  }

  // Blocks fade from bright to dim as they lose health.
  const dimmed = (hex, frac) => {
    const k = 0.3 + 0.7 * Math.max(0, Math.min(1, frac));
    return `rgb(${[1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).join(',')})`;
  };
  const SHOW_NUMBER = new Set(['brute', 'splitter', 'boss']);

  function draw() {
    const fg = css('--fg'), muted = css('--muted');
    ctx.clearRect(0, 0, W, H);

    // Faint range rings: how far each gun reaches from its garlic (the sniper reaches everywhere).
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.13;
    ctx.lineWidth = 0.35;
    ctx.setLineDash([1.6, 1.6]);
    for (const id of WEAPON_ORDER) {
      if (!state.weapons[id] || WEAPONS[id].range >= Math.max(W, H)) continue;
      const g = garlicAt(id);
      ctx.beginPath();
      ctx.arc(g.x, g.y, WEAPONS[id].range, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    for (const e of state.enemies) {
      const s = e.size;
      roundRect(e.x - s, e.y - s, s * 2, s * 2, s * 0.35);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : dimmed(COLOURS[e.type], e.hp / e.max);
      ctx.fill();
      if (e.id === state.focus) {
        ctx.strokeStyle = fg;
        ctx.lineWidth = 0.7;
        roundRect(e.x - s - 1.3, e.y - s - 1.3, s * 2 + 2.6, s * 2 + 2.6, s * 0.5);
        ctx.stroke();
      }
      if (!SHOW_NUMBER.has(e.type)) continue;
      ctx.fillStyle = e.hp / e.max > 0.45 ? '#000' : '#fff';
      ctx.font = font(Math.max(2.2, s * 0.8));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.ceil(e.hp)), e.x, e.y + 0.2);
    }

    ctx.fillStyle = fg;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.kind === 'sniper' ? 0.9 : 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const id of WEAPON_ORDER) if (state.weapons[id]) drawGarlic(id, fg, muted);

    // Status along the top: wave, hearts, coins.
    ctx.fillStyle = fg;
    ctx.font = font(W * 0.04, 600);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(`Wave ${Math.min(state.wave + 1, level.waves.length)}/${level.waves.length}`, 3, 3);
    ctx.textAlign = 'center';
    ctx.fillText(`♥ ${state.hearts}`, W / 2, 3);
    ctx.textAlign = 'right';
    ctx.fillText(`● ${state.coins}`, W - 3, 3);

    if (paused && !over) {
      ctx.font = font(W * 0.065, 600);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Paused', W / 2, CY - H * 0.15);
    }
  }

  // --- Loop ---
  const tick = now => {
    raf = requestAnimationFrame(tick);
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused && !over && !document.hidden && state.phase === 'fight') {
      if (fast) dt *= 2;
      for (let left = dt; left > 0; left -= 0.02) step(state, level, Math.min(0.02, left));
      timerEl.textContent = fmtTime(state.time);
      if (state.hearts < shownHearts) hurt = 0.3;
      shownHearts = state.hearts;
      if (state.phase === 'shop') renderShop();
      else if (state.phase === 'won' || state.phase === 'lost') finish();
    }
    hurt = Math.max(0, hurt - dt);
    draw();
  };
  cleanups.push(() => cancelAnimationFrame(raf));

  // Tap a block to make every weapon focus on it.
  canvas.addEventListener('pointerdown', e => {
    if (state.phase !== 'fight' || paused) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
    const hitE = state.enemies
      .filter(en => Math.abs(en.x - x) < en.size + 5 && Math.abs(en.y - y) < en.size + 5)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    state.focus = hitE ? hitE.id : null;
  });

  const nextHref = () => `${mode === 'custom' ? customHref(opts) : `${HOME}/play?mode=random`}&k=${Date.now()}`;

  function finish() {
    over = true;
    remove(SAVE_KEY);
    playtimer.stop();
    controls.hidden = true;
    shop.hidden = true;
    const seconds = Math.round(state.time);
    if (state.phase === 'won') {
      stats.recordWin({ s: seconds, m: mode, d: opts.difficulty, w: level.waves.length, hearts: state.hearts });
      stage.append(h('div', { class: 'win card' },
        h('h2', {}, 'The garlic is safe'),
        h('p', { class: 'win-time' }, fmtTime(seconds)),
        h('p', { class: 'muted' }, `${state.kills} blocks destroyed · ♥ ${state.hearts} left`),
        h('div', { class: 'row-btns' },
          h('a', { class: 'btn big', href: nextHref() }, 'Next level'),
          h('a', { class: 'btn big ghost', href: HOME }, 'Menu'))));
    } else {
      stats.recordFail();
      stage.append(h('div', { class: 'win card' },
        h('h2', {}, 'The garlic got squashed'),
        h('p', { class: 'muted' }, `Made it to wave ${state.wave + 1} of ${level.waves.length}.`),
        h('div', { class: 'row-btns' },
          h('button', { class: 'btn big', onclick: restart }, 'Try again'),
          h('a', { class: 'btn big ghost', href: nextHref() }, 'New level'))));
    }
  }

  function restart() {
    state = newGame(level);
    shownHearts = state.hearts;
    over = false;
    paused = false;
    pauseBtn.textContent = 'Pause';
    stage.querySelector('.win')?.remove();
    controls.hidden = false;
    timerEl.textContent = '0:00';
    renderShop();
    playtimer.start();
  }

  renderShop();
  playtimer.start();
  raf = requestAnimationFrame(tick);
  cleanups.push(autosave(() => {
    if (!over) save(SAVE_KEY, { mode, opts, level, state });
  }));

  return {
    unmount() {
      cleanups.forEach(fn => fn());
    },
  };
}
