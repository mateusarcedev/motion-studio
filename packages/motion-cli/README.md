# motion-cli

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

# Auditoria de QA multi-viewport em 5 telas
motion qa http://localhost:3000 ./qa-report

# Exportação com manifesto SHA-256 e ZIP
motion export ./meu-projeto entrega.zip --gallery
```
