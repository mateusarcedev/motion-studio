# Missão 22 — Plano (integrar `cinematic-product-director`)

> **Gate: aprovado pelo dono em 2026-11-23**, com correção dos três scripts e confirmação de BPM no aviso de oitava. Etapa A apenas leu, comparou e mediu. Nenhum código, skill,
> catálogo ou teste foi alterado.
> Levantamento em 2026-11-23, base `c197ce2`.

## 1. Pacote recebido

- Arquivo: `cinematic-product-director.zip`, SHA-256
  `12631223e3628ca21b62201255e1e23c2060d11c24d3db800b471388571bd846`, 17 entradas, sem links simbólicos.
- O caminho `~/refs/missao-22/` informado na missão **não existe** nesta máquina. Foi usado o ZIP de mesmo
  nome na raiz do repositório (não versionado; não deve ser commitado).
- Conteúdo: `SKILL.md`, 9 referências, 3 scripts (`beat_map.py`, `ref_analyze.py`, `export_whatsapp.sh`).
- Autoria original declarada no `INTEGRATION.md`. A verificação de não cópia descrita lá não foi refeita:
  os pacotes de terceiros não estão disponíveis (`NOT_TESTED`).

## 2. Comparação com o que existe

| Item | Hoje | Consequência |
|---|---|---|
| Catálogo público | 13 Skills; hash só de `SKILL.md` | passa a 14; referências e scripts da nova Skill ficariam **sem hash** no manifesto |
| Mirrors | `installSkills()` copia de `packages/motion-skills/skills` para `.agents/skills` e cria links em `.claude` e `.opencode`; não atualiza o que já existe | serve para criar a Skill nova; a atualização de `studio-director` é em dois lugares |
| Cópias divergentes | `.agents` e o pacote já diferem em `carousel-studio`, `explainer-motion`, `shorts-director` e `studio-director` | **anterior à missão**; editar só o trecho da rota nos dois lados, sem sobrescrever |
| Perfis | `motion` e `3d` existem; `cinematic` não | incluir nos dois; não criar `cinematic` |
| Roteamento | a matriz do `studio-director` (texto) cita `reel-editor`; `shorts-director` não está nela | a rota nova e os testes precisam das duas linhas |
| Roteador em código (`packages/motion-core/intent/router.js`) | não conhece `reel-editor`, `shorts-director` nem a Skill nova | teste de rota real exige mudar o código |
| Detecção de cortes | `detectSourceCuts` (`reel/analyze.mjs`): mesmo princípio (score × mediana local), limites 0,05 e 15× | `ref_analyze.py` usa 0,08 e 8×; manter separado nesta missão e documentar a duplicação |
| `motion-brief` | `parseBrief` recusa campos desconhecidos (aceita 6) | o bloco da Skill (`skill`, `mode`, `product`…) **falha** se lido pelo `motion edit` |
| Python | CI instala só Pillow; local sem numpy, scipy e Pillow | `beat_map.py` não roda sem dependência nova, ao contrário do que o item 6 do `INTEGRATION.md` sugere |
| `motion export` | exporta pacote por contrato; sem perfil de mensageiro | migração dos scripts para o core fica fora (ver 6) |
| Contagens "13" e "53" | README, INSTALLATION, `main.mjs`, 3 arquivos de teste | atualizar para 14 e 54 |

### 2.1 Roteador hoje (medido)

| Pedido | Resultado atual | Esperado |
|---|---|---|
| vídeo de lançamento da feature X | `motion_graphics_2d`, sem especialista | `cinematic-product-director` |
| filme do produto; logo 3D abrindo o vídeo | sem especialista | `cinematic-product-director` |
| teaser do app; vídeo estilo Apple para o meu app | `motion-director`, `stageshow` | `cinematic-product-director` |
| edita meu vídeo gravado | sem especialista | `reel-editor` |
| short narrado deste texto | sem especialista | `shorts-director` |
| carrossel de lançamento do app | `motion-director`, `stageshow` (já errado) | `carousel-studio` |

## 3. Testes dos scripts como vieram (fixtures sintéticas, fora do repositório)

Ambiente: Python do sistema em venv, numpy 2.5.5, scipy 1.18.1, Pillow 13.0.0, FFmpeg 8.0.1.

