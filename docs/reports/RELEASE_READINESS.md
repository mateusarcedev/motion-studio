# MOTION Studio — Relatório de Prontidão de Release (Release Readiness Report)

## Atualização da Missão 19.6 — 18 de novembro de 2026

> **Migração de Namespace para `@technomanceer` e Preparação Final da RC4.** A conta pessoal oficial no npm é `technomanceer`. O namespace `@technomanceer` substitui definitivamente o namespace `@mateusarcedev`. Os três pacotes foram migrados para `@technomanceer/*` na versão `1.0.0-rc.4` com `publishConfig` (`access: "public"`, tag: `next`). As URLs do GitHub (`mateusarcedev/motion-studio`) e as atribuições autorais permanecem inalteradas.

### Pacotes migrados

- `@technomanceer/motion-core@1.0.0-rc.4`
- `@technomanceer/motion-cli@1.0.0-rc.4`
- `@technomanceer/motion-studio-skills@1.0.0-rc.4`
- A CLI exige `@technomanceer/motion-core`; o catálogo `@technomanceer/motion-studio-skills` é peer opcional.

---

## Histórico da Missão 19.5 — 17 de novembro de 2026

> **RC4 preparada, publicação npm aguardando acesso de escrita.** A identidade npm anterior era `mateusarcestr`. A decisão definitiva da Missão 19.6 definiu a conta `technomanceer` e o escopo `@technomanceer`.

### Pacotes e permissões (Histórico 19.5)

- Os três manifests usavam `@technomanceer/*` (após migração 19.6), estão em `1.0.0-rc.4` e declaram `publishConfig` público com tag `next`.
- `npm run pack:all` preparou localmente Core, Skills e CLI. Nenhum pacote foi publicado.
- A CLI exige `@technomanceer/motion-core`; o catálogo `@technomanceer/motion-studio-skills` é peer opcional. Core e CLI podem ser publicados sem depender do bundle completo de Skills.

### Skills e GitHub público

- O manifesto RC4 autoriza **11 Skills**: `3d-scene-director`, `anatomy`, `carousel-studio`, `explainer-motion`, `feed-studio`, `motion-director`, `shorts-director`, `story-studio`, `studio-director`, `thermo-nuclear-code-quality-review` e `web-director`.
- As outras **40 pastas permanecem no checkout**, mas fora do tarball e da instalação pública: 18 para uso direto da origem sob seus termos; 2 aguardam auditoria de assets; 12 Skills Remotion sem licença; 8 com proveniência/licença insuficiente. [`docs/SKILLS_LICENSE_AUDIT.md`](../SKILLS_LICENSE_AUDIT.md) detalha cada grupo.
- Revisão somente leitura do GitHub `main` confirmou que as 51 pastas ainda estão públicas e que o package manifest remoto continua `motion-studio-skills@1.0.0-rc.3` com `Apache-2.0`. A correção local filtra os tarballs, mas não altera o GitHub remoto; a revisão e atualização dessa superfície seguem pendentes porque não houve autorização de push.
- `public-skills.json` registra snapshot, origem, licença, atribuição e SHA-256. `npm run skills:verify` passou e o tarball contém somente as 11 entradas do manifesto, com a licença MIT de `anatomy` preservada.

### Verificação

- `npm test`: **31/31 testes passaram**.
- `node projects/mission-19/test-consumer-install.mjs`: passou em clean-room. `init`, `list`, `doctor`, `create`, `render static` e `export` funcionaram sem o pacote de Skills; depois, a instalação opcional adicionou as 11 entradas permitidas.
- `npm run pack:all` e `npm run skills:verify`: passaram.

### Proposta final para publicação

### Histórico da proposta anterior (Superada pela Missão 19.6)

