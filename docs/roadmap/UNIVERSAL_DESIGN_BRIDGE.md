# Roadmap — Universal Design Bridge

**Estado:** backlog arquitetural; nenhuma implementação de nova missão iniciada ou autorizada por este documento. O objetivo é tornar os contratos existentes M1–M5 interoperáveis com editores que exponham formatos e ferramentas documentadas, sem dependência obrigatória de um editor específico.

## Princípios vigentes

- Motion Core segue independente de MCP, OpenDesign, Doop e provedores de IA.
- Motion MCP é local e exclusivamente `stdio`; Skills orientam o agente a descobrir capacidades e schemas reais de cada editor.
- Integrações externas são opcionais. Se faltarem, produção, render, QA e normalização locais continuam disponíveis.
- Planejar, validar, executar e reler são estágios distintos. Escrita remota exige autorização explícita, dry-run e verificação posterior.
- Não usar APIs privadas, não simular sucesso e não classificar pixels como conteúdo editável.
- Não anunciar interoperabilidade por similaridade de screenshot. Relatar estrutura, aparência, editabilidade, componentes, tokens, assets e recursos não suportados separadamente.

## Lacunas observadas na M6

1. **Capacidade por editor:** o piloto Doop homologou criação e releitura de frames HTML, screenshots e hidratação de PNG em URLs públicas no laboratório. O piloto OpenDesign confirmou que arquivos HTML/CSS/SVG/JSON no workspace não equivalem a importar camadas nativas. Extrair capacidades públicas por operação antes de oferecer um adapter.
2. **Semântica de componentes/tokens:** converter CSS variables, tokens semânticos e referências a biblioteca somente quando o editor expuser IDs, definições e operações públicas. `<doop-use>` não expande sem a biblioteca real.
3. **Arbitragem de concorrência:** Doop MCP não fornece CAS atômico. `read → compare → write` detecta algumas mudanças, mas não elimina corrida entre a leitura e a operação. Nunca alegar atomicidade; preferir adição idempotente e destinos novos até existir suporte oficial.
4. **Classes de artefato:** distinguir HTML, SVG, imagem raster, vídeo, código JS/3D e recursos referenciados. Descrever o que segue editável e o que é apenas preview.
5. **Round-trip verificável:** cada adapter precisa demonstrar exportação, releitura, screenshots e métricas com suas limitações; SSIM não prova acessibilidade, semântica ou editabilidade.
6. **Confinamento local:** leitor de arquivos deve manter workspace explícito, verificar symlinks e evitar que um adapter envie dados locais sem escolha clara do usuário.
7. **Agent handoff:** documentar se a integração roda pelo agente próprio do editor, por um CLI de agente subjacente ou apenas por um cliente MCP de referência. Não chamar integração indireta de nativa.

## Pendências candidatas ao Universal Design Bridge

- Manter `DoopAdapter` como capacidade atual. O round-trip autorizado do laboratório terminou; tokens globais, biblioteca de componentes, expansão `<doop-use>`, upload de fontes e CAS atômico são limites do serviço externo observado e não devem bloquear o Motion Core.
- Manter OpenDesign como fluxo indireto por OpenCode CLI até que o daemon oficial e a injeção MCP no painel possam ser testados. A versão testada não justificou um adapter específico; construir um extractor para `MotionDesignIR@1` apenas se um contrato público de importação/exportação e semântica de camadas for confirmado.
- Definir fixtures e métricas para comparar estrutura, aparência, editabilidade, tokens, componentes e proveniência sem usar SSIM como substituto de fidelidade semântica.
- Investigar em separado o incidente intermitente de vídeo do Node 24 no CI, comparando o ambiente Node 24.22.3/FFmpeg 6.1.1 com o ambiente local Node 24.16.0/FFmpeg 8.0.1. Duas paridades locais aprovadas não identificam causa raiz.
- Avaliar capacidades somente por contratos públicos verificados, usando provas locais antes de escrita externa.
- Atualizar a matriz de compatibilidade e as Skills ao homologar um novo editor; Skills devem chamar ferramentas descobertas em runtime, sem listas especulativas de métodos.

Este roadmap não inicia integração com Open CoDesign, OpenPencil nem Motion Reel Studio e não autoriza escrita ou publicação externa.
