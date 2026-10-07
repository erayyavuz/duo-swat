#!/bin/bash
Q="$1"; out="$2"
node shot.mjs "http://localhost:8765/?$Q&rx=1.5&ry=0" /tmp/t1.png 2200 640 480 >/dev/null
node shot.mjs "http://localhost:8765/?$Q&rx=0&ry=0" /tmp/t2.png 2200 640 480 >/dev/null
node shot.mjs "http://localhost:8765/?$Q&rx=0&ry=3.14" /tmp/t3.png 2200 640 480 >/dev/null
node shot.mjs "http://localhost:8765/?$Q&rx=0.15&ry=0.4" /tmp/t4.png 2200 640 480 >/dev/null
python3 -c "
from PIL import Image
im=Image.new('RGB',(1280,960))
for i in range(4): im.paste(Image.open(f'/tmp/t{i+1}.png'),((i%2)*640,(i//2)*480))
im.save('$out')"
