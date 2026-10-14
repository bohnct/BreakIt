// Rules and solver for "Babas Game" (Klondike solitaire).
//
// Cards are numbers 1..52: suit = (c - 1) / 13 | 0 (0 spades, 1 hearts, 2 diamonds, 3 clubs),
// rank = (c - 1) % 13 + 1 (1 ace .. 13 king). In the tableau a face-down card is stored negative.
// State: { stock: [c], waste: [c], found: [rank per suit], tab: [[±c] x7], draw, passes, passesUsed }
// stock's last element is its top; waste's last element is the playable card.

export const suit = c => ((Math.abs(c) - 1) / 13) | 0;
export const rank = c => ((Math.abs(c) - 1) % 13) + 1;
export const red = c => suit(c) === 1 || suit(c) === 2;
export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const top = a => a[a.length - 1];

export function deal(opts) {
  const deck = Array.from({ length: 52 }, (_, i) => i + 1);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const tab = [];
  for (let col = 0; col < 7; col++) {
    const pile = [];
    for (let k = 0; k <= col; k++) pile.push(k === col ? deck.pop() : -deck.pop());
    tab.push(pile);
  }
  return {
    stock: deck, waste: [], found: [0, 0, 0, 0], tab,
    draw: opts.draw, passes: opts.passes, passesUsed: 0, moves: 0,
  };
}

export const clone = s => ({
  ...s, stock: s.stock.slice(), waste: s.waste.slice(), found: s.found.slice(), tab: s.tab.map(p => p.slice()),
});

export const won = s => s.found.every(n => n === 13);

// --- Move rules -----------------------------------------------------------

export const toFoundation = (s, c) => c > 0 && s.found[suit(c)] === rank(c) - 1;

// Can the run starting with card c go onto tableau column `col`?
export function toColumn(s, c, col) {
  const t = top(s.tab[col]);
  if (t == null) return rank(c) === 13;
  return t > 0 && red(t) !== red(c) && rank(t) === rank(c) + 1;
}

export const canDraw = s => s.stock.length > 0 || (s.waste.length > 0 && (s.passes < 0 || s.passesUsed < s.passes - 1));

// Moves: { from: 'waste' | 'found' | col index, index?, to: 'found' | col index } or { draw: true }
export function apply(s, m) {
  const n = clone(s);
  n.moves++;
  if (m.draw) {
    if (n.stock.length) {
      for (let k = 0; k < n.draw && n.stock.length; k++) n.waste.push(n.stock.pop());
    } else {
      n.stock = n.waste.reverse();
      n.waste = [];
      n.passesUsed++;
    }
    return n;
  }
  let cards;
  if (m.from === 'waste') cards = [n.waste.pop()];
  else if (m.from === 'found') {
    const st = m.suit;
    cards = [st * 13 + n.found[st]];
    n.found[st]--;
  } else cards = n.tab[m.from].splice(m.index);
  if (m.to === 'found') n.found[suit(cards[0])]++;
  else n.tab[m.to].push(...cards);
  // Turn over a newly exposed face-down card.
  if (typeof m.from === 'number') {
    const p = n.tab[m.from];
    if (p.length && top(p) < 0) p[p.length - 1] = -top(p);
  }
  return n;
}

// Every legal move except pulling cards back off the foundations.
export function legalMoves(s) {
  const out = [];
  const w = top(s.waste);
  if (w != null) {
    if (toFoundation(s, w)) out.push({ from: 'waste', to: 'found' });
    for (let col = 0; col < 7; col++) if (toColumn(s, w, col)) out.push({ from: 'waste', to: col });
  }
  s.tab.forEach((p, from) => {
    if (!p.length) return;
    if (toFoundation(s, top(p))) out.push({ from, index: p.length - 1, to: 'found' });
    for (let i = p.length - 1; i >= 0 && p[i] > 0; i--) {
      for (let col = 0; col < 7; col++) if (col !== from && toColumn(s, p[i], col)) out.push({ from, index: i, to: col });
    }
  });
  if (canDraw(s)) out.push({ draw: true });
  return out;
}

// --- Solver ---------------------------------------------------------------

// A card can safely go up when both opposite-colour foundations are close behind it.
function safeUp(s, c) {
  const r = rank(c);
  if (r <= 2) return true;
  const opp = red(c) ? [0, 3] : [1, 2];
  return opp.every(o => s.found[o] >= r - 1);
}

function autoSafe(s) {
  for (let changed = true; changed;) {
    changed = false;
    const w = top(s.waste);
    if (w != null && toFoundation(s, w) && safeUp(s, w)) { s = apply(s, { from: 'waste', to: 'found' }); s.moves--; changed = true; continue; }
    for (let col = 0; col < 7; col++) {
      const t = top(s.tab[col]);
      if (t != null && toFoundation(s, t) && safeUp(s, t)) {
        s = apply(s, { from: col, index: s.tab[col].length - 1, to: 'found' });
        s.moves--;
        changed = true;
        break;
      }
    }
  }
  return s;
}

// With unlimited passes, going round the stock again is the same position; with a limit it isn't.
const key = s => `${s.tab.map(p => p.join(',')).join('|')}#${s.found}#${s.stock.join(',')}#${s.waste.join(',')}#${s.passes < 0 ? '' : s.passesUsed}`;

// Moves worth exploring, best first. Tableau moves only shift whole face-up runs, and only when
// that turns a card over, empties a column for something useful, or lands a card from the waste.
function candidates(s) {
  const fnd = [], reveal = [], waste = [], other = [];
  for (const m of legalMoves(s)) {
    if (m.draw) continue;
    if (m.to === 'found') { fnd.push(m); continue; }
    if (m.from === 'waste') { waste.push(m); continue; }
    const p = s.tab[m.from];
    const isRun = m.index === 0 || p[m.index - 1] < 0;
    // Splitting a run is only worth it when the card it uncovers can go up.
    if (!isRun) {
      if (toFoundation(s, p[m.index - 1])) reveal.push(m);
      continue;
    }
    if (m.index > 0) reveal.push(m);
    else if (rank(p[0]) !== 13 && s.tab[m.to].length) other.push(m);
  }
  const out = [...fnd, ...reveal, ...waste, ...other];
  if (canDraw(s)) out.push({ draw: true });
  return out;
}

// Depth-first search with a node budget and a time limit (phones are much slower than
// computers). Returns true if it finds a win.
export function solvable(start, budget = 60000, deadline = Infinity) {
  const seen = new Set();
  const stack = [autoSafe(clone(start))];
  let nodes = 0;
  while (stack.length) {
    const s = stack.pop();
    if (won(s)) return true;
    const k = key(s);
    if (seen.has(k)) continue;
    seen.add(k);
    if (++nodes > budget) return false;
    if (nodes % 500 === 0 && performance.now() > deadline) return false;
    const next = candidates(s);
    for (let i = next.length - 1; i >= 0; i--) stack.push(autoSafe(apply(s, next[i])));
  }
  return false;
}

// opts: { draw: 1 | 3, passes: -1 (unlimited) | n, winnable: bool }
// Keeps dealing until the solver wins one, within budgetMs overall.
export function newDeal(opts, budgetMs = 4000) {
  const end = performance.now() + budgetMs;
  for (;;) {
    const s = deal(opts);
    if (!opts.winnable) return { state: s, checked: false };
    if (solvable(s, 60000, end)) return { state: s, checked: true };
    if (performance.now() > end) return { state: s, checked: false };
  }
}
