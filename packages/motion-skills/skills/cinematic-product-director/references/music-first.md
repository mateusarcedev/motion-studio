# Música primeiro

A linha do tempo é desenhada sobre a música. Segundos redondos ("cena 2 aos 5 s") produzem um filme que
anda ao lado da trilha; compassos produzem um filme que anda **com** ela.

## 1. Escolher a faixa

- A da pessoa (ela responde pelos direitos) ou trilha com licença clara (biblioteca livre, encomendada,
  gerada localmente). Registre a licença no manifesto.
- Sem licença verificável, não entra na entrega pública.

## 2. Mapear

```bash
python3 scripts/beat_map.py assets/audio/track.wav --fps 30 --out beats.json
```

Saída:

```json
{
  "bpm": 92.0, "beatSec": 0.652, "barBeats": 4, "confidence": 0.61,
  "tempoAmbiguous": false, "tempoCandidates": [{ "relation": "chosen", "bpm": 92.0, "score": 0.61 }, ...],
  "beats":     [{ "t": 0.512, "frame": 15, "strength": 0.83, "downbeat": true }, ...],
  "bars":      [{ "index": 0, "t": 0.512, "frame": 15 }, ...],
  "sections":  [{ "t": 0.0, "energy": "low" }, { "t": 10.9, "energy": "high" }, ...]
}
```

**Aviso de oitava (`tempoAmbiguous: true`)**: metade ou dobro do tempo também é plausível, e o áudio não
decide sozinho (174 pode sair como 87; 60 com colcheias, como 120). Antes de usar `beats.json`:

1. BRIEF com `assets.musicBpm` → rode de novo com `--bpm-hint <BPM>`;
2. sem isso → mostre os `tempoCandidates`, peça confirmação do BPM, grave em `assets.musicBpm` e rode de novo.

Sem resposta, o mapa fica `BLOCKED` e o storyboard por compassos não começa. Sem aviso, ainda confira de
ouvido: ausência de aviso não prova a oitava.

`confidence` baixa (< 0,3) = faixa sem pulso claro (ambiente, piano livre). Nesse caso, marque os pontos
de virada à mão ouvindo e registre isso. A detecção assume 4/4; em 3/4 ou 6/8 passe `--bar-beats`.

Para separar bateria (bumbo/caixa) em mixagens densas, `demucs` e `librosa` ajudam se instalados; são
opcionais e entram em `THIRD_PARTY.md` com licença.

## 3. Marcar momentos

Anote no storyboard, em compassos:

- **entrada** — o que prende no primeiro segundo;
- **quebra** (sem percussão) — explicação, respiro, UI com detalhe;
- **volta da bateria** — a virada principal do filme;
- **últimos compassos** — 2–3 palavras de impacto e logo.

## 4. Editar a trilha para caber

- Corte sempre no início de compasso; crossfade curto (3–10 ms) para não estalar.
- Prefira remover compassos inteiros do meio a acelerar a música.
- Termine em tempo forte ou numa cauda natural; nunca corte no meio de uma nota longa sem fade.

## 5. Sincronizar

- Elemento importante entra **no** tempo forte, ou até ~2 quadros antes (o olho percebe com atraso).
- Texto ligado a narração entra até ~80 ms antes da sílaba correspondente.
- Use `beats.json` como fonte única: a composição lê os tempos, nada de número mágico no código.
