# Checklist de Publicação — 1.0.0 (estável)

Pacotes (versões exatas e iguais; nenhuma dependência prerelease):

| Pacote | Versão | Depende de |
|---|---|---|
| `@technomanceer/motion-core` | 1.0.0 | playwright-core ^1.64.1, three ^0.165.0 |
| `@technomanceer/motion-studio-skills` | 1.0.0 | — |
| `@technomanceer/motion-cli` | 1.0.0 | core 1.0.0, skills 1.0.0, playwright-core ^1.64.1 |
| `@technomanceer/motion-studio` (novo) | 1.0.0 | cli 1.0.0 |

Nenhuma versão rc existente é alterada. **Ordem obrigatória:** core → skills → cli → studio (o registro precisa já conter as dependências de cada um).

## 1. Pré-voo (local, sem publicar)
```bash
cd ~/projetos/motion-studio
git status                                   # confira o diff; commit só com sua autorização
node --test tests/*.test.mjs                 # 46 devem passar
npm run skills:verify
npm run pack:all                             # gera dist/packages/*-1.0.0.tgz
npm whoami                                   # esperado: technomanceer
for p in motion-core motion-studio-skills motion-cli motion-studio; do
  npm view @technomanceer/$p@1.0.0 version 2>&1 | grep -q E404 && echo "$p@1.0.0 livre" || echo "$p@1.0.0 JÁ EXISTE"
done
```

## 2. Publicação (somente após autorização explícita)
Publica **os tarballs já auditados** (não reconstrói nada no `npm publish`) com a tag `next`, para ninguém receber o 1.0.0 por padrão antes da homologação. Antes, confira que os arquivos são os auditados:
```bash
cd ~/projetos/motion-studio/dist/packages
sha256sum -c SHA256SUMS-1.0.0.txt            # os 4 devem dar OK; se algo mudou, rode `npm run pack:all` e refaça a auditoria
for p in motion-core motion-studio-skills motion-cli motion-studio; do
  tar -tzf technomanceer-$p-1.0.0.tgz >/dev/null && echo "$p ok"
done
```
Ordem obrigatória:
```bash
cd ~/projetos/motion-studio/dist/packages
npm publish ./technomanceer-motion-core-1.0.0.tgz          --access public --tag next
npm publish ./technomanceer-motion-studio-skills-1.0.0.tgz --access public --tag next
npm publish ./technomanceer-motion-cli-1.0.0.tgz           --access public --tag next
npm publish ./technomanceer-motion-studio-1.0.0.tgz        --access public --tag next
```
O pacote novo `motion-studio` pode exigir 2FA/OTP (`--otp=<código>`). Se mudar qualquer arquivo depois do `pack:all`, os hashes mudam: regenere o `SHA256SUMS-1.0.0.txt` e reaudite antes de publicar.

## 3. Homologação pública (antes de promover)
```bash
rm -rf /tmp/h-npm /tmp/h-empty && mkdir /tmp/h-npm /tmp/h-empty
cd /tmp/h-npm && npm init -y >/dev/null
npx @technomanceer/motion-studio@next init       # esperado: exit 0, "Skills: 11", "Verificação de integridade"
npx @technomanceer/motion-studio@next init       # esperado: "inalteradas 11"
npx motion --version                             # esperado: motion v1.0.0
npx motion doctor
npx motion create video demo && npx motion render project motion/projects/demo   # MP4 1920x1080
cat package.json                                 # 3 devDependencies exatas em 1.0.0
cd /tmp/h-empty && npx @technomanceer/motion-studio@next init                     # modo standalone
cd /tmp/h-npm && claude -p "OK" --output-format stream-json --verbose --max-turns 1 | grep -o thermo-nuclear-code-quality-review | head -1
mkdir /tmp/h-pnpm && cd /tmp/h-pnpm && echo '{"name":"h"}' > package.json && touch pnpm-lock.yaml && npx @technomanceer/motion-studio@next init
npm view @technomanceer/motion-studio@1.0.0 dependencies   # só cli 1.0.0
```
Aprovação: todos os comandos acima com o resultado esperado.

## 4. Promoção para `latest`
Só se a seção 3 passou inteira:
```bash
for p in motion-core motion-studio-skills motion-cli motion-studio; do
  npm dist-tag add @technomanceer/$p@1.0.0 latest
done
npm view @technomanceer/motion-studio dist-tags
cd /tmp/h-npm && rm -rf node_modules .agents .claude .motion motion motion.config.json && npx @technomanceer/motion-studio init   # comando oficial, sem @next
```

## 5. Depois (cada item exige sua autorização)
- Commit, tag git `v1.0.0`, push e GitHub Release.
- Remover da seção 3 do README qualquer menção a "não publicado".

## 6. Rollback
Preferir `deprecate` (reversível); `unpublish` só nas primeiras 72h e se ninguém depender.
```bash
# 1. voltar o comando oficial para a rc anterior
for p in motion-core motion-studio-skills motion-cli; do npm dist-tag add @technomanceer/$p@1.0.0-rc.4 latest; done
npm dist-tag rm @technomanceer/motion-studio latest      # o instalador novo não tem rc anterior
# 2. avisar quem instalar a versão ruim
for p in motion-core motion-studio-skills motion-cli motion-studio; do
  npm deprecate @technomanceer/$p@1.0.0 "problema conhecido: <descrição>; use <versão corrigida>"
done
# 3. corrigir → publicar 1.0.1 (nunca republicar 1.0.0: o npm não permite)
```
Estado do projeto do usuário após uma instalação ruim: `rm -rf .agents/skills .claude/skills .motion` e `npm uninstall @technomanceer/motion-cli @technomanceer/motion-core @technomanceer/motion-studio-skills` (confira antes de remover Skills próprias).
