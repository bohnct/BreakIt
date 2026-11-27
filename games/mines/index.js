import { h, header, fmtTime, chips, statTile, breakdown } from '../../js/ui.js';
import { load, save } from '../../js/storage.js';
import { summarize } from '../../js/stats.js';
import { preview } from '../../js/previews.js';
import { DIFFICULTIES, SIZES } from './engine.js';
import { stats } from './stats.js';
import { mountBoard, getSavedGame, customHref, cap, sizeLabel } from './board.js';

export const TITLE = 'No-Guess Mines';
const HOME = '#/game/mines';
const CUSTOM_KEY = 'games.mines.custom';

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
    preview('mines'),
    h('nav', { class: 'list' },
      saved && h('a', { class: 'btn big continue', href: `${HOME}/play?resume=1&k=${Date.now()}` },
        h('span', {}, 'Continue'),
        h('span', { class: 'continue-sub' }, `${saved.level.w}×${saved.level.h} · ${cap(saved.opts.difficulty)} · ${fmtTime(saved.acc / 1000)}`)),
      h('a', { class: 'btn big', href: `${HOME}/play?mode=random` }, 'Random level'),
      h('a', { class: 'btn big', href: `${HOME}/custom` }, 'Custom level'),
      h('a', { class: 'btn big ghost', href: `${HOME}/stats` }, 'Stats')),
    h('details', { class: 'card how' },
      h('summary', {}, 'How to play'),
      h('p', {}, 'Open every square that isn\'t a mine. Each number says how many mines touch that square, diagonals included.'),
      h('p', {}, 'Tap to dig. Hold a square, or switch to Flag at the top, to flag a mine. Tap a number whose mines are all flagged to open the rest of its neighbours.'),
      h('p', {}, 'The game opens a safe area to start from, and every mine can then be found by logic: you never have to guess. Dig a mine by mistake and you can take it back.')));
}

function renderCustom(el) {
  const cfg = { size: 'medium', difficulty: 'medium', ...load(CUSTOM_KEY, {}) };
  if (!SIZES[cfg.size]) cfg.size = 'medium';
  el.append(
    header('Custom level', HOME),
    h('section', { class: 'card' },
      h('h2', {}, 'Board size'),
      chips(Object.keys(SIZES).map(s => ({ value: s, label: sizeLabel(s) })), cfg.size, 'Board size', v => { cfg.size = v; })),
    h('section', { class: 'card' },
      h('h2', {}, 'Difficulty'),
      chips(DIFFICULTIES.map(d => ({ value: d, label: cap(d) })), cfg.difficulty, 'Difficulty', v => { cfg.difficulty = v; }),
      h('p', { class: 'muted' }, 'Easy: 12% mines, simple steps. Medium: 15% mines, and at least one square you can only work out by comparing two numbers. Hard: 18% mines, and a few of those.')),
    h('div', { class: 'foot' },
      h('button', { class: 'btn big', onclick: () => {
        save(CUSTOM_KEY, cfg);
        location.hash = customHref(cfg);
      } }, 'Start')));
}

function renderStats(el) {
  const st = stats.get();
  const all = summarize(st.results);
  const clean = st.results.filter(r => !r.x).length;
  el.append(...[
    header('Stats', HOME),
    h('div', { class: 'stats' },
      statTile('Boards cleared', st.completed),
      statTile('Started', st.started),
      statTile('No slips', clean),
      statTile('Average', fmtTime(all.avg)),
      statTile('Fastest', fmtTime(all.min)),
      statTile('Slowest', fmtTime(all.max))),
    breakdown('By difficulty', DIFFICULTIES.map(d => ({ label: cap(d), sum: summarize(st.results.filter(r => r.d === d)) }))),
    breakdown('By size', Object.keys(SIZES).map(s => ({ label: sizeLabel(s), sum: summarize(st.results.filter(r => r.z === s)) }))),
    st.completed ? null : h('p', { class: 'muted center' }, 'Clear a board to see your times here.'),
  ].filter(Boolean));
}
