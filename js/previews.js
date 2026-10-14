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

function towers() {
  const dots = [0.25, 0.4, 0.55].map(t => `<circle cx="${52 + (100 - 52) * t}" cy="${52 + (24 - 52) * t}" r="1.8" fill="${P.green}"/>`).join('');
  return `${dots}
    <circle cx="52" cy="52" r="11" fill="${P.green}"/><text x="52" y="56" font-size="10" font-weight="700" text-anchor="middle" fill="#000">24</text>
    <circle cx="100" cy="24" r="9" fill="var(--tile)" stroke="currentColor" stroke-opacity=".5"/><text x="100" y="27.5" font-size="9" font-weight="700" text-anchor="middle" fill="currentColor">7</text>
    <rect x="62" y="6" width="16" height="16" rx="5" fill="var(--tile)" stroke="currentColor" stroke-opacity=".5"/><text x="70" y="17.5" font-size="8" font-weight="700" text-anchor="middle" fill="currentColor">12</text>
    <circle cx="124" cy="50" r="10" fill="${P.red}"/><text x="124" y="53.5" font-size="9" font-weight="700" text-anchor="middle" fill="#000">18</text>
    <line x1="84" y1="58" x2="96" y2="42" stroke="currentColor" stroke-opacity=".45" stroke-width="2.4" stroke-linecap="round"/>`;
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

// Card colours match the card games: spades blue, hearts red, diamonds orange, clubs teal.
const SUIT_FILL = { '♠': P.blue, '♥': P.red, '♦': P.amber, '♣': P.teal };
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

const SCENES = { pans, blocks, towers, garlic, solitaire, hola };

export function preview(id) {
  return h('div', { class: 'hero', 'aria-hidden': 'true', html: `<svg viewBox="0 0 160 70" class="hero-art">${SCENES[id]()}</svg>` });
}
