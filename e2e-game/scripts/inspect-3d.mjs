import {chromium} from 'playwright';
const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:1440,height:1000}});
p.on('pageerror',e=>console.log('ERROR',e.message));p.on('requestfailed',r=>console.log('FAILED',r.url(),r.failure()));
await p.goto('http://127.0.0.1:5173/');await p.waitForTimeout(8000);console.log(await p.locator('body').innerText());console.log(await p.locator('[data-testid="body"]').evaluate(e=>e.dataset));await p.screenshot({path:'docs/3d-ready.png',fullPage:true});await b.close();
