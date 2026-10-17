import { h, header, fmtTime, viewWidth } from '../../js/ui.js';
import { load, save, remove } from '../../js/storage.js';
import * as playtimer from '../../js/playtimer.js';
import { autosave } from '../../js/autosave.js';
import {
  DIFFICULTIES, NAMES, rank, suit, points, isWild, team,
  newGame, dealHand, legalPlays, canFight, play, fight, endTrick, aiPlay, aiFight,
} from './engine.js';
import { stats } from './stats.js';

const HOME = '#/game/hola';
const SAVE_KEY = 'games.hola.saved';
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const AI_DELAY = 750, TRICK_PAUSE = 1400;
const aRank = r => `${r === 1 || r === 8 ? 'an' : 'a'} ${RANKS[r]}`; // "an A", "an 8", "a J"
export const TARGETS = [{ value: 150, label: 'Short · 150' }, { value: 300, label: 'Standard · 300' }, { value: 500, label: 'Long · 500' }];

export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const getSavedGame = () => load(SAVE_KEY, null);
export const modeLabel = n => (n === 2 ? '1 v 1' : '2 v 2');

export function optsFromQuery(query) {
  if (query.get('mode') !== 'custom') {
    return { players: Math.random() < 0.5 ? 2 : 4, target: 300, difficulty: Math.random() < 0.5 ? 'medium' : 'hard' };
  }
  return {
    players: query.get('n') === '2' ? 2 : 4,
    target: TARGETS.some(t => t.value === +query.get('t')) ? +query.get('t') : 300,
    difficulty: DIFFICULTIES.includes(query.get('d')) ? query.get('d') : 'medium',
  };
}

export const customHref = o => `${HOME}/play?mode=custom&n=${o.players}&t=${o.target}&d=${o.difficulty}`;

const cardEl = (c, extra = '') => h('div', {
  class: `sol-card s${suit(c)} ${extra}`,
  html: `<span class="sol-corner">${RANKS[rank(c)]}<br>${SUITS[suit(c)]}︎</span><span class="sol-pip">${SUITS[suit(c)]}︎</span>`,
});

