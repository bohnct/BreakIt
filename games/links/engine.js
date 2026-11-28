// Rules and levels for Colour Links.
//
// An n×n board holds pairs of coloured dots. Join each pair with a path of squares that moves up,
// down, left or right. Paths never cross or share a square, and together they must cover the whole
// board.
//
// Levels are made by carving the board into random snaking paths, keeping only their ends as dots,
// and then asking a solver how many ways the dots can be joined. Only boards with exactly one way
// are kept, so every level can be solved by reasoning rather than trial and error. Harder levels
// have bigger boards and fewer, longer paths, and of several candidates the one the solver had to
// work hardest on wins.

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
// 10×10 was tried: with only nine colours it almost never pins down to one answer.
export const SIZES = [5, 6, 7, 8, 9];
// Colours told apart at a glance, most different first. A board never has more pairs than this.
export const COLOURS = ['#f94144', '#43aa8b', '#f9c74f', '#577590', '#90be6d', '#f3722c', '#f8961e', '#4d908e', '#277da1'];

const rand = k => Math.floor(Math.random() * k);
const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function neighbours(n) {
  const out = [];
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n, list = [];
    if (r > 0) list.push(i - n);
    if (c < n - 1) list.push(i + 1);
    if (r < n - 1) list.push(i + n);
    if (c > 0) list.push(i - 1);
    out.push(list);
  }
  return out;
}

// How many pairs a board should have, by difficulty: fewer pairs means longer, harder paths.
export function pairRange(n, difficulty) {
  const lo = { easy: n - 1, medium: n - 2, hard: n - 3 }[difficulty] ?? n - 2;
  const hi = { easy: n + 1, medium: n, hard: n - 1 }[difficulty] ?? n;
  return [Math.max(3, Math.min(lo, COLOURS.length - 2)), Math.max(4, Math.min(hi, COLOURS.length))];
}

// Carve the board into snaking paths of at least 3 squares. Returns a list of paths (each a list
// of squares, in order) or null if it painted itself into a corner.
export function carve(n, nb, maxLen, maxPairs = Infinity) {
  const N = n * n, owner = new Int16Array(N).fill(-1), paths = [];
  const free = i => nb[i].reduce((k, j) => k + (owner[j] < 0), 0);
  for (;;) {
    // Start in the tightest spot left, so corners and pockets don't get stranded.
    let best = -1, bestFree = 9;
    for (let i = 0; i < N; i++) {
      if (owner[i] >= 0) continue;
      const f = free(i) + Math.random() * 0.9;
      if (f < bestFree) { bestFree = f; best = i; }
    }
    if (best < 0) break;
    const id = paths.length, path = [best], len = 3 + rand(Math.max(1, maxLen - 2));
    owner[best] = id;
    while (path.length < len) {
      // A path never runs alongside itself: those bends are what give boards a second answer.
      const last = path[path.length - 1];
      const opts = nb[last].filter(j => owner[j] < 0 && nb[j].every(k => k === last || owner[k] !== id));
      if (!opts.length) break;
      // Mostly hug the walls and other paths (fewest onward exits), sometimes wander.
      let next;
      if (Math.random() < 0.7) {
        let low = 9;
        for (const j of shuffle(opts)) { const f = free(j); if (f < low) { low = f; next = j; } }
      } else next = opts[rand(opts.length)];
      owner[next] = id;
      path.push(next);
    }
    paths.push(path);
  }
  // Paths shorter than 3 squares join onto a neighbouring path's end, or the carve is thrown away.
  for (let guard = 0; guard < 50; guard++) {
    const k = paths.findIndex(p => p && p.length < 3);
    if (k < 0) break;
    const p = paths[k];
    let joined = false;
    for (let m = 0; m < paths.length && !joined; m++) {
      const q = paths[m];
      if (m === k || !q) continue;
      for (const [a, b] of [[p, q], [p.slice().reverse(), q], [p, q.slice().reverse()], [p.slice().reverse(), q.slice().reverse()]]) {
        if (nb[a[a.length - 1]].includes(b[0])) { paths[m] = a.concat(b); paths[k] = null; joined = true; break; }
      }
    }
    if (!joined) return null;
  }
  const out = paths.filter(Boolean);
  // Too many pairs: join paths whose ends touch, end to end, until there are few enough.
  while (out.length > maxPairs) {
    const joins = [];
    for (let k = 0; k < out.length; k++) {
      for (let m = 0; m < out.length; m++) {
        if (k === m) continue;
        const p = out[k], q = out[m];
        if (nb[p[p.length - 1]].includes(q[0])) joins.push([k, m, false, false]);
        if (nb[p[0]].includes(q[0])) joins.push([k, m, true, false]);
        if (nb[p[p.length - 1]].includes(q[q.length - 1])) joins.push([k, m, false, true]);
      }
    }
    if (!joins.length) break;
    const [k, m, revP, revQ] = joins[rand(joins.length)];
    const p = revP ? out[k].slice().reverse() : out[k], q = revQ ? out[m].slice().reverse() : out[m];
    out[k] = p.concat(q);
    out.splice(m, 1);
  }
  return out;
}

