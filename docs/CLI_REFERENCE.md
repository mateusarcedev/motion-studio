# Referência da Linha de Comando (CLI) — `motion`

A CLI do MOTION Studio unifica todos os motores determinísticos e ferramentas de produção.

---

## Sintaxe Global

```bash
motion <comando> [argumentos] [opções]
```

---

## Comandos

### `motion init`
Inicializa a estrutura do MOTION Studio no diretório atual.

- **Opções:**
  - `--brand=<nome>`: Nome da marca (padrão: nome do diretório).
  - `--force`: Sobrescreve `motion.config.json` e arquivos existentes.
- **Arquivos criados:**
  - `motion.config.json`
  - `motion/brand/tokens.json`
  - `motion/brand/PROFILE.md`
  - `motion/gallery.json`
  - `.agents/skills/` (com adaptadores `.claude/skills` e `.opencode/skills`)

---

### `motion doctor`
Executa o diagnóstico de saúde do ambiente e checa pré-requisitos de sistema.

- **Verificações executadas:**
  - `Node.js`: Versão `>= 20.0.0`
  - `Python 3`: Versão `>= 3.9`
  - `FFmpeg`: Versão e presença no PATH
  - `Chromium (Playwright)`: confirma que o executável **da revisão fixada pelo Playwright instalado** existe e executa um *smoke test* real (abre, renderiza, avalia JS). Um diretório `chromium-*` de outra revisão **não** é PASS. Diferencia `MOTION_BROWSER_MISSING`, `MOTION_BROWSER_VERSION_MISMATCH`, `MOTION_BROWSER_SYSTEM_DEPS` e `MOTION_BROWSER_LAUNCH_FAILED`, com a instrução de correção. `CHROME_PATH`/Chrome do sistema funcionam como `WARN`. Nada é instalado automaticamente.
  - `Three.js`: Detecção em `node_modules`
  - `Blender`: Checagem opcional de CLI
  - `Chatterbox TTS`: Checagem opcional de biblioteca Python

---

### `motion list` / `motion specs`
Exibe a matriz de especialidades do estúdio e o status de todos os motores disponíveis.

---

### `motion create <tipo> <nome>`
Cria o scaffold completo de um novo projeto criativo.

- **Tipos suportados:**
  - `website`: Cria landing page responsiva com canvas animado/3D, tokens e acessibilidade.
  - `video`: Cria composição 16:9 determinística (450 frames @ 30fps) com `frame.js`.
  - `carousel`: Cria carrossel de 5 slides HTML (1080×1350) com narrativa progressiva e legenda.
  - `story`: Cria template vertical 9:16 (1080×1920) com safe-zones.
  - `post`: Cria card social estático 1:1 ou 4:5.

---

### `motion preview [caminho]`
Inicia um servidor HTTP local de alta velocidade para inspecionar HTML, vídeos e contact sheets.

- **Opções:**
  - `--port=<num>`: Porta do servidor (padrão: `3300`).

---

### `motion render <subcomando>`
Executa renderizações com motores nativos de código.

#### `render static <input.html> <output.png>`
- Renderiza HTML para PNG via Playwright/Chromium.
- Opções: `--width=W`, `--height=H`, `--scale=N`, `--wait=ms`.
- Detecta e reporta overflow e fontes faltando no console.

#### `render frames <composition.html> <outdir>`
- Renderiza sequência de frames (`0000.png` ... `NNNN.png`) em uma única instância de navegador.
- Opções: `--frames=N`, `--fps=30`, `--width=W`, `--height=H`, `--scale=1`, `--seed=1`, `--start=`/`--end=`.
- `--sample-frames=0,120,240-250,899` renderiza **somente** esses quadros (índices e intervalos `A-B`, ordem preservada; duplicatas, valores fora de `0..frames-1` e sintaxe inválida são rejeitados antes de abrir o navegador com `MOTION_INVALID_SAMPLE_FRAMES`). O relatório traz `producedFrames` e confere pedido = produzido.
- Também: `--transparent`, `--inspect-bounds`, `--optional-assets=padrao*,...`, `--allow-no-controller`.
- **Falha de verdade**: erro de JavaScript, import de módulo quebrado, controlador `window.__onFrame__` ausente ou imagem/recurso essencial com falha ⇒ `status: "FAIL"`, exit 4 e `health.errors[]` (veja [QA.md](QA.md)).

