// Small still scenes of each game, shown at the top of its menu. Drawn in the games' own
// colours; outlines use currentColor so they follow the Night/Day theme.
import { h } from './ui.js';

const P = { red: '#f94144', orange: '#f3722c', amber: '#f8961e', yellow: '#f9c74f', green: '#90be6d', teal: '#43aa8b', blue: '#577590' };

const panIcon = (x, y, s) =>
  `<g transform="translate(${x} ${y}) scale(${s / 24})"><circle cx="9.5" cy="14" r="7" fill="#000"/><path d="M14.8 8.7 21 2.5" stroke="#000" stroke-width="2.8" stroke-linecap="round"/></g>`;

function pans() {
  const map = ['01122', '01332', '44332', '55366', '55566'];
  const cols = [P.red, P.amber, P.yellow, P.green, P.teal, P.blue, P.orange];
  const size = 12, gap = 1.6, x0 = 50, y0 = 4;
  let out = `<rect x="${x0 - 3}" y="${y0 - 3}" width="${5 * (size + gap) + 4.4}" height="${5 * (size + gap) + 4.4}" rx="6" fill="none" stroke="currentColor" stroke-width="1.2"/>`;
  map.forEach((row, r) => [...row].forEach((g, c) => {
    out += `<rect x="${x0 + c * (size + gap)}" y="${y0 + r * (size + gap)}" width="${size}" height="${size}" rx="3" fill="${cols[+g]}"/>`;
  }));
  out += panIcon(x0 + 0.3, y0 + 0.5, 11) + panIcon(x0 + 2 * (size + gap) + 0.3, y0 + 3 * (size + gap) + 0.5, 11);
  return out;
}

function blocks() {
  // A jammed car park: your red car on the exit row, a truck and cars in its way.
  // Each vehicle gets a dark windscreen at its front end, like the game's.
  const veh = (x, y, w, hh, c) => {
    const horiz = w > hh, glass = horiz
      ? `<rect x="${x + w - 5.2}" y="${y + 2.6}" width="2" height="${hh - 5.2}" rx=".6" fill="#000" fill-opacity=".38"/>`
      : `<rect x="${x + 2.6}" y="${y + hh - 5.2}" width="${w - 5.2}" height="2" rx=".6" fill="#000" fill-opacity=".38"/>`;
    return `<rect x="${x + 0.8}" y="${y + 0.8}" width="${w - 1.6}" height="${hh - 1.6}" rx="2.4" fill="${c}"/>${glass}`;
  };
  const u = 10, x0 = 50, y0 = 4, r = x0 + 6 * u + 2;
  // Walls all round, with a gap on the right level with the red car.
  return `<path d="M${r} ${y0 + 2 * u} V${y0 - 2} H${x0 - 2} V${y0 + 6 * u + 2} H${r} V${y0 + 3 * u}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M${r + 4} ${y0 + 2 * u + 3} l3 2 -3 2" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
    ${veh(x0, y0 + 2 * u, 2 * u, u, P.red)}
    <rect x="${x0 + 0.8}" y="${y0 + 2 * u + 0.8}" width="${2 * u - 1.6}" height="${u - 1.6}" rx="2.4" fill="none" stroke="currentColor" stroke-width="1"/>
    <path d="M${x0 + 3} ${y0 + 2 * u + 4.2} H${x0 + 13} M${x0 + 3} ${y0 + 2 * u + 5.8} H${x0 + 13}" stroke="#fff" stroke-width=".9"/>
    ${veh(x0 + 3 * u, y0 + u, u, 3 * u, P.blue)}
    ${veh(x0 + 5 * u, y0 + u, u, 2 * u, P.yellow)}
    ${veh(x0 + 2 * u, y0, 3 * u, u, P.green)}
    ${veh(x0, y0 + 3 * u, u, 2 * u, P.teal)}
    ${veh(x0 + 1 * u, y0 + 4 * u, 3 * u, u, P.amber)}
    ${veh(x0 + 4 * u, y0 + 3 * u, u, 3 * u, P.yellow)}
    ${veh(x0 + 2 * u, y0 + u, u, 2 * u, P.green)}
    ${veh(x0, y0 + u, 2 * u, u, P.blue)}
    ${veh(x0, y0 + 5 * u, 2 * u, u, P.green)}
    ${veh(x0 + 5 * u, y0 + 4 * u, u, 2 * u, P.blue)}`;
}

function mahjong() {
  // A small stack of ivory tiles with clothing on them (same shapes as the game), the top one picked.
  const cloth = d => c => `<path transform="scale(.6) translate(-12 -12)" d="${d}" fill="${c}" stroke="${c}" stroke-linejoin="round"/>`;
  const sym = {
    dot: cloth('M8.5 3.5Q12 6.5 15.5 3.5L21 6.8 19 10.8 16.8 9.8V20.5H7.2V9.8L5 10.8 3 6.8Z'),
    square: cloth('M8 2.5H14V12.5L19.2 16Q21.3 17.7 19.8 19.8L18.6 21Q17 22.3 15.2 21.1L9 16.4Q8 15.6 8 14.3Z'),
    diamond: cloth('M3 6.5H21V9.5Q17.2 11 14.8 17.5H9.2Q6.8 11 3 9.5Z'),
    ring: cloth('M6 3H18L19.5 21H14.3L12 10 9.7 21H4.5Z'),
  };
  const tile = (x, y, s, c, sel = false) => `<g transform="translate(${x} ${y})"><rect x="-9" y="-11.5" width="18" height="23" rx="3.5" fill="#efe9dc" stroke="${sel ? 'currentColor' : 'none'}" stroke-width="1.6"/><rect x="-9" y="-11.5" width="18" height="23" rx="3.5" fill="none" stroke="#9c9481" stroke-width=".6"/>${sym[s](c)}</g>`;
  return [
    tile(44, 44, 'dot', P.red), tile(64, 44, 'square', P.blue), tile(84, 44, 'ring', P.teal), tile(104, 44, 'diamond', P.amber), tile(124, 44, 'dot', P.green),
    tile(61, 39, 'diamond', P.amber), tile(81, 39, 'square', P.red), tile(101, 39, 'ring', P.teal),
    tile(78, 34, 'dot', P.red, true),
  ].join('');
}

