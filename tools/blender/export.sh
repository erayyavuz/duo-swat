#!/bin/bash
# export grip.json -> game asset, then browser close-ups (front game view + 3/4)
rm -rf /tmp/ph2 && blender -b -P pose_hand2.py -- ${1:-grip.json} /tmp/ph2 ~/Documents/duo-fly/assets/hand-posed.glb 2>&1 | grep -E "EXPORTED|rror"
cd .. && node shot.mjs "http://localhost:8765/?a=118" /tmp/c1.png 4500 2000 1250 >/dev/null
python3 -c "
from PIL import Image
im=Image.new('RGB',(1500,700),'white')
im.paste(Image.open('/tmp/c1.png').crop((700,620,1450,1250)).resize((750,630)),(0,0))
r=Image.open('/Users/era/Documents/duo-fly/tools/ref_grip.png') if __import__('os').path.exists('/Users/era/Documents/duo-fly/tools/ref_grip.png') else None
r and im.paste(r.resize((750,int(750*r.size[1]/r.size[0]))).crop((0,0,750,700)),(750,0))
im.save('/tmp/cmp.png')"
