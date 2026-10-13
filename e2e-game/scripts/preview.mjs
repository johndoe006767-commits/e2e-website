import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
await page.goto('http://127.0.0.1:5173/');
await page.getByRole('button',{name:'Start game',exact:true}).waitFor();
await page.screenshot({path:'docs/start.png',fullPage:true});
await page.getByRole('button',{name:'Start game',exact:true}).click();
await page.screenshot({path:'docs/game.png',fullPage:true});
await browser.close();
