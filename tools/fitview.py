from PIL import Image
im=Image.new('RGB',(1920,960))
for i in range(6): im.paste(Image.open(f'/tmp/g{i}.png'),((i%3)*640,(i//3)*480))
im.save('shots/grip.png')
