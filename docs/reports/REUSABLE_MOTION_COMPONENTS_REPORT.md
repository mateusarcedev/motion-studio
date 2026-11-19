# Relatório — Reusable Motion Components & Advanced Rendering

**Missão 19 · MOTION Studio · 16 de novembro de 2026**

## Resultado

As cinco capacidades foram implementadas sobre o Creative Core já existente: componentes paramétricos, exportação VP9/WebM com alfa verificado, transições FFmpeg com easing, determinismo por frames entre sessões limpas, e QA temporal de safe zones. Há APIs de pacote, CLI, integração opcional para diretores, documentação e três produções de homologação. A instalação consumidora foi testada a partir dos tarballs locais da versão existente `1.0.0-rc.3`; nenhum pacote foi publicado.

## Auditoria inicial

| Capacidade | Já existia? | Limitações encontradas | Implementação nesta missão |
|---|---|---|---|
| Geradores parametrizados | Parcial: Creative Core aceitava composições próprias, mas não havia catálogo declarativo de componentes reutilizáveis | Sem IDs, schemas, defaults e API comum de preview/render | Registro de oito componentes validados sobre o driver Playwright existente |
| WebM transparente | Parcial: FFmpeg já montava vídeos MP4 a partir de frames | Sem exportação VP9 com alfa nem inspeção decodificada do canal alfa | Exportador preserva MP4 e acrescenta VP9 WebM com sinalização e inspeção alfa real |
| Transições com easing | Parcial: montagem FFmpeg existente | Sem contrato comum para biblioteca de `xfade`, curvas ou transições encadeadas | API JS/Python e CLI para oito transições com curvas e parâmetros |
| Determinismo entre renders | Parcial: frame driver e manifestos SHA-256 já existiam | Sem duas sessões independentes, comparação amostrada e artefatos A/B/diff | QA abre dois renderizadores separados, compara hashes de PNG e bloqueia divergências/fontes/erros |
| Safe zones | QA visual e bounds de renderização já existiam | Sem presets versionados por formato, temporal sampling e alertas de colisão | Presets configuráveis, detecção de bounds importantes e overlay de evidência fora do vídeo final |

### Superfícies mapeadas

- **Creative Core e renderização:** Playwright, renderização estática e por frames, driver temporal determinístico, FFmpeg e QA de viewport foram reutilizados. Não foi criado um segundo motor.
- **HTML/Canvas/SVG e assets:** renderizador HTML existente permaneceu; os componentes geram HTML/SVG com timeline por frame, carregamento de fontes e imagens antes da medição/captura.
- **Exportação e integridade:** assembler e manifestos SHA-256 existentes foram ampliados; MP4 continua H.264/yuv420p. O WebM é um caminho adicional.
- **Agentes e Skills:** `studio-director`, `motion-director` e `explainer-motion` receberam notas de descoberta/uso opcional. A direção criativa continua com o especialista e não é substituída por templates.
- **CLI/npm:** CLI existente ganhou grupos `components`, `transition`, `render overlay` e `qa determinism|safe-zones`. Os exports de pacote foram incluídos em `motion-core` e os tarballs foram testados sem publicação.
- **Galeria e consumidores:** galeria e produções já publicadas foram preservadas. Uma aplicação temporária em `/tmp` verificou a instalação pública via tarballs locais sem resolução do monorepo em runtime.

A referência técnica foi estudada nos arquivos `engine/render_core.py`, `engine/transicoes.py`, `verify.py`, `pieces/`, `README.md` e `LICENSE`. Foram aproveitadas como ideias a geração parametrizada, as expressões de easing para transições e a comparação de execuções independentes. O MOTION implementa esses contratos sobre seu renderizador e QA, sem portar a arquitetura ou arquivos do projeto de referência.

## Arquitetura e API

`packages/motion-core/components/` define IDs estáveis, JSON Schemas, defaults explícitos, validação estrita, metadados de proveniência, geração de HTML, preview e render. As oito primitivas são:

1. `animated-counter`
2. `animated-ranking`
3. `comparison-panel`
4. `timeline-sequence`
5. `progress-gauge`
6. `kinetic-text-reveal`
7. `image-reveal`
8. `data-callout`

