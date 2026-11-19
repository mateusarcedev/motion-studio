# Catálogo de providers de recursos visuais

O usuário nunca escolhe biblioteca. O diretor decide **quando** usar ícone, ícone animado, logo, personagem, ilustração ou Lottie;
o registry decide **de onde** vem. Esta página é para quem mantém o estúdio.

```
intenção ──► classifyNeed (tipo) ──► registry.search (providers ativos)
                │                          │  licença: assessLicense (bloqueia NC/ND/SA/GPL/desconhecida)
                │                          ▼
                └────────────► candidatos ranqueados ──► regras de estilo/repetição ──► resolve ──► asset + proveniência
                                                                                   └─ sem resultado ─► glifo original (WARN)
```

## Providers

| Provider | Tipo | Offline | Animação determinística | Licença do **código** / dos **assets** | Estado e limitações |
|---|---|---|---|---|---|
| **lucide** | `icon` | sim (2404, embutido) | — (estático; animável via svg-motion) | ISC / ISC | Padrão. Define o estilo de traço da produção. |
| **developer-icons** | `logo` | sim (326, embutido) | — | MIT / **marcas registradas** dos titulares | Resolve por **nome/alias** (`PostgreSQL`, `Postgres`, `K8s`, `Node.js`…). Nunca por similaridade: só aparece quando a tecnologia é citada. Nomes que também são palavras comuns (`Next`, `Go`, `React`…) exigem contexto ("biblioteca react") ou grafia capitalizada. Nunca recolorido/distorcido. 6 ícones omitidos (3 com conteúdo inseguro, 3 grandes demais). |
| **humaaans** | `character` | sim (10 personagens) | — | CC0 (site) · **registrado como CC-BY-4.0** | Subconjunto curado (standing/sitting) de um espelho público; o site declara CC0 e o espelho CC-BY-4.0 → aplicamos a obrigação mais estrita (atribuição em `credits()`). O conjunto completo (Figma/Sketch, partes mix-and-match) **não** é distribuído por API: importe com `motion assets import`. Cores fixas (sem harmonização automática com a marca). |
| **animateicons** | `animated-icon` | sim | **sim (presets próprios)** | MIT / ISC (formas Lucide) + presets MOTION | **Limitação central:** os componentes do AnimateIcons são React + `motion/react` em **tempo real** (hover/imperativo), não *seekable*; seu TSX não é redistribuído. O adapter entrega a forma Lucide equivalente + preset determinístico próprio (`ring`, `spin`, `pulse`, `draw`, `pop`) escolhido pela semântica do ícone. Catálogo remoto opcional (`fetchCatalog`) só confirma existência. |
| **lottie** | `lottie` | sim (1 original: `check-pop`; + `.motion/lottie/`, `$MOTION_LOTTIE`) | **sim** | por arquivo (sidecar `.license.json`) | Runtime lottie-web *light* (MIT, sem motor de expressões) com `goToAndStop`. Expressões JS e assets externos são bloqueados na validação. dotLottie (`.lottie`) lido com ZIP seguro. O player é **reconstruído a cada quadro novo** porque o lottie-web guarda cache por propriedade (visitar o último quadro antes mudava o quadro 12). Arquivo sem licença declarada → bloqueado. Sem catálogo remoto (LottieFiles não é consultado). |
| **iconify** | `icon` | não (cache local após o 1º uso) | — | MIT / **por coleção** (lida ao vivo) | **Opt-in** (`allowNetwork`). Só coleções com licença permitida; NonCommercial/NoDerivatives/SA/desconhecida são bloqueadas e reportadas. Corpo remoto passa pelo sanitizador em modo estrito (qualquer construção insegura rejeita o asset). Cache com hash SHA-256 verificado na leitura. Coleções padrão: tabler, ph, solar, mingcute, iconoir, carbon. Só entra em produções com o mesmo tipo de traço do estilo travado. |
| **ls-graphics** (e qualquer pacote local) | `illustration`/… | sim | — | **declarada pelo usuário** | **Condicionado a permissão.** Nada é baixado nem redistribuído. `motion assets import <pasta> --prefix=ls-graphics --grant=user-licensed --commercial --attribution="…"` cria `.motion/assets/ls-graphics.pack.json` no projeto; sem confirmação comercial a importação é recusada. |

## Licenças: regras

- **Licença do código ≠ licença dos assets.** Cada pack declara `license.scope` (`code`/`assets`); `assessLicense` avisa quando só o código é coberto.
- Permitidas: MIT, ISC, Apache-2.0, CC0, BSD, 0BSD, MPL-2.0, OFL, Unlicense. Atribuição: CC-BY. **Bloqueadas** para uso comercial: CC-BY-NC, CC-BY-ND (recolorir já é derivação), CC-BY-SA, GPL, desconhecida/ausente.
- Marcas registradas: `trademark: true` → aviso "usar só para nomear a tecnologia".
- `session.credits().markdown` lista atribuições obrigatórias e marcas; o `manifest()` leva `licenseDetail`, `sha256` e origem de cada asset. Skills incluem o crédito na entrega.
- Não copiamos catálogos inteiros: Lucide e Developer Icons (MIT) vão embutidos por necessidade de uso offline; Humaaans só um subconjunto; AnimateIcons e LS Graphics, nenhum asset.

## Como integrar uma nova biblioteca

1. **Pacote offline?** Gere um pack JSON (`{ prefix, kind, license, style, icons: { nome: { body, width, height, tags, aliases } } }`) ou use `motion assets import <pasta-de-svgs> --prefix=… --kind=… --spdx=…`. Ele é descoberto em `.motion/assets/` ou `$MOTION_ASSET_PACKS` — zero código.
2. **Fonte própria (API, formato novo)?** Escreva um provider e registre — **sem tocar no resolver**:
```js
import { createDefaultRegistry, createAssetSession } from "@technomanceer/motion-core";
const registry = await createDefaultRegistry();
registry.register({
  id: "minha-lib", name: "Minha Lib", kinds: ["illustration"],
  capabilities: { offline: true, customizable: false, deterministicAnimation: false },
  license: { code: "MIT", assets: "CC0-1.0" },
  async status() { return { state: "ready" }; },
  async search(intent, { limit }) { /* → [{ id, kind, score, reasons, style, license, meta }] */ },
  async resolve(candidate, { size, color }) { /* → { id, kind, svg, provenance, license, sha256 } */ },
});
const session = await createAssetSession({ registry });
```
3. Contrato validado por `defineProvider` (id kebab-case, `kinds`, `search`/`resolve`, `license.code`). Providers indisponíveis ou com erro são ignorados e reportados — nunca derrubam a produção.
4. Teste com **fixtures locais** (nenhum teste usa a rede). Registre em `creative-core/INTEGRATIONS.md` e `THIRD_PARTY.md`.

## Consistência visual

Ícones ficam em um único estilo de traço (pacote travado na sessão); personagens/ilustrações vêm de uma família; assets distintos para intenções distintas; a mesma intenção devolve o mesmo asset. Logos mantêm cores de marca. Limitação: não há harmonização automática de cor para ilustrações de terceiros.
