import { h, header, fmtTime } from '../../js/ui.js';
import { load, save } from '../../js/storage.js';
import { DIFFICULTIES } from './generator.js';
import { getStats, summarize } from './stats.js';
import { mountBoard } from './board.js';

export const TITLE = 'Carter, stop hiding my sh@&!';
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
  el.append(
    header(TITLE, '#/'),
    h('div', { class: 'hero' },
      h('div', { class: 'swatches' },
        ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590']
          .map(c => h('span', { style: `background:${c}` })))),
    h('nav', { class: 'list' },
      h('a', { class: 'btn big', href: `${HOME}/play?mode=random` }, 'Random level'),
      h('a', { class: 'btn big', href: `${HOME}/custom` }, 'Custom level'),
      h('a', { class: 'btn big ghost', href: `${HOME}/stats` }, 'Stats')),
    h('details', { class: 'card how' },
      h('summary', {}, 'How to play'),
      h('p', {}, 'Carter has hidden one frying pan in every row, every column and every colour.'),
      h('p', {}, 'Pans never touch each other, not even diagonally.'),
      h('p', {}, 'Tap a square once to mark ✕, twice to place a pan, three times to clear. Drag across squares to mark lots of ✕ at once.')));
}

function chips(options, value, label, onPick) {
  const wrap = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': label });
  const draw = v => {
    wrap.replaceChildren(...options.map(o => h('button', {
      class: 'chip' + (o.value === v ? ' on' : ''), role: 'radio', 'aria-checked': String(o.value === v),
      onclick: () => { onPick(o.value); draw(o.value); },
    }, o.label)));
  };
  draw(value);
  return wrap;
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

function statTile(label, value) {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-val' }, value), h('span', { class: 'stat-lbl' }, label));
}

function breakdown(title, groups) {
  const rows = groups.filter(g => g.sum.count);
  if (!rows.length) return null;
  return h('section', { class: 'card' },
    h('h2', {}, title),
    h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['', 'Done', 'Avg', 'Min', 'Max'].map(t => h('th', {}, t)))),
      h('tbody', {}, rows.map(g => h('tr', {},
        h('td', {}, g.label), h('td', {}, g.sum.count),
        h('td', {}, fmtTime(g.sum.avg)), h('td', {}, fmtTime(g.sum.min)), h('td', {}, fmtTime(g.sum.max)))))));
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
