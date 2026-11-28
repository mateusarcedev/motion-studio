# Instruções para Gemini CLI

Siga [`AGENTS.md`](AGENTS.md) e [`docs/WORKFLOW.md`](docs/WORKFLOW.md). Trabalhe diretamente em `main`, sem criar branches auxiliares ou worktrees. Preserve o estado local, registre mudanças e decisões na documentação versionada e execute verificações proporcionais ao impacto antes do push. Use `npm run test:changed -- --explain` para selecionar e executar a menor cobertura aplicável; acrescente `--dry-run` para inspecionar sem execução. Consulte [`docs/testing/TESTING.md`](docs/testing/TESTING.md) para grupos e bloqueios registrados.
