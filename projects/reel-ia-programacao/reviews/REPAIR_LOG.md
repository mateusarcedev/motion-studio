# Log de reparo — Crítico × produção

O Crítico independente (subagente em contexto separado, sem acesso ao código nem ao relato da
produção) avaliou o render de 51,53 s e **reprovou** (rodada 0). O harness não permitiu que o
subagente gravasse o próprio `findings.md`; os defeitos abaixo são a transcrição do parecer
recebido, com a ação tomada pela produção. Evidências do Crítico: `reviews/critic/*.png`.

## Rodada 1 (política: menor mudança relevante; máx. 2 rodadas por defeito)

| # | Sev. | Defeito (Crítico) | Ação | Tipo |
|---|---|---|---|---|
| B1 | bloq. | Fim: CTA queimado 0,87 s, empilhado sob a legenda; micro-plano de 3 quadros | final mantido até 66,40 s (CTA ≈ 2,5 s); motor ganhou `burnedText`: legendas na mesma metade da tela cedem espaço enquanto o texto do autor aparece; cards só cedem se estiverem na mesma região | motor + config |
| B2 | bloq. | QA mediu outro arquivo (render anterior) | QA sempre reexecutado depois de cada render final, com `--compare` | processo |
| I1 | imp. | Legenda ~30% menor que o STYLE (maiúscula 37 px) | métrica do libass medida (maiúscula = 0,567 × tamanho): tamanho 96 → 54 px; auto-ajuste por página para nunca passar de 675 px | motor |
| I2 | imp. | Quebras mecânicas ("CHATGPT SURGIU E", "ANTHROPIC SE VOCÊ") | paginação quebra em pontuação e não termina página em artigo/preposição/conjunção | motor |
| I3 | imp. | 8 páginas < 0,6 s | fusão de páginas curtas (até 5 palavras dentro do limite de caracteres); mínimo 0,65 s | motor |
| I4 | imp. | Zoom de ênfase sai no meio de "ficando para trás"; 3 cortes em 1,1 s | ênfase com `until` (sem zoom cut dentro da frase); guarda de plano mínimo 0,7 s absorve pausas curtas em vez de criar micro-planos | motor + config |
| I5 | imp. | Micro-plano de 5 quadros em 34,9 s | mesma guarda de plano mínimo | motor |
| I6 | imp. | "Possibilidades, muita rapidez" 3,3 s com 3 palavras; "traz" ausente | correções com evidência ("traz muitas", "traz muita"); demais divergências ficam para escuta | config |
| M1 | menor | Card "foco" vazio por 2,2 s | card ancorado no primeiro item ("código") | config |
| M2 | menor | Rótulos/chips 18–22 px | 32 px | motor |
| M3 | menor | Cards baixos demais / sobre o cabelo | topo em 0,10; cards em largura natural (uma linha), menos altura | motor + config |
| M6 | menor | "IA na programação" não é dito | card de tese: "Utilizar IA / já é realidade" (palavras ditas) | config |
| M7 | menor | Áudio muito comprimido | preset `noisy-room` recomendado pela análise (expansor maior, compressão limitada por LRA) | config |
| M4, M5, M8 | menor | "MAS" aceso 0,6 s; duração 51,5 s; contraste da menta depende do contorno | M4 → escuta; M5 aceito (duração ditada pela fala; agora 53,2 s); contorno 5 → 6 px | — |

Achados da própria produção nesta rodada: cards absolutos com `left:50%` encolhiam para 540 px
(quebras como "JÁ É / REALIDADE") → largura natural; cross-fade entre estados de largura
diferente mostrava contorno fantasma → estados progressivos reservam o layout final.

## Rodada 2 (última permitida por defeito) — parecer de um segundo Crítico em contexto novo

O segundo Crítico (sem acesso ao log, ao código ou ao EDIT_PLAN) reprovou o render de 53,17 s.

