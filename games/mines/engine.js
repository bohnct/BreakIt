// Rules and levels for No-Guess Mines.
//
// A minesweeper board where luck never decides anything. The game opens a safe starting area for
// you, and from there every mine can be found by reasoning: a logic solver plays each board from
// that start before you see it, and boards it can't finish without guessing are thrown away.
//
// The solver knows two kinds of step. Simple: a number whose mines are all found clears the rest
// of its neighbours, and a number with exactly as many hidden neighbours as missing mines flags
// them all. Paired: comparing two overlapping numbers (for example a 1 whose hidden squares all
// border a 2) settles squares neither could alone. Harder levels need more paired steps.

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
// Board sizes, columns × rows, narrow enough for a phone held upright.
export const SIZES = {
  tiny: { w: 6, h: 8 },
  small: { w: 8, h: 10 },
  medium: { w: 9, h: 12 },
  large: { w: 10, h: 14 },
  huge: { w: 11, h: 16 },
};
// Share of squares that hide a mine, and paired steps the solver must need, by difficulty.
const DENSITY = { easy: 0.13, medium: 0.18, hard: 0.22 };
const PAIRED = { easy: 0, medium: 3, hard: 8 };

const rand = k => Math.floor(Math.random() * k);

export function neighbours(w, h) {
  const out = [];
  for (let i = 0; i < w * h; i++) {
    const x = i % w, y = Math.floor(i / w), list = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h) list.push(ny * w + nx);
      }
    }
    out.push(list);
  }
  return out;
}

export function counts(w, h, mines, nb = neighbours(w, h)) {
  return mines.map((m, i) => (m ? -1 : nb[i].reduce((k, j) => k + mines[j], 0)));
}

// Open square i, spreading through blank (0) squares. shown: 0 hidden, 1 open, 2 flagged.
export function flood(i, num, nb, shown) {
  const stack = [i];
  const opened = [];
  while (stack.length) {
    const x = stack.pop();
    if (shown[x] !== 0) continue;
    shown[x] = 1;
    opened.push(x);
    if (num[x] === 0) for (const j of nb[x]) if (shown[j] === 0) stack.push(j);
  }
  return opened;
}

// Play the board by logic alone from the start square. Returns { solved, paired }.
export function solve(w, h, mines, start) {
  const N = w * h, nb = neighbours(w, h), num = counts(w, h, mines, nb);
  const total = mines.reduce((a, b) => a + b, 0);
  const shown = new Uint8Array(N);
  let open = flood(start, num, nb, shown).length, flags = 0, paired = 0;

  for (;;) {
    let progress = false;
    // Simple steps.
    for (let i = 0; i < N; i++) {
      if (shown[i] !== 1 || num[i] <= 0) continue;
      const hid = [];
      let f = 0;
      for (const j of nb[i]) { if (shown[j] === 0) hid.push(j); else if (shown[j] === 2) f++; }
      if (!hid.length) continue;
      const left = num[i] - f;
      if (left === 0) { for (const j of hid) open += flood(j, num, nb, shown).length; progress = true; }
      else if (left === hid.length) { for (const j of hid) { shown[j] = 2; flags++; } progress = true; }
    }
    if (open === N - total) return { solved: true, paired };
    if (progress) continue;

    // Paired steps: for numbers A and B that share hidden squares, if A's missing mines minus B's
    // equals the squares only A sees, those are all mines and the squares only B sees are clear.
    const cons = [];
    const byCell = new Map();
    for (let i = 0; i < N; i++) {
      if (shown[i] !== 1 || num[i] <= 0) continue;
      const hid = [];
      let f = 0;
      for (const j of nb[i]) { if (shown[j] === 0) hid.push(j); else if (shown[j] === 2) f++; }
      if (!hid.length) continue;
      const k = cons.length;
      cons.push({ cells: hid, m: num[i] - f });
      for (const j of hid) { if (!byCell.has(j)) byCell.set(j, []); byCell.get(j).push(k); }
    }
    outer:
    for (let a = 0; a < cons.length; a++) {
      const seen = new Set();
      for (const j of cons[a].cells) for (const b of byCell.get(j)) seen.add(b);
      for (const b of seen) {
        if (b === a) continue;
        const A = cons[a], B = cons[b], inB = new Set(B.cells);
        const onlyA = A.cells.filter(j => !inB.has(j));
        const inA = new Set(A.cells);
        const onlyB = B.cells.filter(j => !inA.has(j));
        if (A.m - B.m === onlyA.length && (onlyA.length || onlyB.length)) {
          for (const j of onlyA) { shown[j] = 2; flags++; }
          for (const j of onlyB) if (shown[j] === 0) open += flood(j, num, nb, shown).length;
          progress = true;
          break outer;
        }
      }
    }
    if (progress) { paired++; if (open === N - total) return { solved: true, paired }; continue; }

    // Last resort: the total mine count settles what's left.
    const hidden = [];
    for (let i = 0; i < N; i++) if (shown[i] === 0) hidden.push(i);
    if (total - flags === 0) { for (const j of hidden) open += flood(j, num, nb, shown).length; continue; }
    if (total - flags === hidden.length) return { solved: true, paired };
    return { solved: false, paired };
  }
}

// opts: { size, difficulty }. Returns { w, h, mines: [0|1], start }.
export function generateLevel(opts) {
  const { w, h } = SIZES[opts.size] || SIZES.medium;
  const N = w * h, nb = neighbours(w, h);
  let count = Math.round(N * (DENSITY[opts.difficulty] ?? DENSITY.medium));
  const need = PAIRED[opts.difficulty] ?? PAIRED.medium;
  // Start somewhere in the middle half of the board, and keep its 3×3 clear so it opens an area.
  const sx = Math.floor(w / 4) + rand(Math.ceil(w / 2)), sy = Math.floor(h / 4) + rand(Math.ceil(h / 2));
  const start = sy * w + sx;
  const keep = new Set([start, ...nb[start]]);
  const spots = [];
  for (let i = 0; i < N; i++) if (!keep.has(i)) spots.push(i);
  const started = Date.now();
  let fallback = null;
  for (let tries = 1; ; tries++) {
    // Rare: no luck for a while. Take a solvable board that is a little easier, or a mine fewer.
    if (Date.now() - started > 4000) {
      if (fallback) return fallback;
      count--;
    }
    const mines = new Array(N).fill(0);
    for (let k = 0; k < count; k++) {
      const p = k + rand(spots.length - k);
      [spots[k], spots[p]] = [spots[p], spots[k]];
      mines[spots[k]] = 1;
    }
    const res = solve(w, h, mines, start);
    if (!res.solved) continue;
    const level = { w, h, mines, start, paired: res.paired };
    if (res.paired >= need) return level;
    if (!fallback || res.paired > fallback.paired) fallback = level;
  }
}
