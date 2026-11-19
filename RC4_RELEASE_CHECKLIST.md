# Checklist de Release — MOTION Studio `1.0.0-rc.4`

**Namespace NPM:** `@technomanceer`  
**Data de Preparação:** 18 de novembro de 2026  
**Status Atual:** Pronto para Publicação (Aguardando Autorização)  
**Dist-Tag:** `next`  

---

## 1. Verificações de Identidade & Acesso NPM

- [x] **Identidade npm confirmada**: Usuário `technomanceer` (`npm whoami`).
- [x] **Registro npm oficial**: `https://registry.npmjs.org/` (`npm config get registry`).
- [x] **Propriedade do escopo**: Escopo de usuário `@technomanceer` pertence à conta autenticada.
- [x] **Status dos pacotes no registro**: Retornam `E404` (nenhum pacote publicado anteriormente sob este namespace).
- [x] **Ausência de credenciais no repositório**: Nenhum token npm, chave de API ou `.npmrc` com segredos nos pacotes.

---

## 2. Configuração dos Manifests dos Pacotes

- [x] **`@technomanceer/motion-core`**:
  - [x] `name`: `@technomanceer/motion-core`
  - [x] `version`: `1.0.0-rc.4`
  - [x] `publishConfig.access`: `"public"`
  - [x] `publishConfig.tag`: `"next"`
  - [x] `repository.url`: `https://github.com/mateusarcedev/motion-studio.git`
  - [x] Licença: `Apache-2.0`
- [x] **`@technomanceer/motion-cli`**:
  - [x] `name`: `@technomanceer/motion-cli`
  - [x] `version`: `1.0.0-rc.4`
  - [x] `dependencies["@technomanceer/motion-core"]`: `"1.0.0-rc.4"`
  - [x] `peerDependencies["@technomanceer/motion-studio-skills"]`: `"1.0.0-rc.4"`
  - [x] `peerDependenciesMeta`: marcado como `optional: true`
  - [x] `publishConfig.access`: `"public"`
  - [x] `publishConfig.tag`: `"next"`
- [x] **`@technomanceer/motion-studio-skills`**:
  - [x] `name`: `@technomanceer/motion-studio-skills`
  - [x] `version`: `1.0.0-rc.4`
  - [x] `publishConfig.access`: `"public"`
  - [x] `publishConfig.tag`: `"next"`
  - [x] `files`: lista explícita contendo apenas as 11 Skills autorizadas

---

## 3. Preservação do Modelo de Skills (Missão 19.5 & 19.6)

- [x] **11 Skills Curadas e Autorizadas no Pacote**:
  1. `3d-scene-director` (Apache-2.0)
  2. `anatomy` (MIT)
  3. `carousel-studio` (Apache-2.0)
  4. `explainer-motion` (Apache-2.0)
  5. `feed-studio` (Apache-2.0)
  6. `motion-director` (Apache-2.0)
  7. `shorts-director` (Apache-2.0)
  8. `story-studio` (Apache-2.0)
  9. `studio-director` (Apache-2.0)
  10. `thermo-nuclear-code-quality-review` (Apache-2.0)
  11. `web-director` (Apache-2.0)
- [x] **40 Skills Locais Mantidas Fora do Pacote Distribuível**:
  - Nenhuma skill não licenciada ou Remotion presente no tarball.
- [x] **4 Integrações Comunitárias sob Demanda**:
  - `aula-interativa`, `motion-designer`, `ui-humanizer`, `stageshow` instaláveis via `npx skills add`, sem cópia no pacote npm.
- [x] **Manifesto Criptográfico `public-skills.json`**:
  - Validado via `npm run skills:verify` (hashes SHA-256 de todos os `SKILL.md` e arquivos de licença conferidos).

---

## 4. Testes e Auditoria dos Pacotes