Cada componente aceita duração, FPS, aspect ratio, tema e ID de instância. O conteúdo é escapado; layouts respondem ao formato; títulos longos são restringidos ao espaço de texto; imagens/fontes são aguardadas; e a timeline é chamada por frame. `renderMotionComponent()` e `previewMotionComponent()` são as APIs programáticas centrais.

`packages/motion-core/transitions/` oferece `wipe`, `push`, `slide`, `reveal`, `mask-reveal`, `flash`, `split` e `directional`, com `linear`, `ease-in`, `ease-out`, `ease-in-out`, `cubic`, `quint` e curvas cúbicas customizadas monotônicas. A composição trabalha entre cenas opacas; o fluxo alfa de overlays permanece separado.

`verifyDeterminism()` renderiza instantes idênticos em dois processos Playwright independentes, registra ambiente/fontes/erros e compara SHA-256 de PNGs. Em diferença, grava quadros A/B e imagem de diff. Análise estática de relógio, random, timers e animações autônomas é diagnóstico adicional.

`qaSafeZones()` amostra a timeline, verifica bounds declarados via `[data-motion-important]`, colisões e regiões de atenção e emite relatório, overlay SVG e PNGs de conferência. Os presets carregam a versão `2026-11-16.1` e a origem de cada região; são estimativas MOTION configuráveis, não especificações oficiais. Imagens/vídeos exigem revisão visual quando seus limites internos não são semanticamente conhecidos. Os overlays são evidência de QA, não entram no render final.

## CLI pública

Comandos adicionados e exercitados:

```text
motion components list
motion components preview <id> --config=component.json --output=poster.png
motion components render <id> --config=component.json --output=component.mp4
motion render overlay composition.html --output=overlay.webm --duration=5 --fps=30
motion transition list
motion transition preview scene-a.mp4 scene-b.mp4 --output=preview.mp4 --kind=wipe
motion transition render scene-a.mp4 scene-b.mp4 --output=joined.mp4 --kind=directional --easing=quint
motion qa determinism composition.html --duration=8 --fps=30
motion qa safe-zones composition.html --platform=instagram-reels --duration=8
```

A referência completa de argumentos e schemas está em [`docs/REUSABLE_MOTION_COMPONENTS.md`](../REUSABLE_MOTION_COMPONENTS.md) e [`docs/CLI_REFERENCE.md`](../CLI_REFERENCE.md).

## Produções e evidências

Os caminhos abaixo são relativos à raiz do repositório. A execução consolidada está em `projects/mission-19/productions/final/`; seus resultados completos estão em `homologation.json` e `assets.manifest.json`.

### A — Ranking paramétrico

- `A-ranking/ranking-9x16.mp4`: H.264, 1080×1920, 30 fps, 150 quadros, 5 s.
- `A-ranking/ranking-16x9.mp4`: H.264, 1920×1080, 30 fps, 150 quadros, 5 s.
- `A-ranking/ranking-transparent.webm`: VP9, 1080×1920, 30 fps, 150 quadros, 5 s, `ALPHA_MODE=1`.
- `A-ranking/ranking-9x16-alternate-data.mp4`: nova lista de valores usando o mesmo código-fonte; o SHA-256 do HTML original permaneceu igual antes/depois da troca.
- `poster-9x16.png`, `poster-16x9.png`, `contact-sheet-9x16.png`, `contact-sheet-16x9.png` e frames amostrados.
- Determinismo e safe zones passaram nos formatos vertical e horizontal. O relatório horizontal registra avisos de atenção para dois frames do último item no canto reservado estimado do player; a composição não foi rejeitada, e os overlays estão em `A-ranking-16x9/qa/safe-zones/` para decisão do operador.
- O WebM tem pontos de alfa totalmente transparente e parcial amostrados em início/meio/fim. O resultado alfa real está sob `productionA.renderResults.transparentWebm.alphaSamples`.

### B — Explicação curta de API

