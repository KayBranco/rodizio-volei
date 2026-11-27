/* engine.js — regras do vôlei, puras (sem DOM). Funciona no navegador (window.RV.Engine) e no Node.
 * A partida é uma LISTA DE EVENTOS. Placar, rodízio, saque, sets e estatísticas são derivados
 * por replay: Engine.replay(cfg, events). Desfazer = remover o último evento e refazer o replay.
 *
 * cfg = {
 *   modality: 'quadra' | 'areia',
 *   mode: 'jogo' | 'treino',
 *   target: 25,                       // só treino: pontos de referência (não encerra nada)
 *   firstServe: 'home' | 'away',
 *   teams: { home:{ lineup:[6 ids P1..P6] | [2 ids], bench:[ids] }, away:{...} }
 * }
 * evento = { id, type:'action'|'sub', team, athleteId, action, in, out,
 *            source:'manual', videoTime:null, confidence:null, ts }
 * (source/videoTime/confidence: ganchos para uma futura captura por câmera/visão; hoje sempre manual.)
 */
(function (root) {
  'use strict';

  // pts: quem pontua ('own' | 'opp' | null); who: quem pode executar
  const ACTIONS = {
    ace:       { label: 'Ace',               short: 'Ace',      stat: 'aces',     pts: 'own', who: 'server' },
    serve_ok:  { label: 'Saque positivo',    short: 'Saque +',  stat: 'serveOk',  pts: null,  who: 'server' },
    serve_err: { label: 'Erro de saque',     short: 'Saque ×',  stat: 'serveErr', pts: 'opp', who: 'server' },
    atk_ok:    { label: 'Ataque positivo',   short: 'Ataque +', stat: 'atkOk',    pts: 'own', who: 'any' },
    atk_err:   { label: 'Erro de ataque',    short: 'Ataque ×', stat: 'atkErr',   pts: 'opp', who: 'any' },
    block:     { label: 'Bloqueio',          short: 'Bloqueio', stat: 'blocks',   pts: 'own', who: 'any' },
    rec_ok:    { label: 'Recepção positiva', short: 'Recep. +', stat: 'recOk',    pts: null,  who: 'receiver' },
    rec_err:   { label: 'Erro de recepção',  short: 'Recep. ×', stat: 'recErr',   pts: 'opp', who: 'receiver' },
    dig:       { label: 'Defesa',            short: 'Defesa',   stat: 'digs',     pts: null,  who: 'any' },
    assist:    { label: 'Assistência',       short: 'Assist.',  stat: 'assists',  pts: null,  who: 'any' },
    point:     { label: 'Ponto',             short: 'Ponto',    stat: 'otherPts', pts: 'own', who: 'any' }
  };
  const STAT_KEYS = ['aces', 'serveOk', 'serveErr', 'atkOk', 'atkErr', 'blocks', 'recOk', 'recErr', 'digs', 'assists', 'otherPts'];
  const emptyStats = () => { const o = {}; STAT_KEYS.forEach(k => { o[k] = 0; }); return o; };
  // pontos marcados pelo atleta = ace + ataque positivo + bloqueio + ponto genérico
  const totalPoints = s => s.aces + s.atkOk + s.blocks + s.otherPts;
  const other = t => (t === 'home' ? 'away' : 'home');
  const MAX_SUBS = 6;

  function rules(cfg, setNo) {
    if (cfg.modality === 'areia') return { target: setNo >= 3 ? 15 : 21, switchEvery: setNo >= 3 ? 5 : 7 };
    return { target: setNo >= 5 ? 15 : 25, switchEvery: 0 };
  }
  const setsToWin = cfg => (cfg.modality === 'areia' ? 2 : 3);

  // Rodízio horário: P2→P1, P1→P6, P6→P5, P5→P4, P4→P3, P3→P2.  lineup[0]=P1 … lineup[5]=P6
  function rotate(l) { return [l[1], l[2], l[3], l[4], l[5], l[0]]; }

  /* ---- escalação por sistema (mesma regra do tutorial) ----
   * Posições iniciais (R1) por função: P1..P6. Na rotação r, quem começou em s0 está em slotAfter(s0, r).
   * Em todos os sistemas os pares em diagonal são P1–P4, P2–P5, P3–P6: levantador × oposto (ou 2º levantador),
   * ponteiro × ponteiro, central × central. */
  const ORDER = [1, 6, 5, 4, 3, 2];
  const slotAfter = (s0, rot) => ORDER[(ORDER.indexOf(s0) + rot - 1) % 6];
  const SYSTEMS = {
    '5-1': { label: '5-1', libero: true,  start: { 1: 'LEV', 2: 'PON', 3: 'CEN', 4: 'OPO', 5: 'PON', 6: 'CEN' }, text: '1 levantador, 1 oposto, 2 ponteiros e 2 centrais.' },
    '6-2': { label: '6-2', libero: true,  start: { 1: 'LEV', 2: 'PON', 3: 'CEN', 4: 'LEV', 5: 'PON', 6: 'CEN' }, text: '2 levantadores (o do fundo levanta), 2 ponteiros e 2 centrais.' },
    '4-2': { label: '4-2', libero: false, start: { 1: 'LEV', 2: 'ATK', 3: 'ATK', 4: 'LEV', 5: 'ATK', 6: 'ATK' }, text: '2 levantadores (o da rede levanta) e 4 atacantes. Sem líbero.' },
    '6-0': { label: '6-0', libero: true,  start: { 1: 'ANY', 2: 'ANY', 3: 'ANY', 4: 'ANY', 5: 'ANY', 6: 'ANY' }, text: 'Todos levantam quando passam pela rede. Sem funções fixas.' }
  };
  const ACCEPT = { // preferência de função para cada vaga
    LEV: ['Levantador', 'Universal'], OPO: ['Oposto', 'Universal'], CEN: ['Central', 'Universal'],
    PON: ['Ponteiro', 'Universal'], ATK: ['Ponteiro', 'Oposto', 'Universal', 'Central'], ANY: null
  };
  const CAT_LABEL = { LEV: 'Levantador', OPO: 'Oposto', CEN: 'Central', PON: 'Ponteiro', ATK: 'Atacante', ANY: 'qualquer' };
  // função esperada em cada posição (índice 0 = P1) numa rotação
  function expectedRoles(sys, rot) {
    const out = [];
    for (let s0 = 1; s0 <= 6; s0++) out[slotAfter(s0, rot) - 1] = SYSTEMS[sys].start[s0];
    return out;
  }
  // atletas: [{id, role, status, number}] -> 6 ids por posição ('' se faltar)
  function autoLineup(sys, rot, athletes, excludeIds) {
    const ex = new Set(excludeIds || []);
    const pool = athletes.filter(a => !ex.has(a.id)).sort((a, b) => (a.status === 'titular' ? 0 : 1) - (b.status === 'titular' ? 0 : 1) || a.number - b.number);
    const exp = expectedRoles(sys, rot), res = ['', '', '', '', '', ''], used = new Set();
    const prio = ['LEV', 'OPO', 'CEN', 'PON', 'ATK', 'ANY'];
    prio.forEach(cat => exp.forEach((c, pos) => {
      if (c !== cat) return;
      const acc = ACCEPT[cat];
      let pick = null;
      if (acc) for (const r of acc) { pick = pool.find(a => !used.has(a.id) && a.role === r); if (pick) break; }
      if (!pick) pick = pool.find(a => !used.has(a.id));
      if (pick) { used.add(pick.id); res[pos] = pick.id; }
    }));
    return res;
  }
  // avisos (não bloqueiam) sobre a escalação em relação ao sistema/rotação. roles: 6 funções por posição
  function checkLineup(sys, rot, roles) {
    const exp = expectedRoles(sys, rot), w = [];
    exp.forEach((c, i) => {
      const acc = ACCEPT[c]; if (!acc || !roles[i]) return;
      if (acc.indexOf(roles[i]) < 0) w.push('P' + (i + 1) + ': o ' + sys + ' pede ' + CAT_LABEL[c].toLowerCase() + ' aqui, mas está ' + roles[i].toLowerCase() + '.');
    });
    return w;
  }
  const allIds = (cfg, t) => cfg.teams[t].lineup.concat(cfg.teams[t].bench, cfg.teams[t].libero ? [cfg.teams[t].libero] : []);
  // quem está de fato em quadra: o líbero entra no lugar do central que estiver em P5/P6 (um por vez)
  function courtLineup(st, team) {
    const L = st.cur.teams[team].lineup.slice(), c = st.cfg.teams[team];
    if (c.libero && L.length === 6) {
      for (const i of [4, 5]) if ((c.centrals || []).indexOf(L[i]) >= 0) { L[i] = c.libero; break; }
    }
    return L;
  }

  function freshSet(cfg, setNo, firstServe) {
    const teams = {};
    ['home', 'away'].forEach(t => {
      teams[t] = { lineup: cfg.teams[t].lineup.slice(), bench: cfg.teams[t].bench.slice(), subs: 0, subPairs: [], rotN: 0 };
    });
    return {
      no: setNo, score: { home: 0, away: 0 }, serving: firstServe, firstServe,
      teams,
      // areia: quem saca dentro da dupla (cur) e quem sacará da próxima vez que a dupla ganhar o saque (next)
      srv: {
        home: firstServe === 'home' ? { cur: 0, next: 1 } : { cur: null, next: 0 },
        away: firstServe === 'away' ? { cur: 0, next: 1 } : { cur: null, next: 0 }
      },
      rallies: 0, switchAlert: false
    };
  }

  function initState(cfg) {
    const stats = {};
    ['home', 'away'].forEach(t => allIds(cfg, t).forEach(id => { stats[id] = emptyStats(); }));
    const first = cfg.firstServe || 'home';
    return {
      cfg, cur: freshSet(cfg, 1, first), done: [], sets: { home: 0, away: 0 },
      phase: cfg.mode === 'treino' ? 'treino' : 'playing', // playing | setEnd | over | treino
      winner: null, stats, log: [], errors: []
    };
  }

  function serverId(st, team) {
    const s = st.cur;
    if (st.cfg.modality === 'areia') { const c = s.srv[team].cur; return c == null ? null : s.teams[team].lineup[c]; }
    return s.teams[team].lineup[0];
  }
  const onCourt = (st, id) => ['home', 'away'].find(t => courtLineup(st, t).indexOf(id) >= 0) || null;

  // devolve null se válido, ou mensagem de erro
  function validate(st, ev) {
    if (st.phase === 'over') return 'A partida já terminou.';
    if (st.phase === 'setEnd') return 'O set terminou. Inicie o próximo set.';
    const s = st.cur;
    if (ev.type === 'sub') {
      if (st.cfg.modality === 'areia') return 'No vôlei de areia não há substituições.';
      if (st.cfg.mode === 'treino') { /* treino: livre, sem limite */ }
      const t = ev.team;
      if (!s.teams[t]) return 'Equipe inválida.';
      if (s.teams[t].lineup.indexOf(ev.out) < 0) return 'O atleta que sai não está em quadra.';
      if (s.teams[t].bench.indexOf(ev.in) < 0) return 'O atleta que entra não está no banco.';
      if (st.cfg.mode !== 'treino' && s.teams[t].subs >= MAX_SUBS) return 'Limite de ' + MAX_SUBS + ' substituições por set atingido.';
      return null;
    }
    const a = ACTIONS[ev.action];
    if (!a) return 'Ação desconhecida.';
    if (!ev.team || !s.teams[ev.team]) return 'Equipe inválida.';
    if (ev.athleteId) {
      if (courtLineup(st, ev.team).indexOf(ev.athleteId) < 0) return 'O atleta precisa estar em quadra.';
    } else if (ev.action !== 'point') return 'Escolha o atleta.';
    if (a.who === 'server' && ev.team !== s.serving) return 'Só a equipe que saca pode registrar saques.';
    if (a.who === 'server' && ev.athleteId && ev.athleteId !== serverId(st, ev.team)) return 'Só o sacador atual pode registrar o saque.';
    if (a.who === 'receiver' && ev.team === s.serving) return 'Só a equipe que recebe pode registrar recepções.';
    return null;
  }

  function endSetIfNeeded(st) {
    const s = st.cur, r = rules(st.cfg, s.no), h = s.score.home, a = s.score.away;
    const lead = Math.abs(h - a);
    if (Math.max(h, a) >= r.target && lead >= 2) {
      const w = h > a ? 'home' : 'away';
      st.sets[w]++; st.done.push({ no: s.no, home: h, away: a, winner: w });
      st.phase = st.sets[w] >= setsToWin(st.cfg) ? 'over' : 'setEnd';
      if (st.phase === 'over') st.winner = w;
    }
  }

  // ponto para `team`: placar, saque e rodízio
  function awardPoint(st, team) {
    const s = st.cur;
    s.score[team]++; s.rallies++;
    if (team !== s.serving) { // side-out: a equipe que recebia ganha o saque
      s.serving = team;
      if (st.cfg.modality === 'areia') {
        const q = s.srv[team]; q.cur = q.next; q.next = 1 - q.cur;
      } else {
        s.teams[team].lineup = rotate(s.teams[team].lineup); s.teams[team].rotN++;
      }
    } // quem saca e pontua mantém o saque, sem rodar
    const r = rules(st.cfg, s.no), tot = s.score.home + s.score.away;
    if (st.cfg.modality === 'areia') s.switchAlert = tot % r.switchEvery === 0;
    else if (s.no === 5 && Math.max(s.score.home, s.score.away) === 8 && !s.switched) { s.switched = true; s.switchAlert = true; }
    else s.switchAlert = false;
    if (st.cfg.mode !== 'treino') endSetIfNeeded(st);
  }

  function apply(st, ev) {
    const err = validate(st, ev);
    if (err) { st.errors.push(err); return err; }
    const s = st.cur;
    if (ev.type === 'sub') {
      const L = s.teams[ev.team].lineup, B = s.teams[ev.team].bench;
      L[L.indexOf(ev.out)] = ev.in; B[B.indexOf(ev.in)] = ev.out;
      s.teams[ev.team].subs++; s.teams[ev.team].subPairs.push([ev.out, ev.in]);
      if (!st.stats[ev.in]) st.stats[ev.in] = emptyStats();
    } else {
      const a = ACTIONS[ev.action];
      if (ev.athleteId) st.stats[ev.athleteId][a.stat]++;
      s.switchAlert = false;
      if (a.pts) awardPoint(st, a.pts === 'own' ? ev.team : other(ev.team));
    }
    st.log.push(ev);
    return null;
  }

  function nextSet(st) {
    if (st.phase !== 'setEnd') return 'Não há set para iniciar.';
    const first = other(st.cur.firstServe); // o saque inicial alterna a cada set
    st.cur = freshSet(st.cfg, st.cur.no + 1, first);
    st.phase = 'playing';
    return null;
  }

  // refaz tudo a partir dos eventos; eventos inválidos são ignorados e reportados em st.errors
  function replay(cfg, events) {
    const st = initState(cfg);
    for (const ev of events) {
      if (ev.type === 'nextSet') { nextSet(st); st.log.push(ev); continue; }
      apply(st, ev);
    }
    return st;
  }

  // igual ao replay, mas guarda o placar depois de cada evento (para o histórico). trace[i] = {set, home, away, sets}
  function replayTrace(cfg, events) {
    const st = initState(cfg), trace = [];
    for (const ev of events) {
      if (ev.type === 'nextSet') { nextSet(st); st.log.push(ev); }
      else apply(st, ev);
      trace.push({ set: st.cur.no, home: st.cur.score.home, away: st.cur.score.away, sets: { home: st.sets.home, away: st.sets.away } });
    }
    return { st, trace };
  }

  // rotação atual (R1..R6) de um time de quadra, a partir da rotação inicial escolhida; null se não se aplica
  function currentRot(st, team) {
    const c = st.cfg.teams[team];
    return c && c.rot ? ((c.rot - 1 + st.cur.teams[team].rotN) % 6) + 1 : null;
  }
  // se o PRÓXIMO ponto de cada time encerra o set ('set') ou a partida ('match')
  function nextPointInfo(st) {
    const out = { home: null, away: null };
    if (st.phase !== 'playing') return out;
    const s = st.cur, r = rules(st.cfg, s.no);
    ['home', 'away'].forEach(t => {
      const me = s.score[t] + 1, op = s.score[other(t)];
      if (me >= r.target && me - op >= 2) out[t] = st.sets[t] + 1 >= setsToWin(st.cfg) ? 'match' : 'set';
    });
    return out;
  }

  function derive(st) { // totais por equipe a partir dos atletas
    const teams = { home: emptyStats(), away: emptyStats() };
    ['home', 'away'].forEach(t => {
      allIds(st.cfg, t).forEach(id => STAT_KEYS.forEach(k => { teams[t][k] += st.stats[id][k]; }));
    });
    return teams;
  }

  const api = { currentRot, nextPointInfo, SYSTEMS, ORDER, slotAfter, expectedRoles, autoLineup, checkLineup, allIds, courtLineup, ACTIONS, STAT_KEYS, MAX_SUBS, emptyStats, totalPoints, other, rules, setsToWin, rotate, initState, validate, apply, nextSet, replay, replayTrace, derive, serverId, onCourt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  (root.RV = root.RV || {}).Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
