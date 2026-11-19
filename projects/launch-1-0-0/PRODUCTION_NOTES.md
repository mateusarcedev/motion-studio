# Notas de produção — Lançamento MOTION Studio 1.0.0

- **Skill de direção:** `motion-director` (pipeline de 5 departamentos). Gates humanos cumpridos: BRIEF e STYLE aprovados pelo dono em 2026-11-19.
- **Entrega:** 16:9, 1920×1080, 15 s, 30 fps CFR, h264 yuv420p, 450 frames, sem áudio (por brief). Só 16:9: 9:16 e 1:1 não foram pedidos.
- **Reproduzir:** `node packages/motion-cli/bin/motion.mjs render project projects/launch-1-0-0` (gera `out/launch-1-0-0.mp4`, `contact-sheet.png`, `frames/`; renders não são versionados).
- **QA:** stills 60/250/340/440 revisados antes do render; `motion qa determinism --width=1920 --height=1080 --duration=15` → aprovado (3 frames idênticos em duas sessões); Crítico independente (subagente) com 1 rodada de reparo → APPROVE (`reviews/findings.md`).
- **Fidelidade:** texto do terminal = `public/real-init-output.txt` (saída real do `init` 1.0.0, 2026-11-19); emoji ✅ trocados por ✓. Nenhuma UI inventada.
- **Fontes:** Ubuntu Mono + DejaVu Sans Bold (locais). Geist não estava instalada; trocar por Geist exige fontes em `public/fonts/` e novo render.
- **Limitações conhecidas:** D3 parcial (fechamento com ~70% do quadro vazio); contraste do cinza secundário avaliado a olho; a saída capturada mostra "Agentes: Claude Code, OpenAI Codex, OpenCode" detectados por PATH nesta máquina e não foi usada no filme.
- **Achado de distribuição (resolvido):** a Skill pública `motion-director` exigia `.agents/skills/grill-me`, que não é distribuída. A referência foi reescrita: a técnica de entrevista agora está inline e `grill-me` é só um equivalente opcional, nunca obrigatório (hash de `motion-director` atualizado em `public-skills.json`).
