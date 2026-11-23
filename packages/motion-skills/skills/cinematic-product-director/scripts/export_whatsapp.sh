#!/bin/sh
# export_whatsapp.sh — versão leve de um master para mensageiros (padrão: < 10 MB, alvo 9,5 MB).
#
# Uso: export_whatsapp.sh [--force] <master.mp4> [alvo_MB=9.5] [saida.mp4]   (MB = 1048576 bytes)
#
# - 720 px no lado menor (mantém proporção), H.264 high, yuv420p, AAC 96 kb/s, faststart.
# - Bitrate de vídeo calculado pela duração; codificação em duas passagens.
# - Redução de ruído leve antes de codificar: grão é o que mais consome bits em bitrate baixo.
# - Se o arquivo passar do alvo, refaz uma vez com 8% menos bitrate. Se ainda passar, sai com erro.
# - Imprime um JSON com tamanho, bitrates e status.
# - Nunca grava no master: compara o arquivo real (caminho, link simbólico ou físico), mesmo com --force.
# - Destino existente é recusado sem --force. A saída só aparece depois de conferida (temporário + mv).
# Dependências: ffmpeg/ffprobe, awk.
set -eu

FORCE=0
if [ "${1:-}" = "--force" ]; then FORCE=1; shift; fi
SRC=${1:?uso: export_whatsapp.sh [--force] <master.mp4> [alvo_MB] [saida.mp4]}
ALVO=${2:-9.5}
OUT=${3:-${SRC%.*}-whatsapp.mp4}
AK=96

[ -f "$SRC" ] || { echo "arquivo não encontrado: $SRC" >&2; exit 2; }
case "$SRC" in -*) SRC=./$SRC;; esac
case "$OUT" in -*) OUT=./$OUT;; esac
if [ "$SRC" = "$OUT" ] || [ "$SRC" -ef "$OUT" ] || [ "$(realpath -- "$SRC")" = "$(realpath -m -- "$OUT" 2>/dev/null || realpath -- "$OUT" 2>/dev/null || echo)" ]; then
  echo "saída não pode sobrescrever o master" >&2; exit 2
fi
if [ -d "$OUT" ]; then echo "a saída é uma pasta: $OUT" >&2; exit 2; fi
if { [ -e "$OUT" ] || [ -L "$OUT" ]; } && [ "$FORCE" -ne 1 ]; then
  echo "destino já existe (use --force): $OUT" >&2; exit 2
fi
awk -v a="$ALVO" 'BEGIN{exit !(a ~ /^[0-9]+([.][0-9]+)?$/ && a>0)}' || { echo "alvo inválido: $ALVO" >&2; exit 2; }

# uma consulta só: largura, altura, duração e presença de áudio
INFO=$(ffprobe -v quiet -show_entries stream=codec_type,width,height:format=duration -of default=nw=1 "$SRC")
VW=$(printf '%s\n' "$INFO" | awk -F= '$1=="width"{print $2; exit}')
VH=$(printf '%s\n' "$INFO" | awk -F= '$1=="height"{print $2; exit}')
LEN=$(printf '%s\n' "$INFO" | awk -F= '$1=="duration"{print $2; exit}')
HAS_A=$(printf '%s\n' "$INFO" | awk -F= '$1=="codec_type" && $2=="audio"{print 1; exit}')

[ -n "$VW" ] && [ -n "$VH" ] && [ -n "$LEN" ] || { echo "vídeo ilegível: $SRC" >&2; exit 2; }
[ -n "$HAS_A" ] || AK=0

if [ "$VW" -le "$VH" ]; then SCALE="720:-2"; else SCALE="-2:720"; fi
VF="scale=$SCALE:flags=lanczos,hqdn3d=1.2:1.2:3:3,format=yuv420p"

TMP=$(mktemp -d)
# mesmo diretório do destino: o mv final é atômico
PART=$(mktemp "$(dirname -- "$OUT")/.export-whatsapp-XXXXXX")
trap 'rm -rf "$TMP"; rm -f "$PART"' EXIT
trap 'exit 130' INT TERM

# kbit/s de vídeo = (alvo em kbit * 0,96 de margem para o contêiner) / duração - áudio
vk() { awk -v mb="$1" -v d="$LEN" -v ak="$AK" 'BEGIN{v=int(mb*8192*0.96/d - ak); if(v<150)v=150; print v}'; }

encode() {
  K=$1
  X264="-c:v libx264 -preset slow -b:v ${K}k -profile:v high"
  # shellcheck disable=SC2086
  ffmpeg -hide_banner -loglevel error -nostdin -i "$SRC" -filter:v "$VF" $X264 \
    -pass 1 -passlogfile "$TMP/p" -an -f mp4 -y /dev/null
  if [ -n "$HAS_A" ]; then AUD="-c:a aac -b:a ${AK}k -ar 48000"; else AUD="-an"; fi
  # shellcheck disable=SC2086
  ffmpeg -hide_banner -loglevel error -nostdin -i "$SRC" -filter:v "$VF" $X264 \
    -maxrate "$((K * 3 / 2))k" -bufsize "$((K * 2))k" -pass 2 -passlogfile "$TMP/p" \
    -movflags +faststart $AUD -f mp4 -y "$PART"
}

size_mb() { awk -v b="$(wc -c < "$PART")" 'BEGIN{printf "%.2f", b/1048576}'; }
over() { awk -v s="$1" -v a="$ALVO" 'BEGIN{exit !(s>a)}'; }

K=$(vk "$ALVO")
encode "$K"
S=$(size_mb); TRIES=1
if over "$S"; then
  K=$(awk -v k="$K" 'BEGIN{print int(k*0.92)}')
  encode "$K"; S=$(size_mb); TRIES=2
fi

STATUS=PASS
if over "$S"; then STATUS=FAIL; fi
ODIM=$(ffprobe -v quiet -show_entries stream=height,width -select_streams v:0 -of csv=s=x:p=0 "$PART")
OW=${ODIM%x*}; OH=${ODIM#*x}
OLEN=$(ffprobe -v quiet -show_entries format=duration -of default=nw=1:nk=1 "$PART")
OA=$(ffprobe -v quiet -select_streams a -show_entries stream=codec_type -of csv=p=0 "$PART" | head -n 1)
awk -v a="$LEN" -v b="$OLEN" 'BEGIN{d=a-b; if(d<0)d=-d; exit !(d<=0.2)}' || STATUS=FAIL
if [ -n "$HAS_A" ] && [ -z "$OA" ]; then STATUS=FAIL; fi
if [ "$STATUS" = PASS ]; then
  chmod 644 "$PART"
  # o destino pode ter surgido durante a codificação
  if [ "$FORCE" -ne 1 ] && { [ -e "$OUT" ] || [ -L "$OUT" ]; }; then echo "destino já existe (use --force): $OUT" >&2; exit 2; fi
  mv -f -- "$PART" "$OUT"
fi
OUTJ=$(printf '%s' "$OUT" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf '{"status":"%s","out":"%s","sizeMB":%s,"targetMB":%s,"videoKbps":%s,"audioKbps":%s,"width":%s,"height":%s,"durationSec":%s,"passes":2,"attempts":%s}\n' \
  "$STATUS" "$OUTJ" "$S" "$ALVO" "$K" "$AK" "$OW" "$OH" "$LEN" "$TRIES"
[ "$STATUS" = PASS ]