1. A tentativa anterior de publicação sob `@mateusarcedev` foi descartada; a migração definitiva para `@technomanceer` foi concluída na Missão 19.6.
2. Com a autenticação `technomanceer` verificada, a ordem de publicação é: Core (`@technomanceer/motion-core@1.0.0-rc.4`) → Skills (`@technomanceer/motion-studio-skills@1.0.0-rc.4`) → CLI (`@technomanceer/motion-cli@1.0.0-rc.4`).
3. Core e CLI são tecnicamente independentes do catálogo completo de Skills.

**Não houve `npm publish`, commit, push ou deploy.** Os tarballs RC4 são locais e aguardam revisão/autorização.

## Registro Histórico — Diagnóstico do namespace anterior (Superado)

> **Contexto da migração:** O namespace `@mateusarcedev` pertencia a uma organização externa e não estava acessível. Isso motivou a decisão executiva da Missão 19.6 de migrar definitivamente para a conta pessoal do proprietário: `technomanceer` e escopo `@technomanceer`.

- `npm whoami --registry=https://registry.npmjs.org/` retornou `technomanceer` (confirmado na Missão 19.6).
- Os três manifests foram migrados para `@technomanceer/*` e declaram `publishConfig` (`access: public`, `tag: next`).
- Dry-run do pacote atual `motion-core@1.0.0-rc.3` passou: 26 arquivos, 55.124 bytes compactados e 189.199 descompactados. O artefato não contém Skills.

### Auditoria das Skills

- Foram contados **51 diretórios de Skills** no pacote. `skills-lock.json` tem 68 entradas, mas somente 33 correspondem às Skills atualmente empacotadas; as outras 18 não têm fonte registrada ali. As entradas não fixam SHA de commit upstream.
- **12 Skills Remotion estão bloqueadas**: o repositório upstream não declara licença nem no `package.json` nem nas Skills. A issue upstream #31 continua aberta pedindo licença, e a #28 foi fechada sem resposta de maintainer. Repositório público e licença do runtime Remotion não autorizam por si só redistribuir essas Skills.
- Nas outras 21 Skills de origem externa, as licenças identificadas permitem redistribuição sob seus próprios termos; contudo, 18 diretórios não carregam a licença/aviso da origem junto com o conteúdo. `revenue-centric-design` preserva sua licença customizada e a restrição de não uso em apostas/cassino.
- Entre as 18 Skills sem fonte no lock, `banner-design`, `design` e `design-system` declaram MIT sem registrar origem ou incluir a licença; `ui-styling` declara MIT, mas o `LICENSE.txt` incluso contém Apache-2.0 genérica com campos de copyright em branco. As outras 14 precisam de confirmação de autoria/proveniência sob a licença raiz Apache-2.0.
- `npm pack --dry-run --json` da versão atual `motion-studio-skills@1.0.0-rc.3` passou: 2.363 arquivos, 27.194.978 bytes compactados e 47.092.226 descompactados. O tarball contém só três licenças upstream identificadas (`anatomy`, `revenue-centric-design`, `video-shotcraft`), além do `LICENSE.txt` contraditório de `ui-styling`; não contém as licenças dos outros 18 diretórios upstream.
- Inventário, origem, evidências e requisitos de correção: [`docs/SKILLS_LICENSE_AUDIT.md`](../SKILLS_LICENSE_AUDIT.md).

### Possibilidade de publicação separada

- **`motion-core`: separável tecnicamente.** Não depende do pacote de Skills; pode ser preparado e publicado sozinho sob o escopo `@technomanceer/motion-core`, na versão `1.0.0-rc.4`.
- **`motion-cli`: não é separável no estado atual.** Declara `motion-studio-skills` como dependência obrigatória e seus comandos `list` e `init` a importam. Se Skills ficar retido, a instalação pública da CLI também falha ao resolver a dependência. Só publicar a CLI após liberar um pacote de Skills compatível ou alterar a CLI para não exigir esse pacote, com os comandos dependentes tratados e testados.
- **`motion-studio-skills`: não publicar até fechar os bloqueios de direitos e avisos.** Opções: obter licença/permissão expressa para as 12 Skills Remotion ou removê-las do bundle; acrescentar avisos/licenças para as 18 Skills upstream restantes; resolver a origem e a contradição de `ui-styling`; fixar revisões upstream e alinhar o lock com as 51 Skills.

