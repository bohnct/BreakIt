// Rules and computer players for "Gedos Game" (Hola).
//
// Two players, or four in partnerships (seats 0 & 2 vs 1 & 3). Seat 0 is you. Everyone holds
// four cards; the rest is the stock. The leader plays any card, then everyone else plays any
// card. Only a card of the led rank, or a seven (sevens are wild), takes the trick over; the
// last player to do so is winning it. After each round the leader either takes the trick as it
// stands or fights: plays another card of the led rank or a seven, and everyone plays again.
// The trick's winner keeps the cards; everyone draws back up to four (the leader first) and
// the winner leads next. Aces and tens are worth 10, the last trick of a hand 10 more (90 in
// all). A side that takes every trick scores a Hola: 170. First side to the target wins.
//
// Cards are 1..52 as in the solitaire game: rank = (c - 1) % 13 + 1 (1 ace .. 13 king).

export const rank = c => ((c - 1) % 13) + 1;
export const suit = c => ((c - 1) / 13) | 0;
export const isWild = c => rank(c) === 7;
export const points = c => (rank(c) === 1 || rank(c) === 10 ? 10 : 0);
export const team = (g, p) => p % 2;
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const NAMES = { 2: ['You', 'Gedo'], 4: ['You', 'Kelsey', 'Gedo', 'Carter'] };
const HAND = 4;

const rand = k => Math.floor(Math.random() * k);

// opts: { players: 2 | 4, target, difficulty }
export function newGame(opts) {
  const g = {
    players: opts.players, target: opts.target, difficulty: opts.difficulty,
    scores: [0, 0], dealer: rand(opts.players), handNo: 0,
    phase: 'play', result: null,
  };
  dealHand(g);
  return g;
}

export function dealHand(g) {
  const deck = Array.from({ length: 52 }, (_, i) => i + 1);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  g.dealer = (g.dealer + 1) % g.players;
  g.handNo++;
  g.hands = Array.from({ length: g.players }, () => deck.splice(0, HAND));
  g.stock = deck;
  g.taken = [0, 0]; // card points won this hand
  g.out = []; // every card played this hand (hard players remember them)
  g.tricksWon = [0, 0];
  g.trick = null; // { leader, rank, plays: [{ p, c, round }], round, winner }
  g.lastTrick = null; // the trick just finished, for showing who took it
  g.turn = (g.dealer + 1) % g.players;
  g.phase = 'play';
  g.handResult = null;
}

const next = (g, p) => (p + 1) % g.players;

export function legalPlays(g, p) {
  const hand = g.hands[p];
  const t = g.trick;
  // A fighting leader must play the led rank or a seven.
  if (t && p === t.leader) return hand.filter(c => rank(c) === t.rank || isWild(c));
  return hand.slice();
}

export function canFight(g) {
  const t = g.trick;
  return !!t && g.hands.every(h => h.length > 0) && g.hands[t.leader].some(c => rank(c) === t.rank || isWild(c));
}

export function play(g, p, c) {
  if (g.phase !== 'play' || g.turn !== p || !legalPlays(g, p).includes(c)) return false;
  g.hands[p].splice(g.hands[p].indexOf(c), 1);
  g.out.push(c);
  g.lastTrick = null;
  if (!g.trick) {
    g.trick = { leader: p, rank: rank(c), plays: [], round: 0, winner: p };
  }
  const t = g.trick;
  t.plays.push({ p, c, round: t.round });
  if (rank(c) === t.rank || isWild(c)) t.winner = p;
  g.turn = next(g, p);
  if (g.turn === t.leader) {
    // Round over: the leader chooses, unless fighting isn't possible.
    if (canFight(g)) g.phase = 'decide';
    else endTrick(g);
  }
  return true;
}

export function fight(g) {
  if (g.phase !== 'decide' || !canFight(g)) return false;
  g.trick.round++;
  g.turn = g.trick.leader;
  g.phase = 'play';
  return true;
}

export function endTrick(g) {
  const t = g.trick, side = team(g, t.winner);
  g.taken[side] += t.plays.reduce((a, x) => a + points(x.c), 0);
  g.tricksWon[side]++;
  g.lastTrick = t;
  g.trick = null;
  // Everyone draws back up to four, one card at a time starting with the leader, so a short
  // stock is shared out equally.
  for (let p = t.leader; g.stock.length && g.hands.some(h => h.length < HAND); p = next(g, p)) {
    if (g.hands[p].length < HAND) g.hands[p].push(g.stock.pop());
  }
  if (g.hands.every(h => !h.length)) return endHand(g, side);
  g.turn = t.winner;
  g.phase = 'play';
}

