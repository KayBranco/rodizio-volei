/* ui.js — helpers de DOM (sem framework): h(), toast, modal, confirmação, ícones, campos. */
(function (root) {
  'use strict';
  const RV = (root.RV = root.RV || {});
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const k in (attrs || {})) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    (function add(list) {
      list.forEach(c => {
        if (c == null || c === false) return;
        if (Array.isArray(c)) return add(c);
        el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
      });
    })(kids);
    return el;
  }
  const P = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    dumbbell: '<path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"/><path d="M7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2.5.6 4 2.6 4 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M13 16V7M18 16v-8"/>',
    book: '<path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4zM20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z"/>',
    back: '<path d="M15 5l-7 7 7 7"/>'
  };
  const icon = n => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = P[n] || ''; return s; };

  function toast(msg, bad) {
    const t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, msg);
    document.body.appendChild(t); setTimeout(() => t.remove(), bad ? 3600 : 2200);
  }
  function modal(title, body, actions) { // actions: [{label, cls, fn() -> false p/ manter aberto}]
    const ov = h('div', { class: 'ov' });
    const close = () => ov.remove();
    const box = h('div', { class: 'modal', role: 'dialog', 'aria-label': title },
      h('h2', { style: { marginTop: 0 } }, title), body,
      h('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end' } },
        (actions || []).map(a => h('button', { class: a.cls || '', onclick: () => { if (a.fn && a.fn() === false) return; close(); } }, a.label))));
    ov.appendChild(box); ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    document.body.appendChild(ov); const f = box.querySelector('input,select,button'); if (f) f.focus();
    return { close, box };
  }
  const confirmBox = (msg, okLabel, fn) => modal('Confirmar', h('p', { class: 'mut' }, msg), [{ label: 'Cancelar' }, { label: okLabel || 'Confirmar', cls: 'pri dng', fn }]);
  const field = (label, input) => h('div', { class: 'field' }, h('label', {}, label), input);
  const opt = (v, t, sel) => h('option', { value: v, selected: sel }, t);
  const fmtDate = ts => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const esc = s => String(s);

  RV.Screens = RV.Screens || {};
  RV.UI = { h, icon, toast, modal, confirmBox, field, opt, fmtDate, esc };
})(window);
