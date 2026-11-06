import { h, header, fmtTime, chips, statTile, breakdown } from '../../js/ui.js';
import { preview } from '../../js/previews.js';
import { load, save, remove } from '../../js/storage.js';
import { summarize } from '../../js/stats.js';
import { DIFFICULTIES } from './engine.js';
import { stats } from './stats.js';
import { mountBoard, getSavedGame, customHref, cap, SIZES } from './board.js';

export const TITLE = 'Kelsey Blocked Me In Again!';
const HOME = '#/game/blocks';
const CUSTOM_KEY = 'games.blocks.cars.custom';

// The old sliding-block game's stats, saved game and settings don't fit the car game.
['games.blocks.stats', 'games.blocks.saved', 'games.blocks.custom'].forEach(remove);

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
    preview('blocks'),
    h('nav', { class: 'list' },
      saved && h('a', { class: 'btn big continue', href: `${HOME}/play?resume=1&k=${Date.now()}` },
        h('span', {}, 'Continue'),
        h('span', { class: 'continue-sub' }, `${saved.level.n}×${saved.level.n} · ${cap(saved.level.difficulty)} · ${saved.moves} moves · ${fmtTime(saved.acc / 1000)}`)),
      h('a', { class: 'btn big', href: `${HOME}/play?mode=random` }, 'Random level'),
      h('a', { class: 'btn big', href: `${HOME}/custom` }, 'Custom level'),
      h('a', { class: 'btn big ghost', href: `${HOME}/stats` }, 'Stats')),
    h('details', { class: 'card how' },
      h('summary', {}, 'How to play'),
      h('p', {}, 'Kelsey has boxed your red car in. Get it out through the gap in the right-hand wall.'),
      h('p', {}, 'Drag cars, trucks and buses to move them. Each one only drives forwards and backwards along its length, never sideways, and nothing can pass through anything else.'),
      h('p', {}, 'One move is one vehicle driving any distance. When you get out, you\'ll see how close you came to the fewest moves possible.')));
}

function renderCustom(el) {
  const cfg = { n: 6, difficulty: 'medium', ...load(CUSTOM_KEY, {}) };
  el.append(
    header('Custom level', HOME),
    h('section', { class: 'card' },
      h('h2', {}, 'Difficulty'),
      chips(DIFFICULTIES.map(d => ({ value: d, label: cap(d) })), cfg.difficulty, 'Difficulty', v => { cfg.difficulty = v; }),
      h('p', { class: 'muted' }, 'Easy: 4 to 8 moves. Medium: 10 to 16 moves. Hard: the longest the generator can find in a few seconds, usually 20 or more moves.')),
    h('section', { class: 'card' },
      h('h2', {}, 'Car park size'),
      chips(SIZES.map(s => ({ value: s, label: `${s}×${s}` })), cfg.n, 'Car park size', v => { cfg.n = v; }),
      h('p', { class: 'muted' }, 'Bigger car parks have buses (4 long) as well as cars and trucks. 8×8 takes a few seconds longer to set up.')),
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
      statTile('Levels played', st.completed),
      statTile('Started', st.started),
      statTile('Fewest moves', st.results.filter(r => r.mv === r.best).length),
      statTile('Average', fmtTime(all.avg)),
      statTile('Fastest', fmtTime(all.min)),
      statTile('Slowest', fmtTime(all.max))),
    breakdown('By difficulty', DIFFICULTIES.map(d => ({ label: cap(d), sum: summarize(st.results.filter(r => r.d === d)) }))),
    breakdown('By size', SIZES.map(s => ({ label: `${s}×${s}`, sum: summarize(st.results.filter(r => r.n === s)) }))),
    st.completed ? null : h('p', { class: 'muted center' }, 'Finish a level to see your times here.'),
  ].filter(Boolean));
}
