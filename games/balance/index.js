import { h, header, fmtTime, chips, statTile, breakdown } from '../../js/ui.js';
import { load, save } from '../../js/storage.js';
import { summarize } from '../../js/stats.js';
import { preview } from '../../js/previews.js';
import { DIFFICULTIES } from './engine.js';
import { stats } from './stats.js';
import { mountBoard, getSavedGame, customHref, cap } from './board.js';

export const TITLE = 'Balance Priorities';
const HOME = '#/game/balance';
const CUSTOM_KEY = 'games.balance.custom';

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
    preview('balance'),
    h('nav', { class: 'list' },
      saved && h('a', { class: 'btn big continue', href: `${HOME}/play?resume=1&k=${Date.now()}` },
        h('span', {}, 'Continue'),
        h('span', { class: 'continue-sub' }, `${cap(saved.opts.difficulty)} · ${saved.place.filter(p => p >= 0).length}/${saved.place.length} placed · ${fmtTime(saved.acc / 1000)}`)),
      h('a', { class: 'btn big', href: `${HOME}/play?mode=random` }, 'Random level'),
      h('a', { class: 'btn big', href: `${HOME}/custom` }, 'Custom level'),
      h('a', { class: 'btn big ghost', href: `${HOME}/stats` }, 'Stats')),
    h('details', { class: 'card how' },
      h('summary', {}, 'How to play'),
      h('p', {}, 'Put every block on the scale so it balances. Each side has three spots, one, two and three steps from the middle (the dots under the beam), and each spot holds one block.'),
      h('p', {}, 'A block weighs as much as its number of squares, and counts for more the further out it sits: a 2 at the far end balances a 3 two steps out on the other side.'),
      h('p', {}, 'The beam tips toward the heavier side, and the numbers at the top (left : right) add up weight × distance for each side. Tap a block, then a spot. Tap a placed block to move it, or tap the tray to send it back.'),
      h('p', {}, 'Every level has just one answer (its mirror image counts too).')));
}

function renderCustom(el) {
  const cfg = { difficulty: 'medium', ...load(CUSTOM_KEY, {}) };
  el.append(
    header('Custom level', HOME),
    h('section', { class: 'card' },
      h('h2', {}, 'Difficulty'),
      chips(DIFFICULTIES.map(d => ({ value: d, label: cap(d) })), cfg.difficulty, 'Difficulty', v => { cfg.difficulty = v; }),
      h('p', { class: 'muted' }, 'Easy: 3 blocks, now and then 4. Medium: 4 or 5 blocks. Hard: 6 blocks filling every spot, with weights close together.')),
    h('div', { class: 'foot' },
      h('button', { class: 'btn big', onclick: () => {
        save(CUSTOM_KEY, cfg);
        location.hash = customHref(cfg);
      } }, 'Start')));
}

function renderStats(el) {
  const st = stats.get();
  const all = summarize(st.results);
  const counts = [...new Set(st.results.map(r => r.n))].sort((a, b) => a - b);
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
    breakdown('By blocks', counts.map(n => ({ label: `${n} blocks`, sum: summarize(st.results.filter(r => r.n === n)) }))),
    st.completed ? null : h('p', { class: 'muted center' }, 'Solve a level to see your times here.'),
  ].filter(Boolean));
}
