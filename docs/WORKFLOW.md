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

A validação deve ser proporcional às superfícies afetadas. Não execute toda a suíte local por rotina antes de cada push: use o GitHub Actions como validação abrangente final e preserve ciclos locais curtos.

- Comece pelos testes mais próximos do código alterado. Para uma mudança isolada, execute a suíte direcionada e os verificadores de formato/tipos/contratos que realmente a cobrem.
- Use `npm run test:ci` quando a alteração atravessar módulos ou contratos, afetar comportamento geral, dependências, CLI/MCP, segurança, distribuição, ou quando não houver cobertura direcionada suficiente. Não o repita depois de uma alteração exclusivamente documental.
- Use `npm run test:determinism` para alterações no render/media/QA e investigações explícitas de determinismo; prefira o modo focado/repetido documentado em `docs/DETERMINISM.md` quando o cenário for isolável. Uma reexecução aprovada não apaga evidência de uma divergência anterior.
- Use `npm run test:py` para código Python ou integração entre os motores Python e JavaScript; `npm run skills:verify` para Skills, catálogos, manifests ou hashes de Skills; `motion doctor --json` para mudanças de ambiente/instalação/dependências; empacotamento e `release-gate` apenas para mudanças de pacote ou preparação de release.
- Não execute `npm pack --dry-run` na raiz privada do monorepo como verificação de rotina. Empacote apenas os pacotes públicos afetados e somente quando distribuição/manifestos forem parte da mudança.
- Mudanças em arquivos de produção usam QA apenas dos formatos e artefatos afetados; não refaça campanhas ou pilotos históricos para validar uma mudança sem relação com eles.
- Para documentação sem código, `git diff --check` e verificadores de Markdown/links aplicáveis são suficientes. A suíte completa não é exigida.
- Nunca enfraqueça, desabilite ou ignore testes para obter PASS. Registre comandos executados, resultados, cobertura não executada e bloqueios; `NOT_TESTED`, `BLOCKED`, `FAIL` e `INCONCLUSIVE` não equivalem a `PASS`.
- Antes do push, confirme a revisão do diff e que os testes proporcionais passaram. Envie commits somente da `main`; após o push, confirme `main` sincronizada com `origin/main` e aguarde o CI remoto abrangente. Corrija falhas de CI quando forem regressões; preserve como incidentes separados as falhas intermitentes ou de infraestrutura.

## Continuidade entre agentes

- Trate `AGENTS.md` como instrução compartilhada; `CLAUDE.md` e `GEMINI.md` apontam para estas mesmas regras.
- Atualize documentação de missão e contratos no mesmo fluxo de código. Preserve contexto suficiente para outro agente continuar sem depender do histórico de uma sessão privada.
- Referências a branches antigas podem permanecer em registros de auditoria; não as use como instruções de execução atuais.
