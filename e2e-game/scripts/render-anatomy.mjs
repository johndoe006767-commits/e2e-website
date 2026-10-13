import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage();
page.on('pageerror',e=>console.error(e));
await page.goto('http://127.0.0.1:5173/scripts/render-anatomy.html');
await page.waitForFunction(()=>window.done,{timeout:120000});
const {renders,bounds}=await page.evaluate(()=>({renders:window.renders,bounds:window.bounds}));
for(const [id,uri] of Object.entries(renders)){await writeFile(`public/assets/organs/${id}.png`,Buffer.from(uri.split(',')[1],'base64'));console.log('Rendered',id)}
await writeFile('scripts/model-bounds.json',JSON.stringify(bounds,null,2));
await browser.close();
