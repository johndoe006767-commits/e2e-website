import {chromium} from 'playwright';
import {ORGANS,placementSide} from '../src/game.ts';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Start game',exact:true}).click();
const body=page.getByTestId('body');
console.log('Fullscreen on start:',await page.evaluate(()=>!!document.fullscreenElement));
async function rotate(fraction){const b=await body.boundingBox();await page.mouse.move(b.x+b.width*.2,b.y+b.height*.7);await page.mouse.down();await page.mouse.move(b.x+b.width*(.2+fraction),b.y+b.height*.7,{steps:8});await page.mouse.up();}
for(const id of ['brain','tongue',...ORGANS.filter(o=>!['brain','tongue'].includes(o.id)).map(o=>o.id)]){
 const yaw=Number(await body.getAttribute('data-yaw'));if(Math.cos(yaw)*(placementSide(id)==='front'?1:-1)<.2)await rotate(.5);
 await page.locator(`[data-organ="${id}"]`).click();await page.locator(`[data-checkpoint="${id}"]`).click({force:true});
 if(id==='tongue'){await page.waitForTimeout(900);await body.screenshot({path:'docs/head-reveal-mobile.png'});}
}
await page.locator('.result-layer').waitFor();await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(1900);await page.screenshot({path:'docs/celebration-mobile-thumbs.png',fullPage:true});
await page.waitForTimeout(2900);await page.screenshot({path:'docs/celebration-mobile.png',fullPage:true});
console.log(await body.getAttribute('data-pose'));await browser.close();
