import {test,expect,type Page} from '@playwright/test';
import {ORGANS,pointsForMatch,placementSide} from '../src/game';
async function start(page:Page){await page.goto('/');await page.getByRole('button',{name:'Start game',exact:true}).click();}
async function face(page:Page,id:string){
 const body=page.getByTestId('body'),yaw=Number(await body.getAttribute('data-yaw'));
 if(Math.cos(yaw)*(placementSide(id)==='front'?1:-1)>.2)return;
 const b=(await body.boundingBox())!;await page.mouse.move(b.x+b.width*.25,b.y+b.height*.7);await page.mouse.down();await page.mouse.move(b.x+b.width*.75,b.y+b.height*.7,{steps:8});await page.mouse.up();
}
async function drop(page:Page,id:string,x:number,y:number){
 const organ=ORGANS.find(o=>o.id===id)!;const matching=x===organ.x&&y===organ.y;
 if(matching)await face(page,id);
 const source=(await page.locator(`[data-organ="${id}"]`).boundingBox())!,body=(await page.getByTestId('body').boundingBox())!;
 const marker=matching?(await page.locator(`[data-checkpoint="${id}"]`).boundingBox()):null;
 await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();
 await page.mouse.move(marker?marker.x+marker.width/2:body.x+body.width*x/100,marker?marker.y+marker.height/2:body.y+body.height*y/100,{steps:8});await page.mouse.up();
}
test('all 25 organs can be dragged into overlapping locations and win',async({page})=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);for(const organ of ORGANS){await drop(page,organ.id,organ.x,organ.y);await expect(page.locator(`[data-organ="${organ.id}"]`)).toBeDisabled();}await expect(page.getByText('All in place.')).toBeVisible();await expect(page.getByTestId('score')).toBeVisible();expect(errors).toEqual([]);await page.screenshot({path:'docs/win.png',fullPage:true});});
test('cancelled drags are free; errors deduct half a point without ending the game; restart resets',async({page})=>{
 await start(page);await drop(page,'brain',-100,60);await expect(page.getByTestId('score')).toHaveText('0 pts');
 for(let i=1;i<=6;i++){await drop(page,'brain',50,80);await expect(page.getByTestId('score')).toHaveText(`${-i*.5} pts`)}
 await expect(page.locator('[data-organ="brain"]')).toBeEnabled();
 await page.getByRole('button',{name:'Restart game',exact:true}).click();await page.getByRole('button',{name:'Restart',exact:true}).click();
 await expect(page.getByTestId('score')).toHaveText('0 pts');await expect(page.locator('.organ-piece:disabled')).toHaveCount(0);
});
test('three hints and tap placement do not block later placements',async({page})=>{await start(page);await page.locator('[data-organ="brain"]').click();await page.getByRole('button',{name:/Get a hint/}).click();await expect(page.getByText('A clue for brain')).toBeVisible();await page.getByRole('button',{name:/Get a hint/}).click();await page.getByRole('button',{name:/Get a hint/}).click();await expect(page.getByRole('button',{name:/Get a hint/})).toBeDisabled();await page.locator('[data-organ="brain"]').click();const r=await page.getByTestId('body').boundingBox();await page.mouse.click(r!.x+r!.width*.5,r!.y+r!.height*.069);await expect(page.locator('[data-organ="brain"]')).toBeDisabled();await drop(page,'eyes',50,9.1);await expect(page.locator('[data-organ="eyes"]')).toBeDisabled();});
test('unlimited duration and restart confirmation preserves match timing',async({page})=>{
 let now=Date.now();await page.clock.setFixedTime(now);await start(page);
 const advance=async(ms:number)=>{now+=ms;await page.clock.setFixedTime(now)};
 await advance(10000);await page.getByRole('button',{name:'Restart game',exact:true}).click();
 await advance(120000);await page.getByRole('button',{name:'Keep progress',exact:true}).click();
 await advance(300);await drop(page,'brain',50,6.9);await expect(page.getByTestId('score')).toHaveText('5 pts');
 await advance(1200000);await drop(page,'heart',51.6,24.5);await expect(page.getByTestId('score')).toHaveText('6 pts');
 await expect(page.locator('.stat.time,.stat.lives')).toHaveCount(0);
});
test('keyboard placement and restart cancel',async({page})=>{await start(page);await page.locator('[data-organ="brain"]').focus();await page.keyboard.press('Enter');await page.getByTestId('body').focus();for(let i=0;i<8;i++)await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');await expect(page.locator('[data-organ="brain"]')).toBeDisabled();await page.getByRole('button',{name:'Restart game'}).click();await page.getByRole('button',{name:'Keep progress'}).click();await expect(page.locator('[data-organ="brain"]')).toBeDisabled();});
test('mobile layout, touch selection, reduced motion and all assets',async({page})=>{await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce',colorScheme:'light'});await start(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await expect(page.locator('.organ-piece')).toHaveCount(25);const missing=await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!(i as HTMLImageElement).complete||!(i as HTMLImageElement).naturalWidth).length);expect(missing).toBe(0);await page.screenshot({path:'docs/mobile.png',fullPage:true});await page.emulateMedia({colorScheme:'dark'});await page.locator('[data-organ="heart"]').click();const r=await page.getByTestId('body').boundingBox();await page.mouse.click(r!.x+r!.width*.516,r!.y+r!.height*.245);await expect(page.locator('[data-organ="heart"]')).toBeDisabled();});
test('real touch drag retains capture across the body and cancellation is free',async({browser})=>{const context=await browser.newContext({baseURL:'http://127.0.0.1:5173',viewport:{width:768,height:1024},hasTouch:true,isMobile:true});const page=await context.newPage();await start(page);const cdp=await context.newCDPSession(page);const s=await page.locator('[data-organ="heart"]').boundingBox(),b=await page.getByTestId('body').boundingBox();const sx=s!.x+s!.width/2,sy=s!.y+s!.height/2,tx=b!.x+b!.width*.516,ty=b!.y+b!.height*.245;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx+(tx-sx)*i/8,y:sy+(ty-sy)*i/8}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.locator('[data-organ="heart"]')).toBeDisabled();await expect(page.getByTestId('score')).toBeVisible();const q=await page.locator('[data-organ="brain"]').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:q!.x+20,y:q!.y+20}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b!.x+30,y:b!.y+300}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect(page.getByTestId('score')).toBeVisible();await expect(page.locator('[data-organ="brain"]')).toBeEnabled();await context.close();});

