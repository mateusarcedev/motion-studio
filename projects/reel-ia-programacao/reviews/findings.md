# Parecer do Crítico independente — rodada 3

> Gerado de `critic/round-3.json` sem edição. Não altere: o QA compara os hashes.

- Veredito: **APROVADO**
- Arquivo avaliado: `out/final/reel.mp4` (SHA-256 `e745f550a127ad4a6b997b2323d5aca1ebceb5b26a4fbf8177a76949d8243eac`)
- Crítico: `critic-independente-round-3` (claude-opus-5-5), contexto novo
- SHA-256 do parecer: `643ed2d5e42dd10debf2cf61dba8fb3e44d8afcfbdc1fec3bf5227470856dd2b`

N2 (único impedimento da rodada 2) resolvido: o card do CTA está opaco e nenhum texto queimado aparece do frame 1501 ao 1541. C6, C9, N1 e N4 persistem e N3 está parcial, todos menores. Abertura e emenda no frame 73 limpas; nenhum frame de troca examinado fica sem card. Publicável.

| Eixo | Nota |
|---|---|
| abertura | 8.5 |
| historia | 8.5 |
| cortes | 8.5 |
| legendas | 8 |
| cards | 8 |
| fechamento | 8 |
| audio | 8 |
| aderencia_style | 8 |

| # | Sev. | Onde | Observação | Por quê | Correção | Preservar | Reverificar | Evidência |
|---|---|---|---|---|---|---|---|---|
| C6 | minor | frames 1048-1065 (34,93-35,53 s) | PERSISTE. "NÓS DESENVOLVEDORES" dura 0,60 s, abaixo do mínimo de 0,65 s do STYLE. | Diferença de 0,05 s; impacto pequeno. | Estender a página ou registrar a exceção. |  |  | SRT 34: 34,927-35,527 s. |
| C9 | minor | frames 462, 989, 1502 e 1528 | PERSISTE. O rótulo que se apaga fica ilegível por cerca de um frame na troca. | Pouco perceptível em velocidade normal. | Trocar a cor do texto sem interpolação. |  |  | Frame 1502: "dinheiro" some; 1528: "tempo" some; 989: numeral 1 some. |
| N1 | minor | frames 464-465, 991-992, 1505-1506 e 1531-1532 | PERSISTE. Fundo e sombra do card escurecem e voltam em um frame no fim do cross-fade; a troca em 1478 é limpa. | Pequena pulsação; nenhum frame fica sem card. | Fazer o cross-fade só do conteúdo, com fundo e sombra únicos. |  |  | Frame 991: fundo e sombra mais escuros; 992: tom normal. |
| N3 | minor | frames 1537-1541 | PARCIAL. O filme termina cerca de 0,33 s antes da versão anterior e o áudio chega a zero, mas o último plano ainda mostra o olhar desviando para o alto e a boca entreaberta. | Fechamento um pouco seco, sem fala cortada. | Opcional: sair antes do desvio do olhar, se a cauda de "ambos" permitir. |  |  | Janelas de 5 ms no fim: cerca de -28, -41 e -111 dB; últimas amostras em zero. |
| N4 | minor | frames 1501-1518 | PERSISTE. "DINHEIRO / OU TEMPO" fica muito próximo do topo do card do CTA. | Os dois textos competem por 0,6 s, sem sobreposição. | Opcional: página de uma linha ou mais folga nesse trecho. |  |  | Frame 1510: base da legenda quase encostada no card, cujo topo está em y=1493. |
| N5 | minor | frames 508-549 (16,93-18,32 s) | NOVO. A página "UTILIZAR IA TE" termina no pronome, separado de "TRAZ MUITOS BENEFÍCIOS". | Quebra sintática fraca, mas legível. | Opcional: passar "TE" para a página seguinte. |  |  | Frames 514-540; SRT 16 e 17. |

Não verificado:

- Escuta do áudio: não é possível ouvir; cliques, respiração, timbre e naturalidade das emendas foram avaliados só por medição.
- Sincronia labial e fidelidade palavra a palavra das legendas: inferidas por frames e SRT.
- Reprodução em aparelho real, sob a interface do Reels/TikTok e após recompressão da plataforma.
- Inspeção visual de todos os 1542 frames: foram vistos um a cada 13, os 16 cortes e tiras consecutivas na abertura, emenda, fim e parte das trocas de card; a troca para Codex, antes do frame 423, não foi vista quadro a quadro.