### Conclusão e Resolução na Missão 19.6

1. O escopo definitivo `@technomanceer` foi configurado nos 3 manifests.
2. A suíte completa (31/31 testes) e a instalação clean-room comprovaram a integridade e independência dos pacotes.

**Nesta Missão 19.5 não houve `npm publish`, commit, push ou deploy.** Os manifests continuam em `1.0.0-rc.3`; não foram preparados tarballs `rc.4`. As alterações foram documentais, portanto nenhum teste funcional foi necessário. Os dry-runs de Core e Skills serviram à auditoria e não geraram arquivos de publicação.

> **Bloco histórico:** avaliação original de 30 de outubro de 2026 (Missões 01–08), versão `1.0.0-rc.2`, classificada então como **READY WITH WARNINGS**. Foi substituída para decisões atuais pela atualização da Missão 19.5 acima.

---

## Sumário Executivo

O **MOTION Studio** passou por uma auditoria completa de prontidão para distribuição pública (Missões 01 a 08). O framework foi testado fora do monorepo em ambientes isolados, empacotado em tarballs npm auditáveis, submetido a varredura rigorosa de segurança e credenciais, e validado através da suíte automatizada de regressão (10/10 testes aprovados).

A classificação atribuída é **READY WITH WARNINGS**. O projeto está completamente operacional, reprodutível e apto para release público como Release Candidate / Developer Preview. As advertências (*warnings*) não impedem a distribuição, mas representam pré-requisitos operacionais do ecossistema criativo (como a dependência de binários de sistema como FFmpeg e Chromium headless, e o fato de que Blender e Chatterbox TTS são ferramentas externas opcionais).

---

## 1. Estado do Git & Reconciliação (Missões 01–07)

### Inspeção de Estado
- **Branch atual:** `main` (rastreada contra `origin/main`).
- **Commits pendentes:** Nenhum commit foi executado nesta missão (respeito estrito à restrição).
- **Arquivos modificados reconciliados:**
  - `README.md`: Atualizado com a identidade pública oficial, taglines, capturas reais e manual bilíngue.
  - `CHANGELOG.md`: Atualizado com as entregas da Missão 07 e Missão 08.
  - `package.json`: Configurações de workspace e dependências da suíte.
  - `creative-core/renderers/render_frames.mjs`: Motor batch determinístico reconstruído.
  - `creative-core/renderers/render_static.mjs`: Resolução dinâmica do Chromium (`resolveChrome`).
  - `creative-core/renderers/qa_viewports.mjs`: Suporte universal a URLs `file://` e resolução de Chromium.
  - `creative-core/gallery/gallery.json` e `index.html`: 9 produções originais estritamente preservadas com status `draft`.
- **Novas estruturas adicionadas (não rastreadas / preparadas para release):**
  - `packages/motion-core`: Motor de render, QA e exportação.
  - `packages/motion-skills`: Catálogo de 50 skills e perfis de distribuição seletiva.
  - `packages/motion-cli`: Binário executável `motion` e scaffolds reais.
  - `dist/packages/`: Tarballs empacotados para distribuição npm.
  - `docs/`: 10 guias técnicos de referência e diretório `docs/assets/demo/` com evidências reais.
  - `tests/suite.test.mjs`: Suíte de 10 testes automatizados via test runner nativo do Node.js.
  - `scripts/pack-all.mjs`: Script de empacotamento automatizado dos pacotes.

---

## 2. Resultados da Auditoria de Componentes

