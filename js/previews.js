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
  return `<rect x="34" y="6" width="92" height="56" rx="9" fill="none" stroke="currentColor" stroke-width="1.2"/>
    <rect x="62" y="2.5" width="22" height="3" rx="1.5" fill="${P.red}"/>
    <rect x="126.5" y="22" width="3" height="18" rx="1.5" fill="${P.green}"/>
    <rect x="44" y="65" width="16" height="3" rx="1.5" fill="${P.blue}"/>
    <rect x="42" y="14" width="26" height="12" rx="4" fill="${P.red}"/>
    <rect x="44" y="32" width="12" height="22" rx="4" fill="${P.blue}"/>
    <rect x="74" y="16" width="12" height="24" rx="4" fill="${P.yellow}"/>
    <rect x="92" y="22" width="24" height="12" rx="4" fill="${P.green}"/>
    <rect x="94" y="40" width="12" height="12" rx="4" fill="${P.red}"/>`;
}

function mahjong() {
  // A small stack of ivory tiles with coloured symbols, the top one picked.
  const sym = {
    dot: c => `<circle cx="0" cy="0" r="4.5" fill="${c}"/>`,
    square: c => `<rect x="-4" y="-4" width="8" height="8" rx="1.5" fill="${c}"/>`,
    diamond: c => `<path d="M0-5.5 5.5 0 0 5.5-5.5 0Z" fill="${c}"/>`,
    ring: c => `<circle cx="0" cy="0" r="4" fill="none" stroke="${c}" stroke-width="2.4"/>`,
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

const SCENES = { pans, blocks, mahjong, garlic, solitaire, hola, loop };

export function preview(id) {
  return h('div', { class: 'hero', 'aria-hidden': 'true', html: `<svg viewBox="0 0 160 70" class="hero-art">${SCENES[id]()}</svg>` });
}