| # | Sev. | Defeito (Crítico 2) | Causa raiz encontrada | Ação |
|---|---|---|---|---|
| 1 | bloq. | Quadros-relâmpago de 1 quadro em f250 e f1120 | **a fonte já tem emendas/saltos** (app do celular): f551 e f1509 do bruto mudam a pose num quadro; nossos cortes terminavam 1 quadro depois | análise detecta descontinuidades da fonte (score de cena ≫ mediana local; 18 no bruto); bordas a ≤ 0,7 s de um salto encaixam nele quando o trecho descartado não tem fala (18,400→18,367 s; 50,333→50,300 s) |
| 2 | imp. | "Tremido" de zoom em 16,6–17,3 s; plano de 5 quadros em 34,9 s | saltos da fonte (29,57 s e 30,23 s) somados a um zoom cut nosso entre eles | zoom cuts passam a cair **sobre** os saltos da fonte (escondem a emenda) e nunca a < 0,7 s deles; QA ganhou `shots.orphan` (FAIL < 3 quadros) e `shots.min` (WARN < 0,7 s) |
| 3 | imp. | 2,3 s finais sem legenda | a regra da rodada 1 só removia as palavras sob o texto queimado | palavras desse trecho viram páginas de 1 linha logo abaixo da boca (y 0,696), acima do texto do autor; "ruim" (0,08) oculta por decisão registrada (`hideWords`) |
| 4 | imp. | Quebras ainda não semânticas (quantificador separado do substantivo, "Claude / Code") | paginação gulosa | paginação por programação dinâmica: custo alto para terminar em artigo/preposição/conjunção/quantificador/demonstrativo, para quebrar nome próprio composto e "substantivo de substantivo"; quebra preferida em corte de tempo |
| 5 | imp. | Páginas < 0,65 s | idem | custo graduado de duração na DP (restam 3 entre 0,58 e 0,62 s em fala rápida) |
| 6 | imp. | "FAÇA" aceso 1,66 s | timestamp do ASR: palavra de 1,66 s sobre fala contínua (provável palavra não reconhecida) | não corrigível sem escuta; plano lista para revisão e o QA ganhou `captions.long-words` |
| 7 | menor | Legenda e texto queimado juntos em f1520 | arredondamento do fim da página para cima no grid de 10 ms do ASS | tempos do ASS arredondados para baixo (início e fim), sem lacuna entre páginas |
| 8 | menor | Virada sem ênfase na legenda | — | "trás" como palavra-chave em cor de destaque |
| 9 | menor | Card de abertura redundante com a legenda | — | card de tese vira rótulo de tema "IA na programação" (decisão: resumo fiel do assunto; o 1º Crítico preferia só palavras ditas — divergência registrada para decisão humana) |
| 10 | menor | Chip cinza sobre menta no meio do cross-fade | transição de 150 ms | mantido (transitório) |
| 11 | menor | Folha de contato com terço vazio | grade 7×4 para 22 quadros | grade ajustada |

Não resolvido sem escuta humana: palavras de baixa confiança, "FAÇA ele economizar", divergências
com a legenda humana da referência, naturalidade da voz (LRA 1,2 LU).

## Verificação final (Crítico 3, contexto novo) — **REPROVADO, sem bloqueador visual**