- `B-api-explainer/api-request-explainer.mp4`: H.264, BT.709, 1280×720, 24 fps, 210 quadros, 8,75 s.
- Três cenas conectadas: texto cinético, sequência temporal de request/validate/process/respond e callout `200 OK`, montadas com `push` e `ease-in-out`.
- `B-api-explainer/contact-sheet.png` e `B-api-explainer/qa/final-frames/` são evidências visuais.
- Os três componentes passaram determinismo e safe zones. Há alertas de sobreposição com a região heurística dos controles do YouTube horizontal em elementos declarados; os relatórios individuais e previews mostram frame/elemento/região para revisão. São avisos de atenção, não uma afirmação de cobertura semântica do vídeo inteiro.

### C — Overlay em footage

- `C-alpha-overlay/latency-comparison.webm`: VP9, 640×360, 24 fps, 108 quadros, 4,5 s, `ALPHA_MODE=1`.
- `alphaValidation.alphaSamples` mostra `min=0`, `max=255` e pixels parciais em frames 0, 54 e 107. A validação usa decodificação VP9 libvpx e `alphaextract`, não somente o `pix_fmt` simplificado do FFprobe.
- `C-alpha-overlay/composites/bright-background-composite.mp4`, `dark-background-composite.mp4` e `moving-background-composite.mp4` demonstram composição do WebM sobre fundo branco, escuro e `testsrc2` em movimento, respectivamente. A contact sheet está em `C-alpha-overlay/composite-contact-sheet.png`.
- Determinismo e safe zones passaram sem alertas de bounds nessa composição. Os três vídeos compostos têm 640×360, 24 fps e 4,5 s.

### Comparação de transições

`transition-showcase/transition-showcase.mp4` contém as oito transições rotuladas, em H.264/BT.709, 640×360, 24 fps, 28,667 s. `transition-map.json` registra cortes, duração por segmento e easing. As implementações também foram exercitadas com testes de frames de fronteira, transições consecutivas, duração e continuidade.

## Testes e benchmarks

Resultados da homologação nesta máquina, executada em 16/11/2026:

- Node `v24.16.0`; Chromium `153.0.8010.12`; Playwright `1.65.1`; FFmpeg/FFprobe `8.0.1-3ubuntu2`.
- Componentes/schema/escaping/JS gerado: `node --test tests/motion_components.test.mjs` — 6 subtestes do registro/API.
- Safe zones: `node --test tests/safe_zones.test.mjs` — 4 testes.
- Exportação transparente real + composição: `node --test tests/component_render_integration.test.mjs` — 1 teste.
- Duas sessões e mismatch determinístico/A-B/diff: `node --test tests/determinism.test.mjs` — 2 testes.
- Transições Python e FFmpeg: `python3 -m unittest tests.test_transitions tests.test_transitions_ffmpeg` — 8 testes.
- `npm test -- --test-concurrency=1` — 29 testes passaram após a correção final. No sandbox restrito, os testes que iniciam Chromium e processos de regressão falharam ao rodar sem a permissão de processo local; a repetição autorizada fora do sandbox serializou a suíte e passou. O log informa `blender: not found`; essa ferramenta opcional não é necessária aos gates desta missão. Os testes Python das transições passaram separadamente: 6 testes de contrato e 2 testes FFmpeg.
- O renderer de homologação executou os gates A/B/C e gerou `homologation.json` com tempos por tarefa. Nesta execução: ranking MP4 ~14–16 s por formato, WebM do ranking 46,2 s incluindo inspeção decodificada de alfa, três cenas API ~5,7/5,9/6,4 s, export do overlay C ~8,8 s; cada render de transição ~0,6–1,2 s. São tempos locais, não benchmark comparável ou compromisso de performance.
- `ffprobe` confirmou codecs, dimensões, CFR/FPS, duração e quantidade de quadros dos vídeos relatados. O QA dinâmico confirmou fontes carregadas, sem erros de página e hashes iguais nos frames amostrados.

As saídas são ambientais: determinismo significa igualdade de pixels nos instantes amostrados nas duas sessões sob a versão registrada. Não afirma igualdade binária de contêineres MP4/WebM em toolchains distintas. O manifesto SHA-256 identifica arquivos gerados daquela execução.

### Problemas encontrados durante a homologação

