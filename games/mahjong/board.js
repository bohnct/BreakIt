import { h, header, fmtTime, toast } from '../../js/ui.js';
import { load, save, remove } from '../../js/storage.js';
import { SORT_COLOURS } from '../../js/colours.js';
import * as playtimer from '../../js/playtimer.js';
import { autosave } from '../../js/autosave.js';
import { DIFFICULTIES, SIZES, newDeal, isFree, matches, won, reshuffle } from './engine.js';
import { stats } from './stats.js';

const HOME = '#/game/mahjong';
const SAVE_KEY = 'games.mahjong.saved';
const PAD = 14;
// Tile designs: six symbols in six palette colours.
const COLOURS = SORT_COLOURS; // high-contrast set, see js/colours.js
const SYMBOLS = [
  c => `<circle cx="12" cy="12" r="7" fill="${c}"/>`,
  c => `<rect x="5.5" y="5.5" width="13" height="13" rx="2.5" fill="${c}"/>`,
  c => `<path d="M12 4 20.5 19.5H3.5Z" fill="${c}" stroke="${c}" stroke-linejoin="round" stroke-width="1.5"/>`,
  c => `<path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" fill="${c}"/>`,
  c => `<path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z" fill="${c}"/>`,
  c => `<circle cx="12" cy="12" r="6.5" fill="none" stroke="${c}" stroke-width="3.6"/>`,
];
export const SIZE_LABELS = { small: 'Small', medium: 'Medium', large: 'Large' };

export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const getSavedGame = () => load(SAVE_KEY, null);
const faceSvg = f => `<svg viewBox="0 0 24 24" aria-hidden="true">${SYMBOLS[f % 6](COLOURS[Math.floor(f / 6) % 6])}</svg>`;

export function optsFromQuery(query) {
  if (query.get('mode') !== 'custom') {
    const hard = Math.random() < 0.5;
    return { difficulty: hard ? 'hard' : 'medium', size: hard ? 'large' : Math.random() < 0.5 ? 'medium' : 'large' };
  }
  return {
    difficulty: DIFFICULTIES.includes(query.get('d')) ? query.get('d') : 'medium',
    size: query.get('s') in SIZES ? query.get('s') : 'medium',
  };
}
export const customHref = o => `${HOME}/play?mode=custom&d=${o.difficulty}&s=${o.size}`;

