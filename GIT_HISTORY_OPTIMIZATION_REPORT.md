# MOTION Studio — Git History Optimization Report

Data: 16/11/2026
Branch e commit auditados: main — ab723122b8ba20c285f265e4ea55ed7a7c48b06f (tracker)
Remote configurado: https://github.com/mateusarcedev/motion-studio.git
Escopo: inventário e simulações isoladas; nenhuma alteração de histórico remoto.

## 1. Resumo executivo

A simulação A remove somente os 1.200 PNGs intermediários de Carga-01 do histórico em uma cópia bare descartável. Ela reduz o pack transferido em clone completo de 868.567.342 para 301.253.552 bytes: 541,03 MiB ou 65,32%. O checkout medido cai 544,81 MiB (39,58%). O clone completo local caiu de 74,62 s para 7,21 s; esse tempo é uma observação de uma execução local, não uma promessa de desempenho de rede.

A simulação B não encontrou artefatos adicionais que pudessem ser removidos com segurança. Depois de excluir os mesmos PNGs da A, não há outros frames ou builds rastreados comprovadamente regeneráveis e dispensáveis. Portanto, B resulta no mesmo objeto Git, árvore e métricas da A; não é uma medição independente.

A simulação C retira do histórico cópias instaladas de Skills na raiz e em Carga-01, mantendo a fonte npm. O checkout fica 433,68 MiB menor, porém o pack transferido cai apenas 33.394 bytes (0,0038%). Além disso, o clone deixa agentes sem descoberta direta de Skills até executar o instalador. Com o fluxo atual, C não está pronto para adoção.

Recomendação: aprovar tecnicamente a limpeza de histórico A em uma migração futura, depois de uma autorização humana específica para reescrever refs públicas. Manter as Skills instaladas no checkout até existir bootstrap automático e regressão de compatibilidade. A Mission 19.1 já preparou a remoção do índice das PNGs; um commit comum dessa limpeza não elimina os blobs históricos. Esta missão não fez commit, push, deploy, publicação npm nem reescrita do repositório original.

## 2. Preservação e backup verificável

Antes das medições, o checkout original foi inventariado e copiado para fora do repositório. O backup está em:

    /home/mateusarcedev/projetos/.motion-studio-m19.2-backup-20261116

Contém:

- repository.bundle: bundle Git integral das refs e objetos auditados.
- worktree.tar: snapshot dos arquivos do worktree, incluindo ocultos, arquivos ignorados, node_modules, frames locais e trabalhos pendentes, excluindo somente .git.
- state/git-index: cópia exata do índice original.
- state/git-config, state/git-HEAD, branches, tags, remotes, commits, refs, status e patch das mudanças não staged.
- Um bare repo filtrado de C usado para reproduzir as validações.

Verificações:

| Evidência | Resultado |
|---|---|
| SHA-256 de repository.bundle | 34872e7c17f3cd4b5ae82334f92eaabedd00ba7aa67c8b2c7111c9ba52537643 |
| SHA-256 de worktree.tar | d75b88269061ac967a342436e249de42dc1b2e9e110e826ab07a776d7a1d6abb |
| SHA-256 de state/git-index | ce0bbf3be726266919800dd544c9d6c16df9b4b8322f2b4acd08b4f95758b8ad |
| Índice atual comparado ao backup | Idêntico byte a byte |
| git bundle verify | Aprovado |
| Inventário do tar | 17.392 entradas; não inclui .git; frames locais presentes |
| git fsck --full --no-reflogs no bare C | Aprovado |

O checkout original permaneceu em main no commit ab723122b8ba20c285f265e4ea55ed7a7c48b06f. Antes deste relatório, havia 1.200 remoções staged, 23 entradas rastreadas modificadas e 19 entradas untracked já existentes. O diff staged é trabalho da Mission 19.1; as modificações e arquivos untracked incluem entregas da Mission 19 e documentação anterior. O único novo arquivo deste trabalho no checkout é este relatório. Nenhum arquivo local foi apagado ou restaurado.

## 3. Inventário do repositório e classificação

### Estado Git e dimensões