- Um título longo do ranking vertical saía dos limites; o layout foi ajustado com quebra/encaixe de texto e a safe-zone temporal passou.
- Um componente invisível no frame inicial acionava revisão manual de bounds; o relatório agora considera a visibilidade medida antes de decidir se há geometria relevante.
- A primeira versão da animação de texto cinético gerava JavaScript inválido; a saída foi corrigida e todos os oito scripts gerados são compilados nos testes.
- A comparação transparente precisava de superfícies atrás dos textos para manter contraste em fundos claro, escuro e variável; o backing foi adicionado e os três composites foram revistos.
- O primeiro sumário da Produção A referenciava a medição alfa da Produção C. A associação foi corrigida e a homologação foi repetida; agora ambas as exportações têm samples independentes.
- O consumidor revelou uma limpeza prematura do diretório de frames em `render overlay`; a API aguarda o FFmpeg antes de apagar os temporários. Um teste agora verifica metadados e pixels alfa dessa API.
- Permanecem alertas de atenção do player horizontal: dois samples no ranking 16:9 e treze samples somados nas três cenas da Produção B. Os relatórios preservam bounds, frame e região para revisão do operador; os elementos ficam dentro da safe area geométrica. Os avisos não são apagados nem tratados como aprovação visual automática.

## Instalação consumidora

`projects/mission-19/test-consumer-install.mjs` instalou os pacotes tarball em `/tmp/motion-mission19-consumer-Msc7lF`, em modo offline. O resultado registrado em `projects/mission-19/consumer-compatibility.json` é `passed`: `motion-core`, `motion-cli` e `motion-studio-skills` foram resolvidos dos tarballs locais em `1.0.0-rc.3`; o Core foi importado de `file:///tmp/.../node_modules/motion-core/index.js`; o consumidor contou oito componentes e oito transições e executou `components render`, `render overlay`, `transition render` e ambos os comandos de QA. MP4, dois WebMs VP9 com `ALPHA_MODE=1`, vídeo de transição, relatório determinístico e safe-zone report foram gerados.

Esse teste comprova a distribuição **local por tarball** do estado empacotado. A versão pública npm `1.0.0-rc.3` não foi substituída, e não há afirmação de que os novos arquivos estejam publicados nessa versão. Uma versão futura só deve ser preparada/publicada após autorização específica e validação de release.

## Licenças e proveniência

O repositório de referência `skeattt/motion-graphics-programatico` indica licença MIT. Seus conceitos foram estudados; não foram copiados arquivos nem arquitetura integral. Os novos componentes, verificadores, presets e integrações são implementação original do MOTION, distribuída sob o licenciamento deste projeto (Apache-2.0). GSAP não é dependência. FFmpeg, Chromium, Playwright, fontes e quaisquer assets externos mantêm suas licenças próprias; ver [`docs/LICENSES.md`](../LICENSES.md). As produções desta missão usam dados fictícios e backgrounds sintéticos locais; não redistribuem assets de terceiros.

## Limitações conhecidas

- A verificação dinâmica compara frames selecionados da timeline; não prova todas as combinações possíveis de state nem identidade binária entre codecs/ambientes.
- A análise estática de relógio/random/timers é um conjunto de diagnósticos e não substitui render dinâmico.
- Safe zones são presets versionados do MOTION, explicitamente heurísticos/configuráveis. Interfaces de plataformas mudam; avisos de região de atenção pedem revisão do operador.
- A detecção semântica depende de bounds declarados pelo autor. Elementos dentro de imagens e vídeos pedem inspeção visual.
- A validação de alfa requer FFmpeg com decodificador VP9 libvpx e `alphaextract`.
- Acesso a assets remotos pode mudar com rede/servidor; a integridade dos assets locais é registrada no manifesto de QA.

## Git e alterações protegidas

As mudanças permanecem sem commit e sem push. Nenhum deploy ou `npm publish` foi executado. As produções publicadas de TRAVESSIA e Máquinas de Estados e a Galeria de Criações pendente de revisão não foram modificadas. Os arquivos alterados e não rastreados da missão podem ser verificados com `git status --short`.
