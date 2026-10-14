import { games } from './games.js';
import { h, header, toast, fmtTime, chips } from './ui.js';
import { applyTheme } from './theme.js';
import { remove } from './storage.js';
import * as playtimer from './playtimer.js';

const STEPS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180];

export const APP_VERSION = '1.1.0';

export function renderSettings(el) {
  const s = playtimer.getSettings();

  const toggle = h('button', {
    class: 'switch', role: 'switch', 'aria-checked': String(s.limitEnabled),
    onclick: () => {
      const on = toggle.getAttribute('aria-checked') !== 'true';
      toggle.setAttribute('aria-checked', String(on));
      playtimer.setSettings({ limitEnabled: on });
      minutesRow.classList.toggle('disabled', !on);
    },
  }, h('span', { class: 'knob' }));

  const minutesVal = h('span', { class: 'value' }, `${s.limitMinutes} min`);
  const step = dir => {
    const cur = playtimer.getSettings().limitMinutes;
    let i = STEPS.findIndex(m => m >= cur);
    if (i < 0) i = STEPS.length - 1;
    if (STEPS[i] !== cur && dir < 0) i++;
    const next = STEPS[Math.min(STEPS.length - 1, Math.max(0, i + dir))];
    playtimer.setSettings({ limitMinutes: next });
    minutesVal.textContent = `${next} min`;
  };
  const minutesRow = h('div', { class: 'row' + (s.limitEnabled ? '' : ' disabled') },
    h('span', {}, 'Limit'),
    h('div', { class: 'stepper' },
      h('button', { class: 'btn small', 'aria-label': 'Less time', onclick: () => step(-1) }, '−'),
      minutesVal,
      h('button', { class: 'btn small', 'aria-label': 'More time', onclick: () => step(1) }, '+')));

  const used = h('span', { class: 'value' }, fmtTime(playtimer.usedMs() / 1000));

  el.append(
    header('Settings', '#/'),
    h('section', { class: 'card' },
      h('h2', {}, 'Theme'),
      chips([{ value: 'night', label: 'Night' }, { value: 'day', label: 'Day' }], s.theme, 'Theme', v => {
        playtimer.setSettings({ theme: v });
        applyTheme(v);
      })),
    h('section', { class: 'card' },
      h('h2', {}, 'Play time limit'),
      h('p', { class: 'muted' }, 'When time runs out you are sent back to the main menu. Your game is saved so you can continue it later.'),
      h('div', { class: 'row' }, h('span', {}, 'Enabled'), toggle),
      minutesRow,
      h('div', { class: 'row' }, h('span', {}, 'Played so far'), used),
      h('div', { class: 'row' },
        h('span', {}),
        h('button', { class: 'btn small', onclick: () => {
          playtimer.resetPlaytime();
          used.textContent = fmtTime(0);
          toast('Play timer reset');
        } }, 'Reset timer'))),
    h('section', { class: 'card' },
      h('h2', {}, 'Data'),
      games.map(g => h('div', { class: 'row' },
        h('span', { class: 'ellipsis' }, g.title),
        h('button', { class: 'btn small', onclick: () => {
          if (!confirm(`Reset all stats for "${g.title}"?`)) return;
          remove(g.statsKey);
          toast('Stats reset');
        } }, 'Reset stats')))),
    h('p', { class: 'muted center' }, `v${APP_VERSION}`));
}
