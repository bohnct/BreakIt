// Tiny DOM helpers shared by every screen.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function header(title, backHref) {
  return h('header', { class: 'bar' },
    backHref ? h('a', { class: 'back', href: backHref, 'aria-label': 'Back' }, '←') : h('span', { class: 'back' }),
    h('h1', {}, title),
    h('span', { class: 'bar-right' }));
}

let toastTimer;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// Single-choice pill buttons. options: [{ value, label }]
export function chips(options, value, label, onPick) {
  const wrap = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': label });
  const draw = v => {
    wrap.replaceChildren(...options.map(o => h('button', {
      class: 'chip' + (o.value === v ? ' on' : ''), role: 'radio', 'aria-checked': String(o.value === v),
      onclick: () => { onPick(o.value); draw(o.value); },
    }, o.label)));
  };
  draw(value);
  return wrap;
}

// Multi-choice pill buttons. selected: Set of values, updated in place.
export function toggleChips(options, selected, label) {
  return h('div', { class: 'chips', role: 'group', 'aria-label': label },
    options.map(o => {
      const btn = h('button', {
        class: 'chip' + (selected.has(o.value) ? ' on' : ''), 'aria-pressed': String(selected.has(o.value)),
        onclick: () => {
          if (selected.has(o.value)) selected.delete(o.value); else selected.add(o.value);
          btn.classList.toggle('on', selected.has(o.value));
          btn.setAttribute('aria-pressed', String(selected.has(o.value)));
        },
      }, o.label);
      return btn;
    }));
}

export function statTile(label, value) {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-val' }, value), h('span', { class: 'stat-lbl' }, label));
}

// Table of completion times per group. groups: [{ label, sum }] where sum comes from summarize().
export function breakdown(title, groups) {
  const rows = groups.filter(g => g.sum.count);
  if (!rows.length) return null;
  return h('section', { class: 'card' },
    h('h2', {}, title),
    h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['', 'Done', 'Avg', 'Min', 'Max'].map(t => h('th', {}, t)))),
      h('tbody', {}, rows.map(g => h('tr', {},
        h('td', {}, g.label), h('td', {}, g.sum.count),
        h('td', {}, fmtTime(g.sum.avg)), h('td', {}, fmtTime(g.sum.min)), h('td', {}, fmtTime(g.sum.max)))))));
}

export function fmtTime(sec) {
  if (sec == null || !isFinite(sec)) return '–';
  sec = Math.round(sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
