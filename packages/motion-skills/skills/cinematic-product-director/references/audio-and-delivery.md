# Som e entrega

## Camadas

1. **Trilha** — editada em compassos (`music-first.md`).
2. **SFX de interface** — discretos e com sentido: toque em botão, deslize, confirmação, foto. Um som
   por tipo de ação; volume 10–18 dB abaixo da trilha. Fontes com licença clara (CC0, biblioteca própria,
   gerados localmente). Nunca redistribuir pacote pago.
3. **Narração** (opcional) — roteiro curto, frases que cabem nos compassos.

## Narração por TTS

- Glossário do BRIEF com pronúncia. Grafia fonética **só** no texto enviado ao TTS; a legenda usa a
  grafia correta.
- Transcrever o áudio gerado confirma ritmo e palavras, **não** pronúncia de nomes próprios. Pronúncia
  fica `NOT_TESTED` até uma pessoa ouvir.
- Serviço pago só com aprovação de provedor, voz, estimativa e escopo. Chave só no ambiente do comando.

## Mixagem

- Voz por cima: trilha com ducking quando há narração (sidechain), retomando entre frases.
- Alvo de loudness do preset da plataforma (redes: −14 LUFS integrado).
- **Meça depois do encode final** (AAC): true peak ≤ −1,5 dBTP. Limitador do ffmpeg não garante isso
  sozinho; se passar, reduza ganho e reencode.
- Normalize no layout de entrega (estéreo), não no mono intermediário.

## Formatos

| Destino | Formato | Observação |
|---|---|---|
| Master | 16:9 e/ou 9:16, 1080p, 30 fps CFR, H.264 high, yuv420p, AAC 48 kHz | fonte para todas as versões |
| Reels/TikTok/Shorts | 1080×1920, CRF 16–18 | recomposição vertical, safe zones do preset |
| YouTube/site | 1920×1080 | — |
| Mensageiro (WhatsApp) | 720p no lado menor, < 10 MB (alvo 9,5) | `scripts/export_whatsapp.sh`, duas passagens |
| Pôster | PNG do quadro mais representativo | escolhido no storyboard, não o quadro 0 por acaso |

Versões são declaradas em `delivery.contract.json` e verificadas com `motion qa delivery` no ZIP real.
Nomes de arquivo sem acento e sem espaço.