async function checkpoint(page:Page,id:string){const r=await page.locator(`[data-checkpoint="${id}"]`).boundingBox();return {x:r!.x+r!.width/2,y:r!.y+r!.height/2}}
test('snap previews never score until release, and moving away detaches',async({page})=>{
 await start(page);const source=await page.locator('[data-organ="brain"]').boundingBox();const target=await checkpoint(page,'brain');
 await page.mouse.move(source!.x+source!.width/2,source!.y+source!.height/2);await page.mouse.down();await page.mouse.move(target.x+12,target.y,{steps:8});
 await expect(page.locator('.drag-ghost')).toHaveAttribute('data-snap-target','brain');await expect(page.locator('[data-organ="brain"]')).toBeEnabled();await expect(page.locator('.progress strong')).toHaveText('00 / 25');
 await page.mouse.move(target.x+90,target.y+130,{steps:4});await expect(page.locator('.drag-ghost')).toHaveAttribute('data-snap-target','');await expect(page.locator('[data-organ="brain"]')).toBeEnabled();
 await page.mouse.move(target.x+12,target.y,{steps:5});await page.mouse.up();await expect(page.locator('[data-organ="brain"]')).toBeDisabled();await expect(page.locator('[data-checkpoint="brain"]')).toBeHidden();await expect(page.getByTestId('score')).toBeVisible();
});
test('3D rotation is yaw-only, supports 360 degrees and projects checkpoints',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'Start game',exact:true})).toBeEnabled();await expect(page.locator('.start-layer')).toHaveCount(0);
 await expect(page.locator('.right-label')).toHaveText('L');await expect(page.locator('.left-label')).toHaveText('R');
 await page.getByRole('button',{name:'Start game',exact:true}).click();const body=page.getByTestId('body');const r=await body.boundingBox();await expect(page.locator('[data-checkpoint="triceps"]')).toBeHidden();await expect(page.locator('.orientation-label')).toHaveCount(0);
 await page.mouse.move(r!.x+r!.width*.25,r!.y+r!.height*.7);await page.mouse.down();await page.mouse.move(r!.x+r!.width*.75,r!.y+r!.height*.8,{steps:12});await page.mouse.up();
 expect(Number(await body.getAttribute('data-yaw'))).toBeCloseTo(Math.PI,1);await expect(body).toHaveAttribute('data-pitch','0');const back=await checkpoint(page,'triceps');await expect(page.locator('[data-checkpoint="biceps"]')).toBeHidden();await expect(body).toHaveAttribute('data-view','Back view');
 await page.screenshot({path:'docs/3d-back.png',fullPage:true});
 const source=await page.locator('[data-organ="triceps"]').boundingBox();await page.mouse.move(source!.x+source!.width/2,source!.y+source!.height/2);await page.mouse.down();await page.mouse.move(back.x,back.y,{steps:8});await page.mouse.up();await expect(page.locator('[data-organ="triceps"]')).toBeDisabled();
 await page.mouse.move(r!.x+r!.width*.25,r!.y+r!.height*.7);await page.mouse.down();await page.mouse.move(r!.x+r!.width*.75,r!.y+r!.height*.7,{steps:12});await page.mouse.up();expect(Number(await body.getAttribute('data-yaw'))).toBeCloseTo(Math.PI*2,1);
});
test('hover floats organs and reduced motion suppresses the loop',async({page})=>{
 await start(page);await page.locator('[data-organ="heart"]').hover();const img=page.locator('[data-organ="heart"] img');await expect(img).toHaveCSS('animation-name','organ-float');await page.emulateMedia({reducedMotion:'reduce'});await expect(img).toHaveCSS('animation-name','none');
});
test('leaving a snapped checkpoint before release does not place the organ',async({page})=>{
 await start(page);const s=await page.locator('[data-organ="heart"]').boundingBox(),t=await checkpoint(page,'heart'),b=await page.getByTestId('body').boundingBox();
 await page.mouse.move(s!.x+s!.width/2,s!.y+s!.height/2);await page.mouse.down();await page.mouse.move(t.x,t.y,{steps:6});await expect(page.locator('.drag-ghost')).toHaveAttribute('data-snap-target','heart');
 await page.mouse.move(b!.x+b!.width/2,b!.y+b!.height*.8,{steps:6});await expect(page.locator('.drag-ghost')).toHaveAttribute('data-snap-target','');await page.mouse.up();
 await expect(page.locator('[data-organ="heart"]')).toBeEnabled();await expect(page.getByTestId('score')).toHaveText('-0.5 pts');await expect(page.locator('.progress strong')).toHaveText('00 / 25');
});
test('all organ checkpoints remain playable after rotating to an oblique view',async({page})=>{
 await start(page);const b=await page.getByTestId('body').boundingBox();await page.mouse.move(b!.x+b!.width*.3,b!.y+b!.height*.7);await page.mouse.down();await page.mouse.move(b!.x+b!.width*.425,b!.y+b!.height*.7,{steps:5});await page.mouse.up();
 for(const o of ORGANS){await face(page,o.id);const s=await page.locator(`[data-organ="${o.id}"]`).boundingBox(),t=await checkpoint(page,o.id);await page.mouse.move(s!.x+s!.width/2,s!.y+s!.height/2);await page.mouse.down();await page.mouse.move(t.x,t.y,{steps:5});await page.mouse.up();await expect(page.locator(`[data-organ="${o.id}"]`)).toBeDisabled()}
 await expect(page.getByText('All in place.')).toBeVisible();await expect(page.getByTestId('score')).toBeVisible();
});

