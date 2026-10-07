#!/bin/bash
# usage: gv.sh '<grip json array>' out.png  -> front closeup, front wide, side, back
g="$1"; out="$2"
node shot.mjs "http://localhost:8765/?a=118&grip=$g" /tmp/q0.png 3000 1400 900 >/dev/null
node shot.mjs "http://localhost:8765/?a=118&rx=0&ry=1.2&grip=$g" /tmp/q1.png 3000 700 450 >/dev/null
node shot.mjs "http://localhost:8765/?a=118&rx=0&ry=3.14&grip=$g" /tmp/q2.png 3000 700 450 >/dev/null
node shot.mjs "http://localhost:8765/?a=118&rx=1.45&ry=0&grip=$g" /tmp/q3.png 3000 700 450 >/dev/null
python3 -c "
from PIL import Image
im=Image.new('RGB',(1300,900))
im.paste(Image.open('/tmp/q0.png').crop((650,200,1250,900)),(0,0))
for i in range(1,4): im.paste(Image.open(f'/tmp/q{i}.png').resize((700,300)),(600,(i-1)*300))
im.save('$out')"
