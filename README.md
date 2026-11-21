# 🏐 Rodízio de Vôlei

Um site para **aprender o rodízio do vôlei** vendo os jogadores se movimentarem na quadra: recebendo o saque, defendendo, levantando e atacando. Feito para iniciantes, e funciona no celular e no computador.

## Para quem é

Para quem está começando no vôlei e quer entender **onde cada jogador fica em cada rotação** nos sistemas 5-1, 4-2 e 6-2. Em vez de decorar uma tabela, você vê a movimentação acontecendo.

---

## Como usar

### 1. Escolha o sistema
- **5-1**: 1 levantador e 5 atacantes. O mesmo levantador levanta o jogo todo.
- **4-2**: 2 levantadores e 4 atacantes. Levanta quem está na rede.
- **6-2**: 2 levantadores e 4 atacantes (2 pontas e 2 centrais). Levanta quem está no fundo; o da rede vira atacante.

### 2. Escolha a rotação (R1 a R6)
A R1 é a rotação inicial. Cada vez que o seu time ganha o saque, todos giram uma posição no sentido horário. Trocar de rotação mostra os jogadores girando na quadra.

### 3. Escolha a situação
- **Eu recebo o saque**: o adversário saca, o time faz a recepção, o levantador corre para a rede e a bola é levantada para um atacante.
- **Eu saco**: quem está em P1 saca, o time bloqueia e defende, e depois faz o contra-ataque.

### 4. Escolha quem você é
Toque em **Eu sou** e escolha sua função (Central 1, Ponteiro, Oposto, Levantador, Líbero...). O seu jogador fica destacado com um anel dourado e o site mostra:
- em que posição você está na rotação atual;
- uma dica do que fazer naquele momento;
- as suas posições em todas as rotações (R1 a R6).

### 5. Veja a animação
- **▶ Simular** roda todos os passos em sequência.
- **◀ e ▶** avançam ou voltam um passo.
- Os botões numerados abaixo da quadra levam direto a um passo.
- O controle de **velocidade** deixa a animação mais lenta ou mais rápida.

### Outros recursos
- **Líbero**: pode ser ligado ou desligado. Ele entra no lugar do central quando o central está no fundo (P6 e P5).
- **Mostrar posições**: liga ou desliga os rótulos P1 a P6 nos jogadores.
- **Todas as rotações**: quadro com as 6 rotações lado a lado. Toque numa delas para ir até ela.
- **Regrinhas para iniciantes**: explicações curtas sobre rodízio, posições, sobreposição e líbero.

### Como ler a quadra
- A quadra é vista de cima, com a **rede no alto** e a linha de fundo embaixo.
- Esquerda e direita são as de quem joga olhando para a rede: P4 à esquerda na rede, P2 à direita na rede.
- Os números de fundo mostram as zonas P1 a P6.
- O jogador vermelho é o adversário (sacador ou atacante).
- A bola tem uma sombra para dar noção de altura, e uma linha pontilhada marca o caminho de cada passe.

---

## Como foi feito

O projeto é **um único arquivo** (`index.html`) com HTML, CSS e JavaScript puro. Não usa framework, não precisa instalar nada e não depende de internet depois de carregado.

### Tecnologias
- **HTML + CSS**: layout responsivo com CSS Grid. No celular tudo fica em uma coluna; no computador, a quadra fica de um lado e os controles do outro.
- **SVG**: a quadra, os jogadores e a bola são desenhados em SVG, que escala bem em qualquer tela.
- **JavaScript**: toda a lógica de rotação e as animações.

### A lógica do rodízio
Cada jogador começa em uma posição inicial. A ordem de rotação é P1 → P6 → P5 → P4 → P3 → P2 → P1, e a posição de um jogador na rotação *n* é calculada deslocando-o *n − 1* casas nessa ordem:

```js
const ORDER = [1, 6, 5, 4, 3, 2];
const slotAfter = (s0, rot) => ORDER[(ORDER.indexOf(s0) + rot - 1) % 6];
```

Cada sistema tem a sua lista de jogadores e a sua formação inicial. Quem levanta é definido assim:
- **5-1**: sempre o mesmo levantador.
- **6-2**: o levantador que está no fundo.
- **4-2**: o levantador que está na rede.

O líbero entra no lugar do central quando ele está em P6 ou P5.

### Formações
Cada momento do jogo tem coordenadas (em metros) para cada posição da quadra:
- posição de rotação;
- recepção (o levantador "se esconde" perto da rede);
- saque;
- defesa;
- ataque (levantador na rede, ponteiro à esquerda, central no meio, oposto à direita, o resto cobrindo).

As posições seguem a regra de sobreposição para a recepção, mas são **exemplos comuns**: cada técnico pode adaptar.

### Animação
- Os jogadores se movem com interpolação suave (`requestAnimationFrame`) e um pequeno balanço para parecer que estão correndo.
- A bola segue uma trajetória em arco, com sombra no chão para dar a ideia de altura.
- Cada passo da simulação cancela o anterior, então dá para clicar à vontade sem travar.

### Estrutura do código
O JavaScript está dividido em blocos:
1. **Dados**: sistemas, jogadores, cores e formações.
2. **Lógica**: cálculo de rotação, levantador ativo e quem recebe a bola.
3. **Desenho (SVG)**: quadra, jogadores e bola.
4. **Animação**: movimentação dos jogadores e da bola.
5. **Interface**: botões, textos e quadro de rotações.

---

## Como rodar

Abra o `index.html` no navegador. Não precisa instalar nada.

## Ideias para o futuro

- Vista 3D com perspectiva e personagens mais realistas
- Formações de recepção com 3 passadores e outras variações
- Modo treino com perguntas ("onde fica o central na R3?")
- Compartilhar uma rotação específica por link

## Créditos

Inspirado em uma demonstração de rodízio de vôlei animado vista nas redes sociais. Projeto criado para estudar e ensinar vôlei para iniciantes. 🏐
