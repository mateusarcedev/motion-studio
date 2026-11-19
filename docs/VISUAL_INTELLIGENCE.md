# Visual Asset Intelligence, SVG e ícones

> **Para o usuário leigo: nada aqui precisa ser aprendido.** Você descreve o resultado ("um carrossel
> com cinco benefícios da IA"); o diretor e os especialistas escolhem ícones, SVGs e animações sozinhos.
> Esta página é para quem mantém o estúdio ou desenvolve sobre ele.

## Visão geral

```
intenção em linguagem natural ──► Visual Asset Resolver ──► ícone/SVG escolhido + proveniência
                                         │
                       léxico PT/EN + nome + tags (IDF) ──► ranking ──► sessão (estilo travado)
                                         │
                      sem correspondência ──► glifo geométrico determinístico (marcado WARN)
```

| Camada | Módulo (`@technomanceer/motion-core`) | Responsabilidade |
|---|---|---|
| Resolver | `visual-assets/resolver.mjs` (`searchIcons`, `createAssetSession`) | Intenção → ícone. Ranking explicável, alternativas, confiança, fallback, proveniência. |
| Léxico | `visual-assets/lexicon.mjs` | ~100 conceitos PT/EN → ícones curados. Estende-se por dados, sem código. |
| Icon Library Manager | `icons/icon-library.mjs` | Pacotes offline, pacotes do usuário (formato Iconify), cache, licença/origem. |
| SVG Design Studio | `svg/svg-tools.mjs`, `svg/builder.mjs` | Validar/sanitizar/otimizar/rasterizar; componentes vetoriais com tokens da marca. |
| SVG Motion Engine | `design-system/svg-motion.js` | Animação vetorial pura por frame/tempo. |

## Fluxo de resolução

1. **Interpretar**: normaliza o texto (acentos, plural), remove palavras vazias e identifica *conceitos* ("segurança dos dados" → `security`, `data`).
   O conceito que abre a frase pesa mais ("crescimento das vendas" → *crescimento*, não *vendas*).
2. **Buscar antes de criar**: pontua todos os ícones dos pacotes disponíveis — conceito curado (+14…), nome idêntico, tokens do nome, tags (ponderadas por raridade/IDF) e sinônimos.
3. **Harmonizar**: a *sessão* de produção trava **um** estilo (pacote, espessura, tamanho, cor). Só pacotes do mesmo tipo de traço podem ser misturados.
4. **Evitar repetição**: conceitos diferentes nunca recebem o mesmo ícone; a mesma intenção reutiliza o mesmo.
5. **Fallback**: abaixo da pontuação mínima, usa um glifo geométrico original (mesma espessura) e marca `fallback: true` → `report().status === "WARN"`.
6. **Registrar**: `session.manifest()` devolve origem, versão e licença de cada asset para o `assets.manifest.json` / créditos.

```js
import { createAssetSession, buildSvgComponent } from "@technomanceer/motion-core";
const session = await createAssetSession({ size: 56, strokeWidth: 2, color: "#F5F7FA" });
const [speed, security] = await session.assign(["velocidade", "segurança dos dados"]);
speed.svg;          // <svg …> pronto para inline
speed.confidence;   // "high" | "medium" | "low"
session.manifest(); // proveniência + licenças
```

CLI para agentes/desenvolvedores (o usuário final nunca precisa): `motion assets resolve "velocidade"`,
`motion assets search "nuvem" --limit=8`, `motion assets packs`.

### Evolução para busca semântica
`searchIcons(query, { rerank })` aceita uma função `async (query, candidatos) => candidatos` para plugar
embeddings/LLM **sem mudar os chamadores** e sem exigir serviços externos por padrão.

## Pacotes de ícones e licenças

| Pacote | Licença | Situação | Motivo |
|---|---|---|---|
| **Lucide 1.76** (2404 ícones) | ISC | **incluído offline** (`assets/icons/lucide.pack.json`, gerado por `scripts/build-icon-pack.mjs`) | Traço consistente, cobertura ampla, tags semânticas, ótimo para *stroke reveal*, licença permissiva. |
| Tabler / Phosphor / qualquer Iconify JSON | MIT (típico) | **suportado**, não incluído | Solte um `.json` em `./.motion/icon-packs/` ou em `$MOTION_ICON_PACKS`. Sem dependência extra no bundle. |
| Iconify API | por pacote | **opcional**, desativado por padrão (`createIconifyFetcher`) | Cache em disco; corpo remoto passa pela validação SVG. Nunca baixa sem pedido explícito. |
| Simple Icons (logos) | CC0 (código) — **marcas registradas** | **não integrado** | Logos pertencem às marcas: só usar assets fornecidos/aprovados pelo usuário (regra 2 do CLAUDE.md). O MOTION nunca recolore/modifica logotipos. |

O aviso de licença do Lucide acompanha o pacote (`assets/icons/LICENSE-lucide.txt`). ISC/MIT não exigem
atribuição visível, mas exigem preservar o aviso nas cópias distribuídas — já cumprido pelo pacote npm.

## SVG: segurança, validação, otimização

- **Validação** (`validateSvg`): XML bem formado, raiz `<svg>`, `viewBox` (derivado de `width/height` se faltar), IDs duplicados e referências `url(#x)` quebradas.
- **SVG não confiável**: lista de permissão de elementos/atributos. Removidos e **reportados**: `<script>`, `<foreignObject>`, `<iframe>`, SMIL (`animate*`, `set`), `<a>`, `on*`, `javascript:`, URLs externas, `<style>` com `@import`/`url()` externa. Só `#fragmentos` e `data:image/(png|jpeg|webp|gif|avif)` são aceitos. `strict: true` reprova em vez de sanitizar.
- **Otimização** (`optimizeSvg`, SVGO 4): preserva `viewBox` (aborta se mudar) e prefixa IDs/referências (`prefix`) para combinar vários SVGs sem colisão.
- **Raster** (`rasterizeSvg`): PNG via Chromium dentro de `<img>` (scripts e rede desativados nesse contexto).

## Componentes vetoriais (SVG Design Studio)

`waveLayers` (profundidade multicamada, **uma matiz** em rampa — misturar matizes complementares vira lama),
`networkGraph` (com `avoid` = zonas silenciosas para o texto), `ringProgress`, `flowArrow`, `orbitRings`, `gridPattern`. Todos: determinísticos (seed),
cores da paleta derivada dos tokens da marca (`paletteFromTokens`, `roles` opcional no `tokens.json`),
IDs com namespace, partes animáveis marcadas com `data-layer`/`data-motion-path`.
`motion svg component waveLayers out.svg --tokens=creative-core/brands/<marca>/tokens.json`.

Tokens em SVGs autorais: `{{color.primary}}` → `applyTokens(svg, tokens)` (token inexistente = erro, nunca cor padrão silenciosa).

## SVG Motion Engine

```html
<script type="module">
  import { createSvgMotion } from "@technomanceer/motion-core/svg-motion";
  const m = createSvgMotion(document.querySelector("svg"), [
    { target: "[data-motion-path]", effect: "draw", start: 0, duration: 1.2, stagger: 0.08, easing: "outCubic" },
    { target: '[data-layer="node"]', effect: "pop", start: 0.5, duration: 0.5, stagger: 0.05 },
  ]);
  window.__onFrame__ = (M) => m.seek(M);   // contrato do renderer
</script>
```

Efeitos: `draw`, `fade`, `translate`, `scale`, `rotate`, `pop`, `reveal` (máscara por `clip-path`), `orbit`,
`parallax` (camadas por `data-depth`), `morph` (só caminhos com a mesma estrutura de comandos — caso contrário erro explícito),
`gradient-shift`, `color`. **Determinismo**: `seek()` escreve valores absolutos a partir de `M.time`;
sem relógio, `requestAnimationFrame`, SMIL, CSS keyframes ou `Math.random`. Pesquisar o frame 240 antes do 12
produz os mesmos pixels (coberto por teste com hash de PNG). Os renderers injetam um *import map* para
`@technomanceer/motion-core/frame` e `/svg-motion` (e montam `/@motion/`), então a composição não precisa
resolver imports manualmente.

## Limitações conhecidas

- A busca é lexical-semântica (léxico + tags). Conceitos abstratos fora do léxico caem em confiança baixa ou no glifo de fallback — por design, nunca num ícone aleatório.
- `morph` não faz correspondência automática de caminhos com estruturas diferentes (flubber-style); exija caminhos compatíveis.
- Ilustrações geradas são geométricas/vetoriais simples; cenas ricas continuam exigindo direção de arte (ver [ART_DIRECTION.md](ART_DIRECTION.md)).
- Apresentações (slides): **fora do escopo** desta versão — nenhum motor foi adicionado só para isso.
