from pathlib import Path
import json,pymupdf as fitz
from PIL import Image,ImageDraw
stats={}
for path in Path('output/pdf').glob('*.pdf'):
 doc=fitz.open(path); text='\n'.join(p.get_text() for p in doc)
 bounds=[]
 for i,p in enumerate(doc):
  for b in p.get_text('blocks'):
   if b[0]<-1 or b[1]<-1 or b[2]>p.rect.width+1 or b[3]>p.rect.height+1: bounds.append(i+1)
 assert not bounds,(path,bounds)
 assert '\ufffd' not in text
 stats[path.name]={'pages':len(doc),'characters':len(text),'images':sum(len(p.get_images()) for p in doc),'textWithinPage':True,'toolsPresent':'工具调用' in text}
for prefix in ['thinking','answer']:
 files=sorted(Path('tmp/pdf-render').glob(prefix+'-[0-9]*.png'))
 if not files: continue
 tiles=[]
 for p in files:
  im=Image.open(p).convert('RGB'); im.thumbnail((240,340)); tile=Image.new('RGB',(260,370),'#e6eaf0'); tile.paste(im,((260-im.width)//2,5)); ImageDraw.Draw(tile).text((10,350),p.stem,fill='black'); tiles.append(tile)
 sheet=Image.new('RGB',(260*4,370*((len(tiles)+3)//4)),'#e6eaf0')
 for i,im in enumerate(tiles): sheet.paste(im,((i%4)*260,(i//4)*370))
 sheet.save('tmp/pdf-render/'+prefix+'-contact.png')
Path('output/pdf-results.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(stats,ensure_ascii=False))