test('placement feedback colors, blank source slots, and muscle coverage',async({page})=>{
 await start(page);
 await expect(page.locator('[data-organ="diaphragm"], [data-organ="gallbladder"], [data-organ="masseter"]')).toHaveCount(0);
 await expect(page.locator('.organ-piece')).toHaveCount(25);
 await drop(page,'brain',50,80);
 await expect(page.locator('[data-feedback="error"]')).toBeVisible();
 await expect(page.locator('[data-feedback="error"] img')).toHaveCSS('animation-name','placement-shake');
 await expect(page.locator('[data-organ="brain"]')).toBeVisible();
 await page.screenshot({path:'docs/error-feedback.png'});
 await drop(page,'brain',50,6.9);
 await expect(page.locator('[data-feedback="success"]')).toBeVisible();
 await expect(page.locator('[data-organ="brain"]')).toBeHidden();
 await expect(page.locator('.placed-check')).toHaveCount(0);
 await page.screenshot({path:'docs/success-feedback.png'});
 for(const id of ['biceps','quadriceps','calves','hamstrings','triceps','glutes']){const o=ORGANS.find(o=>o.id===id)!;await drop(page,id,o.x,o.y);await expect(page.locator(`[data-organ="${id}"]`)).toBeHidden()}
 await page.emulateMedia({reducedMotion:'reduce'});
 await drop(page,'heart',50,80);
 await expect(page.locator('[data-feedback="error"] img')).toHaveCSS('animation-name','none');
 const padding=await page.locator('.app-shell').evaluate(el=>({top:getComputedStyle(el).paddingTop,bottom:getComputedStyle(el).paddingBottom}));expect(padding.top).toBe(padding.bottom);
});

