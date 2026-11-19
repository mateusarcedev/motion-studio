# Missão 19: artefatos de homologação

Este diretório contém as configurações parametrizadas, o roteiro reprodutível e os artefatos da Missão 19. Os dados do ranking e da comparação são fictícios. As imagens de fundo da Produção C e as cenas da comparação de transições são padrões sintéticos de demonstração, gerados localmente com FFmpeg.

## Reproduzir

Na raiz do monorepo, com Chromium/Playwright e FFmpeg instalados:

```bash
node projects/mission-19/render-productions.mjs
```

O comando escreve `projects/mission-19/productions/final/`, incluindo vídeos, posters, frames de QA, contact sheets, relatórios JSON e `assets.manifest.json`. A execução falha se determinismo, safe zones ou alfa de uma das duas exportações WebM falhar.

Empacotar e verificar uma instalação consumidora independente:

```bash
npm run pack:all
node projects/mission-19/test-consumer-install.mjs
```

O teste instala os tarballs locais em um diretório isolado sob `/tmp`, importa `motion-core` a partir de `node_modules` do consumidor e renderiza MP4, WebM, determinismo e safe zones. Ele não acessa módulos-fonte do monorepo em runtime e não publica pacotes no npm. O resultado mais recente está em `consumer-compatibility.json`.

## Artefatos principais

- `productions/final/A-ranking/`: MP4 9:16 e 16:9, WebM VP9 com alfa, variante de dados, posters, frames e contact sheets.
- `productions/final/B-api-explainer/`: vídeo explicativo montado de três cenas conectadas com transições push e easing.
- `productions/final/C-alpha-overlay/`: WebM de comparação e composições sobre fundo claro, escuro e vídeo em movimento.
- `productions/final/transition-showcase/`: reel comparativo das oito transições.
- `productions/final/homologation.json`: metadados FFprobe, gates, amostras de alfa, relatórios QA e tempos medidos.
- `productions/final/assets.manifest.json`: hashes SHA-256 dos arquivos da execução.

O relatório consolidado está em [`REUSABLE_MOTION_COMPONENTS_REPORT.md`](../../docs/reports/REUSABLE_MOTION_COMPONENTS_REPORT.md). O guia de uso está em [`docs/REUSABLE_MOTION_COMPONENTS.md`](../../docs/REUSABLE_MOTION_COMPONENTS.md).
