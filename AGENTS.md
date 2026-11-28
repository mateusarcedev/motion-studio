# Instruções para agentes

Leia [`docs/WORKFLOW.md`](docs/WORKFLOW.md) antes de alterar o repositório. Todo trabalho do Motion Studio deve acontecer diretamente em `main`, sem branches auxiliares ou worktrees. Preserve alterações locais e arquivos não rastreados, faça commits atômicos, atualize documentação versionada e execute verificações proporcionais ao impacto antes de enviar ao remoto.

As instruções criativas deste projeto permanecem em [`CLAUDE.md`](CLAUDE.md); estas regras de Git e continuidade valem para todos os agentes. Selecione verificações proporcionais ao impacto da alteração conforme [`docs/WORKFLOW.md`](docs/WORKFLOW.md); a suíte completa não é obrigatória antes de cada push.

Use `npm run test:changed -- --explain` para selecionar testes pela alteração; acrescente `--dry-run` para apenas inspecionar. Os grupos `test:quick`, `test:unit`, `test:integration` e `test:media` são seleções distintas. Leia [`docs/testing/TESTING.md`](docs/testing/TESTING.md) para regras de seleção e cobertura. Mudanças documentais isoladas não devem iniciar testes de mídia.
