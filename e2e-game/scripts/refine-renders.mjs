import {chromium} from 'playwright';
import sharp from 'sharp';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
await page.goto('http://127.0.0.1:5173/');
const renders=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js');
 const {createAnatomyMesh}=await import('/src/anatomy-meshes.ts');
 const out={};
 for(const id of ['deltoid','forearm','tibialis','adductors','masseter']){
  const r=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});r.setSize(400,500);r.outputColorSpace=T.SRGBColorSpace;
  const s=new T.Scene(),m=createAnatomyMesh(id);s.add(m);
  const box=new T.Box3().setFromObject(m),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());m.position.sub(center);
  const h=Math.max(size.y,size.x/0.8)*1.18,c=new T.OrthographicCamera(-h*.4,h*.4,h*.5,-h*.5,.01,20);c.position.z=5;
  s.add(new T.HemisphereLight(0xfff0e5,0x664568,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(-2,3,5);s.add(light);
  r.render(s,c);out[id]=r.domElement.toDataURL();r.dispose();
 }
 return out;
});
for(const [id,uri] of Object.entries(renders))await sharp(Buffer.from(uri.split(',')[1],'base64')).trim().webp({quality:90}).toFile(`public/assets/organs/${id}.webp`);
await page.reload();await page.waitForSelector('[data-scene-ready="true"]');
const body=page.getByTestId('body');await body.focus();
for(let i=0;i<8;i++){
 await body.screenshot({path:`docs/skeleton-${i*45}.png`});
 const b=await body.boundingBox();await page.mouse.move(b.x+b.width*.35,b.y+b.height*.7);await page.mouse.down();await page.mouse.move(b.x+b.width*.475,b.y+b.height*.7,{steps:5});await page.mouse.up();
}
await body.evaluate(e=>e.blur());await page.screenshot({path:'docs/refined-game.png',fullPage:true});
await browser.close();
