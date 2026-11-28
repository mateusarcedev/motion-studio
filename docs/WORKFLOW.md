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

- Comece identificando o diff e, quando a seleção automática ajudar, execute `npm run test:changed -- --explain`. Esse comando mostra a seleção e a executa; use `npm run test:changed -- --explain --dry-run` para inspecionar sem executar. `--base=REF` inclui commits desde a referência, além das alterações locais staged, unstaged e novas.
- Para uma alteração isolada, execute a suíte direcionada e os verificadores de formato/tipos/contratos que realmente a cobrem. `npm run test:quick` é o ciclo local mínimo; `test:unit`, `test:integration` e `test:media` executam grupos distintos definidos no catálogo central. Consulte [`testing/TESTING.md`](testing/TESTING.md) para critérios, grupos e exemplos.
- `npm run test:changed` nunca transforma uma seleção vazia em aprovação: sem diff usa o grupo `quick`; impacto desconhecido amplia a execução para todos os testes de CI executáveis; documentação isolada executa apenas `git diff --check` e informa que nenhum teste de produto foi executado. Registros `blocked` relacionados são mostrados separadamente e nunca contam como aprovados.
- `npm run test:ci` executa os testes JavaScript centrais nas versões de Node da matriz. `npm run test:py` executa todos os arquivos Python executáveis e lista os registros bloqueados; `test:py:standalone` e `test:py:matrix` separam os testes sem dependência de versão Node dos quatro contratos que a matriz precisa executar.
- Para mudanças em Skills, use a seleção por impacto e `npm run skills:verify`; `npm run test:skills` executa os testes Node/Vitest das Skills. Para mudanças de mídia/render/QA, use `npm run test:media` e/ou `npm run test:determinism`; prefira o replay focado documentado em `docs/DETERMINISM.md` quando o cenário for isolável. Uma reexecução aprovada não apaga evidência de divergência anterior.
- `npm run test:release` é explicitamente reservado à preparação de release. Ele gera tarballs dos pacotes públicos, executa auditorias e testes de instalação; não é uma validação local cotidiana. O job de release do GitHub Actions só é habilitado manualmente.
- `motion doctor --json` serve a mudanças de ambiente/instalação/dependências.
- Não execute `npm pack --dry-run` na raiz privada do monorepo como verificação de rotina. Empacote apenas os pacotes públicos afetados e somente quando distribuição/manifestos forem parte da mudança.
- Mudanças em arquivos de produção usam QA apenas dos formatos e artefatos afetados; não refaça campanhas ou pilotos históricos para validar uma mudança sem relação com eles.
- Para documentação sem código, `git diff --check` e verificadores de Markdown/links aplicáveis são suficientes. A suíte completa não é exigida.
- Nunca enfraqueça, desabilite ou ignore testes para obter PASS. Registre comandos executados, resultados, cobertura não executada e bloqueios; `NOT_TESTED`, `BLOCKED`, `FAIL` e `INCONCLUSIVE` não equivalem a `PASS`.
- Antes do push, confirme a revisão do diff e que os testes proporcionais passaram. Envie commits somente da `main`; após o push, confirme `main` sincronizada com `origin/main` e aguarde o CI remoto abrangente. Corrija falhas de CI quando forem regressões; preserve como incidentes separados as falhas intermitentes ou de infraestrutura.

## Continuidade entre agentes

- Trate `AGENTS.md` como instrução compartilhada; `CLAUDE.md` e `GEMINI.md` apontam para estas mesmas regras.
- Atualize documentação de missão e contratos no mesmo fluxo de código. Preserve contexto suficiente para outro agente continuar sem depender do histórico de uma sessão privada.
- Referências a branches antigas podem permanecer em registros de auditoria; não as use como instruções de execução atuais.
