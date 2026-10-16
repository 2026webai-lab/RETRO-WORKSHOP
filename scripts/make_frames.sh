#!/usr/bin/env bash
# 動画 → WebP連番（public/frames/frame_001.webp …）
# 使い方: bash scripts/make_frames.sh source/my-video.mp4 [枚数=96] [開始秒=0] [終了秒=動画の長さ] [幅=1280]
set -euo pipefail
IN="${1:?動画ファイルを指定してください}"; N="${2:-96}"; SS="${3:-0}"; WIDTH="${5:-1280}"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
TO="${4:-$DUR}"
LEN=$(python3 -c "print(max(0.1,$TO-$SS))")
FPS=$(python3 -c "print($N/$LEN)")
OUT=public/frames; mkdir -p "$OUT"; rm -f "$OUT"/frame_*.webp
ffmpeg -v error -y -ss "$SS" -t "$LEN" -i "$IN" -vf "fps=$FPS,scale=$WIDTH:-2" -frames:v "$N" -c:v libwebp -quality 72 -compression_level 6 "$OUT/frame_%03d.webp"
CNT=$(ls "$OUT" | wc -l); echo "出力: $CNT 枚 / 合計 $(du -sh $OUT | cut -f1)"
[ "$CNT" -lt 100 ] || echo "注意: 100枚以上です。GitHubのブラウザ・アップロードは1回100ファイル未満です。"
