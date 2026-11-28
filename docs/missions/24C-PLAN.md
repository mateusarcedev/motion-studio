# Missão 24C — Paridade, catálogo e estabilização

## Estado

**Parcial.** Referência inicial: `3cfb15af6f55070dca7d010a603af8e3cd7e9bf8`, `main` limpa e sincronizada. O catálogo Python foi recuperado, e o CI terá captura mais completa da paridade. A causa da divergência CLI × MCP não foi identificada; não há correção nem regressão associada. O relatório final está em [`M24C_STABILIZATION.md`](../reports/M24C_STABILIZATION.md).

## Plano e aceitação

- [x] Confirmar branch, HEAD, working tree e referência remota.
- [x] Ler as instruções, políticas, planos e relatórios M24/M24B aplicáveis.
- [x] Inspecionar runs e artefatos `46106703492`, `46108296635`, `46107491931`, `46109037653` e histórico `45884408723`; baixar e comparar `15248270932` e `15248339059`.
- [x] Fazer replays independentes sobre as entradas históricas preservadas e comparar streams, intermediários e metadados. Os replays passaram, mas não reproduziram os MP4s históricos; resultado inconclusivo.
- [x] Investigar histórico, referências, contratos e implementações equivalentes dos três scripts Python.
- [x] Restaurar os scripts válidos a partir do upstream identificado e executar os dois contratos em modo offline, sem stubs.
- [x] Reclassificar os testes no catálogo e validar descoberta/classificação; Jianying continua manual.
- [ ] Identificar uma causa reproduzível da paridade, corrigir o motor e adicionar regressão ligada a essa causa.
- [x] Ampliar a captura de ambiente/argv FFmpeg para futuras falhas sem alterar critérios ou outputs do render.
- [x] Executar verificações locais proporcionais: testes Python direcionados, catálogo/seletor, integridade de Skills, sintaxe, diff e inspeção de seleção; sem suíte completa local.
- [x] Avaliar o release gate; não executar: Node 20/22 não estão instalados localmente, `npm whoami` retornou HTTP 401 e o gate modifica tarballs e relatório pré-existentes em `dist/packages`/`docs/reports`.
- [x] Executar replay focado pós-push em Node 20: três rodadas passaram sem divergência; isso não resolve a causa. O CI abrangente do primeiro push estava em execução e a revisão de retenção compacta ainda aguarda novo CI.
- [ ] Acompanhar o CI abrangente no HEAD final e registrar runs, artefatos, tempos e commits no relatório.
- [ ] Confirmar `main` limpa e sincronizada com `origin/main`.

## Limites preservados

- A execução verde isolada e retries não comprovam resolução.
- Sem causa identificada, a divergência permanece inconclusiva e não será mascarada com tolerâncias ou alterações no contrato de render.
- Os artefatos e scripts temporários de usuário não devem ser sobrescritos; os resultados completos ficam referenciados pelos artefatos retidos no CI.
- A Missão 24B continua historicamente parcial no seu encerramento. M24C fecha a lacuna posterior do catálogo Python, mas não reescreve aquele estado histórico.

