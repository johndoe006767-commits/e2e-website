import {chromium} from 'playwright';
import {ORGANS,placementSide} from '../src/game.ts';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Start game',exact:true}).click();
const body=page.getByTestId('body');
console.log('Fullscreen on start:',await page.evaluate(()=>!!document.fullscreenElement));
async function rotate(fraction){const b=await body.boundingBox();await page.mouse.move(b.x+b.width*.2,b.y+b.height*.7);await page.mouse.down();await page.mouse.move(b.x+b.width*(.2+fraction),b.y+b.height*.7,{steps:8});await page.mouse.up();}
for(const id of ['lungs',...ORGANS.filter(o=>o.id!=='lungs').map(o=>o.id)]){
 const yaw=Number(await body.getAttribute('data-yaw'));if(Math.cos(yaw)*(placementSide(id)==='front'?1:-1)<.2)await rotate(.5);
 await page.locator(`[data-organ="${id}"]`).click();const b=await page.locator(`[data-checkpoint="${id}"]`).boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
 if(id==='lungs'){await page.waitForTimeout(900);await body.screenshot({path:'docs/lungs-inside-ribs.png'});}
}
await page.locator('.result-layer').evaluate(e=>e.style.display='none');await page.waitForTimeout(900);
await body.screenshot({path:'docs/anatomy-depth.png'});
await browser.close();