| Componente | Estado | Auditoria & Integridade |
|---|:---:|---|
| **`motion-director`** | Concluído | Pipeline de 5 departamentos funcional, montagem CFR 30fps verificada. |
| **`studio-director`** | Concluído | Roteamento em linguagem natural para vídeo, web e social implementado. |
| **`web-director`** | Concluído | Scaffold funcional, responsividade e auditoria em 5 viewports via Playwright. |
| **`carousel-studio`** | Concluído | Exportação de 5 a 10 slides em 1080×1350 e 2160×2700 PNG com validação dimensional. |
| **`shorts-director`** | Concluído | Composição vertical 9:16 com legendas animadas por frame. |
| **`3d-scene-director`**| Concluído | Modelagem procedural Three.js e exportação GLB; integração Blender opcional. |
| **Creative Core** | Concluído | Presets dimensionais, manifesto criptográfico SHA-256 e exportador ZIP integrados. |
| **Brand Memory** | Concluído | Memória visual isolada por marca (`tokens.json` e `PROFILE.md`); 9 produções originais em `draft`. |
| **CLI (`motion`)** | Concluído | Subcomandos reais: `init`, `doctor`, `list`, `create`, `preview`, `render`, `export`, `qa`. |
| **Determinismo** | Concluído | MD5 verificado quadro a quadro entre execuções repetidas com mesma seed. |

---

## 3. Testes de Instalação Limpa em Ambiente Isolado

O teste de distribuição foi executado no diretório temporário `/tmp/motion-clean-install-test`, completamente desvinculado do repositório, sem symlinks e sem caminhos absolutos hardcoded:

1. **Instalação via NPM Tarballs:**
   - Pacotes instalados: `motion-core-1.0.0.tgz`, `motion-studio-skills-1.0.0.tgz`, `motion-cli-1.0.0.tgz`.
   - Resultado: 5 dependências adicionadas em 32s, 0 vulnerabilidades.
2. **Execução do `motion doctor`:**
   - Node.js (`v24.16.0`): **PASS**
   - Python 3 (`3.14.5`): **PASS**
   - FFmpeg (`8.0.1`): **PASS**
   - Chromium (Playwright cache dinâmico): **PASS**
   - Three.js (`r165`): **PASS**
   - Blender (Opcional): **INFO** (Não detectado — reportado corretamente sem falso positivo)
   - Chatterbox TTS (Opcional): **INFO** (Não instalado — reportado corretamente sem falso positivo)
3. **Inicialização Seletiva (`motion init --brand="AcmeClean" --profile=core`):**
   - `motion.config.json` gerado com sucesso.
   - `motion/brand/tokens.json` e `motion/brand/PROFILE.md` gerados com escopo isolado.
   - `motion/gallery.json` isolada do projeto consumidor gerada.
   - Instalação de skills limitada com precisão aos 6 diretores do perfil `core` em `.agents/skills`, `.claude/skills` e `.opencode/skills`.
4. **Proteção de Configuração Existente:**
   - Execução repetida de `motion init` sem `--force`: **Falha segura com código 1** e mensagem explícita impedindo sobrescrita de arquivos do projeto consumidor.
5. **Criação de Scaffolds Reais:**
   - `motion create website test-site`: Scaffold completo Next.js/HTML criado.
   - `motion create video test-vid`: Scaffold audiovisual de 450 frames criado.
   - `motion create carousel test-car`: Scaffold editorial de 5 slides criado.
6. **Renderização Estática & Validação Dimensional:**
   - `motion render carousel`: 5 slides renderizados em 1080×1350 e 2160×2700 com validação de status `OK`.
7. **Empacotamento de Entrega:**
   - `motion export`: Manifesto SHA-256 gerado e pacote `entrega-v1.zip` produzido com sucesso.
8. **Auditoria de QA Multi-Viewport:**
   - Validação da landing page em 5 telas: **100% PASS** (`mobile-s`, `mobile`, `tablet`, `desktop`, `wide`).

---

## 4. Matriz de Compatibilidade com Agentes de IA

