import { h, header, fmtTime, chips, toggleChips, statTile, breakdown } from '../../js/ui.js';
import { preview } from '../../js/previews.js';
import { load, save } from '../../js/storage.js';
import { summarize } from '../../js/stats.js';
import { DIFFICULTIES } from './engine.js';
import { stats } from './stats.js';
import { mountBoard, getSavedGame, customHref, cap, WAVE_COUNTS, ENEMY_TYPES } from './board.js';

export const TITLE = 'Protect My Garlic!';
const HOME = '#/game/garlic';
const CUSTOM_KEY = 'games.garlic.custom';

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
    preview('garlic'),
    h('nav', { class: 'list' },
      saved && h('a', { class: 'btn big continue', href: `${HOME}/play?resume=1&k=${Date.now()}` },
        h('span', {}, 'Continue'),
        h('span', { class: 'continue-sub' }, `${cap(saved.opts.difficulty)} · wave ${saved.state.wave + 1} of ${saved.level.waves.length} · ${fmtTime(saved.state.time)}`)),
      h('a', { class: 'btn big', href: `${HOME}/play?mode=random` }, 'Random level'),
      h('a', { class: 'btn big', href: `${HOME}/custom` }, 'Custom level'),
      h('a', { class: 'btn big ghost', href: `${HOME}/stats` }, 'Stats')),
    h('details', { class: 'card how' },
      h('summary', {}, 'How to play'),
      h('p', {}, 'Blocks march in from every side to squash your garlic. Each one that reaches a garlic costs hearts; bigger blocks cost more. Lose every heart and the level is over.'),
      h('p', {}, 'Every gun sits on its own garlic and fires by itself at blocks in range; the faint dashed rings show how far each one reaches (the sniper reaches anywhere). Tap a block to make every gun focus on it.'),
      h('p', {}, 'Destroyed blocks drop coins. Between waves, spend them on a shotgun, sniper or machine gun (each arrives on a new garlic), on damage and rate-of-fire upgrades, or on healing. Every fifth damage upgrade also lets that gun\'s bullets go through one more block. Everything resets each level, and you always start with one garlic and a handgun.'),
      h('p', {}, 'Blocks fade from bright to dim as they take damage. Yellow scouts are quick, orange blocks are steady, red brutes are tough, green splitters break into scouts, and blue bosses guard the last wave.')));
}

function renderCustom(el) {
  const cfg = { difficulty: 'medium', waves: 20, types: ['brutes', 'splitters', 'bosses'], ...load(CUSTOM_KEY, {}) };
  if (!WAVE_COUNTS.includes(cfg.waves)) cfg.waves = 20;
  const types = new Set(cfg.types);
  el.append(
    header('Custom level', HOME),
    h('section', { class: 'card' },
      h('h2', {}, 'Difficulty'),
      chips(DIFFICULTIES.map(d => ({ value: d, label: cap(d) })), cfg.difficulty, 'Difficulty', v => { cfg.difficulty = v; }),
      h('p', { class: 'muted' }, 'Sets how tough blocks are, how many come, how fast they get stronger each wave, and how many hearts the garlic has.')),
    h('section', { class: 'card' },
      h('h2', {}, 'Waves'),
      chips(WAVE_COUNTS.map(n => ({ value: n, label: String(n) })), cfg.waves, 'Waves', v => { cfg.waves = v; })),
    h('section', { class: 'card' },
      h('h2', {}, 'Enemies'),
      toggleChips(ENEMY_TYPES, types, 'Enemies'),
      h('p', { class: 'muted' }, 'Scouts and blocks always come.')),
    h('div', { class: 'foot' },
      h('button', { class: 'btn big', onclick: () => {
        cfg.types = [...types];
        save(CUSTOM_KEY, cfg);
        const o = { difficulty: cfg.difficulty, waves: cfg.waves };
        for (const t of ENEMY_TYPES) o[t.value] = types.has(t.value);
        location.hash = customHref(o);
      } }, 'Start')));
}

function renderStats(el) {
  const st = stats.get();
  const all = summarize(st.results);
  el.append(...[
    header('Stats', HOME),
    h('div', { class: 'stats' },
      statTile('Levels won', st.completed),
      statTile('Lost', st.failed),
      statTile('Started', st.started),
      statTile('Average', fmtTime(all.avg)),
      statTile('Fastest', fmtTime(all.min)),
      statTile('Slowest', fmtTime(all.max))),
    breakdown('By difficulty', DIFFICULTIES.map(d => ({ label: cap(d), sum: summarize(st.results.filter(r => r.d === d)) }))),
    breakdown('By waves', WAVE_COUNTS.map(n => ({ label: `${n} waves`, sum: summarize(st.results.filter(r => r.w === n)) }))),
    st.completed ? null : h('p', { class: 'muted center' }, 'Win a level to see your times here.'),
  ].filter(Boolean));
}
