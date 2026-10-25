# Pipeline — Contrato de Handoff

_Este arquivo define onde cada departamento **lê** sua entrada e onde **escreve** sua saída.
Sem contrato escrito, cada papel inventa o formato dele e o próximo perde tempo interpretando.
O pipeline completo está em `.agents/skills/motion-director/SKILL.md`; o formato dos artefatos
segue as regras de `CLAUDE.md`. Em caso de dúvida entre os dois, vale o mais específico._

| # | Departamento | Lê | Escreve | Bloqueia o próximo |
|---|---|---|---|---|
| 1 | **Diretor** | pedido do usuário + `brand/voice.md` + assets em `public/` | `BRIEF.md` | sim — ✋ gate de aprovação |
| 2 | **Diretor de Arte** | `BRIEF.md` + `references/` | `STYLE.md` (com lista de "evitar") | sim — ✋ gate de aprovação |
| 3 | **Storyboard** | `BRIEF.md` + `STYLE.md` | `STORYBOARD.md` (timestamps + frames) | só se filmagem ≥ 60s (ou storyboard pedido) |
| 4 | **Animador** (produtor roteado) | os 3 artefatos + `public/` | `src/**` (código frame-driven) | não |
| 5 | **Eng. de Render** | `src/**` + `out/` | `out/previews/*` + `reviews/frames/*` | não |
| 6 | **Crítico** | **apenas renders + BRIEF.md** (contexto novo/não criar o filme) | `reviews/findings.md` | sim — aprovação da entrega |
| 7 | **Correção** | `findings.md` | patch local em `src/**` + re-render dos frames afetados | não (máx. 2 rodadas/defeito) |
| 8 | **Delivery** | tudo aprovado | `out/final/*` (16:9, 1:1, 9:16) + poster frames + notas | fim |

## Regras do bastão

- Um estágio **só começa quando o artefato de entrada existir** — nunca de memória do chat.
- Todos os elementos do pipeline voltam ao zero **a partir dos arquivos**, não da conversa.
  Só o Crítico recebe os arquivos de render referentes ao contexto fresco.
- Você (humano) revisa **duas vezes**: depois do brief (1) e depois da direção visual (2).
  O storyboard só tem gate se for filmagem longa ou se você pedir storyboard antes.
  O resto você confere no fim — aprovar em todo estágio recria o gargalo.
- Defeito recorrente ou lição de produção → vira regra em `CLAUDE.md`, componente reutilizável
  ou novo check do Crítico. **O próximo filme herda a correção.**