test('polished controls keep focus and settle after interrupted hover',async({page})=>{
 await start(page);
 const organ=page.locator('[data-organ="heart"]');
 await organ.hover();await expect(organ.locator('img')).toHaveCSS('animation-name','organ-float');
 await page.mouse.move(10,10);await organ.hover();await page.mouse.move(10,10);
 await expect.poll(()=>organ.locator('img').evaluate(el=>el.getAnimations().length)).toBe(0);
 const restart=page.getByRole('button',{name:'Restart game'});
 expect((await restart.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 await restart.click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('dialog')).not.toHaveAttribute('open','');
 await expect(restart).toBeFocused();
 await restart.click();await page.getByRole('button',{name:'Keep progress'}).click();
 await expect(restart).toBeFocused();await expect(page.locator('.start-control')).toHaveCSS('visibility','hidden');
 await page.emulateMedia({reducedMotion:'reduce'});await restart.click();await expect(page.locator('dialog')).toHaveCSS('transform','none');
 await page.screenshot({path:'docs/polished-dialog.png',animations:'disabled'});
});


test('scoring thresholds include their exact boundaries',()=>{
 for(const [ms,points] of [[0,5],[15000,5],[15001,4],[25000,4],[25001,3],[35000,3],[35001,2],[60000,2],[60001,1],[999999,1]])expect(pointsForMatch(ms)).toBe(points);
});
test('success resets the scoring window, errors and selection do not, final total accumulates',async({page})=>{
 let now=Date.now();await page.clock.setFixedTime(now);await start(page);
 const advance=async(ms:number)=>{now+=ms;await page.clock.setFixedTime(now)};
 let total=0;
 for(let i=0;i<ORGANS.length;i++){
  const organ=ORGANS[i],delay=[14000,24000,34000,59000,61000][i%5];
  await advance(delay);
  if(i===1){await drop(page,organ.id,50,80);total-=.5;await page.locator(`[data-organ="${organ.id}"]`).click()}
  await drop(page,organ.id,organ.x,organ.y);total+=[5,4,3,2,1][i%5];
  await expect(page.getByTestId('score')).toHaveText(`${total} pts`);
 }
 await expect(page.getByTestId('final-score')).toHaveText(`${total} points`);
 await page.getByRole('button',{name:'Play again'}).click();await expect(page.getByTestId('score')).toHaveText('0 pts');
});

test('rear checkpoints reject front drops and placed muscles turn with the body',async({page})=>{
 await start(page);await expect(page.locator('[data-checkpoint="glutes"]')).toBeHidden();
 const source=(await page.locator('[data-organ="glutes"]').boundingBox())!,b=(await page.getByTestId('body').boundingBox())!;
 await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width*.5,b.y+b.height*.49,{steps:6});
 await expect(page.locator('.drag-ghost')).not.toHaveAttribute('data-snap-target','glutes');await page.mouse.up();await expect(page.getByTestId('score')).toHaveText('-0.5 pts');
 await drop(page,'glutes',50,49);await expect(page.locator('[data-organ="glutes"]')).toBeHidden();
 await page.screenshot({path:'docs/muscle-back.png',animations:'disabled'});
 await page.mouse.move(b.x+b.width*.3,b.y+b.height*.7);await page.mouse.down();await page.mouse.move(b.x+b.width*.425,b.y+b.height*.7,{steps:6});await page.mouse.up();
 await page.screenshot({path:'docs/muscle-oblique.png',animations:'disabled'});
 await page.mouse.move(b.x+b.width*.3,b.y+b.height*.7);await page.mouse.down();await page.mouse.move(b.x+b.width*.425,b.y+b.height*.7,{steps:6});await page.mouse.up();
 await expect(page.getByTestId('body')).toHaveAttribute('data-view','Side view');await expect(page.locator('.blood-cell:visible')).toHaveCount(0);
});

