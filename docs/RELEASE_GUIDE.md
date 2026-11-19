# Guia de release (npm)

Ordem obrigatória: **core → skills → cli → studio** (cada um depende do anterior, com versão exata). Versões exatas e iguais nos quatro pacotes.

## 1. Gate (sem publicar)
```bash
node scripts/release-gate.mjs        # testes, tarballs + SHA-256, auditoria de conteúdo, consumidor limpo, doctor, assets, SVG, render, vídeo+áudio, QA, erros estruturados
```
Gera `docs/reports/RELEASE_<versão>_REPORT.md`. Estados: PASS/WARN/FAIL/BLOCKED/NOT_TESTED. **FAIL ou BLOCKED impedem publicar.** `NOT_TESTED` precisa ser declarado ao aprovador (hoje: Node 18/20/22 — rode `node --test tests/*.test.mjs` em cada versão).

## 2. Versão
SemVer: correção → patch; funcionalidade aditiva → minor; quebra de contrato público → major. Mudança de comportamento que corrige um falso positivo conta como minor se documentada no CHANGELOG com opt-out. Atualize: `package.json` (raiz + 4 pacotes), deps internas exatas, `public-skills.json` (`package.version`), `scripts/pack-all.mjs`, `scripts/verify-public-skills.mjs`, `tests/skills_distribution.test.mjs`, CHANGELOG, README.

## 3. Publicação (somente com autorização explícita)
Autenticação: `npm whoami` → `technomanceer` (pode exigir `--otp`). Publica os **tarballs auditados**, na tag `next` primeiro, para a tag `latest` continuar na versão anterior até a homologação pública:
```bash
cd dist/packages && sha256sum -c SHA256SUMS-<v>.txt
npm publish ./technomanceer-motion-core-<v>.tgz          --access public --tag next
npm publish ./technomanceer-motion-studio-skills-<v>.tgz --access public --tag next
npm publish ./technomanceer-motion-cli-<v>.tgz           --access public --tag next
npm publish ./technomanceer-motion-studio-<v>.tgz        --access public --tag next
```
Verificação do que está no registro: `npm view @technomanceer/<pkg>@<v> dist.integrity dist.tarball dependencies` e comparar `dist.integrity`/arquivos com os tarballs locais (`npm pack @technomanceer/<pkg>@<v>` + `sha256sum`).

## 4. Homologação pública e promoção
Instale **somente** pelos pacotes públicos (`npx @technomanceer/motion-studio@next init`) em uma pasta nova, rode a produção de teste e, aprovada, promova:
```bash
for p in motion-core motion-studio-skills motion-cli motion-studio; do npm dist-tag add @technomanceer/$p@<v> latest; done
```
Rollback: `npm dist-tag add @technomanceer/<pkg>@<versão-anterior> latest` (nunca `npm unpublish` de versão já consumida).

## 5. Proveniência
`npm publish --provenance` exige CI com OIDC (não há `.github/workflows` hoje; publicação é local). Integridade é garantida por SHA-256 dos tarballs + `dist.integrity` do registro.
