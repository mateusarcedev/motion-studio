# MOTION — Missão 03: integração incremental de efeitos, design e Shorts

**Estado inicial informado pelo operador local (não verificado neste ambiente):** 47 Skills reais + 8 symlinks; Playwright 1.64.1 e Chromium 1243; FFmpeg 8.0.1; Node 24; Python 3.14.5; 21 modificações não commitadas; cinco casos de teste e seis produções na galeria; renderers `render_static.mjs`, `render_frames.mjs`, `assemble_video.py`, frame driver determinístico, contact sheet, manifesto e QA existentes. Remotion documentado por Skills, mas pacote não instalado. Preserve esses resultados; não presuma que o GitHub remoto reflita a árvore local.

## Objetivo

Evoluir o MOTION para produzir **motion design, carrosséis, posts, stories, animações ilustradas e shorts narrados** com múltiplos motores opcionais, sem trocar a infraestrutura estável ou transformar links de referência em dependências. Prover roteiro, visual, narração, legendas, música, QA e entrega reproduzível quando houver insumos/licenças válidos.

## Regras não negociáveis

1. Começar com `git status --short`, leitura de `CLAUDE.md`, `pipeline.md`, `INTEGRATIONS.md`, `.agents/skills/`, `creative-core/` e dos seis itens da galeria. **Zero commit, push, deploy, instalação global ou remoção sem autorização expressa.** Não tocar em alterações preexistentes não relacionadas e não remover `motion_resources_catalog.yaml:Zone.Identifier`.
2. `.agents/skills/` permanece fonte de verdade. Não recriar nem duplicar Skills instaladas. Symlinks `.claude/`, `.opencode/` e demais adapters devem continuar válidos. O mesmo runtime deve servir a diferentes agentes, não depender das APIs proprietárias deles.
3. Separar: **Skill do agente**, **biblioteca de código**, **motor de renderização**, **aplicação externa**, **catálogo de inspiração** e **mídia licenciada**. Verificar licenças do código, dos modelos e dos assets separadamente; registrar fonte, versão/commit, data da verificação e restrições no catálogo. Sem scraping proibido, sem importar coleções proprietárias nem conteúdos que exigem conta sem acesso autorizado.
4. Preservar determinismo por `frame/time/seed`, captura de stills/contact sheets antes do full render, crítica independente, até duas rodadas por defeito, reflow real de formatos (sem crop genérico), export ZIP e `assets.manifest.json` com hashes.
5. Novas dependências serão **por projeto e sob demanda**, sem inflar o ambiente base. Playwright/Chromium/FFmpeg existentes continuam padrão. Não instalar Remotion, Puppeteer, Blender, OBS ou Python ML/numeric apenas porque constam na lista.
6. Não inventar métricas, imagens de produto, marcas, direitos de uso, narrações humanas ou aprovações. Respeitar autoria, direitos de voz e trilhas de terceiros.

## Fase A — Reconciliação do novo catálogo

Atualizar `INTEGRATIONS.md` e catálogo estruturado com **20 ferramentas únicas** do lote (Chatterbox aparece repetido no texto original), marcando overlaps com o acervo atual:

- Já conhecidos/abordados: Remotion, HyperFrames, Three.js, Tone.js, faster-whisper e FFmpeg.
- Novos candidatos de animação/efeitos: Anime.js, React Spring, PixiJS, p5.js, Paper.js, Matter.js, Rapier, OGL, tsParticles, glTF Transform e GL Transitions.
- Novos candidatos operacionais: OBS Studio, Chatterbox TTS e OpenCut.

Fontes oficiais/repos:

- https://github.com/remotion-dev/remotion
- https://github.com/heygen-com/hyperframes
- https://github.com/juliangarnier/anime
- https://github.com/pmndrs/react-spring
- https://github.com/pixijs/pixijs
- https://github.com/processing/p5.js
- https://github.com/paperjs/paper.js
- https://github.com/liabru/matter-js
- https://github.com/mrdoob/three.js
- https://github.com/dimforge/rapier
- https://github.com/oframe/ogl
- https://github.com/tsparticles/tsparticles
- https://github.com/donmccurdy/glTF-Transform
- https://github.com/gl-transitions/gl-transitions
- https://github.com/obsproject/obs-studio
- https://github.com/resemble-ai/chatterbox
- https://github.com/Tonejs/Tone.js
- https://github.com/SYSTRAN/faster-whisper
- https://github.com/OpenCut-app/OpenCut
- https://github.com/FFmpeg/FFmpeg

