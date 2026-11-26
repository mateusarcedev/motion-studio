# Guia de Instalação — MOTION Studio

```bash
npx @technomanceer/motion-studio init
```

Esse é o fluxo oficial. Você não precisa conhecer os pacotes internos (`@technomanceer/motion-core`, `-cli`, `-studio-skills`).

> O nome npm `motion-studio` (sem escopo) pertence a outro projeto (biblioteca Motion). O instalador público é `@technomanceer/motion-studio`; o executável instalado se chama `motion-studio`.

---

## 1. Requisitos

| Requisito | Mínimo | Obrigatório | Função |
|---|---|---|---|
| **Node.js** | 20+ (validado em 20, 22 e 24; Node 18 não é suportado: o Playwright exige ≥ 20) | Sim | Runtime |
| **Python 3** | 3.9 | Sim | Manifestos SHA-256, contact sheets |
| **FFmpeg** | 6.0 | Sim | Montagem de vídeo CFR 30fps |
| **Chromium** | via Playwright | Sim | Captura de frames/stills (`npx playwright install chromium`) |
| Three.js, Blender, Chatterbox, Edge-TTS, Sharp | — | Não | Recursos opcionais; **nunca** instalados automaticamente |

## 2. O que o `init` faz

1. Verifica o catálogo de Skills (sha256 de cada `SKILL.md` contra `public-skills.json`). Falha explicitamente se faltar alguma Skill.
2. Detecta o gerenciador de pacotes (`packageManager` do package.json → lockfile → npm).
3. Instala **CLI, Core e Skills** como `devDependencies` exatas, sem scripts de terceiros (`--ignore-scripts`), nunca globalmente.
4. Copia as Skills públicas do pacote resolvido para `.agents/skills/` e, para Claude Code, cria links relativos em `.claude/skills/` (17 no catálogo deste checkout; o npm 1.1.1 ainda contém 14).
5. Cria `motion.config.json` e `motion/` (brand, projects, out, gallery).
6. Grava `.motion/install.json` (versões, hashes, status) e verifica a integridade.
7. Roda o diagnóstico dos motores e imprime o relatório.

As outras Skills do repositório de desenvolvimento **não** são redistribuíveis e não estão no pacote npm. Integrações externas (ex.: `aula-interativa`) continuam opcionais e são instaladas manualmente, respeitando a licença de cada uma (`npx motion list`).

O catálogo deste checkout contém 17 Skills públicas. A M4/M5 não publica uma versão npm nova; enquanto o registro ainda servir a versão 1.1.1 anterior, instale as Skills diretamente a partir do clone:

```bash
git clone https://github.com/mateusarcedev/motion-studio.git
cd /CAMINHO/DO/PROJETO-CONSUMIDOR
node --input-type=module -e 'import { installSkills } from "/CAMINHO/motion-studio/packages/motion-skills/index.js"; await installSkills({ targetDir: process.cwd(), profile: "integration", agents: ["agents", "claude"] });'
```

Substitua os dois caminhos. O perfil `integration` instala as Skills públicas relevantes no projeto consumidor; não instala nem conecta o Doop MCP. Para executar o Motion MCP pelo clone, instale suas dependências com `npm ci` no checkout e configure o comando descrito em [MCP.md](MCP.md).

Na M6, os quatro tarballs do checkout foram instalados em um diretório temporário limpo. `motion-studio init --profile=integration` copiou seis Skills e conferiu os hashes públicos; `motion doctor`, CLI, MCP stdio, render real, paridade CLI×MCP e rejeição de traversal passaram. Os pacotes continuam na versão `1.1.1`; esse teste local não publicou nem atualizou o registro npm. O relatório inclui os tamanhos individuais e o script reproduzível [`scripts/m6_distribution_smoke.mjs`](../scripts/m6_distribution_smoke.mjs).

### Opções

| Flag | Efeito |
|---|---|
| `--brand=<nome>` | Nome da marca (padrão: nome da pasta) |
| `--agents=claude,codex,gemini,opencode,copilot` | Agentes explícitos (padrão: detecção) |
| `--profile=<perfil>` | Subconjunto das Skills públicas: `core`, `web`, `motion`, `social`, `3d`, `blender`, `interactive`, `design-to-motion`, `motion-to-design`, `doop-bridge`, `integration` ou `all` (o `all` do checkout contém 17) |
| `--with-package-json` | Em pasta sem `package.json`, cria um mínimo e instala tudo |
| `--skip-install` | Não instala dependências; usa os arquivos do pacote em execução |
| `--force` | Substitui configuração/Skills divergentes, com backup em `.motion/backups` |
| `--strict` | Exit 3 se algum motor obrigatório faltar (útil em CI) |
| `--json` | Relatório em JSON |

### Projeto sem `package.json`

Estratégia padrão: **modo standalone**. Só `.agents/skills`, `.claude/skills`, `motion.config.json`, `motion/` e `.motion/` são criados; nenhum `package.json` ou `node_modules` aparece. Os comandos continuam disponíveis via `npx @technomanceer/motion-studio <comando>`. Para ter CLI e Core instalados localmente, use `--with-package-json`.

## 3. Agentes suportados

Caminhos confirmados nas documentações oficiais de cada agente:

| Agente | Descoberta de Skills | Onde o `init` instala |
|---|---|---|
| Claude Code | `.claude/skills` | links em `.claude/skills` |
| OpenAI Codex | `.agents/skills` (segue symlinks) | `.agents/skills` |
| Google Antigravity | `.agents/skills` (testado) | `.agents/skills` |
| Gemini CLI (não testado) | `.gemini/skills` ou alias `.agents/skills` | `.agents/skills` |
| OpenCode | `.opencode/skills`, `.claude/skills`, `.agents/skills` | `.agents/skills` |
| OpenDesign via OpenCode CLI | usa a descoberta `.agents/skills` do OpenCode | `.agents/skills` no projeto; execução indireta parcial testada |
| GitHub Copilot | `.github/skills`, `.claude/skills`, `.agents/skills` | `.agents/skills` |

