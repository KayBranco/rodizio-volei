/* app.js — roteador por hash (#/rota) e Home. Cada tela é registrada em RV.Screens[nome](container, params). */
(function () {
  'use strict';
  const RV = (window.RV = window.RV || {}), { h, icon } = RV.UI, D = RV.Data;
  RV.Screens = RV.Screens || {};

  // [regex, tela, extrai params]
  const ROUTES = [
    [/^$/, 'home'],
    [/^treino$/, 'setup', () => ({ mode: 'treino' })],
    [/^jogo$/, 'setup', () => ({ mode: 'jogo' })],
    [/^live\/([\w-]+)$/, 'live', m => ({ id: m[1] })],
    [/^equipes$/, 'teams'],
    [/^equipes\/([\w-]+)$/, 'team', m => ({ id: m[1] })],
    [/^atletas$/, 'athletes'],
    [/^estatisticas$/, 'stats'],
    [/^resumo\/([\w-]+)$/, 'summary', m => ({ id: m[1] })]
  ];
  const TITLES = { setup: p => (p.mode === 'treino' ? 'Modo Treino' : 'Modo Jogo'), teams: () => 'Minhas Equipes', team: () => 'Equipe', athletes: () => 'Atletas', stats: () => 'Estatísticas e Temporadas', live: () => 'Partida', summary: () => 'Resumo da partida' };

  // cada tela pode registrar uma função de limpeza (timers, atalhos de teclado)
  let cleanup = null;
  RV.onLeave = fn => { cleanup = fn; };

  function go(path) { location.hash = '#/' + path; }
  RV.go = go;

  function render() {
    if (cleanup) { try { cleanup(); } catch (e) { /* noop */ } cleanup = null; }
    const path = location.hash.replace(/^#\/?/, '');
    let name = 'notfound', params = {};
    for (const [re, n, fn] of ROUTES) { const m = path.match(re); if (m) { name = n; params = fn ? fn(m) : {}; break; } }
    const app = document.getElementById('app'); app.innerHTML = '';
    window.scrollTo(0, 0);
    if (name === 'home') return home(app);
    const title = TITLES[name] ? TITLES[name](params) : 'Página não encontrada';
    const top = h('div', { class: 'top' },
      h('button', { class: 'sm', 'aria-label': 'Voltar para a Home', onclick: () => go('') }, icon('back'), ' Home'),
      h('h1', {}, title));
    top.querySelector('svg').setAttribute('style', 'width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:-3px');
    app.appendChild(top);
    const body = h('div', {}); app.appendChild(body);
    const fn = RV.Screens[name];
    if (fn) fn(body, params);
    else body.appendChild(h('div', { class: 'empty' }, name === 'notfound' ? 'Essa página não existe.' : 'Esta tela ainda não foi construída.'));
  }

  function tile(ic, title, desc, href) {
    const a = h('a', { class: 'tile', href }, icon(ic), h('b', {}, title), h('span', {}, desc)); return a;
  }
  function home(app) {
    const d = D.D(), live = D.liveMatch(), season = D.activeSeason();
    app.appendChild(h('div', { class: 'hero' }, h('div', { class: 'logo' }, '🏐'),
      h('div', {}, h('h1', {}, 'Rodízio de Vôlei'), h('div', { class: 'mut' }, 'Treinos, jogos, equipes e estatísticas · ', h('span', { class: 'pill' }, season ? season.name : '')))));
    if (live) {
      const t = live.mode === 'treino' ? 'treino' : 'jogo';
      app.appendChild(h('div', { class: 'banner row sp' },
        h('div', {}, h('b', {}, 'Você tem um ' + t + ' em andamento'), h('div', { class: 'sm-t mut' }, live.snapshot.teams.home.name + ' × ' + live.snapshot.teams.away.name)),
        h('button', { class: 'pri', onclick: () => go('live/' + live.id) }, 'Continuar')));
    }
    app.appendChild(h('div', { class: 'grid g2' },
      tile('dumbbell', 'Modo Treino', 'Registre ações dos atletas em treinos, sem encerrar a partida.', '#/treino'),
      tile('trophy', 'Modo Jogo', 'Placar, sets, rodízio, saque, substituições e eventos.', '#/jogo'),
      tile('users', 'Minhas Equipes', d.teams.length + ' equipe(s) · quadra e areia', '#/equipes'),
      tile('user', 'Atletas', d.athletes.length + ' atleta(s) · função, número e status', '#/atletas'),
      tile('chart', 'Estatísticas e Temporadas', d.matches.filter(m => m.finished).length + ' registro(s) finalizados', '#/estatisticas'),
      tile('book', 'Tutorial e Aprendizado', 'Rodízio 5-1, 4-2, 6-2 e vôlei de areia, animado.', 'tutorial.html')));
    const fileIn = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' }, onchange: e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader(); r.onload = () => {
        const err = D.importJSON(String(r.result));
        if (err) RV.UI.toast(err, true); else { RV.UI.toast('Backup restaurado.'); render(); }
      }; r.readAsText(f);
    } });
    app.appendChild(h('div', { class: 'row', style: { marginTop: '22px' } },
      h('button', { class: 'sm ghost', onclick: () => {
        const blob = new Blob([D.exportJSON()], { type: 'application/json' }), a = h('a', { href: URL.createObjectURL(blob), download: 'rodizio-backup-' + new Date().toISOString().slice(0, 10) + '.json' });
        document.body.appendChild(a); a.click(); a.remove();
      } }, 'Exportar backup'),
      h('button', { class: 'sm ghost', onclick: () => fileIn.click() }, 'Importar backup'), fileIn,
      h('span', { class: 'sm-t mut' }, D.isMemoryOnly() ? '⚠ Armazenamento local indisponível: os dados somem ao fechar.' : 'Dados salvos neste aparelho/navegador.')));
  }

  window.addEventListener('hashchange', render);
  window.addEventListener('DOMContentLoaded', () => { D.load(); render(); });
  RV.render = render;
})();
