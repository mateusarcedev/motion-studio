# BRIEF — Aula Interativa: Máquinas de Estados em Programação

- **Tema:** Máquinas de Estados Finitas (Finite State Machines / FSM) aplicadas à arquitetura de software e interfaces.
- **Público-alvo:** Desenvolvedores frontend e backend que enfrentam bugs de estados inconsistentes ("boolean soup").
- **Objetivo Pedagógico:** Demonstrar como substituir conjuntos frágeis de flags booleanas (`isLoading`, `hasError`, etc.) por um modelo de máquina de estados determinístico, com nós explícitos, transições validadas e prevenção estrutural de estados impossíveis.
- **Estrutura Pedagógica:**
  1. *Abertura (O Problema):* A armadilha da sopa booleana e a emergência de estados contraditórios.
  2. *Fundamento (O Grafo):* Os componentes de uma FSM (Estados, Eventos, Transições).
  3. *Mecanismo Funcional:* Exemplo prático de requisição de dados em execução, com transições controladas.
  4. *Prática com Feedback:* Questão causal sobre recuperação de erro e transição válida.
  5. *Síntese & Aplicação:* Regras fundamentais para aplicar no código em produção.
- **Formato:** HTML5 autocontido (offline, zero dependências externas de CDN), responsivo (desktop 1440px / mobile 390px), com suporte a teclado (`ArrowRight`, `ArrowLeft`), `prefers-reduced-motion` e determinismo temporal absoluto via `window.lesson.seek()`.
- **Status:** Draft técnico de validação da especialidade `aula-interativa` no MOTION Studio.
