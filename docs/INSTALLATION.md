# Guia de Instalação — MOTION Studio

O MOTION Studio pode ser instalado em qualquer projeto Node.js / TypeScript existente sem a necessidade de clonar o monorepo ou criar links simbólicos secretos.

---

## 1. Pré-Requisitos do Sistema

Antes da instalação, certifique-se de que seu ambiente possui:

| Requisito | Versão Mínima | Função | Como Verificar |
|---|---|---|---|
| **Node.js** | `>= 18.0.0` (recomendado `>= 20`) | Runtime de execução | `node -v` |
| **Python 3** | `>= 3.9` | Manifesto SHA-256 e contact sheets | `python3 --version` |
| **FFmpeg** | `>= 6.0` | Codificação YUV420p CFR 30fps | `ffmpeg -version` |
| **Chromium** | Via Playwright | Captura de frames e screenshots de alta resolução | Instalado automaticamente ou via `npx playwright install chromium` |

---

## 2. Instalação em Projeto Consumidor (Next.js, Vite, etc.)

### Via Pacotes Locais (Tarballs)

Se você estiver utilizando a distribuição empacotada localmente:

```bash
# Na raiz do seu projeto consumidor:
npm install \
  /caminho/para/mateusarcedev-motion-core-1.0.0-rc.4.tgz \
  /caminho/para/mateusarcedev-motion-cli-1.0.0-rc.4.tgz

# Opcional: catálogo curado de Skills públicas
npm install /caminho/para/mateusarcedev-motion-studio-skills-1.0.0-rc.4.tgz
```

### Via Registro NPM (Quando Publicado)

```bash
npm install -D @technomanceer/motion-cli @technomanceer/motion-core
# Opcional: Skills públicas curadas
npm install @technomanceer/motion-studio-skills
```

The public registry is not updated by this mission. Confirm published package versions before using the registry command; the compatibility check here uses an isolated install from the locally packed tarballs documented above.

---

## 3. Diagnóstico do Ambiente (`doctor`)

Após instalar o pacote, execute o diagnóstico automatizado para confirmar que todos os motores e dependências estão prontos:

```bash
npx motion doctor
```

O comando verificará:
- Versão do Node.js
- Instalação do Python 3
- Disponibilidade do FFmpeg no PATH
- Executável do Chromium no cache do Playwright ou no sistema
- Dependências opcionais (Three.js, Blender, Chatterbox TTS)

---

## 4. Inicialização no Projeto (`init`)

Para inicializar a estrutura do MOTION Studio no seu projeto:

```bash
npx motion init --brand="NomeDaSuaMarca"
```

O que o `motion init` faz:
1. Cria o arquivo de configuração `motion.config.json`.
2. Cria os diretórios isolados `motion/brand`, `motion/projects` e `motion/out`.
3. Gera os tokens iniciais (`motion/brand/tokens.json`) e o perfil de marca (`motion/brand/PROFILE.md`).
4. Cria a galeria local isolada (`motion/gallery.json`).
5. Se o pacote opcional de Skills estiver instalado, instala somente o catálogo autorizado em `.agents/skills/` com adaptadores para Claude Code (`.claude/skills`) e OpenCode (`.opencode/skills`). Sem esse pacote, a CLI cria a estrutura e permanece funcional.
6. **Proteção de sobrescrita:** Não altera arquivos existentes sem a flag `--force`.

---

## 5. Remoção Limpa

Se desejar remover a integração do MOTION sem afetar seu projeto principal:
1. Remova as dependências: `npm uninstall @technomanceer/motion-cli @technomanceer/motion-core @technomanceer/motion-studio-skills`
2. Remova as pastas de configuração: `rm -rf motion/ motion.config.json .agents/skills`
3. O seu projeto continuará funcionando exatamente como antes.
