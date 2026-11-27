/* match.js — configuração (Treino/Jogo) e tela ao vivo.
 * A partida é salva a cada evento em D.matches (rec.events). Tudo que aparece na tela vem de
 * Engine.replayTrace(rec.cfg, rec.events): desfazer = tirar o último evento.
 */
(function () {
  'use strict';
  const RV = window.RV, { h, toast, modal, confirmBox, field, opt } = RV.UI, D = RV.Data, E = RV.Engine;
  const abb = r => D.ROLE_ABB[r] || '';
  const otherT = E.other;

  /* ============ CONFIGURAÇÃO ============ */
  RV.Screens.setup = function (root, p) {
    const mode = p.mode, d0 = D.D(), live = D.liveMatch();
    if (live) {
      root.appendChild(h('div', { class: 'banner' }, h('b', {}, 'Já existe um ' + (live.mode === 'treino' ? 'treino' : 'jogo') + ' em andamento'),
        h('div', { class: 'sm-t mut', style: { margin: '4px 0 10px' } }, live.snapshot.teams.home.name + ' × ' + live.snapshot.teams.away.name + '. Termine ou descarte antes de começar outro.'),
        h('div', { class: 'row' }, h('button', { class: 'pri', onclick: () => RV.go('live/' + live.id) }, 'Continuar'),
          h('button', { class: 'dng', onclick: () => confirmBox('Descartar a partida em andamento? Os registros dela serão perdidos.', 'Descartar', () => { D.remove('matches', live.id); toast('Partida descartada.'); RV.render(); }) }, 'Descartar'))));
      return;
    }
    const ANON = 'anon';
    // conf por time: sys, rot, lineup[], bench[], libero
    const S = { modality: 'quadra', team: { home: null, away: null }, anonName: 'Adversário', roles: {}, conf: { home: {}, away: {} }, first: 'home', target: 25, season: D.activeSeason().id };
    const box = h('div', {}); root.appendChild(box);
    const isAnon = t => S.team[t] === ANON;
    // função efetiva NESTA partida: a escolhida aqui, senão a do cadastro (o cadastro não muda)
    const athletes = t => (isAnon(t) || !S.team[t] ? [] : D.teamAthletes(S.team[t]).map(a => Object.assign({}, a, { reg: a.role, role: S.roles[a.id] || a.role })));
    const need = () => D.SIZE[S.modality];

    function autofill(t) {
      const c = S.conf[t]; const all = athletes(t); c.manual = false;
      if (isAnon(t) || !all.length) { c.lineup = new Array(need()).fill(''); c.bench = []; c.libero = ''; return; }
      if (S.modality === 'areia') {
        const tit = all.slice().sort((a, b) => (a.status === 'titular' ? 0 : 1) - (b.status === 'titular' ? 0 : 1) || a.number - b.number);
        c.lineup = [0, 1].map(i => (tit[i] ? tit[i].id : '')); c.bench = []; c.libero = ''; return;
      }
      const sys = E.SYSTEMS[c.sys];
      const lib = sys.libero ? (all.find(a => a.role === 'Líbero') || {}).id || '' : '';
      c.libero = lib;
      c.lineup = E.autoLineup(c.sys, c.rot, all, lib ? [lib] : []);
      c.bench = all.filter(a => a.id !== lib && !c.lineup.includes(a.id)).map(a => a.id);
    }
    function pickTeams() {
      const ts = d0.teams.filter(t => t.modality === S.modality);
      if (!ts.find(t => t.id === S.team.home)) S.team.home = ts[0] ? ts[0].id : null;
      if (S.team.away !== ANON || mode === 'treino') {
        if (!ts.find(t => t.id === S.team.away) || S.team.away === S.team.home) S.team.away = (ts.find(t => t.id !== S.team.home) || {}).id || (mode === 'jogo' ? ANON : null);
      }
      ['home', 'away'].forEach(t => { S.conf[t] = Object.assign({ sys: '5-1', rot: 1 }, { sys: S.conf[t].sys || '5-1', rot: S.conf[t].rot || 1 }); autofill(t); });
    }
    pickTeams();

    // ---- repetir a última configuração (mesmas equipes, escalação, funções) ----
    const LAST = 'rv2:last:' + mode;
    const getLast = () => { try { return JSON.parse(localStorage.getItem(LAST)); } catch (e) { return null; } };
    function lastValid(L) {
      if (!L || !D.MODALITIES[L.modality] || !L.team || !L.conf) return false;
      for (const t of ['home', 'away']) {
        const id = L.team[t];
        if (id === ANON) { if (mode !== 'jogo') return false; continue; }
        const tm = D.find('teams', id); if (!tm || tm.modality !== L.modality) return false;
        const c = L.conf[t]; if (!c) return false;
        const ids = (c.lineup || []).concat(c.bench || [], c.libero ? [c.libero] : []);
        if (ids.some(x => x && !D.teamAthletes(id).some(a => a.id === x))) return false;
      }
      return L.team.home !== L.team.away;
    }
    function applyLast(L) { S.modality = L.modality; S.team = L.team; S.anonName = L.anonName || 'Adversário'; S.roles = L.roles || {}; S.first = L.first || 'home'; S.conf = L.conf; ['home', 'away'].forEach(t => { S.conf[t].manual = true; }); }

    function keepScroll(fn) { const y = window.scrollY; fn(); window.scrollTo(0, y); }
    function nesteJogoLabel() { return ' neste jogo'; }

    function teamCard(t) {
      const c = S.conf[t], label = t === 'home' ? 'Time A · sua equipe' : 'Time B · adversário';
      if (isAnon(t)) {
        const nm = h('input', { value: S.anonName, maxlength: 30, placeholder: 'Nome do adversário (opcional)', oninput: () => { S.anonName = nm.value; } });
        return h('div', { class: 'card' }, h('h3', {}, label), field('Nome do adversário (opcional)', nm),
          h('p', { class: 'sm-t mut', style: { margin: 0 } }, 'Sem cadastro: o adversário entra só com o placar, o saque e o rodízio. Você registra os pontos dele com "+1" e as estatísticas dos seus atletas continuam completas. As ações do adversário não são registradas por atleta.'));
      }
      const team = D.find('teams', S.team[t]); if (!team) return h('div', { class: 'card' }, label);
      const all = athletes(t), beach = S.modality === 'areia';
      const byId = id => all.find(a => a.id === id);
      const head = [h('h3', {}, h('span', { class: 'dot', style: { background: team.color } }), label + ': ' + team.name)];
      if (!beach) {
        const sysSel = h('select', { 'aria-label': 'Sistema ' + team.name, onchange: () => { c.sys = sysSel.value; autofill(t); keepScroll(draw); } }, Object.keys(E.SYSTEMS).map(k => opt(k, E.SYSTEMS[k].label, c.sys === k)));
        const rotSel = h('select', { 'aria-label': 'Rotação inicial ' + team.name, onchange: () => { c.rot = Number(rotSel.value); autofill(t); keepScroll(draw); } }, [1, 2, 3, 4, 5, 6].map(r => opt(String(r), 'R' + r, c.rot === r)));
        head.push(h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', gap: '8px' } }, field('Sistema', sysSel), field('Rotação inicial', rotSel)));
        head.push(h('div', { class: 'sm-t mut', style: { marginBottom: '6px' } }, E.SYSTEMS[c.sys].text + ' A escalação abaixo já segue o tutorial; você pode trocar atletas.'));
      }
      const setSlot = (i, id) => {
        const lu = c.lineup, prev = lu[i], from = lu.indexOf(id);
        if (id && from >= 0 && from !== i) lu[from] = prev; // troca de lugar entre dois
        else if (prev && !c.bench.includes(prev) && prev !== c.libero) c.bench.push(prev);
        c.manual = true; lu[i] = id; c.bench = c.bench.filter(x => lu.indexOf(x) < 0 && x !== c.libero);
        if (id === c.libero) c.libero = '';
        keepScroll(draw);
      };
      const mk = i => {
        const sel = h('select', { 'aria-label': (beach ? 'Atleta ' + (i + 1) : 'Posição P' + (i + 1)) + ' ' + team.name, onchange: () => setSlot(i, sel.value) },
          opt('', '— escolher —', !c.lineup[i]), all.map(a => opt(a.id, '#' + a.number + ' ' + a.name + ' (' + abb(a.role) + (a.role !== a.reg ? '*' : '') + ')', c.lineup[i] === a.id)));
        return h('div', { class: 'field', style: { margin: '4px 0' } }, h('label', {}, beach ? (i === 0 ? 'Atleta 1 · saca primeiro' : 'Atleta 2') : 'P' + (i + 1)), sel);
      };
      const grid = beach ? h('div', { class: 'court-pick-grid beach' }, mk(0), mk(1))
        : h('div', { class: 'court-pick-wrap' },
            h('div', { class: 'court-net-bar' }, '▲ REDE'),
            h('div', { class: 'court-pick-grid' }, [3, 2, 1, 4, 5, 0].map(mk)));
      const parts = head.concat([grid]);
      if (!beach && all.length) {
        const changedRoles = all.some(a => a.role !== a.reg);
        const rows = all.map(a => {
          const rs = h('select', { class: 'role-edit-btn', 'aria-label': 'Alterar função de ' + a.name + nesteJogoLabel(), onchange: () => {
            if (rs.value === a.reg) delete S.roles[a.id]; else S.roles[a.id] = rs.value;
            if (!c.manual) autofill(t);
            keepScroll(draw);
          } }, D.ROLES.map(r => opt(r, r + (r === a.reg ? ' · cadastro' : ''), a.role === r)));
          return h('div', { class: 'role-player-row' },
            h('div', { class: 'role-player-info' },
              h('span', { class: 'num' }, a.number),
              h('div', { class: 'role-player-name', title: a.name }, a.name)),
            rs);
        });
        parts.push(h('section', { class: 'role-editor' },
          h('div', { class: 'role-editor-head' },
            h('b', {}, 'Função de cada atleta neste jogo'),
            h('span', { class: 'pill' }, changedRoles ? 'Personalizada' : 'Do cadastro')),
          h('div', { class: 'sm-t mut', style: { margin: '5px 0 10px' } }, 'Toque no botão para escolher a função que cada atleta vai exercer. A mudança vale só para esta partida; o cadastro original não muda.'),
          h('div', { class: 'role-player-list' }, rows)));
      }
      if (!beach) {
        const warns = E.checkLineup(c.sys, c.rot, c.lineup.map(id => (byId(id) || {}).role || ''));
        if (warns.length) parts.push(h('div', { class: 'sm-t', style: { color: 'var(--gold)', marginTop: '8px' } }, warns.map(w => h('div', {}, '⚠ ' + w)), h('button', { class: 'sm', style: { marginTop: '6px' }, onclick: () => { autofill(t); keepScroll(draw); } }, 'Reorganizar pelo tutorial')));
        if (E.SYSTEMS[c.sys].libero) {
          const cands = all.filter(a => !c.lineup.includes(a.id)).sort((a, b) => (b.role === 'Líbero') - (a.role === 'Líbero'));
          const ls = h('select', { 'aria-label': 'Líbero ' + team.name, onchange: () => {
            const prev = c.libero, nu = ls.value, pa = all.find(a => a.id === prev);
            if (pa && S.roles[prev] === 'Líbero' && pa.reg !== 'Líbero') delete S.roles[prev];
            c.libero = nu; c.manual = true; c.bench = c.bench.filter(x => x !== nu);
            if (nu) { const na = all.find(a => a.id === nu); if (na && na.reg !== 'Líbero') S.roles[nu] = 'Líbero'; }
            keepScroll(draw);
          } },
            opt('', 'Sem líbero', !c.libero), cands.map(a => opt(a.id, '#' + a.number + ' ' + a.name + (a.role === 'Líbero' ? '' : ' (' + abb(a.role) + ')'), c.libero === a.id)));
          parts.push(field('Líbero (entra no lugar do central no fundo, P5/P6)', ls));
        } else parts.push(h('div', { class: 'sm-t mut', style: { marginTop: '8px' } }, 'O 4-2 não usa líbero.'));
        const benchOpts = all.filter(a => !c.lineup.includes(a.id) && a.id !== c.libero);
        parts.push(h('div', { class: 'lbl mut sm-t', style: { margin: '10px 0 4px' } }, 'Banco (substituições)'));
        parts.push(benchOpts.length ? h('div', { class: 'chips' }, benchOpts.map(a => h('span', { class: 'chip' + (c.bench.includes(a.id) ? ' on' : ''), role: 'checkbox', 'aria-checked': c.bench.includes(a.id), tabindex: 0,
          onclick: () => { c.manual = true; const i = c.bench.indexOf(a.id); if (i < 0) c.bench.push(a.id); else c.bench.splice(i, 1); keepScroll(draw); } }, '#' + a.number + ' ' + a.name))) : h('div', { class: 'sm-t mut' }, 'Sem outros atletas.'));
      }
      return h('div', { class: 'card' }, parts);
    }

    function draw() {
      box.innerHTML = '';
      const L = getLast();
      if (lastValid(L)) {
        const nm = t => (L.team[t] === ANON ? (L.anonName || 'Adversário') : D.find('teams', L.team[t]).name);
        box.appendChild(h('div', { class: 'banner row sp', style: { marginBottom: '12px' } }, h('div', {}, h('b', {}, 'Repetir a última configuração'), h('div', { class: 'sm-t mut' }, nm('home') + ' × ' + nm('away') + ' · ' + D.MODALITIES[L.modality])),
          h('button', { class: 'pri', onclick: () => { applyLast(L); keepScroll(draw); } }, 'Usar')));
      }
      const ts = d0.teams.filter(t => t.modality === S.modality), minTeams = mode === 'treino' ? 2 : 1;
      const modSel = h('select', { onchange: () => { S.modality = modSel.value; S.team.home = S.team.away = null; pickTeams(); keepScroll(draw); } }, Object.keys(D.MODALITIES).map(k => opt(k, D.MODALITIES[k], S.modality === k)));
      box.appendChild(h('div', { class: 'card' }, field('Modalidade', modSel)));
      if (ts.length < minTeams) {
        box.appendChild(h('div', { class: 'empty', style: { marginTop: '12px' } }, mode === 'treino' ? 'O treino precisa de 2 equipes de ' + D.MODALITIES[S.modality].toLowerCase() + ' (a sua e a do adversário). Há ' + ts.length + ' cadastrada(s).' : 'Cadastre pelo menos a sua equipe de ' + D.MODALITIES[S.modality].toLowerCase() + '. O adversário pode ficar sem cadastro.',
          h('div', { style: { marginTop: '10px' } }, h('button', { class: 'pri', onclick: () => RV.go('equipes') }, 'Ir para Minhas Equipes'))));
        return;
      }
      function teamPicker(t) {
        const isHome = t === 'home';
        const title = isHome ? 'Time A · sua equipe (embaixo)' : 'Time B · adversário (em cima)';
        const list = isHome ? ts : ts.filter(x => x.id !== S.team.home);
        const onSelect = id => {
          if (isHome) {
            S.team.home = id;
            if (S.team.away === S.team.home) S.team.away = (ts.find(x => x.id !== S.team.home) || {}).id || (mode === 'jogo' ? ANON : null);
            pickTeams();
          } else {
            S.team.away = id;
            autofill('away');
          }
          keepScroll(draw);
        };
        const useDropdown = list.length + (!isHome && mode === 'jogo' ? 1 : 0) > 4;
        if (useDropdown) {
          const opts = list.map(tm => opt(tm.id, tm.name + ' (' + D.teamAthletes(tm.id).length + ' atletas)', S.team[t] === tm.id));
          if (!isHome && mode === 'jogo') opts.push(opt(ANON, 'Sem cadastro (só o nome)', S.team.away === ANON));
          const sel = h('select', { onchange: () => onSelect(sel.value) }, opts);
          return h('div', { class: 'card' }, field(title, sel));
        }
        const pills = list.map(tm => {
          const active = S.team[t] === tm.id;
          const cnt = D.teamAthletes(tm.id).length;
          return h('button', {
            type: 'button',
            class: 'team-pick-btn' + (active ? ' on' : ''),
            'aria-pressed': active,
            onclick: () => onSelect(tm.id)
          },
            h('span', { class: 'dot', style: { background: tm.color } }),
            h('span', { class: 'team-pick-name' }, tm.name),
            h('span', { class: 'pill' }, cnt + ' atl.'));
        });
        if (!isHome && mode === 'jogo') {
          const active = S.team.away === ANON;
          pills.push(h('button', {
            type: 'button',
            class: 'team-pick-btn' + (active ? ' on' : ''),
            'aria-pressed': active,
            onclick: () => onSelect(ANON)
          },
            h('span', { class: 'dot', style: { background: '#ef4444' } }),
            h('span', { class: 'team-pick-name' }, 'Sem cadastro (só o nome)')));
        }
        return h('div', { class: 'card' },
          h('div', { class: 'field', style: { margin: 0 } },
            h('label', {}, title),
            h('div', { class: 'team-pick-list' }, pills)));
      }
      box.appendChild(h('div', { class: 'setup-teams-grid' }, teamPicker('home'), teamPicker('away')));
      box.appendChild(h('div', { class: 'setup-teams-grid' }, teamCard('home'), teamCard('away')));
      const nameOf = t => (isAnon(t) ? (S.anonName.trim() || 'Adversário') : D.find('teams', S.team[t]).name);
      const fs = h('select', { onchange: () => { S.first = fs.value; } }, opt('home', nameOf('home'), S.first === 'home'), opt('away', nameOf('away'), S.first === 'away'));
      const seas = h('select', { onchange: () => { S.season = seas.value; } }, D.D().seasons.map(s => opt(s.id, s.name, S.season === s.id)));
      const tgt = h('input', { type: 'number', min: 1, max: 99, value: S.target, oninput: () => { S.target = Number(tgt.value) || 25; } });
      box.appendChild(h('div', { class: 'card', style: { marginTop: '12px' } }, h('div', { class: 'grid g2' }, field('Quem saca primeiro', fs), field('Temporada', seas), mode === 'treino' ? field('Meta de pontos do treino (referência)', tgt) : null),
        h('p', { class: 'sm-t mut', style: { margin: '8px 0 0' } }, S.modality === 'areia'
          ? 'Areia: 2 atletas por dupla, sem substituições e sem rodízio. O saque alterna entre os dois a cada vez que a dupla recupera o saque. Sets de 21 (o 3º de 15), diferença de 2, melhor de 3.'
          : 'Quadra: P1 é o sacador. Quem ganha o rally sacando pontua e continua sacando, sem rodar; quem recebe e ganha pontua, assume o saque e gira um posto no sentido horário. Sets de 25 (o 5º de 15), diferença de 2, melhor de 5.')));
      const err = h('div', { class: 'err' }); box.appendChild(err);
      box.appendChild(h('button', { class: 'pri', style: { width: '100%', marginTop: '6px', minHeight: '48px' }, onclick: () => { const e = start(); if (e) { err.textContent = e; toast(e, true); } } }, mode === 'treino' ? 'Iniciar treino' : 'Iniciar jogo'));
    }

    function start() {
      const n = need(), cfg = { modality: S.modality, mode, target: S.target, firstServe: S.first, teams: {} };
      const snapshot = { teams: {}, players: {} };
      for (const t of ['home', 'away']) {
        const c = S.conf[t];
        if (isAnon(t)) {
          const ids = []; for (let i = 1; i <= n; i++) { ids.push('adv' + i); snapshot.players['adv' + i] = { name: 'Adv', number: '–', role: '', team: t, anon: true }; }
          cfg.teams[t] = { lineup: ids, bench: [], anon: true };
          snapshot.teams[t] = { id: null, name: S.anonName.trim() || 'Adversário', color: '#ef4444', anon: true };
          continue;
        }
        const team = D.find('teams', S.team[t]), lu = c.lineup;
        if (lu.length < n || lu.some(x => !x)) return team.name + ': escolha ' + n + ' atletas em quadra' + (n === 6 ? ' (P1 a P6)' : '') + '.';
        if (new Set(lu).size !== lu.length) return team.name + ': o mesmo atleta aparece duas vezes.';
        if (c.libero && lu.includes(c.libero)) return team.name + ': o líbero não pode estar também entre os 6.';
        const all = athletes(t), ids = lu.concat(c.bench, c.libero ? [c.libero] : []);
        cfg.teams[t] = { lineup: lu.slice(), bench: c.bench.slice(), system: n === 6 ? c.sys : null, rot: n === 6 ? c.rot : null };
        if (c.libero) { cfg.teams[t].libero = c.libero; cfg.teams[t].centrals = all.filter(a => a.role === 'Central').map(a => a.id); }
        snapshot.teams[t] = { id: team.id, name: team.name, color: team.color };
        ids.forEach(id => { const a = all.find(x => x.id === id); snapshot.players[id] = { name: a.name, number: a.number, role: a.role, team: t }; });
      }
      if (snapshot.teams.home.color === snapshot.teams.away.color) snapshot.teams.away.color = snapshot.teams.home.color === '#ef4444' ? '#f59e0b' : '#ef4444';
      try { localStorage.setItem(LAST, JSON.stringify({ modality: S.modality, team: S.team, anonName: S.anonName, roles: S.roles, first: S.first, conf: { home: { sys: S.conf.home.sys, rot: S.conf.home.rot, lineup: S.conf.home.lineup, bench: S.conf.home.bench, libero: S.conf.home.libero }, away: { sys: S.conf.away.sys, rot: S.conf.away.rot, lineup: S.conf.away.lineup, bench: S.conf.away.bench, libero: S.conf.away.libero } } })); } catch (e) { /* noop */ }
      const rec = D.createMatch({ mode, modality: S.modality, seasonId: S.season, cfg, snapshot });
      RV.go('live/' + rec.id);
      return null;
    }
    draw();
  };

  /* ============ AO VIVO ============ */
  const STAT_COLS = [['pts', 'Pts'], ['aces', 'Ace'], ['serveOk', 'Saq+'], ['serveErr', 'Saq×'], ['atkOk', 'Atq+'], ['atkErr', 'Atq×'], ['blocks', 'Blq'], ['recOk', 'Rec+'], ['recErr', 'Rec×'], ['digs', 'Def'], ['assists', 'Ast']];
  const GROUPS = [['Saque', ['ace', 'serve_ok', 'serve_err']], ['Recepção', ['rec_ok', 'rec_err']], ['Ataque', ['atk_ok', 'atk_err']], ['Outras', ['block', 'dig', 'assist', 'point']]];

  RV.Screens.live = function (root, p) {
    const rec = D.find('matches', p.id);
    if (!rec) return root.appendChild(h('div', { class: 'empty' }, 'Partida não encontrada.'));
    if (rec.finished) return RV.go('resumo/' + rec.id);
    const snap = rec.snapshot, cfg = rec.cfg, isBeach = cfg.modality === 'areia', isTrain = rec.mode === 'treino';
    document.querySelector('.top h1').textContent = (isTrain ? 'Treino' : 'Jogo') + ' · ' + (isBeach ? 'Areia' : 'Quadra');
    let sel = null, R; // R = {st, trace}

    const sb = h('div', { class: 'card sb' }), courtBox = h('div', {}), side = h('div', { class: 'side' });
    const sheet = h('div', { class: 'sheet' }), ctrl = h('div', { class: 'row', style: { margin: '10px 0' } });
    const banner = h('div', {}), hist = h('div', { class: 'card' }), stats = h('div', {});
    root.appendChild(h('div', { class: 'live' }, h('div', { class: 'lcol' }, sb, banner, courtBox, ctrl),
      h('div', { class: 'rcol' }, sheet, hist, stats)));
    if (!document.getElementById('live-css')) {
      const st = h('style', { id: 'live-css' }, `
.live{display:grid;gap:14px;min-width:0}.lcol{min-width:0}.rcol{min-width:0}
@media(min-width:1100px){.live{grid-template-columns:minmax(0,1.25fr) minmax(360px,.85fr);align-items:start}.rcol{position:sticky;top:64px;align-self:start;max-height:calc(100vh - 80px);overflow:auto}}
@media(min-width:1500px){.live{gap:20px}.sb{padding:18px}.sb .big{font-size:58px}.sb .tn{font-size:18px}}
@media(min-width:700px) and (max-width:1099px){.live{grid-template-columns:minmax(0,1fr)}.rcol{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.rcol .sheet,.rcol .card{min-width:0}.sb .big{font-size:46px}}
.sb{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;text-align:center;margin-bottom:10px}
.sb .tn{font-weight:800;font-size:15px;overflow:hidden;text-overflow:ellipsis}
.sb .big{font-size:46px;font-weight:900;line-height:1}
.sb .rotl{font-size:12px;color:var(--mut);min-height:16px}
.pt-badge{font-size:11px;font-weight:800;color:#111;background:var(--gold);border-radius:99px;padding:2px 8px;margin:4px auto 0;width:max-content;animation:pulse 1.2s infinite}
@keyframes pulse{50%{opacity:.55}}
@media(max-width:899px){.sb{position:sticky;top:56px;z-index:6;padding:8px;box-shadow:0 6px 14px #000b}.sb .big{font-size:36px}.sb .tn{font-size:13px}}
.sb .mid{font-size:12px;color:var(--mut)}
.sb .srv{font-size:12px;color:var(--gold);font-weight:700;min-height:18px}
.sb .side-a.serving{outline:2px solid var(--gold);border-radius:12px}
.sb .side-a{padding:6px 4px}
.sheet{margin-bottom:12px}
.act{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px}
.act button{min-height:44px}
.evrow{display:flex;gap:8px;font-size:13px;padding:5px 0;border-bottom:1px solid var(--line)}
.evrow .sc{color:var(--mut);min-width:64px;font-variant-numeric:tabular-nums}
.evlist{max-height:240px;overflow:auto}
@media(max-width:699px){.sheet.open{position:fixed;left:0;right:0;bottom:0;z-index:20;margin:0;padding:10px 12px 14px;background:var(--panel);border-top:2px solid var(--blue);max-height:55vh;overflow:auto;box-shadow:0 -8px 30px #000a}.live.sheetopen{padding-bottom:42vh}}
`); document.head.appendChild(st);
    }

    function compute() { R = E.replayTrace(cfg, rec.events); }
    const nameOf = id => (snap.players[id] ? snap.players[id].name : '?');
    const posOf = (st, team, id) => E.courtLineup(st, team).indexOf(id);

    // manter o atleta selecionado depois de registrar? padrão: sim no treino, não no jogo
    const KEEP = 'rv2:keep:' + rec.mode;
    const keepSel = () => { try { const v = localStorage.getItem(KEEP); return v == null ? isTrain : v === '1'; } catch (e) { return isTrain; } };
    const setKeep = v => { try { localStorage.setItem(KEEP, v ? '1' : '0'); } catch (e) { /* noop */ } };
    function persist() { D.saveMatch(); }
    function add(ev) {
      const e = Object.assign({ id: D.uid('e'), ts: Date.now(), source: 'manual', videoTime: null, confidence: null }, ev);
      const test = E.replay(cfg, rec.events.concat([e]));
      if (test.errors.length) { toast(test.errors[test.errors.length - 1], true); return false; }
      rec.events.push(e); persist(); compute();
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (err) { /* noop */ }
      if (R.st.cur.switchAlert && !isTrain) toast('Troca de lado! (placar ' + R.st.cur.score.home + '–' + R.st.cur.score.away + ')');
      return true;
    }
    function undo() { if (!rec.events.length) return; rec.events.pop(); persist(); compute(); refresh(); toast('Último registro desfeito.'); }

    const court = RV.Court.create(courtBox, cfg.modality, { onSelect: (team, id) => {
      if (snap.players[id] && snap.players[id].anon) return toast('Adversário sem cadastro: registre os pontos dele com "+1".', true);
      if (R.st.phase === 'setEnd' || R.st.phase === 'over') return toast('O set terminou. Use "Próximo set" ou finalize.', true);
      sel = { team, id }; court.select(id); drawSheet(); } });

    function desc(ev) {
      if (ev.type === 'nextSet') return 'Início do set';
      if (ev.type === 'sub') return 'Substituição: sai ' + nameOf(ev.out) + ', entra ' + nameOf(ev.in) + ' (' + snap.teams[ev.team].name + ')';
      const a = E.ACTIONS[ev.action];
      return a.label + ' — ' + (ev.athleteId ? '#' + snap.players[ev.athleteId].number + ' ' + nameOf(ev.athleteId) : snap.teams[ev.team].name);
    }

    function drawScore() {
      const st = R.st, s = st.cur, srv = E.serverId(st, s.serving), np = isTrain ? {} : E.nextPointInfo(st);
      const rotText = t => { const r = E.currentRot(st, t), sy = cfg.teams[t].system; return r ? (sy ? sy + ' · ' : '') + 'R' + r : ''; };
      const side = (team) => h('div', { class: 'side-a' + (s.serving === team ? ' serving' : '') },
        h('div', { class: 'tn', style: { color: snap.teams[team].color } }, snap.teams[team].name),
        h('div', { class: 'rotl' }, rotText(team)),
        h('div', { class: 'big' }, s.score[team]),
        np[team] ? h('div', { class: 'pt-badge' }, np[team] === 'match' ? 'PONTO DE JOGO' : 'PONTO DE SET') : null, h('div', { class: 'srv' }, s.serving === team ? '🏐 saca' + (srv ? ': ' + nameOf(srv) : '') : ''));
      sb.innerHTML = '';
      sb.appendChild(side('home'));
      sb.appendChild(h('div', {}, h('div', { class: 'mid' }, isTrain ? 'Treino' : 'Set ' + s.no), isTrain ? h('div', { class: 'mid' }, 'Meta ' + (cfg.target || 25)) : h('div', { class: 'big', style: { fontSize: '22px' } }, st.sets.home + ' – ' + st.sets.away), isTrain ? null : h('div', { class: 'mid' }, 'sets')));
      sb.appendChild(side('away'));
    }

    function drawBanner() {
      const st = R.st; banner.innerHTML = '';
      if (st.phase === 'setEnd') {
        const last = st.done[st.done.length - 1];
        banner.appendChild(h('div', { class: 'banner row sp' }, h('div', {}, h('b', {}, 'Set ' + last.no + ' encerrado: ' + last.home + '–' + last.away), h('div', { class: 'sm-t mut' }, 'Vencedor: ' + snap.teams[last.winner].name)),
          h('button', { class: 'pri', onclick: () => { add({ type: 'nextSet' }); sel = null; court.select(null); refresh(); } }, 'Próximo set')));
      } else if (st.phase === 'over') {
        banner.appendChild(h('div', { class: 'banner row sp' }, h('div', {}, h('b', {}, 'Fim de jogo! ' + snap.teams[st.winner].name + ' venceu por ' + st.sets[st.winner] + ' a ' + st.sets[otherT(st.winner)])),
          h('button', { class: 'pri', onclick: () => finish() }, 'Finalizar e salvar')));
      }
    }

    function drawSheet() {
      sheet.innerHTML = ''; const lv = root.querySelector('.live');
      if (!sel || R.st.phase === 'setEnd' || R.st.phase === 'over') { sheet.className = 'sheet'; lv.classList.remove('sheetopen'); return; }
      const st = R.st, pl = snap.players[sel.id];
      if (posOf(st, sel.team, sel.id) < 0) { sel = null; court.select(null); sheet.className = 'sheet'; lv.classList.remove('sheetopen'); return; }
      sheet.className = 'sheet open card'; lv.classList.add('sheetopen');
      const idx = posOf(st, sel.team, sel.id), srvId = E.serverId(st, sel.team);
      sheet.appendChild(h('div', { class: 'row sp' }, h('div', {}, h('b', { style: { color: snap.teams[sel.team].color } }, '#' + pl.number + ' ' + pl.name), h('div', { class: 'sm-t mut' }, pl.role + (isBeach ? '' : ' · P' + (idx + 1)) + (sel.id === srvId && st.cur.serving === sel.team ? ' · sacando' : ''))),
        h('button', { class: 'sm', 'aria-label': 'Fechar', onclick: () => { sel = null; court.select(null); drawSheet(); } }, 'Fechar')));
      sheet.appendChild(h('label', { class: 'sm-t mut', style: { display: 'flex', gap: '6px', alignItems: 'center', margin: '6px 0 0' } },
        h('input', { type: 'checkbox', style: { width: 'auto', minHeight: 0 }, checked: keepSel(), onchange: e => setKeep(e.target.checked) }), 'Manter o atleta selecionado após registrar'));
      GROUPS.forEach(([title, keys]) => {
        sheet.appendChild(h('div', { class: 'lbl mut sm-t', style: { margin: '8px 0 4px' } }, title));
        sheet.appendChild(h('div', { class: 'act' }, keys.map(k => {
          const a = E.ACTIONS[k], err = E.validate(st, { type: 'action', team: sel.team, athleteId: sel.id, action: k });
          return h('button', { disabled: !!err, title: err || '', class: a.pts === 'opp' ? 'dng' : '', onclick: () => { if (add({ type: 'action', team: sel.team, athleteId: sel.id, action: k })) { toast(a.label + ' — ' + pl.name); if (!keepSel()) { sel = null; court.select(null); } refresh(); } } }, a.short);
        })));
      });
      sheet.appendChild(h('p', { class: 'sm-t mut hint-t', style: { margin: '8px 0 0' } }, 'Ações que dão ponto (ace, ataque +, bloqueio, ponto) marcam para a equipe do atleta. Erros (saque, ataque, recepção) dão o ponto ao adversário. Botões apagados não valem agora: saque só do sacador, recepção só de quem recebe.'));
    }

    function drawCtrl() {
      ctrl.innerHTML = '';
      const st = R.st, active = st.phase === 'playing' || st.phase === 'treino';
      ['home', 'away'].forEach(t => ctrl.appendChild(h('button', { disabled: !active, onclick: () => { if (add({ type: 'action', team: t, action: 'point' })) refresh(); } }, '+1 ' + snap.teams[t].name)));
      ctrl.appendChild(h('button', { disabled: !rec.events.length, onclick: undo }, '↶ Desfazer'));
      if (!isBeach) ctrl.appendChild(h('button', { disabled: !active, onclick: subDialog }, '⇄ Substituição'));
      ctrl.appendChild(h('button', { class: 'pri', onclick: () => {
        const msg = isTrain ? 'Finalizar o treino e salvar os registros?' : (st.phase === 'over' ? 'Finalizar e salvar a partida?' : 'A partida ainda não terminou. Encerrar agora e salvar como está?');
        confirmBox(msg, 'Finalizar', () => finish());
      } }, isTrain ? 'Finalizar treino' : 'Encerrar jogo'));
      ctrl.appendChild(h('button', { class: 'dng', onclick: () => confirmBox('Descartar tudo que foi registrado nesta partida?', 'Descartar', () => { D.remove('matches', rec.id); toast('Partida descartada.'); RV.go(''); }) }, 'Descartar'));
    }

    function subDialog() {
      const st = R.st, subsInfo = t => isTrain ? 'sem limite no treino' : (st.cur.teams[t].subs + ' de ' + E.MAX_SUBS + ' usadas neste set');
      let team = 'home';
      const body = h('div', {});
      function drawBody() {
        body.innerHTML = '';
        const ts = h('select', { onchange: () => { team = ts.value; drawBody(); } }, ['home', 'away'].map(t => opt(t, snap.teams[t].name, team === t)));
        const L = st.cur.teams[team].lineup, B = st.cur.teams[team].bench;
        const out = h('select', {}, L.map((id, i) => opt(id, 'P' + (i + 1) + ' · #' + snap.players[id].number + ' · ' + snap.players[id].name + ' (' + abb(snap.players[id].role) + ')')));
        const inn = h('select', {}, B.map(id => opt(id, '#' + snap.players[id].number + ' · ' + snap.players[id].name + ' (' + abb(snap.players[id].role) + ')')));
        body.appendChild(field('Equipe', ts)); body.appendChild(h('div', { class: 'sm-t mut' }, 'Substituições: ' + subsInfo(team) + '. O reserva assume a posição de quem sai.'));
        if (!B.length) body.appendChild(h('div', { class: 'err' }, 'Esta equipe não tem reservas no banco.'));
        else { body.appendChild(field('Sai', out)); body.appendChild(field('Entra', inn)); }
        body._get = () => ({ team, out: out.value, in: inn.value, none: !B.length });
      }
      drawBody();
      modal('Substituição', body, [{ label: 'Cancelar' }, { label: 'Confirmar', cls: 'pri', fn: () => {
        const g = body._get(); if (g.none) return false;
        if (!add({ type: 'sub', team: g.team, out: g.out, in: g.in })) return false;
        toast('Substituição feita.'); refresh();
      } }]);
    }

    function finish() {
      const st = R.st; rec.finished = true; rec.finishedAt = Date.now();
      rec.result = { sets: st.sets, done: st.done, score: st.cur.score, winner: st.winner, complete: st.phase === 'over' };
      persist(); toast('Salvo.'); RV.go('resumo/' + rec.id);
    }

    function drawHist() {
      hist.innerHTML = ''; hist.appendChild(h('h3', {}, 'Histórico de eventos (' + rec.events.length + ')'));
      if (!rec.events.length) return hist.appendChild(h('div', { class: 'sm-t mut' }, 'Nada registrado ainda. Toque num atleta na quadra para registrar uma ação.'));
      const list = h('div', { class: 'evlist' });
      for (let i = rec.events.length - 1; i >= 0; i--) { const t = R.trace[i];
        list.appendChild(h('div', { class: 'evrow' }, h('span', { class: 'sc' }, (isTrain ? '' : 'S' + t.set + ' ') + t.home + '–' + t.away), h('span', {}, desc(rec.events[i])))); }
      hist.appendChild(list);
    }

    function drawStats() {
      const wasOpen = stats.querySelector('details') && stats.querySelector('details').open;
      stats.innerHTML = '';
      const body = h('div', { class: 'scroll' });
      ['home', 'away'].forEach(t => {
        if (cfg.teams[t].anon) return;
        const ids = E.allIds(cfg, t);
        const rows = ids.map(id => { const s = R.st.stats[id]; return h('tr', {}, h('td', {}, '#' + snap.players[id].number + ' ' + snap.players[id].name), STAT_COLS.map(([k]) => h('td', {}, k === 'pts' ? E.totalPoints(s) : s[k]))); });
        body.appendChild(h('div', { class: 'lbl mut sm-t', style: { margin: '10px 0 4px', color: snap.teams[t].color } }, snap.teams[t].name));
        body.appendChild(h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, 'Atleta'), STAT_COLS.map(([, l]) => h('th', {}, l)))), h('tbody', {}, rows)));
      });
      stats.appendChild(h('details', { class: 'card', style: { marginTop: '12px' }, open: !!wasOpen }, h('summary', {}, 'Estatísticas por atleta'), body));
    }

    function refresh() { compute(); drawScore(); drawBanner(); court.update(R.st, snap); drawSheet(); drawCtrl(); drawHist(); drawStats(); }
    refresh();
    // mantém a tela acesa durante a partida (quando o navegador permite)
    let wake = null;
    const lock = () => { try { if (navigator.wakeLock && document.visibilityState === 'visible') navigator.wakeLock.request('screen').then(w => { wake = w; }).catch(() => {}); } catch (e) { /* noop */ } };
    document.addEventListener('visibilitychange', lock); lock();
    RV.onLeave(() => { document.removeEventListener('visibilitychange', lock); if (wake) { try { wake.release(); } catch (e) { /* noop */ } } const s = document.getElementById('live-css'); if (s) s.remove(); });
    RV.liveDebug = { get state() { return R; }, rec };
  };
})();
