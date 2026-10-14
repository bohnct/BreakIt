import { h, header, fmtTime, chips, toggleChips, statTile, breakdown } from '../../js/ui.js';
import { preview } from '../../js/previews.js';
import { load, save } from '../../js/storage.js';
import { summarize } from '../../js/stats.js';
import { maxBlocks, DIFFICULTIES } from './engine.js';
import { stats } from './stats.js';
import { mountBoard, getSavedGame, customHref, cap, SIZES, OBSTACLES } from './board.js';

export const TITLE = 'Kelsey Blocked Me In Again!';
const HOME = '#/game/blocks';
const CUSTOM_KEY = 'games.blocks.custom';

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
        h('span', { class: 'continue-sub' }, `${saved.level.w}×${saved.level.h} · ${cap(saved.level.difficulty)} · ${fmtTime(saved.acc / 1000)}`)),
      h('a', { class: 'btn big', href: `${HOME}/play?mode=random` }, 'Random level'),
      h('a', { class: 'btn big', href: `${HOME}/custom` }, 'Custom level'),
      h('a', { class: 'btn big ghost', href: `${HOME}/stats` }, 'Stats')),
    h('details', { class: 'card how' },
      h('summary', {}, 'How to play'),
      h('p', {}, 'Kelsey has boxed you in. Drag each block to the door of the same colour on the edge of the board and it slides out.'),
      h('p', {}, 'Blocks can\'t pass through each other, and a block only fits through a door that is at least as wide as the block.'),
      h('p', {}, 'On Medium and Hard levels the blocks are jammed: you\'ll need to shuffle some out of the way before others can get out.'),
      h('p', {}, 'Arrow blocks only slide the way their arrows point. Iced blocks are stuck until the number of other blocks shown has left. Layered blocks lose their outer colour at a matching door, then need a door for the colour inside.')));
}

function renderCustom(el) {
  const saved = load(CUSTOM_KEY, {});
  const cfg = { size: '6x8', blocks: 10, colours: 4, difficulty: 'medium', obstacles: [], ...saved };
  const obstacles = new Set(cfg.obstacles);
  const dims = () => cfg.size.split('x').map(Number);

  const blocksVal = h('span', { class: 'value' });
  const showBlocks = () => {
    const max = maxBlocks(...dims());
    cfg.blocks = Math.min(Math.max(3, cfg.blocks), max);
    blocksVal.textContent = `${cfg.blocks} / ${max}`;
  };
  showBlocks();
  const stepBlocks = d => { cfg.blocks += d; showBlocks(); };

  // Picking a difficulty suggests a matching board (still changeable): Hard means big and packed.
  const SUGGEST = { easy: ['6x6', 0.7], medium: ['7x9', 0.9], hard: ['8x10', 1] };
  const sizeWrap = h('div');
  const drawSizes = () => sizeWrap.replaceChildren(
    chips(SIZES.map(([w, hh]) => ({ value: `${w}x${hh}`, label: `${w}×${hh}` })), cfg.size, 'Board size',
      v => { cfg.size = v; showBlocks(); }));
  drawSizes();

  el.append(
    header('Custom level', HOME),
    h('section', { class: 'card' },
      h('h2', {}, 'Difficulty'),
      chips(DIFFICULTIES.map(d => ({ value: d, label: cap(d) })), cfg.difficulty, 'Difficulty', v => {
        cfg.difficulty = v;
        const [size, share] = SUGGEST[v];
        cfg.size = size;
        cfg.blocks = Math.round(maxBlocks(...dims()) * share);
        drawSizes();
        showBlocks();
      }),
      h('p', { class: 'muted' }, 'Easy: every block can go straight out. Medium: one or two blocks must be moved out of the way first. Hard: a big, packed board where you\'ll need to move blocks aside three or more times to untangle it.')),
    h('section', { class: 'card' },
      h('h2', {}, 'Board size'),
      sizeWrap),
    h('section', { class: 'card' },
      h('h2', {}, 'Blocks'),
      h('div', { class: 'row' },
        h('span', {}, 'Number of blocks'),
        h('div', { class: 'stepper' },
          h('button', { class: 'btn small', 'aria-label': 'Fewer blocks', onclick: () => stepBlocks(-1) }, '−'),
          blocksVal,
          h('button', { class: 'btn small', 'aria-label': 'More blocks', onclick: () => stepBlocks(1) }, '+')))),
    h('section', { class: 'card' },
      h('h2', {}, 'Colours'),
      chips([2, 3, 4, 5, 6].map(c => ({ value: c, label: String(c) })), cfg.colours, 'Colours', v => { cfg.colours = v; })),
    h('section', { class: 'card' },
      h('h2', {}, 'Obstacles'),
      toggleChips(OBSTACLES, obstacles, 'Obstacles')),
    h('div', { class: 'foot' },
      h('button', { class: 'btn big', onclick: () => {
        cfg.obstacles = [...obstacles];
        save(CUSTOM_KEY, cfg);
        const [w, hh] = dims();
        const o = { w, h: hh, blocks: cfg.blocks, colours: cfg.colours, difficulty: cfg.difficulty };
        for (const x of OBSTACLES) o[x.value] = obstacles.has(x.value);
        location.hash = customHref(o);
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
      statTile('Total time', fmtTime(st.results.reduce((a, r) => a + r.s, 0))),
      statTile('Average', fmtTime(all.avg)),
      statTile('Fastest', fmtTime(all.min)),
      statTile('Slowest', fmtTime(all.max))),
    breakdown('By board size', SIZES.map(([w, hh]) => ({
      label: `${w}×${hh}`, sum: summarize(st.results.filter(r => r.w === w && r.h === hh)),
    }))),
    breakdown('By difficulty', DIFFICULTIES.map(d => ({ label: cap(d), sum: summarize(st.results.filter(r => r.d === d)) }))),
    st.completed ? null : h('p', { class: 'muted center' }, 'Finish a level to see your times here.'),
  ].filter(Boolean));
}
