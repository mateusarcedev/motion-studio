---
name: cinematic-product-director
description: Dirige filmes de produto, lançamentos de app/feature e filmes de marca com linguagem de cinema — modo ui-launch (interface real em 2D, guiada pela música) ou cinema-3d (objetos e logo em 3D físico, UI real como textura). Use quando pedirem vídeo de lançamento, teaser de feature, filme de produto, "vídeo estilo Apple", logo em 3D ou quiserem transformar telas do app num filme. Não use para editar vídeo já gravado (reel-editor) nem para shorts narrados a partir de texto (shorts-director).
---

# Cinematic Product Director

Especialista do `studio-director` para filmes curtos de produto (15–60 s) em que a qualidade percebida
vem de três coisas: **o produto de verdade na tela, a música conduzindo o tempo e cada cena nascendo da
anterior**. Efeito sem função é ruído; esta Skill corta antes de acrescentar.

Segue integralmente `CLAUDE.md` e `pipeline.md`: BRIEF ✋ → STYLE ✋ → STORYBOARD → composição
frame-driven → stills → render → QA → Crítico (contexto novo) → reparo (máx. 2 rodadas) → entrega.
Nada aqui suspende um gate.

## Quando é esta Skill (e quando não é)

| Pedido | Rota |
|---|---|
| "vídeo de lançamento da feature X", "teaser do app", "filme do produto", "logo 3D abrindo o vídeo" | **esta Skill** |
| "edita esse vídeo que eu gravei", "tira as pausas", "legenda meu reel" | `reel-editor` |
| "transforma esse texto/versículo num short narrado" | `shorts-director` |
| cena 3D sem narrativa de produto (showroom, objeto girando) | `3d-scene-director` |
| landing page, site | `web-director` |
| vídeo explicativo genérico, motion de dados | `motion-director` |

Se o pedido mistura (ex.: gravação do fundador + telas do app), divida: `reel-editor` trata a filmagem,
esta Skill dirige os inserts de produto, e o `motion-director` orquestra a montagem.

## Os dois modos

Escolhido no BRIEF (`mode`). Na dúvida, `ui-launch`: é mais barato, mais legível no celular e mostra o
produto melhor.

| | `ui-launch` | `cinema-3d` |
|---|---|---|
| Protagonista | a interface real, reconstruída em HTML/CSS | logo/objeto em 3D físico, UI como textura em superfícies |
| Motor | composição frame-driven (`frame.js`) ou HyperFrames | `3d-scene-director` (Three.js) + composição |
| Custo de render | baixo | alto (minutos por segundo de filme) |
| Bom para | feature nova, fluxo do usuário, SaaS | lançamento de marca, produto físico, abertura/fechamento icônico |
| Referência | `references/ui-launch.md` | `references/cinema-3d.md` |

Um filme pode usar `cinema-3d` só na abertura e no fecho e `ui-launch` no miolo — declare isso no BRIEF.

## Fluxo

1. **Brief** — `references/brief.md`. Pergunte só o que bloqueia. Peça prints/código do app, logo
   oficial, música e 1–3 referências. Grave o bloco `product-brief` no `BRIEF.md`. ✋
2. **Estudar referências** — `references/reference-breakdown.md`. Rode
   `scripts/ref_analyze.py` e escreva a leitura em números (duração de planos, pausas, escala de texto,
   transições). Copie a linguagem, nunca a marca nem a composição característica.
3. **Mapear a música** — `references/music-first.md`. Rode `scripts/beat_map.py` → `beats.json`.
   A linha do tempo é construída sobre compassos, não sobre segundos redondos. Se `tempoAmbiguous` for
   `true`, **não siga**: use `assets.musicBpm` do BRIEF em `--bpm-hint` ou peça à pessoa que confirme o BPM
   entre os `tempoCandidates`. Nunca escolha a oitava sozinho.
4. **Ideia central** — ofereça 2–3 conceitos, cada um numa frase, descrevendo o fio que costura todas
   as cenas; a escolha é da pessoa. Registre no `STYLE.md` junto com paleta, tipografia, vocabulário de
   movimento e lista de proibições. ✋
5. **Storyboard por batidas** — tabela `tempo · compasso · tela · movimento · o que passa para a
   próxima`. Estruturas de partida em `references/structures.md` (opcionais).
