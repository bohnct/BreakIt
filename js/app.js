import { games, getGame } from './games.js';
import { h, header, toast } from './ui.js';
import * as playtimer from './playtimer.js';
import { renderSettings } from './settings.js';

const app = document.getElementById('app');
let current = null;
let routeId = 0;

function parseHash() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs || '') };
}

function renderHome(el) {
  el.append(
    header('Games'),
    h('nav', { class: 'list' },
      games.map(g => h('a', { class: 'tile', href: `#/game/${g.id}` },
        h('span', { class: 'tile-title' }, g.title),
        h('span', { class: 'tile-sub' }, g.blurb)))),
    h('div', { class: 'foot' }, h('a', { class: 'btn ghost', href: '#/settings' }, 'Settings')));
}

async function route() {
  const id = ++routeId;
  current?.unmount?.();
  current = null;
  playtimer.stop();
  app.replaceChildren();
  window.scrollTo(0, 0);

  const { parts, query } = parseHash();
  if (parts.length === 0) return renderHome(app);
  if (parts[0] === 'settings') return renderSettings(app);
  const game = parts[0] === 'game' && getGame(parts[1]);
  if (!game) return location.replace('#/');

  const mod = await game.load();
  if (id !== routeId) return;
  current = mod.mount(app, parts.slice(2), query) || null;
}

playtimer.onExpire(() => {
  current?.unmount?.('expired');
  current = null;
  location.hash = '#/';
  toast("Time's up. Your game is saved.", 4000);
});

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
