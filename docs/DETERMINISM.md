# Determinismo de vídeo

## Garantia

**Idêntico na mesma máquina; visualmente igual entre máquinas.** Com os mesmos arquivos de entrada, configurações e versões das ferramentas, os renders feitos na mesma máquina devem produzir os mesmos quadros e áudio. CPUs, sistemas e builds de FFmpeg, Chromium, fontes ou codecs diferentes podem mudar a codificação e os valores exatos dos pixels; nesses casos, a expectativa é equivalência visual.

O gate de determinismo do CI renderiza duas vezes no mesmo job e compara os resultados nesse ambiente. Ele não compara renders feitos em máquinas diferentes nem serve como benchmark de CPU.

## Arquivos de render

Cada invocação usa um diretório de trabalho e caminhos temporários próprios. Etapas aguardam a conclusão da gravação antes de consumir os arquivos; arquivos finais e progresso são publicados por rename atômico depois de completos.

## Repetição focada do estágio final

Para investigar uma divergência que já está localizada na composição final, use intermediários preservados por `renderTimeline({ keepWork: true })` ou pelo artefato de CI `determinism-intermediates`:

```bash
npm run test:determinism:replay -- \
  --source=/caminho/para/render-preservado \
  --runs=4 \
  --evidence-dir=/caminho/para/evidencias \
  --expect-difference
```

O diretório de origem contém `reel.render.json`, `reel.timeline.json` e `reel.work/render-*/`. O replay executa somente a composição final e a medição de true peak; não repete análise de fonte, processamento de voz, codificação de segmentos, renderização Chromium ou pilotos M23. Cada tentativa recebe arquivos de saída e workdir novos. Os hashes de segmentos, overlays, áudio, legendas e fontes são registrados antes e depois para detectar alteração dos insumos. A comparação registra hashes decodificados e de pacotes por stream e o hash do contêiner; o relatório também guarda as linhas de comando FFmpeg e o ambiente local.

Os estados são distintos: `PASS` só é possível se todas as comparações forem legíveis e idênticas; `FAIL_CONFIRMED` requer uma diferença de mídia efetivamente comparada; `INCONCLUSIVE` cobre leitura ou execução incompleta e o caso em que `--expect-difference` não se reproduz. Códigos de saída: 0, 1 e 2, respectivamente. Um resultado inconclusivo ou uma repetição aprovada não encerra incidentes anteriores. Se o replay não encontrar a divergência, preserve-o como evidência de não reprodução naquele ambiente e mantenha o incidente aberto.

## Incidente intermitente preservado

O CI do run [45877470125](https://github.com/mateusarcedev/motion-studio/actions/runs/45877470125) registrou uma divergência no estágio final com Node 22.23.5, FFmpeg 6.1.1-3ubuntu5 e Chromium 156.0.8078.4. Quatro de 183 quadros de vídeo divergiram (74, 77, 78 e 79; PSNR entre 104,03 e 107,04 dB); os intermediários e os streams de áudio permaneceram idênticos. A repetição do job passou, mas a causa raiz não foi determinada. Os registros de incidente continuam em [`MISSION_23_M6_REPORT.md`](reports/MISSION_23_M6_REPORT.md), [`MISSION_23_M6_FINAL_RELEASE_GATE.md`](reports/MISSION_23_M6_FINAL_RELEASE_GATE.md) e no JSON histórico vinculado por esses relatórios.

Em 26/11/2026, o replay focado dos intermediários preservados foi executado duas vezes neste host com Node 24.16.0 e FFmpeg 8.0.1-3ubuntu2. As duas composições foram idênticas em vídeo decodificado/pacotes, áudio decodificado/pacotes e contêiner; `--expect-difference` classificou a ausência de reprodução como `INCONCLUSIVE`. Este host não reproduz o ambiente Node 22/FFmpeg 6/Chromium 156 do incidente. O relatório completo foi preservado em [`final-stage-replay-2026-11-26.json`](reports/assets/mission-24/final-stage-replay-2026-11-26.json). Isso não resolve nem reduz a classificação do incidente histórico.

Outra diferença real foi observada no run M24 [45884408723](https://github.com/mateusarcedev/motion-studio/actions/runs/45884408723), no teste CLI × MCP, com Node 22.23.5 e FFmpeg 6.1.1-3ubuntu5. A comparação final confirmou diferença em vídeo decodificado, pacotes de vídeo e hash do contêiner; os hashes de áudio decodificado/pacotes, WAV de voz, preview e legendas foram iguais. Este segundo resultado não estabelece que seja a mesma causa do run M23. Naquele commit, o job não guardava artefatos do teste de paridade; por isso não há MP4s, índices de frames ou intermediários para replay e a versão do Chromium não ficou registrada no log. A evidência disponível foi arquivada em [`ci-run-45884408723-node22-parity.json`](reports/assets/mission-24/ci-run-45884408723-node22-parity.json). Para falhas futuras, o teste preserva os workdirs por `keepWork` e o workflow anexa `tests/tmp/mcp-parity` por 30 dias. A ausência dessa evidência no run já concluído e a causa ainda desconhecida continuam registradas.

## Limite

Não há modo `--strict-determinism` nem promessa de identidade binária entre máquinas. Para validação entre hosts, compare visualmente os quadros e o áudio.
