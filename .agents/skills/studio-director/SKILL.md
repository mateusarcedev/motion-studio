---
name: studio-director
description: MOTION's universal creative director and adaptive dispatcher — interprets natural language requests across 5 independent dimensions (subject, intent, audience, channel, visual language), performs factual grounding, calculates adaptive durations, and routes to specialist studios (explainer-motion, motion-director, stageshow, 3d-scene-director, web-director, carousel-studio, story-studio, feed-studio, aula-interativa, reel-editor, voice-studio, shorts-director, cinematic-product-director), coordinating single deliverables and multi-format campaigns. Principle: the production adapts to the user's intent, never the opposite.
---

# Studio Director — Universal Creative Director & Adaptive Content Production

O **MOTION Studio** é um framework criativo open-source orientado a agentes de IA. Seu propósito é transformar pedidos em linguagem natural em produções visuais de qualidade profissional, independentemente do tema, setor, finalidade, duração ou formato.

O MOTION **NÃO** é exclusivamente um gerador de anúncios, uma ferramenta de carrossel de Instagram ou um editor de tutoriais. Ele é um **estúdio criativo universal**.

> **Princípio Fundamental:** A produção se adapta à intenção do usuário, nunca o contrário.

---

## 1. Intent-Driven Creative Routing (5 Dimensões Independentes)

Ao receber um pedido livre, o `studio-director` analisa 5 dimensões ortogonais:

### 1.1. Assunto (Subject)
Identificar o domínio e o objeto real da mensagem:
- **Tecnologia & Software:** APIs, banco de dados, arquitetura, microsserviços, frontend, devops.
- **Ciência & Biologia:** Biologia marinha, astronomia, ecologia, genética, física, neurociência.
- **Processos & Manufatura:** Indústria de alimentos, metalurgia, química, logística, montagem.
- **Negócios & Serviços:** Hotelaria, consultoria, confeitaria fina, eventos, direito, finanças.
- **Educação & História:** Civilizações, revoluções, conceitos matemáticos, modelos mentais.
- **Cultura & Arte:** Música, literatura, cinema, design autoral.

### 1.2. Intenção (Intent)
O que a peça deve realizar no espectador?
- **Explicar / Ensinar:** Desmistificar conceitos, causalidade, modelos mentais (sem CTA de venda).
- **Divulgar / Vender:** Apresentar proposta de valor, diferenciais competitivos e chamada para ação (CTA).
- **Demonstrar Processo:** Exibir transformações físicas ou lógicas em sequência causal.
- **Apresentar Software (Showcase):** Demonstrar fluxos de UI, métricas e interações de produto.
- **Contar uma História (Storytelling):** Engajar emocionalmente através de jornada e conflito.
- **Visualizar Dados:** Tornar números abstratos compreensíveis através de proporção e ritmo.
- **Híbrida:** Ex. Explicar a tecnologia subjacente e no encerramento apresentar o produto.

### 1.3. Público (Audience)
- **Crianças & Jovens:** Analogias táteis, ritmo visual envolvente, paletas vivas.
- **Estudantes & Aprendizes:** Pausas para assimilação, terminologia clara, modelos visuais.
- **Desenvolvedores & Engenheiros:** Precisão técnica estrita, diagramas semânticos, zero simplificação infantilizada.
- **Clientes Empresariais (B2B):** Eficiência, retorno sobre investimento, sobriedade, métricas.
- **Consumidores Finais (B2C):** Desejo, sensorialidade, clareza imediata, benefícios palpáveis.
- **Comunidade Científica / Especialistas:** Rigor factual, respeito à literatura, citação de fontes.

### 1.4. Canal & Proporção (Channel & Format)
- **Instagram / TikTok / Shorts (9:16 vertical):** Área segura central (Y: 15% a 85%), tipografia de alto impacto visual.
- **YouTube Longform / Apresentações / Desktop (16:9 horizontal):** Composição cinematográfica, respiro lateral, diagramas expansivos.
- **Feed Social / LinkedIn (4:5 ou 1:1):** Densidade editorial, visualização em rolagem rápida.
- **Website Hero / Produto:** Componente interativo leve, integração DOM/Canvas.

