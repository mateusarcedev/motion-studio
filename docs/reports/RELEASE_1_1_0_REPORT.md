# Relatório do release gate — 1.1.0

Gerado por `scripts/release-gate.mjs` em 2026-11-19T22:21:48.946Z (Node v24.16.0, linux 6.6.114.1-microsoft-standard-WSL2).
**Nada foi publicado.** Veredito: **NOT_TESTED (itens declarados)**

| # | Verificação | Estado | Detalhes |
|---|---|---|---|
| R1 | Versionamento e dependências internas exatas | PASS | 4 pacotes em 1.1.0, deps internas exatas, sem prerelease/file: |
| R4 | Geração de tarballs + SHA-256 | PASS | technomanceer-motion-cli-1.1.0.tgz (39 kB), technomanceer-motion-core-1.1.0.tgz (597 kB), technomanceer-motion-studio-1.1.0.tgz (5 kB), technomanceer-motion-studio-skills-1.1.0.tgz (13877 kB) |
| R2 | Suíte de testes completa | PASS | tests 168, pass 168, fail 0, skipped 0 |
| R3 | Skills públicas: manifesto, licenças e hashes | PASS | Verified 11 public Skills, source records, license files, and content hashes. |
| R5 | Conteúdo dos tarballs (sem lixo, bins, assets e licenças presentes) | PASS | motion-cli: 23 arquivos · motion-core: 67 arquivos · motion-studio: 4 arquivos · motion-studio-skills: 189 arquivos |
| R6 | Instalação em diretório limpo a partir dos tarballs | PASS | dependências: @technomanceer/motion-cli, @technomanceer/motion-core, @technomanceer/motion-studio, @technomanceer/motion-studio-skills |
| R7 | CLI instalada: versão e binário | PASS | motion v1.1.0 |
| R8 | motion doctor (Chromium pinado + smoke test) | PASS | · **Chromium (Playwright)** · Sim · ✅ PASS · Chromium 159.0.8154.6 (Playwright 1.65.1, revisão 1255) · Chromium 159.0.8154.6 (revisão 1255) inicia e renderiza corretamente. · Executável: /home/mateusa |
| R9 | Resolução automática de assets (5 tipos) no consumidor | PASS | icon, logo, character, animated-icon, lottie |
| R10 | SVG: gerar, validar, rasterizar; malformado reprovado | PASS | component 0, validate 0, rasterize 0, malformado exit 4 |
| R11 | Render real: PNG estático + 30 frames (svg-motion + Lottie via import map) | PASS | static exit 0, frames exit 0, quadros 30 |
| R12 | Vídeo MP4 com áudio + QA de mídia (codec/fps/duração/áudio/sync) | PASS | render 0, veredito WARN, falhas: nenhuma |
| R13 | QA de quadros (animação presente, sem vazios) | PASS | veredito WARN |
| R14 | Erros estruturados (import quebrado → exit 4; sample-frames inválido → exit 2) | PASS | exit 4 / 2 |
| R15 | Compatibilidade com Node.js (engines: >=18) | NOT_TESTED | executado apenas em v24.16.0; reproduzir em Node 18/20/22 (ex.: `npx -p node@18 -- node scripts/release-gate.mjs --skip-tests`) |
| R16 | Autenticação npm | PASS | logado como technomanceer |
| R17 | Versão ainda não publicada no registro | PASS | @technomanceer/motion-core@1.1.0 livre · @technomanceer/motion-studio-skills@1.1.0 livre · @technomanceer/motion-cli@1.1.0 livre · @technomanceer/motion-studio@1.1.0 livre |