### 3.1 `beat_map.py` — não atende ao aceite

Trilha de 40 s: bumbo no tempo forte e chimbal em toda batida ("simples"), ou também na colcheia.

| BPM real | Simples | Com colcheias |
|---|---|---|
| 60 | 60,14 | **120,08** (dobro) |
| 92 | 92,09 | 92,10 |
| 128 | 127,98 | 127,98 |
| 174 | **87,05** (metade) | **87,05** (metade) |

- **Oitava:** a ponderação centrada em 110 BPM troca 174 por 87 e 60 por 120.
- **Adiantamento sistemático de 26–31 ms** em todas as faixas. Causa provável: o tempo do quadro da STFT é o
  início da janela (1024 amostras; centro = 23 ms). Com isso o tempo forte chegou a 36 ms de erro em 60 BPM,
  acima de um quadro a 30 fps (33,3 ms).
- **Batidas extras nas pontas** (antes da primeira ou depois da última) em 92 e 128. Parte do erro máximo
  medido vem daí; o teste definitivo separa extrapolação de erro.

### 3.2 `ref_analyze.py` — parcial

Vídeo de 6 s, cortes em 1,0, 2,5 e 4,0 s.

- Sem sobreposição: cortes exatos.
- Com caixa grande entrando em 1,8 s: **corte falso em 1,833 s** (score 0,132, acima do piso 0,08).
  A caixa pequena em 5,0 s foi classificada como overlay, correto.
- O score global não separa os dois casos: o jump cut de rosto tem 0,08–0,25. É preciso critério espacial.
- Falso overlay em 0,033 s (primeiro quadro) e 2,533 s (quadro seguinte a um corte).
- `references/reference-breakdown.md` ainda cita o limiar 0,30, que o script abandonou.
- Falha do FFmpeg em `scene_scores` não é verificada: viraria "0 cortes" em silêncio.

### 3.3 `export_whatsapp.sh` — defeito grave

- Master sintético de 60 s com ruído, 1080×1920: 8,96 MiB (alvo 9,5), 720×1280, 1 tentativa, PASS.
- **A proteção do master é só comparação de texto.** `export_whatsapp.sh m.mp4 9.5 ./m.mp4` **destruiu o
  master**: o arquivo foi truncado, e o script saiu com 0 e `status: PASS`. Links simbólicos e caminhos
  absolutos têm o mesmo problema (mesma causa; não executados).
- Grava direto em `$OUT`: se falhar no meio ou passar do alvo, deixa um arquivo incompleto.
- `AK` é reservado mesmo sem áudio; `-pass 1 … /dev/null` e `mktemp -d` não existem no Windows.
- JSON montado por `printf`: aspas no nome do arquivo quebram a saída.
- Não confere duração nem presença de áudio da saída contra o master.

## 4. Mudanças propostas

1. **Skill.** Copiar para `packages/motion-skills/skills/cinematic-product-director/`; gerar `.agents`
   e os links com `installSkills({ selectedSkills: ["cinematic-product-director"] })`. Nada copiado à mão.
   Teste: árvore do pacote igual à de `.agents`; links resolvem.
2. **Catálogo.** Entrada em `public-skills.json`, em `files` do `package.json`, perfis `motion` e `3d`. Hash por
   script novo (`scripts/update-public-skills.mjs`). Para esta Skill, campo adicional `treeSha256`, conferido
   pelo `skills:verify` e pelo instalador, cobrindo scripts e referências. Versão continua 1.1.1, sem publish.
3. **Rota.** Linhas no `studio-director` (pacote e `.agents`) e decisão no `router.js` com precedência:
   formato estático (carrossel, stories, post) e site → gravação existente → short narrado → filme de produto →
   regras atuais. O resultado ganha `route`; os campos atuais não mudam para os pedidos já testados.
