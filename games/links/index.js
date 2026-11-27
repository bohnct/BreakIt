import { h, header, fmtTime, chips, statTile, breakdown } from '../../js/ui.js';
import { load, save } from '../../js/storage.js';
import { summarize } from '../../js/stats.js';
import { preview } from '../../js/previews.js';
import { DIFFICULTIES, SIZES } from './engine.js';
import { stats } from './stats.js';
import { mountBoard, getSavedGame, customHref, cap, linked } from './board.js';

export const TITLE = 'Colour Links';
const HOME = '#/game/links';
const CUSTOM_KEY = 'games.links.custom';

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
  el.append(
    header(TITLE, '#/'),
    preview('links'),
    h('nav', { class: 'list' },
      saved && h('a', { class: 'btn big continue', href: `${HOME}/play?resume=1&k=${Date.now()}` },
        h('span', {}, 'Continue'),
        h('span', { class: 'continue-sub' }, `${saved.opts.n}×${saved.opts.n} · ${cap(saved.opts.difficulty)} · ${linked(saved.level, saved.paths)}/${saved.level.ends.length} · ${fmtTime(saved.acc / 1000)}`)),
      h('a', { class: 'btn big', href: `${HOME}/play?mode=random` }, 'Random level'),
      h('a', { class: 'btn big', href: `${HOME}/custom` }, 'Custom level'),
      h('a', { class: 'btn big ghost', href: `${HOME}/stats` }, 'Stats')),
    h('details', { class: 'card how' },
      h('summary', {}, 'How to play'),
      h('p', {}, 'Join each pair of matching dots with a path. Drag from a dot to draw; paths move up, down, left and right, never diagonally.'),
      h('p', {}, 'Paths can\'t cross or share a square, and every square on the board must be covered. Drawing over another path cuts it short; back off and it comes back.'),
      h('p', {}, 'Drag from the middle of a path to redraw it from there. Every level has exactly one answer, so each square can be worked out.')));
}

function renderCustom(el) {
  const cfg = { n: 7, difficulty: 'medium', ...load(CUSTOM_KEY, {}) };
  if (!SIZES.includes(cfg.n)) cfg.n = 7;
  el.append(
    header('Custom level', HOME),
    h('section', { class: 'card' },
      h('h2', {}, 'Board size'),
      chips(SIZES.map(n => ({ value: n, label: `${n}×${n}` })), cfg.n, 'Board size', v => { cfg.n = v; })),
    h('section', { class: 'card' },
      h('h2', {}, 'Difficulty'),
      chips(DIFFICULTIES.map(d => ({ value: d, label: cap(d) })), cfg.difficulty, 'Difficulty', v => { cfg.difficulty = v; }),
      h('p', { class: 'muted' }, 'Harder levels have fewer pairs, so each path is longer and winds further.')),
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
      statTile('Levels solved', st.completed),
      statTile('Started', st.started),
      statTile('Total time', fmtTime(st.results.reduce((a, r) => a + r.s, 0))),
      statTile('Average', fmtTime(all.avg)),
      statTile('Fastest', fmtTime(all.min)),
      statTile('Slowest', fmtTime(all.max))),
    breakdown('By difficulty', DIFFICULTIES.map(d => ({ label: cap(d), sum: summarize(st.results.filter(r => r.d === d)) }))),
    breakdown('By size', sizes.map(n => ({ label: `${n}×${n}`, sum: summarize(st.results.filter(r => r.n === n)) }))),
    st.completed ? null : h('p', { class: 'muted center' }, 'Solve a level to see your times here.'),
  ].filter(Boolean));
}
