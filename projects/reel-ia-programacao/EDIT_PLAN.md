# EDIT PLAN (storyboard de edição) — Reel "IA na programação"

Equivalente ao STORYBOARD para edição de material real: escrito **antes** do config/código.
Tempos em segundos do **bruto** (`reels-motion.mp4`); os tempos finais saem da timeline.

## Decisões do operador (registradas em `edit.config.json` → `decisions` da timeline)

| # | Trecho do bruto | Decisão | Por quê |
|---|---|---|---|
| 1 | 0,00–8,50 "Então, eu gostaria de falar sobre a importância de utilizar a IA na programação hoje em dia" | excluir | tomada recomeçada (o motor detecta o recomeço em 24,68 s); abertura lenta; contém o texto queimado "ESCUTA ISSO" |
| 2 | 8,56–9,94 primeira ocorrência de "Já é uma realidade" | excluir (automático) | frase repetida em sequência (falso começo) |
| 3 | 24,68–27,12 "Então, eu gostaria de falar que" | excluir | muleta de recomeço; a frase-chave começa em "se você dev…" |
| 4 | 52,88–54,18 "refinar, refinar, refinar, refinar" | **manter** | repetição enfática (o motor classifica sequências ≥ 3 do mesmo termo como ênfase, não como falso começo) |
| 5 | 64,67–66,40 "então esse é o meu…" | **excluir** (dono, 2026-11-23) | a gravação acaba no meio da frase; o filme termina em "ou ambos", no salto da fonte em 64,667 s |
| 5b | CTA queimado "E VOCÊ, O QUE ACHA?" (63,90 s em diante) | coberto por card com o mesmo texto, sem fala, desde "ou tempo" | sem o fim, o texto queimado ficaria 0,77 s na tela |
| 6 | 27,13–29,57 "se você dev … ficando para trás" | **abre o vídeo** (aceito em 2026-11-23) | virada do argumento, fala com quem assiste; a frase não se repete no lugar de origem |
| 7 | "Mas" (29,6 s) | áudio mantido, sem legenda | confiança 0,05; re-transcrições ouvem hesitação; aguarda escuta |
| 8 | pausas > 0,32 s | remover (automático) | ritmo; sempre com 90 ms antes / 130 ms depois da fala |

Estrutura final (a frase da virada abre; o resto segue a ordem da fala). A referência abre com a mesma frase:
a decisão é do dono do projeto e substitui a restrição inicial de não repetir o gancho dela.

| Bloco | Fala | Visual |
|---|---|---|
| Abertura | "se você dev não está utilizando, você está ficando para trás" | punch-in 1,20, sem card; "VOCÊ ESTÁ / FICANDO PARA TRÁS", "TRÁS" em cor própria |
| Tese | "já é uma realidade, não temos para onde fugir" | legenda |
| Contexto | "não é mais algo opcional como era ali em 2022 quando o ChatGPT surgiu" | card "Não é mais opcional" (sem rótulo: "2022" invertia a frase) |
| Ferramentas | "como o Antigravity, Codex, o próprio Claude Code da Anthropic" | card `// e logo vieram` com chips revelados na fala |
| Benefícios | "utilizar IA te traz muitos benefícios…" | legenda |
| Foco | "não somente em código, mas também na regra de negócio… no produto" | lista `// seu foco passa a ser` 1 regra de negócio · 2 produto ("código" saiu: a fala é "não somente em código") |
| Problema | "nós desenvolvedores… a gente foca muito na tecnologia" | legenda (card removido: repetia a fala) |
| Cliente | "o que ele quer, o sistema funcionando… economizar dinheiro, ou tempo, ou ambos" | card `// o que o cliente quer` "o sistema funcionando" + chips dinheiro · tempo · ambos |

## Correções de reconhecimento (com evidência)

Evidência: `legendas.srt` é a legenda humana da versão editada, cortada **deste mesmo take**
(correlação do envelope de áudio entre referência e bruto ≥ 0,90 na maioria das janelas de 1 s, com deslocamentos constantes por trecho). Usada só para
confirmar/corrigir palavras do ASR — nunca como transcrição do bruto nem fonte de tempos.

| Palavra(s) ASR | Corrigido | Evidência |
|---|---|---|
| "deve" | "dev" | SRT: "se você dev não está utilizando" |
| "AdGravity," | "Antigravity," | SRT: "como o Antigravity Codex" |
| "o Claude Code, Anthropic" | "o próprio Claude Code da Anthropic" | SRT idem |
| "muitas" (possibilidades) | "traz muitas" | SRT: "traz muitas possibilidades" (ASR omitiu "traz"; o Crítico apontou 3,3 s de fala com 3 palavras) |
| "muito" (rapidez) | "traz muita" | SRT: "traz muita rapidez" |
| "para o pro -aroclente" | "pro próprio cliente" | SRT: "Mas quando pro próprio cliente" |
| "ChatGPT", "IA" (baixa confiança) | confirmados | SRT contém as mesmas palavras |

Ficam para revisão humana (sem evidência ou com divergência que só a escuta resolve): "te" em "IA te traz",
"Mas" (29,44 s), "e quer", "não temos para onde fugir" × SRT "não ter mais pra onde fugir",
"faça ele economizar" × SRT "faça e economize". A SRT humana da referência é editada e não prova a fala.

## Rosto (declarado pelo operador a partir dos stills da análise)

Caixa da cabeça (topo do cabelo → queixo): x 0,18 · y 0,31 · w 0,62 · h 0,50 → faixa
olhos→boca 0,485–0,66 → legenda abaixo da boca.

Áudio: preset `natural` (Missão 21.1; era `noisy-room`).
