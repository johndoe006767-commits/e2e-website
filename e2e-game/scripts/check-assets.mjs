import sharp from 'sharp';
import {readdir,writeFile} from 'node:fs/promises';
const files=(await readdir('public/assets/organs')).filter(f=>f.endsWith('.png'));
const tiles=[];
for(let i=0;i<files.length;i++){let input='public/assets/organs/'+files[i];const m=await sharp(input).metadata();console.log(files[i],m.width,m.height,m.hasAlpha);const thumb=await sharp(input).resize(160,150,{fit:'inside'}).toBuffer();tiles.push({input:thumb,left:(i%5)*200+20,top:Math.floor(i/5)*200+10});const label=Buffer.from(`<svg width="200" height="30"><text x="100" y="20" text-anchor="middle" fill="white" font-family="sans-serif" font-size="14">${files[i]}</text></svg>`);tiles.push({input:label,left:(i%5)*200,top:Math.floor(i/5)*200+163});}
await sharp({create:{width:1000,height:Math.ceil(files.length/5)*200,channels:4,background:'#632671'}}).composite(tiles).png().toFile('docs/contact-sheet.png');
