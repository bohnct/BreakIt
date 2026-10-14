import { h, header, fmtTime, chips, toggleChips, statTile, breakdown } from '../../js/ui.js';
import { preview } from '../../js/previews.js';
import { load, save } from '../../js/storage.js';
import { summarize } from '../../js/stats.js';
import { DIFFICULTIES } from './engine.js';
import { stats } from './stats.js';
import { mountBoard, getSavedGame, customHref, cap, maxEnemies, TOWER_COUNTS } from './board.js';

export const TITLE = 'Kelsey VS Carter';
const HOME = '#/game/towers';
const CUSTOM_KEY = 'games.towers.custom';
const OBSTACLES = [{ value: 'walls', label: 'Walls' }, { value: 'factories', label: 'Factories' }];

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
    preview('towers'),
    h('nav', { class: 'list' },
      saved && h('a', { class: 'btn big continue', href: `${HOME}/play?resume=1&k=${Date.now()}` },
        h('span', {}, 'Continue'),
        h('span', { class: 'continue-sub' }, `${cap(saved.opts.difficulty)} · ${saved.opts.enemies} rival${saved.opts.enemies > 1 ? 's' : ''} · ${fmtTime(saved.state.time)}`)),
      h('a', { class: 'btn big', href: `${HOME}/play?mode=random` }, 'Random battle'),
      h('a', { class: 'btn big', href: `${HOME}/custom` }, 'Custom battle'),
      h('a', { class: 'btn big ghost', href: `${HOME}/stats` }, 'Stats')),
    h('details', { class: 'card how' },
      h('summary', {}, 'How to play'),
      h('p', {}, 'You are green. Every tower you own builds up units over time, faster as it grows bigger (the dots above a tower show its level).'),
      h('p', {}, 'Drag from one of your towers to any other tower to send half its units. Sweep across several of your towers on the way to send from all of them at once.'),
      h('p', {}, 'Units knock one off a grey tower each and take it over when it runs out. Towers someone owns defend better: each attacker only knocks off a bit less than one. Sending to your own tower tops it up. Armies meeting head-on cancel out.'),
      h('p', {}, 'A tower holds at most 60 units, so spreading out to more towers beats piling up in one. Sweep several towers together to break a strong one.'),
      h('p', {}, 'Square towers are factories: they build twice as fast, but every attacker knocks two off them. Grey lines are walls you can\'t send through.'),
      h('p', {}, 'Take every rival tower to win. Lose all of yours and Carter wins.')));
}

function renderCustom(el) {
  const cfg = { towers: 12, enemies: 1, difficulty: 'medium', obstacles: ['factories'], ...load(CUSTOM_KEY, {}) };
  const obstacles = new Set(cfg.obstacles);
  const enemyWrap = h('div');
  const drawEnemies = () => {
    cfg.enemies = Math.min(cfg.enemies, maxEnemies(cfg.towers));
    enemyWrap.replaceChildren(chips(
      [1, 2, 3].filter(n => n <= maxEnemies(cfg.towers)).map(n => ({ value: n, label: String(n) })),
      cfg.enemies, 'Rivals', v => { cfg.enemies = v; }));
  };
  drawEnemies();

  el.append(
    header('Custom battle', HOME),
    h('section', { class: 'card' },
      h('h2', {}, 'Towers'),
      chips(TOWER_COUNTS.map(n => ({ value: n, label: String(n) })), cfg.towers, 'Towers', v => { cfg.towers = v; drawEnemies(); })),
    h('section', { class: 'card' },
      h('h2', {}, 'Rivals'),
      enemyWrap,
      h('p', { class: 'muted' }, 'Rivals fight each other as well as you.')),
    h('section', { class: 'card' },
      h('h2', {}, 'Difficulty'),
      chips(DIFFICULTIES.map(d => ({ value: d, label: cap(d) })), cfg.difficulty, 'Difficulty', v => { cfg.difficulty = v; }),
      h('p', { class: 'muted' }, 'Everyone starts with the same units; only how well rivals play changes. Easy rivals are slow and careless. Medium rivals team up their towers and defend. Hard rivals react fast, wait for a clear advantage, and never leave a tower open to a counter-attack.')),
    h('section', { class: 'card' },
      h('h2', {}, 'Map features'),
      toggleChips(OBSTACLES, obstacles, 'Map features')),
    h('div', { class: 'foot' },
      h('button', { class: 'btn big', onclick: () => {
        cfg.obstacles = [...obstacles];
        save(CUSTOM_KEY, cfg);
        location.hash = customHref({
          towers: cfg.towers, enemies: cfg.enemies, difficulty: cfg.difficulty,
          walls: obstacles.has('walls'), factories: obstacles.has('factories'),
        });
      } }, 'Start')));
}

function renderStats(el) {
  const st = stats.get();
  const all = summarize(st.results);
  el.append(...[
    header('Stats', HOME),
    h('div', { class: 'stats' },
      statTile('Wins', st.completed),
      statTile('Losses', st.failed),
      statTile('Started', st.started),
      statTile('Average win', fmtTime(all.avg)),
      statTile('Fastest win', fmtTime(all.min)),
      statTile('Slowest win', fmtTime(all.max))),
    breakdown('By difficulty', DIFFICULTIES.map(d => ({ label: cap(d), sum: summarize(st.results.filter(r => r.d === d)) }))),
    breakdown('By rivals', [1, 2, 3].map(e => ({ label: `${e} rival${e > 1 ? 's' : ''}`, sum: summarize(st.results.filter(r => r.e === e)) }))),
    st.completed ? null : h('p', { class: 'muted center' }, 'Win a battle to see your times here.'),
  ].filter(Boolean));
}
