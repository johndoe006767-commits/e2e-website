import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import {writeFile} from 'node:fs/promises';
const chrome=await chromeLauncher.launch({chromeFlags:['--headless','--no-sandbox']});
try{const r=await lighthouse('http://127.0.0.1:4173',{port:chrome.port,output:'json',onlyCategories:['performance','accessibility','best-practices'],formFactor:'desktop',throttling:{rttMs:40,throughputKbps:10240,cpuSlowdownMultiplier:1,requestLatencyMs:0,downloadThroughputKbps:0,uploadThroughputKbps:0},screenEmulation:{mobile:false,width:1440,height:1000,deviceScaleFactor:1,disabled:false}});await writeFile('docs/lighthouse.json',r.report);console.log(JSON.stringify({scores:Object.fromEntries(Object.entries(r.lhr.categories).map(([k,v])=>[k,v.score])),failures:Object.values(r.lhr.audits).filter(a=>a.score!==null&&a.score<.9).map(a=>({id:a.id,title:a.title,displayValue:a.displayValue,details:a.details}))},null,2));}finally{await chrome.kill()}
