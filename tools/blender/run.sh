#!/bin/bash
# usage: run.sh params.json [export.glb]
rm -rf /tmp/ph; blender -b -P pose_hand2.py -- "$1" /tmp/ph $2 2>&1 | grep -E "rror|ARM WORLD|EXPORTED" -A3 | head -8
python3 -c "
from PIL import Image
im=Image.new('RGB',(2100,1120))
for i,k in enumerate(['front','front3q','back','side','top']): im.paste(Image.open(f'/tmp/ph/{k}.png'),((i%3)*700,(i//3)*560))
im.save('/tmp/ph/all.png')"
