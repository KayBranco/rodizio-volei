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
    const mode = p.mode, d0 = D.D();
    const live = D.liveMatch();
    if (live) {
      root.appendChild(h('div', { class: 'banner' }, h('b', {}, 'Já existe um ' + (live.mode === 'treino' ? 'treino' : 'jogo') + ' em andamento'),
        h('div', { class: 'sm-t mut', style: { margin: '4px 0 10px' } }, live.snapshot.teams.home.name + ' × ' + live.snapshot.teams.away.name + '. Termine ou descarte antes de começar outro.'),
        h('div', { class: 'row' }, h('button', { class: 'pri', onclick: () => RV.go('live/' + live.id) }, 'Continuar'),
          h('button', { class: 'dng', onclick: () => confirmBox('Descartar a partida em andamento? Os registros dela serão perdidos.', 'Descartar', () => { D.remove('matches', live.id); toast('Partida descartada.'); RV.render(); }) }, 'Descartar'))));
      return;
    }
    const S = { modality: 'quadra', home: null, away: null, lineup: { home: [], away: [] }, bench: { home: [], away: [] }, first: 'home', target: 25, season: D.activeSeason().id };
    const box = h('div', {}); root.appendChild(box);

    function autofill(team) {
      const t = S[team]; S.lineup[team] = []; S.bench[team] = [];
      if (!t) return;
      const need = D.SIZE[S.modality], all = D.teamAthletes(t);
      const tit = all.filter(a => a.status === 'titular'), res = all.filter(a => a.status !== 'titular');
      for (let i = 0; i < need; i++) S.lineup[team][i] = (tit[i] || '') && tit[i].id;
      const used = S.lineup[team];
      S.bench[team] = S.modality === 'areia' ? [] : all.filter(a => !used.includes(a.id) && a.status !== 'titular').map(a => a.id);
      void res;
    }
    function pickTeams() {
      const ts = d0.teams.filter(t => t.modality === S.modality);
      if (!ts.find(t => t.id === S.home)) S.home = ts[0] ? ts[0].id : null;
      if (!ts.find(t => t.id === S.away) || S.away === S.home) S.away = (ts.find(t => t.id !== S.home) || {}).id || null;
      autofill('home'); autofill('away');
    }
    pickTeams();

    function lineupEditor(team) {
      const t = D.find('teams', S[team]); if (!t) return null;
      const all = D.teamAthletes(t.id), need = D.SIZE[S.modality];
      const mk = i => {
        const sel = h('select', { 'aria-label': (S.modality === 'areia' ? 'Atleta ' + (i + 1) : 'Posição P' + (i + 1)) + ' ' + t.name, onchange: () => {
          S.lineup[team][i] = sel.value; S.bench[team] = S.bench[team].filter(id => id !== sel.value); draw();
        } }, opt('', '— escolher —', !S.lineup[team][i]), all.map(a => opt(a.id, '#' + a.number + ' ' + a.name + ' (' + abb(a.role) + ')', S.lineup[team][i] === a.id)));
        return h('div', { class: 'field', style: { margin: '4px 0' } }, h('label', {}, S.modality === 'areia' ? (i === 0 ? 'Atleta 1 · saca primeiro' : 'Atleta 2') : 'P' + (i + 1)), sel);
      };
      let grid;
      if (S.modality === 'areia') grid = h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr' } }, mk(0), mk(1));
      else grid = h('div', {}, h('div', { class: 'sm-t mut' }, 'Rede ▲'), h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' } }, [3, 2, 1, 4, 5, 0].map(mk)));
      const benchOpts = all.filter(a => !S.lineup[team].includes(a.id));
      const bench = S.modality === 'areia' ? null : h('div', {}, h('div', { class: 'lbl mut sm-t', style: { margin: '10px 0 4px' } }, 'Banco (substituições)'),
        benchOpts.length ? h('div', { class: 'chips' }, benchOpts.map(a => h('span', { class: 'chip' + (S.bench[team].includes(a.id) ? ' on' : ''), role: 'checkbox', 'aria-checked': S.bench[team].includes(a.id), tabindex: 0,
          onclick: () => { const b = S.bench[team], i = b.indexOf(a.id); if (i < 0) b.push(a.id); else b.splice(i, 1); draw(); } }, '#' + a.number + ' ' + a.name))) : h('div', { class: 'sm-t mut' }, 'Sem outros atletas cadastrados.'));
      void need;
      return h('div', { class: 'card' }, h('h3', {}, h('span', { class: 'dot', style: { background: t.color } }), (team === 'home' ? 'Sua equipe: ' : 'Adversário: ') + t.name), grid, bench);
    }

    function draw() {
      box.innerHTML = '';
      const ts = d0.teams.filter(t => t.modality === S.modality);
      const modSel = h('select', { onchange: () => { S.modality = modSel.value; S.home = S.away = null; pickTeams(); draw(); } }, Object.keys(D.MODALITIES).map(k => opt(k, D.MODALITIES[k], S.modality === k)));
      box.appendChild(h('div', { class: 'card' }, field('Modalidade', modSel)));
      if (ts.length < 2) {
        box.appendChild(h('div', { class: 'empty', style: { marginTop: '12px' } }, 'Você precisa de pelo menos 2 equipes de ' + D.MODALITIES[S.modality].toLowerCase() + ' (a sua e a do adversário). Há ' + ts.length + ' cadastrada(s).',
          h('div', { style: { marginTop: '10px' } }, h('button', { class: 'pri', onclick: () => RV.go('equipes') }, 'Ir para Minhas Equipes'))));
        return;
      }
      const hs = h('select', { onchange: () => { S.home = hs.value; if (S.away === S.home) S.away = (ts.find(t => t.id !== S.home) || {}).id; autofill('home'); autofill('away'); draw(); } }, ts.map(t => opt(t.id, t.name, S.home === t.id)));
      const as = h('select', { onchange: () => { S.away = as.value; if (S.home === S.away) S.home = (ts.find(t => t.id !== S.away) || {}).id; autofill('home'); autofill('away'); draw(); } }, ts.map(t => opt(t.id, t.name, S.away === t.id)));
      box.appendChild(h('div', { class: 'grid g2', style: { marginTop: '12px' } }, h('div', { class: 'card' }, field('Sua equipe (embaixo)', hs)), h('div', { class: 'card' }, field('Equipe adversária (em cima)', as))));
      box.appendChild(h('div', { class: 'grid g2', style: { marginTop: '12px' } }, lineupEditor('home'), lineupEditor('away')));
      const fs = h('select', { onchange: () => { S.first = fs.value; } }, opt('home', D.find('teams', S.home).name, S.first === 'home'), opt('away', D.find('teams', S.away).name, S.first === 'away'));
      const seas = h('select', { onchange: () => { S.season = seas.value; } }, D.D().seasons.map(s => opt(s.id, s.name, S.season === s.id)));
      const tgt = h('input', { type: 'number', min: 1, max: 99, value: S.target, oninput: () => { S.target = Number(tgt.value) || 25; } });
      box.appendChild(h('div', { class: 'card', style: { marginTop: '12px' } }, h('div', { class: 'grid g2' }, field('Quem saca primeiro', fs), field('Temporada', seas), mode === 'treino' ? field('Meta de pontos do treino (referência)', tgt) : null),
        h('p', { class: 'sm-t mut', style: { margin: '8px 0 0' } }, S.modality === 'areia'
          ? 'Areia: 2 atletas por dupla, sem substituições e sem rodízio. O saque alterna entre os dois a cada vez que a dupla recupera o saque. Sets de 21 (o 3º de 15), vence quem abrir 2 pontos, melhor de 3.'
          : 'Quadra: 6 em quadra (P1 é o sacador). Quem ganha o rally sacando pontua e continua sacando; quem recebe e ganha pontua, assume o saque e gira um posto no sentido horário. Sets de 25 (o 5º de 15), diferença de 2, melhor de 5.')));
      const err = h('div', { class: 'err' });
      box.appendChild(err);
      box.appendChild(h('button', { class: 'pri', style: { width: '100%', marginTop: '6px', minHeight: '48px' }, onclick: start }, mode === 'treino' ? 'Iniciar treino' : 'Iniciar jogo'));
      function start() {
        const need = D.SIZE[S.modality];
        for (const team of ['home', 'away']) {
          const lu = S.lineup[team], nm = D.find('teams', S[team]).name;
          if (lu.length < need || lu.some(x => !x)) { err.textContent = nm + ': escolha ' + need + ' atletas em quadra' + (need === 6 ? ' (P1 a P6)' : '') + '.'; return; }
          if (new Set(lu).size !== lu.length) { err.textContent = nm + ': o mesmo atleta aparece duas vezes.'; return; }
        }
        const cfg = { modality: S.modality, mode, target: S.target, firstServe: S.first, teams: { home: { lineup: S.lineup.home.slice(), bench: S.bench.home.slice() }, away: { lineup: S.lineup.away.slice(), bench: S.bench.away.slice() } } };
        const snapshot = { teams: {}, players: {} };
        ['home', 'away'].forEach(team => {
          const t = D.find('teams', S[team]); snapshot.teams[team] = { id: t.id, name: t.name, color: t.color };
          cfg.teams[team].lineup.concat(cfg.teams[team].bench).forEach(id => { const a = D.find('athletes', id); snapshot.players[id] = { name: a.name, number: a.number, role: a.role, team }; });
        });
        // o time visitante e o mandante podem ter a mesma cor: diferencia
        if (snapshot.teams.home.color === snapshot.teams.away.color) snapshot.teams.away.color = '#ef4444' === snapshot.teams.home.color ? '#f59e0b' : '#ef4444';
        const rec = D.createMatch({ mode, modality: S.modality, seasonId: S.season, cfg, snapshot });
        RV.go('live/' + rec.id);
      }
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
.live{display:grid;gap:12px}.lcol{min-width:0}.rcol{min-width:0}
@media(min-width:900px){.live{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}.rcol{position:sticky;top:64px;align-self:start;max-height:calc(100vh - 80px);overflow:auto}}
.sb{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;text-align:center;margin-bottom:10px}
.sb .tn{font-weight:800;font-size:15px;overflow:hidden;text-overflow:ellipsis}
.sb .big{font-size:46px;font-weight:900;line-height:1}
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
@media(max-width:899px){.sheet.open{position:fixed;left:0;right:0;bottom:0;z-index:20;margin:0;padding:10px 12px 14px;background:var(--panel);border-top:2px solid var(--blue);max-height:55vh;overflow:auto;box-shadow:0 -8px 30px #000a}.live.sheetopen{padding-bottom:42vh}}
`); document.head.appendChild(st);
    }

    function compute() { R = E.replayTrace(cfg, rec.events); }
    const nameOf = id => (snap.players[id] ? snap.players[id].name : '?');
    const posOf = (st, team, id) => st.cur.teams[team].lineup.indexOf(id);

    function persist() { D.saveMatch(); }
    function add(ev) {
      const e = Object.assign({ id: D.uid('e'), ts: Date.now(), source: 'manual', videoTime: null, confidence: null }, ev);
      const test = E.replay(cfg, rec.events.concat([e]));
      if (test.errors.length) { toast(test.errors[test.errors.length - 1], true); return false; }
      rec.events.push(e); persist(); compute();
      if (R.st.cur.switchAlert && !isTrain) toast('Troca de lado! (placar ' + R.st.cur.score.home + '–' + R.st.cur.score.away + ')');
      return true;
    }
    function undo() { if (!rec.events.length) return; rec.events.pop(); persist(); compute(); refresh(); toast('Último registro desfeito.'); }

    const court = RV.Court.create(courtBox, cfg.modality, { onSelect: (team, id) => {
      if (R.st.phase === 'setEnd' || R.st.phase === 'over') return toast('O set terminou. Use "Próximo set" ou finalize.', true);
      sel = { team, id }; court.select(id); drawSheet(); } });

    function desc(ev) {
      if (ev.type === 'nextSet') return 'Início do set';
      if (ev.type === 'sub') return 'Substituição: sai ' + nameOf(ev.out) + ', entra ' + nameOf(ev.in) + ' (' + snap.teams[ev.team].name + ')';
      const a = E.ACTIONS[ev.action];
      return a.label + ' — ' + (ev.athleteId ? '#' + snap.players[ev.athleteId].number + ' ' + nameOf(ev.athleteId) : snap.teams[ev.team].name);
    }

    function drawScore() {
      const st = R.st, s = st.cur, srv = E.serverId(st, s.serving);
      const side = (team) => h('div', { class: 'side-a' + (s.serving === team ? ' serving' : '') },
        h('div', { class: 'tn', style: { color: snap.teams[team].color } }, snap.teams[team].name),
        h('div', { class: 'big' }, s.score[team]), h('div', { class: 'srv' }, s.serving === team ? '🏐 saca' + (srv ? ': ' + nameOf(srv) : '') : ''));
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
      GROUPS.forEach(([title, keys]) => {
        sheet.appendChild(h('div', { class: 'lbl mut sm-t', style: { margin: '8px 0 4px' } }, title));
        sheet.appendChild(h('div', { class: 'act' }, keys.map(k => {
          const a = E.ACTIONS[k], err = E.validate(st, { type: 'action', team: sel.team, athleteId: sel.id, action: k });
          return h('button', { disabled: !!err, title: err || '', class: a.pts === 'opp' ? 'dng' : '', onclick: () => { if (add({ type: 'action', team: sel.team, athleteId: sel.id, action: k })) { toast(a.label + ' — ' + pl.name); refresh(); } } }, a.short);
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
        const out = h('select', {}, L.map((id, i) => opt(id, 'P' + (i + 1) + ' · #' + snap.players[id].number + ' ' + snap.players[id].name)));
        const inn = h('select', {}, B.map(id => opt(id, '#' + snap.players[id].number + ' ' + snap.players[id].name + ' (' + abb(snap.players[id].role) + ')')));
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
        const ids = cfg.teams[t].lineup.concat(cfg.teams[t].bench);
        const rows = ids.map(id => { const s = R.st.stats[id]; return h('tr', {}, h('td', {}, '#' + snap.players[id].number + ' ' + snap.players[id].name), STAT_COLS.map(([k]) => h('td', {}, k === 'pts' ? E.totalPoints(s) : s[k]))); });
        body.appendChild(h('div', { class: 'lbl mut sm-t', style: { margin: '10px 0 4px', color: snap.teams[t].color } }, snap.teams[t].name));
        body.appendChild(h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, 'Atleta'), STAT_COLS.map(([, l]) => h('th', {}, l)))), h('tbody', {}, rows)));
      });
      stats.appendChild(h('details', { class: 'card', style: { marginTop: '12px' }, open: !!wasOpen }, h('summary', {}, 'Estatísticas por atleta'), body));
    }

    function refresh() { compute(); drawScore(); drawBanner(); court.update(R.st, snap); drawSheet(); drawCtrl(); drawHist(); drawStats(); }
    refresh();
    RV.onLeave(() => { const s = document.getElementById('live-css'); if (s) s.remove(); });
    RV.liveDebug = { get state() { return R; }, rec };
  };
})();
