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
  - `Node.js`: Versão `>= 18.0.0`
  - `Python 3`: Versão `>= 3.9`
  - `FFmpeg`: Versão e presença no PATH
  - `Chromium (Playwright)`: Detecção automática em cache ou binários do sistema
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
- Opções: `--frames=N`, `--fps=30`, `--width=W`, `--height=H`, `--scale=1`, `--seed=1`.

#### `render video <frames_dir> <output.mp4>`
- Monta MP4 CFR 30fps YUV420p a partir de uma pasta de frames.
- Valida grade temporal sem saltos.
- Opções: `--fps=30`, `--audio=<arquivo>`, `--crf=18`.

#### `render carousel <slides_dir> <outdir>`
- Renderiza todos os slides HTML em escala 1x (1080×1350) e retina 2x (2160×2700).
- Executa validação estática dimensional automática.

#### `render project <pasta_do_projeto>`
- Detecta automaticamente se o projeto é vídeo (`composition.html`) ou carrossel (`slides/`) e executa o pipeline completo.

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

---

### `motion export <pasta> <saida.zip>`
Gera a entrega final do projeto:
1. Calcula somas de verificação criptográficas SHA-256 e gera `assets.manifest.json`.
2. Empacota fontes editáveis, imagens, vídeos e metadados no arquivo ZIP.
3. Se passado `--gallery`, registra o item na galeria local com status `draft`.