// Count the ways to join the dots, stopping at `limit`. ends: [[a, b], ...]. Returns
// { count, nodes, sols } (sols: each answer found, as square -> pair) or null if the search ran past
// maxNodes.
export function countSolutions(n, ends, limit = 2, maxNodes = 400000) {
  const N = n * n, nb = neighbours(n), K = ends.length;
  const owner = new Int16Array(N).fill(-1);
  const head = new Int32Array(K), target = new Int32Array(K), done = new Uint8Array(K);
  let left = N, count = 0, nodes = 0, aborted = false;
  const sols = [];
  ends.forEach(([a, b], c) => {
    owner[a] = c; owner[b] = c; left -= 2;
    // Grow from whichever end has less room: fewer choices to try.
    const fa = nb[a].filter(j => owner[j] < 0).length, fb = nb[b].filter(j => owner[j] < 0).length;
    if (fa <= fb) { head[c] = a; target[c] = b; } else { head[c] = b; target[c] = a; }
  });
  const isEnd = new Int16Array(N).fill(-1); // colour whose head or target is here, while unfinished
  const comp = new Int32Array(N);
  const stack = new Int32Array(N);

  // Quick dead-end tests: every empty square needs two ways in, every unfinished pair needs an
  // empty region (or each other) to join through, and every empty region needs a pair to fill it.
  function ok() {
    isEnd.fill(-1);
    for (let c = 0; c < K; c++) if (!done[c]) { isEnd[head[c]] = c; isEnd[target[c]] = c; }
    for (let i = 0; i < N; i++) {
      if (owner[i] >= 0) continue;
      let d = 0;
      for (const j of nb[i]) if (owner[j] < 0 || isEnd[j] >= 0) d++;
      if (d < 2) return false;
    }
    comp.fill(-1);
    let nc = 0;
    const touchH = [], touchT = [];
    for (let i = 0; i < N; i++) {
      if (owner[i] >= 0 || comp[i] >= 0) continue;
      const h = new Set(), t = new Set();
      let sp = 0;
      stack[sp++] = i; comp[i] = nc;
      while (sp) {
        const x = stack[--sp];
        for (const j of nb[x]) {
          if (owner[j] < 0) { if (comp[j] < 0) { comp[j] = nc; stack[sp++] = j; } }
          else if (!done[owner[j]]) {
            if (head[owner[j]] === j) h.add(owner[j]);
            if (target[owner[j]] === j) t.add(owner[j]);
          }
        }
      }
      touchH.push(h); touchT.push(t);
      let fillable = false;
      for (const c of h) if (t.has(c)) { fillable = true; break; }
      if (!fillable) return false;
      nc++;
    }
    for (let c = 0; c < K; c++) {
      if (done[c] || nb[head[c]].includes(target[c])) continue;
      let joined = false;
      for (let k = 0; k < nc && !joined; k++) joined = touchH[k].has(c) && touchT[k].has(c);
      if (!joined) return false;
    }
    return true;
  }

  function solve() {
    if (aborted || count >= limit) return;
    if (++nodes > maxNodes) { aborted = true; return; }
    let pick = -1, pickMoves = null;
    for (let c = 0; c < K; c++) {
      if (done[c]) continue;
      const moves = nb[head[c]].filter(j => owner[j] < 0 || j === target[c]);
      if (!moves.length) return;
      if (!pickMoves || moves.length < pickMoves.length) { pick = c; pickMoves = moves; }
    }
    if (pick < 0) { if (left === 0) { count++; sols.push(owner.slice()); } return; }
    if (!ok()) return;
    const c = pick, from = head[c];
    for (const m of pickMoves) {
      if (m === target[c]) {
        done[c] = 1;
        solve();
        done[c] = 0;
      } else {
        owner[m] = c; head[c] = m; left--;
        solve();
        owner[m] = -1; head[c] = from; left++;
      }
      if (aborted || count >= limit) return;
    }
  }
  solve();
  return aborted ? null : { count, nodes, sols };
}