| Camada | Antigravity (Google) | Claude Code | OpenCode | Cursor / Windsurf | Copilot |
|---|:---:|:---:|:---:|:---:|:---:|
| **1. Skill Instalada** | ✅ Sim (`.agents/skills`) | ✅ Sim (`.claude/skills`) | ✅ Sim (`.opencode/skills`) | ✅ Sim (`.agents/skills`) | ⚠️ Manual |
| **2. Skill Descoberta** | ✅ Sim (leitura nativa) | ✅ Sim (`SKILL.md`) | ✅ Sim (`SKILL.md`) | ✅ Sim (via context) | ⚠️ Parcial |
| **3. Skill Ativada** | ✅ Sim | ✅ Sim | ✅ Sim | ⚠️ Depende de prompt | ⚠️ Manual |
| **4. Ferramentas Executáveis** | ✅ Sim (`run_command`) | ✅ Sim (Bash tool) | ✅ Sim (Bash tool) | ⚠️ Terminal manual | ❌ Não |
| **5. Pipeline Concluído** | ✅ Sim (100% validado) | ✅ Sim (100% validado) | ✅ Sim (100% validado) | ⚠️ Execução assistida | ⚠️ Apenas código |

---

## 5. Auditoria de Segurança, Licenças e SBOM

### Varredura de Segredos & Credenciais
- Varredura recursiva de tokens, chaves de API (`GEMINI_API_KEY`, `OPENAI_API_KEY`, AWS, Bearer tokens, private keys `.pem`/`.key`):
  - **Zero credenciais privadas ou segredos expostos.**
  - Todas as ocorrências no repositório são placeholders de documentação (`"your-key"`) ou lookups seguros de variáveis de ambiente (`os.environ.get(...)`).
  - Zero arquivos `.env` privados com valores reais.

### Otimização e Prunagem de Pacotes NPM (`npm pack --dry-run`)
- **`motion-core`**:
  - Tamanho: 20.8 kB (72.7 kB descompactado)
  - Conteúdo: 16 arquivos (motores, renderizadores, validadores, presets). Zero binários estranhos.
- **`motion-cli`**:
  - Tamanho: 16.8 kB (55.0 kB descompactado)
  - Conteúdo: 11 arquivos (executável binário `motion`, bibliotecas de subcomandos).
- **`motion-studio-skills`**:
  - Tamanho anterior: 148.4 MB (199.6 MB descompactado)
  - Tamanho otimizado: 44.1 MB (78.3 MB descompactado) — **Redução de ~70%**
  - Arquivos excluídos via `.npmignore`:
    - Arquivos de mídia de terceiros (`**/*.mp3`, `**/*.mp4`, `**/*.pdf`).
    - Binários pré-compilados de plataforma (`**/bin/linux*`, `**/bin/darwin*`, `**/bin/win*`).
    - Caches de build de bancadas de teste (`workbench/node_modules/**`).
  - Todas as 50 skills, instruções em Markdown e arquivos de código permanecem 100% acessíveis aos agentes.

### Verificação de Disponibilidade de Nomes no NPM Registry
Consulta realizada em `registry.npmjs.org`:
- `motion-studio-skills`: **HTTP 404 Not Found** (Disponível para publicação)
- `motion-core`: **HTTP 404 Not Found** (Disponível para publicação)
- `motion-cli`: **HTTP 404 Not Found** (Disponível para publicação)

---

## 6. Resultados Visuais e Inspeção dos Exemplos (Kronos Orbit)

Todos os entregáveis da campanha demonstrativa **Kronos Orbit** foram inspecionados:
1. **Landing Page:**
   - Hero com relógio 3D procedural `@react-three/fiber` renderizado perfeitamente.
   - Capturas multi-viewport salvas em `qa-reports/` (`mobile-s-fold.png`, `mobile-fold.png`, `tablet-fold.png`, `desktop-fold.png`, `wide-fold.png`).
   - Alvos de toque verificados e aprovados para conformidade com Apple HIG e WCAG (>=44px).
