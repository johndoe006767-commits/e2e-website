import sharp from 'sharp';
import {readdir} from 'node:fs/promises';
for(const file of (await readdir('public/assets/organs')).filter(f=>f.endsWith('.png'))){const skeleton=file==='skeleton.png';await sharp('public/assets/organs/'+file).resize(skeleton?456:240,skeleton?1200:240,{fit:'inside',withoutEnlargement:true}).webp({quality:skeleton?90:85,alphaQuality:100}).toFile('public/assets/organs/'+file.replace('.png','.webp'));}
await sharp('public/assets/purple-atmosphere.png').resize(1600).webp({quality:80}).toFile('public/assets/purple-atmosphere.webp');
