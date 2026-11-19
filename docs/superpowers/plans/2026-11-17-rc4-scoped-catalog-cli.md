# Plano: distribuição MOTION Studio `1.0.0-rc.4`

## Objetivo

Preparar Core, CLI e um catálogo de Skills verificável sob `@technomanceer/*`, mantendo as Skills locais fora do tarball quando a licença ou a proveniência não autorizar redistribuição. Não publicar, commitar, enviar ou fazer deploy.

## Trabalho

- [x] Confirmar identidade npm e registrar configuração/acesso atual do namespace; permissão de escrita continua pendente.
- [x] Auditar as 51 Skills e revisar conteúdo já presente no `main` público; distinguir catálogo local, Skills liberadas e integrações externas.
- [x] Criar manifesto público verificável com origem, versão/snapshot, licença, atribuição e hash; limitar o tarball à lista liberada.
- [x] Renomear manifests e imports para `@technomanceer/*`, sincronizar `1.0.0-rc.4` e tornar o catálogo de Skills opcional para a CLI.
- [x] Atualizar relatório de prontidão, instalação e referência da CLI.
- [x] Executar suíte completa, empacotamento e instalação clean-room sem resolver dependências pelo monorepo.
- [x] Apresentar bloqueadores e proposta de publicação, sem executar publicação nem operações Git remotas.

## Critérios de aceitação

- Os três manifests npm estão no escopo correto e em `1.0.0-rc.4`.
- `init`, `list`, `doctor`, `create`, `render` e `export` não dependem de `@technomanceer/motion-studio-skills` para executar; `init` e `list` explicam quando o catálogo opcional não está instalado.
- O pacote Skills contém apenas entradas do manifesto público e os avisos/licenças exigidos; os arquivos locais não liberados permanecem no checkout, fora do artefato npm.
- O teste clean-room instala e exercita a CLI e Core sem o pacote Skills, e valida a instalação opcional do catálogo quando incluído.
- `npm publish`, commit, push e deploy não são executados.
