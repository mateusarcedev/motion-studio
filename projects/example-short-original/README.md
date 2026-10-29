# Short Original — validação Fase C (shorts-director)

Pipeline executado:
1. BRIEF.md + STORYBOARD.md (gate humano ✋ simulado)
2. composition.html (frame-driven, deterministic, seed=42)
3. render_frames.mjs → 600 frames (1080×1920, scale=1, CFR 30fps)
4. build_contact_sheet.py (beats-chave para Crítico)
5. assemble_video.py → MP4 (sem áudio: fallback textual)
6. caption.srt (timestamps estimados = duração/palavras)
7. manifest + ZIP

Determinismo: seed=42 + composition.html = MD5 reprodutível frame-a-frame.
Fallback textual: chatterbox não instalado → AUDIO_FALLBACK=true, sem narração, legenda SRT por beat.