4. **`motion-brief`.** Renomear o bloco da Skill para ` ```json product-brief `, sem tocar em `parseBrief`.
5. **`beat_map.py`.** Corrigir tempo do quadro (centro da janela), escolha de oitava e pontas. Se o pulso for
   ambíguo, gravar `tempoCandidates` e baixar `confidence`, em vez de afirmar um valor.
6. **`ref_analyze.py`.** Critério espacial (fração de blocos alterados) para separar corte de overlay; ignorar o
   primeiro quadro e a vizinhança de cortes; erro do FFmpeg vira falha. Corrigir `reference-breakdown.md`.
7. **`export_whatsapp.sh`.** Comparar o arquivo real (`-ef`, caminho resolvido); codificar em arquivo temporário
   no mesmo diretório e só mover se passar; JSON com escape; conferir duração e áudio; não reservar áudio
   inexistente. Alvo em MiB, documentado.
8. **Dependências e docs.** numpy e scipy fixados no CI; registro em `THIRD_PARTY.md` e `INTEGRATIONS.md`
   como dependências opcionais de um script. CHANGELOG e README só com o CI verde.

## 5. Testes e aceite

| Área | Positivos | Negativos |
|---|---|---|
| Rota | lançamento, teaser, filme do produto, logo 3D → Skill nova | gravado → `reel-editor`; "edita o vídeo de lançamento que gravei" → `reel-editor`; short de texto → `shorts-director`; "short narrado sobre o lançamento" → `shorts-director`; carrossel, post e landing page de lançamento → fora da Skill nova; "como funciona uma API" inalterado |
| `beat_map` | 60, 92, 128, 174 BPM: erro < 0,5 BPM; tempos fortes < 1 quadro a 30 fps; simples e com colcheias | ruído sem pulso → confiança < 0,3; áudio < 1 s → erro; duas execuções idênticas |
| `ref_analyze` | cortes exatos (± 1 quadro) com e sem texto; overlays separados; jump cut de score baixo | sem cortes → 0; arquivo ausente ou corrompido → erro |
| `export_whatsapp` | 60 s abaixo do alvo, 720 px no lado menor, retrato e paisagem, com e sem áudio | `./`, caminho absoluto, link simbólico e link físico: código ≠ 0 e SHA-256 do master igual; alvo impossível → FAIL sem deixar saída |
| Distribuição | 14 Skills, perfis, `skills:verify`, instalador | script adulterado → `SKILL_INTEGRITY` |

- Todas as fixtures são geradas na hora; nenhuma mídia é versionada. Testes em `tests/test_*.py`.
- Sem dependência disponível o teste **falha**; não pula. Hoje o `test:py` não recusa pulos, ao contrário do
  `test:ci`: passaria a recusar.
- Custo: a exportação de 60 s com ruído levou 144 s (1080×1920, `preset slow`). O CI usará um único master de 60 s
  menos custoso e clipes curtos no resto.
- Aceite final: suíte completa, `act` em Node 20, 22 e 24, determinismo e CI do GitHub verde. Push só com autorização.

## 6. Fora do escopo

- `motion audio beats`, `motion ref analyze` e perfil `whatsapp` no `motion export` (item 4 do
  `INTEGRATION.md`): missão própria. O `SKILL.md` já os chama de "candidatos".
- Sincronizar as 4 Skills divergentes; perfil `cinematic`; `librosa`/`demucs`; TTS e geração de vídeo pagos.
- Produção de um filme de homologação; a qualidade criativa da Skill fica `NOT_TESTED`.

## 7. Etapas (commits)

B1 Skill, mirrors e catálogo · B2 rota e testes · B3 scripts corrigidos e testes · B4 docs, CI e `act` ·
parada para revisão antes de qualquer push.

## 8. Decisões para o dono

1. **Scripts:** corrigir os defeitos da seção 3 nesta missão (recomendado). Sem isso, o aceite de
   174 BPM, de overlays e de "não sobrescrever o master" não passa.
2. **Compasso ambíguo:** com colcheias fortes, 60 e 120 BPM podem ser indistinguíveis pelo áudio. Recomendado:
   o teste exige 60 na faixa com tempos fortes claros e aceita a ambiguidade declarada nas demais.
3. **Bloco do brief:** renomear para `product-brief` (recomendado) ou ampliar `parseBrief`.
4. **Hash da árvore** (`treeSha256`) só na Skill nova (recomendado) ou nas 14.
5. **Roteador em código:** mudar `router.js` (recomendado) ou só a matriz em texto, com testes mais fracos.
6. **Distribuição:** entrar no catálogo público (14) com licença Apache-2.0, como as demais próprias. Confirmar.
7. **Origem:** confirmar que o ZIP da raiz (hash na seção 1) é o mesmo de `~/refs/missao-22/`.
