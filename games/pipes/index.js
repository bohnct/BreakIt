import { h, header, fmtTime, chips, statTile, breakdown } from '../../js/ui.js';
import { load, save } from '../../js/storage.js';
import { summarize } from '../../js/stats.js';
import { preview } from '../../js/previews.js';
import { DIFFICULTIES, SIZES } from './engine.js';
import { stats } from './stats.js';
import { mountBoard, getSavedGame, customHref, cap, watered } from './board.js';

export const TITLE = 'Watering the Garden';
const HOME = '#/game/pipes';
const CUSTOM_KEY = 'games.pipes.custom';

export function mount(el, parts, query) {
  switch (parts[0]) {
    case 'custom': return renderCustom(el);
    case 'stats': return renderStats(el);
    case 'play': return mountBoard(el, query);
    default: return renderLanding(el);
  }
}

function renderLanding(el) {
  const saved = getSavedGame();
  const w = saved && watered(saved.level, saved.turns);
  el.append(
    header(TITLE, '#/'),
    preview('pipes'),
    h('nav', { class: 'list' },
      saved && h('a', { class: 'btn big continue', href: `${HOME}/play?resume=1&k=${Date.now()}` },
        h('span', {}, 'Continue'),
        h('span', { class: 'continue-sub' }, `${saved.opts.n}×${saved.opts.n} · ${cap(saved.opts.difficulty)} · ${w.wet}/${w.all} · ${fmtTime(saved.acc / 1000)}`)),
      h('a', { class: 'btn big', href: `${HOME}/play?mode=random` }, 'Random level'),
      h('a', { class: 'btn big', href: `${HOME}/custom` }, 'Custom level'),
      h('a', { class: 'btn big ghost', href: `${HOME}/stats` }, 'Stats')),
    h('details', { class: 'card how' },
      h('summary', {}, 'How to play'),
      h('p', {}, 'Water flows from the tap through any pipes that meet. Tap a pipe to turn it a quarter turn clockwise.'),
      h('p', {}, 'Every pipe must fill with water, every plant must get a drink, and no pipe end may be left open and leaking. Pipes never form a loop.'),
      h('p', {}, 'Hold a pipe to lock it once you\'re sure of it; hold again to unlock. Every level has exactly one answer, so each pipe can be worked out: start with the edges, where pipes can\'t point at the wall.')));
}

function renderCustom(el) {
  const cfg = { n: 7, difficulty: 'medium', ...load(CUSTOM_KEY, {}) };
  if (!SIZES.includes(cfg.n)) cfg.n = 7;
  el.append(
    header('Custom level', HOME),
    h('section', { class: 'card' },
      h('h2', {}, 'Garden size'),
      chips(SIZES.map(n => ({ value: n, label: `${n}×${n}` })), cfg.n, 'Garden size', v => { cfg.n = v; })),
    h('section', { class: 'card' },
      h('h2', {}, 'Difficulty'),
      chips(DIFFICULTIES.map(d => ({ value: d, label: cap(d) })), cfg.difficulty, 'Difficulty', v => { cfg.difficulty = v; }),
      h('p', { class: 'muted' }, 'Easy can be solved one pipe at a time from its neighbours. Medium also needs you to avoid loops and sealed-off pipes. Hard needs you to think a move ahead.')),
    h('div', { class: 'foot' },
      h('button', { class: 'btn big', onclick: () => {
        save(CUSTOM_KEY, cfg);
        location.hash = customHref(cfg);
      } }, 'Start')));
}

function renderStats(el) {
  const st = stats.get();
  const all = summarize(st.results);
  const sizes = [...new Set(st.results.map(r => r.n))].sort((a, b) => a - b);
  el.append(...[
    header('Stats', HOME),
    h('div', { class: 'stats' },
      statTile('Gardens watered', st.completed),
      statTile('Started', st.started),
      statTile('Total time', fmtTime(st.results.reduce((a, r) => a + r.s, 0))),
      statTile('Average', fmtTime(all.avg)),
      statTile('Fastest', fmtTime(all.min)),
      statTile('Slowest', fmtTime(all.max))),
    breakdown('By difficulty', DIFFICULTIES.map(d => ({ label: cap(d), sum: summarize(st.results.filter(r => r.d === d)) }))),
    breakdown('By size', sizes.map(n => ({ label: `${n}×${n}`, sum: summarize(st.results.filter(r => r.n === n)) }))),
    st.completed ? null : h('p', { class: 'muted center' }, 'Water a garden to see your times here.'),
  ].filter(Boolean));
}
