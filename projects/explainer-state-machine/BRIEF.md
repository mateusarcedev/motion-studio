# BRIEF — Explainer Motion: Máquinas de Estados em Programação

**Projeto:** `explainer-state-machine`  
**Especialidade:** `explainer-motion` (MOTION Studio Benchmark)  
**Formato:** 1080×1920 (9:16 Vertical para Mobile / Shorts / Reels)  
**Taxa de Quadros:** 30.00 FPS CFR (Constant Frame Rate)  
**Duração:** 60.0 segundos (1800 frames determinísticos: 0 a 1799)  
**Áudio:** Master Visual Puro (`audio: null`) em conformidade com benchmark silencioso  
**Tecnologia:** HTML5 + SVG vetorial animado + Canvas 2D determinístico (`window.__onFrame__`)  

---

## 1. Visão e Objetivo Pedagógico

O objetivo desta produção é demonstrar visualmente **o que é e como funciona uma Máquina de Estados Finita (FSM)** no desenvolvimento de software moderno, utilizando o novo padrão de motion graphics de alta fidelidade do MOTION Studio (inspirado no benchmark *Big O Notation*).

A animação tem propósito pedagógico em cada segundo:
1. **O Problema Real:** Mostrar como flags booleanas soltas (`isLoading`, `isError`, `isSuccess`, etc.) geram combinações exponenciais contraditórias ("sopa booleana" e telas com spinner + erro simultâneos).
2. **A Solução Formal:** Modelar o sistema como um conjunto finito de estados discretos onde apenas um pode estar ativo por vez.
3. **O Vetor de Transição:** Demonstrar que estados não mudam aleatoriamente; eles mudam em resposta a eventos conhecidos que conduzem o fluxo por rotas explícitas.
4. **O Mecanismo de Guarda:** Explicar visualmente como condições lógicas atuam como portais de validação antes de autorizar a transição.
5. **A Proteção Contra Estados Impossíveis:** Mostrar como a máquina de estados rejeita eventos inválidos para o estado atual, preservando a integridade estrutural da aplicação.
6. **A Cadência Operacional Completa:** Acompanhar um ciclo de vida real (requisição de dados assíncrona com tratamento e recuperação de falha).
7. **A Síntese:** Concluir com a máxima da engenharia de software de ponta: *"Torne estados impossíveis irrepresentáveis por construção."*

---

## 2. Arquitetura de Cena e Estrutura dos 7 Atos

| Ato | Intervalo de Tempo | Faixa de Quadros | Foco Narrativo & Mecanismo Visual |
| :---: | :---: | :---: | :--- |
| **01** | `00.0s – 08.0s` | `F0000 – F0239` | **Abertura: O Caos Booleano.** Pergunta instigante. 4 flags booleanas se multiplicam em $2^4 = 16$ estados possíveis, gerando colisão contraditória (`isLoading: true` + `isSuccess: true`). |
| **02** | `08.0s – 16.0s` | `F0240 – F0479` | **O Grafo Discreto.** Apresentação dos estados finitos como nós circulares com anéis luminescentes. Apenas um nó ativo por vez (`IDLE` com pulso ciano). |
| **03** | `16.0s – 25.0s` | `F0480 – F0749` | **A Transição.** Disparo do evento `FETCH`. Uma partícula de dados percorre o arco direcionado, desativando `IDLE` e ativando `FETCHING` com mola elástica. |
| **04** | `25.0s – 34.0s` | `F0750 – F1019` | **As Guardas.** Portal geométrico no caminho entre estados. Teste de validação: condição falsa bloqueia; condição verdadeira (`isValid = true`) abre os feixes em menta fluorescente. |
| **05** | `34.0s – 43.0s` | `F1020 – F1289` | **Erro & Proteção Estrutural.** O sistema está em `RESOLVED`. Um evento inválido `FETCH` tenta disparar; a borda repele o impacto com onda coral e vibração controlada. Estado intacto. |
| **06** | `43.0s – 52.0s` | `F1290 – F1559` | **Fluxo Completo em Execução.** Ciclo operacional contínuo com 4 nós (`IDLE` ➔ `FETCHING` ➔ `ERROR` ➔ `RETRY` ➔ `RESOLVED`), telemetria em tempo real e contadores. |
| **07** | `52.0s – 60.0s` | `F1560 – F1799` | **Conclusão & Síntese.** Fusão dos nós em um monograma geométrico estável e mensagem final de engenharia: *"Elimine estados impossíveis por construção."* |

---

## 3. Critérios de Sucesso e Qualidade

- **Pedagogia Visual:** O movimento deve ensinar a mecânica lógica; nunca parecer uma transição decorativa ou slides estáticos.
- **Hierarquia 9:16:** Âncora conceitual no topo, mecanismo visual vivo no centro e telemetria sincronizada na base.
- **Determinismo Estrito:** `window.__onFrame__(frame)` deve produzir exatamente o mesmo quadro se chamado isoladamente ou em sequência.
- **Zero Black Screens:** Sem quadros pretos ou quedas acidentais de visibilidade entre as transições.
- **Safe Zones:** Todo texto e elemento interativo deve respeitar a margem de 8% nas 4 bordas (86px horizontal, 153px vertical).