| Medida | Estado encontrado |
|---|---:|
| Caminhos no tree do commit auditado | 12.343 |
| Conteúdo da árvore do commit | 1.443.195.176 bytes / 1.376,34 MiB |
| Caminhos no índice de trabalho após o staged delete da Mission 19.1 | 11.143 |
| Objetos empacotados no repositório original | 5.416 |
| Pack local reportado por git count-objects | 828,48 MiB |
| Diretório .git local | 831 MiB |
| Objetos loose / prune-packable / garbage | 0 / 0 / 0 |
| Arquivos em projects/*/out no commit | 70 |
| Vídeos MP4, WebM ou MOV rastreados | 34 |
| ZIPs rastreados | 7 |
| Arquivos rastreados maiores que 5 MiB | 16 caminhos; aproximadamente 255,11 MiB combinados |

As contagens e tamanhos da árvore descrevem o HEAD auditado, não as remoções staged. O Git já desduplica o armazenamento de blobs idênticos por OID; caminhos repetidos ainda aumentam o checkout e algumas distribuições.

Uso observado por diretório de topo no worktree local, incluindo arquivos ignorados que já estavam presentes e excluindo .git. node_modules foi medido à parte:

| Diretório | Uso em disco |
|---|---:|
| .agents | 201 MiB |
| .claude | 28 MiB |
| .opencode | 28 MiB |
| packages | 201 MiB |
| projects | 970 MiB |
| dist | 27 MiB |
| creative-core | 200 KiB |
| docs | 908 KiB |
| scripts | 20 KiB |
| tests | 332 KiB |
| node_modules | 38 MiB |

### Classificação e decisão

| Classe | Áreas e exemplos | Decisão desta missão |
|---|---|---|
| Código-fonte essencial | creative-core, packages, scripts, tests, composições e documentação de execução | Preservar |
| Dependências de desenvolvimento | package manifests e lockfiles, configurações de testes/build, node_modules apenas no checkout local | Preservar manifestos; não versionar instalações |
| Skills e adaptadores | packages/motion-skills/skills, .agents/skills, .claude/skills, .opencode/skills e cópia do projeto Carga | Fonte npm e cópias necessárias permanecem até bootstrap ser compatível |
| Assets obrigatórios | Fontes, imagens, áudio, texturas, modelos e mídias referenciadas por Skills ou composições | Preservar até revisão individual de proveniência, uso e licença |
| Conteúdo demonstrativo | Projetos, composições, materiais de gallery e exemplos | Preservar |
| Artefatos regeneráveis | 1.200 PNGs em frames-16x9 e frames-9x16 de Carga-01 | Único conjunto adicional comprovado; remoção apenas do histórico simulada em A |
| Builds intermediários | Não foram encontrados diretórios dist rastreados no HEAD; outputs incluem finals | Não remover outputs por inferência |
| Vídeos finais | Masters MP4 de Carga e cópias usadas pela landing page | Preservar caminhos e URLs |
| Binários e arquivos legados | ZIPs, PDFs, executável, mídia e modelos | Manter; investigar caso a caso |
| Evidências de QA | Contact sheets, manifests, screenshots e relatórios | Preservar; são evidência ou dependência, não apenas intermediários descartáveis |
| Arquivos históricos | Objetos alcançáveis por commits ancestrais | Só retirar mediante migração explícita do histórico |

A lista de arquivos grandes e suas referências foi detalhada na auditoria anterior, REPOSITORY_SIZE_AUDIT.md. Entre os grupos estão cópias de mídia de Skills, um executável Linux distribuído pela Skill impeccable, os MP4s de Carga usados também pela landing page e um ZIP de entrega. Seu tamanho, por si só, não prova que sejam dispensáveis. Não movi nem removi esses arquivos.

O README de Carga-01 documenta a regeneração dos 600 frames por formato a partir das composições e do renderizador existentes. A Mission 19.1 já staged a remoção dos 1.200 PNGs do índice, sem removê-los do disco, e adicionou uma regra estreita ao .gitignore. Seus HTMLs de contact sheet, fontes, manifests e MP4s permanecem.

## 4. Skills: fonte, cópias e contagem

A fonte de distribuição é packages/motion-skills/skills. packages/motion-skills/index.js lista e instala as Skills. O catálogo reproduzível contém 51 diretórios imediatos com SKILL.md, e listSkills() também retorna 51.

As cópias da raiz servem à descoberta direta dos agentes. .claude e .opencode são adaptadores de compatibilidade com links e cópias físicas. projects/carga-01/.agents/skills permite usar o projeto de forma independente. O instalador da package motion-skills consegue gerar 51 Skills nos alvos .agents, .claude e .opencode, inclusive no diretório de um projeto.

O teste C confirma que a fonte npm permanece completa e que o CLI lista 51 Skills após filtrar as cópias. Também confirma o problema operacional: um clone C recém-checkout contém zero Skills em .agents até alguém chamar installSkills. Não há postinstall nem bootstrap automático no pacote raiz que repare a descoberta após um clone comum. Assim, a remoção reduz checkout, mas não transferência de histórico, e quebra a descoberta imediata esperada pelos agentes. Recomendo manter as cópias versionadas até um bootstrap automático, descoberta no fluxo real de agentes e testes de instalação/consumidor passarem em clone limpo.

Sobre 51/52: a contagem verificável para distribuição npm é 51 diretórios com SKILL.md. O README do pacote afirma 50, a missão refere 52, e o catálogo local contém 51. O comando CLI mostra ainda integrações de comunidade externas, que não são diretórios de Skill incluídos no pacote e não devem ser somadas como Skills distribuídas. Não foi encontrada uma 52ª Skill faltante. A documentação deve adotar a definição verificável de 51 e corrigir os números divergentes, em trabalho separado.

## 5. Clone e simulações de histórico

### Método e limites

As simulações foram executadas em cópias bare fora do checkout original, nunca no repositório remoto. Não havia git-filter-repo nem o módulo Python correspondente instalado. Para esta medição descartável foi usado git filter-branch com index-filter, seguido de remoção de refs/original, expiração dos reflogs e git gc --prune=now. O próprio Git advertiu que filter-branch é legado. A recomendação para uma migração autorizada é usar git-filter-repo, revisar a lista de refs e repetir todas as verificações.

Os clones foram locais via protocolo upload-pack, com --no-local para medir um fluxo de pack sem hardlinks. bytes de transferência são o total dos arquivos .pack recebidos, não contagem estimada pelo tamanho da árvore. Tamanho .git e checkout foram medidos separadamente, e total local é sua soma. Tempos refletem esta máquina e esta execução, com cache e filesystem locais; não representam velocidade pública do GitHub.

Para partial clone, o clone foi criado com blob:none e sem checkout, contra upload-pack configurado para aceitar filtros apenas na cópia de simulação. Esse estado é deliberadamente incompleto e não equivale a um checkout pronto para build. A coluna pós-checkout em A/C mostra a materialização medida e os blobs que passam a ser buscados. O servidor remoto real não foi consultado nem alterado.

### Cenários

- Baseline: estado atual de HEAD.
- A: remove apenas os PNGs de projects/carga-01/frames-16x9 e frames-9x16 em todos os commits alcançados.
- B: remove PNGs e outros intermediários comprovadamente regeneráveis. A auditoria não encontrou candidatos adicionais além dos mesmos PNGs; B produz exatamente o mesmo resultado Git de A.
- C: remove também .agents/skills, .claude/skills, .opencode/skills e projects/carga-01/.agents/skills, mantendo packages/motion-skills/skills.

### Clones completos e shallow

| Fonte | Tipo | Pack recebido | .git após clone | Checkout | Total em disco | Paths / commits | Tempo observado |
|---|---|---:|---:|---:|---:|---:|---:|
| Baseline | completo | 868.567.342 B / 828,48 MiB | 870.581.574 B | 1.443.195.176 B | 2.313.776.750 B / 2.206,82 MiB | 12.343 / 10 | 74,62 s |
| Baseline | shallow depth 1 | 862.843.338 B / 822,98 MiB | 864.852.085 B | 1.443.195.176 B | 2.308.047.261 B / 2.201,36 MiB | 12.343 / 1 | 49,84 s |
| A | completo | 301.253.552 B / 287,41 MiB | 303.104.744 B | 871.924.423 B / 831,53 MiB | 1.175.029.167 B / 1.120,94 MiB | 11.143 / 10 | 7,21 s |
| A | shallow depth 1 | 295.534.124 B / 281,95 MiB | 297.379.838 B | 871.924.423 B / 831,53 MiB | 1.169.304.261 B / 1.115,49 MiB | 11.143 / 1 | 7,42 s |
| B | completo / shallow | Igual a A | Igual a A | Igual a A | Igual a A | Igual a A | Resultado da mesma árvore; nenhuma diferença de objetos |
| C | completo | 868.533.948 B / 828,44 MiB | 869.478.350 B | 988.452.606 B / 942,66 MiB | 1.857.930.956 B / 1.771,10 MiB | 5.278 / 10 | 53,19 s |
| C | shallow depth 1 | 862.816.813 B / 822,96 MiB | 863.755.939 B | 988.452.606 B / 942,66 MiB | 1.852.208.545 B / 1.765,65 MiB | 5.278 / 1 | 17,39 s |

A B é objeto-idêntica à A porque não havia candidato elegível adicional. Os valores A são medições de clones reais do resultado filtrado que representa B; não foi fabricada uma economia adicional nem uma medição distinta.

### Partial clones

| Fonte | Estado partial | Pack efetivamente recebido | .git | Checkout | Tempo observado |
|---|---|---:|---:|---:|---:|
| Baseline | blob:none, sem checkout | 207.696 B / 202,83 KiB; 754 objetos | 260.277 B | 0 arquivos materializados | 0,02 s |
| A | blob:none, sem checkout | 174.578 B / 170,49 KiB; 754 objetos | 227.131 B | 0 arquivos materializados | 0,01 s |
| A | após checkout completo | 295.553.672 B em packs; 10 commits | 297.681.110 B | 871.924.423 B | 6,31 s para materializar |
| C | blob:none, sem checkout | 196.072 B / 191,48 KiB; 731 objetos | 248.105 B | 0 arquivos materializados | 0,01 s |
| C | após checkout completo | 862.834.068 B em packs; 10 commits | 864.147.519 B | 988.452.606 B | 11,44 s para materializar |

A comparação após checkout demonstra que lazy fetch não elimina o custo quando o projeto inteiro é solicitado. Partial clone é útil quando o consumidor não baixa a maior parte dos blobs; não é substituto de eliminar payload alcançável do histórico para clones completos.

Os clones A/C e os estados materializados ficaram limpos durante as medições; git fsck passou nas cópias verificadas. Depois das medições, /tmp/motion19.2-sims/c-partial foi usado como área de regressão A-like: recebeu Skills reconstruídas e alterações locais da Mission 19, e teve os frames removidos. Seu worktree está intencionalmente sujo; não é uma cópia limpa para distribuição. O bare filtrado C preservado no backup externo continua sendo a referência de histórico C. Nenhuma medição usa hardlink local de objetos como se fosse tráfego.

### Economias medidas

| Comparação com baseline | Pack recebido | Checkout | Total local clone |
|---|---:|---:|---:|
| A/B | -567.313.790 B / -541,03 MiB (-65,32%) | -571.270.753 B / -544,81 MiB (-39,58%) | -1.138.747.583 B / -1.085,99 MiB (-49,22%) |
| C | -33.394 B / -0,032 MiB (-0,0038%) | -454.742.570 B / -433,68 MiB (-31,51%) | -455.845.794 B / -434,73 MiB (-19,70%) |

C confirma que Git já compartilha blobs idênticos através das cópias de Skills: remover os caminhos do histórico muda muito o checkout, mas praticamente não reduz o pack. O benefício do clone completo vem da A, não de C.

## 6. Branches, commits, tags e URLs

No checkout auditado existem main e os aliases locais origin/main e origin/HEAD apontando ao mesmo commit. Não há tags. Nenhuma atualização foi feita no remote.

### Cenário A/B

Os nove commits anteriores ao último permanecem com os mesmos SHAs na simulação. O único commit alterado é:

| Ref | SHA atual | SHA filtrado simulado |
|---|---|---|
| main, origin/main e origin/HEAD (aliases observados) | ab723122b8ba20c285f265e4ea55ed7a7c48b06f | 6c6f8438f6e2fa4f95ed292059807f501024c9a9 |

A simulação removeu exatamente os 1.200 PNGs do tree, sem diferença em outros caminhos.

### Cenário C

Todas as 10 mudanças de commit alteram SHA devido aos trees ancestrais:

| Commit atual | Commit filtrado C |
|---|---|
| 03662be292b8c18efda89be1b4fab840254110aa | 0ba57b14916e5376fe2d5d6d1846bd84a7b1fed1 |
| 18f502d873fa666a12a049f6df125bdef1e91c85 | 27690bce2e849fe19e78582169d330451e1ca5b0 |
| a7829075c6d0244d0efee989f4c2032ae24b53a5 | 4283a4f78eb06060b844415e40b6cdb7d2604dfe |
| 8db531af1ccf3ba4505cb4df7c878d457cf020a7 | 508d3e59dd2551bb6fe25f482bf8dc38653e1cd7 |
| b3dd6f92ad393128da7f1bb8fabb930ff09b46da | 6151144357fb378c407f33448669593ef5f2f4a9 |
| 41728c34988cf45ebb64ca258e25b1f976ff6f60 | 57196ffa52011650c23d94e145eefea6e2c91912 |
| 0b51b35b8d56f742203b5e9571cc376c8e56f2a3 | 0daf534751f85a43bac00c5ffdb5378e7e452334 |
| c4734f0d9307fb845a96a4214a136fdf87dddf76 | c3a6896c942dd3c325e4815ae61c51ffac8fd28a |
| ac1331b5990039041c4e7631380c0d8f199d6203 | 94aa5b7c952d99523620b9fd0408cb2d8f7709a4 |
| ab723122b8ba20c285f265e4ea55ed7a7c48b06f | a1ae7f8bbfacbe05d6c015c70d78100f7a122903 |

URLs de commits no GitHub dependem do SHA. Em A, o link para o commit atual mais recente muda; commits anteriores permanecem. Em C, todos os links de commit mudam. Pull requests, forks, branches de colaboradores, checks e referências externas podem manter o histórico antigo. Não há tags locais neste clone, mas uma auditoria remota atualizada de refs e Releases deve preceder qualquer plano de cutover; este trabalho deliberadamente não buscou nem alterou o remoto.

## 7. Compatibilidade de pacotes, agentes, site e regressão

Os três diretórios npm das packages motion-core, motion-cli e motion-skills foram comparados entre o checkout original e o clone C. Seus tree OIDs coincidem:

| Pacote | Tree OID em ambos |
|---|---|
| motion-skills | a8591f2c941854fa7e084d2eaa4c22aa95c257f5 |
| motion-cli | 1e17a4c560e7d91c031cd1dc2987c2c6d71816ed |
| motion-core | ae7c413121d6bfd9cecf21e01947d04aa7481030 |

No clone C, listSkills e motion list operaram sobre a fonte npm e retornaram 51 Skills. installSkills reconstruiu 51 Skills nas três localizações de agente e no diretório do projeto Carga. A descoberta direta antes desse passo retornou zero no .agents do clone. Por isso, compatibilidade do tarball npm foi preservada, mas checkout pronto para agentes não foi.

A regressão foi executada em uma extração isolada do snapshot de backup, com dependências locais presentes, sem executar sobre o checkout original:

| Verificação | Resultado |
|---|---|
| npm test -- --test-concurrency=1 | Passou, 29/29; inclui Creative Core, renderização por frame, CLI, skills, determinismo independente, WebM alpha e safe zones |
| npm run pack:all | Passou para motion-core, motion-cli e motion-skills |
| Tamanhos tarball | core 55,1 kB; CLI 25,5 kB; Skills 27,2 MB |
| Arquivos nos pacotes | core 26; CLI 14; Skills 2.363 |
| Instalação consumidora isolada | Passou via node projects/mission-19/test-consumer-install.mjs; executou fora dos paths de monorepo e produziu component.mp4 e overlay.webm |
| CLI e descoberta | motion list passou no clone C; catálogo fonte exibiu 51 Skills |
| Integridade da cópia filtrada C | git fsck --full --no-reflogs aprovado |
| Landing e finais de Carga | Caminhos HTML e assets foram inspecionados; MP4s públicos mantidos |
| Integridade do original | HEAD, refs, índice e conteúdo de missão preservados; a checagem de whitespace deste relatório passou |

O teste npm avisou que blender não está instalado, então a execução opcional dependente de Blender não foi exercitada. A suíte concluiu sem falhas. O teste consumidor produziu os artefatos esperados, sem publicar o pacote.

Também foi feita uma regressão de árvore de trabalho após a remoção dos frames: em uma cópia isolada baseada no clone C, as Skills foram reconstruídas pelo instalador oficial, os 1.200 PNGs foram retirados da cópia, e as alterações locais da Mission 19 foram sobrepostas para preservar o código atual em teste. A árvore de trabalho resultante representa o conteúdo de código da limpeza A junto do trabalho local pendente; o histórico Git dessa cópia continuou sendo C, portanto ela não foi contada como um segundo clone A. Nessa cópia, os três tarballs foram criados com npm pack individual e cache temporário, npm test passou 29/29, e o instalador consumidor passou, produzindo:

    /tmp/motion-mission19-consumer-uje3JD/outputs/component.mp4
    /tmp/motion-mission19-consumer-uje3JD/outputs/overlay.webm

O primeiro npm test nessa cópia ocorreu antes dos tarballs e falhou apenas porque o teste de distribuição exige os arquivos em dist/packages. Depois de empacotar, o rerun passou. O script npm run pack:all funcionou na regressão completa da extração QA e também no snapshot da árvore original; em uma tentativa adicional no clone C foi impedido pelo sandbox ao tentar spawn /bin/sh internamente (EPERM). Para esse clone, os três npm pack diretos passaram. A falha de processo não indica incompatibilidade do pacote.

A busca local não encontrou vercel.json, .vercel ou workflows GitHub no checkout. A landing usa o endpoint de analytics de Vercel e a documentação histórica aponta para Vercel, mas o acesso de leitura da API Vercel retornou 403. Portanto, a configuração atual do projeto, root directory, filtros de deploy e estado de produção não foram confirmados. A landing, seus HTMLs e seus URLs não foram alterados; antes de migração pública, conferir manualmente o projeto conectado, build e deploy protegido.

## 8. Armazenamento de mídias e continuidade de URLs

| Opção | Vantagens | Custos e riscos | Uso adequado |
|---|---|---|---|
| Git normal | Checkout simples; URLs e revisões junto do código | Arquivos históricos permanecem em todos os clones até reescrita | Código, fontes, assets realmente necessários e mídia pequena |
| GitHub Releases | Downloads versionados sem inflar a árvore de código; cada asset abaixo de 2 GiB | Asset não é automaticamente parte do checkout; limite de 1.000 assets por Release; URL/provisionamento precisa ser consumido | ZIPs de distribuição e entregas versionadas |
| Git LFS | Mantém ponteiro no Git e conteúdo no serviço LFS | Storage e bandwidth sujeitos a cotas/cobrança; checkout pode baixar assets; mover arquivos atuais para LFS não limpa os blobs Git históricos | Assets binários grandes que precisam acompanhar checkout e têm política LFS aceita |
| Object storage/CDN | URLs estáveis e cache configurável; boa distribuição de mídia pública | Requer bucket/origin, ACL, CORS/cache, domínio, backup, observabilidade, egress/operação; URLs precisam ser migradas | Vídeos finais públicos quando há substituição/redirect testado |
| Regenerar localmente | Sem custo de distribuição de frames | Consome tempo/CPU e precisa de fonte, assets, fontes e receita de render | Intermediários já reproduzíveis como PNGs de Carga |

Fontes oficiais consultadas:

- [GitHub Releases — limites de assets](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
- [Git LFS — cobrança de armazenamento e bandwidth](https://docs.github.com/en/billing/concepts/product-billing/git-lfs)
- [Uso incluído por plano GitHub](https://docs.github.com/en/billing/reference/product-usage-included)
- [Amazon S3 — componentes de preço](https://aws.amazon.com/s3/pricing/)
- [Cloudflare R2 — preço, requests e ausência de taxa de egress](https://developers.cloudflare.com/r2/pricing/)

Recomendação prática: manter vídeos servidos pela landing em seus paths atuais. Releases são opção para downloads versionados que não sustentam URLs públicas existentes. Se futuramente mover MP4s para object storage/CDN, primeiro configurar URL durável, validar playback/cors/cache e substituir cada referência sem quebrar deployments anteriores. LFS não é uma correção retroativa de histórico: arquivos adicionados a LFS precisam de migração de histórico para deixar de existir nos packs antigos, além da gestão dos objetos LFS.

## 9. Plano de migração recomendado após autorização separada

Nenhum passo abaixo foi executado sobre o remoto. Uma migração real deverá seguir uma mudança aprovada separadamente:

1. Confirmar com o responsável o escopo A e os refs públicos afetados; atualizar inventário remoto de branches, tags, PRs, forks, Releases, GH Pages/Vercel e links de commit.
2. Congelar pushes durante a janela e comunicar colaboradores. Solicitar que preservem branches locais e alterações em andamento.
3. Criar backup novo e verificável de todas as refs atuais, bundle Git, LFS se aplicável, worktree, índice, branches/tag e patches locais. Comparar hashes e verificar o bundle antes de prosseguir.
4. Criar um mirror temporário independente. Aplicar git-filter-repo somente às duas expressões de path de PNG aprovadas. Não adicionar Skills, outputs, vídeos ou outros binários ao filtro sem autorização específica e prova de regenerabilidade.
5. Auditar refs removidas/retidas, verificar ausência dos PNGs em todos os trees, comparar árvores para provar que nenhum outro caminho mudou, verificar git fsck e produzir clone completo/shallow/partial limpo.
6. Reexecutar suíte, pack npm, instalação consumidora, CLI, render/QA e inspeção da landing no mirror filtrado. Validar que o README de Carga regenera os frames.
7. Solicitar autorização humana final específica para substituir refs públicos por força. Esta missão não fornece essa autorização.
8. No cutover autorizado, atualizar branches e tags conscientemente, validar GitHub, CI, URLs de commits e Vercel, monitorar builds e clones. Tratar releases existentes com seus assets e metadados separadamente.
9. Dar aos colaboradores uma receita clara para renomear/mover clones antigos para backup e clonar de novo. Não mesclar um clone pré-rewrite ao novo histórico; commits locais devem ser exportados como patches ou cherry-pick revistos sobre novos SHAs.
10. Manter bundle/refs originais em armazenamento de recuperação pelo período acordado. Documentar o procedimento de retorno antes do cutover.

Riscos: links para commits afetados deixam de representar o novo SHA; clones antigos contêm blobs que o servidor não pode apagar de discos já baixados; forks/PRs e automações externas continuam referenciando SHA antigo; checagens CI e Vercel podem disparar após atualização de refs; rulesets ou proteção de branch podem bloquear o force update; tags assinadas, se surgirem remotamente, exigem tratamento específico; GitHub Releases são objetos independentes do conteúdo dos trees, mas consumidores de URLs por tag/commit precisam ser auditados. A integridade e a capacidade de recuperação dependem de um backup completo verificado.

## 10. Estado final desta missão

- Repositório original: sem checkout de histórico, reset, clean, commit ou alteração de refs.
- Remoto GitHub: sem fetch, push ou alteração.
- Tags: nenhuma local; nenhuma alterada remotamente.
- npm: empacotamento testado, sem publish.
- Deploy: não executado.
- Mission 17 e produções aprovadas: preservadas.
- Mission 19 e Mission 19.1: alterações locais preservadas.
- Galeria pendente: arquivos e estado local não foram sobrescritos.
- Estado do worktree original depois de criar este relatório: 1.200 remoções staged da Mission 19.1, 23 entradas rastreadas modificadas e 20 entradas untracked (incluindo este relatório). git diff --check e a checagem de whitespace do relatório passaram.
- Cenário recomendado para futuro: A, com autorização explícita de reescrita. C permanece bloqueado por falta de descoberta automática de Skills.
- Próximo passo seguro: revisar este relatório e, em decisão separada, autorizar ou rejeitar o plano A. Até então, nenhuma limpeza do histórico compartilhado será executada.
