# 🏐 Rodízio de Vôlei

Plataforma web para **treinar, jogar, gerenciar equipes e aprender** os sistemas táticos do vôlei de quadra e de areia, contando com um simulador visual e interativo de rodízio.

## Módulos da Plataforma

- **Modo Treino**: selecione a modalidade (quadra ou areia), sua equipe, o adversário e os atletas em quadra para registrar fundamentos em tempo real (saques, ataques, bloqueios, recepções, defesas, assistências e pontos) e controlar o placar diretamente pelos botões `+` e `−`.
- **Modo Jogo**: controle completo de partida com placar interativo (`+` e `−` por equipe), sets, acompanhamento de rodízio oficial (sem rotação no primeiro *side-out* do time que inicia recebendo), posse de saque, substituições, histórico de eventos, estatísticas individuais por atleta e opção de desfazer ações.
- **Minhas Equipes / Atletas**: cadastro e gestão de equipes (nome, modalidade e cor) e elenco (nome, número da camisa, função tática e status de titular/reserva).
- **Estatísticas e Temporadas**: histórico completo de partidas, métricas consolidadas por atleta ou equipe, comparação de desempenho entre períodos e suporte a múltiplas temporadas.
- **Tutorial e Aprendizado (`tutorial.html`)**: simulador animado e interativo para visualizar a movimentação dos jogadores na quadra em diferentes sistemas táticos.

---

## Como usar o Tutorial Interativo

Desenvolvido para ajudar iniciantes e praticantes a visualizarem **onde cada jogador se posiciona e como se movimenta** durante uma partida, sem precisar decorar tabelas estáticas.

### 1. Escolha o sistema tático
- **5-1**: 1 levantador e 5 atacantes (o mesmo levantador atua em todas as rotações).
- **4-2**: 2 levantadores e 4 atacantes (levanta quem está na rede).
- **6-2**: 2 levantadores e 4 atacantes — 2 pontas e 2 centrais (levanta quem vem do fundo; o levantador da rede atua como atacante).

### 2. Navegue pelas rotações (R1 a R6)
A **R1** representa a formação inicial. Sempre que a equipe recupera o direito de saque, todos os jogadores giram uma posição no sentido horário. Alternar entre as rotações exibe a transição na quadra.

### 3. Selecione a situação de jogo
- **Eu recebo o saque**: o adversário saca, a equipe organiza o passe, o levantador infiltra para a rede e realiza o levantamento para o ataque.
- **Eu saco**: o jogador da posição P1 executa o saque, o time se posiciona no bloqueio e defesa e realiza o contra-ataque.

### 4. Perspectiva individual ("Eu sou")
Selecione sua função em quadra (Central, Ponteiro, Oposto, Levantador ou Líbero). Seu jogador recebe um destaque visual e a interface exibe:
- sua posição exata na rotação atual;
- orientações práticas sobre o que fazer naquele momento da jogada;
- o mapa das suas posições ao longo de todas as rotações (R1 a R6).

### 5. Controles da simulação e recursos extras
- **Reprodução**: use **▶ Simular** para assistir à jogada completa, **◀ / ▶** para avançar passo a passo, os botões numerados para ir a um momento específico ou o seletor de **velocidade**.
- **Líbero**: ative ou desative a entrada automática do líbero no lugar do central quando este estiver nas posições de fundo (P5 e P6).
- **Visualização**: alterne a exibição dos rótulos de posição (P1 a P6) e acesse o quadro comparativo com **todas as 6 rotações** lado a lado.
- **Guia de regras**: resumos rápidos sobre rodízio, zonas da quadra, falta de posição (sobreposição) e regras do líbero.

### Leitura da quadra
- A quadra é exibida em vista superior, com a **rede no topo** e a linha de fundo na base.
- As laterais correspondem à visão de quem olha para a rede (**P4** à esquerda da rede, **P2** à direita).
- As zonas numéricas no piso indicam as posições **P1 a P6**, o marcador vermelho representa o adversário e a linha pontilhada ilustra a trajetória da bola.

---

## Arquitetura e Tecnologias

O projeto é construído sem dependências externas ou frameworks pesados, utilizando tecnologias web nativas para garantir carregamento instantâneo e funcionamento offline após o primeiro acesso.

- **HTML5 & CSS3**: interface responsiva baseada em CSS Grid, adaptando-se automaticamente entre telas móveis (coluna única) e desktop (quadra e painel de controle lado a lado).
- **SVG**: renderização vetorial da quadra, zonas, jogadores e trajetória da bola, garantindo nitidez em qualquer resolução.
- **JavaScript (ES6+)**: motor de regras, cálculo de rotações, gestão de estado e interpolação de animações via `requestAnimationFrame`.
- **Persistência Local**: todos os dados de equipes, partidas e estatísticas são salvos no `localStorage` do navegador, com suporte a exportação e importação de backup direto na tela inicial.

### Lógica de rotação
A ordem de deslocamento segue o ciclo `P1 → P6 → P5 → P4 → P3 → P2 → P1`. A posição de cada atleta na rotação $n$ é calculada a partir da sua posição inicial:

```javascript
const ORDER = [1, 6, 5, 4, 3, 2];
const slotAfter = (s0, rot) => ORDER[(ORDER.indexOf(s0) + rot - 1) % 6];
```

*(Para detalhes aprofundados sobre a estrutura de arquivos, motor de regras e modelos de dados, consulte `ARQUITETURA.md`.)*

---

## Como Executar e Publicar

### Localmente
Não há etapa de compilação ou instalação de pacotes. Basta clonar o repositório e abrir o arquivo `index.html` diretamente no navegador.

### Testes Automatizados
Caso tenha o Node.js instalado, você pode validar o motor de regras e a integridade dos dados executando:

```bash
node test_engine.js
node test_data.js
```

### Deploy na Vercel
1. Acesse [vercel.com](https://vercel.com) com sua conta do GitHub.
2. Clique em **Add New → Project** e selecione este repositório.
3. Mantenha os arquivos na raiz do projeto (sem comando de build) e clique em **Deploy**.

---

## Roadmap (Ideias Futuras)

- [ ] Modo quiz interativo para treinar posicionamento ("Onde fica o central na R3?")
- [ ] Variações de sistemas de recepção (ex.: recepção com 3 passadores)
- [ ] Compartilhamento de rotações ou formações específicas via URL
- [ ] Visualização com perspectiva aprimorada da quadra

## Créditos

Inspirado em demonstrações visuais de sistemas táticos de vôlei. Desenvolvido para facilitar o aprendizado de iniciantes e auxiliar jogadores e equipes no acompanhamento de treinos e partidas. 🏐
