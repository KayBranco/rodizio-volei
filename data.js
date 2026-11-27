/* data.js — constantes e armazenamento local (localStorage), organizado em coleções normalizadas
 * para migrar depois a um banco (cada coleção vira uma tabela; ids são strings estáveis).
 * Coleções: teams, athletes, seasons, matches. Partidas guardam um "snapshot" dos atletas/times,
 * então o histórico continua correto mesmo que o atleta seja editado ou excluído depois.
 */
(function (root) {
  'use strict';
  const RV = (root.RV = root.RV || {});
  const KEY = 'rv2:db', VERSION = 1;

  const ROLES = ['Levantador', 'Oposto', 'Ponteiro', 'Central', 'Líbero', 'Universal'];
  const ROLE_ABB = { Levantador: 'LEV', Oposto: 'OPO', Ponteiro: 'PON', Central: 'CEN', Líbero: 'LIB', Universal: 'UNI' };
  const STATUS = ['titular', 'reserva'];
  const MODALITIES = { quadra: 'Vôlei de quadra', areia: 'Vôlei de areia' };
  const SIZE = { quadra: 6, areia: 2 };
  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

  const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const empty = () => ({ v: VERSION, teams: [], athletes: [], seasons: [], matches: [], settings: { activeSeason: null } });
  let db = null, mem = false;

  function normalize(d) { // tolera dados antigos/incompletos
    const o = empty();
    if (!d || typeof d !== 'object') return o;
    ['teams', 'athletes', 'seasons', 'matches'].forEach(k => { if (Array.isArray(d[k])) o[k] = d[k]; });
    if (d.settings && typeof d.settings === 'object') o.settings = Object.assign(o.settings, d.settings);
    return o;
  }
  function load() {
    try { db = normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { db = empty(); mem = true; }
    if (!db.seasons.length) {
      const s = { id: uid('s'), name: 'Temporada ' + new Date().getFullYear(), createdAt: Date.now() };
      db.seasons.push(s); db.settings.activeSeason = s.id; save();
    }
    if (!db.seasons.some(s => s.id === db.settings.activeSeason)) db.settings.activeSeason = db.seasons[0].id;
    return db;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); mem = false; return true; }
    catch (e) { mem = true; return false; }
  }
  const D = () => db || load();

  const find = (col, id) => D()[col].find(x => x.id === id) || null;
  const remove = (col, id) => { D()[col] = D()[col].filter(x => x.id !== id); save(); };

  // ---- equipes ----
  function saveTeam(t) {
    const d = D();
    if (!t.name || !t.name.trim()) return 'Dê um nome à equipe.';
    if (!MODALITIES[t.modality]) return 'Escolha a modalidade.';
    if (d.teams.some(x => x.id !== t.id && x.modality === t.modality && x.name.trim().toLowerCase() === t.name.trim().toLowerCase())) return 'Já existe uma equipe com esse nome nessa modalidade.';
    t.name = t.name.trim();
    if (!t.id) { t.id = uid('t'); t.createdAt = Date.now(); d.teams.push(t); }
    else Object.assign(find('teams', t.id), t);
    save(); return null;
  }
  function deleteTeam(id) {
    const d = D(); d.athletes = d.athletes.filter(a => a.teamId !== id); remove('teams', id);
  }
  // ---- atletas ----
  function saveAthlete(a) {
    const d = D(), team = find('teams', a.teamId);
    if (!team) return 'Equipe inválida.';
    if (!a.name || !a.name.trim()) return 'Dê um nome ao atleta.';
    const num = Number(a.number);
    if (!Number.isInteger(num) || num < 0 || num > 99) return 'Número da camisa: de 0 a 99.';
    if (!ROLES.includes(a.role)) return 'Escolha a função tática.';
    if (!STATUS.includes(a.status)) a.status = 'reserva';
    if (d.athletes.some(x => x.id !== a.id && x.teamId === a.teamId && Number(x.number) === num)) return 'Já existe o número ' + num + ' nessa equipe.';
    a.name = a.name.trim(); a.number = num;
    if (!a.id) { a.id = uid('a'); a.createdAt = Date.now(); d.athletes.push(a); }
    else Object.assign(find('athletes', a.id), a);
    save(); return null;
  }
  const teamAthletes = tid => D().athletes.filter(a => a.teamId === tid).sort((x, y) => x.number - y.number);

  // ---- temporadas ----
  function saveSeason(s) {
    const d = D();
    if (!s.name || !s.name.trim()) return 'Dê um nome à temporada.';
    if (d.seasons.some(x => x.id !== s.id && x.name.toLowerCase() === s.name.trim().toLowerCase())) return 'Já existe uma temporada com esse nome.';
    s.name = s.name.trim();
    if (!s.id) { s.id = uid('s'); s.createdAt = Date.now(); d.seasons.push(s); }
    else Object.assign(find('seasons', s.id), s);
    save(); return null;
  }
  function deleteSeason(id) {
    const d = D();
    if (d.seasons.length <= 1) return 'É preciso manter pelo menos uma temporada.';
    if (d.matches.some(m => m.seasonId === id)) return 'Essa temporada tem partidas/treinos. Mova ou exclua-os antes.';
    remove('seasons', id);
    if (d.settings.activeSeason === id) d.settings.activeSeason = d.seasons[0].id;
    save(); return null;
  }
  const setActiveSeason = id => { D().settings.activeSeason = id; save(); };
  const activeSeason = () => find('seasons', D().settings.activeSeason);

  // ---- partidas / treinos ----
  function createMatch(m) { // m: {mode, modality, seasonId, cfg, snapshot}
    const rec = Object.assign({ id: uid('m'), date: Date.now(), events: [], finished: false, source: 'manual' }, m);
    D().matches.push(rec); save(); return rec;
  }
  const saveMatch = () => save();
  const liveMatch = () => D().matches.find(m => !m.finished) || null;

  // ---- backup ----
  const exportJSON = () => JSON.stringify(D(), null, 1);
  function importJSON(text) {
    let o; try { o = JSON.parse(text); } catch (e) { return 'Arquivo inválido (não é JSON).'; }
    if (!o || typeof o !== 'object' || !Array.isArray(o.teams) || !Array.isArray(o.matches)) return 'Arquivo não é um backup do Rodízio.';
    db = normalize(o); load2(); return null;
  }
  function load2() { if (!db.seasons.length) { db.seasons.push({ id: uid('s'), name: 'Temporada ' + new Date().getFullYear(), createdAt: Date.now() }); } if (!db.seasons.some(s => s.id === db.settings.activeSeason)) db.settings.activeSeason = db.seasons[0].id; save(); }
  function wipe() { db = empty(); load2(); }

  RV.Data = { ROLES, ROLE_ABB, STATUS, MODALITIES, SIZE, COLORS, uid, load, save, D, find, remove, saveTeam, deleteTeam, saveAthlete, teamAthletes, saveSeason, deleteSeason, setActiveSeason, activeSeason, createMatch, saveMatch, liveMatch, exportJSON, importJSON, wipe, isMemoryOnly: () => mem };
  if (typeof module !== 'undefined' && module.exports) module.exports = RV.Data;
})(typeof window !== 'undefined' ? window : globalThis);
