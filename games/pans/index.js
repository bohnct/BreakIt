import { h, header, fmtTime, chips, statTile, breakdown } from '../../js/ui.js';
import { preview } from '../../js/previews.js';
import { load, save } from '../../js/storage.js';
import { DIFFICULTIES } from './generator.js';
import { getStats, summarize } from './stats.js';
import { mountBoard, getSavedGame } from './board.js';

export const TITLE = 'Carter, Stop Hiding My Shit!';
const HOME = '#/game/pans';
const SIZES = [5, 6, 7, 8, 9, 10];
const CUSTOM_KEY = 'games.pans.custom';
const cap = s => s[0].toUpperCase() + s.slice(1);

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
    preview('pans'),
    h('nav', { class: 'list' },
      saved && h('a', { class: 'btn big continue', href: `${HOME}/play?resume=1&k=${Date.now()}` },
        h('span', {}, 'Continue'),
        h('span', { class: 'continue-sub' }, `${saved.n}×${saved.n} · ${cap(saved.difficulty)} · ${fmtTime(saved.seconds)}`)),
      h('a', { class: 'btn big', href: `${HOME}/play?mode=random` }, 'Random level'),
      h('a', { class: 'btn big', href: `${HOME}/custom` }, 'Custom level'),
      h('a', { class: 'btn big ghost', href: `${HOME}/stats` }, 'Stats')),
    h('details', { class: 'card how' },
      h('summary', {}, 'How to play'),
      h('p', {}, 'Carter has hidden one frying pan in every row, every column and every colour.'),
      h('p', {}, 'Pans never touch each other, not even diagonally.'),
      h('p', {}, 'Tap a square once to mark ✕, twice to place a pan, three times to clear. Drag across squares to mark lots of ✕ at once.')));
}

function renderCustom(el) {
  const cfg = { n: 7, d: 'medium', ...load(CUSTOM_KEY, {}) };
  el.append(
    header('Custom level', HOME),
    h('section', { class: 'card' },
      h('h2', {}, 'Grid size'),
      chips(SIZES.map(n => ({ value: n, label: `${n}×${n}` })), cfg.n, 'Grid size', v => { cfg.n = v; }),
      h('p', { class: 'muted' }, 'Pans to find = grid size.')),
    h('section', { class: 'card' },
      h('h2', {}, 'Difficulty'),
      chips(DIFFICULTIES.map(d => ({ value: d, label: cap(d) })), cfg.d, 'Difficulty', v => { cfg.d = v; })),
    h('div', { class: 'foot' },
      h('button', { class: 'btn big', onclick: () => {
        save(CUSTOM_KEY, cfg);
        location.hash = `${HOME}/play?mode=custom&n=${cfg.n}&d=${cfg.d}`;
      } }, 'Start')));
}

function renderStats(el) {
  const st = getStats();
  const all = summarize(st.results);
  el.append(...[
    header('Stats', HOME),
    h('div', { class: 'stats' },
      statTile('Levels played', st.completed),
      statTile('Started', st.started),
      statTile('Average', fmtTime(all.avg)),
      statTile('Fastest', fmtTime(all.min)),
      statTile('Slowest', fmtTime(all.max)),
      statTile('Total time', fmtTime(st.results.reduce((a, r) => a + r.s, 0)))),
    breakdown('By grid size', SIZES.map(n => ({ label: `${n}×${n}`, sum: summarize(st.results.filter(r => r.n === n)) }))),
    breakdown('By difficulty', DIFFICULTIES.map(d => ({ label: cap(d), sum: summarize(st.results.filter(r => r.d === d)) }))),
    st.completed ? null : h('p', { class: 'muted center' }, 'Finish a level to see your times here.'),
  ].filter(Boolean));
}
