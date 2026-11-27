# Arquitetura — Rodízio de Vôlei v2

Site estático (HTML + CSS + JS puro, sem build). Abre com duplo clique em `index.html` e funciona igual na Vercel.

## Arquivos
| Arquivo | Papel |
|---|---|
| `index.html` | Casca do app: Home + telas (roteador por hash `#/...`) |
| `tutorial.html` | Tutorial animado de rodízio (5-1, 4-2, 6-2 e areia), com botão "← Home" |
| `styles.css` | Tema e componentes |
| `engine.js` | **Regras do vôlei, sem tela**: rodízio, saque, sets, substituições, estatísticas |
| `data.js` | Armazenamento local (localStorage `rv2:db`), CRUD, backup |
| `court.js` | Quadra vista de cima com os dois times |
| `ui.js` | Helpers de DOM, modais, toasts, ícones |
| `teams.js` | Equipes e Atletas |
| `match.js` | Configuração e tela ao vivo (Treino e Jogo) |
| `stats.js` | Resumo, histórico, estatísticas, comparação, temporadas |
| `app.js` | Roteador e Home |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Modo offline e instalação na tela inicial (só funciona servido por http/https, como na Vercel) |
| `test_engine.js`, `test_data.js` | Testes em Node: `node test_engine.js` |

## Ideia central: partida = lista de eventos
O placar, o saque, o rodízio, os sets e as estatísticas **não são guardados**: são recalculados por `Engine.replay(cfg, events)`.
Desfazer = remover o último evento. O histórico por evento e o placar a cada lance saem do mesmo replay.

Evento: `{ id, type:'action'|'sub'|'nextSet', team, athleteId, action, in, out, ts, source:'manual', videoTime:null, confidence:null }`

## Regras implementadas (engine.js)
- Quadra: P1 saca. Saque ganha o rally → pontua e **não gira**. Recepção ganha → pontua e assume o saque; no **1º side-out** do time que começou recebendo no set, ele assume o saque **sem girar** (mantendo a formação inicial R1), e nos side-outs seguintes **gira um posto horário** (P2→P1→P6→P5→P4→P3→P2).
- Sets: 25 (5º set 15), diferença de 2, melhor de 5. Saque inicial alterna a cada set. Substituição só em quadra, máx. 6 por set (jogo); livre no treino.
- Areia: 2 atletas, sem substituições e sem rodízio. Saque alterna entre os dois a cada recuperação de saque. Sets 21/21/15, diferença de 2, melhor de 3. Aviso de troca de lado a cada 7 pontos (5 no 3º set).
- Ações e pontos: ace, ataque+ , bloqueio e ponto → pontuam para o atleta; erro de saque/ataque/recepção → ponto do adversário. Saque só do sacador atual; recepção só de quem recebe; atleta precisa estar em quadra.
- Sistemas (5-1, 6-2, 4-2, 6-0) com escalação automática pela mesma regra do tutorial, para qualquer rotação inicial R1–R6, por equipe. Diagonais: P1–P4, P2–P5, P3–P6 (levantador × oposto/2º levantador, ponteiro × ponteiro, central × central). Há aviso (não bloqueia) quando a escalação escolhida foge do sistema.
- Líbero real: entra no lugar do central que estiver em P5/P6 (um por vez), nunca saca (P1), fica sempre em diagonal com o outro central e não conta como substituição. Não existe no 4-2.
- Adversário opcional no Jogo: pode ser "sem cadastro" (só nome, placar, saque e rodízio); não gera estatísticas próprias. O Treino exige 2 equipes cadastradas.
- Função tática (Oposto, Central…) é separada da posição de rodízio (P1–P6).

## Dados (data.js)
Coleções: `teams`, `athletes`, `seasons`, `matches`, `settings`. Ids em string estáveis, versão do esquema (`v`).
Cada partida guarda um **snapshot** de times/atletas, então o histórico não quebra se alguém for editado ou excluído.
Para migrar a um banco: cada coleção vira uma tabela; `matches.events` vira tabela de eventos.

## Preparado para câmera/visão computacional (não implementado)
Os eventos já têm `source`, `videoTime` e `confidence`. Um módulo futuro de visão só precisa gerar eventos no mesmo formato
(com `source:'vision'`), que passam pela mesma validação e replay. Nada de detecção foi simulado.

## Pensado para usar no jogo (celular)
- Placar fixo no topo ao rolar; rotação atual (ex.: 5-1 · R3) de cada time; aviso "PONTO DE SET / PONTO DE JOGO".
- Tela não apaga durante a partida (Wake Lock, quando o navegador permite); vibração curta ao registrar.
- No jogo o atleta é desmarcado após registrar (no treino, continua marcado); dá para mudar na própria folha de ações.
- "Repetir a última configuração" (equipes, escalação, funções) e "Compartilhar resumo" (texto pronto para WhatsApp).
- Funciona offline depois do primeiro acesso (service worker, rede primeiro para sempre pegar a versão nova).