### 1.5. Linguagem Visual (Visual Language)
A linguagem decorre do **assunto** e da **intenção**, nunca de palavras-chave avulsas:
- **Scientific Visualization:** Contraste atmosférico, precisão óptica, rigor anatômico/físico.
- **Explainer Motion / Diagram Motion:** Diagramas vivos, causalidade direta, gates lógicos, telemetria sincronizada (benchmark Big O).
- **Process Infographic:** Linha do tempo física, fluxogramas termodinâmicos, medidores analógicos/digitais.
- **Commercial Motion / Editorial:** Fotografia animada, máscaras tipográficas, ritmo no beat, paletas de luxo/apetite.
- **UI Motion & Product Showcase:** Bento grids, microinterações, cursores animados fluidos (padrão Stageshow).
- **3D Cinematic:** Iluminação industrial, volumetria, materiais físicos PBR (Three.js/WebGL).

---

## 2. Duração Adaptativa (Sem Tamanho Único)

O MOTION não impõe 15s ou 30s ou 60s como dogma universal:
- **Duração Especificada:** Quando o usuário define o tempo (ex: "faça em 15s" ou "vídeo de 3 minutos"), respeitar rigorosamente. Se o conteúdo for denso demais, negociar o escopo da explicação antes de truncar a lógica.
- **Duração Não Especificada:** O diretor propõe a duração com base na carga cognitiva:
  - *Comercial Direto (B2C / Feed):* 15s a 20s (retenção máxima, benefício claro + CTA).
  - *Conceito Único / Divulgação Científica:* 30s a 45s (gancho ➔ enigma ➔ evidência ➔ conclusão).
  - *Explicação Técnica / Algoritmo:* 45s a 60s (entrada ➔ estados finitos ➔ transições ➔ telemetria).
  - *Processo Industrial em Múltiplas Etapas:* 45s a 90s (~10-12s por fase com pausas de leitura).
- **Pacing e Pausas Cognitivas:**
  - Tempo de leitura: ~150-180 palavras por minuto faladas; ~250 ppm leitura visual.
  - Pausa de compreensão: mínimo 1.5s após cada mudança de estado visual antes da próxima transição.

---

## 3. Pesquisa e Grounding Factual (Zero Alucinações)

Quando o tema envolve fatos, biologia, ciência, história ou processos produtivos:
1. **Identificação Entitária:** Isolar organismos, componentes, especificações ou reações químicas reais.
2. **Separação Fato vs. Hipótese:** Declarar consensos consolidados e delimitar teorias em aberto.
3. **Consulta a Fontes Verificáveis:** Recorrer a literatura acadêmica, documentação oficial de APIs, normas técnicas ou manuais de engenharia.
4. **Metáforas Visualmente Coerentes:** Uma lula gigante no fundo do mar não "acende lanternas mágicas": ela capta a bioluminescência excitada por grandes predadores.
5. **Registro de Fontes:** Toda produção científica ou histórica gera um `RESEARCH.md` com citações.
6. **Integridade Comercial:** Em publicidade, jamais inventar avaliações, preços, certificações falsas ou funcionalidades inexistentes.

---

## 4. Brand & Project Awareness (Sem Imposição de Marca)

O MOTION Studio funciona em projetos consumidores independentes:
- **Inspeção de Contexto:** Antes de desenhar, inspecionar `README.md`, `tokens.json`, `package.json`, pastas de imagens (`public/`, `assets/`) e produções anteriores.
- **Design System Existente:** Se o projeto consumidor tiver tokens de cores e tipografia, adotar com prioridade máxima.
- **Ausência de Marca:** Propor paleta e tipografia personalizadas **derivadas do assunto**, nunca forçando o verde-menta (`#15F5BA`) e fundo escuro padrão do MOTION Studio:
  - *Biologia Marinha:* Azuis abissais (`#030712`), ciano bioluminescente (`#00E5FF`).
  - *Alta Confeitaria:* Vinho bordô (`#2D0A14`), ouro champanhe (`#E5C378`), marfim (`#FDFBF7`).
  - *Fábrica de Alimentos:* Grafite industrial (`#0B0F17`), âmbar térmico (`#F59E0B`), crio-azul (`#38BDF8`).
  - *APIs & Backend:* Azul blueprint (`#58A6FF`), terminal slate (`#0D1117`), verde 200 OK (`#3FB950`).