test('generated anatomy uses solid geometry and the requested anatomical side names',async()=>{
 const {createAnatomyMesh}=await import('../src/anatomy-meshes');const T=await import('three');
 for(const id of ['deltoid','forearm','tibialis','adductors','masseter','biceps','triceps','quadriceps','hamstrings','calves','glutes','bladder','thyroid','trachea','esophagus','tongue','eyes']){
  const model=createAnatomyMesh(id);const size=new T.Box3().setFromObject(model).getSize(new T.Vector3());
  expect(Math.min(size.x,size.y,size.z)).toBeGreaterThan(.05);
  model.traverse(node=>{expect(node.type).not.toBe('Sprite');if(node instanceof T.Mesh){expect(node.geometry.type).not.toBe('PlaneGeometry');node.geometry.dispose();(node.material as T.Material).dispose()}});
 }
 expect(ORGANS.find(o=>o.id==='biceps')).toMatchObject({name:'Right Bicep',x:78});
 expect(ORGANS.find(o=>o.id==='triceps')).toMatchObject({name:'Left Tricep',x:22});
 expect(ORGANS.find(o=>o.id==='quadriceps')).toMatchObject({name:'Right Quadriceps',x:66});
 expect(ORGANS.find(o=>o.id==='hamstrings')).toMatchObject({name:'Left Hamstring',x:34});
});

 test('expanded mobile collection stays above game controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});await start(page);
 const bank=await page.locator('.left-bank').boundingBox(),actions=await page.locator('.bottom-bar').boundingBox();
 expect(bank!.y+bank!.height).toBeLessThanOrEqual(actions!.y+1);
 for(const piece of await page.locator('.organ-piece').all()){
 const b=await piece.boundingBox();expect(b!.y+b!.height).toBeLessThanOrEqual(actions!.y+1);
 }
 });

