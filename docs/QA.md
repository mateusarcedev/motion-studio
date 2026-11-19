# QA automatizado

Estados (nunca marque aprovado o que não foi executado):

| Estado | Significado |
|---|---|
| `PASS` | executado e atendeu |
| `WARN` | executado; risco não bloqueante (toda heurística cai aqui, nunca como prova) |
| `FAIL` | executado e reprovou |
| `BLOCKED` | o ambiente impediu a execução — o relatório traz **como validar externamente** |
| `NOT_TESTED` | não executado |

Veredito agregado: `FAIL` > `BLOCKED` > `NOT_TESTED` > `WARN` > `PASS` (um check obrigatório não executado impede `PASS`).

## Renderização (falha, não aviso)

`render_static`/`render_frames` retornam `status: "FAIL"` (exit 4) e um JSON com `health.errors[]` quando há:

| Código | Causa |
|---|---|
| `MOTION_RENDER_PAGE_ERROR` | exceção de JavaScript / falha do controlador |
| `MOTION_RENDER_MODULE_IMPORT` | `import` que não resolve (ex.: `Failed to resolve module specifier`) |
| `MOTION_RENDER_CONTROLLER_MISSING` | sem `window.__onFrame__` em render por quadro (resultaria num quadro parado). `--allow-no-controller` para composições realmente estáticas |
| `MOTION_RENDER_ASSET_FAILED` | imagem/CSS/script/mídia com 404, rede, bytes inválidos. Opcionais: `data-optional` no elemento ou `--optional-assets=padrao*` → viram `WARN` |

Fontes que não carregam são `WARN` (há fallback tipográfico). `pageErrors` continua exposto por compatibilidade.
`render_frames` falha cedo (não gasta tempo renderizando uma composição quebrada) e confere que os quadros pedidos = produzidos.

## Navegador (`motion doctor`)

PASS exige o executável **da revisão fixada pelo Playwright** instalado + *smoke test* real (abrir, renderizar, avaliar JS, fechar).
Diferencia: `MOTION_BROWSER_MISSING`, `MOTION_BROWSER_VERSION_MISMATCH` (há `chromium-<outra revisão>`), `MOTION_BROWSER_SYSTEM_DEPS`
(`npx playwright install-deps chromium`), `MOTION_BROWSER_LAUNCH_FAILED`. `CHROME_PATH`/Chrome do sistema funcionam como `WARN` (testados, mas não fixados).
Nada é instalado automaticamente.

## Vídeo / áudio — `motion qa media <arquivo> [--width --height --fps --duration --audio --codec]`
Codec, resolução, **CFR**, duração, contagem de quadros, decodificação completa, presença de áudio, sincronismo/início do áudio,
silêncio, loudness (EBU R128) e *true peak* (clipping), trechos pretos e quadros congelados. Sem `ffmpeg`/`ffprobe` → `BLOCKED`.

## Quadros — `motion qa frames <pasta> [--expected=N]`
Quadros vazios, escuridão, contraste tonal baixo, repetição/“gêmeos visuais”, animação ausente (todos idênticos = `FAIL`).
Composição: `motion render static … --qa-visual` → texto cortado, contraste (WCAG), texto minúsculo, excesso de texto.
Determinismo: `motion qa determinism`. Áreas seguras: `motion qa safe-zones`.

## Projeto → Crítico — `motion qa precheck projects/<slug>`
Gera `reviews/qa-report.json` e `.md`. Itens sem vídeo/quadros viram `NOT_TESTED`, nunca `PASS`.