---

## 5. Briefing Conversacional Inteligente

Evitar questionários exaustivos com 10 perguntas mecânicas. Perguntar apenas o que:
1. Impacta diretamente a arquitetura visual;
2. Não pode ser deduzido do prompt nem do repositório.

- Se o usuário disser *"Crie um vídeo sobre como funciona uma API"*:
  -> O sistema deduz: pedagógico, público técnico/iniciante, sem CTA comercial. Propor 35-40s vertical/horizontal com diagramas de pacotes HTTP.
- Se o usuário disser *"Crie um vídeo publicitário de 15s para a confeitaria Aurora usando estas fotos"*:
  -> O sistema deduz: comercial B2C, 15s, ritmo dinâmico, extração de benefícios das fotos, necessidade de CTA.
- Se o usuário disser *"Quero um vídeo sobre animais do fundo do mar para Instagram"*:
  -> O sistema deduz: divulgação científica/entretenimento, 9:16 vertical, sem CTA de venda.

---

## 6. Matriz de Roteamento de Especialistas

| Classificação da Demanda | Linguagem Visual Primária | Especialista Responsável | Suporte / Integração |
|---|---|---|---|
| **Educação Técnica / Algoritmos / Arquitetura** | Explainer Motion / Diagramas Vivos | **`explainer-motion`** | `diagram-design` · `motion-core` |
| **Ciência / Natureza / Descobertas** | Scientific Visualization | **`explainer-motion`** | Pesquisa Factual · `media-use` |
| **Processos Industriais / Manufatura** | Animated Infographic / Linha do Tempo | **`explainer-motion`** | `diagram-design` · `frame.js` |
| **Publicidade B2C / Serviços / Teaser Rápido** | Commercial Motion / Beat Sync | **`motion-director`** | `motion-designer` · `brand` |
| **Showcase de Software / Apps / Bento Grid** | UI Motion / Cursor Interativo | **`motion-director`** | **`stageshow`** (opcional) |
| **Experiência 3D / WebGL Cinematográfico** | 3D Scene / GLB Pipelines | **`3d-scene-director`** | `web-director` · Three.js |
| **Carrossel Social em Lâminas (4:5)** | Editorial Slide Deck | **`carousel-studio`** | `feed-studio` · `renderStatic` |
| **Stories Sequenciais (9:16)** | Story Vertical | **`story-studio`** | Remotion / Chromium |
| **Aula Interativa com Feedback e Exercícios** | Interactive Mental Model HTML | **`aula-interativa`** | Gabriel Greco Skills |
| **Edição de vídeo gravado (talking-head, entrevista, tutorial, podcast, Reels de celular)** | Edição real · cortes · legendas · voz | **`reel-editor`** | **`voice-studio`** · `motion edit` · STT local |
| **Lançamento de app/feature, teaser, filme de produto, logo em 3D** | Filme de produto (`ui-launch` / `cinema-3d`) | **`cinematic-product-director`** | `3d-scene-director` · `motion-director` |
| **Short narrado a partir de texto, história ou versículo** | Short ilustrado | **`shorts-director`** | TTS · legendas |

**Precedência:** carrossel, stories, post e site ficam nos estúdios próprios, mesmo quando o assunto é lançamento;
depois vem gravação existente (`reel-editor`), short narrado (`shorts-director`) e só então filme de produto
(`cinematic-product-director`).

**Vídeo existente ≠ motion do zero.** Quando o usuário traz uma gravação e pede para editar,
cortar pausas, legendar, melhorar o áudio ou "transformar em Reels", encaminhe ao **`reel-editor`**
(e ao **`voice-studio`** se o pedido for só áudio). Não recrie a cena em código nem escreva FFmpeg
à mão: o motor `motion edit` faz análise, transcrição local, cortes, legendas, render e QA.

---

## 7. Integração da Skill Opcional `stageshow`