Sem agente detectado, o `init` instala o layout universal (`.agents/skills` + `.claude/skills`). Nada é escrito em `AGENTS.md`, `CLAUDE.md` ou configs dos agentes. Veja o que foi testado de fato em [docs/reports/INSTALLER_COMPATIBILITY_REPORT.md](reports/INSTALLER_COMPATIBILITY_REPORT.md).

> Skills com `disable-model-invocation: true` (hoje: `thermo-nuclear-code-quality-review`) são de invocação manual; OpenCode e Antigravity não as expõem ao modelo, por design.

OpenDesign 0.27.2 foi testado com Skills e Motion MCP pelo OpenCode CLI separado. O daemon MCP próprio não completou handshake pelo caminho WSL↔Windows observado, e o painel não encaminhou MCP na execução testada; o vídeo solicitado pelo agente parou em HTTP 429. Isso não comprova descoberta pelo loop nativo. Veja [o diagnóstico](integrations/OPENDESIGN.md), [o relatório do piloto](reports/OPENDESIGN_INTEGRATION_PILOT.md) e a [matriz](COMPATIBILITY.md).

## 4. Segurança e idempotência

- Reexecutar o `init` não altera nada que já esteja correto (`inalteradas 11`).
- Skill ou config sua com conteúdo diferente é **preservada** e reportada como conflito. `--force` substitui com backup.
- `motion.config.json` inválido: o instalador aborta sem tocar no arquivo.
- Instalação interrompida (queda, Ctrl+C): `.motion/install.json` fica `in-progress`; reexecute o `init` para retomar e reparar.
- Falha de rede: 3 tentativas, depois exit 2 sem criar Skills nem config. Reexecute quando a rede voltar.
- Recusa rodar dentro do próprio repositório do MOTION, dentro de `node_modules` ou de forma recursiva.
- Versões: o CLI instala exatamente as versões testadas em conjunto; se você já tem uma mais nova, ela é mantida com aviso.

## 5. Diagnóstico

```bash
npx motion doctor
```

Mostra os motores e, se o projeto foi instalado pelo `init`, revalida Skills e links (`.motion/install.json`).

## 6. Solução de problemas

| Sintoma | Causa provável | Ação |
|---|---|---|
| `Falha de rede ao instalar` (exit 2) | Registro inacessível | Verifique rede/proxy/registry e rode de novo |
| `Pacote de Skills indisponível` | Dependência não instalada/corrompida | `npm i -D @technomanceer/motion-studio-skills` e rode de novo |
| `Integridade falhou para a Skill` | Pacote adulterado/corrompido | Reinstale o pacote de Skills |
| `Conflito: '<skill>' já existe` | Skill sua com o mesmo nome | Renomeie a sua ou use `--force` |
| `motion.config.json não é um JSON válido` | Arquivo editado com erro | Corrija o JSON; o instalador não o sobrescreve |
| `Este diretório é o próprio pacote` | Rodou no repo do MOTION | Rode em um projeto consumidor |
| Doctor: FFmpeg/Chromium FAIL | Motor ausente | `apt/brew install ffmpeg`; `npx playwright install chromium` |
| Doctor: `MOTION_BROWSER_VERSION_MISMATCH` | Há Chromium, mas de outra revisão que a do Playwright instalado (acontece quando o projeto resolve um `playwright-core` mais novo) | `npx playwright install chromium` na pasta do projeto |
| Agente não vê as Skills | Sessão aberta antes da instalação | Reinicie o agente na raiz do projeto |

## MCP local

Para conectar Claude Code, Codex, Gemini CLI, Google Antigravity, OpenCode ou outro cliente compatível, configure o processo local `motion mcp` por `stdio`. O guia [MCP.md](MCP.md) contém configurações, inventário, exemplos e troubleshooting. A M4/M5 não foi publicada no npm; até existir uma versão atualizada, inicie o servidor pelo checkout do código-fonte.

## 7. Atualização

```bash
npx @technomanceer/motion-studio@latest init
```

Skills que você não modificou são atualizadas; as modificadas são preservadas como conflito.

## 8. Compatibilidade com o fluxo anterior

`npx @technomanceer/motion-cli init` continua funcionando e usa o mesmo instalador (desde a 1.0.0 também instala as Skills; na rc.4 não instalava).

## 9. Remoção

1. `npm uninstall @technomanceer/motion-cli @technomanceer/motion-core @technomanceer/motion-studio-skills`
2. `rm -rf motion motion.config.json .motion .agents/skills .claude/skills` (confira antes: remova só o que for do MOTION se você tem outras Skills)

## Dependências Python opcionais

O mapa de batidas da Skill `cinematic-product-director` usa `numpy` (`>=2.0,<3`) e `scipy` (`>=1.13,<2`), e a suíte Python (`npm run test:py`) também utiliza `pillow`:

```bash
python3 -m venv .venv
.venv/bin/pip install pillow -r packages/motion-skills/skills/cinematic-product-director/scripts/requirements.txt
```

> Compatibilidade verificada: Python `3.12` (CI Ubuntu 24.04) e Python `3.14.5t` (venv local isolado, `numpy 2.5.5`, `scipy 1.18.1`, `pillow 13.0.0`). Quando `.venv/` existe no repositório, `scripts/ci_python_tests.py` delega automaticamente para o interpretador isolado da `.venv` sem alterar o Python global.
