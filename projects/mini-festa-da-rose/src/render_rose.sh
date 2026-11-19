#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 src/create_rose_assets.py
mkdir -p out/previews out/final

FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
BOLD=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
A=src/generated
P=out/previews
V='-c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -r 30 -an'
MOTION="scale=1200:2134,crop=1080:1920:60:107,zoompan=z='min(zoom+0.00025,1.045)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1080x1920:fps=30,format=yuv420p"

ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 30 -i "$A/intro.svg" -t 1.8 \
  -vf "scale=1080:1920,drawtext=fontfile=$BOLD:textfile=$A/name1.txt:fontcolor=0x173C5B:fontsize=102:x=(w-text_w)/2:y=675:enable='gte(t,0.25)',drawtext=fontfile=$FONT:textfile=$A/name2.txt:fontcolor=0xF38FA8:fontsize=86:x=(w-text_w)/2:y=810:enable='gte(t,0.48)'" \
  $V "$P/segment-0.mp4"

ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 30 -i public/screenshots/festa-infantil-ilustrativa.png -t 3.2 \
  -vf "$MOTION,drawbox=x=58:y=135:w=964:h=280:color=0xFFF9F6@0.82:t=fill,drawtext=fontfile=$BOLD:textfile=$A/tagline.txt:fontcolor=0x173C5B:fontsize=65:x=(w-text_w)/2:y=190:enable='gte(t,0.35)',drawtext=fontfile=$FONT:textfile=$A/tagline2.txt:fontcolor=0x173C5B:fontsize=63:x=(w-text_w)/2:y=282:enable='gte(t,0.8)'" \
  $V "$P/segment-1.mp4"

ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 30 -i public/screenshots/cha-bebe-ilustrativo.png \
  -loop 1 -framerate 30 -i references/mascote-estudo.png -t 2.8 \
  -filter_complex "[0:v]$MOTION,drawbox=x=35:y=1140:w=1010:h=455:color=0xFFF9F6@0.78:t=fill[bg];[1:v]scale=690:-1,format=rgba[masc];[bg][masc]overlay=x=415:y=295:shortest=1,drawtext=fontfile=$BOLD:textfile=$A/services1.txt:fontcolor=0x173C5B:fontsize=45:x=(w-text_w)/2:y=1230:enable='gte(t,0.45)',drawtext=fontfile=$FONT:textfile=$A/services2.txt:fontcolor=0x173C5B:fontsize=39:x=(w-text_w)/2:y=1330:enable='gte(t,1.25)'[v]" \
  -map '[v]' $V "$P/segment-2.mp4"

ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 30 -i public/screenshots/festa-infantil-ilustrativa.png -t 1.6 \
  -vf "$MOTION,drawbox=x=65:y=135:w=950:h=140:color=0xFFF9F6@0.84:t=fill,drawtext=fontfile=$BOLD:textfile=$A/kind1.txt:fontcolor=0x173C5B:fontsize=54:x=(w-text_w)/2:y=175" \
  $V "$P/segment-3.mp4"

ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 30 -i public/screenshots/cha-bebe-ilustrativo.png -t 1.6 \
  -vf "$MOTION,drawbox=x=65:y=135:w=950:h=140:color=0xFFF9F6@0.84:t=fill,drawtext=fontfile=$BOLD:textfile=$A/kind2.txt:fontcolor=0x173C5B:fontsize=54:x=(w-text_w)/2:y=175" \
  $V "$P/segment-4.mp4"

ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 30 -i public/screenshots/festa-adulta-ilustrativa.png -t 1.6 \
  -vf "$MOTION,drawbox=x=48:y=135:w=984:h=390:color=0xFFF9F6@0.86:t=fill,drawtext=fontfile=$BOLD:textfile=$A/kind3.txt:fontcolor=0x173C5B:fontsize=46:x=(w-text_w)/2:y=170,drawtext=fontfile=$BOLD:textfile=$A/promise1.txt:fontcolor=0xF38FA8:fontsize=62:x=(w-text_w)/2:y=300,drawtext=fontfile=$FONT:textfile=$A/promise2.txt:fontcolor=0x173C5B:fontsize=42:x=(w-text_w)/2:y=395" \
  $V "$P/segment-5.mp4"

ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 30 -i public/screenshots/festa-adulta-ilustrativa.png -t 3.1 \
  -vf "$MOTION,drawbox=x=50:y=1060:w=980:h=555:color=0xFFF9F6@0.90:t=fill,drawtext=fontfile=$BOLD:textfile=$A/cta1.txt:fontcolor=0x173C5B:fontsize=43:x=(w-text_w)/2:y=1125,drawtext=fontfile=$BOLD:textfile=$A/phone.txt:fontcolor=0x173C5B:fontsize=74:x=(w-text_w)/2:y=1240,drawtext=fontfile=$FONT:textfile=$A/handle.txt:fontcolor=0x173C5B:fontsize=54:x=(w-text_w)/2:y=1395" \
  $V "$P/segment-6.mp4"

ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 30 -i "$A/outro.svg" -t 0.7 \
  -vf "scale=1080:1920,drawtext=fontfile=$BOLD:textfile=$A/name1.txt:fontcolor=0x173C5B:fontsize=102:x=(w-text_w)/2:y=675,drawtext=fontfile=$FONT:textfile=$A/name2.txt:fontcolor=0xF38FA8:fontsize=86:x=(w-text_w)/2:y=810" \
  $V "$P/segment-7.mp4"

ffmpeg -hide_banner -loglevel error -y \
  -i "$P/segment-0.mp4" -i "$P/segment-1.mp4" -i "$P/segment-2.mp4" -i "$P/segment-3.mp4" \
  -i "$P/segment-4.mp4" -i "$P/segment-5.mp4" -i "$P/segment-6.mp4" -i "$P/segment-7.mp4" \
  -i "$A/trilha-preview.wav" \
  -filter_complex '[0:v][1:v]xfade=transition=circleopen:duration=0.2:offset=1.6[v1];[v1][2:v]xfade=transition=fade:duration=0.2:offset=4.6[v2];[v2][3:v]xfade=transition=circleopen:duration=0.2:offset=7.2[v3];[v3][4:v]xfade=transition=circleopen:duration=0.2:offset=8.6[v4];[v4][5:v]xfade=transition=circleopen:duration=0.2:offset=10.0[v5];[v5][6:v]xfade=transition=fade:duration=0.2:offset=11.4[v6];[v6][7:v]xfade=transition=fade:duration=0.2:offset=14.3,format=yuv420p[vout]' \
  -map '[vout]' -map 8:a -t 15 -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart \
  out/final/mini-festa-da-rose-preview.mp4

ffmpeg -hide_banner -loglevel error -y -ss 12.8 -i out/final/mini-festa-da-rose-preview.mp4 -frames:v 1 out/final/poster-preview.png

ffmpeg -hide_banner -loglevel error -y -i out/final/mini-festa-da-rose-preview.mp4 \
  -map 0:v:0 -map 0:a:0 -c:v copy -af volume=7dB -c:a aac -b:a 192k -t 15 -movflags +faststart \
  out/final/mini-festa-da-rose-vertical-15s.mp4
ffmpeg -hide_banner -loglevel error -y -ss 14.6 -i out/final/mini-festa-da-rose-vertical-15s.mp4 -frames:v 1 \
  out/final/capa-mini-festa-da-rose.png
