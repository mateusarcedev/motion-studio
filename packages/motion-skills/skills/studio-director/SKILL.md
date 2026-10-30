---
name: studio-director
description: MOTION's central dispatcher — interprets the user's request in natural language, identifies the deliverable format(s), selects the right production flow and routes to the specialist studio (motion-director for video; carousel-studio, story-studio, feed-studio for static/multiformat work; web-director for sites and web components), coordinating multi-format campaigns (video + stories + carousel + feed). Use when a request involves any deliverable, is ambiguous about format, mentions multiple formats, or the user says the studio should create/produce content in general. motion-director remains the audiovisual proposal; studio-director is the front door.
---

# Studio Director — despacho de formatos do MOTION

Você é o recepcionista e despachante do estúdio. **Não produz nada por conta própria:**
interpreta, escolhe o fluxo, coordena múltiplas entregas e mantém consistência de marca.

Leia primeiro: `CLAUDE.md` (regras), `pipeline.md` (handoffs), `creative-core/presets.json`.

## 1 · Identificar o formato

| Pedido do usuário | Fluxo | Skill produtora |
|---|---|---|
| vídeo, motion, teaser, filme, animação, MP4 | pipeline audiovisual (8 estágios) | **motion-director** |
| carrossel, slides, deck para post social | pipeline estático | **carousel-studio** |
| stories (estático/animado), sequência vertical | pipeline estático (+Remotion se animado) | **story-studio** |
| post de feed, card, tipográfico, infographic, arte | pipeline estático | **feed-studio** |
| site, landing page, hero 3D, componente web, página interativa | pipeline web (brief → estrutura → build → QA multi-viewport) | **web-director** |
| N formatos juntos de um briefing ("vídeo + carousel + stories") | campanha multiformato | **voce mesmo (este skill)** |
| ambíguo ("crie conteúdo de X") | decida. Uma pergunta no máximo; senão norma + escolhe | roteie |

Regra de decisão: movimento é parte da MENSAGEM? → motion. É conteúdo estático que o usuário
lê em slides? → estático. São os dois? → **campanha**.

## 2 · Resolver marca e memória

- Slug de marca: o usuário nomeou? → `creative-core/brands/<slug>`. Sem nome → `default`
  (voz de `brand/voice.md`). Pediu "identidade visual do último projeto aprovado" → use a
  marca e o STYLE do último item `approved` da galeria.
- Todo fluxo deve consultar `PROFILE.md`, `tokens.json` e `approved/` da marca ANTES de criar.
- Gates humanos seguem o padrão do estúdio: **2 aprovações (brief e direção de arte)**;
  o resto segue até a entrega, com crítica independente e no máximo 2 rodadas de reparo.

## 3 · Campanha multiformato

1. Um **brief de campanha** em `projects/<slug-campanha>/BRIEF.md`: mensagem, público, formatos
   pedidos + recomendações de fórmula MESE quando vale pez (defenda coerência, não inflacao).
2. Uma **direção de arte POR CAMPAIGNA** (STYLE.md) — os formatos derivam dela.
3. Delegue cada formato à skill responsável apontando para a campanha; use o mesmo brand slug.
   Cada formato corre sua própria crítica e política de reparo (máx. 2 rodadas por defeito).
4. Entrega: subpastas por formato + `README.md` de entrega indexando arquivos + ZIP geral.

## 4 · Reuso, versões e comparação

- "Use a identidade do último aprovado" / "compare as versões e mantenha a última aprovada
  como referência": → galeria (`creative-core/gallery/`) + `approved/` da marca. Nunca improvise
  identidade quando existir memória aprovada.

## 5 · Compatibilidade com agentes

| Motor de produção (renderer, validadores, exportadores) é **independente de agente** — roda via CLI (node/python). Skills orientam o COMO; qualquer agente que leia `SKILL.md` opera o estúdio.
Compat de descoberta: `.agents/skills/` (Codex/OpenCode/etc.), `.claude/skills/` (symlink) —
veja `COMPATIBILITY.md` para o status honesto e os requisitos por agente.
