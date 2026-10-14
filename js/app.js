import { games, getGame } from './games.js';
import { h, header, toast } from './ui.js';
import * as playtimer from './playtimer.js';
import { renderSettings } from './settings.js';
import { applyTheme } from './theme.js';

applyTheme(playtimer.getSettings().theme);

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

  let mod;
  try {
    mod = await game.load();
    sessionStorage.removeItem('games.reloaded');
  } catch (err) {
    // Usually an app update arrived mid-session and the game's new code doesn't match what's
    // already loaded. One fresh reload fixes it; don't loop if it doesn't.
    if (!sessionStorage.getItem('games.reloaded')) {
      sessionStorage.setItem('games.reloaded', '1');
      return location.reload();
    }
    app.append(header('Couldn\'t open the game', '#/'), h('p', { class: 'muted center' }, 'Close the app completely and open it again.'));
    return;
  }
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
  // When an update takes over, reload once so every file comes from the same version. Games
  // save themselves on the way out, so nothing is lost. (Skipped on the very first install.)
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
}
