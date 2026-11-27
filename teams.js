/* teams.js — telas de Equipes (lista e detalhe com elenco) e Atletas (todos), com cadastro completo. */
(function () {
  'use strict';
  const RV = window.RV, { h, toast, modal, confirmBox, field, opt } = RV.UI, D = RV.Data;
  const roleLabel = a => a.role + ' · ' + (a.status === 'titular' ? 'Titular' : 'Reserva');

  function colorPicker(initial) {
    let val = initial || D.COLORS[0];
    const inp = h('input', { type: 'color', value: val, 'aria-label': 'Cor da equipe', oninput: () => { val = inp.value; } });
    const sw = D.COLORS.map(c => h('button', { type: 'button', class: 'sm', title: c, style: { background: c, width: '32px', padding: '0' }, 'aria-label': 'Cor ' + c, onclick: () => { val = c; inp.value = c; } }));
    return { get: () => val, el: h('div', { class: 'row' }, inp, sw) };
  }

  function teamForm(t, after) {
    const isNew = !t, rec = t ? Object.assign({}, t) : { name: '', modality: 'quadra' };
    const name = h('input', { value: rec.name, maxlength: 30, placeholder: 'Ex.: Sesi Bauru' });
    const mod = h('select', { disabled: !isNew }, Object.keys(D.MODALITIES).map(k => opt(k, D.MODALITIES[k], rec.modality === k)));
    const col = colorPicker(rec.color);
    const err = h('div', { class: 'err' });
    const body = h('div', {}, field('Nome', name), field('Modalidade' + (isNew ? '' : ' (não pode mudar)'), mod), field('Cor', col.el), err);
    modal(isNew ? 'Nova equipe' : 'Editar equipe', body, [{ label: 'Cancelar' }, { label: 'Salvar', cls: 'pri', fn: () => {
      rec.name = name.value; rec.modality = mod.value; rec.color = col.get();
      const e = D.saveTeam(rec); if (e) { err.textContent = e; toast(e, true); return false; }
      toast('Equipe salva.'); after(rec);
    } }]);
  }

  function athleteForm(a, teamId, after) {
    const isNew = !a, rec = a ? Object.assign({}, a) : { teamId: teamId || (D.D().teams[0] || {}).id, name: '', number: '', role: 'Ponteiro', status: 'titular' };
    const nextNum = tid => { const used = new Set(D.teamAthletes(tid).map(x => Number(x.number))); let n = 1; while (used.has(n) && n < 99) n++; return n; };
    if (isNew) rec.number = nextNum(rec.teamId);
    const teams = D.D().teams;
    const team = h('select', { onchange: () => { if (isNew) num.value = nextNum(team.value); } }, teams.map(t => opt(t.id, t.name + ' (' + (t.modality === 'areia' ? 'areia' : 'quadra') + ')', rec.teamId === t.id)));
    const name = h('input', { value: rec.name, maxlength: 30, placeholder: 'Nome do atleta' });
    const num = h('input', { type: 'number', min: 0, max: 99, value: rec.number, inputmode: 'numeric', placeholder: '0–99' });
    const role = h('select', {}, D.ROLES.map(r => opt(r, r, rec.role === r)));
    const st = h('select', {}, D.STATUS.map(s => opt(s, s === 'titular' ? 'Titular' : 'Reserva', rec.status === s)));
    const err = h('div', { class: 'err' });
    const body = h('div', {}, field('Equipe', team), field('Nome', name), field('Número da camisa', num),
      field('Função tática (não é a posição no rodízio)', role), field('Status no elenco', st), err);
    modal(isNew ? 'Novo atleta' : 'Editar atleta', body, [{ label: 'Cancelar' }, { label: 'Salvar', cls: 'pri', fn: () => {
      rec.teamId = team.value; rec.name = name.value; rec.number = num.value === '' ? NaN : num.value; rec.role = role.value; rec.status = st.value;
      const e = D.saveAthlete(rec); if (e) { err.textContent = e; toast(e, true); return false; }
      toast('Atleta salvo.'); after(rec);
    } }]);
  }

  function summaryLine(id) {
    const s = RV.Stats && RV.Stats.athleteTotals ? RV.Stats.athleteTotals(id) : null;
    if (!s || !s.games) return 'Sem partidas registradas';
    return s.games + ' registro(s) · ' + s.points + ' ponto(s)';
  }

  function athleteRow(a, team, rerender) {
    return h('div', { class: 'li' },
      h('span', { class: 'num', style: { borderColor: team ? team.color : '' } }, a.number),
      h('div', { class: 'grow' }, h('b', {}, a.name), h('div', { class: 'sm-t mut' }, roleLabel(a) + (team ? ' · ' + team.name : '')), h('div', { class: 'sm-t mut' }, summaryLine(a.id))),
      h('button', { class: 'sm', onclick: () => athleteForm(a, a.teamId, rerender) }, 'Editar'),
      h('button', { class: 'sm dng', onclick: () => confirmBox('Excluir ' + a.name + '? O histórico de partidas já registradas é mantido.', 'Excluir', () => { D.remove('athletes', a.id); toast('Atleta excluído.'); rerender(); }) }, 'Excluir'));
  }

  RV.Screens.teams = function (root) {
    function draw() {
      root.innerHTML = '';
      const teams = D.D().teams;
      root.appendChild(h('div', { class: 'row sp', style: { marginBottom: '12px' } }, h('span', { class: 'mut' }, 'Cadastre suas equipes e a de quem você enfrenta.'),
        h('button', { class: 'pri', onclick: () => teamForm(null, t => RV.go('equipes/' + t.id)) }, '+ Nova equipe')));
      if (!teams.length) return root.appendChild(h('div', { class: 'empty' }, 'Nenhuma equipe ainda. Crie a primeira para montar elenco e iniciar treinos e jogos.'));
      root.appendChild(h('div', { class: 'grid g2' }, teams.map(t => {
        const n = D.teamAthletes(t.id).length;
        return h('a', { class: 'tile', href: '#/equipes/' + t.id, style: { borderLeft: '6px solid ' + t.color } },
          h('b', {}, t.name), h('span', {}, D.MODALITIES[t.modality] + ' · ' + n + ' atleta(s)'));
      })));
    }
    draw();
  };

  RV.Screens.team = function (root, p) {
    function draw() {
      root.innerHTML = '';
      const t = D.find('teams', p.id);
      if (!t) return root.appendChild(h('div', { class: 'empty' }, 'Equipe não encontrada.'));
      document.querySelector('.top h1').textContent = t.name;
      const ath = D.teamAthletes(t.id), need = D.SIZE[t.modality];
      const tit = ath.filter(a => a.status === 'titular'), res = ath.filter(a => a.status !== 'titular');
      root.appendChild(h('div', { class: 'row sp', style: { marginBottom: '10px' } },
        h('div', {}, h('span', { class: 'dot', style: { background: t.color } }), D.MODALITIES[t.modality]),
        h('div', { class: 'row' },
          h('button', { class: 'sm', onclick: () => teamForm(t, draw) }, 'Editar equipe'),
          h('button', { class: 'sm', onclick: () => RV.go('equipes') }, 'Todas as equipes'),
          h('button', { class: 'sm dng', onclick: () => confirmBox('Excluir a equipe ' + t.name + ' e seus atletas? Partidas já registradas continuam no histórico.', 'Excluir', () => { D.deleteTeam(t.id); toast('Equipe excluída.'); RV.go('equipes'); }) }, 'Excluir'))));
      root.appendChild(h('div', { class: 'row sp' }, h('h2', { style: { margin: '6px 0' } }, 'Elenco'),
        h('button', { class: 'pri', onclick: () => athleteForm(null, t.id, draw) }, '+ Novo atleta')));
      if (tit.length < need) root.appendChild(h('div', { class: 'sm-t', style: { color: 'var(--gold)', marginBottom: '8px' } }, 'Titulares: ' + tit.length + ' de ' + need + '. Para jogar, a escalação precisa de ' + need + ' atletas (' + (t.modality === 'areia' ? 'dupla' : '6 em quadra') + ').'));
      if (!ath.length) return root.appendChild(h('div', { class: 'empty' }, 'Sem atletas ainda. Adicione ' + need + ' ou mais.'));
      const sec = (title, arr) => arr.length ? h('div', { class: 'card', style: { marginBottom: '12px' } }, h('h3', {}, title + ' (' + arr.length + ')'), h('div', { class: 'list' }, arr.map(a => athleteRow(a, t, draw)))) : null;
      [sec('Titulares', tit), sec('Reservas', res)].forEach(x => { if (x) root.appendChild(x); });
    }
    draw();
  };

  RV.Screens.athletes = function (root) {
    let filter = 'all';
    function draw() {
      root.innerHTML = '';
      const d = D.D();
      const sel = h('select', { 'aria-label': 'Filtrar por equipe', onchange: () => { filter = sel.value; draw(); } }, opt('all', 'Todas as equipes', filter === 'all'), d.teams.map(t => opt(t.id, t.name, filter === t.id)));
      root.appendChild(h('div', { class: 'row sp', style: { marginBottom: '12px' } }, h('div', { style: { minWidth: '180px', flex: 1 } }, sel),
        h('button', { class: 'pri', onclick: () => { if (!d.teams.length) { toast('Crie uma equipe primeiro.', true); return RV.go('equipes'); } athleteForm(null, filter === 'all' ? null : filter, draw); } }, '+ Novo atleta')));
      const list = d.athletes.filter(a => filter === 'all' || a.teamId === filter).sort((x, y) => x.teamId.localeCompare(y.teamId) || x.number - y.number);
      if (!list.length) return root.appendChild(h('div', { class: 'empty' }, d.teams.length ? 'Nenhum atleta aqui ainda.' : 'Crie uma equipe em "Minhas Equipes" para cadastrar atletas.'));
      root.appendChild(h('div', { class: 'card list' }, list.map(a => athleteRow(a, D.find('teams', a.teamId), draw))));
    }
    draw();
  };
})();