// opts: { n, difficulty }. Returns { n, ends: [[a, b], ...], colours: [...], solution: [path, ...] }.
export function generateLevel(opts) {
  const n = SIZES.includes(opts.n) ? opts.n : 6;
  const nb = neighbours(n);
  const [lo, hi] = pairRange(n, opts.difficulty);
  const want = { easy: 1, medium: 2, hard: 3 }[opts.difficulty] ?? 2;
  const started = Date.now(), budget = 2000;
  const found = [];
  while (found.length < want && !(found.length && Date.now() - started > budget)) {
    // Running very long with nothing found: allow another pair, which pins boards down faster.
    const extra = Math.min(2, Math.floor((Date.now() - started) / (budget * 2)));
    const floor = Date.now() - started > budget * 3 ? 3 : lo; // and, past that, any number of pairs
    const top = Math.min(COLOURS.length, hi + extra);
    const target = lo + rand(top - lo + 1);
    const maxLen = Math.max(4, Math.round((n * n / target) * 1.7));
    const paths = carve(n, nb, maxLen, top);
    if (!paths || paths.length > top) continue;
    const board = pinDown(n, paths, top, opts.maxNodes || 20000);
    if (board && board.paths.length >= floor) found.push(board);
  }
  const best = found.reduce((a, b) => (b.nodes > a.nodes ? b : a));
  const colours = shuffle(COLOURS.slice(0, best.ends.length));
  return { n, ends: best.ends, colours, solution: best.paths, work: best.nodes };
}

// Make a carved board have exactly one answer. While the solver finds a second one, split one of
// our paths where that answer disagrees with it: the new pair of dots rules the other answer out.
// Returns { paths, ends, nodes } or null.
export function pinDown(n, paths, maxPairs, maxNodes) {
  for (let step = 0; step < 8; step++) {
    const ends = paths.map(p => [p[0], p[p.length - 1]]);
    const res = countSolutions(n, ends, 2, maxNodes);
    if (!res) return null;
    if (res.count === 1) return { paths, ends, nodes: res.nodes };
    if (paths.length >= maxPairs) return null;
    const mine = new Int16Array(n * n);
    paths.forEach((p, c) => p.forEach(i => { mine[i] = c; }));
    // The other answer may use the very same squares, with one path winding through them another
    // way. Splitting can't fix that, so give up on this board.
    const alt = res.sols.find(s => s.some((v, i) => v !== mine[i]));
    if (!alt) return null;
    const cuts = [];
    // Both halves keep at least 3 squares.
    paths.forEach((p, c) => {
      for (let k = 2; k <= p.length - 4; k++) if (alt[p[k]] !== c || alt[p[k + 1]] !== c) cuts.push([c, k]);
    });
    if (!cuts.length) return null;
    const [c, k] = cuts[rand(cuts.length)];
    const p = paths[c];
    paths = paths.slice();
    paths.splice(c, 1, p.slice(0, k + 1), p.slice(k + 1));
  }
  return null;
}