export function mountBoard(el, query) {
  const saved = query.get('resume') ? getSavedGame() : null;
  remove(SAVE_KEY); // resumed, or replaced by this new game
  const mode = saved ? saved.mode : query.get('mode') === 'custom' ? 'custom' : 'random';
  const opts = saved ? saved.opts : optsFromQuery(query);
  let deal = saved ? saved.deal : newDeal(opts);
  if (!saved) stats.recordStart();
  let tiles = saved ? saved.tiles : deal.tiles.map(t => ({ ...t }));
  let acc = saved ? saved.acc : 0, shuffles = saved ? saved.shuffles : 0;
  let history = [], selected = null, over = false, last = Date.now();
  const cleanups = [];

  const timerEl = h('span', { class: 'timer' }, fmtTime(acc / 1000));
  const bar = header(`${cap(opts.difficulty)} · ${SIZE_LABELS[opts.size]}`, HOME);
  bar.querySelector('.bar-right').append(timerEl);
  const limitEl = h('div', { class: 'limit muted' });
  const showLimit = rem => { limitEl.textContent = rem == null ? '' : `Play time left ${fmtTime(rem / 1000)}`; };
  showLimit(playtimer.remainingMs());
  cleanups.push(playtimer.onTick(showLimit));

  const status = h('div', { class: 'mj-status muted' });
  const boardEl = h('div', { class: 'mj-board' });
  const els = tiles.map((t, i) => h('div', { class: 'mj-tile', 'data-i': i, html: faceSvg(t.face) }));
  boardEl.append(...els);
  const shuffleBtn = h('button', { class: 'btn', hidden: true, onclick: () => doShuffle() }, 'Shuffle');
  const controls = h('div', { class: 'controls' },
    h('button', { class: 'btn', onclick: () => undo() }, 'Undo'),
    shuffleBtn,
    h('button', { class: 'btn', onclick: () => restart() }, 'Restart'));
  const stage = h('div', { class: 'stage' }, controls, status, boardEl);
  el.append(bar, limitEl, stage);

  // --- Layout ---
  const cols = Math.max(...tiles.map(t => t.x)) + 1, rows = Math.max(...tiles.map(t => t.y)) + 1;
  let tw = 40, th = 52, dz = 4;
  const size = () => {
    const W = Math.min(window.innerWidth - 32, 528);
    tw = Math.floor((W - PAD * 2) / cols);
    th = Math.min(Math.round(tw * 1.3), Math.floor((window.innerHeight - 260) / rows));
    tw = Math.min(tw, Math.round(th / 1.15));
    dz = Math.max(3, Math.round(tw * 0.09));
    boardEl.style.width = `${cols * tw + PAD * 2}px`;
    boardEl.style.height = `${rows * th + PAD * 2}px`;
    boardEl.style.setProperty('--tw', `${tw - 2}px`);
    boardEl.style.setProperty('--th', `${th - 2}px`);
    render();
  };

  function render() {
    tiles.forEach((t, i) => {
      const e = els[i];
      e.hidden = t.gone;
      if (t.gone) return;
      e.innerHTML = faceSvg(t.face);
      e.style.left = `${PAD + t.x * tw - t.z * dz}px`;
      e.style.top = `${PAD + t.y * th - t.z * dz}px`;
      e.style.zIndex = t.z * 100 + t.y;
      e.classList.toggle('blocked', !isFree(tiles, i));
      e.classList.toggle('selected', selected === i);
    });
    const left = tiles.filter(t => !t.gone).length / 2;
    const stuck = !over && left > 0 && !matches(tiles).length;
    // Sometimes the tiles left are stacked so that no shuffle can clear them (say, a single
    // tower): then only undoing helps.
    const canShuffle = stuck && reshuffle(tiles.map(t => ({ ...t })), deal.copies);
    status.textContent = !stuck ? `${left} pairs left${shuffles ? ` · ${shuffles} shuffle${shuffles > 1 ? 's' : ''}` : ''}`
      : canShuffle ? 'No matches left: shuffle the tiles, or undo.'
      : 'These tiles can\'t all be cleared now. Undo a few moves and try different pairs.';
    status.classList.toggle('stuck', stuck);
    shuffleBtn.hidden = !canShuffle;
  }

  // --- Play ---
  boardEl.addEventListener('click', e => {
    const tileEl = e.target.closest('.mj-tile');
    if (!tileEl || over) return;
    const i = +tileEl.dataset.i;
    if (!isFree(tiles, i)) {
      tileEl.classList.remove('shake');
      void tileEl.offsetWidth;
      tileEl.classList.add('shake');
      return;
    }
    if (selected === i) selected = null;
    else if (selected != null && tiles[selected].face === tiles[i].face) {
      history.push(tiles.map(t => ({ ...t })));
      tiles[selected].gone = tiles[i].gone = true;
      selected = null;
      if (won(tiles)) { render(); return finish(); }
    } else selected = i;
    render();
  });

  function undo() {
    if (over || !history.length) return;
    tiles = history.pop();
    selected = null;
    render();
  }
  function restart() {
    if (over) return;
    history.push(tiles.map(t => ({ ...t })));
    tiles = deal.tiles.map(t => ({ ...t }));
    selected = null;
    render();
  }
  function doShuffle() {
    history.push(tiles.map(t => ({ ...t })));
    if (reshuffle(tiles, deal.copies)) {
      shuffles++;
      toast('Shuffled');
    } else history.pop();
    selected = null;
    render();
  }

  const nextHref = () => `${mode === 'custom' ? customHref(opts) : `${HOME}/play?mode=random`}&k=${Date.now()}`;
  function finish() {
    over = true;
    remove(SAVE_KEY);
    playtimer.stop();
    controls.hidden = true;
    const seconds = Math.round(acc / 1000);
    stats.recordWin({ s: seconds, m: mode, d: opts.difficulty, z: opts.size, shuffles });
    stage.append(h('div', { class: 'win card' },
      h('h2', {}, 'Board cleared'),
      h('p', { class: 'win-time' }, fmtTime(seconds)),
      h('p', { class: 'muted' }, shuffles ? `${shuffles} shuffle${shuffles > 1 ? 's' : ''} used` : 'No shuffles needed'),
      h('div', { class: 'row-btns' },
        h('a', { class: 'btn big', href: nextHref() }, 'Next board'),
        h('a', { class: 'btn big ghost', href: HOME }, 'Menu'))));
  }

  const clock = setInterval(() => {
    const now = Date.now();
    if (!document.hidden && !over) acc += Math.max(0, now - last);
    last = now;
    timerEl.textContent = fmtTime(Math.floor(acc / 1000));
  }, 250);
  cleanups.push(() => clearInterval(clock));
  cleanups.push(autosave(() => { if (!over) save(SAVE_KEY, { mode, opts, deal, tiles, acc, shuffles }); }));

  size();
  window.addEventListener('resize', size);
  cleanups.push(() => window.removeEventListener('resize', size));
  playtimer.start();

  return { unmount() { cleanups.forEach(fn => fn()); } };
}
