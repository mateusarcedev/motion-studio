# STORYBOARD v2 — Explainer Motion: Máquinas de Estados em Programação

**Projeto:** `explainer-state-machine` (Revisão 15.1)  
**Formato:** 1080 × 1920 (9:16 Vertical) | Duração: 60.0s (1800 frames a 30 FPS CFR)  

---

## Cena 01 — O Caos da Sopa Booleana & Colapso
* **Tempo:** `00.0s – 08.0s` | **Quadros:** `F0000 – F0239` (240 frames)
* **Enquadramento:** Câmera 1.0x centralizada.
* **Ação Visual:**
  * Início cinematográfico com a pergunta provocativa: *"Quantos estados seu app tem?"*.
  * As 4 flags booleanas (`isLoading`, `isError`, `isSuccess`, `isEmpty`) entram em cascata com tags de código.
  * Em $t = 3.5s$ (`F105`), linhas de força conectam as variáveis e as projetam em uma matriz volumétrica de $2^4 = 16$ combinações possíveis.
  * Em $t = 5.2s$ (`F156`), o bug crítico explode: `isLoading: true` e `isSuccess: true` colidem com uma onda de choque vermelha coral: *"ESTADO IMPOSSÍVEL: SPINNER E SUCESSO SIMULTÂNEOS"*.
* **Morfismo de Transição (F215–F239):**
  * As 16 caixas da matriz sofrem atração gravitacional centrípeta, colapsando e fundindo-se organicamente para gerar os nós do grafo formal na cena seguinte!

---

## Cena 02 — O Grafo Discreto & Domínio Finito
* **Tempo:** `08.0s – 16.0s` | **Quadros:** `F0240 – F0479` (240 frames)
* **Enquadramento:** Câmera recua suavemente para estabelecer o espaço (`zoom: 1.02 -> 1.0`).
* **Ação Visual:**
  * Do colapso da matriz emergem 3 nós circulares em escala monumental: `[IDLE]`, `[FETCHING]`, `[RESOLVED]`.
  * Rótulo editorial minimalista: **Estados Discretos** // *Apenas um nó ativo por vez.*
  * O nó `[IDLE]` absorve o núcleo de energia e acende com pulso de respiração ciano, duplo anel orbital e partículas de prontidão.
  * Os nós `[FETCHING]` e `[RESOLVED]` descansam em repouso elegante com transparência cinza-ardósia (`#334155`).
  * Telemetria contextual mínima ao lado do nó: `ESTADO ATIVO: IDLE · ESTADOS IMPOSSÍVEIS: 0`.
* **Transição (F460–F479):**
  * O arco que liga `IDLE` a `FETCHING` acende com energia âmbar, enquanto a câmera se desloca e aproxima do vetor.

---

## Cena 03 — A Transição: Vetor e Impacto Físico (Macro Zoom)
* **Tempo:** `16.0s – 25.0s` | **Quadros:** `F0480 – F0749` (270 frames)
* **Enquadramento:** **Câmera 2D com Macro Zoom (1.22x)** centrado no arco de transição.
* **Ação Visual:**
  * O badge de evento `⚡ EVENT: FETCH` cai como um carimbo dinâmico sobre a conexão.
  * Uma cápsula de dados com cauda luminescente de velocidade (*squash & stretch*) dispara de `IDLE` e viaja ao longo da curva cúbica.
  * `IDLE` desliga seu anel orbital com suavidade amortecida.
  * Ao atingir `[FETCHING]` em $t = 20.8s$, o nó absorve o impacto com uma mola elástica pronunciada (*spring rebound* 1.0 ➔ 1.28 ➔ 0.95 ➔ 1.0) e seu anel entra em rotação contínua de processamento.
* **Transição (F730–F749):**
  * A câmera desliza lateralmente acompanhando o fluxo descendente em direção ao portal de validação.

---

