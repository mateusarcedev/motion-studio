# Relatório do release gate — 1.1.1

Gerado por `scripts/release-gate.mjs` em 2026-11-26T18:00:19.356Z (Node v24.16.0, linux 6.6.114.1-microsoft-standard-WSL2).
**Nada foi publicado.** Veredito: **FAIL**

| # | Verificação | Estado | Detalhes |
|---|---|---|---|
| R1 | Versionamento e dependências internas exatas | PASS | 4 pacotes em 1.1.1, deps internas exatas, sem prerelease/file: |
| R4 | Geração de tarballs + SHA-256 | PASS | technomanceer-motion-cli-1.1.1.tgz (61 kB), technomanceer-motion-core-1.1.1.tgz (767 kB), technomanceer-motion-studio-1.1.1.tgz (5 kB), technomanceer-motion-studio-skills-1.1.1.tgz (13736 kB) |
| R2 | Suíte de testes | NOT_TESTED | --skip-tests |
| R3 | Skills públicas: manifesto, licenças e hashes | PASS | Verified 17 public Skills, 4 local lock records, source records, licenses, and content hashes. |
| R5 | Conteúdo dos tarballs (sem lixo, bins, assets e licenças presentes) | PASS | motion-cli: 26 arquivos · motion-core: 106 arquivos · motion-studio: 4 arquivos · motion-studio-skills: 194 arquivos |
| R6 | Instalação em diretório limpo a partir dos tarballs | PASS | dependências: @technomanceer/motion-cli, @technomanceer/motion-core, @technomanceer/motion-studio, @technomanceer/motion-studio-skills |
| R7 | CLI instalada: versão e binário | PASS | motion v1.1.1 |
| R8 | motion doctor (Chromium pinado + smoke test) | PASS | · **Chromium (Playwright)** · Sim · ✅ PASS · Chromium 159.0.8154.6 (Playwright 1.65.1, revisão 1255) · Chromium 159.0.8154.6 (revisão 1255) inicia e renderiza corretamente. · Executável: /home/mateusa |
| R9 | Resolução automática de assets (5 tipos) no consumidor | PASS | icon, logo, character, animated-icon, lottie |
| R10 | SVG: gerar, validar, rasterizar; malformado reprovado | PASS | component 0, validate 0, rasterize 0, malformado exit 4 |
| R11 | Render real: PNG estático + 30 frames (svg-motion + Lottie via import map) | PASS | static exit 0, frames exit 0, quadros 30 |
| R12 | Vídeo MP4 com áudio + QA de mídia (codec/fps/duração/áudio/sync) | PASS | render 0, veredito WARN, falhas: nenhuma; avisos: audio.loudness (-32.3 LUFS) |
| R13 | QA de quadros (animação presente, sem vazios) | PASS | veredito WARN; avisos: blank (1/30 quase uniformes (ex.: 0000.png)), repetition (97% dos quadros têm um gêmeo visual não adjacente; 15/15 pares adjacentes idênticos sem pausa marcada) |
| R14 | Erros estruturados (import quebrado → exit 4; sample-frames inválido → exit 2) | PASS | exit 4 / 2 |
| R15 | Compatibilidade com Node.js 20, 22 e 24 | NOT_TESTED | v24.16.0: PASS (152 testes, 0 falhas) · faltam Node 20, 22; engines >=20 |
| R16 | Autenticação npm | BLOCKED | npm login necessário |
| R17 | Versão ainda não publicada no registro | FAIL | @technomanceer/motion-core@1.1.1 JÁ EXISTE · @technomanceer/motion-studio-skills@1.1.1 JÁ EXISTE · @technomanceer/motion-cli@1.1.1 JÁ EXISTE · @technomanceer/motion-studio@1.1.1 JÁ EXISTE |

**Validação remota posterior:** o CI do commit `5ebbc30fd82bd0a3e22463d2f7a576093d12bc6b` passou em 4/4 jobs, incluindo determinismo e a matriz Node.js 20/22/24. Isso complementa R15: a marca `NOT_TESTED` acima descreve apenas a indisponibilidade local dos runtimes Node 20/22 no release gate. [Execução GitHub Actions](https://github.com/mateusarcedev/motion-studio/actions/runs/45873168038).

O CI do commit documental final `a19c9d7767a31d1c4152212bafa9af87d076dc79` também passou em 4/4 jobs após reexecutar o job Node 24, cuja primeira tentativa parou antes dos testes por um HTTP 403 do repositório externo ao instalar Chromium. [Execução GitHub Actions](https://github.com/mateusarcedev/motion-studio/actions/runs/45874719534).

No commit seguinte (`0525b3f`), os testes Node 20/22/24 passaram. O primeiro job de determinismo encontrou divergência real de vídeo no estágio final no ambiente Node 22.23.5/FFmpeg 6.1.1-3ubuntu5, e a reexecução do job passou. O run terminou `success` após retry, mas o incidente permanece aberto; detalhes por stream/frame estão no [relatório da execução](../../projects/m6-herbario-de-nevoa/evidence/node24-determinism/ci-run-45877470125-node22-report.json) e na [execução GitHub Actions](https://github.com/mateusarcedev/motion-studio/actions/runs/45877470125).
