# ROTEIRO PEDAGÓGICO — Máquinas de Estados em Programação

## Tela 01 — O Problema da Sopa Booleana (kind: split)
- **Kicker:** Arquitetura de Estado
- **Título:** Quando booleanos colidem
- **Texto Principal (say):** Flags independentes parecem simples no início, mas geram estados impossíveis à medida que o código cresce.
- **Subtexto:** 4 variáveis booleanas (`isLoading`, `isError`, `isSuccess`, `isEmpty`) produzem 16 combinações possíveis — a maioria delas inválida.
- **Visual:** Painel de código comparativo com indicadores de estado conflitantes (`isLoading: true` simultâneo a `isSuccess: true`).
- **Passos:**
  - 0: O código inocente com 4 flags.
  - 1: O bug de interface: tela mostra spinner E mensagem de sucesso ao mesmo tempo.
  - 2: O diagnóstico: estados não são independentes; pertencem a um único domínio discreto.

---

## Tela 02 — O Grafo de Estados (kind: diagrama)
- **Kicker:** Modelo Formal
- **Título:** Estados, eventos e transições
- **Texto Principal (say):** Em qualquer instante, o sistema está em exatamente um estado. Transições só ocorrem em resposta a eventos conhecidos.
- **Visual:** Diagrama SVG vetorial com nós (`IDLE`, `LOADING`, `SUCCESS`, `ERROR`) e arcos direcionados com eventos (`FETCH`, `RESOLVE`, `REJECT`, `RETRY`).
- **Passos:**
  - 0: Apresentação dos 4 nós em repouso.
  - 1: Transição `IDLE` ➔ `LOADING` ao receber `FETCH`.
  - 2: Ramificação determinística: `SUCCESS` via `RESOLVE` ou `ERROR` via `REJECT`.
  - 3: Recuperação: `ERROR` ➔ `LOADING` via `RETRY`.

---

## Tela 03 — Mecanismo em Execução (kind: mock / funcional)
- **Kicker:** Demonstração Prática
- **Título:** A máquina em ação real
- **Texto Principal (say):** Uma máquina de estados ignora eventos inválidos para o estado atual.
- **Visual:** Simulador interativo com botões de disparo de evento (`FETCH`, `RESOLVE`, `REJECT`, `RESET`). Painel de telemetria mostrando o estado atual e o histórico de transições.
- **Passos:**
  - 0: Estado inicial `IDLE`.
  - 1: Disparo de `FETCH` ➔ Sistema entra em `LOADING`. Clique em `FETCH` é bloqueado com mensagem de proteção.
  - 2: Resolução com sucesso ➔ Sistema atinge `SUCCESS`.

---

## Tela 04 — Prática com Feedback Causal (kind: pratica / quiz)
- **Kicker:** Exercício Prático
- **Título:** Teste sua intuição de transição
- **Pergunta:** Você está no estado `ERROR` e o usuário clica no botão "Tentar Novamente". Qual é a transição correta na máquina de estados?
- **Alternativas:**
  - A: Ir diretamente de `ERROR` para `SUCCESS` sem nova requisição.
  - B: Transicionar de `ERROR` para `LOADING` disparando o evento `RETRY`. (CORRETA)
  - C: Manter `isError = true` e ligar `isLoading = true` ao mesmo tempo.
- **Feedback Explicativo:**
  - A (Incorreta): O sistema ainda não sabe se a nova tentativa terá sucesso; ir para SUCCESS antes da resposta cria dados inconsistentes.
  - B (Correta): Perfeito. O evento RETRY reinicia o ciclo levando a máquina de volta a LOADING, onde uma nova requisição assíncrona é processada.
  - C (Incorreta): Essa é a armadilha clássica da sopa booleana, criando o estado impossível que queremos eliminar.

---

## Tela 05 — Síntese e Aplicação no Código (kind: resumo / cards)
- **Kicker:** Conclusão
- **Título:** Três regras para o seu código
- **Cards:**
  1. *Torne estados impossíveis irrepresentáveis:* Use uniões discriminadas (`type State = ...`) em vez de múltiplos booleanos.
  2. *Transições puras e declarativas:* Implemente um reducer `(state, event) => nextState` sem efeitos colaterais ocultos.
  3. *Determinismo e facilidade de teste:* Dada a mesma sequência de eventos, a máquina sempre termina no mesmo estado.