## Cena 04 — Guardas Lógicas: O Portal de Validação Condicional
* **Tempo:** `25.0s – 34.0s` | **Quadros:** `F0750 – F1019` (270 frames)
* **Enquadramento:** Câmera 1.15x focada no portal de validação.
* **Ação Visual:**
  * Entre `[FETCHING]` e `[RESOLVED]`, surge um portal geométrico em losango com blindagem mecânica: `guard: hasValidData()`.
  * **Tentativa 1 (F780–F850):** O dado tenta cruzar com `hasValidData() === false`. As travas mecânicas se fecham, o portal emite uma barreira de onda coral (`#FF4757`) que repele o dado com recuo físico. Badge contextual: `BLOQUEADO: DADOS INVÁLIDOS`.
  * **Tentativa 2 (F880–F970):** O dado retorna corrigido (`hasValidData() === true`). O sensor central brilha em menta fluorescente (`#15F5BA`), os feixes do portal se abrem em $90^\circ$ e o dado acelera através do portal para o destino com trilha de luz desimpedida.
* **Transição (F995–F1019):**
  * O nó `[RESOLVED]` recebe a carga e acende em menta de sucesso; a câmera reajusta para testar a robustez do sistema.

---

## Cena 05 — Evento Inválido & Deflexão Protetora
* **Tempo:** `34.0s – 43.0s` | **Quadros:** `F1020 – F1289` (270 frames)
* **Enquadramento:** Foco no nó ativo `[RESOLVED]`.
* **Ação Visual:**
  * O sistema está legitimamente estável em `[RESOLVED]`.
  * Um evento errático disparado pela interface tenta forçar uma transição ilícita: `⚡ ILEGAL: FETCH` (recarregar sem reset).
  * O evento atinge a borda do nó ativo como um feixe de choque.
  * **Deflexão Física e Mola:** A carcaça exterior do nó forma uma blindagem magnética que ricocheteia o projétil para fora, sofrendo um recuo harmônico amortecido (*damped kickback* de 18px que dissipa em 0.6s).
  * O nó **permanece intacto e inalterado**. Texto explicativo integrado:  
    *"Transição não declarada: rejeitada por construção."* (Corrigindo afirmações genéricas).
* **Transição (F1265–F1289):**
  * A câmera recua suavemente em plano geral enquanto o quarto nó `[ERROR]` se conecta organicamente para demonstrar a resiliência assíncrona.

---

## Cena 06 — Ciclo Assíncrono Completo & Resiliente
* **Tempo:** `43.0s – 52.0s` | **Quadros:** `F1290 – F1559` (270 frames)
* **Enquadramento:** **Plano Geral Monumental (0.95x)** exibindo os 4 nós conectados.
* **Ação Visual (Correção Técnica do Fluxo):**
  * Demonstração precisa do ciclo assíncrono moderno:
    1. $t = 44.0s$: `IDLE` $\xrightarrow{\text{FETCH}}$ `FETCHING`
    2. $t = 46.0s$: Falha de rede simula `REJECT` $\xrightarrow{}$ nó `[ERROR]` acende em coral com alerta.
    3. $t = 48.0s$: Evento do usuário `RETRY` $\xrightarrow{}$ partícula de recuperação retorna a `[FETCHING]`.
    4. $t = 50.2s$: Nova resposta bem-sucedida `RESOLVE` $\xrightarrow{}$ nó `[RESOLVED]` atinge consolidação final com pulso menta.
  * O fluxo visual é fluido, contínuo e musical, demonstrando como a máquina trata erros como parte natural do grafo em vez de exceções não tratadas.
* **Transição (F1535–F1559):**
  * As 4 conexões se recolhem e os nós deslizam suavemente em direção ao centro da tela.

---

## Cena 07 — Síntese de Engenharia & Fechamento
* **Tempo:** `52.0s – 60.0s` | **Quadros:** `F1560 – F1799` (240 frames)
* **Enquadramento:** Enquadramento nobre e equilibrado (1.0x).
* **Ação Visual:**
  * Os nós convergidos fundem-se no monograma concêntrico luminescente `FSM`.
  * Título monumental: **Máquinas de Estados**.
  * Revelação progressiva dos 3 preceitos técnicos definitivos da computação:
    1. **Estados Discretos:** *Elimine combinações booleanas cegas.*
    2. **Transições Explícitas:** *Apenas eventos autorizados movem o sistema.*
    3. **Modelagem Explícita:** *Uma modelagem explícita ajuda a impedir estados e transições inválidos.*
* **Fechamento (F1760–F1799):** Hold perfeito de leitura e assinatura de estúdio.