- [x] **`npm run skills:verify`**: Passou sem advertências.
- [x] **`npm test`**: 31/31 testes passaram.
- [x] **Testes de Transições Python**: 8/8 testes passaram.
- [x] **Geração dos Tarballs (`npm run pack:all`)**:
  - [x] `dist/packages/technomanceer-motion-core-1.0.0-rc.4.tgz` (26 arquivos, 55.2 kB)
  - [x] `dist/packages/technomanceer-motion-studio-skills-1.0.0-rc.4.tgz` (189 arquivos, 14.2 MB)
  - [x] `dist/packages/technomanceer-motion-cli-1.0.0-rc.4.tgz` (14 arquivos, 25.6 kB)
- [x] **Auditoria de Conteúdo dos Tarballs**:
  - Sem arquivos temporários, sem `node_modules`, sem frames de renders.
  - Sem caminhos absolutos locais (`/home/mateusarcedev/...`).

---

## 5. Homologação Clean-Room (Consumidor Independente)

- [x] Instalação em `/tmp` fora do monorepo via tarball local (sem monorepo linking).
- [x] CLI opera sem o pacote `@technomanceer/motion-studio-skills`.
- [x] `motion --version` reporta `v1.0.0-rc.4`.
- [x] `motion list` funciona sem skills opcionais.
- [x] `motion init` cria projeto sem skills opcionais.
- [x] `motion doctor` identifica ferramentas e reporta catálogo de skills como opcional.
- [x] `motion create website` gera scaffold funcional.
- [x] `motion render static` gera imagem válida.
- [x] `motion export` gera arquivo ZIP com manifesto SHA-256.
- [x] Instalação posterior do catálogo de skills instala com sucesso as 11 Skills públicas.
- [x] Nenhuma dependência quebrada ou peer dependency incompatível.

---

## 6. Tentativa de Publicação e Exigência de 2FA

A publicação foi autorizada pelo usuário e iniciada sequencialmente pelo Passo 1 (`@technomanceer/motion-core@1.0.0-rc.4`).

**Resultado:**
- **Código:** `E403 Forbidden`
- **Mensagem do Registro npm:**
  ```
  npm error 403 403 Forbidden - PUT https://registry.npmjs.org/@technomanceer%2fmotion-core - Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages.
  ```
- **Ação adotada:** Sequência imediatamente interrompida conforme instrução explícita de segurança ("Se houver erro de autenticação, permissão, licença ou integridade, interrompa a sequência e apresente o problema. Não tente contornar controles de segurança.").

### Resolução Necessária para Completar a Publicação:

O registro npm exige autenticação de dois fatores (2FA) para publicação de pacotes na conta `technomanceer`. Há duas formas de concluir:

**Opção A (Recomendada via Token Granular com Bypass 2FA):**
1. Acesse: https://www.npmjs.com/settings/technomanceer/tokens
2. Crie um *Granular Access Token* com:
   - Permissões de Pacotes: `Read and write` para o escopo `@technomanceer`
   - Opção: `Bypass 2FA for publishing` ativada
3. Configure o token localmente (`npm config set //registry.npmjs.org/:_authToken=...` ou via `.npmrc`).
4. Re-execute o comando de publicação.

**Opção B (Código OTP Interativo):**
Fornecer o código de 6 dígitos gerado pelo aplicativo autenticador 2FA no momento da publicação:
```bash
npm publish dist/packages/technomanceer-motion-core-1.0.0-rc.4.tgz --access public --tag next --otp=XXXXXX
npm publish dist/packages/technomanceer-motion-studio-skills-1.0.0-rc.4.tgz --access public --tag next --otp=XXXXXX
npm publish dist/packages/technomanceer-motion-cli-1.0.0-rc.4.tgz --access public --tag next --otp=XXXXXX
```

---

## 7. Status de Bloqueio

| Item | Status | Responsável |
|---|---|---|
| Migração técnica de código e manifests | CONCLUÍDO | Antigravity |
| Verificação de scripts e testes (31/31) | CONCLUÍDO | Antigravity |
| Testes clean-room em diretório isolado | CONCLUÍDO | Antigravity |
| Tarballs finais prontos em `dist/packages/` | CONCLUÍDO | Antigravity |
| Autorização formal para publicação | APROVADA | Usuário |
| Publicação no Registro npm | **PAUSADA (2FA exigido pelo npm)** | **Usuário (Token / OTP)** |
