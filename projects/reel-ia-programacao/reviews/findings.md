# Parecer do Crítico independente — rodada 1

> Gerado de `critic/round-1.json` sem edição. Não altere: o QA compara os hashes.

- Veredito: **REPROVADO**
- Arquivo avaliado: `out/final/reel.mp4` (SHA-256 `ab69fff2f230e6d5c7776f9935fee57186884782b497b7759b69428af323a3a5`)
- Crítico: `critic-independente-round-1` (claude-opus-5-5), contexto novo
- SHA-256 do parecer: `e4a534fd40a0eeb83bfe1b65249de6f3221c4579573374ccbfaead0f0324e69a`

Rodada anterior: C1, C3, C5, C7 e C8 resolvidos; C4 e C6 parciais; C2 e C9 persistem. O corpo do filme está publicável. O único impedimento é o fecho: a legenda e a voz terminam em "esse é o meu", com corte a pleno volume. A fonte acabar no meio da frase explica a causa, mas não obriga a incluir o fragmento: há fim completo em "ou ambos". Itens aceitos pelo dono não foram contados.

| Eixo | Nota |
|---|---|
| abertura | 8 |
| historia | 8.5 |
| cortes | 8.5 |
| legendas | 8 |
| cards | 8 |
| fechamento | 4.5 |
| audio | 7.5 |
| aderencia_style | 8 |

| # | Sev. | Onde | Observação | Por quê | Correção | Preservar | Reverificar | Evidência |
|---|---|---|---|---|---|---|---|---|
| C2 | important | frames 1552-1603 (51,73-53,47 s) | PERSISTE da rodada 0. O filme ainda termina em "ESSE É O MEU", sem complemento, e a voz é cortada em nível normal; seguem-se cerca de 0,12 s de silêncio digital. A página anterior, "OU AMBOS ENTÃO", já abre a frase que não se conclui. | A última impressão é de arquivo truncado e o fragmento disputa a leitura com o CTA "E VOCÊ, O QUE ACHA?". O BRIEF fecha em "dinheiro, tempo, ou ambos". | Encerrar a fala em "ou ambos", por volta do frame 1552, antes do plano que olha para cima, com fade curto do áudio; retirar "então esse é o meu" da fala e das legendas. Se o CTA precisar de mais tempo que os cerca de 0,75 s restantes, prolongar o fecho com imagem real sem boca falando e tom de sala. | "ou ambos", chips dinheiro/tempo/ambos e o texto queimado "E VOCÊ, O QUE ACHA?". | Últimos 2 s: queda do áudio, última legenda, tempo de leitura do CTA e último frame. | Frames 1580-1603: legenda "ESSE É O MEU". RMS em 10 ms: -14,3 dB (53,33), -14,9 dB (53,34), -77,9 dB (53,35), -inf (53,36). Após "ambos" a voz decai a cerca de -29 dB em 51,66-51,72 s, ponto natural de saída. |
| C4 | minor | frames 1530-1603 | PARCIAL. O card de foco ficou livre da cabeça (870-956). O card do cliente ainda toca ou cobre a ponta do cabelo no plano fechado. | O STYLE pede card acima da cabeça; o rosto não é coberto. | Não aplicar 1,12 nesse trecho ou reduzir a altura do card. | Topo y = 0,10 e legibilidade. | Frames 1531, 1550 e 1598. | Frames 1550 e 1598: base do card em y≈420 sobre o topo do cabelo. Frames 872-952: folga visível. |
| C6 | minor | frames 1058-1076 (35,26-35,86 s) | PARCIAL. "MAS" isolado foi corrigido e a divisão "VOCÊ ESTÁ / FICANDO PARA TRÁS" foi aceita. "NÓS DESENVOLVEDORES" continua em 0,60 s, abaixo do mínimo de 0,65 s do STYLE. | Diferença de 0,05 s em relação à regra; impacto de leitura pequeno. | Estender a página ou registrar a exceção. | Texto e quebra. | SRT 35. | SRT 35: 35,260-35,860 s. SRT 42: "mas quando" 0,73 s. |
| C9 | minor | frames 428, 470, 1512 e 1538 | PERSISTE. Na troca de chip, o rótulo que se apaga fica quase ilegível por cerca de um frame. | Microfalha de contraste pouco perceptível em velocidade normal. | Trocar a cor do texto sem interpolação ou fazer cross-fade só do fundo. | Duração de 150 ms. | Frames 427-432 e 1537-1541. | Frame 428: "Antigravity" cinza sobre verde; frame 1538: "tempo" idem. |
| N1 | minor | frames 430-432, 1488-1489 e 1514-1516 | NOVO. Durante o cross-fade o card inteiro escurece e a sombra se adensa; ao terminar, o fundo volta em um único frame ao tom normal. | Pequena pulsação de um elemento que deveria estar estável; indica duas camadas semitransparentes somadas. | Fazer o cross-fade apenas do conteúdo que muda, com fundo e sombra únicos. | Layout e tempos. | Frames 430-432 e 1488-1489. | Frame 431: fundo e sombra mais escuros; frame 432: retorno ao tom normal. |

Não verificado:

- Escuta do áudio: timbre, cliques, respiração, naturalidade das emendas e inteligibilidade foram avaliados apenas por medição.
- Sincronia labial e fidelidade palavra a palavra das legendas: inferidas pelos frames e pelo SRT.
- Reprodução em aparelho real e sob a interface do Reels/TikTok.