6. **Construir cena a cena**, conferindo stills a cada cena nova (`render_frames.mjs --sample-frames`).
7. **Som** — `references/audio-and-delivery.md`: trilha editada em compassos, SFX de interface
   discretos, narração opcional com pronúncia conferida por humano, loudness medido depois do encode.
8. **Clipes gerados por IA** (opcional) — `references/generated-clips.md`. Custo mostrado e aprovado
   antes de cada geração.
9. **Render, QA e Crítico** — checklist em `references/critic-checklist.md`; `motion qa`, `motion qa
   frames`, Crítico em contexto novo.
10. **Entrega** — `motion export` com o contrato do projeto; versões 16:9 e 9:16 são **recomposições**,
    não recortes. Versão leve para mensageiro com `scripts/export_whatsapp.sh` (perfil a migrar para
    `motion export`).

## Princípios (o que separa estúdio de template)

1. **Produto real.** Textos, botões, ícones e fluxo saem dos prints ou do código. Se falta uma tela
   essencial, peça. Nunca invente métrica, depoimento ou funcionalidade (`CLAUDE.md` regra 2).
2. **Logo oficial confirmada.** Repositórios costumam ter versões antigas. Pergunte qual é a vigente e
   guarde a referência aprovada em `assets/brand/`.
3. **A música manda.** Mudanças importantes caem em batida; a virada principal mora na volta da
   bateria depois de uma quebra; momentos explicativos usam trechos sem percussão.
4. **Continuidade.** Toda cena herda algo da anterior — um elemento cresce, se desloca, muda de
   função. Corte seco é exceção deliberada (rajada de impacto, fecho).
5. **Repertório sem repetição.** Cada recurso marcante aparece uma vez. Repetir o mesmo truque
   denuncia falta de ideia.
6. **Pouco texto, grande o suficiente.** Escala relativa à menor dimensão do quadro
   (`references/ui-launch.md`). Texto nunca surge pronto: entra por palavra ou letra com leve subida e
   foco chegando.
7. **Câmera com intenção.** Movimento suave e motivado. Energia se cria com o tempo de entrada dos
   elementos sobre a música; câmera sacudindo só disfarça a falta dela.
8. **Paleta curta.** Cor de destaque só onde carrega significado.
9. **Respiro.** Pelo menos um trecho calmo; é ele que dá peso aos impactos.
10. **Legibilidade antes de efeito.** Grão, bloom, aberração e vinheta são opcionais e sutis. Se
    alguém pausar em qualquer quadro, precisa ler e entender o que vê.
11. **Determinismo.** Estado visual = função do frame e de uma seed explícita. Nada de relógio real
    nem `Math.random()`.
12. **Ajuste o que foi pedido.** No feedback, mude só aquilo, preserve o aprovado e guarde cada versão.

## Ferramentas desta Skill

| Script | O que faz | Status |
|---|---|---|
| `scripts/beat_map.py <audio> --fps 30 [--bpm-hint BPM]` | BPM, batidas, tempos fortes e compassos alinhados ao grid de frames → `beats.json` | candidato a `motion audio beats` |
| `scripts/ref_analyze.py <video>` | folha de contato, cortes, candidatos para revisão (`reviewCandidates`), duração de planos → `ref-analysis.json` | candidato a `motion ref analyze` |
| `scripts/export_whatsapp.sh [--force] <master.mp4> [MB] [saida]` | versão 720p em duas passagens abaixo do limite de tamanho | candidato a perfil de `motion export` |

`beat_map.py` precisa de numpy e scipy (`pip install -r scripts/requirements.txt`); sem eles, `NOT_TESTED`.
Descubra a sintaxe real da CLI instalada (`motion --help`) antes de chamar comandos; não invente flags.

## Serviços externos (todos opcionais)

- **TTS / trilha / SFX pagos** (ElevenLabs ou similar): só com aprovação explícita de provedor,
  estimativa e escopo. Chaves nunca em arquivo, log ou saída.
- **Agentes hospedeiros** (Gemini/Antigravity `agy`, Codex, OpenCode): podem executar esta Skill. Nunca
  rodar com flags que pulam permissões, nunca ler tokens OAuth, nunca remover configuração de MCP
  existente sem backup e autorização.
- **Geração de vídeo por IA** via MCP: ver `references/generated-clips.md`.

Indisponível ⇒ registrar `NOT_TESTED`/`BLOCKED` e seguir com o caminho local; nunca fingir entrega.