Para produções que envolvam demonstrações de aplicações e interfaces:
- **Repositório:** `benjitaylor/skills` (Benji Taylor).
- **Licença:** MIT (código e componentes).
- **Comando de Instalação:** `npx skills add benjitaylor/skills --skill stageshow`.
- **Casos de Uso Apropriados:** UI motion, animação suave de cursor (mover, clicar, selecionar), layouts bento grid para exibição de features, microinterações de produto digital.
- **Restrição Rigorosa:** Não usar `stageshow` para biologia, natureza, processos físicos de alimentos ou publicidade de artesanato/confeitaria.

---

## 8. Quality Gates da Produção

Toda produção do MOTION Studio obedece ao fluxo de portões de qualidade:
1. **Portão 1 — Briefing & Intenção:** Aprovação do conceito, público, canal e duração calculada.
2. **Portão 2 — Pesquisa & Grounding:** Validação factual de premissas científicas/técnicas.
3. **Portão 3 — Direção de Arte (STYLE.md):** Aprovação da paleta semântica, tipografia e lista de "o que evitar".
4. **Portão 4 — Storyboard & Pacing:** Aprovação da divisão cena a cena em frames exatos.
5. **Portão 5 — Prévia & Contact Sheet:** Validação visual de stills antes do render de vídeo completo.
6. **Portão 6 — Crítico Independente:** Auditoria de continuidade, legibilidade, tempo de leitura e conformidade técnica (30 FPS CFR, 0px overflow).
7. **Portão 7 — Entrega & Manifesto:** Geração de MP4/PNG, `assets.manifest.json` com SHA-256 e pacote ZIP.

## Recursos visuais, SVG e QA automático (infraestrutura compartilhada)

O usuário descreve o resultado em linguagem natural: **você** escolhe os recursos. Nunca peça a ele bibliotecas de ícones, SVG, FFmpeg ou correção de imports.

1. **Recursos visuais (ícones, ícones animados, logos de tecnologias, personagens, ilustrações, Lottie):** `motion assets pick "<conceito>"` (API `createAssetSession().asset()` de `@technomanceer/motion-core`). O registry de providers decide o tipo e a fonte; você decide **quando** usar cada tipo (ícone para ideia abstrata, logo só quando a tecnologia é citada, personagem quando pessoas fazem sentido, ícone animado/Lottie quando o movimento comunica). Uma sessão por produção = um estilo de ícone; assets diferentes para intenções diferentes. `fallback: true`, confiança `low` ou candidatos `blocked` (licença) ⇒ troque o conceito ou crie um SVG original. Ao entregar, inclua `session.credits().markdown` (atribuições obrigatórias, ex.: Humaaans CC-BY, marcas de tecnologias).
2. **Fundos, ilustrações e diagramas vetoriais:** `motion svg component <waveLayers|networkGraph|ringProgress|flowArrow|orbitRings|gridPattern> --tokens=<tokens.json da marca>`. SVG de terceiros passa por `motion svg validate` (não confiável ⇒ sanitizado). Cores vêm dos tokens, nunca hard-coded.
3. **Animação vetorial:** `@technomanceer/motion-core/svg-motion` (`createSvgMotion` + `window.__onFrame__`). Proibido SMIL, CSS keyframes, `requestAnimationFrame` e `Math.random` em vídeo.
4. **Proveniência:** registre `session.manifest()` no `assets.manifest.json`. Logotipos/marcas só a partir de assets fornecidos pelo usuário — nunca recriar nem recolorir.
5. **Gates automáticos:** um render com `status: "FAIL"` (erro de JS, import quebrado, imagem essencial quebrada, controlador ausente) **nunca** segue adiante, mesmo que o arquivo exista. Antes do Crítico rode `motion qa precheck projects/<slug>` (gera `reviews/qa-report.{json,md}`; estados PASS/WARN/FAIL/BLOCKED/NOT_TESTED; heurística ≠ prova). O Crítico lê esse relatório **e** os renders.
6. **Direção de arte:** siga `docs/ART_DIRECTION.md` — ponto focal, dispositivo visual e diferença em relação à cena anterior por cena; sem cenas repetidas, vazias ou com excesso de texto.