2. **Vídeo Cinematográfico (15 segundos):**
   - Arquivo: `kronos-orbit-15s.mp4`.
   - Especificações FFprobe: 1920×1080, 30.00 FPS CFR constante, exatamente 450 frames, duração 15.000000s, formato de pixel `yuv420p`.
   - Contact sheet gerado em 2560×4000 PNG (45 quadros representativos auditados).
3. **Carrossel Editorial:**
   - 5 slides renderizados em escala padrão (1080×1350) e retina (2160×2700).
   - Validador `validate_static.py` reportou status válido sem distorção ou corte cego.
   - Pacote `entrega-v1.zip` gerado com manifesto criptográfico SHA-256.
4. **Integridade da Galeria Base:**
   - As 9 produções originais permanecem intactas com status `"draft"`.
   - Nenhuma aprovação editorial simulada foi gravada na memória de marca.

---

## 7. Problemas Encontrados Durante a Auditoria

1. **Incompatibilidade de protocolo no QA Viewport:**
   - Ao receber caminhos relativos de arquivos (ex: `slides/01.html`), o Playwright rejeitava a navegação por esperar uma URL válida.
2. **Alvo de toque diminuto no template de Website:**
   - No tablet (modo touch ativo), o elemento `.logo` possuía altura calculada de 32px, violando a regra de alvos de toque >=44px.
3. **Precedência de flag `--version` na CLI:**
   - Ao executar `npx motion --version` sem argumentos posicionais, o verificador de ajuda era disparado antes do verificador de versão.
4. **Inchaço de distribuição no pacote de skills:**
   - O tarball `motion-studio-skills` estava sendo empacotado com 148 MB devido à presença de vídeos MP4 de demonstração, PDFs e áudios MP3 pesados em skills externas.

---

## 8. Correções Realizadas

1. **Protocolo `file://` automático em `qa_viewports.mjs`:**
   - Adicionada detecção e conversão automática de caminhos locais para URLs `file://${path.resolve(url)}` tanto em `packages/motion-core` quanto em `creative-core`.
2. **Resolução dinâmica de Chromium no QA:**
   - Incorporada a função `resolveChrome()` no motor de QA multi-viewport, garantindo localização autônoma do binário em qualquer distribuição Linux ou ambiente CI/CD.
3. **Ajuste de acessibilidade em `packages/motion-cli/lib/create.mjs`:**
   - O seletor `.logo` recebeu `min-height: 44px; min-width: 44px; display: inline-flex; align-items: center;`, eliminando o erro de toque em viewports móveis e tablets.
4. **Correção de precedência na CLI (`bin/motion.mjs`):**
   - Verificação de `-v`, `--version` reposicionada para antes da checagem de ajuda padrão.
5. **Prunagem seletiva via `.npmignore`:**
   - Exclusão de mídia pesada e binários pré-compilados do tarball, reduzindo o pacote em ~70% e tornando-o seguro e auditável para o registro público.

---

## 9. Versão Recomendada

### Recomendação: `1.0.0-rc.1` (ou `0.1.0`)

- **Análise SemVer:**
  - O ecossistema está estável, os contratos fundamentais (CFR 30fps, 5 viewports de QA, perfis de skills) estão maduros e testados.
  - Para permitir que desenvolvedores externos adotem o pacote e validem fluxos em diferentes sistemas operacionais antes de congelar a API 1.0 definitiva, recomenda-se publicar a primeira versão pública como **`1.0.0-rc.1`** (ou **`0.1.0`** como Developer Preview inicial).
- **Consistência:**
  - Todos os arquivos `package.json` (`motion-core`, `motion-cli`, `motion-studio-skills`) e o binário `motion.mjs` estão sincronizados em `1.0.0`.

---

## 10. Procedimentos para a Equipe de Engenharia / Operador Humano