export function mountBoard(el, query) {
  const saved = query.get('resume') ? getSavedGame() : null;
  remove(SAVE_KEY); // resumed, or replaced by this new game
  const mode = saved ? saved.mode : query.get('mode') === 'custom' ? 'custom' : 'random';
  const opts = saved ? saved.opts : optsFromQuery(query);
  if (!saved) stats.recordStart();
  const g = saved ? saved.g : newGame(opts);
  const names = NAMES[g.players];
  const sideName = side => (g.players === 2 ? names[side] : side === 0 ? 'You and Gedo' : 'Kelsey and Carter');

  let acc = saved ? saved.acc : 0, last = Date.now(), over = g.phase === 'over', timer = null;
  const cleanups = [];

  const timerEl = h('span', { class: 'timer' }, fmtTime(acc / 1000));
  const bar = header(`${modeLabel(g.players)} · ${cap(opts.difficulty)}`, HOME);
  bar.querySelector('.bar-right').append(timerEl);
  const limitEl = h('div', { class: 'limit muted' });
  const showLimit = rem => { limitEl.textContent = rem == null ? '' : `Play time left ${fmtTime(rem / 1000)}`; };
  showLimit(playtimer.remainingMs());
  cleanups.push(playtimer.onTick(showLimit));

  const scoreEl = h('div', { class: 'hola-score' });
  const fieldEl = h('div', { class: 'hola-field' });
  const msgEl = h('div', { class: 'hola-msg' });
  const actionsEl = h('div', { class: 'hola-actions' });
  const handEl = h('div', { class: 'hola-hand' });
  const myPileEl = h('div', { class: 'hola-mypile' });
  const wrap = h('div', { class: 'hola' }, scoreEl, fieldEl, msgEl, actionsEl, h('div', { class: 'hola-me' }, myPileEl, handEl));
  const stage = h('div', { class: 'stage' }, wrap);
  el.append(bar, limitEl, stage);

  // Seats around the table: you at the bottom, your partner (or Gedo in 1 v 1) opposite.
  const POS = g.players === 2 ? ['bottom', 'top'] : ['bottom', 'left', 'top', 'right'];
  let tw = 44, th = 62;
  const size = () => {
    const W = Math.min(viewWidth() - 32, 528);
    const cw = Math.min(76, Math.floor((W - 90) / 4.4));
    tw = Math.min(58, Math.round(W * 0.13));
    th = Math.round(tw * 1.42);
    wrap.style.setProperty('--cw', `${cw}px`);
    wrap.style.setProperty('--ch', `${Math.round(cw * 1.42)}px`);
    wrap.style.setProperty('--tw', `${tw}px`);
    wrap.style.setProperty('--th', `${th}px`);
    wrap.style.setProperty('--fh', `${Math.round(th * 4.6)}px`);
    if (g.hands) render();
  };
  size();
  window.addEventListener('resize', size);
  cleanups.push(() => window.removeEventListener('resize', size));

  // --- Drawing ---
  function render() {
    scoreEl.replaceChildren(
      h('span', { class: 'hola-side us' }, `${g.players === 2 ? 'You' : 'You and Gedo'} ${g.scores[0]}`),
      h('span', { class: 'muted' }, `to ${g.target}`),
      h('span', { class: 'hola-side' }, `${g.scores[1]} ${g.players === 2 ? 'Gedo' : 'Kelsey and Carter'}`));

    const t = g.trick || g.lastTrick;
    const won = g.won ?? Array(g.players).fill(0);
    // Face-down pile of the cards a player has won this hand, with the count.
    const pile = (n, label) => h('div', { class: 'hola-pile' + (n ? '' : ' empty') },
      h('div', { class: 'hola-pile-stack' }, [...Array(Math.min(4, Math.ceil(n / 4)))].map((_, k) => h('i', { style: `--k:${k}` }))),
      h('span', { class: 'muted' }, label ?? String(n)));
    const seat = p => h('div', { class: `hola-seat pos-${POS[p]}` + (g.turn === p && !g.lastTrick && g.phase === 'play' ? ' turn' : '') + (t && t.winner === p ? ' winning' : '') },
      h('span', { class: 'hola-name' }, names[p], team(g, p) === 0 ? h('span', { class: 'muted' }, ' · partner') : null),
      h('div', { class: 'hola-seat-row' },
        h('span', { class: 'hola-backs' }, g.hands[p].map(() => h('i'))),
        pile(won[p])));

    // Played cards sit in the middle of the table, in front of whoever played them. Cards from
    // later rounds of a fight land slightly offset on top of the earlier ones.
    const OFF = { bottom: [0, 0.58 * th], top: [0, -0.58 * th], left: [-0.95 * tw, 0], right: [0.95 * tw, 0] };
    const lastWinPlay = t ? [...t.plays].reverse().find(y => y.p === t.winner) : null;
    const plays = t ? t.plays.map(x => {
      const [dx, dy] = OFF[POS[x.p]];
      const e = cardEl(x.c, (x === lastWinPlay ? 'win-card' : '') + (rank(x.c) === t.rank || isWild(x.c) ? '' : ' dim'));
      e.style.left = `calc(50% + ${dx + x.round * 7}px)`;
      e.style.top = `calc(50% + ${dy + x.round * 4}px)`;
      return e;
    }) : [];
    const stock = h('div', { class: 'hola-stock' }, pile(g.stock.length * 4, `${g.stock.length} left`));
    fieldEl.replaceChildren(
      ...[...Array(g.players).keys()].filter(p => p !== 0).map(seat),
      h('div', { class: 'hola-center' }, ...plays),
      stock);
    myPileEl.replaceChildren(pile(won[0], `Won ${won[0]}`));
    myPileEl.classList.toggle('winning', !!(t && t.winner === 0));

    let msg = '';
    if (g.lastTrick && g.phase === 'play') {
      const lt = g.lastTrick, pts = lt.plays.reduce((a, x) => a + points(x.c), 0);
      msg = `${names[lt.winner]} ${lt.winner === 0 ? 'take' : 'takes'} the trick${pts ? ` (+${pts})` : ''}`;
    } else if (g.phase === 'decide') {
      msg = g.trick.leader === 0
        ? `${names[g.trick.winner]} is winning. Fight with ${aRank(g.trick.rank)} or a 7, or let it go?`
        : `${names[g.trick.leader]} is deciding…`;
    } else if (g.phase === 'play') {
      if (g.turn === 0) {
        msg = !g.trick ? 'Your lead: play any card'
          : g.trick.leader === 0 ? `Fight: play ${aRank(g.trick.rank)} or a 7`
          : `Your turn. ${cap(aRank(g.trick.rank))} or a 7 takes the trick`;
      } else msg = `${names[g.turn]} is playing…`;
    }
    msgEl.textContent = msg;

    actionsEl.replaceChildren();
    if (g.phase === 'decide' && g.trick.leader === 0) {
      actionsEl.append(
        h('button', { class: 'btn', onclick: () => { endTrick(g); render(); schedule(); } }, 'Let it go'),
        h('button', { class: 'btn', disabled: !canFight(g), onclick: () => { fight(g); render(); schedule(); } }, 'Fight'));
    }

    const mine = g.phase === 'play' && g.turn === 0;
    const legal = mine ? legalPlays(g, 0) : [];
    handEl.replaceChildren(...g.hands[0].map(c => {
      const e = cardEl(c, mine && !legal.includes(c) ? 'dim' : '');
      if (mine && legal.includes(c)) {
        e.classList.add('playable');
        e.onclick = () => { if (play(g, 0, c)) { render(); schedule(); } };
      }
      return e;
    }));
  }

  // --- Turn flow: computer players act after a short pause so you can follow along ---
  function schedule() {
    clearTimeout(timer);
    if (over) return;
    if (g.phase === 'handOver') return showHand();
    if (g.phase === 'over') return finish();
    const pause = g.lastTrick && !g.trick ? TRICK_PAUSE : AI_DELAY;
    if (g.phase === 'decide' && g.trick.leader !== 0) {
      timer = setTimeout(() => { if (aiFight(g)) fight(g); else endTrick(g); render(); schedule(); }, pause);
    } else if (g.phase === 'play' && g.turn !== 0) {
      timer = setTimeout(() => { play(g, g.turn, aiPlay(g, g.turn)); render(); schedule(); }, pause);
    }
  }
  cleanups.push(() => clearTimeout(timer));

  function showHand() {
    const r = g.handResult;
    const line = side => `${sideName(side)}: +${r.add[side]}`;
    stage.append(h('div', { class: 'win card' },
      h('h2', {}, r.hola >= 0 ? `Hola! ${sideName(r.hola)} took every trick` : `Hand ${g.handNo} done`),
      h('p', {}, line(0)), h('p', {}, line(1)),
      h('p', { class: 'muted' }, `${sideName(r.lastSide)} took the last trick (+10). Score ${g.scores[0]}–${g.scores[1]}, playing to ${g.target}.`),
      h('div', { class: 'row-btns' },
        h('button', { class: 'btn big', onclick: () => {
          stage.querySelector('.win')?.remove();
          dealHand(g);
          render();
          schedule();
        } }, 'Next hand'))));
  }

  const nextHref = () => `${mode === 'custom' ? customHref(opts) : `${HOME}/play?mode=random`}&k=${Date.now()}`;

  function finish() {
    over = true;
    remove(SAVE_KEY);
    playtimer.stop();
    const seconds = Math.round(acc / 1000), won = g.result === 'win';
    if (won) stats.recordWin({ s: seconds, m: mode, d: opts.difficulty, n: g.players, t: g.target });
    else stats.recordFail();
    stage.append(h('div', { class: 'win card' },
      h('h2', {}, won ? 'Gedo would be proud' : `${sideName(1)} win`),
      h('p', { class: 'win-time' }, `${g.scores[0]}–${g.scores[1]}`),
      h('p', { class: 'muted' }, `${g.handNo} hand${g.handNo === 1 ? '' : 's'} · ${fmtTime(seconds)}`),
      h('div', { class: 'row-btns' },
        h('a', { class: 'btn big', href: nextHref() }, 'New game'),
        h('a', { class: 'btn big ghost', href: HOME }, 'Menu'))));
  }

  const clock = setInterval(() => {
    const now = Date.now();
    if (!document.hidden && !over) acc += Math.max(0, now - last);
    last = now;
    timerEl.textContent = fmtTime(Math.floor(acc / 1000));
  }, 250);
  cleanups.push(() => clearInterval(clock));
  cleanups.push(autosave(() => { if (!over) save(SAVE_KEY, { mode, opts, g, acc }); }));

  render();
  playtimer.start();
  schedule();

  return { unmount() { cleanups.forEach(fn => fn()); } };
}