**Gates específicos:** p5.js tem LGPL-2.1 segundo metadados públicos consultados; OGL requer leitura do arquivo de licença; cada transição GL pode ter licença própria. Chatterbox tem licença de repositório MIT, mas cada peso/model card pode acrescentar condições; validar PT-BR e requisitos de CPU/GPU. OpenCut está em reescrita e anuncia API, MCP e headless futuros: classificar como `watch`, não como motor operacional. A existência de 12 Skills `remotion-*` **não equivale** a pacote Remotion instalado.

Adicionar **14 fontes de design** apenas como catálogo de descoberta/referência, sem scraping, reprodução de templates ou incorporação de mídia sem licença:

https://inspora.design ; https://iter0.com ; https://backgrounds.supply ; https://v0.app/templates ; https://beui.dev ; https://mobbin.com ; https://navbar.gallery ; https://60fps.design ; https://motionin.design ; https://land-book.com ; https://landdding.com ; https://fontshare.com ; https://remove.bg ; https://wedoflow.com

Diferenciar: inspiração visual, componentes opcionais, fontes licenciadas, assets, ferramenta SaaS. Para Backgrounds Supply, os assets podem ser usados em peças comerciais, porém não redistribuídos como biblioteca/pack (confirmar a licença atual antes de qualquer importação). Fontshare exige verificação de direitos das famílias/fontes específicas. Remove.bg é um serviço externo, não requisito local.

## Fase B — MotionSites AI

Fonte: https://github.com/Motionsites-AI/claude-skill e https://motionsites.ai/

Confirmado: Skill `motionsites-web-builder` com receitas de animação, spec editorial, screenshot + avaliação e recursos de web design cinematográfico. O `LICENSE` separa explicitamente instruções/scripts/referências **MIT** de `examples/`, `media/` e links de mídia **© MotionSites** (uso para construir sites, sem redistribuição como coleção). O SKILL.md original contém bloco de divulgação comercial em todas as entregas.

**Instruções:**

1. Registrar a Skill como referência especializada `web-cinematic` ou adaptador opcional, não como diretor global do MOTION.
2. Reaproveitar somente o código técnico permitido pela MIT, respeitando atribuições. Não copiar o repositório inteiro indiscriminadamente, nem embutir o acervo `examples/media` no MOTION.
3. Extrair conceitos compatíveis: specs precisas, motion grammar, análise de referência, screenshot-and-fix, mecanismos para mobile, reduced-motion e acessibilidade. Implementar originalidade visual e manter atributos de marca.
4. Não adicionar mensagens de marketing de terceiros nas entregas próprias do MOTION. Se utilizar a Skill original sem adaptação, explicitar seu comportamento promocional e obter aprovação antes de adotá-la. Evitar conflito silencioso com regras do estúdio.
5. Testar uma peça web/hero demonstrativa, se for factível, com assets próprios e QA visual; não afirmar que vídeos da prateleira estão incluídos.

## Fase C — Shorts Animator e `shorts-director`

Fonte: https://www.tobiadonadon.com/projects/construct/material/skills/shorts-animator

A página oficial descreve cenas desenhadas em código, estilos oil/watercolour/crayon/ink/gouache, narração local, legendas por palavra, música e proporções variadas. **O ZIP é enviado por e-mail; o código e a licença não foram auditados aqui.** Não simular instalação, não contornar newsletter, não atribuir licença open-source sem evidência.

Criar uma Skill original `shorts-director` apenas se não houver equivalente existente, usando `motion-director`/creative-core para:
- texto/versículo/história → beats/cenas → storyboard → composição por frame → TTS (somente com engine disponível e direitos de voz) → timecodes por palavra → trilha licenciada/gerada → stills → crítica → MP4 + fontes + legenda SRT/ASS + ZIP/manifesto;
- suportar 9:16, 1:1 e 16:9 com reflow, além de duração configurável;
- adotar fallback textual sem TTS/música quando dependências estiverem indisponíveis, deixando explícito no relatório;
- criar pelo menos um teste determinístico com narração autorizada/gerada localmente somente se o engine estiver instalado; não reproduzir os exemplos proprietários da Skill de terceiros.

