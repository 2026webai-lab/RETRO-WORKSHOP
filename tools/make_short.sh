#!/usr/bin/env bash
# 告知用ショート動画（縦/横）を作る。要: python3 -m http.server 8765 を起動済み、playwright(Node)、ffmpeg
# 縦: bash tools/make_short.sh v 1080 1920 12   横: bash tools/make_short.sh h 1920 1080 12
set -euo pipefail
N="$1"; W="$2"; H="$3"; S="${4:-12}"
node tools/capture.js "$N" "$W" "$H" 1 "$S"
mkdir -p out
ffmpeg -v error -y -framerate 30 -i "out/frames_$N/f_%04d.jpg" -vf "fade=in:0:15,fade=out:st=$(python3 -c "print($S-0.7)"):d=0.7" -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart "out/short-$N.mp4"
echo "出力: out/short-$N.mp4"
