/* stats.js — resumo da partida, histórico, estatísticas por atleta/equipe, comparação entre períodos e temporadas.
 * Tudo é derivado dos eventos salvos (replay). Nada é inventado: sem registros, mostra vazio.
 * "Ataque positivo" = ataque que resultou em ponto. Pontos do atleta = ace + ataque + bloqueio + ponto avulso.
 */
(function () {
  'use strict';
  const RV = window.RV, { h, toast, modal, confirmBox, field, opt, fmtDate } = RV.UI, D = RV.Data, E = RV.Engine;
  const COLS = [['pts', 'Pts'], ['aces', 'Ace'], ['serveOk', 'Saq+'], ['serveErr', 'Saq×'], ['atkOk', 'Atq+'], ['atkErr', 'Atq×'], ['blocks', 'Blq'], ['recOk', 'Rec+'], ['recErr', 'Rec×'], ['digs', 'Def'], ['assists', 'Ast']];
  const METRICS = COLS.map(([k, l]) => [k, l]);
  const val = (s, k) => (k === 'pts' ? E.totalPoints(s) : s[k]);

  const cache = {};
  function replayOf(m) { // memoiza por id + nº de eventos
    const key = m.id + ':' + m.events.length;
    if (!cache[key]) cache[key] = E.replayTrace(m.cfg, m.events);
    return cache[key];
  }
  const finished = () => D.D().matches.filter(m => m.finished);

  // soma por atleta. filtro: {seasonId, mode, modality, from, to, teamId}
  function pass(m, f) {
    f = f || {};
    return (!f.seasonId || m.seasonId === f.seasonId) && (!f.mode || m.mode === f.mode) && (!f.modality || m.modality === f.modality)
      && (!f.from || m.date >= f.from) && (!f.to || m.date <= f.to);
  }
  function aggregate(f) {
    const ath = {}, teams = {};
    finished().filter(m => pass(m, f)).forEach(m => {
      const st = replayOf(m).st;
      ['home', 'away'].forEach(t => {
        const info = m.snapshot.teams[t], tid = info.id;
        const T = teams[tid] || (teams[tid] = { id: tid, name: info.name, color: info.color, games: 0, wins: 0, losses: 0, setsW: 0, setsL: 0, stats: E.emptyStats() });
        T.name = info.name; T.games++;
        if (m.mode === 'jogo' && m.result && m.result.complete) { if (m.result.winner === t) T.wins++; else T.losses++; }
        if (m.mode === 'jogo') { T.setsW += st.sets[t]; T.setsL += st.sets[E.other(t)]; }
        m.cfg.teams[t].lineup.concat(m.cfg.teams[t].bench).forEach(id => {
          const s = st.stats[id]; if (!s) return;
          const p = m.snapshot.players[id];
          const A = ath[id] || (ath[id] = { id, name: p.name, number: p.number, role: p.role, teamId: tid, teamName: info.name, games: 0, stats: E.emptyStats() });
          A.games++; A.name = p.name; A.number = p.number; A.teamName = info.name;
          E.STAT_KEYS.forEach(k => { A.stats[k] += s[k]; T.stats[k] += s[k]; });
        });
      });
    });
    return { ath, teams };
  }
  function athleteTotals(id, f) {
    const a = aggregate(f).ath[id]; if (!a) return null;
    return { games: a.games, points: E.totalPoints(a.stats), stats: a.stats };
  }

  const th = () => COLS.map(([, l]) => h('th', {}, l));
  const statCells = s => COLS.map(([k]) => h('td', {}, val(s, k)));
  const resultText = m => {
    if (!m.result) return '';
    if (m.mode === 'treino') return 'Treino ' + m.result.score.home + '–' + m.result.score.away;
    if (!m.result.done.length) return 'Encerrado no set ' + (replayOf(m).st.cur.no) + ' (' + m.result.score.home + '–' + m.result.score.away + ')';
    return m.result.sets.home + '–' + m.result.sets.away + ' em sets (' + m.result.done.map(d => d.home + '-' + d.away).join(', ') + ')' + (m.result.complete ? '' : ' · encerrado antes do fim');
  };
  const title = m => m.snapshot.teams.home.name + ' × ' + m.snapshot.teams.away.name;

  /* ============ RESUMO ============ */
  RV.Screens.summary = function (root, p) {
    const m = D.find('matches', p.id);
    if (!m) return root.appendChild(h('div', { class: 'empty' }, 'Registro não encontrado.'));
    if (!m.finished) return RV.go('live/' + m.id);
    const { st, trace } = replayOf(m), snap = m.snapshot, seas = D.find('seasons', m.seasonId);
    document.querySelector('.top h1').textContent = (m.mode === 'treino' ? 'Treino' : 'Jogo') + ' · ' + fmtDate(m.date);
    root.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row' }, h('span', { class: 'pill' }, m.mode === 'treino' ? 'Treino' : 'Jogo'), h('span', { class: 'pill' }, D.MODALITIES[m.modality]), h('span', { class: 'pill' }, seas ? seas.name : 'sem temporada')),
      h('h2', {}, h('span', { style: { color: snap.teams.home.color } }, snap.teams.home.name), ' × ', h('span', { style: { color: snap.teams.away.color } }, snap.teams.away.name)),
      h('div', {}, resultText(m)),
      m.mode === 'jogo' && m.result.complete ? h('div', { class: 'mut' }, 'Vencedor: ' + snap.teams[m.result.winner].name) : null,
      h('div', { class: 'row', style: { marginTop: '10px' } },
        h('button', { class: 'sm', onclick: () => moveDialog(m) }, 'Mudar temporada'),
        h('button', { class: 'sm dng', onclick: () => confirmBox('Excluir este registro e suas estatísticas?', 'Excluir', () => { D.remove('matches', m.id); toast('Registro excluído.'); RV.go('estatisticas'); }) }, 'Excluir registro'))));
    ['home', 'away'].forEach(t => {
      const ids = m.cfg.teams[t].lineup.concat(m.cfg.teams[t].bench), tot = E.derive(st)[t];
      root.appendChild(h('div', { class: 'card', style: { marginTop: '12px' } }, h('h3', { style: { color: snap.teams[t].color } }, snap.teams[t].name),
        h('div', { class: 'scroll' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, 'Atleta'), th())),
          h('tbody', {}, ids.map(id => h('tr', {}, h('td', {}, '#' + snap.players[id].number + ' ' + snap.players[id].name), statCells(st.stats[id]))),
            h('tr', { style: { fontWeight: 800 } }, h('td', {}, 'Equipe'), statCells(tot)))))));
    });
    const hist = h('div', { class: 'evlist', style: { maxHeight: 'none' } });
    m.events.forEach((ev, i) => {
      const tr = trace[i]; let d;
      if (ev.type === 'nextSet') d = 'Início do set';
      else if (ev.type === 'sub') d = 'Substituição: sai ' + snap.players[ev.out].name + ', entra ' + snap.players[ev.in].name;
      else d = E.ACTIONS[ev.action].label + ' — ' + (ev.athleteId ? snap.players[ev.athleteId].name : snap.teams[ev.team].name);
      hist.appendChild(h('div', { class: 'evrow' }, h('span', { class: 'sc' }, (m.mode === 'treino' ? '' : 'S' + tr.set + ' ') + tr.home + '–' + tr.away), h('span', {}, d)));
    });
    root.appendChild(h('details', { class: 'card', style: { marginTop: '12px' } }, h('summary', {}, 'Histórico de eventos (' + m.events.length + ')'), hist));
  };

  function moveDialog(m) {
    const sel = h('select', {}, D.D().seasons.map(s => opt(s.id, s.name, s.id === m.seasonId)));
    modal('Mudar temporada', field('Temporada', sel), [{ label: 'Cancelar' }, { label: 'Salvar', cls: 'pri', fn: () => { m.seasonId = sel.value; D.save(); RV.render(); } }]);
  }

  /* ============ ESTATÍSTICAS ============ */
  RV.Screens.stats = function (root) {
    const S = { tab: 'hist', season: '', mode: '', modality: '', pa: 'all', pb: 'last30', metric: 'pts' };
    const body = h('div', {});
    const tabs = h('div', { class: 'tabs' });
    root.appendChild(tabs); root.appendChild(body);

    const flt = () => ({ seasonId: S.season || null, mode: S.mode || null, modality: S.modality || null });
    function filters(withSeason) {
      const mk = (key, label, opts) => { const s = h('select', { 'aria-label': label, onchange: () => { S[key] = s.value; draw(); } }, opts.map(([v, t]) => opt(v, t, S[key] === v))); return h('div', { style: { flex: 1, minWidth: '130px' } }, s); };
      return h('div', { class: 'row', style: { marginBottom: '12px' } },
        withSeason ? mk('season', 'Temporada', [['', 'Todas as temporadas']].concat(D.D().seasons.map(s => [s.id, s.name]))) : null,
        mk('mode', 'Tipo', [['', 'Jogos e treinos'], ['jogo', 'Só jogos'], ['treino', 'Só treinos']]),
        mk('modality', 'Modalidade', [['', 'Quadra e areia'], ['quadra', 'Só quadra'], ['areia', 'Só areia']]));
    }
    const empty = msg => h('div', { class: 'empty' }, msg || 'Nenhum registro finalizado ainda. Finalize um treino ou jogo para ver estatísticas aqui.');

    function tabHist() {
      body.appendChild(filters(true));
      const list = finished().filter(m => pass(m, flt())).sort((a, b) => b.date - a.date);
      if (!list.length) return body.appendChild(empty());
      body.appendChild(h('div', { class: 'card list' }, list.map(m => {
        const se = D.find('seasons', m.seasonId);
        return h('a', { class: 'li', href: '#/resumo/' + m.id, style: { color: 'inherit', textDecoration: 'none' } },
          h('div', { class: 'grow' }, h('b', {}, title(m)), h('div', { class: 'sm-t mut' }, fmtDate(m.date) + ' · ' + (m.mode === 'treino' ? 'Treino' : 'Jogo') + ' · ' + D.MODALITIES[m.modality] + ' · ' + (se ? se.name : '')), h('div', { class: 'sm-t' }, resultText(m))), h('span', { class: 'mut' }, '›'));
      })));
    }
    function tabAth() {
      body.appendChild(filters(true));
      const { ath } = aggregate(flt()), rows = Object.values(ath).sort((a, b) => E.totalPoints(b.stats) - E.totalPoints(a.stats));
      if (!rows.length) return body.appendChild(empty());
      body.appendChild(h('div', { class: 'card scroll' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, 'Atleta'), h('th', {}, 'Reg.'), th())),
        h('tbody', {}, rows.map(a => h('tr', {}, h('td', {}, '#' + a.number + ' ' + a.name, h('div', { class: 'sm-t mut' }, a.role + ' · ' + a.teamName)), h('td', {}, a.games), statCells(a.stats)))))));
      body.appendChild(h('p', { class: 'sm-t mut' }, 'Reg. = jogos/treinos em que o atleta esteve no elenco da partida. Ataque + = ataque que virou ponto.'));
    }
    function tabTeams() {
      body.appendChild(filters(true));
      const { teams } = aggregate(flt()), rows = Object.values(teams);
      if (!rows.length) return body.appendChild(empty());
      body.appendChild(h('div', { class: 'card scroll' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, 'Equipe'), h('th', {}, 'Reg.'), h('th', {}, 'V'), h('th', {}, 'D'), h('th', {}, 'Sets'), th())),
        h('tbody', {}, rows.map(t => h('tr', {}, h('td', {}, h('span', { class: 'dot', style: { background: t.color } }), t.name), h('td', {}, t.games), h('td', {}, t.wins), h('td', {}, t.losses), h('td', {}, t.setsW + '–' + t.setsL), statCells(t.stats)))))));
      body.appendChild(h('p', { class: 'sm-t mut' }, 'V/D contam só jogos completos. Treinos entram nas ações, não em vitórias.'));
    }

    const DAY = 864e5, now = Date.now();
    function period(key) {
      if (key === 'all') return { label: 'Tudo' };
      if (key === 'last30') return { from: now - 30 * DAY, to: now, label: 'Últimos 30 dias' };
      if (key === 'prev30') return { from: now - 60 * DAY, to: now - 30 * DAY, label: '30 dias anteriores' };
      const s = D.find('seasons', key); return { seasonId: key, label: s ? s.name : '?' };
    }
    function tabCmp() {
      body.appendChild(filters(false));
      const pOpts = [['all', 'Tudo'], ['last30', 'Últimos 30 dias'], ['prev30', '30 dias anteriores']].concat(D.D().seasons.map(s => [s.id, s.name]));
      const mk = (key, lbl) => { const s = h('select', { 'aria-label': lbl, onchange: () => { S[key] = s.value; draw(); } }, pOpts.map(([v, t]) => opt(v, t, S[key] === v))); return field(lbl, s); };
      const met = h('select', { 'aria-label': 'Métrica', onchange: () => { S.metric = met.value; draw(); } }, METRICS.map(([k, l]) => opt(k, l, S.metric === k)));
      body.appendChild(h('div', { class: 'card' }, h('div', { class: 'grid g3' }, mk('pa', 'Período A'), mk('pb', 'Período B'), field('Métrica', met))));
      const A = aggregate(Object.assign({}, flt(), period(S.pa))), B = aggregate(Object.assign({}, flt(), period(S.pb)));
      const ids = Array.from(new Set(Object.keys(A.ath).concat(Object.keys(B.ath))));
      if (!ids.length) return body.appendChild(h('div', { style: { marginTop: '12px' } }, empty('Sem registros nesses períodos.')));
      const g = (X, id) => (X.ath[id] ? val(X.ath[id].stats, S.metric) : 0);
      const rows = ids.map(id => ({ id, n: (A.ath[id] || B.ath[id]), a: g(A, id), b: g(B, id) })).sort((x, y) => (y.a + y.b) - (x.a + x.b));
      const dcell = d => h('td', { style: { color: d > 0 ? 'var(--green)' : d < 0 ? 'var(--red)' : 'var(--mut)', fontWeight: 700 } }, (d > 0 ? '+' : '') + d);
      const label = METRICS.find(x => x[0] === S.metric)[1];
      body.appendChild(h('div', { class: 'card scroll', style: { marginTop: '12px' } }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Atleta · ' + label), h('th', {}, 'A'), h('th', {}, 'B'), h('th', {}, 'B − A'))),
        h('tbody', {}, rows.map(r => h('tr', {}, h('td', {}, '#' + r.n.number + ' ' + r.n.name), h('td', {}, r.a), h('td', {}, r.b), dcell(r.b - r.a)))))));
      body.appendChild(h('p', { class: 'sm-t mut' }, 'Total bruto no período. Períodos com quantidades diferentes de jogos não são normalizados.'));
    }
    function tabSeasons() {
      const d = D.D();
      body.appendChild(h('div', { class: 'row sp', style: { marginBottom: '12px' } }, h('span', { class: 'mut' }, 'Os registros ficam ligados à temporada ativa na hora de criar.'),
        h('button', { class: 'pri', onclick: () => seasonForm(null) }, '+ Nova temporada')));
      body.appendChild(h('div', { class: 'card list' }, d.seasons.map(s => {
        const n = d.matches.filter(m => m.seasonId === s.id && m.finished).length, active = d.settings.activeSeason === s.id;
        return h('div', { class: 'li' }, h('div', { class: 'grow' }, h('b', {}, s.name), active ? h('span', { class: 'pill', style: { marginLeft: '8px' } }, 'ativa') : null, h('div', { class: 'sm-t mut' }, n + ' registro(s) · criada em ' + fmtDate(s.createdAt))),
          active ? null : h('button', { class: 'sm', onclick: () => { D.setActiveSeason(s.id); toast('Temporada ativa: ' + s.name); draw(); } }, 'Ativar'),
          h('button', { class: 'sm', onclick: () => seasonForm(s) }, 'Renomear'),
          h('button', { class: 'sm dng', onclick: () => { const e = D.deleteSeason(s.id); if (e) toast(e, true); else { toast('Temporada excluída.'); draw(); } } }, 'Excluir'));
      })));
    }
    function seasonForm(s) {
      const name = h('input', { value: s ? s.name : '', maxlength: 40, placeholder: 'Ex.: Temporada 2027' }), err = h('div', { class: 'err' });
      modal(s ? 'Renomear temporada' : 'Nova temporada', h('div', {}, field('Nome', name), err), [{ label: 'Cancelar' }, { label: 'Salvar', cls: 'pri', fn: () => {
        const rec = s ? Object.assign({}, s, { name: name.value }) : { name: name.value }, e = D.saveSeason(rec);
        if (e) { err.textContent = e; return false; }
        if (!s) D.setActiveSeason(rec.id);
        toast('Temporada salva.'); draw();
      } }]);
    }

    const TABS = [['hist', 'Histórico', tabHist], ['ath', 'Atletas', tabAth], ['teams', 'Equipes', tabTeams], ['cmp', 'Comparar', tabCmp], ['seas', 'Temporadas', tabSeasons]];
    function draw() {
      tabs.innerHTML = ''; body.innerHTML = '';
      TABS.forEach(([k, l]) => tabs.appendChild(h('button', { class: S.tab === k ? 'on' : '', onclick: () => { S.tab = k; draw(); } }, l)));
      TABS.find(t => t[0] === S.tab)[2]();
    }
    draw();
  };

  RV.Stats = { aggregate, athleteTotals };
})();
