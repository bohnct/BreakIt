import { h, header, fmtTime, chips, statTile, breakdown } from '../../js/ui.js';
import { load, save } from '../../js/storage.js';
import { summarize } from '../../js/stats.js';
import { preview } from '../../js/previews.js';
import { DIFFICULTIES, SIZES } from './engine.js';
import { stats } from './stats.js';
import { mountBoard, getSavedGame, customHref, cap, SIZE_LABELS } from './board.js';

export const TITLE = 'Block Game';
const HOME = '#/game/mahjong';
const CUSTOM_KEY = 'games.mahjong.custom';

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
    preview('mahjong'),
    h('nav', { class: 'list' },
      saved && h('a', { class: 'btn big continue', href: `${HOME}/play?resume=1&k=${Date.now()}` },
        h('span', {}, 'Continue'),
        h('span', { class: 'continue-sub' }, `${cap(saved.opts.difficulty)} · ${saved.tiles.filter(t => !t.gone).length / 2} pairs left · ${fmtTime(saved.acc / 1000)}`)),
      h('a', { class: 'btn big', href: `${HOME}/play?mode=random` }, 'Random board'),
      h('a', { class: 'btn big', href: `${HOME}/custom` }, 'Custom board'),
      h('a', { class: 'btn big ghost', href: `${HOME}/stats` }, 'Stats')),
    h('details', { class: 'card how' },
      h('summary', {}, 'How to play'),
      h('p', {}, 'Clear the board by matching pairs of identical tiles. Tap one tile, then its twin.'),
      h('p', {}, 'Only free tiles can be picked: nothing on top of them, and an open side on the left or right. Blocked tiles look darker.'),
      h('p', {}, 'Every board can be cleared. On Medium and Hard each design appears four times, so think about which two to match: the wrong pair can bury the tiles you need.'),
      h('p', {}, 'If you run out of matches you can undo, or shuffle the tiles that are left.')));
}

function renderCustom(el) {
  const cfg = { difficulty: 'medium', size: 'medium', ...load(CUSTOM_KEY, {}) };
  el.append(
    header('Custom board', HOME),
    h('section', { class: 'card' },
      h('h2', {}, 'Difficulty'),
      chips(DIFFICULTIES.map(d => ({ value: d, label: cap(d) })), cfg.difficulty, 'Difficulty', v => { cfg.difficulty = v; }),
      h('p', { class: 'muted' }, 'Easy: two layers, and every design is a single pair. Medium: three layers, designs come in fours. Hard: stacks up to five high, designs in fours.')),
    h('section', { class: 'card' },
      h('h2', {}, 'Board size'),
      chips(Object.keys(SIZES).map(s => ({ value: s, label: `${SIZE_LABELS[s]} · ~${SIZES[s].target}` })), cfg.size, 'Board size', v => { cfg.size = v; })),
    h('div', { class: 'foot' },
      h('button', { class: 'btn big', onclick: () => {
        save(CUSTOM_KEY, cfg);
        location.hash = customHref(cfg);
      } }, 'Start')));
}

function renderStats(el) {
  const st = stats.get();
  const all = summarize(st.results);
  el.append(...[
    header('Stats', HOME),
    h('div', { class: 'stats' },
      statTile('Boards cleared', st.completed),
      statTile('Started', st.started),
      statTile('Total time', fmtTime(st.results.reduce((a, r) => a + r.s, 0))),
      statTile('Average', fmtTime(all.avg)),
      statTile('Fastest', fmtTime(all.min)),
      statTile('Slowest', fmtTime(all.max))),
    breakdown('By difficulty', DIFFICULTIES.map(d => ({ label: cap(d), sum: summarize(st.results.filter(r => r.d === d)) }))),
    breakdown('By size', Object.keys(SIZES).map(s => ({ label: SIZE_LABELS[s], sum: summarize(st.results.filter(r => r.z === s)) }))),
    st.completed ? null : h('p', { class: 'muted center' }, 'Clear a board to see your times here.'),
  ].filter(Boolean));
}
