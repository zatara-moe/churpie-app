#!/bin/bash
# churpie · builds public/demo/sample.mp4, the "Watch a sample reel" on the home page:
# a title card, the demo reel (public/demo/reel.mp4, made by build.sh), an end card, and churpie's own music.
# Run after build.sh:  ./demo/sample.sh   (needs ffmpeg)
set -e
cd "$(dirname "$0")/.."
FF=$(command -v ffmpeg || echo stitcher/node_modules/ffmpeg-static/ffmpeg)
pick() { for f in "$@"; do [ -f "$f" ] && { echo "$f"; return; }; done; }
SERIF=$(pick /usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf /System/Library/Fonts/Supplemental/Georgia.ttf /Library/Fonts/Georgia.ttf)
MONO=$(pick /usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf /System/Library/Fonts/Supplemental/Courier\ New.ttf /System/Library/Fonts/Menlo.ttc)
W=$(mktemp -d)
printf "What's your favorite\nmemory with Rosa?" > $W/q.txt; printf "38 people\nshowed up\nfor Rosa." > $W/e.txt; printf "SO THEY KNOW THEY’RE LOVED" > $W/t.txt
"$FF" -v error -y -f lavfi -i "color=c=0xF5F0E8:s=540x960:d=2.8:r=30" -vf "drawbox=x=0:y=0:w=540:h=10:color=0xD4266A:t=fill,drawtext=fontfile='$MONO':text='A CARD FOR':fontsize=18:fontcolor=0x4A3F30:x=56:y=250,drawtext=fontfile='$SERIF':text='Rosa':fontsize=96:fontcolor=0x1A1410:x=50:y=280,drawtext=fontfile='$SERIF':text='happy 60th':fontsize=34:fontcolor=0xD4266A:x=56:y=400,drawtext=fontfile='$MONO':text='MARIA ASKS':fontsize=16:fontcolor=0x4A3F30:x=56:y=520,drawtext=fontfile='$SERIF':textfile=$W/q.txt:fontsize=36:line_spacing=12:fontcolor=0x1A1410:x=56:y=552,fade=t=in:st=0:d=0.4,format=yuv420p" -c:v libx264 -preset veryfast -crf 20 $W/title.mp4
"$FF" -v error -y -f lavfi -i "color=c=0xF5F0E8:s=540x960:d=3.4:r=30" -vf "drawtext=fontfile='$SERIF':textfile=$W/e.txt:fontsize=54:line_spacing=14:fontcolor=0x1A1410:x=56:y=320,drawtext=fontfile='$SERIF':text='churpie.':fontsize=34:fontcolor=0xD4266A:x=56:y=640,drawtext=fontfile='$MONO':textfile=$W/t.txt:fontsize=15:fontcolor=0x4A3F30:x=58:y=690,fade=t=out:st=2.6:d=0.8,format=yuv420p" -c:v libx264 -preset veryfast -crf 20 $W/end.mp4
"$FF" -v error -y -i public/demo/reel.mp4 -vf "scale=540:960,fps=30,format=yuv420p" -c:v libx264 -preset veryfast -crf 20 $W/mid.mp4
"$FF" -v error -y -i $W/title.mp4 -i $W/mid.mp4 -i $W/end.mp4 -filter_complex "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]" -map "[v]" -c:v libx264 -preset veryfast -crf 20 $W/all.mp4
D=$("${FF%ffmpeg}ffprobe" -v error -show_entries format=duration -of csv=p=0 $W/all.mp4 2>/dev/null || echo 20.2)
OUT=$(awk "BEGIN{print $D-1.8}")
"$FF" -v error -y -i $W/all.mp4 -i stitcher/music/celebration-churpie.mp3 -filter_complex "[1:a]atrim=0:$D,asetpts=N/SR/TB,afade=t=in:st=0:d=0.5,afade=t=out:st=$OUT:d=1.8,volume=0.85[a]" -map 0:v -map "[a]" -c:v libx264 -preset slow -crf 26 -c:a aac -b:a 96k -movflags +faststart -shortest public/demo/sample.mp4
rm -rf $W
echo "made public/demo/sample.mp4"
