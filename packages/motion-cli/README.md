# @technomanceer/motion-cli

Interface de linha de comando (CLI) do **MOTION Studio**.

Executa operações reais de inicialização, diagnóstico, scaffold, preview, renderização determinística, auditoria de QA e exportação de pacotes de entrega.

## Comandos Principais

```bash
# Diagnóstico de requisitos do sistema (Node, Python, FFmpeg, Chromium, etc.)
motion doctor

# Inicializa o estúdio no projeto atual (cria motion.config.json e instala skills)
motion init --brand="MinhaMarca"

# Lista especialidades disponíveis e capacidades dos motores
motion list

# Cria scaffolds de entregáveis reais
motion create website nova-landing
motion create video teaser-15s
motion create carousel carrossel-produto

# Renderizações determinísticas
motion render static page.html out.png --width=1080 --height=1350
motion render frames composition.html ./frames --frames=450 --fps=30
motion render video ./frames final.mp4 --fps=30
motion render carousel ./slides ./out

# Componentes parametrizados e WebM VP9 com alpha real
motion components list
motion components render animated-ranking --config=ranking.json --output=ranking.webm
motion render overlay ./overlay.html --output=overlay.webm --duration=5 --fps=30

# Transições, determinismo e safe zones
motion transition render scene-a.mp4 scene-b.mp4 --output=joined.mp4 --kind=push --easing=quint
motion qa determinism ./composition.html --output=./qa/determinism
motion qa safe-zones ./composition.html --platform=instagram-reels --output=./qa/safe-zones

# Auditoria de QA multi-viewport em 5 telas
motion qa http://localhost:3000 ./qa-report

# Exportação com manifesto SHA-256 e ZIP
motion export ./meu-projeto entrega.zip --gallery
motion qa delivery --project ./meu-projeto --zip entrega.zip

# Servidor MCP local por stdio (iniciado pelo agente/cliente configurado)
motion mcp --workspace=/caminho/do/projeto --max-concurrency=2
```

O MCP expõe os motores locais do Core sem abrir portas de rede. Configuração por cliente, inventário completo, limites, privacidade e troubleshooting: [`docs/MCP.md`](../../docs/MCP.md).

The complete contracts, presets, limitations, and validation workflow live in [`docs/REUSABLE_MOTION_COMPONENTS.md`](../../docs/REUSABLE_MOTION_COMPONENTS.md).

`@technomanceer/motion-core` is required. `@technomanceer/motion-studio-skills` is an optional peer: without it, `init` still creates project configuration and directories, and `list` still reports capabilities. Install the curated Skills package separately when desired.
