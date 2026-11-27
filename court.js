/* court.js — quadra vista de cima com os DOIS times (mandante embaixo, visitante em cima).
 * Mostra número, nome, função e posição (P1–P6) de cada atleta, cor do time e quem saca.
 * Renderiza a partir do estado do engine (st.cur); não tem regra de jogo aqui.
 * Quadra 9×18 m (rede em y=9); areia 8×16 m (rede em y=8). Posições em metros.
 */
(function () {
  'use strict';
  const RV = window.RV, NS = 'http://www.w3.org/2000/svg';
  const el = (tag, a, parent) => { const e = document.createElementNS(NS, tag); for (const k in (a || {})) e.setAttribute(k, a[k]); if (parent) parent.appendChild(e); return e; };

  // visto de trás da linha de fundo olhando a rede: P4 esq-rede, P3 meio-rede, P2 dir-rede, P5 esq-fundo, P6 meio-fundo, P1 dir-fundo
  const POS6 = { 0: [7.2, 15.4], 1: [7.2, 11.6], 2: [4.5, 11.6], 3: [1.8, 11.6], 4: [1.8, 15.4], 5: [4.5, 15.4] };
  const flip = (p, W, L) => [W - p[0], L - p[1]];

  function geometry(modality) {
    return modality === 'areia' ? { W: 8, L: 16 } : { W: 9, L: 18 };
  }
  function posFor(modality, team, st, idx) {
    const g = geometry(modality); let p;
    if (modality === 'areia') {
      const serving = st.cur.serving === team, cur = st.cur.srv[team].cur;
      if (serving && cur === idx) p = [5.6, 15.2];              // sacador atrás da linha de fundo
      else if (serving) p = [2.4, 12];                          // parceiro perto da rede
      else p = idx === 0 ? [2.2, 12.2] : [5.8, 13.4];
    } else p = POS6[idx];
    return team === 'home' ? p : flip(p, g.W, g.L);
  }

  function create(container, modality, cb) {
    cb = cb || {};
    const g = geometry(modality), W = g.W, L = g.L, M = 1.4;
    const svg = el('svg', { viewBox: `${-M} ${-M} ${W + 2 * M} ${L + 2 * M}`, class: 'court-svg', role: 'img', 'aria-label': 'Quadra vista de cima com os dois times' });
    svg.style.cssText = 'width:100%;height:auto;display:block;max-height:78vh;background:#0a1230;border-radius:14px';
    el('rect', { x: 0, y: 0, width: W, height: L, fill: modality === 'areia' ? '#2a2a3a' : '#0f1d44', stroke: '#4f8cff', 'stroke-width': .12 }, svg);
    if (modality === 'areia') el('rect', { x: -M + .1, y: -M + .1, width: W + 2 * M - .2, height: L + 2 * M - .2, fill: 'none' }, svg);
    if (modality !== 'areia') { // linhas de 3 m
      [L / 2 - 3, L / 2 + 3].forEach(y => el('line', { x1: 0, y1: y, x2: W, y2: y, stroke: '#27447f', 'stroke-width': .1, 'stroke-dasharray': '.5 .35' }, svg));
    }
    el('line', { x1: -.6, y1: L / 2, x2: W + .6, y2: L / 2, stroke: '#e5e7eb', 'stroke-width': .22 }, svg);
    const t1 = el('text', { x: W / 2, y: -.5, 'text-anchor': 'middle', 'font-size': .55, fill: '#93a0cf', 'font-weight': 700 }, svg);
    const t2 = el('text', { x: W / 2, y: L + 1.1, 'text-anchor': 'middle', 'font-size': .55, fill: '#93a0cf', 'font-weight': 700 }, svg);
    const layer = el('g', {}, svg);
    container.appendChild(svg);

    const figs = {}; // id -> {g, x, y, tx, ty, raf}
    let selected = null, snapshot = null;

    function figure(id, team) {
      const p = snapshot.players[id] || { name: '?', number: '?', role: '' }, color = snapshot.teams[team].color || '#4f8cff';
      const grp = el('g', { style: 'cursor:pointer' }, layer);
      grp.setAttribute('tabindex', '0'); grp.setAttribute('role', 'button');
      grp.setAttribute('aria-label', `${p.name}, camisa ${p.number}, ${snapshot.teams[team].name}`);
      el('circle', { class: 'hit', r: 1.5, fill: 'transparent' }, grp);
      const ring = el('circle', { class: 'ring', r: 1.15, fill: 'none', stroke: '#fbbf24', 'stroke-width': .16, opacity: 0 }, grp);
      el('ellipse', { cx: 0, cy: .2, rx: .95, ry: .6, fill: 'rgba(0,0,0,.35)' }, grp);
      el('ellipse', { rx: .85, ry: .68, fill: color, stroke: 'rgba(255,255,255,.75)', 'stroke-width': .07 }, grp);
      const tn = el('text', { y: .24, 'text-anchor': 'middle', 'font-size': .78, 'font-weight': 800, fill: '#fff', 'paint-order': 'stroke', stroke: 'rgba(0,0,0,.55)', 'stroke-width': .1 }, grp); tn.textContent = p.number;
      const nm = el('text', { y: 1.5, 'text-anchor': 'middle', 'font-size': .46, 'font-weight': 700, fill: '#fff', 'paint-order': 'stroke', stroke: '#070b16', 'stroke-width': .14 }, grp); nm.textContent = String(p.name).slice(0, 10);
      const tag = el('text', { class: 'tag', y: -1.0, 'text-anchor': 'middle', 'font-size': .36, 'font-weight': 700, fill: '#9fb0ff', 'paint-order': 'stroke', stroke: '#070b16', 'stroke-width': .12 }, grp);
      const srv = el('g', { class: 'srv', opacity: 0 }, grp);
      el('circle', { cx: 1.05, cy: -.75, r: .5, fill: '#fbbf24', stroke: '#7c5a00', 'stroke-width': .06 }, srv);
      const ball = el('text', { x: 1.05, y: -.58, 'text-anchor': 'middle', 'font-size': .5 }, srv); ball.textContent = '🏐';
      const pick = () => cb.onSelect && cb.onSelect(team, id);
      grp.addEventListener('click', pick);
      grp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      return { g: grp, ring, tag, srv, x: null, y: null, raf: 0 };
    }
    function moveTo(f, x, y, animate) {
      cancelAnimationFrame(f.raf);
      if (f.x == null || !animate) { f.x = x; f.y = y; f.g.setAttribute('transform', `translate(${x} ${y})`); return; }
      const x0 = f.x, y0 = f.y, t0 = performance.now(), D = 450;
      (function step(t) {
        const k = Math.min(1, (t - t0) / D), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        f.x = x0 + (x - x0) * e; f.y = y0 + (y - y0) * e; f.g.setAttribute('transform', `translate(${f.x.toFixed(3)} ${f.y.toFixed(3)})`);
        if (k < 1) f.raf = requestAnimationFrame(step);
      })(t0);
    }

    function update(st, snap) {
      snapshot = snap;
      t1.textContent = snap.teams.away.name + (st.cur.serving === 'away' ? ' · saca' : '');
      t2.textContent = snap.teams.home.name + (st.cur.serving === 'home' ? ' · saca' : '');
      const live = new Set();
      ['home', 'away'].forEach(team => {
        const lu = RV.Engine.courtLineup(st, team), sid = RV.Engine.serverId(st, team), isServing = st.cur.serving === team;
        lu.forEach((id, idx) => {
          live.add(id);
          let f = figs[id];
          if (!f) { f = figs[id] = figure(id, team); }
          const [x, y] = posFor(modality, team, st, idx);
          moveTo(f, x, y, true);
          f.tag.textContent = modality === 'areia' ? (RV.Data.ROLE_ABB[(snap.players[id] || {}).role] || '') : 'P' + (idx + 1) + ((snap.players[id] || {}).role ? ' · ' + RV.Data.ROLE_ABB[snap.players[id].role] : '');
          f.srv.setAttribute('opacity', isServing && id === sid ? 1 : 0);
          f.ring.setAttribute('opacity', id === selected ? 1 : 0);
        });
      });
      Object.keys(figs).forEach(id => { if (!live.has(id)) { cancelAnimationFrame(figs[id].raf); figs[id].g.remove(); delete figs[id]; } });
    }
    function select(id) { selected = id; Object.keys(figs).forEach(k => figs[k].ring.setAttribute('opacity', k === id ? 1 : 0)); }
    return { update, select, svg };
  }
  RV.Court = { create };
})();