function garlic() {
  const bulb = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -10 C2 -6 8.5 -5.5 7.6 1 C7.2 6 3.2 7 0 7 C-3.2 7 -7.2 6 -7.6 1 C-8.5 -5.5 -2 -6 0 -10Z" fill="#f4efe2" stroke="currentColor" stroke-opacity=".4" stroke-width=".6"/><path d="M0 -8 Q-3 0 -1.4 6.6 M0 -8 Q3 0 1.4 6.6" stroke="#a89878" stroke-width=".7" fill="none"/></g>`;
  return `${bulb(80, 38, 1.4)}${bulb(64, 50, 1)}${bulb(96, 50, 1)}
    <rect x="34" y="12" width="9" height="9" rx="2.5" fill="${P.amber}"/>
    <rect x="120" y="8" width="13" height="13" rx="3.5" fill="${P.red}"/>
    <rect x="128" y="50" width="6" height="6" rx="2" fill="${P.yellow}"/>
    <rect x="24" y="46" width="10" height="10" rx="3" fill="#5c8a49"/>
    <circle cx="92" cy="28" r="1.2" fill="currentColor"/><circle cx="104" cy="22" r="1.2" fill="currentColor"/><circle cx="55" cy="22" r="1.2" fill="currentColor"/>`;
}

// Card colours match the card games: red suits red, black suits blue.
const SUIT_FILL = { '♠': P.blue, '♥': P.red, '♦': P.red, '♣': P.blue };
const card = (x, y, rot, [r, s]) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="-13" y="-18" width="26" height="36" rx="3.5" fill="${SUIT_FILL[s]}"/><text x="-9.5" y="-8" font-size="8" font-weight="700" fill="#000">${r}</text><text x="0" y="8" font-size="13" text-anchor="middle" fill="#000">${s}︎</text></g>`;
const back = (x, y, rot) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="-13" y="-18" width="26" height="36" rx="3.5" fill="var(--tile)" stroke="var(--line)"/><rect x="-9.5" y="-14.5" width="19" height="29" rx="2" fill="none" stroke="currentColor" stroke-opacity=".3"/></g>`;

function solitaire() {
  return back(40, 36, 0) + card(68, 38, -10, ['A', '♠']) + card(84, 34, 0, ['K', '♥']) + card(100, 38, 10, ['7', '♦']);
}

function hola() {
  return card(56, 36, -14, ['7', '♣']) + card(72, 32, -4, ['7', '♥']) + card(88, 32, 6, ['10', '♠']) + card(104, 36, 16, ['A', '♦']);
}

function loop() {
  // A track loop with a cube riding it, and trucks of mixed cubes parked around it.
  const path = 'M50 20 H110 V50 H86 V40 H50Z';
  const cube = (x, y, c) => `<rect x="${x - 3.5}" y="${y - 3.5}" width="7" height="7" rx="1.8" fill="${c}"/>`;
  const truck = (x, y, horiz, cs) => {
    const w = horiz ? cs.length * 9 + 3 : 12, hh = horiz ? 12 : cs.length * 9 + 3;
    return `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="3" fill="var(--bg)" stroke="currentColor" stroke-width="1"/>` +
      cs.map((c, k) => cube(horiz ? x + 6 + k * 9 : x + 6, horiz ? y + 6 : y + 6 + k * 9, c)).join('');
  };
  return `<path d="${path}" fill="none" stroke="var(--tile)" stroke-width="8" stroke-linejoin="round"/>
    <path d="${path}" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="1" stroke-linejoin="round"/>
    ${cube(80, 20, P.red)}${cube(110, 36, P.blue)}
    ${truck(64, 0, true, [P.blue, P.yellow, P.red])}${truck(116, 26, true, [P.yellow, P.yellow])}
    ${truck(32, 24, true, [P.red, P.blue].reverse())}${truck(60, 46, false, [P.yellow, P.red])}`;
}

function balance() {
  // A scale tipped toward its heavier side, with a block waiting beside it.
  const sq = (x, y, c) => `<rect x="${x}" y="${y}" width="8" height="8" rx="2" fill="${c}"/>`;
  return `<polygon points="80,46 73,58 87,58" fill="currentColor"/>
    <g transform="rotate(-6 80 45)">
      <rect x="38" y="43" width="84" height="3.5" rx="1.75" fill="currentColor"/>
      ${sq(41, 25, P.red)}${sq(41, 34, P.red)}${sq(50, 34, P.red)}
      ${sq(66, 34, P.yellow)}
      ${sq(103, 25, P.teal)}${sq(103, 34, P.teal)}
    </g>
    ${sq(130, 42, P.blue)}${sq(130, 51, P.blue)}${sq(139, 51, P.blue)}${sq(139, 42, P.blue)}`;
}

const SCENES = { pans, blocks, mahjong, garlic, solitaire, hola, loop, balance };

export function preview(id) {
  return h('div', { class: 'hero', 'aria-hidden': 'true', html: `<svg viewBox="0 0 160 70" class="hero-art">${SCENES[id]()}</svg>` });
}
