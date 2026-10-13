import {chromium} from 'playwright';
const b=await chromium.launch({channel:'chrome',headless:true});const page=await b.newPage({viewport:{width:1440,height:1000}});await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Finish game',exact:true}).click();const started=Date.now();
await page.waitForFunction(()=>document.querySelector('[data-testid="body"]').dataset.pose==='victory');await page.screenshot({path:'docs/nose-fixed.png'});
async function ink(){return page.locator('.celebration-particles').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=4)if(d[i])return true;return false})}
await page.waitForTimeout(Math.max(0,24000-(Date.now()-started)));console.log('Confetti at 24s:',await ink());
await page.waitForTimeout(2500);console.log('Confetti after 25s:',await ink());await b.close();
