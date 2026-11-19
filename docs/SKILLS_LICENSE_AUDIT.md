# Auditoria de licenças e proveniência das 51 Skills

**Revisão:** 17 de novembro de 2026  
**Escopo:** `packages/motion-skills/skills/` e o diretório público `main` do GitHub  
**Decisão RC4:** o pacote público contém 11 Skills verificadas. As outras 40 permanecem fora do tarball e continuam no catálogo local para investigação/uso conforme os termos aplicáveis.

## Resultado por grupo

| Decisão | Qtde. | Skills | Evidência e ação |
|---|---:|---|---|
| **Incluídas no manifesto público RC4** | **10** | `3d-scene-director`, `carousel-studio`, `explainer-motion`, `feed-studio`, `motion-director`, `shorts-director`, `story-studio`, `studio-director`, `thermo-nuclear-code-quality-review`, `web-director` | Histórico do repositório registra a autoria de Mateus Arce no commit `41728c34988cf45ebb64ca258e25b1f976ff6f60`; a licença Apache-2.0 do projeto é incluída. O manifesto contém snapshot versionado por SHA-256 para cada arquivo. |
| **Incluída no manifesto público RC4** | **1** | `anatomy` | Origem `wheresryan22/anatomy`; o diretório preserva a licença MIT integral e o copyright de Ryan. O manifesto fixa o hash exato do `SKILL.md` distribuído. A revisão upstream do import original não foi registrada, por isso o snapshot do pacote é a versão verificável adotada. |
| **Opcional: instalar diretamente do upstream** | **18** | `animate`, `animation-performance`, `animation-vocabulary`, `apple-design`, `brag`, `diagnosing-bugs`, `diagram-design`, `emil-design-eng`, `find-animation-opportunities`, `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `improve-animations`, `lemo-opuscar`, `media-use`, `prototype`, `review-animations`, `grill-me` | A auditoria identificou MIT ou Apache-2.0 nas fontes upstream. Não entram no npm RC4: os imports locais não fixaram o commit de origem e, em 18 pastas upstream no conjunto original, faltam licença/avisos junto à cópia. Instalação direta busca o conteúdo no repositório original; futuras inclusões exigem pin de revisão, texto de licença/atribuição e novo hash. Fontes consultadas incluem [`emilkowalski/skills`](https://github.com/emilkowalski/skills), [`mattpocock/skills`](https://github.com/mattpocock/skills), [`latent-spaces/brag`](https://github.com/latent-spaces/brag), [`cathrynlavery/diagram-design`](https://github.com/cathrynlavery/diagram-design), [`heygen-com/hyperframes`](https://github.com/heygen-com/hyperframes) e [`lemomo-ai/lemo-opuscar`](https://github.com/lemomo-ai/lemo-opuscar). |
| **Retidas localmente; revisão adicional de assets** | **2** | `revenue-centric-design`, `video-shotcraft` | Há licenças nos diretórios, mas as pastas incluem coleções de imagens, demos, vídeos, templates ou workbenches além do `SKILL.md`. A licença e a atribuição de cada asset/material incorporado ainda não foram verificadas para o bundle npm. `revenue-centric-design` também exige manter atribuição a Richard (@richardrx) e a restrição contra uso em apostas, cassino, jogos de azar ou loot boxes. |
| **Bloqueadas: nenhuma licença upstream identificada** | **12** | `remotion-best-practices`, `remotion-captions`, `remotion-create`, `remotion-docs`, `remotion-interactivity`, `remotion-maps`, `remotion-markup`, `remotion-multimedia`, `remotion-render`, `remotion-saas`, `remotion-studio`, `remotion-upgrade` | O repositório upstream `remotion-dev/skills` informa licença ausente (`license: null` na API de repositório). A issue [#31 — Please add a LICENSE file](https://github.com/remotion-dev/skills/issues/31) está aberta na revisão. Código público, a licença do runtime Remotion e atribuição isolada não autorizam redistribuição dessas Skills. Exigir concessão/licença expressa antes de distribuição ou instalação pelo MOTION. |
| **Bloqueadas: licença ou proveniência sem comprovação suficiente** | **8** | `banner-design`, `brand`, `design`, `design-system`, `impeccable`, `slides`, `ui-styling`, `ui-ux-pro-max` | `banner-design`, `brand`, `design`, `design-system` e `slides` identificam `claudekit` no frontmatter sem registrar a origem/licença correspondente. `ui-styling` declara MIT, mas acompanha texto Apache-2.0 genérico com titular e ano vazios. `impeccable` declara versão `4.7.0` sem registrar fonte/licença. `ui-ux-pro-max` inclui um conjunto extenso de dados e não identifica fonte/licença. Permanecem no checkout e fora do pacote. |

**Total: 51 Skills.** O manifesto de publicação está em [`packages/motion-skills/public-skills.json`](../packages/motion-skills/public-skills.json); ele registra nome, versão de snapshot, origem, revisão, licença, atribuição e SHA-256. [`scripts/verify-public-skills.mjs`](../scripts/verify-public-skills.mjs) confere hashes, arquivos de licença e a correspondência exata com a allowlist npm.

## Integrações externas opcionais

[`packages/motion-skills/optional-integrations.json`](../packages/motion-skills/optional-integrations.json) separa metadados e comandos de instalação de conteúdo distribuído. `aula-interativa`, `motion-designer` e `ui-humanizer` apontam para a origem de Gabriel Greco com termos customizados e sem redistribuição npm; `stageshow` aponta para a origem de Benji Taylor e manda confirmar a licença upstream antes de instalar. Nenhum arquivo dessas integrações entra no pacote.

## Distribuição e preservação local

- `package.json` do pacote Skills lista somente as 11 pastas públicas. `listSkills()` e `installSkills()` leem a allowlist; `listLocalSkills()` mantém a consulta às 51 pastas do checkout. O instalador público não copia as 40 entradas retidas.
- A CLI aceita o catálogo como peer opcional. Sem ele, `init` cria configuração e estrutura; `list` informa que o catálogo não foi instalado. `doctor`, `create`, `render` e `export` não exigem Skills.
- Conteúdo mantido em um checkout não equivale a autorização de redistribuição. A disponibilidade de cada integração local continua sujeita à licença e aos termos da origem.

## Revisão do GitHub público

Leitura somente de `main` em 17 de novembro de 2026 confirmou que o repositório público ainda contém **as 51 pastas**. O `packages/motion-skills/package.json` remoto ainda usa `motion-studio-skills@1.0.0-rc.3` e declara Apache-2.0 para o pacote inteiro; a licença raiz pública também é Apache-2.0. Portanto, as 12 Skills Remotion sem licença, as 8 pastas com proveniência/licença insuficiente e as duas árvores com assets não auditados continuam visíveis publicamente no GitHub.

Esta preparação limita o tarball npm local da RC4 e documenta o estado remoto. Ela não altera `main`: o usuário proibiu push nesta missão. A exposição do catálogo completo no repositório público ainda exige uma alteração preparada e revisada no GitHub após autorização; o histórico Git não foi reescrito e nenhuma pasta foi removida do catálogo local.

## Próximas liberações

1. `anatomy`: se o time exigir pin do commit upstream além do hash do snapshot e da licença incluída, registrar a revisão antes do pacote público.
2. Skills permissivas opcionais: registrar SHA upstream, versão/snapshot e preservar a licença e atribuições completas antes de incluí-las em outro tarball.
3. `revenue-centric-design` e `video-shotcraft`: revisar licenças de imagens, vídeos, fontes, templates e dependências empacotadas.
4. Remotion e entradas com `claudekit`: obter permissão/licença e proveniência de titular antes de distribuir ou copiar para projetos consumidores.
5. Atualizar o repositório público para separar explicitamente conteúdo Apache-2.0, conteúdo upstream e catálogo retido, sem remover material autorizado ou reescrever histórico.
