# Workflow permanente do repositório

Estas regras se aplicam a Codex, Claude Code, Antigravity, Gemini CLI e qualquer outro agente que altere o Motion Studio.

## Git

- Todo desenvolvimento acontece diretamente na branch `main` do repositório principal.
- Não crie branches auxiliares, branches por missão/feature/correção ou worktrees.
- Faça commits pequenos, atômicos e rastreáveis na `main`.
- Antes de editar, confira branch, status e diff. Preserve todas as alterações locais, arquivos não rastreados e conteúdo do usuário; nunca sobrescreva ou adicione automaticamente `Skills para adicionar e apagar/`.
- Não use `git reset --hard`, `git clean -fd`, remoção forçada de worktree ou force push.
- Atualize primeiro a documentação versionada afetada e mantenha nela decisões, contratos, limitações e continuidade entre agentes.

## Qualidade e remoto

- Antes de enviar alterações ao remoto, execute os quality gates do projeto: `npm run test:ci`, `npm run test:determinism`, `npm run test:py`, `npm run skills:verify`, `node packages/motion-cli/bin/motion.mjs doctor --json` e `npm pack --dry-run`.
- Execute também os gates específicos da mudança: segurança, contratos, Design Bridge, renderização offline e compatibilidade com Node.js 22 e 24 quando disponíveis.
- Registre com clareza qualquer gate não executado ou bloqueado; nunca reporte uma verificação não executada como aprovada.
- Envie commits somente da `main` e confirme `main` sincronizada com `origin/main` e o CI concluído.

## Continuidade entre agentes

- Trate `AGENTS.md` como instrução compartilhada; `CLAUDE.md` e `GEMINI.md` apontam para estas mesmas regras.
- Atualize documentação de missão e contratos no mesmo fluxo de código. Preserve contexto suficiente para outro agente continuar sem depender do histórico de uma sessão privada.
- Referências a branches antigas podem permanecer em registros de auditoria; não as use como instruções de execução atuais.
