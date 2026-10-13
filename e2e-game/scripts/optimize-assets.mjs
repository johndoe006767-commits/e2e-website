// Technical processing only: trim transparent borders and downsample sprites, preserving alpha.
import sharp from 'sharp';
import {readdir,writeFile} from 'node:fs/promises';
for(const file of (await readdir('public/assets/organs')).filter(f=>f.endsWith('.png')&&f!=='skeleton.png')){
 const path='public/assets/organs/'+file;
 const data=await sharp(path).trim({threshold:1}).resize(512,512,{fit:'inside',withoutEnlargement:true}).png({compressionLevel:9}).toBuffer();await writeFile(path,data);
}