test('start enters fullscreen and Escape returns to the page without resetting play',async({page})=>{
 await start(page);
 await expect.poll(()=>page.evaluate(()=>Boolean(document.fullscreenElement))).toBe(true);
 await expect(page.getByRole('button',{name:'Full screen',exact:true})).toHaveCount(0);
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>Boolean(document.fullscreenElement))).toBe(false);
 await expect(page.getByTestId('score')).toHaveText('0 pts');
 await drop(page,'lungs',50,26.6);await expect(page.locator('[data-organ="lungs"]')).toBeDisabled();
});


test('head reveals independently and restores solid bone on restart',async({page})=>{
 await start(page);const body=page.getByTestId('body');
 await expect(page.locator('[data-organ="masseter"]')).toHaveCount(0);await expect(page.locator('[data-organ="spleen"]')).toBeVisible();
 await drop(page,'brain',50,6.9);await expect(body).toHaveAttribute('data-brain-revealed','true');await expect(body).toHaveAttribute('data-tongue-revealed','false');
 await drop(page,'tongue',50,12.5);await expect(body).toHaveAttribute('data-tongue-revealed','true');
 await page.getByRole('button',{name:'Restart game',exact:true}).click();await page.getByRole('button',{name:'Restart',exact:true}).click();
 await expect(body).toHaveAttribute('data-brain-revealed','false');await expect(body).toHaveAttribute('data-tongue-revealed','false');
});
test('completion poses, particles, replay cleanup and reduced motion',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 for(const o of ORGANS)await drop(page,o.id,o.x,o.y);
 const body=page.getByTestId('body');await expect(body).toHaveAttribute('data-pose','standing');
 await expect(body).toHaveAttribute('data-pose','thumbs-up',{timeout:4000});
 await expect(body).toHaveAttribute('data-pose','victory',{timeout:8000});
 await expect(body).toHaveAttribute('data-attached-count','0');
 await expect(body).toHaveAttribute('data-organ-opacity','0');
 await expect(body).toHaveAttribute('data-brain-revealed','false');
 await expect(page.locator('.celebration-particles')).toHaveCount(1);
 await page.getByRole('button',{name:'Play again'}).click();await expect(body).not.toHaveAttribute('data-celebrating','true');await expect(page.locator('.celebration-particles')).toHaveCount(0);
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const o of ORGANS)await drop(page,o.id,o.x,o.y);
 await expect(body).toHaveAttribute('data-pose','victory');expect(errors).toEqual([]);
});


test('the gameplay canvas survives completion while organs fade and yaw eases forward',async({page})=>{
 await start(page);await drop(page,'brain',50,6.9);
 const body=page.getByTestId('body');await body.focus();for(let i=0;i<8;i++)await page.keyboard.press('ArrowRight');
 const yaw=Number(await body.getAttribute('data-yaw')),sceneId=await body.getAttribute('data-scene-id');
 await page.evaluate(()=>{(window as any).originalCanvas=document.querySelector('.anatomy-canvas')});
 await page.getByRole('button',{name:'Finish game',exact:true}).click();
 await page.waitForTimeout(250);
 const middleYaw=Number(await body.getAttribute('data-yaw')),opacity=Number(await body.getAttribute('data-organ-opacity'));
 expect(middleYaw).toBeGreaterThan(0);expect(middleYaw).toBeLessThan(yaw);expect(opacity).toBeGreaterThan(0);expect(opacity).toBeLessThan(1);
 expect(await page.evaluate(()=>(window as any).originalCanvas===document.querySelector('.anatomy-canvas'))).toBe(true);
 await expect(body).toHaveAttribute('data-scene-id',sceneId!);await expect(page.locator('.anatomy-canvas')).toHaveCount(1);
 await expect(body).toHaveAttribute('data-pose','thumbs-up');await expect(body).toHaveAttribute('data-organ-opacity','0');
});
