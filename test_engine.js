const E=require('./engine.js');let n=0;
const ok=(c,m)=>{n++;if(!c){console.log('FALHOU:',m);process.exitCode=1;}};
const eq=(a,b,m)=>ok(JSON.stringify(a)===JSON.stringify(b),m+' got '+JSON.stringify(a)+' want '+JSON.stringify(b));
const cfg=(mod,mode='jogo',first='home')=>mod==='areia'?{modality:'areia',mode,firstServe:first,teams:{home:{lineup:['h1','h2'],bench:[]},away:{lineup:['a1','a2'],bench:[]}}}
:{modality:'quadra',mode,firstServe:first,teams:{home:{lineup:['h1','h2','h3','h4','h5','h6'],bench:['h7','h8']},away:{lineup:['a1','a2','a3','a4','a5','a6'],bench:['a7']}}};
let id=0;const act=(team,action,athleteId)=>({id:++id,type:'action',team,action,athleteId,source:'manual'});
// rodízio
eq(E.rotate([1,2,3,4,5,6]),[2,3,4,5,6,1],'rotate');
let l=[1,2,3,4,5,6];for(let i=0;i<6;i++)l=E.rotate(l);eq(l,[1,2,3,4,5,6],'6 rodizios = identidade');
// jogador em P2 vai para P1
ok(E.rotate([1,2,3,4,5,6])[0]===2,'P2->P1');ok(E.rotate([1,2,3,4,5,6])[5]===1,'P1->P6');
// saque mantém sem rodar
let st=E.replay(cfg('quadra'),[act('home','ace','h1')]);
eq(st.cur.score,{home:1,away:0},'ace pontua');eq(st.cur.teams.home.lineup[0],'h1','sacador pontua e não roda');ok(st.cur.serving==='home','mantém saque');
// side-out: visitante ganha, roda e saca
st=E.replay(cfg('quadra'),[act('away','atk_ok','a3')]);
eq(st.cur.score,{home:0,away:1},'ponto visitante');ok(st.cur.serving==='away','visitante saca');
eq(st.cur.teams.away.lineup,['a2','a3','a4','a5','a6','a1'],'visitante rodou');eq(st.cur.teams.home.lineup,['h1','h2','h3','h4','h5','h6'],'mandante não rodou');
// erro de saque -> ponto do adversário e side-out
st=E.replay(cfg('quadra'),[act('home','serve_err','h1')]);
eq(st.cur.score,{home:0,away:1},'erro saque');ok(st.cur.serving==='away','troca saque');
// validações
st=E.replay(cfg('quadra'),[act('away','ace','a1')]);ok(st.errors.length===1,'receptor não saca');
st=E.replay(cfg('quadra'),[act('home','ace','h2')]);ok(st.errors.length===1,'só P1 saca');
st=E.replay(cfg('quadra'),[act('home','rec_ok','h2')]);ok(st.errors.length===1,'sacador não recebe');
st=E.replay(cfg('quadra'),[act('home','dig','h7')]);ok(st.errors.length===1,'banco não age');
// substituição
st=E.replay(cfg('quadra'),[{id:99,type:'sub',team:'home',out:'h3',in:'h7'}]);
eq(st.cur.teams.home.lineup[2],'h7','sub entra na posição');ok(st.cur.teams.home.bench.includes('h3'),'sai vai ao banco');
st=E.replay(cfg('areia'),[{id:99,type:'sub',team:'home',out:'h1',in:'h2'}]);ok(st.errors.length===1,'areia sem sub');
// set: 25-23 não, 25-24 não, 26-24 sim
let ev=[];for(let i=0;i<24;i++){ev.push(act('home','point'));ev.push(act('away','point'));}
st=E.replay(cfg('quadra'),ev);eq(st.cur.score,{home:24,away:24},'24x24');ok(st.phase==='playing','sem fim');
st=E.replay(cfg('quadra'),ev.concat([act('home','point')]));ok(st.phase==='playing','25x24 continua');
st=E.replay(cfg('quadra'),ev.concat([act('home','point'),act('home','point')]));ok(st.phase==='setEnd'&&st.sets.home===1,'26x24 fim do set');
// bloqueado após fim
st.errors.length=0;E.apply(st,act('home','point'));ok(st.errors.length===1,'bloqueia após fim do set');
E.nextSet(st);ok(st.cur.no===2&&st.cur.serving==='away','set 2, saque alterna');eq(st.cur.score,{home:0,away:0},'zera');
// partida completa 3x0
ev=[];for(let s=0;s<3;s++){for(let i=0;i<25;i++)ev.push(act('home','point'));if(s<2)ev.push({id:++id,type:'nextSet'});}
st=E.replay(cfg('quadra'),ev);ok(st.phase==='over'&&st.winner==='home'&&st.done.length===3,'3x0 termina');
// set 5 vai a 15
ev=[];const win=(t,k)=>{for(let i=0;i<k;i++)ev.push(act(t,'point'));};
for(let s=1;s<=4;s++){win(s%2?'home':'away',25);ev.push({id:++id,type:'nextSet'});}
win('home',15);st=E.replay(cfg('quadra'),ev);ok(st.phase==='over'&&st.done[4].home===15,'set 5 até 15');
// quando alert de troca de lado no set 5 em 8
ev=ev.slice(0,ev.findIndex((e,i)=>false)+0);
// areia
let c=cfg('areia');st=E.replay(c,[]);ok(E.serverId(st,'home')==='h1','areia: h1 saca');
st=E.replay(c,[act('home','ace','h1')]);ok(E.serverId(st,'home')==='h1','areia: quem pontua segue sacando');
st=E.replay(c,[act('away','atk_ok','a1')]);ok(E.serverId(st,'away')==='a1','areia: a1 saca ao ganhar o saque');
st=E.replay(c,[act('away','atk_ok','a1'),act('home','atk_ok','h2')]);ok(E.serverId(st,'home')==='h2','areia: h2 saca na vez seguinte');
st=E.replay(c,[act('away','atk_ok','a1'),act('home','atk_ok','h2'),act('away','atk_ok','a2')]);ok(E.serverId(st,'away')==='a2','areia: a2 alterna');
eq(st.cur.teams.home.lineup,['h1','h2'],'areia não rotaciona');
// areia: set 21 e troca de lado a cada 7
ev=[];for(let i=0;i<7;i++)ev.push(act('home','point'));st=E.replay(c,ev);ok(st.cur.switchAlert,'troca de lado aos 7');
ev=[];for(let i=0;i<21;i++)ev.push(act('home','point'));st=E.replay(c,ev);ok(st.phase==='setEnd','areia 21');
ev=[];for(let s=0;s<2;s++){for(let i=0;i<21;i++)ev.push(act('home','point'));if(!s)ev.push({id:++id,type:'nextSet'});}
st=E.replay(c,ev);ok(st.phase==='over','areia 2x0 encerra');
// areia 3o set vai a 15, troca a cada 5
ev=[];win('home',21);ev.push({id:++id,type:'nextSet'});win('away',21);ev.push({id:++id,type:'nextSet'});win('home',5);
st=E.replay(c,ev);ok(st.cur.no===3&&st.cur.switchAlert,'set 3 troca aos 5');win('home',10);
ev=[];win('home',21);ev.push({id:++id,type:'nextSet'});win('away',21);ev.push({id:++id,type:'nextSet'});win('home',15);
st=E.replay(c,ev);ok(st.phase==='over','areia set 3 a 15');
// treino nunca termina
ev=[];win('home',40);st=E.replay(cfg('quadra','treino'),ev);ok(st.phase==='treino'&&st.cur.score.home===40,'treino sem fim');
// estatísticas
st=E.replay(cfg('quadra'),[act('home','ace','h1'),act('home','serve_ok','h1'),act('home','serve_err','h1'),act('away','atk_ok','a4')]);
eq(st.stats.h1.aces,1,'ace');eq(st.stats.h1.serveErr,1,'erro saque');eq(E.totalPoints(st.stats.h1),1,'pontos atleta');eq(E.derive(st).away.atkOk,1,'total equipe');
// undo = replay sem último
const evs=[act('home','ace','h1'),act('away','atk_ok','a3')];
eq(E.replay(cfg('quadra'),evs.slice(0,1)).cur.score,{home:1,away:0},'undo');
// replay determinístico
eq(E.replay(cfg('quadra'),evs).cur,E.replay(cfg('quadra'),evs).cur,'determinístico');
console.log(n+' verificações',process.exitCode?'COM FALHAS':'OK');