function endHand(g, lastSide) {
  const add = g.taken.slice();
  add[lastSide] += 10;
  const hola = g.tricksWon.findIndex((n, side) => n > 0 && g.tricksWon[1 - side] === 0);
  if (hola >= 0) { add[hola] = 170; add[1 - hola] = 0; }
  g.scores = g.scores.map((s, i) => s + add[i]);
  g.handResult = { add, hola, lastSide };
  const done = g.scores.some(s => s >= g.target) && g.scores[0] !== g.scores[1];
  g.phase = done ? 'over' : 'handOver';
  if (done) g.result = g.scores[0] > g.scores[1] ? 'win' : 'lose';
}

// --- Computer players -----------------------------------------------------

// Skill of the player in seat p (test games can set g.levels per seat).
const skill = (g, p) => g.levels?.[p] ?? g.difficulty;

function junk(cards) {
  // Least useful card to throw away: no points, not a seven, and a rank we have only one of.
  const score = c => points(c) * 3 + (isWild(c) ? 25 : 0) - cards.filter(x => rank(x) === rank(c)).length;
  return cards.slice().sort((a, b) => score(a) - score(b))[0];
}

export function aiPlay(g, p) {
  const level = skill(g, p), hand = legalPlays(g, p), t = g.trick;
  if (level === 'easy' && Math.random() < 0.4) return hand[rand(hand.length)];

  // How many cards that could take a trick led at rank r are still hidden from p.
  const hidden = r => {
    const known = [...g.out, ...g.hands[p]];
    const count = rr => 4 - known.filter(c => rank(c) === rr).length;
    return (r === 7 ? 0 : count(r)) + count(7);
  };

  // Leading a new trick: something cheap, ideally a rank we hold twice so we can fight with it.
  // Hard players cash in a point card nobody can take any more.
  if (!t) {
    if (level === 'hard') {
      const sure = hand.filter(c => points(c) && hidden(rank(c)) === 0);
      if (sure.length) return sure[0];
    }
    const pairs = hand.filter(c => !isWild(c) && !points(c) && hand.filter(x => rank(x) === rank(c)).length > 1);
    return pairs[0] ?? junk(hand);
  }

  // Fighting as the leader: the led rank before a seven.
  if (p === t.leader) return hand.find(c => !isWild(c)) ?? hand[0];

  const mine = team(g, p), winning = team(g, t.winner) === mine;
  const onTable = t.plays.reduce((a, x) => a + points(x.c), 0);
  const beaters = hand.filter(c => rank(c) === t.rank || isWild(c)).sort((a, b) => isWild(a) - isWild(b) || points(a) - points(b));
  const lastToPlay = next(g, p) === t.leader;
  const endOfHand = !g.stock.length;

  if (!winning) {
    // Take it back if it's worth something (hard players also grab the last tricks).
    const worth = onTable > 0 || (level === 'hard' && endOfHand) || (level === 'medium' && Math.random() < 0.3);
    if (beaters.length && worth) return beaters[0];
    return junk(hand);
  }
  // Our side is winning: hand points to the partner when it's safe.
  const safe = lastToPlay || (level === 'hard' && (opponentsLeft(g, p) === 0 || hidden(t.rank) === 0));
  const pointCard = hand.filter(c => points(c) && !isWild(c))[0];
  if (pointCard && safe) return pointCard;
  return junk(hand);
}

// Opponents still to play in this round after p.
function opponentsLeft(g, p) {
  let n = 0;
  for (let q = next(g, p); q !== g.trick.leader; q = next(g, q)) if (team(g, q) !== team(g, p)) n++;
  return n;
}

export function aiFight(g) {
  const t = g.trick, p = t.leader;
  if (team(g, t.winner) === team(g, p)) return false;
  const onTable = t.plays.reduce((a, x) => a + points(x.c), 0), level = skill(g, p);
  if (level === 'easy') return Math.random() < 0.3;
  if (onTable > 0) return true;
  return level === 'hard' && !g.stock.length;
}
