# Brief

Objetivo: sair da conversa com tudo que só a pessoa sabe, e nada que dê para deduzir.

## Perguntas (só as que bloqueiam)

1. **O que é**, numa frase, e **qual é a ação principal** do usuário com isso.
   Ex.: "agendar uma moto em três toques".
2. **Para quem** e **onde vai rodar** — decide formato (16:9 site/YouTube/X; 9:16 Reels/TikTok/Shorts;
   ambos para campanha).
3. **Duração** (padrão 30 s) e idioma. Nome exato do produto/feature, com grafia e pronúncia.
4. **Materiais**: prints das telas ou acesso ao código do app; logo **vigente**; fonte da marca;
   música (ou permissão para escolher trilha livre); 1–3 vídeos de referência que a pessoa admira.
5. **Proibições**: dados reais de clientes, preços que podem mudar, cores ou concorrentes que não
   podem aparecer.
6. **Serviços pagos disponíveis**: TTS, geração de vídeo por IA. Se sim, teto de gasto.

Deduza o resto (ex.: 9:16 para "vou postar no Instagram"). Não pergunte o que o material já responde.

## Bloco legível por máquina

Inclua no `BRIEF.md` um bloco cercado ` ```json product-brief `:

```json
{
  "skill": "cinematic-product-director",
  "mode": "ui-launch",
  "intent": "launch",
  "durationSec": 30,
  "formats": ["9:16", "16:9"],
  "language": "pt-BR",
  "product": { "name": "", "oneLiner": "", "primaryAction": "" },
  "assets": {
    "logo": "assets/brand/logo-oficial.svg",
    "ui": ["assets/ui/*.png"],
    "music": "assets/audio/track.wav",
    "musicBpm": null,
    "references": ["ref/*.mp4"]
  },
  "glossary": [{ "term": "", "pronunciation": "" }],
  "forbidden": [],
  "paidServices": { "tts": false, "videoGen": false, "budgetUSD": 0 },
  "opening": "original",
  "cta": null
}
```

`mode`: `ui-launch` | `cinema-3d` | `hybrid` (3D na abertura/fecho, UI no miolo).
`musicBpm`: BPM confirmado pela pessoa, ou `null`. Vira `--bpm-hint` e resolve metade/dobro do tempo.
O bloco é `product-brief`: `motion-brief` pertence ao `motion edit`, que recusa estes campos.
`cta` é opcional: um filme de marca pode terminar só na logo.

## Fontes de verdade

Registre de onde vem cada coisa que aparece na tela (`ASSETS.md` ou `assets.manifest.json`): caminho,
origem, licença, quem aprovou. Item sem origem não entra no filme.
