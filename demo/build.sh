#!/bin/bash
# Builds public/demo/reel.mp4 (the home-page loop) from demo/reel.txt and demo/clips/.
# Usage:  ./demo/build.sh            → rebuilds the reel
#         ./demo/build.sh sheet      → also rebuilds demo/contact-sheet.png (frames from every clip)
set -e
cd "$(dirname "$0")"
FF=$(command -v ffmpeg || echo ../stitcher/node_modules/ffmpeg-static/ffmpeg)
FP=$(command -v ffprobe || echo ../stitcher/node_modules/ffprobe-static/bin/*/*/ffprobe)
FONT=${FONT_FILE:-$(ls /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf /System/Library/Fonts/Supplemental/Arial\ Bold.ttf /Library/Fonts/Arial\ Bold.ttf 2>/dev/null | head -1)}
[ -f "$FONT" ] || { echo "No font found; set FONT_FILE=/path/to/a.ttf"; exit 1; }
W=/tmp/churpie-demo; rm -rf $W; mkdir -p $W

# The look. "social" makes polished stock footage read like real front-camera video:
# one shared warm grade so every clip matches, a little less contrast and saturation, light grain.
# "clean" leaves the footage as shot. Run with:  LOOK=clean ./demo/build.sh
LOOK=${LOOK:-social}
if [ "$LOOK" = "social" ]; then
  GRADE="eq=contrast=0.93:saturation=0.88:brightness=0.015:gamma=1.03,colorbalance=rs=0.035:gs=0.01:bs=-0.035:rm=0.025:bm=-0.02:rh=0.02:bh=-0.02,noise=alls=6:allf=t+u,unsharp=3:3:0.25"
else
  GRADE="null"
fi

if [ "$1" = "sheet" ]; then
  for c in clips/clip-*.mp4; do b=$(basename $c .mp4); for t in 1 3 5; do "$FF" -nostdin -y -loglevel error -ss $t -i "$c" -frames:v 1 -vf "scale=220:220:force_original_aspect_ratio=decrease,pad=220:220:(ow-iw)/2:(oh-ih)/2:color=0x222222,drawtext=fontfile='$FONT':text='$b @${t}s':fontsize=14:fontcolor=white:box=1:boxcolor=black@0.6:x=6:y=6" $W/s-$b-$t.png 2>/dev/null || cp $W/s-$b-1.png $W/s-$b-$t.png; done; done
  "$FF" -nostdin -y -loglevel error -pattern_type glob -i "$W/s-*.png" -filter_complex "tile=3x$(ls clips/clip-*.mp4 | wc -l | tr -d ' '):padding=6:color=0x222222" contact-sheet.png && echo "wrote demo/contact-sheet.png"
fi

n=0; : > $W/list.txt
grep -v '^\s*#' reel.txt | grep '|' | while IFS='|' read -r clip start len fit name place; do
  clip=$(echo $clip | xargs); start=$(echo $start | xargs); len=$(echo $len | xargs); fit=$(echo $fit | xargs); name=$(echo "$name" | xargs); place=$(echo "$place" | xargs)
  n=$((n+1))
  if [ "$fit" = "crop" ]; then vf="scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280"
  else vf="split=2[fg][bg];[bg]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,gblur=sigma=24[b];[fg]scale=720:1280:force_original_aspect_ratio=decrease[f];[b][f]overlay=(W-w)/2:(H-h)/2"; fi
  st="drawtext=fontfile='$FONT':text='$name':fontsize=40:fontcolor=0x1A1410:x=40:y=120:box=1:boxcolor=0xFFFFFF:boxborderw=16"
  [ -n "$place" ] && st="$st,drawtext=fontfile='$FONT':text='$place':fontsize=24:fontcolor=0x1A1410:x=44:y=200:box=1:boxcolor=0x7ECDD5:boxborderw=10"
  "$FF" -nostdin -y -loglevel error -ss "$start" -t "$len" -i "clips/$clip.mp4" -filter_complex "[0:v]$vf,$GRADE,$st,fps=30,format=yuv420p[v]" -map "[v]" -an -c:v libx264 -preset veryfast -crf 20 $W/p$n.mp4
  echo "file '$W/p$n.mp4'" >> $W/list.txt
  echo "  $n. $clip  $name"
done
"$FF" -nostdin -y -loglevel error -f concat -safe 0 -i $W/list.txt -c copy $W/full.mp4
mkdir -p ../public/demo
"$FF" -nostdin -y -loglevel error -i $W/full.mp4 -vf scale=540:960 -c:v libx264 -preset slow -crf 27 -movflags +faststart -an ../public/demo/reel.mp4
echo "wrote public/demo/reel.mp4  ($("$FP" -v error -show_entries format=duration -of csv=p=0 ../public/demo/reel.mp4 | cut -c1-4)s, $(du -h ../public/demo/reel.mp4 | cut -f1))"
echo "now:  npx wrangler deploy"