Se o usuário fornecer o ZIP autorizado do Shorts Animator, inspecionar o conteúdo/LICENÇA e só então comparar com o módulo original para decidir importar, adaptar ou manter separado.

## Fase D — Novos candidatos úteis que faltavam

Adicionar como `candidate`, sem instalação automática:

- Motion Canvas — https://github.com/motion-canvas/motion-canvas — animações vetoriais e vídeos explicativos por código.
- Motion (motion.dev) — https://github.com/motiondivision/motion — animação web/React, avaliar se agrega algo além de GSAP/Anime.
- Manim — https://github.com/ManimCommunity/manim — explicações técnicas/matemáticas.
- Lottie-web — https://github.com/airbnb/lottie-web — playback de animações vetoriais.
- dotLottie-web — https://github.com/LottieFiles/dotlottie-web — player e empacotamento de animações portáveis.
- libass/ASS subtitles, font fallback com Noto/emoji, fontTools e verificações de tipografia — candidatos para legibilidade, legendas e prevenção de tofu, com fonte e licença a verificar.

A avaliação deve explicar por que cada candidato complementa o core ou é redundante.

## Fase E — Arquitetura mínima

Preferir ampliar `creative-core/` com adaptadores, em vez de multiplicar pipelines:

- `renderers/`: HTML frame-driven atual (padrão), adapters on-demand 2D/3D/Remotion quando necessário.
- `design-system/`: tokens, presets e gramática de animação por marca.
- `audio/`: engine TTS opt-in, cues de áudio, normalização FFmpeg e alinhamento de legenda.
- `assets/`: manifesto, direitos/proveniência, nunca adotar URLs inventadas.
- `quality/`: contact sheet, safe zones, legibilidade, font fallback e revisão crítica.
- `catalog/`: ferramentas e fontes com status `installed`, `approved_component`, `reference_only`, `candidate`, `blocked`, `watch`, `unverified`.

Isolar dependências opcionais e documentar requisitos por SO, GPU/CPU, memória e versões de Node/Python.

## Fase F — Testes e gates de entrega

1. Reexecutar regressões já existentes para carrossel de 7 slides, post 4 proporções, story estático, teaser 150 frames e story animado 120 frames. Comparar dimensões, checksums de frames determinísticos, overflow, MP4 CFR, assets/ZIP e 6 registros da galeria.
2. Preparar um exemplo original de short ilustrado (sem depender de ZIP de terceiro); ao menos storyboard, três cenas, frames verificáveis e export. Só afirmar narração/legendas por palavra se realmente realizadas.
3. Verificar texto PT-BR, fontes no Chromium headless, loading seguro de assets, subtítulos e safe zones para redes sociais.
4. Revisar cada nova biblioteca contra licença, origem, segurança, manutenção, custos, cache/offline e peso. Não executar código remoto arbitrário, `curl | sh` ou instalação global.
5. Não aprovar automaticamente nenhum `draft`. Preservar aprovação humana.
6. Deixar tudo uncommitted e emitir diff/resumo final, sem sobrescrever as 21 alterações anteriores.

## Entrega esperada

- `INTEGRATIONS.md` atualizado com as 20 ferramentas (deduplicadas), 14 referências de design, MotionSites, Shorts Animator e candidatos extras.
- Catálogo estruturado com entradas deduplicadas e links canônicos, licenças, evidências, versão/commit e status.
- Skill(s) implementada(s) somente onde houver lacuna real.
- Prova de regressão de todos os casos anteriores e teste de um short original.
- Documentação de compatibilidade com Claude Code, Codex, OpenCode, Gemini, Copilot e ambientes sem execução local (modo orientação/exportação); **não alegar runtime equivalente em todos**.
- Lista do que ficou `blocked`, `unverified`, `watch`, `installed` e justificativas.
- Zero commit/push/deploy, zero instalações globais e zero aprovação automática.

**Princípio de projeto:** o MOTION não é uma coleção de downloads; é um estúdio com contratos de criação, renderização, revisão, memória e entrega, onde cada integração é justificável, verificável e removível.
