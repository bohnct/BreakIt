import { h, header, fmtTime, chips, statTile, breakdown } from '../../js/ui.js';
import { load, save } from '../../js/storage.js';
import { summarize } from '../../js/stats.js';
import { preview } from '../../js/previews.js';
import { DIFFICULTIES } from './engine.js';
import { stats } from './stats.js';
import { mountBoard, getSavedGame, customHref, cap, modeLabel, TARGETS } from './board.js';

export const TITLE = 'Gedos Game';
const HOME = '#/game/hola';
const CUSTOM_KEY = 'games.hola.custom';

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
    preview('hola'),
    h('nav', { class: 'list' },
      saved && h('a', { class: 'btn big continue', href: `${HOME}/play?resume=1&k=${Date.now()}` },
        h('span', {}, 'Continue'),
        h('span', { class: 'continue-sub' }, `${modeLabel(saved.g.players)} · ${saved.g.scores[0]}–${saved.g.scores[1]} · ${fmtTime(saved.acc / 1000)}`)),
      h('a', { class: 'btn big', href: `${HOME}/play?mode=random` }, 'Random game'),
      h('a', { class: 'btn big', href: `${HOME}/custom` }, 'Custom game'),
      h('a', { class: 'btn big ghost', href: `${HOME}/stats` }, 'Stats')),
    h('details', { class: 'card how' },
      h('summary', {}, 'How to play'),
      h('p', {}, 'Gedo\'s Game is Hola. Play one against one with Gedo, or partner Gedo against Kelsey and Carter. Everyone holds four cards and draws back up after each trick.'),
      h('p', {}, 'The leader plays any card, then everyone plays one. Only a card of the same rank, or a seven (sevens are wild), takes the trick over; whoever did that last is winning it.'),
      h('p', {}, 'After each round the leader can take the trick as it stands, or fight: play another card of the led rank or a seven, and everyone plays again.'),
      h('p', {}, 'Aces and tens are worth 10, and the last trick of a hand is worth 10 more. Take every trick in a hand for a Hola: 170 points. First side to the target wins.')));
}

function renderCustom(el) {
  const cfg = { players: 4, target: 300, difficulty: 'medium', ...load(CUSTOM_KEY, {}) };
  el.append(
    header('Custom game', HOME),
    h('section', { class: 'card' },
      h('h2', {}, 'Players'),
      chips([{ value: 2, label: '1 v 1 with Gedo' }, { value: 4, label: '2 v 2 with Gedo' }], cfg.players, 'Players', v => { cfg.players = v; })),
    h('section', { class: 'card' },
      h('h2', {}, 'Play to'),
      chips(TARGETS, cfg.target, 'Play to', v => { cfg.target = v; }),
      h('p', { class: 'muted' }, 'Each hand is worth about 90 points.')),
    h('section', { class: 'card' },
      h('h2', {}, 'Difficulty'),
      chips(DIFFICULTIES.map(d => ({ value: d, label: cap(d) })), cfg.difficulty, 'Difficulty', v => { cfg.difficulty = v; }),
      h('p', { class: 'muted' }, 'Easy players are careless. Medium players fight for points and feed their partner. Hard players also remember every card played.')),
    h('div', { class: 'foot' },
      h('button', { class: 'btn big', onclick: () => {
        save(CUSTOM_KEY, cfg);
        location.hash = customHref(cfg);
      } }, 'Start')));
}

function renderStats(el) {
  const st = stats.get();
  const all = summarize(st.results);
  const played = st.completed + st.failed;
  el.append(...[
    header('Stats', HOME),
    h('div', { class: 'stats' },
      statTile('Wins', st.completed),
      statTile('Losses', st.failed),
      statTile('Win rate', played ? `${Math.round((st.completed / played) * 100)}%` : '–'),
      statTile('Average win', fmtTime(all.avg)),
      statTile('Fastest win', fmtTime(all.min)),
      statTile('Slowest win', fmtTime(all.max))),
    breakdown('By difficulty', DIFFICULTIES.map(d => ({ label: cap(d), sum: summarize(st.results.filter(r => r.d === d)) }))),
    breakdown('By players', [2, 4].map(n => ({ label: modeLabel(n), sum: summarize(st.results.filter(r => r.n === n)) }))),
    st.completed ? null : h('p', { class: 'muted center' }, 'Win a game to see your times here.'),
  ].filter(Boolean));
}
