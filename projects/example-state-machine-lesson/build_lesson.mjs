import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsRoot = "/tmp/gabrielgreco1-skills/aula-interativa/templates";

const playerCss = await readFile(path.join(skillsRoot, "player.css"), "utf-8");
const motionJs = await readFile(path.join(skillsRoot, "motion.js"), "utf-8");
const kitJs = await readFile(path.join(skillsRoot, "kit.js"), "utf-8");
const playerJs = await readFile(path.join(skillsRoot, "player.js"), "utf-8");

const lessonCode = `
const M = window.LessonMotion, K = window.LessonKit, esc = M.escape;

const slides = [
  // TELA 1: INTRODUÇÃO — O PROBLEMA DA SOPA BOOLEANA
  {
    id: "sopa-booleana",
    kind: "split",
    kicker: "Arquitetura de Estado",
    title: "O Problema da Sopa Booleana",
    steps: [
      { id: "inicio", label: "Flags independentes", duration: 1.0 },
      { id: "conflito", label: "O estado impossível", duration: 1.0 },
      { id: "solucao", label: "O domínio discreto", duration: 1.0 }
    ],
    sources: [],
    render({ state, time }) {
      const step = state.step;
      const t = time;
      
      const say = step === 0 
        ? "Múltiplos booleanos soltos parecem simples, mas geram bugs silenciosos."
        : step === 1
        ? "O que acontece quando isLoading e isSuccess são ambos verdadeiros?"
        : "Uma máquina de estados garante que exatamente um estado esteja ativo por vez.";
      
      const sub = step === 0
        ? "4 flags (loading, error, success, empty) produzem 16 combinações possíveis no seu componente."
        : step === 1
        ? "Sua interface tenta exibir o spinner de carregamento E a mensagem de sucesso ao mesmo tempo."
        : "Substituímos múltiplas variáveis por uma união discriminada: 'idle' | 'loading' | 'success' | 'error'.";
        
      const codeHtml = step === 0
        ? \`<span class="k">interface</span> State {\\n  isLoading: <span class="s">boolean</span>;\\n  isError: <span class="s">boolean</span>;\\n  isSuccess: <span class="s">boolean</span>;\\n  isEmpty: <span class="s">boolean</span>;\\n}\`
        : step === 1
        ? \`<span class="p">// Estado inválido permitido pelo compilador!</span>\\n<span class="k">const</span> state = {\\n  isLoading: <span class="warn">true</span>,  <span class="p">// spinner rodando</span>\\n  isSuccess: <span class="warn">true</span>,  <span class="p">// dados na tela!</span>\\n  isError: <span class="k">false</span>\\n};\`
        : \`<span class="p">// Modelo correto: Estados Discretos Exclusivos</span>\\n<span class="k">type</span> RequestState =\\n  | { status: <span class="ok">'idle'</span> }\\n  | { status: <span class="ok">'loading'</span> }\\n  | { status: <span class="ok">'success'</span>; data: User }\\n  | { status: <span class="ok">'error'</span>; error: Error };\`;

      const visual = \`
        <div class="mock" data-qa-text="terminal">
          <div class="mock-bar">
            <i></i><i></i><i></i>
            <span>state-model.ts</span>
            <em>TypeScript</em>
          </div>
          <pre><code>\${codeHtml}</code></pre>
        </div>
      \`;

      return {
        html: K.split({
          kicker: "Arquitetura de Estado",
          say,
          sub,
          visual
        }),
        caption: step === 0 
          ? "Observe as 4 variáveis booleanas independentes." 
          : step === 1 
          ? "Note a contradição entre loading e success ocorrendo em simultâneo."
          : "Veja a modelagem matemática correta através de estados discretos."
      };
    }
  },

  // TELA 2: DIAGRAMA DO GRAFO DE ESTADOS
  {
    id: "grafo-estados",
    kind: "diagrama",
    kicker: "Modelo Formal",
    title: "O Grafo de Estados e Transições",
    steps: [
      { id: "idle", label: "Repouso (IDLE)", duration: 1.0 },
      { id: "loading", label: "Requisição (LOADING)", duration: 1.0 },
      { id: "resolvido", label: "Sucesso ou Erro", duration: 1.0 },
      { id: "retry", label: "Recuperação (RETRY)", duration: 1.0 }
    ],
    sources: [],
    render({ state, time }) {
      const step = state.step;
      const t = time;

      const n1Active = step === 0;
      const n2Active = step === 1 || step === 3;
      const n3Active = step === 2;
      const n4Active = step === 2 || step === 3;

      const body = \`
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--accent-ink)" />
          </marker>
          <marker id="arrow-warn" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#d9480f" />
          </marker>
        </defs>

        <!-- Conexões / Arestas -->
        <!-- IDLE -> LOADING -->
        <path d="M 220 280 L 400 280" stroke="\${step >= 1 ? 'var(--accent)' : 'var(--line)'}" stroke-width="\${step >= 1 ? 4 : 2}" marker-end="url(#arrow)" />
        <text x="310" y="260" font-size="14" font-weight="600" fill="var(--accent-ink)" text-anchor="middle" data-qa-text="edge-fetch">FETCH</text>

        <!-- LOADING -> SUCCESS -->
        <path d="M 540 250 L 720 180" stroke="\${step >= 2 ? 'var(--good)' : 'var(--line)'}" stroke-width="\${step >= 2 ? 4 : 2}" marker-end="url(#arrow)" />
        <text x="630" y="200" font-size="14" font-weight="600" fill="var(--good)" text-anchor="middle" data-qa-text="edge-resolve">RESOLVE</text>

        <!-- LOADING -> ERROR -->
        <path d="M 540 310 L 720 380" stroke="\${step >= 2 ? '#d9480f' : 'var(--line)'}" stroke-width="\${step >= 2 ? 4 : 2}" marker-end="url(#arrow-warn)" />
        <text x="630" y="365" font-size="14" font-weight="600" fill="#d9480f" text-anchor="middle" data-qa-text="edge-reject">REJECT</text>

        <!-- ERROR -> LOADING (RETRY) -->
        <path d="M 760 420 C 680 500, 480 480, 470 340" fill="none" stroke="\${step >= 3 ? 'var(--warm)' : 'var(--line)'}" stroke-width="\${step >= 3 ? 4 : 2}" stroke-dasharray="\${step >= 3 ? 'none' : '6 4'}" marker-end="url(#arrow)" />
        <text x="600" y="480" font-size="14" font-weight="700" fill="var(--warm)" text-anchor="middle" data-qa-text="edge-retry">RETRY</text>

        <!-- Nós / Estados -->
        <!-- IDLE -->
        <g transform="translate(160, 280)" data-qa-text="node-idle">
          <circle r="55" fill="\${n1Active ? 'var(--accent-soft)' : 'var(--surface)'}" stroke="\${n1Active ? 'var(--accent)' : 'var(--line)'}" stroke-width="\${n1Active ? 4 : 2}" />
          <text text-anchor="middle" dominant-baseline="central" font-size="16" font-weight="700" fill="\${n1Active ? 'var(--accent-ink)' : 'var(--ink)'}">IDLE</text>
        </g>

        <!-- LOADING -->
        <g transform="translate(470, 280)" data-qa-text="node-loading">
          <circle r="55" fill="\${n2Active ? 'var(--accent-soft)' : 'var(--surface)'}" stroke="\${n2Active ? 'var(--accent)' : 'var(--line)'}" stroke-width="\${n2Active ? 4 : 2}" />
          <text text-anchor="middle" dominant-baseline="central" font-size="16" font-weight="700" fill="\${n2Active ? 'var(--accent-ink)' : 'var(--ink)'}">LOADING</text>
        </g>

        <!-- SUCCESS -->
        <g transform="translate(780, 160)" data-qa-text="node-success">
          <circle r="55" fill="\${n3Active ? 'var(--good-soft)' : 'var(--surface)'}" stroke="\${n3Active ? 'var(--good)' : 'var(--line)'}" stroke-width="\${n3Active ? 4 : 2}" />
          <text text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="700" fill="\${n3Active ? 'var(--good)' : 'var(--ink)'}">SUCCESS</text>
        </g>

        <!-- ERROR -->
        <g transform="translate(780, 400)" data-qa-text="node-error">
          <circle r="55" fill="\${n4Active ? 'var(--bad-soft)' : 'var(--surface)'}" stroke="\${n4Active ? 'var(--bad)' : 'var(--line)'}" stroke-width="\${n4Active ? 4 : 2}" />
          <text text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="700" fill="\${n4Active ? 'var(--bad)' : 'var(--ink)'}">ERROR</text>
        </g>
      \`;

      return {
        html: K.diagram(body, { w: 1000, h: 560 }),
        caption: step === 0 
          ? "Estado inicial IDLE: o sistema aguarda uma intenção do usuário."
          : step === 1
          ? "Ao disparar FETCH, o sistema entra deterministicamente em LOADING."
          : step === 2
          ? "O ciclo bifurca: resolução positiva (SUCCESS) ou tratamento de falha (ERROR)."
          : "O arco de recuperação RETRY reconduz o sistema de volta a LOADING com segurança."
      };
    }
  },

  // TELA 3: EXEMPLO FUNCIONAL INTERATIVO
  {
    id: "mecanismo-funcional",
    kind: "mock",
    kicker: "Simulação Prática",
    title: "Executando a Máquina de Estados",
    initialInputs: { status: "IDLE", lastEvent: "NENHUM" },
    controls: [
      {
        key: "status",
        type: "choice",
        label: "Estado Atual",
        options: [
          { value: "IDLE", label: "1. Repouso (IDLE)" },
          { value: "LOADING", label: "2. Buscando (LOADING)" },
          { value: "SUCCESS", label: "3. Concluído (SUCCESS)" },
          { value: "ERROR", label: "4. Falha (ERROR)" }
        ]
      }
    ],
    steps: [
      { id: "s1", label: "Simulador de transição", duration: 1.0 }
    ],
    sources: [],
    render({ state, time }) {
      const current = state.inputs.status || "IDLE";
      
      const badgeColor = current === "IDLE" ? "var(--muted)" 
        : current === "LOADING" ? "var(--accent)" 
        : current === "SUCCESS" ? "var(--good)" 
        : "var(--bad)";

      const allowedTransitions = {
        IDLE: ["FETCH"],
        LOADING: ["RESOLVE", "REJECT"],
        SUCCESS: ["RESET"],
        ERROR: ["RETRY", "RESET"]
      };

      const allowed = allowedTransitions[current] || [];

      const bodyHtml = \`
        <div style="padding:24px; text-align:left;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--line);">
            <div>
              <span style="font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase;">Estado Ativo</span>
              <div style="font-size:28px; font-weight:800; color:\${badgeColor}; font-family:var(--mono);" data-qa-text="current-state" data-value="\${current}">
                \${current}
              </div>
            </div>
            <div style="padding:8px 16px; border-radius:99px; background:var(--bg); border:1px solid var(--line); font-size:13px; font-weight:600;">
              Transições válidas agora: \${allowed.join(", ")}
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:20px;">
            <div style="padding:14px; border-radius:12px; background:var(--bg); border:1px solid var(--line);">
              <strong style="display:block; font-size:14px; margin-bottom:6px;">Evento FETCH</strong>
              <span style="font-size:12px; color:var(--muted);">Válido em: IDLE</span>
              <div style="margin-top:8px; font-size:12px; font-weight:700; color:\${allowed.includes("FETCH") ? "var(--good)" : "var(--bad)"};">
                \${allowed.includes("FETCH") ? "✓ Permitido" : "✗ Bloqueado"}
              </div>
            </div>

            <div style="padding:14px; border-radius:12px; background:var(--bg); border:1px solid var(--line);">
              <strong style="display:block; font-size:14px; margin-bottom:6px;">Evento RESOLVE</strong>
              <span style="font-size:12px; color:var(--muted);">Válido em: LOADING</span>
              <div style="margin-top:8px; font-size:12px; font-weight:700; color:\${allowed.includes("RESOLVE") ? "var(--good)" : "var(--bad)"};">
                \${allowed.includes("RESOLVE") ? "✓ Permitido" : "✗ Bloqueado"}
              </div>
            </div>

            <div style="padding:14px; border-radius:12px; background:var(--bg); border:1px solid var(--line);">
              <strong style="display:block; font-size:14px; margin-bottom:6px;">Evento RETRY</strong>
              <span style="font-size:12px; color:var(--muted);">Válido em: ERROR</span>
              <div style="margin-top:8px; font-size:12px; font-weight:700; color:\${allowed.includes("RETRY") ? "var(--good)" : "var(--bad)"};">
                \${allowed.includes("RETRY") ? "✓ Permitido" : "✗ Bloqueado"}
              </div>
            </div>
          </div>

          <div style="padding:12px 16px; border-radius:10px; background:var(--accent-soft); color:var(--accent-ink); font-size:14px; font-weight:550;">
            💡 O mecanismo protege a aplicação: cliques duplicados em "Buscar" durante o estado LOADING são rigorosamente ignorados pela máquina.
          </div>
        </div>
      \`;

      return {
        html: \`
          <div class="sc-center">
            <div class="mock-app" style="width:100%; max-width:780px;">
              <div class="mock-app-bar">
                <b>Painel da Máquina de Estados (Runtime)</b>
                <em>FSM Engine</em>
              </div>
              <div class="mock-app-body" style="padding:0;">
                \${bodyHtml}
              </div>
            </div>
          </div>
        \`,
        caption: "Alterne os estados nos controles abaixo para ver como as regras de transição mudam dinamicamente."
      };
    }
  },

  // TELA 4: EXERCÍCIO PRÁTICO COM FEEDBACK CAUSAL
  K.quiz({
    id: "exercicio-fsm",
    kicker: "Verificação Prática",
    title: "Tratamento de Falhas e Transições",
    question: "O sistema está no estado ERROR. O usuário clica em 'Tentar Novamente'. Qual deve ser a transição implementada na máquina de estados?",
    hint: "Pense na integridade dos dados e na necessidade de realizar um novo processamento assíncrono.",
    options: [
      {
        value: "direto-sucesso",
        label: "A) Transicionar diretamente de ERROR para SUCCESS"
      },
      {
        value: "correto-retry",
        label: "B) Disparar RETRY e transicionar de ERROR para LOADING"
      },
      {
        value: "sopa-booleana",
        label: "C) Manter isError: true e ligar isLoading: true simultaneamente"
      }
    ],
    correct: "correto-retry",
    feedback: {
      "direto-sucesso": "Incorreto: Ir para SUCCESS antes de receber novos dados do servidor mascara o erro anterior e corrompe a interface com informações desatualizadas.",
      "correto-retry": "Correto! O evento RETRY devolve a máquina ao estado LOADING. Isso reinicia o pipeline assíncrono com segurança e garante que a interface renderize o spinner enquanto aguarda a nova resposta.",
      "sopa-booleana": "Incorreto: Essa combinação recria exatamente a sopa booleana, colocando o sistema em um estado contraditório e impossível."
    },
    sources: [],
    lang: "pt-BR"
  }),

  // TELA 5: SÍNTESE E APLICAÇÃO NO CÓDIGO
  {
    id: "sintese-final",
    kind: "resumo",
    kicker: "Conclusão",
    title: "Três Princípios para o seu Código",
    steps: [
      { id: "cards", label: "Princípios Fundamentais", duration: 1.0 }
    ],
    sources: [],
    render({ state, time }) {
      const items = [
        {
          icon: "🛡️",
          text: "Torne estados impossíveis irrepresentáveis",
          sub: "Use uniões discriminadas no TypeScript ou Enums. Se o estado não existe no tipo, ele não pode acontecer em produção."
        },
        {
          icon: "⚡",
          text: "Transições declarativas e puras",
          sub: "Modele o comportamento como um reducer puro: (estadoAtual, evento) => proximoEstado. Sem mutações mágicas."
        },
        {
          icon: "🎯",
          text: "Determinismo absoluto",
          sub: "A mesma sequência de eventos sempre produz o mesmo resultado. Torna testes unitários simples e reproduzíveis."
        }
      ];

      return {
        html: K.cards(items, time),
        caption: "Parabéns! Você concluiu a aula sobre Máquinas de Estados em Programação."
      };
    }
  }
];

document.addEventListener("DOMContentLoaded", () => {
  window.lesson = window.LessonPlayer.create({
    root: "#lesson",
    title: "Máquinas de Estados em Programação",
    slides,
    lang: "pt-BR"
  });
  window.lesson.ready = true;
});
`;

const htmlTemplate = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Máquinas de Estados em Programação — Aula Interativa</title>
  <style>
${playerCss}

/* Custom visual styles for state machine diagram and mock */
:root {
  --accent: #10B981;
  --accent-soft: rgba(16, 185, 129, 0.12);
  --accent-ink: #065F46;
  --good: #10B981;
  --good-soft: rgba(16, 185, 129, 0.12);
  --bad: #EF4444;
  --bad-soft: rgba(239, 68, 68, 0.12);
  --warm: #F59E0B;
  --warm-soft: rgba(245, 158, 11, 0.12);
}

.sc-visual > .sc-full { flex:1; height:100%; min-width:0; padding:0; }
svg text { user-select:none; }
  </style>
</head>
<body>
  <div id="lesson"></div>

  <script>
${motionJs}
  </script>

  <script>
${kitJs}
  </script>

  <script>
${playerJs}
  </script>

  <script>
${lessonCode}
  </script>
</body>
</html>
`;

const outPath = path.join(__dirname, "lesson.html");
await writeFile(outPath, htmlTemplate, "utf-8");
console.log(`✅ Aula interativa gerada com sucesso em: ${outPath} (${Buffer.byteLength(htmlTemplate)} bytes)`);
