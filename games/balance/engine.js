// Rules and levels for the balance game.
//
// A scale has six spots, three each side of the pivot at distances 1, 2 and 3. Each spot holds
// one block, and a block weighs as much as its number of squares (1 to 4). Place every block so
// that weight x distance adds up the same on both sides.
//
// Every level has exactly one answer. Its mirror (left and right swapped) counts as the same
// answer, and so does swapping two blocks of the same weight. With only six spots the generator
// simply tries every layout.

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
// Spot positions, left to right: negative is the left side.
export const POS = [-3, -2, -1, 1, 2, 3];
// Block counts per difficulty. Each list is picked from at random, so the bigger count turns up
// now and then.
export const COUNTS = { easy: [3, 3, 3, 4], medium: [4, 5, 5], hard: [6] };
// Shapes by weight, drawn standing on the beam: rows top to bottom, at most two squares wide.
export const SHAPES = {
  1: [['#']],
  2: [['#', '#']],
  3: [['#', '#', '#'], ['#.', '##'], ['.#', '##']],
  4: [['#', '#', '#', '#'], ['##', '##'], ['#.', '#.', '##'], ['.#', '.#', '##'], ['#.', '##', '#.'], ['#.', '##', '.#'], ['.#', '##', '#.']],
};
const COLOURS = ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'];

const rand = k => Math.floor(Math.random() * k);
const pick = a => a[rand(a.length)];
const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// place[i] is the spot block i sits on, or -1 for the tray. Below zero: the left side is heavier.
export const torque = (blocks, place) => blocks.reduce((t, b, i) => (place[i] < 0 ? t : t + b.w * POS[place[i]]), 0);
export const solved = (blocks, place) => place.every(p => p >= 0) && torque(blocks, place) === 0;

// Every balanced layout of these weights, as spot -> weight strings, with mirrors folded together.
export function solutions(weights) {
  const found = new Set();
  const spots = Array(6).fill(0);
  const walk = (i, t) => {
    if (i === weights.length) {
      if (t !== 0) return;
      const a = spots.join(''), b = [...spots].reverse().join('');
      found.add(a < b ? a : b);
      return;
    }
    for (let s = 0; s < 6; s++) {
      if (spots[s]) continue;
      spots[s] = weights[i];
      walk(i + 1, t + weights[i] * POS[s]);
      spots[s] = 0;
    }
  };
  walk(0, 0);
  return [...found];
}

// opts: { difficulty }. Returns { blocks: [{ w, shape, colour }], answer: spot -> weight string }.
export function newLevel(opts) {
  const count = pick(COUNTS[opts.difficulty] ?? COUNTS.medium);
  for (;;) {
    const weights = Array.from({ length: count }, () => 1 + rand(4)).sort((a, b) => a - b);
    const spread = weights[count - 1] - weights[0];
    // All-equal sets are too easy; Hard keeps weights close so the answer isn't obvious.
    if (spread === 0 && count > 3) continue;
    if (opts.difficulty === 'hard' && (spread < 1 || spread > 2)) continue;
    const sols = solutions(weights);
    if (sols.length !== 1) continue;
    const colours = shuffle([...COLOURS]);
    const blocks = shuffle(weights.map((w, i) => ({ w, shape: pick(SHAPES[w]), colour: colours[i % colours.length] })));
    return { blocks, answer: sols[0] };
  }
}
