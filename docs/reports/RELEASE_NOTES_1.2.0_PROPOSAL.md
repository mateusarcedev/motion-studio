# Proposta de release — MOTION Studio 1.2.0

**Estado:** proposta, não publicada · **Versão atual no registry:** `1.1.1` · **Tipo:** minor compatível.

## Notas de release propostas

### Adicionado

- Motion MCP local por stdio com render estático, quadros, vídeo, carrossel, QA determinístico, safe zones, cinco viewports, validação/otimização SVG e ferramentas locais de Design Bridge.
- 19 ferramentas MCP novas sobre os motores do Motion Core; as 11 ferramentas Smart Reel/Voice/STT existentes permanecem no catálogo.
- Skills `design-to-motion`, `motion-to-design` e `doop-bridge`; perfis de instalação seletivos, incluindo `integration`.
- Respostas estruturadas, hashes de artefatos, isolamento por workspace, cancelamento e limites de entrada, pedidos, filas e retenção de jobs.
- Proteção para não empacotar arquivos com aparência de credenciais em ZIP de entrega.

### Alterado

- Distribuição de Skills com manifesto, hashes e filtragem explícita de conteúdo de desenvolvimento desnecessário.
- Documentação de instalação, matriz de compatibilidade, QA e coordenação opcional com o Doop MCP oficial.

### Compatibilidade e limites

- Node.js `>=20`; CI deve confirmar Node 20, 22 e 24.
- Motion MCP exige processo local `stdio`; não há endpoint HTTP, proxy Doop ou serviço remoto.
- Doop é opcional. A disponibilidade do canvas `Motion Studio — Integration Lab` e a homologação do round-trip externo ainda estão pendentes.
- O MCP Doop conectado não expõe operações para criar tokens ou componentes nem para expandir `<doop-use>`; vídeos e 3D são exportados como referência, não como objetos nativos editáveis.
- Pacotes anteriores não recebem atualização automática; o consumidor atualiza o conjunto CLI/Core/Skills/installer como uma versão compatível.

## Matriz de compatibilidade proposta

Veja [`COMPATIBILITY.md`](../COMPATIBILITY.md). Claude Code 2.1.332, Codex CLI 0.172.0 e Antigravity CLI 1.5.16 passaram smoke tests reais. OpenCode 2.2.5 está parcial por encerramento do processo MCP sob serviço preexistente. Gemini CLI não foi instalado/testado. A homologação Doop real está pendente.

## Tamanho atual dos tarballs locais

| Pacote | Versão local | Bytes compactados | Bytes descompactados |
|---|---:|---:|---:|
| `@technomanceer/motion-core` | 1.1.1 | 783.819 | 2.783.835 |
| `@technomanceer/motion-studio-skills` | 1.1.1 | 14.065.752 | 27.680.507 |
| `@technomanceer/motion-cli` | 1.1.1 | 62.472 | 206.732 |
| `@technomanceer/motion-studio` | 1.1.1 | 5.330 | 14.186 |

Os arquivos foram empacotados/instalados localmente; isso não altera a versão no registry.

## Checklist antes de qualquer publicação

- [ ] Resolver a pendência M6 do canvas de integração e guardar relatório externo autorizado, ou aprovar explicitamente o release com Doop real marcado como não homologado.
- [ ] Aprovar formalmente `1.2.0`; atualizar as versões dos quatro pacotes e as dependências internas exatas (`motion-core`, `motion-studio-skills`, `motion-cli`, `motion-studio`).
- [ ] Atualizar changelog, documentação, lockfiles, manifesto público e hashes de Skills; garantir que cada hash reflita o snapshot publicado.
- [ ] Executar `npm run test:ci`, `npm run test:determinism`, `npm run test:py`, `npm run skills:verify`, `motion doctor`, `npm pack --dry-run` e `scripts/release-gate.mjs`.
- [ ] Executar matriz Node 20/22/24 no CI e revisar a matriz por cliente MCP; testar os quatro tarballs 1.2.0 em diretório limpo.
- [ ] Publicar `motion-core` e `motion-studio-skills` antes de `motion-cli`; publicar `motion-studio` por último, depois de verificar as dependências exatas. Não publicar uma camada se qualquer tarball dependente ainda não existe.
- [ ] Aplicar tag `latest` apenas após validação do conjunto completo; monitorar CI e smoke de instalação pós-publicação.

**Decisão recomendada:** a mudança aditiva justifica uma minor `1.2.0`, mas segurar a publicação até o CI da M6 e a decisão sobre a pendência de homologação Doop. Esta proposta não atualiza versões nem autoriza publicação.
