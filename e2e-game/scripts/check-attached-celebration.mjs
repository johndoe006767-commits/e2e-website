import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Finish game',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('[data-testid="body"]').dataset.pose==='thumbs-up');const t=Date.now();await page.screenshot({path:'docs/attached-thumbs.png'});
await page.waitForFunction(()=>document.querySelector('[data-testid="body"]').dataset.pose==='transition');console.log('Thumbs-up hold, ms:',Date.now()-t);
await page.waitForFunction(()=>document.querySelector('[data-testid="body"]').dataset.pose==='victory');await page.screenshot({path:'docs/attached-victory.png'});console.log(await page.getByTestId('body').evaluate(e=>e.dataset));await browser.close();