Resolvidos com evidência no render: fim/CTA (R1-B1, R2#3, R2#7), QA do arquivo certo (agora com
SHA-256 do MP4 medido), legenda maior (R1-I1), zoom de ênfase cobrindo a frase (R1-I4), quadros-
relâmpago (R2#1: menor plano 19 quadros em varredura dos 1593 quadros).

Pela política de reparo (máx. 2 rodadas por defeito) a produção **parou** e pede decisão humana:

| Pendente | Situação | Opções para decidir |
|---|---|---|
| R2#2 planos visuais de 0,63–0,67 s (16,6–17,3 s e fecho) | saltos da própria fonte durante fala; encaixar exigiria cortar fala | aceitar; ou cortar a palavra/trecho junto ao salto; ou cobrir com card/B-roll autorizado |
| R2#8 / N1 ênfase da virada na legenda | página de 5 palavras auto-ajustada fica menor (maiúscula 42 px) e rápida; "TRÁS" usa o mesmo verde da palavra ativa | dividir em "VOCÊ ESTÁ / FICANDO PARA TRÁS"; cor própria para palavra-chave |
| R2#9 card "IA na programação" | resumo do assunto, não dito literalmente; os dois Críticos divergiram | aprovar o rótulo de tema ou remover o card |
| N2 /s/ de "Codex" possivelmente truncado (11,93 s) | VAD de energia de banda larga pode não ver sibilantes fracas | escuta; se confirmado, estender o fim do trecho por energia de alta frequência |
| N3 queda de fundo em 41,70 s; R2#6 "FAÇA ele" | dependem de escuta | escuta e correção com evidência |
| R1-M7 LRA 1,2 LU | fonte já comprimida pelo celular + tratamento | escuta do A/B; trocar para `natural` se soar achatado |
| N4 card "foca muito na tecnologia" antecipa a fala; R1-M1 cards com estado vazio longo; R1-M3 card encosta no cabelo em f880 | decisões de composição | ajustar âncoras/topo dos cards |
| N6, N7 | salto de pose de 1 quadro dentro de plano (fonte); legenda de 1 linha no fim com o mesmo visual do texto do autor | aceitar ou estilo distinto para a legenda do fim |

Corrigidos após a verificação, sem mudar o vídeo (mesmo SHA-256): N5 (`captions.words.srt` mostrava
a palavra oculta "ruim"), N8 (WARN dos cards agora diz o motivo: topo fora da heurística genérica de
15%, dentro do preset Reels de 8%) e SHA-256 do arquivo medido no relatório de QA.

# Missão 21.1 (B4)

Pareceres sem edição em `critic/round-0.json` e `critic/round-1.json` (selados, `motion qa critic-verify`).

| # | Sev. | Rodada 0 | Ação | Rodada 1 |
|---|---|---|---|---|
| C1 | bloq. | card do cliente some por 1 quadro (f1487) | motor: sobreposição na troca de estado | resolvido |
| C2 | imp. | termina em "esse é o meu" | nenhuma: o bruto termina no meio da frase; fechar em "ou ambos" tira o CTA do autor → **decisão humana** | persiste (motivo da reprovação) |
| C3 | imp. | card "código" contradiz "não somente em código" | item removido | resolvido |
| C4 | menor | card encosta no cabelo no punch-in | nenhuma (zona segura × zoom) | parcial |
| C5 | menor | "2022 · ChatGPT" antecipado | rótulo removido | resolvido |
| C6 | menor | páginas < 0,65 s | "MAS" unido a "QUANDO"; "NÓS DESENVOLVEDORES" 0,60 s é a fala | parcial |
| C7 | menor | amarelo fora do STYLE | cor documentada (aceita pelo dono) | resolvido |
| C8 | menor | card em fade no último quadro | motor: card que fecha o filme fica sólido | resolvido |
| C9, N1 | menor | chip ilegível / card escurece por 1 quadro no cross-fade | mantido (transitório) | persiste |

A produção parou: o único impedimento depende do dono do projeto.

## Rodadas 2 e 3 (após as decisões do dono)

Decidido: terminar em "ou ambos"; CTA só como texto; abertura movida mantida.

| # | Origem | Defeito | Ação | Estado |
|---|---|---|---|---|
| C2 | Crítico 0 | fim sem complemento | cortado em "ou ambos" | resolvido |
| E1 | escuta do dono, 0,1 s | "que" antes de "se você" | folga da abertura não volta para fala removida; corte exato em 27,12 s | aguarda nova escuta |
| E2 | medição | abertura 3,7 dB acima da sequência | nível ajustado (−2,33 dB): diferença de 1,8 dB | aguarda escuta |
| N2 | Crítico 2 | texto queimado visível atrás do card do CTA | card opaco | resolvido |
| C6, C9, N1, N3, N4, N5 | Críticos | menores (ver `findings.md`) | mantidos | aceitos pelo Crítico 3 |

Rodada 3: **aprovado** para o MP4 `e745f550…`. A escuta humana desse arquivo ainda não foi feita: a reprovação em
`listening.json` refere-se ao render `63e49a26…`.
