# Benchmark da homologação real — original × MOTION × referência

Gerado por `node benchmark.mjs` (dados brutos em `benchmark.json`) e `motion qa reel`
(`qa-reel.md`). Medições automáticas; **escuta humana e aprovação do Crítico não são métricas**.

## Arquivos

| | Original (bruto) | **Edição MOTION** | Referência (terceiros) |
|---|---|---|---|
| Caminho | `out/source/reels-motion.mp4` | `projects/reel-ia-programacao/out/final/reel.mp4` | `out/source/reel-ia-programacao.mp4` |
| Formato | 1080×1920 H.264 30 fps, AAC 48 kHz 2ch | 1080×1920 H.264 high yuv420p 30 fps CFR, AAC 192k 48 kHz 2ch | 1080×1920 H.264 30 fps, AAC 48 kHz 2ch |
| Duração | 66,40 s | **53,10 s** (−13,30 s, −20%) | 52,80 s |

## Cortes e ritmo

| | Original | MOTION | Referência |
|---|---|---|---|
| Pausas > 0,3 s entre frases | 13 (5,69 s) | **2 (0,63 s)** | 6 (2,67 s) |
| Fração do tempo com fala (VAD) | 86,5% | **93,0%** | 91,6% |
| Mudanças de plano detectadas (scene > 0,08) | 13* | 19 | 16 |
| Estrutura | — | cronológica: abre em "já é uma realidade…" + card de tese; ênfase visual na virada | gancho invertido ("ficando pra trás" primeiro) |

\* o bruto já contém 18 descontinuidades (emendas/saltos do app do celular), detectadas pela análise
e tratadas pelo plano (bordas encaixadas nelas; zoom cuts sobre elas).
MOTION: 5 cortes de tempo + 10 zoom cuts (mudança de enquadramento sem remover tempo); remoções
por decisão: intro recomeçada (0–8,54 s), primeira ocorrência de "Já é uma realidade",
"Então, eu gostaria de falar que". O fim (63,9–66,4 s) foi mantido para o CTA queimado do autor
ficar ~2,5 s legível (reparo do Crítico); a legenda cede a base nesse trecho. 0 palavras perdidas sem decisão.

## Áudio

| | Original | MOTION | Referência |
|---|---|---|---|
| Loudness integrado (EBU R128, estéreo) | −16,17 LUFS | **−14,15 LUFS** | −14,22 LUFS |
| True peak | −1,16 dBTP | **−4,55 dBTP** (após AAC estéreo; voz mono −1,79 dBTP) | −1,28 dBTP |
| LRA | 2,4 LU | 1,2 LU | 2,1 LU |
| Relação fala/pausa (mesmo método nos três) | 12,3 dB | 10,7 dB | 11,6 dB |
| Zumbido 60 Hz nas pausas | +18,4 dB acima das bandas vizinhas | notch −30 dB aplicado | — |
| Latência da cadeia de voz | — | 24,85 ms medidos e compensados (residual 0 ms) | — |
| Quadros de fala suprimidos > 10 dB | — | 0,06% de 3374 | — |

Leitura honesta: a voz ficou no alvo de loudness sem clipping e sem perda de fala medida, mas a
relação fala/pausa **caiu** ~1,6 dB em relação ao bruto (preset `noisy-room`) (compressão + ganho sobem o ruído entre
frases; o ruído restante é não estacionário — respiração/sala — e o denoise espectral só remove
2–3 dB dele). A referência também perdeu ~0,7 dB. No QA da voz (regiões do próprio corte) a queda é −2,1 dB → `voice.noise` WARN. QA marca `voice.noise` como WARN.
Amostras A/B (mesmo loudness, janela 29,5–41,5 s do vídeo final):
`out/final/audio-ab/ab-before.wav` × `out/final/audio-ab/ab-after.wav`.

## Transcrição (faster-whisper small, CPU INT8, glossário)

| Medida | Valor |
|---|---|
| Idioma detectado (bruto) | pt, p = 0,985 |
| Tempo | 35,5 s para 66,3 s de áudio (4 threads) |
| Palavras (bruto) | 177; 23 com confiança < 0,5 |
| WER na referência × legenda humana dela | **19,5%** (29 edições / 149 palavras) — limite superior: a legenda humana omite/normaliza palavras |
| Reprodutibilidade | duas execuções → palavras e tempos idênticos |
| Alucinação | loop "refinar ×70" na 1ª versão (temperatura fixa) → corrigido com fallback de temperatura + detector |
| Correções aplicadas | 8, todas com evidência da legenda humana do mesmo take (ver `EDIT_PLAN.md`), incl. 2× "traz" omitido pelo ASR |

## Legendas

| | MOTION | Referência |
|---|---|---|
| Blocos | 44 páginas (paginação semântica; 2 de linha única no fim, acima do texto queimado) | 59 blocos (legendas.srt) |
| Blocos sobre fala medida no áudio final (±120 ms) | 100% | 100% |
| Mediana início do bloco − início da fala mais próxima | −0,003 s | +0,06 s |
| Palavras sobre fala no áudio final | 153/153 | — |
| Safe zone Instagram Reels (caixa medida de cada página) | PASS (y 1298–1465 px) | não medido (sem OCR) |
| Palavras faladas com página de legenda | 153/153 (1 oculta por decisão: "ruim", confiança 0,08) | — |
| Altura de maiúscula | 54 px (tamanho 96, métrica medida do libass) | ~64 px (estimativa do Crítico) |
| Olhos/boca (rosto declarado) | 0 páginas sobre a faixa 931–1267 px | — |

## Cards e efeitos

6 cards (título, 3 labels com chips progressivos, 1 lista progressiva, 1 label final), todos com
texto dito na fala; fontes do projeto carregadas, sem overflow. Topo em y = 0,10: dentro do preset
Instagram Reels (8%), fora da heurística vertical genérica do render_static (15%) → WARN registrado. Sem transições decorativas; punch-ins 1,00/1,12 e 1,20 na frase de virada.

## Integridade

Original preservado (SHA-256 igual antes/depois), A/V alinhado (0 ms), quadros = timeline
(1593), sem planos de 1–2 quadros (21 planos visuais, 2 entre 0,63 e 0,67 s por saltos da fonte durante fala), render reproduzível (dois renders com hash de quadros/amostras decodificados idêntico).
Entrega: ZIP verificado por `motion qa delivery` (ver resumo final).
