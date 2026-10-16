import { h, header, fmtTime, chips, toggleChips, statTile, breakdown } from '../../js/ui.js';
import { load, save } from '../../js/storage.js';
import { summarize } from '../../js/stats.js';
import { preview } from '../../js/previews.js';
import { DIFFICULTIES } from './engine.js';
import { stats } from './stats.js';
import { mountBoard, getSavedGame, customHref, cap, OBSTACLES } from './board.js';

export const TITLE = 'Circle Track';
const HOME = '#/game/loop';
const CUSTOM_KEY = 'games.loop.custom';

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
    preview('loop'),
    h('nav', { class: 'list' },
      saved && h('a', { class: 'btn big continue', href: `${HOME}/play?resume=1&k=${Date.now()}` },
        h('span', {}, 'Continue'),
        h('span', { class: 'continue-sub' }, `${cap(saved.opts.difficulty)} · ${fmtTime(saved.acc / 1000)}`)),
      h('a', { class: 'btn big', href: `${HOME}/play?mode=random` }, 'Random level'),
      h('a', { class: 'btn big', href: `${HOME}/custom` }, 'Custom level'),
      h('a', { class: 'btn big ghost', href: `${HOME}/stats` }, 'Stats')),
    h('details', { class: 'card how' },
      h('summary', {}, 'How to play'),
      h('p', {}, 'Trucks are parked around a track, each holding a mix of coloured cubes. Sort them so every truck holds a single colour.'),
      h('p', {}, 'Tap a truck to send its top cube (the one nearest the track) onto the track. It rides round in the direction of the arrows and drops into the first truck it reaches that is empty, or has the same colour on top, and has room. It skips its own truck on the first lap.'),
      h('p', {}, 'You choose which cube moves; the track decides where it lands. A truck that fills up with one colour drives away. Clear every truck to win.'),
      h('p', {}, 'The count at the top shows how many trucks you have sorted out of how many there are to sort.'),
      h('p', {}, 'Only a few cubes can be on the track at once (Easy 7, Medium 6, Hard 5). Cubes that no truck can take just keep going round, using up that space; if the track is full of them you\'re stuck.'),
      h('p', {}, 'A truck with a coloured roof (tinted and outlined in that colour) only takes cubes of that colour, so cubes of any other colour ride straight past it. Iced trucks are stuck until enough trucks have been sorted. Hidden trucks only show their top cube; once a cube has been seen it stays visible.'),
      h('p', {}, 'The number of trucks and colours changes from level to level, and every track is a new shape.')));
}

function renderCustom(el) {
  const cfg = { difficulty: 'medium', obstacles: [], ...load(CUSTOM_KEY, {}) };
  const obstacles = new Set(cfg.obstacles);
  el.append(
    header('Custom level', HOME),
    h('section', { class: 'card' },
      h('h2', {}, 'Difficulty'),
      chips(DIFFICULTIES.map(d => ({ value: d, label: cap(d) })), cfg.difficulty, 'Difficulty', v => { cfg.difficulty = v; }),
      h('p', { class: 'muted' }, 'Easy: 3 to 6 truckloads, one or two spare trucks, up to 7 cubes on the track. Medium: 4 to 7 truckloads, at most one spare truck, 6 cubes on the track. Hard: 5 to 8 truckloads, at most one spare truck, 5 cubes on the track, cubes always hidden, and levels picked so the obvious move is often a trap. Past six truckloads a colour fills two trucks. Roof colours make any level much trickier.')),
    h('section', { class: 'card' },
      h('h2', {}, 'Obstacles'),
      toggleChips(OBSTACLES, obstacles, 'Obstacles')),
    h('div', { class: 'foot' },
      h('button', { class: 'btn big', onclick: () => {
        cfg.obstacles = [...obstacles];
        save(CUSTOM_KEY, cfg);
        const o = { difficulty: cfg.difficulty };
        for (const x of OBSTACLES) o[x.value] = obstacles.has(x.value);
        location.hash = customHref(o);
      } }, 'Start')));
}

function renderStats(el) {
  const st = stats.get();
  const all = summarize(st.results);
  const played = st.completed + st.failed;
  el.append(...[
    header('Stats', HOME),
    h('div', { class: 'stats' },
      statTile('Levels won', st.completed),
      statTile('Jammed', st.failed),
      statTile('Fewest taps', st.results.length ? Math.min(...st.results.map(r => r.taps ?? Infinity)) : '–'),
      statTile('Average', fmtTime(all.avg)),
      statTile('Fastest', fmtTime(all.min)),
      statTile('Slowest', fmtTime(all.max))),
    breakdown('By difficulty', DIFFICULTIES.map(d => ({ label: cap(d), sum: summarize(st.results.filter(r => r.d === d)) }))),
    st.completed ? null : h('p', { class: 'muted center' }, 'Win a level to see your times here.'),
  ].filter(Boolean));
}
