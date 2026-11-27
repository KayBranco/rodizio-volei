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
// 1º side-out do visitante (que começou recebendo): ganha o saque SEM rodar
st=E.replay(cfg('quadra'),[act('away','atk_ok','a3')]);
eq(st.cur.score,{home:0,away:1},'ponto visitante');ok(st.cur.serving==='away','visitante saca');
eq(st.cur.teams.away.lineup,['a1','a2','a3','a4','a5','a6'],'visitante não roda no 1º saque');eq(st.cur.teams.home.lineup,['h1','h2','h3','h4','h5','h6'],'mandante não rodou');
// side-outs seguintes: ambos rodam normalmente
st=E.replay(cfg('quadra'),[act('away','atk_ok','a3'),act('home','atk_ok','h3')]);
eq(st.cur.teams.home.lineup,['h2','h3','h4','h5','h6','h1'],'mandante roda no 1º side-out após ter sacado');
st=E.replay(cfg('quadra'),[act('away','atk_ok','a3'),act('home','atk_ok','h3'),act('away','atk_ok','a3')]);
eq(st.cur.teams.away.lineup,['a2','a3','a4','a5','a6','a1'],'visitante roda a partir do 2º side-out');
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
// ---- sistemas / líbero ----
{
 const R=[{id:'lev',role:'Levantador',status:'titular',number:1},{id:'opo',role:'Oposto',status:'titular',number:2},{id:'p1',role:'Ponteiro',status:'titular',number:3},{id:'p2',role:'Ponteiro',status:'titular',number:4},{id:'c1',role:'Central',status:'titular',number:5},{id:'c2',role:'Central',status:'titular',number:6},{id:'lib',role:'Líbero',status:'reserva',number:7}];
 const role=id=>(R.find(a=>a.id===id)||{}).role;
 // 5-1 R1 = tutorial: P1 S, P2 OH1, P3 MB1, P4 OP, P5 OH2, P6 MB2
 eq(E.autoLineup('5-1',1,R,['lib']),['lev','p1','c1','opo','p2','c2'],'5-1 R1 igual ao tutorial');
 for(const sys of ['5-1','6-2','4-2','6-0'])for(let r=1;r<=6;r++){
  const R2=sys==='6-2'||sys==='4-2'?R.map(a=>a.id==='opo'?{...a,role:'Levantador'}:a):R;
  const L=E.autoLineup(sys,r,R2,['lib']);ok(new Set(L).size===6&&L.every(Boolean),sys+' R'+r+' 6 distintos');
  const ro=L.map(id=>R2.find(a=>a.id===id).role);ok(E.checkLineup(sys,r,ro).length===0,sys+' R'+r+' sem avisos');
  if(sys!=='6-0'&&sys!=='4-2'){ // diagonais: P1-P4, P2-P5, P3-P6 mesma função (5-1: lev×opo)
   [[0,3],[1,4],[2,5]].forEach(([a,b])=>{const x=ro[a],y=ro[b];ok(x===y||(sys==='5-1'&&[x,y].sort().join()==='Levantador,Oposto'),sys+' R'+r+' diagonal '+a+'-'+b);});
  }
 }
 // rotação do engine reproduz autoLineup da rotação seguinte
 const cfgQ={modality:'quadra',mode:'jogo',firstServe:'home',teams:{home:{lineup:E.autoLineup('5-1',1,R,['lib']),bench:[],libero:'lib',centrals:['c1','c2']},away:{lineup:['a1','a2','a3','a4','a5','a6'],bench:[]}}};
 let stx=E.replay(cfgQ,[]);let cnt=0;
 for(let r=2;r<=6;r++){E.apply(stx,{id:'x'+r,type:'action',team:'away',action:'point'});E.apply(stx,{id:'y'+r,type:'action',team:'home',action:'point'});
   // visitante marca (saca), mandante recupera -> gira 1x
   eq(stx.cur.teams.home.lineup.map(role),E.autoLineup('5-1',r,R,['lib']).map(role),'engine gira = funções da rotação '+r);}
 // quando o time começa recebendo (firstServe:'away'), o 1º side-out mantém R1 e os seguintes giram R2..R6
 const cfgQRec={modality:'quadra',mode:'jogo',firstServe:'away',teams:{home:{lineup:E.autoLineup('5-1',1,R,['lib']),bench:[],libero:'lib',centrals:['c1','c2']},away:{lineup:['a1','a2','a3','a4','a5','a6'],bench:[]}}};
 let stRec=E.replay(cfgQRec,[]);
 E.apply(stRec,{id:'r1',type:'action',team:'home',action:'point'});
 eq(stRec.cur.teams.home.lineup.map(role),E.autoLineup('5-1',1,R,['lib']).map(role),'time que começa recebendo mantém R1 no 1º ponto');
 for(let r=2;r<=6;r++){E.apply(stRec,{id:'ra'+r,type:'action',team:'away',action:'point'});E.apply(stRec,{id:'rh'+r,type:'action',team:'home',action:'point'});
   eq(stRec.cur.teams.home.lineup.map(role),E.autoLineup('5-1',r,R,['lib']).map(role),'time que começa recebendo gira para R'+r+' nos side-outs seguintes');}
 // 4-2: levantadores em diagonal
 for(let r=1;r<=6;r++){const R4=R.map(a=>a.id==='opo'?{...a,role:'Levantador'}:a);const ro=E.autoLineup('4-2',r,R4,['lib']).map(id=>R4.find(a=>a.id===id).role);ok(ro.map((x,i)=>x==='Levantador'?i:-1).filter(i=>i>=0).sort().join()==='0,3'||ro.map((x,i)=>x==='Levantador'?i:-1).filter(i=>i>=0).sort((a,b)=>a-b).reduce((d,x,_,arr)=>Math.abs(arr[1]-arr[0])===3,false),'4-2 levantadores em diagonal R'+r);}
 // líbero: em P5/P6 substitui central, e nunca fica ao lado do outro central; só 1 líbero por vez
 for(let r=1;r<=6;r++){const s2=E.replay({...cfgQ,teams:{...cfgQ.teams,home:{...cfgQ.teams.home,lineup:E.autoLineup('5-1',r,R,['lib'])}}},[]);
  const cl=E.courtLineup(s2,'home');ok(cl.filter(x=>x==='lib').length<=1,'1 líbero no máx R'+r);
  const li=cl.indexOf('lib');if(li>=0){ok(li===4||li===5,'líbero só em P5/P6 R'+r);const other=s2.cur.teams.home.lineup[(li+3)%6];ok(other==='c1'||other==='c2','central em diagonal do líbero R'+r);}
  ok(cl[0]!=='lib','líbero nunca saca R'+r);}
 // líbero pode registrar ação; central substituído não
 const s3=E.replay({...cfgQ,teams:{...cfgQ.teams,home:{...cfgQ.teams.home,lineup:E.autoLineup('5-1',1,R,['lib'])}}},[{id:1,type:'action',team:'home',action:'dig',athleteId:'lib'},{id:2,type:'action',team:'home',action:'dig',athleteId:'c2'}]);
 eq(s3.stats.lib.digs,1,'líbero registra defesa');ok(s3.errors.length===1,'central substituído não age');
}
console.log(n+' verificações (com sistemas)',process.exitCode?'COM FALHAS':'OK');
// ---- rotação atual e ponto de set/jogo ----
{
 const c=cfg('quadra');c.teams.home.rot=3;c.teams.away.rot=1;let st=E.replay(c,[]);
 eq(E.currentRot(st,'home'),3,'rotação inicial R3');
 for(let i=0;i<4;i++){E.apply(st,act('away','point'));E.apply(st,act('home','point'));}
 eq(E.currentRot(st,'home'),((3-1+4)%6)+1,'R3 + 4 giros = R1');
 eq(E.currentRot(E.replay(cfg('areia'),[]),'home'),null,'areia sem rotação');
 let ev2=[];for(let i=0;i<24;i++)ev2.push(act('home','point'));
 st=E.replay(cfg('quadra'),ev2);eq(E.nextPointInfo(st),{home:'set',away:null},'ponto de set 24-0');
 ev2=[];for(let i=0;i<24;i++){ev2.push(act('home','point'));ev2.push(act('away','point'));}
 eq(E.nextPointInfo(E.replay(cfg('quadra'),ev2)),{home:null,away:null},'24-24 não é ponto de set');
 ev2=[];for(let s=0;s<2;s++){for(let i=0;i<25;i++)ev2.push(act('home','point'));ev2.push({id:++id,type:'nextSet'});}for(let i=0;i<24;i++)ev2.push(act('home','point'));
 eq(E.nextPointInfo(E.replay(cfg('quadra'),ev2)).home,'match','ponto de jogo 2x0 e 24-0');
}
console.log(n+' verificações (rot/ponto de set)',process.exitCode?'COM FALHAS':'OK');
