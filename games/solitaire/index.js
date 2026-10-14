import { h, header, fmtTime, chips, statTile, breakdown } from '../../js/ui.js';
import { load, save } from '../../js/storage.js';
import { summarize } from '../../js/stats.js';
import { preview } from '../../js/previews.js';
import { stats } from './stats.js';
import { mountBoard, getSavedGame, customHref, passesLabel } from './board.js';

export const TITLE = 'Babas Game';
const HOME = '#/game/solitaire';
const CUSTOM_KEY = 'games.solitaire.custom';

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
    preview('solitaire'),
    h('nav', { class: 'list' },
      saved && h('a', { class: 'btn big continue', href: `${HOME}/play?resume=1&k=${Date.now()}` },
        h('span', {}, 'Continue'),
        h('span', { class: 'continue-sub' }, `Draw ${saved.opts.draw} · ${saved.state.moves} moves · ${fmtTime(saved.acc / 1000)}`)),
      h('a', { class: 'btn big', href: `${HOME}/play?mode=random` }, 'Random deal'),
      h('a', { class: 'btn big', href: `${HOME}/custom` }, 'Custom deal'),
      h('a', { class: 'btn big ghost', href: `${HOME}/stats` }, 'Stats')),
    h('details', { class: 'card how' },
      h('summary', {}, 'How to play'),
      h('p', {}, 'Build each suit up from ace to king on the four piles at the top right.'),
      h('p', {}, 'In the seven columns, stack cards down in alternating colours (a red 6 on a black 7). You can move a whole run of face-up cards together, and only a king can go into an empty column.'),
      h('p', {}, 'Tap the deck to turn over cards. Tap a card to send it to the best place it can go, or drag it where you want it.'),
      h('p', {}, 'Random deals are always winnable. Once every card is face up, Baba finishes the game for you.')));
}

function renderCustom(el) {
  const cfg = { draw: 1, passes: -1, winnable: true, ...load(CUSTOM_KEY, {}) };
  el.append(
    header('Custom deal', HOME),
    h('section', { class: 'card' },
      h('h2', {}, 'Draw'),
      chips([{ value: 1, label: 'One card' }, { value: 3, label: 'Three cards' }], cfg.draw, 'Draw', v => { cfg.draw = v; }),
      h('p', { class: 'muted' }, 'Turning three at a time is harder: only the top one can be played.')),
    h('section', { class: 'card' },
      h('h2', {}, 'Times through the deck'),
      chips([-1, 3, 1].map(p => ({ value: p, label: passesLabel(p) })), cfg.passes, 'Times through the deck', v => { cfg.passes = v; })),
    h('section', { class: 'card' },
      h('h2', {}, 'Deals'),
      chips([{ value: true, label: 'Always winnable' }, { value: false, label: 'Any deal' }], cfg.winnable, 'Deals', v => { cfg.winnable = v; }),
      h('p', { class: 'muted' }, 'Winnable deals are checked by a solver before you get them. Any deal is like a real shuffle, and some can\'t be won.')),
    h('div', { class: 'foot' },
      h('button', { class: 'btn big', onclick: () => {
        save(CUSTOM_KEY, cfg);
        location.hash = customHref(cfg);
      } }, 'Start')));
}

function renderStats(el) {
  const st = stats.get();
  const all = summarize(st.results);
  const winRate = st.started ? `${Math.round((st.completed / st.started) * 100)}%` : '–';
  el.append(...[
    header('Stats', HOME),
    h('div', { class: 'stats' },
      statTile('Games won', st.completed),
      statTile('Played', st.started),
      statTile('Win rate', winRate),
      statTile('Average', fmtTime(all.avg)),
      statTile('Fastest', fmtTime(all.min)),
      statTile('Slowest', fmtTime(all.max))),
    breakdown('By draw', [1, 3].map(d => ({ label: `Draw ${d}`, sum: summarize(st.results.filter(r => r.d === d)) }))),
    st.completed ? null : h('p', { class: 'muted center' }, 'Win a game to see your times here.'),
  ].filter(Boolean));
}
