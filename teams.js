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

  function importAthletesModal(teamId, after) {
    let curTeamId = teamId || (D.D().teams[0] || {}).id;
    let step = 1;
    let rawText = '';
    let rows = [];
    let bulkRole = 'Ponteiro';

    const body = h('div', {});
    const err = h('div', { class: 'err' });

    function getTeam() { return D.find('teams', curTeamId); }

    function conflictNums() {
      const tm = getTeam();
      if (!tm) return new Set();
      const existing = new Set(D.teamAthletes(curTeamId).map(a => Number(a.number)));
      const seen = new Set();
      const bad = new Set();
      rows.forEach(r => {
        if (!r.selected) return;
        const n = Number(r.number);
        if (!Number.isInteger(n) || n < 0 || n > 99 || existing.has(n) || seen.has(n)) bad.add(n);
        seen.add(n);
      });
      return bad;
    }

    function renderStep() {
      body.innerHTML = '';
      err.textContent = '';
      const tm = getTeam();
      const isBeach = tm && tm.modality === 'areia';

      if (!teamId) {
        const tSel = h('select', {
          'aria-label': 'Equipe de destino',
          onchange: () => {
            curTeamId = tSel.value;
            if (step === 2) rows = D.parseAthleteLines(rawText, curTeamId);
            renderStep();
          }
        }, D.D().teams.map(t => opt(t.id, t.name + ' (' + (t.modality === 'areia' ? 'areia' : 'quadra') + ')', curTeamId === t.id)));
        body.appendChild(field('Equipe de destino', tSel));
      }

      if (step === 1) {
        const ta = h('textarea', {
          class: 'imp-area',
          placeholder: 'Cole os nomes aqui (um por linha ou separados por vírgula).\nExemplos:\n1. João Silva\n2 - Pedro Santos\n10 Lucas Oliveira\nCarlos #7',
          value: rawText,
          oninput: () => { rawText = ta.value; err.textContent = ''; }
        });
        const fileInp = h('input', {
          type: 'file',
          accept: '.txt,.csv,text/plain',
          style: { display: 'none' },
          onchange: () => {
            const f = fileInp.files && fileInp.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = () => {
              rawText = String(reader.result || '');
              ta.value = rawText;
              err.textContent = '';
              toast('Arquivo "' + f.name + '" carregado.');
            };
            reader.readAsText(f, 'UTF-8');
          }
        });
        body.appendChild(field('Lista de nomes (WhatsApp, planilha ou texto)', ta));
        body.appendChild(h('div', { class: 'row sp', style: { marginTop: '6px' } },
          h('span', { class: 'sm-t mut' }, isBeach
            ? 'Areia: a função já será preenchida como Universal automaticamente.'
            : 'Numeração de lista e camisas (ex.: "10 - João") são detectadas sozinhas.'),
          h('button', { type: 'button', class: 'sm', onclick: () => fileInp.click() }, 'Carregar .txt / .csv'),
          fileInp));
        body.appendChild(err);
        body.appendChild(h('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end' } },
          h('button', { type: 'button', onclick: closeModal }, 'Cancelar'),
          h('button', {
            type: 'button',
            class: 'pri',
            onclick: () => {
              const parsed = D.parseAthleteLines(rawText, curTeamId);
              if (!parsed.length) {
                err.textContent = 'Cole ou digite pelo menos um nome para continuar.';
                return;
              }
              rows = parsed;
              bulkRole = isBeach ? 'Universal' : 'Ponteiro';
              step = 2;
              renderStep();
            }
          }, 'Continuar →')));
      } else {
        const badNums = conflictNums();
        const selCount = rows.filter(r => r.selected).length;

        const topBar = h('div', { class: 'imp-toolbar' },
          h('div', { class: 'sm-t mut' }, selCount + ' de ' + rows.length + ' selecionado(s)'),
          !isBeach ? h('div', { class: 'row' },
            h('span', { class: 'sm-t mut' }, 'Função padrão:'),
            (() => {
              const sAll = h('select', {
                style: { width: 'auto', minHeight: '34px', padding: '4px 10px', fontSize: '13px' },
                onchange: () => {
                  bulkRole = sAll.value;
                  rows.forEach(r => { if (r.selected) r.role = bulkRole; });
                  renderStep();
                }
              }, D.ROLES.map(r => opt(r, r, bulkRole === r)));
              return sAll;
            })()) : h('span', { class: 'pill' }, 'Areia · Universal automático'));
        body.appendChild(topBar);

        const listBox = h('div', { class: 'imp-list' });
        rows.forEach((r, idx) => {
          const n = Number(r.number);
          const hasNumConflict = r.selected && (!Number.isInteger(n) || n < 0 || n > 99 || badNums.has(n));
          const chk = h('input', {
            type: 'checkbox',
            checked: r.selected,
            'aria-label': 'Selecionar ' + r.name,
            onchange: () => { r.selected = chk.checked; renderStep(); }
          });
          const numInp = h('input', {
            type: 'number',
            min: 0,
            max: 99,
            value: r.number,
            disabled: !r.selected,
            'aria-label': 'Camisa de ' + r.name,
            oninput: () => {
              r.number = numInp.value === '' ? NaN : Number(numInp.value);
              const nowBad = conflictNums();
              const isBad = r.selected && (!Number.isInteger(r.number) || r.number < 0 || r.number > 99 || nowBad.has(r.number));
              rowEl.classList.toggle('conflict', isBad);
              err.textContent = '';
            }
          });
          const nameInp = h('input', {
            value: r.name,
            maxlength: 30,
            disabled: !r.selected,
            'aria-label': 'Nome do atleta ' + (idx + 1),
            oninput: () => { r.name = nameInp.value; err.textContent = ''; }
          });
          const roleSel = h('select', {
            class: 'imp-role',
            disabled: !r.selected,
            'aria-label': 'Função de ' + r.name,
            onchange: () => { r.role = roleSel.value; }
          }, D.ROLES.map(rl => opt(rl, rl, r.role === rl)));
          const stSel = h('select', {
            class: 'imp-stat',
            disabled: !r.selected,
            'aria-label': 'Status de ' + r.name,
            onchange: () => { r.status = stSel.value; }
          }, D.STATUS.map(st => opt(st, st === 'titular' ? 'Titular' : 'Reserva', r.status === st)));

          const nameCol = h('div', { style: { minWidth: 0 } },
            nameInp,
            hasNumConflict ? h('div', { class: 'imp-tag err' }, 'Camisa repetida/inválida')
              : (r.dupTeam ? h('div', { class: 'imp-tag' }, 'Nome já existe na equipe')
                : (r.dupBatch ? h('div', { class: 'imp-tag' }, 'Repetido na lista') : null)));

          const rowEl = h('div', { class: 'imp-row' + (!r.selected ? ' off' : '') + (hasNumConflict ? ' conflict' : '') },
            chk, numInp, nameCol, roleSel, stSel);
          listBox.appendChild(rowEl);
        });
        body.appendChild(listBox);
        body.appendChild(err);
        body.appendChild(h('div', { class: 'row sp', style: { marginTop: '14px' } },
          h('button', { type: 'button', onclick: () => { step = 1; renderStep(); } }, '← Editar lista'),
          h('div', { class: 'row' },
            h('button', { type: 'button', onclick: closeModal }, 'Cancelar'),
            h('button', {
              type: 'button',
              class: 'pri',
              onclick: () => {
                const res = D.saveAthletesBatch(curTeamId, rows);
                if (res.error) {
                  err.textContent = res.error;
                  toast(res.error, true);
                  return;
                }
                closeModal();
                toast(res.count + (res.count === 1 ? ' atleta importado!' : ' atletas importados!'));
                after();
              }
            }, 'Importar (' + selCount + ')'))));
      }
    }

    const ov = h('div', { class: 'ov' });
    const closeModal = () => ov.remove();
    const tm0 = getTeam();
    const title = 'Importar atletas' + (tm0 && teamId ? ' · ' + tm0.name : '');
    const box = h('div', { class: 'modal wide', role: 'dialog', 'aria-label': title },
      h('h2', { style: { marginTop: 0 } }, title), body);
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(); });
    ov.appendChild(box);
    document.body.appendChild(ov);
    renderStep();
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
        h('div', { class: 'row' },
          h('button', { onclick: () => importAthletesModal(t.id, draw) }, 'Importar lista'),
          h('button', { class: 'pri', onclick: () => athleteForm(null, t.id, draw) }, '+ Novo atleta'))));
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
        h('div', { class: 'row' },
          h('button', { onclick: () => { if (!d.teams.length) { toast('Crie uma equipe primeiro.', true); return RV.go('equipes'); } importAthletesModal(filter === 'all' ? null : filter, draw); } }, 'Importar lista'),
          h('button', { class: 'pri', onclick: () => { if (!d.teams.length) { toast('Crie uma equipe primeiro.', true); return RV.go('equipes'); } athleteForm(null, filter === 'all' ? null : filter, draw); } }, '+ Novo atleta'))));
      const list = d.athletes.filter(a => filter === 'all' || a.teamId === filter).sort((x, y) => x.teamId.localeCompare(y.teamId) || x.number - y.number);
      if (!list.length) return root.appendChild(h('div', { class: 'empty' }, d.teams.length ? 'Nenhum atleta aqui ainda.' : 'Crie uma equipe em "Minhas Equipes" para cadastrar atletas.'));
      root.appendChild(h('div', { class: 'card list' }, list.map(a => athleteRow(a, D.find('teams', a.teamId), draw))));
    }
    draw();
  };
})();