#### `render video <frames_dir> <output.mp4>`
- Monta MP4 CFR 30fps YUV420p a partir de uma pasta de frames.
- Valida grade temporal sem saltos.
- Opções: `--fps=30`, `--audio=<arquivo>`, `--crf=18`.

#### `render carousel <slides_dir> <outdir>`
- Renderiza todos os slides HTML em escala 1x (1080×1350) e retina 2x (2160×2700).
- Executa validação estática dimensional automática.

#### `render project <pasta_do_projeto>`
- Detecta automaticamente se o projeto é vídeo (`composition.html`) ou carrossel (`slides/`) e executa o pipeline completo.

#### `render overlay <composition.html> --output=<overlay.webm>`
- Exporta um overlay com VP9 e alfa real; opções: `--duration`, `--fps`, `--width`, `--height`, `--scale`, `--seed`.

#### `components list|preview|render`
- `motion components list` exibe IDs e parâmetros.
- `motion components preview <id> --config=<json> --output=<poster.png>` gera um preview de frame.
- `motion components render <id> --config=<json> --output=<video.mp4|overlay.webm>` executa a timeline parametrizada.

#### `transition list|preview|render`
- Componha duas ou mais cenas com `--kind`, `--duration`, `--offset`, `--direction`, `--easing`, `--softness`, `--accentColor` e `--easingCoefficients`.
- `preview` usa 640×360 a 15fps por padrão. Transições entre cenas são opacas e separadas do pipeline de overlays transparentes.

---

### `motion qa <url_ou_html> <outdir>`
Executa auditoria automatizada multi-viewport em 5 telas:
1. `mobile-s`: 360×740
2. `mobile`: 390×844
3. `tablet`: 768×1024
4. `desktop`: 1280×800
5. `wide`: 1920×1080

Verifica:
- Overflow horizontal
- Alvos de toque pequenos (`< 44px`)
- Telas ou canvases em branco
- Erros de console e requisições HTTP falhadas
- Captura screenshots fold e full-page em cada resolução
- Salva `report.json` e `report.md`

#### `motion qa determinism <composition.html>`
- Renderiza tempos selecionados em dois processos Playwright limpos, compara SHA-256 dos PNGs e produz A/B + diff quando divergirem.
- Registra fontes, Chromium, Playwright, FFmpeg, FFprobe, riscos estáticos e o limite da garantia (sem identidade binária universal de MP4).

#### `motion qa media|frames|precheck`
- `motion qa media <arquivo.mp4> [--width --height --fps --duration --audio --codec]`: codec, resolução, CFR, duração, decodificação, áudio, sincronismo, silêncio, loudness/clipping, pretos/congelados.
- `motion qa frames <pasta> [--expected=N]`: quadros vazios/escuros/repetidos (heurísticas) e animação ausente.
- `motion qa precheck <projeto>`: gera `reviews/qa-report.{json,md}` para o Crítico. Exit 2 = `FAIL`, 3 = `BLOCKED`. Estados e regras em [QA.md](QA.md).

#### `motion qa safe-zones <composition.html>`
- Use `--platform=instagram-reels|instagram-stories|tiktok|youtube-shorts|youtube-horizontal|feed-4-5|square-1-1` ou `--platform=custom --preset-file=<json>`.
- Analisa `[data-motion-important]` ao longo da timeline e salva overlays e previews de QA separados do vídeo final. Presets sociais são heurísticas versionadas do MOTION, não especificações oficiais permanentes.

---

### `motion assets` · `motion svg` (agentes e desenvolvedores)
O usuário final **não precisa** destes comandos: as Skills usam as mesmas APIs. Detalhes em [VISUAL_INTELLIGENCE.md](VISUAL_INTELLIGENCE.md).
- `motion assets resolve "<intenção>" [--size --stroke --color --svg]`, `motion assets search "<consulta>" [--limit]`, `motion assets packs`.
- `motion svg validate <arq.svg> [--strict]`, `motion svg optimize <in> <out> [--prefix=ns]`, `motion svg rasterize <in> <out.png> [--width --scale --background]`, `motion svg component <nome> [out.svg] [--seed --tokens]`.
- `render static ... --qa-visual` acrescenta texto cortado, contraste, texto minúsculo e excesso de texto ao relatório.

---

### `motion export <pasta> <saida.zip>`
Gera a entrega final do projeto:
1. Calcula somas de verificação criptográficas SHA-256 e gera `assets.manifest.json`.
2. Empacota fontes editáveis, imagens, vídeos e metadados no arquivo ZIP.
3. Se passado `--gallery`, registra o item na galeria local com status `draft`.
