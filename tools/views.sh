#!/bin/bash
# usage: views.sh "<query-without-ry/rx>" out.png  -> 2x2 composite of yaw 0, 90, 180, -90 (+ top)
q="$1"; out="$2"; i=0
for ry in 0 1.57 3.14 -1.57; do node shot.mjs "http://localhost:8765/?$q&rx=0.0&ry=$ry" /tmp/v_$i.png ${WAIT:-2200} 560 420 >/dev/null; i=$((i+1)); done
python3 -c "
from PIL import Image, ImageDraw
im=Image.new('RGB',(1120,840))
for i in range(4):
  a=Image.open(f'/tmp/v_{i}.png'); ImageDraw.Draw(a).text((10,60),['yaw0','yaw90','yaw180','yaw-90'][i],fill=(255,0,0)); im.paste(a,((i%2)*560,(i//2)*420))
im.save('$out')"