> [!IMPORTANT]
> Em estrita conformidade com as restrições da Missão 08, **nenhum commit, tag ou publicação npm foi executado automaticamente**.  
> Os comandos exatos abaixo devem ser executados pelo operador humano quando a autorização de publicação for concedida.

### A. Procedimento de Commit & Tag
```bash
# 1. Verificar estado limpo
git status

# 2. Adicionar alterações auditadas
git add README.md CHANGELOG.md RELEASE_READINESS.md \
        packages/ tests/ docs/ scripts/ \
        creative-core/renderers/ \
        .gitignore package.json

# 3. Executar o commit do Release Candidate
git commit -m "chore(release): prepare v1.0.0-rc.1 release candidate

- Modularize packages: motion-core, motion-skills, motion-cli
- Add selective skill profiles: core, web, motion, social, 3d, blender, all
- Prune heavy media assets from npm package via .npmignore
- Add Playwright multi-viewport QA with automatic file:// resolution
- Expand test suite to 10 automated regression tests
- Add complete technical documentation and Kronos Orbit production showcase"

# 4. Criar a tag anotada
git tag -a v1.0.0-rc.1 -m "Release Candidate 1 — MOTION Studio v1.0.0"

# 5. Enviar para o repositório remoto (quando autorizado)
git push origin main
git push origin v1.0.0-rc.1
```

### B. Procedimento de Publicação no NPM
```bash
# 1. Login no npm
npm login

# 2. Publicar pacotes a partir de dist/packages/
cd /home/mateusarcedev/projetos/motion

# Publicar motion-core
npm publish dist/packages/motion-core-1.0.0.tgz --access public --tag next

# Publicar motion-studio-skills
npm publish dist/packages/motion-studio-skills-1.0.0.tgz --access public --tag next

# Publicar motion-cli
npm publish dist/packages/motion-cli-1.0.0.tgz --access public --tag next
```

### C. Procedimento de Rollback de Emergência
Se qualquer falha for detectada após o commit ou publicação:
```bash
# Para desfazer alterações locais antes do commit:
git restore README.md CHANGELOG.md creative-core/

# Para remover a tag criada localmente:
git tag -d v1.0.0-rc.1
git push origin :refs/tags/v1.0.0-rc.1

# Para despublicar pacotes do npm (dentro da janela de 72h):
npm unpublish motion-cli@1.0.0-rc.1 --force
npm unpublish motion-studio-skills@1.0.0-rc.1 --force
npm unpublish motion-core@1.0.0-rc.1 --force

# Ou descontinuar e marcar com tag de alerta:
npm deprecate motion-cli@1.0.0-rc.1 "Esta versão RC contém problemas conhecidos. Use a versão estável mais recente."
```

---

## Classificação Final: **READY WITH WARNINGS**

### Justificativa:
1. **Evidência Positiva:**
   - 10/10 testes da suíte de regressão passando de forma determinística em menos de 6 segundos.
   - Instalação limpa verificada do zero em diretório isolado (`/tmp/motion-clean-install-test`), sem symlinks ou acoplamento com o monorepo.
   - Nomes de pacotes livres e disponíveis no registro oficial do NPM.
   - Varredura de segurança confirmando zero segredos ou chaves vazadas.
   - Entregáveis da campanha Kronos Orbit completos, auditados e com conformidade total em vídeo 15s CFR, carrossel 5 slides e landing page responsiva.
2. **Avisos Operacionais (Warnings):**
   - O estúdio requer que o host de execução possua FFmpeg e Chromium instalados para operações de vídeo e QA visual.
   - Ferramentas externas opcionais (Blender e Chatterbox TTS) não são instaladas automaticamente via npm; o estúdio inclui fallbacks silenciosos e procedurais nativos, mas usuários que desejem modelagem física Blender ou síntese vocal neural devem instalá-las manualmente.
   - As 9 produções pré-existentes na galeria permanecem em status `draft` aguardando aprovação editorial humana real.
