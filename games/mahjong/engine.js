// Rules and deals for the mahjong tile game (mahjong solitaire).
//
// Tiles sit on a grid in stacked layers: { x, y, z, face }. A tile is free when no tile sits on
// top of it and its left or right side is open. Pick two free tiles with the same face to
// remove them; clear every tile to win.
//
// Deals are built backwards so they're always solvable: starting from the full layout,
// repeatedly lift two tiles that would be free, and give each lifted pair the same face.
// Playing those pairs in that order clears the board. Faces come in sets of four (two pairs)
// on harder levels, so matching the wrong two can trap you later.

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
// Board size: bottom-layer columns x rows and roughly how many tiles.
export const SIZES = {
  small: { cols: 6, rows: 6, target: 36 },
  medium: { cols: 7, rows: 7, target: 64 },
  large: { cols: 8, rows: 8, target: 96 },
};
// Difficulty: how high the stacks go, and whether each design appears twice (one pair, always
// safe to match) or four times (two pairs, where matching the wrong two can trap you).
export const DIFF = {
  easy: { layers: 2, copies: 2 },
  medium: { layers: 3, copies: 4 },
  hard: { layers: 5, copies: 4 },
};
export const FACE_COUNT = 36; // distinct tile designs available (6 symbols x 6 colours)

const rand = k => Math.floor(Math.random() * k);
const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// --- Layout ---------------------------------------------------------------

// A symmetric, roughly mound-shaped stack of tile positions.
export function makeLayout({ cols, rows, layers, target }) {
  const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
  for (let attempt = 0; attempt < 200; attempt++) {
    const spots = [];
    const has = new Set();
    const key = (x, y, z) => `${x},${y},${z}`;
    for (let z = 0; z < layers; z++) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x <= Math.floor(cx); x++) {
          const mirror = cols - 1 - x;
          // Bottom layer: mostly full, thinner at the corners. Upper layers: only on top of a
          // tile, more likely towards the middle.
          const edge = Math.max(Math.abs(x - cx) / (cx + 0.5), Math.abs(y - cy) / (cy + 0.5));
          const supported = z === 0 || (has.has(key(x, y, z - 1)) && has.has(key(mirror, y, z - 1)));
          if (!supported) continue;
          const keep = z === 0 ? 0.95 - edge * edge * 0.45 : 0.8 - edge * 0.9 - z * 0.08;
          if (Math.random() > keep) continue;
          has.add(key(x, y, z));
          spots.push({ x, y, z });
          if (mirror !== x) { has.add(key(mirror, y, z)); spots.push({ x: mirror, y, z }); }
        }
      }
    }
    // Trim the top to an even count near the target.
    spots.sort((a, b) => a.z - b.z);
    while (spots.length > target || spots.length % 2) spots.pop();
    if (spots.length >= target * 0.85) return spots;
  }
  return null;
}

// --- Rules ----------------------------------------------------------------

export function isFree(tiles, i) {
  const t = tiles[i];
  if (t.gone) return false;
  let left = false, right = false;
  for (const o of tiles) {
    if (o.gone || o === t) continue;
    if (o.z === t.z + 1 && o.x === t.x && o.y === t.y) return false;
    if (o.z === t.z && o.y === t.y) {
      if (o.x === t.x - 1) left = true;
      if (o.x === t.x + 1) right = true;
    }
  }
  return !(left && right);
}

export const freeTiles = tiles => tiles.map((t, i) => i).filter(i => isFree(tiles, i));

// Every pair of free tiles with the same face.
export function matches(tiles) {
  const free = freeTiles(tiles), out = [];
  for (let a = 0; a < free.length; a++) {
    for (let b = a + 1; b < free.length; b++) {
      if (tiles[free[a]].face === tiles[free[b]].face) out.push([free[a], free[b]]);
    }
  }
  return out;
}

export const won = tiles => tiles.every(t => t.gone);

// --- Deals ----------------------------------------------------------------

// Give faces to the tiles still in play so that they can all be cleared: lift pairs of free
// tiles off one by one and give each pair a face (sets of `copies` tiles share a face).
export function assignFaces(tiles, copies) {
  const live = tiles.map((t, i) => i).filter(i => !tiles[i].gone);
  for (let attempt = 0; attempt < 300; attempt++) {
    const sim = tiles.map(t => ({ ...t }));
    const pairs = [];
    let ok = true;
    while (pairs.length * 2 < live.length) {
      const free = freeTiles(sim);
      if (free.length < 2) { ok = false; break; }
      const a = free.splice(rand(free.length), 1)[0], b = free[rand(free.length)];
      sim[a].gone = sim[b].gone = true;
      pairs.push([a, b]);
    }
    if (!ok) continue;
    const perFace = Math.max(1, copies / 2);
    const faces = shuffle([...Array(FACE_COUNT).keys()]);
    shuffle(pairs).forEach((pair, k) => {
      const face = faces[Math.floor(k / perFace) % FACE_COUNT];
      for (const i of pair) tiles[i].face = face;
    });
    return true;
  }
  return false;
}

// opts: { size: 'small' | 'medium' | 'large', difficulty }
export function newDeal(opts) {
  const L = { ...(SIZES[opts.size] ?? SIZES.medium), ...(DIFF[opts.difficulty] ?? DIFF.medium) };
  for (;;) {
    const spots = makeLayout(L);
    if (!spots) continue;
    const tiles = spots.map(s => ({ ...s, face: 0, gone: false }));
    if (assignFaces(tiles, L.copies)) return { tiles, copies: L.copies };
  }
}

// Mix up the faces of the tiles left, keeping it solvable.
export function reshuffle(tiles, copies) {
  return assignFaces(tiles, copies);
}
