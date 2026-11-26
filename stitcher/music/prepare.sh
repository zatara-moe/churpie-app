#!/bin/bash
# churpie · get a downloaded track ready to sit under voices in a reel.
#   ./stitcher/music/prepare.sh "~/Downloads/some track.mp3" holiday-1
# Makes stitcher/music/holiday-1.mp3 that stays at one steady level from start to finish:
#   1. trims silence off the start and end
#   2. rides the volume slowly (about a 15-second window) so quiet intros come up and big builds come down;
#      a track that starts with one piano and ends with a full band ends up the same loudness throughout
#   3. a gentle compressor catches what's left (a loud chord, a cymbal)
#   4. sets the whole thing to -18 LUFS (the level the reel maker expects) with peaks kept under -2 dB
#   5. 48 kHz stereo 128 kbps, first and last half second softened so it loops without a click
# Then add a line for it to stitcher/music/LICENSES.md (where it came from, its license, the date you downloaded it).
set -e
[ -f "$1" ] && [ -n "$2" ] || { echo "usage: prepare.sh <downloaded file> <name, like holiday-1>"; exit 1; }
SRC=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
cd "$(dirname "$0")"
FF=$(command -v ffmpeg || echo ../node_modules/ffmpeg-static/ffmpeg)
FP=$(command -v ffprobe || echo "${FF%ffmpeg}ffprobe")
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

LEVEL="silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.1,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.3,areverse"
LEVEL="$LEVEL,dynaudnorm=f=750:g=21:p=0.7:m=12:r=0.25:s=0,acompressor=threshold=-26dB:ratio=3:attack=40:release=600:makeup=1"
"$FF" -v error -y -i "$SRC" -af "$LEVEL,aresample=48000" -ac 2 -c:a pcm_s16le "$TMP/a.wav"

I=$("$FF" -hide_banner -nostats -i "$TMP/a.wav" -af ebur128 -f null - 2>&1 | sed -n '/Summary/,$p' | awk '/ I:/{print $2; exit}')
GAIN=$(awk "BEGIN{print -18 - ($I)}")
D=$("$FP" -v error -show_entries format=duration -of csv=p=0 "$TMP/a.wav")
OUT=$(awk "BEGIN{print $D-0.5}")
"$FF" -v error -y -i "$TMP/a.wav" -af "volume=${GAIN}dB,alimiter=limit=0.79:attack=5:release=80:level=0,afade=t=in:st=0:d=0.5,afade=t=out:st=$OUT:d=0.5" -ac 2 -ar 48000 -b:a 128k "$2.mp3"

S=$("$FF" -hide_banner -nostats -i "$2.mp3" -af ebur128 -f null - 2>&1 | sed -n '/Summary/,$p')
printf "made stitcher/music/%s.mp3 (%.0f s)  loudness %s LUFS  range %s LU\n" "$2" "$D" "$(echo "$S" | awk '/ I:/{print $2; exit}')" "$(echo "$S" | awk '/LRA:/{print $2; exit}')"
