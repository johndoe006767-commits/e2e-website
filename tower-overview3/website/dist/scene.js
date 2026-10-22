import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {loadReplacement,glassMaterials,applyGlass,createLook} from './models.js?v=20261023-o2c10';
import {createPlexus,PLEXUS_PRESETS} from './plexus.js?v=20261023-o2c10';
import {AZ} from './organs.js?v=20261023-o2c10';
import {createNebula} from './nebula.js?v=20261023-o2c10';
import {buildVesselNetwork} from './vessels.js?v=20261023-o2c10';
import {createProcessNeurons,updateProcessNeurons} from './process-neurons.js?v=20261023-o2c10';
import {initProcessFlow} from './process-flow.js?v=20261023-o2c10';
import {createJourney} from './journey.js?v=20261023-o2c10';
import {healthMetrics,cardMarkup,legendMarkup,metricsSentence,countUp,resetCounts,accentFor,inkFor} from './health.js?v=20261023-o2c10';
const $=s=>document.querySelector(s);
const journey=createJourney({maps:{intestines:'./data/maps/o2c.json'}});window.__journey=journey;
const configs=[['brain','FP&A Commercial','Brain',-1,0,.18],['liver','CAPEX','Liver',-1,1,.25],['kidneys','Controlling','Kidneys',-1,2,.23],['spleen','Tax','Spleen',-1,3,.12],['lungs','R2R','Lungs',1,0,.32],['stomach','P2P','Stomach',1,1,.17],['pancreas','FP&A Operations','Pancreas',1,2,.20],['intestines','O2C','Intestines',1,3,.29]];
const reduced=matchMedia('(prefers-reduced-motion: reduce)'), fine=matchMedia('(hover: hover) and (pointer: fine)');
const skeletonOpacity=.35; // 1 = solid bones; lower values make the skeleton more see-through
const hbLegend=document.getElementById('hb-legend');
let renderer,scene,camera,heart,heartLook,nebula=null,bones,skull,pointMax=64,ready=false,expanded=false,separation=0,separationTarget=0,selected=null,hover=null,animation=0,last=0,time=0,w=1,h=1,mobile=false,drag=null,lastTrigger=null;
let sceneInView=true;
const sceneObserver=new IntersectionObserver(([entry])=>sceneInView=entry.isIntersecting);sceneObserver.observe($('#section-1'));
const autoTurnAxis=new T.Vector3(0,1,0),autoTurnStep=new T.Quaternion(),autoTurnSpeed=Math.PI/30;
const organs=[],ray=new T.Raycaster(),pointer=new T.Vector2(),p=new T.Vector3();
// All continuous motion stays in Three.js, outside UI rendering.
function ease(x){ // Skill's cubic-bezier(.77,0,.175,1), inverted on its x axis.
 let lo=0,hi=1,t=x;for(let i=0;i<12;i++){t=(lo+hi)/2;const v=3*(1-t)*(1-t)*t*.77+3*(1-t)*t*t*.175+t*t*t;if(v<x)lo=t;else hi=t;}return 3*(1-t)*t*t+t*t*t;
}
let detail=null;
// The canvas always matches #experience (its CSS height, not the window), so DOM and 3D share one coordinate space.
function fitCanvas(){const nw=document.documentElement.clientWidth||innerWidth,nh=$('#experience').clientHeight||Math.max(innerHeight,640);if(nw===w&&nh===h)return false;w=nw;h=nh;mobile=w<768;renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:1.75));renderer.setSize(w,h);const half=1.10;camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();return true;}
function resize(){fitCanvas();if(ready){buildConnections();retarget(true);}}
// Zoomed-in layout: measure the HUD, title and controls, then give the organ the largest free square,
// with the process cards in columns beside it (wide screens) or in rows above and below it (narrow ones).
function detailLayout(){
  const box=$('#experience').getBoundingClientRect(),rel=el=>{const r=el.getBoundingClientRect();return {l:r.left-box.left,t:r.top-box.top,r:r.right-box.left,b:r.bottom-box.top};};
  // The vital-signs panel scales with the window (about a third of its width on wide screens), and the organ is a quarter of the panel's width.
  const panel=$('#tower-telemetry-hud');
  let hudScale=1;if(w>=1100){hudScale=Math.max(1,Math.min(w*.32/panel.offsetWidth,(h-130)/panel.offsetHeight));panel.style.setProperty('--hud-s',hudScale.toFixed(3));}else panel.style.removeProperty('--hud-s');
  // From the unscaled layout box (offset* ignores transforms): right edge fixed, vertically centred (top:50% + translateY(-50%)).
  let hud=rel(panel);if(w>=1100){const ow=panel.offsetWidth,oh=panel.offsetHeight,r=panel.offsetLeft+ow,cy=panel.offsetTop;hud={l:r-ow*hudScale,r,t:cy-oh*hudScale/2,b:cy+oh*hudScale/2};}
  const title=rel($('.detail-title')),tools=rel($('.rotate-tools'));
  const beside=hud.l>w/2,gap=20,pad=beside?24:16;
  const L=pad,R=beside?hud.l-24:w-pad,top=beside?72:hud.b+14,bottom=Math.min(title.t,tools.t)-12,W=R-L,H=bottom-top;
  const host=$('#process-neurons'),nodes=selected.processNeurons.nodes;
  const tallest=cw=>{host.style.setProperty('--card-w',`${cw}px`);let m=0;for(const n of nodes){const was=n.label.hidden;n.label.hidden=false;m=Math.max(m,n.label.offsetHeight);n.label.hidden=was;}return m;};
  const organD=(hud.r-hud.l)/4,colW=Math.round(Math.max(170,Math.min(Math.max(250,w*.174),W*.22)))/* grows with the window above 1440px, so big screens keep the same proportions */,colD=Math.min(H*.94,W-2*(colW+gap),760,organD);
  const rowW=Math.floor(Math.min(300,(W-12)/2)),rowH=tallest(rowW),rowD=Math.min(W,H-2*(rowH+12),760,organD);
  let l;
  if(colD>=rowD*.85&&W-2*(colW+gap)>=organD){
    const D=colD,x0=L+(W-(2*colW+2*gap+D))/2;
    l={mode:'columns',cw:colW,D,cx:x0+colW+gap+D/2,cy:top+H/2,T:top,B:bottom,leftX:x0,rightX:x0+colW+2*gap+D};
  }else{
    const D=Math.max(120,rowD),cy=top+H/2,cx=L+W/2;
    l={mode:'rows',cw:rowW,D,cx,cy,T:top,B:bottom,rowX:cx-(2*rowW+12)/2,above:cy-D/2-12,below:cy+D/2+12};
  }
  host.style.setProperty('--card-w',`${l.cw}px`);
  const span=camera.top-camera.bottom;
  l.target=new T.Vector3(camera.left+l.cx/w*(camera.right-camera.left),camera.position.y+camera.top-l.cy/h*span,.8);
  l.scale=l.D*span/h;
  return l;
}
function separatedPosition(o){const x=mobile?camera.right*.68:Math.min(camera.right*.49,1.12);return new T.Vector3(o.side*x,1.48-o.row*.355,.20);}
function overviewTarget(o){return o.home.clone().lerp(separatedPosition(o),separation);}
function overviewScale(o){return T.MathUtils.lerp(o.size,mobile?.17:.23,separation);}
function retarget(instant=false){detail=selected?detailLayout():null;for(const o of organs){o.flight=true;o.from=o.root.position.clone();o.to=selected===o?detail.target.clone():overviewTarget(o);o.fromScale=o.root.scale.x;o.toScale=selected===o?detail.scale:overviewScale(o);o.start=performance.now();o.duration=instant||reduced.matches?0:700;o.fromQuat=o.root.quaternion.clone();o.toQuat=new T.Quaternion();} }
function setSeparation(value){if(!ready||selected)return;separationTarget=T.MathUtils.clamp(value,0,1);expanded=separationTarget>.5;$('#assembly').value=String(Math.round(separationTarget*1000));}
function setView(value){setSeparation(value?1:0);}
function select(o,trigger){if(!ready||selected)return;lastTrigger=trigger||o.label;$('#process-status').textContent='';selected=o;o.rotationTarget=new T.Quaternion();hover=null;document.body.dataset.detail='true';$('#detail').hidden=false;const hasMap=!document.body.dataset.still&&journey.open(o.id);$('#scene').style.touchAction=hasMap?'pan-y':'';if(fitCanvas())buildConnections();$('#organ-name').textContent=o.organ;$('#tower-name').textContent=o.name;updateTelemetryHUD(o.id);setupHUDInteractions();$('#back').focus({preventScroll:true});$('#scene').tabIndex=0;$('#scene').setAttribute('aria-label',hasMap?`${o.name} ${o.organ}. Drag or use arrow keys to rotate. Scroll down to follow the Order to Cash process map.`:`${o.name} ${o.organ}. Scroll to rotate left or right. Drag or use arrow keys to rotate in all directions.`);retarget();}
function close(){if(!selected)return;selected=null;journey.close();$('#process-section').hidden=true;$('#scene').style.touchAction='';$('#scene').setAttribute('aria-label','Skeleton, heart and eight finance organs');document.body.dataset.detail='false';$('#detail').hidden=true;if(fitCanvas())buildConnections();retarget();lastTrigger?.focus({preventScroll:true});}
// Exact tapered Catmull-Rom tubes and traveling flow shader from tower-overview2.
function buildConnections(){organs.forEach((o,index)=>{
 if(o.vein){scene.remove(o.vein);o.vein.geometry.dispose();o.vein.material.dispose();}
 const origin=heart.position.clone().add(new T.Vector3(0,.02,.035));
 const geometry=buildVesselNetwork(origin,o.home,separatedPosition(o),3,o.side,index*31+7);
      const uniforms = {
        uSeparation: { value: 0 },
        uTime: { value: 0 },
        uHoverOffset: { value: new T.Vector3() },
      };
      // AstraZeneca line bundles: gold strands that turn mulberry near the heart (brand Picture4), unlit so the hex stays exact.
      const material = new T.MeshBasicMaterial({ color: AZ.gold, transparent: true, opacity: 0.55, depthWrite: false, side: T.DoubleSide, toneMapped: false });
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms, { uMulberry: { value: new T.Color(AZ.mulberry) } });
        shader.vertexShader = 'attribute vec3 expandedPosition; attribute float branchSeed; uniform float uSeparation; uniform vec3 uHoverOffset; varying float vPath; varying float vBranch;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = mix(position,expandedPosition,uSeparation) + uHoverOffset * smoothstep(0.45,1.0,uv.x); vPath=uv.x; vBranch=branchSeed;');
        shader.fragmentShader = 'uniform float uTime; uniform vec3 uMulberry; varying float vPath; varying float vBranch;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat flow = 0.5 + 0.5*sin(vPath*10.0-uTime*3.8+vBranch*2.3);\ndiffuseColor.rgb = mix(uMulberry, diffuseColor.rgb, smoothstep(0.0,0.4,vPath)) * (0.85+0.3*flow);\ndiffuseColor.a *= 0.55+0.45*flow;');
      };
      material.customProgramCacheKey = () => 'gfs-branching-vessels-az';
      const mesh = new T.Mesh(geometry, material);
      mesh.frustumCulled = false;

 mesh.renderOrder=4;scene.add(mesh);o.vein=mesh;o.vesselUniforms=uniforms;
});}
function fail(error){console.error(error);$('#loading').hidden=false;$('#load-message').textContent='The anatomy could not load. Please retry in a WebGL-enabled browser.';$('#retry').hidden=false;}
async function init(){try{
renderer=new T.WebGLRenderer({canvas:$('#scene'),antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0xECEFEE,0);renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1;pointMax=renderer.getContext().getParameter(renderer.getContext().ALIASED_POINT_SIZE_RANGE)[1]||64;
scene=new T.Scene();camera=new T.OrthographicCamera(-1,1,1,-1,.01,20);camera.position.set(0,.86,5);camera.lookAt(0,.86,0);
scene.add(new T.HemisphereLight(0xffffff,0x9DB0AC,1.6));const light=new T.DirectionalLight(0xffffff,2.2);light.position.set(-2,3,4);scene.add(light);const rim=new T.DirectionalLight(0xE6E0EE,1.0);rim.position.set(3,2,-2);scene.add(rim);
bones=new T.Group();scene.add(bones);
nebula=createNebula({mobile:innerWidth<768});scene.add(nebula.mesh);

const [atlasResponse,bodyResponse,processResponse]=await Promise.all([fetch('./data/anatomy/atlas.json'),fetch('./data/anatomy/body.bin.gz'),fetch('./data/processes.json')]);if(!processResponse.ok)throw Error('Process data missing');const processData=await processResponse.json();if(hbLegend)hbLegend.innerHTML=legendMarkup('Draft figures for review');if(!atlasResponse.ok||!bodyResponse.ok)throw Error('Atlas missing');const atlas=await atlasResponse.json();const zip=await bodyResponse.arrayBuffer();const buffer=await new Response(new Blob([zip]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();if(buffer.byteLength!==atlas.bytes)throw Error('Incomplete atlas');
const grouped=new Map(),homes=new Map();for(const part of atlas.parts){const bounds=new T.Box3(new T.Vector3(...part.bounds[0]),new T.Vector3(...part.bounds[1]));if(!homes.has(part.group))homes.set(part.group,bounds);else homes.get(part.group).union(bounds);if(!['skeleton','heart'].includes(part.group))continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,part.positions,part.vertexCount*3),3));g.setAttribute('normal',new T.BufferAttribute(new Int16Array(buffer,part.normals,part.vertexCount*3),3,true));g.setIndex(new T.BufferAttribute(new Uint32Array(buffer,part.indices,part.indexCount),1));const id=part.group==='skeleton'&&part.bounds[0][1]>1.45?'skull':part.group;if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push(g);}
for(const [id,pieces]of grouped){const geo=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());
 if(id==='heart'){
  // Gold glass heart with a mulberry core and a dense plexus (brand Picture4). It sits in front of the lungs (z .33).
  geo.computeBoundingBox();const c=geo.boundingBox.getCenter(new T.Vector3());geo.translate(-c.x,-c.y,-c.z);const unit=Math.max(...geo.boundingBox.getSize(new T.Vector3()).toArray());
  heartLook=createLook();const glass=glassMaterials({face:'#F7C95A',base:AZ.gold,shadow:AZ.mulberry,highlight:AZ.white,ink:.7,backAlpha:.3},unit,heartLook);
  const mesh=new T.Mesh(geo);applyGlass(mesh,glass,11);mesh.children.find(m=>m.material===glass.back).renderOrder=-.5;
  mesh.add(createPlexus({meshes:[mesh],unit,seed:77,lineColor:AZ.gold,dotColor:AZ.mulberry,look:heartLook,preset:PLEXUS_PRESETS.heart,scale:innerWidth<768?.5:1}));
  mesh.position.copy(c);mesh.position.z=.33;heart=mesh;scene.add(mesh);
 }else{
  // Ghost skeleton: pale lilac, faint, drawn first (behind the organs).
  const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({color:0xD9CCE6,roughness:.55,metalness:0,depthTest:false,depthWrite:false,transparent:true,opacity:1}));mesh.renderOrder=-1;bones.add(mesh);if(id==='skull')skull=mesh;
 }}
for(const [id,name,organ,side,row,size] of configs){const {model,geometry,network,look,plexus}=await loadReplacement(id);geometry.computeBoundingBox();const visibleBounds=geometry.boundingBox.clone();const root=new T.Group();root.add(model);root.updateMatrixWorld(true);const box=visibleBounds;const center=box.getCenter(new T.Vector3());model.position.sub(center);const max=Math.max(...box.getSize(new T.Vector3()).toArray());model.scale.multiplyScalar(1/max);model.position.multiplyScalar(1/max);const home=homes.get(id).getCenter(new T.Vector3());home.z=Math.max(home.z,.13);if(id==='brain')home.z=.015;root.position.copy(home);root.scale.setScalar(size);scene.add(root);
const label=document.createElement('button');const m=healthMetrics(TOWER_HEALTH[id]);label.className=`label ${side<0?'left':'right'}${m?' card':''}`;if(m){label.style.setProperty('--accent-c',accentFor(id));label.style.setProperty('--accent-ink',inkFor(id));}label.innerHTML=`<small>${organ}</small><strong>${name}</strong>${m?cardMarkup(m,120+row*70+(side>0?35:0)):''}<span class="cta">Explore tower<svg class="ico ico-ne" aria-hidden="true"><use href="#i-ne"/></svg></span>`;label.setAttribute('aria-label',`Explore ${name}, ${organ}.${m?' '+metricsSentence(m):''}`);$('#labels').append(label);
const o={id,name,organ,side,row,size,root,home,label,m,look,plexus,hb:label.querySelector('.hb'),hbOn:false,from:home.clone(),to:home.clone(),fromScale:size,toScale:size,start:0,duration:0,fromQuat:new T.Quaternion(),toQuat:new T.Quaternion(),hoverAmount:0};root.traverse(m=>{if(m.isMesh)m.userData.organ=o;});label.onclick=()=>select(o,label);label.onpointerenter=()=>{if(fine.matches)hover=o;};label.onpointerleave=()=>{hover=null;};
o.processNeurons=createProcessNeurons(o,network,processData.towers.find(t=>t.id===id).processes,$('#process-neurons'));geometry.dispose();organs.push(o);$('#load-message').textContent=`Preparing ${organ.toLowerCase()}…`;}
initProcessFlow(processData);
ready=true;resize();$('#loading').hidden=true;{// ?still=<organ id>[&sep=0..1]: clean brand stills for slides (UI hidden, organ framed as in the zoomed view).
 const q=new URLSearchParams(location.search);if(q.has('still')||q.has('sep')){document.body.dataset.still='true';const o=organs.find(o=>o.id===q.get('still'));if(o)select(o);else setSeparation(Number(q.get('sep')||0));}}addEventListener('resize',resize);new ResizeObserver(()=>{if($('#experience').clientHeight!==h||document.documentElement.clientWidth!==w)resize();}).observe($('#experience'));frame(performance.now());
}catch(error){fail(error);}}
function frame(now){if(!sceneInView){last=now;animation=requestAnimationFrame(frame);return;}const dt=Math.min((now-last)/1000,.05);last=now;time+=dt;separation=reduced.matches?separationTarget:T.MathUtils.lerp(separation,separationTarget,1-Math.exp(-dt*12));if(Math.abs(separation-separationTarget)<.0001)separation=separationTarget;const beat=reduced.matches?1:1.12+Math.pow(Math.max(0,Math.sin(time*6)),8)*.035;heart.scale.setScalar(beat);
const bodyAlpha=selected?0:1;
{// Dark starry nebula backdrop behind the whole stage.
 const U=nebula.uniforms,pr=renderer.getPixelRatio();U.uResolution.value.set(w*pr,h*pr);U.uPixelRatio.value=pr;U.uTime.value=reduced.matches?0:time;
 // Stronger oval behind the body, or behind the organ in the zoomed view.
 let cx=w/2,cy=h/2,size=.8*h;if(selected&&detail){cx=detail.cx;cy=detail.cy;size=detail.D*1.25;}U.uCentre.value.lerp(new T.Vector3(cx,cy,size),U.uCentre.value.z?Math.min(1,dt*6):1);
 U.uGlow.value=selected?.18:.28*(1-T.MathUtils.smoothstep(separation,0,.6))+.12;}
for(const mesh of bones.children){const target=(mesh===skull?T.MathUtils.lerp(.45,1,separation):1)*skeletonOpacity;mesh.material.opacity+=(target*bodyAlpha-mesh.material.opacity)*Math.min(1,dt*10);mesh.visible=mesh.material.opacity>.01;}heart.visible=!selected;heartLook.uTime.value=reduced.matches?0:time;heartLook.uPixelRatio.value=renderer.getPixelRatio();heartLook.uPointMax.value=pointMax;heartLook.uSize.value=T.MathUtils.clamp(.6*h/2.2*.02,1.5,4);heartLook.uPlexus.value=.55;
for(const o of organs){const t=o.duration?Math.min(1,(now-o.start)/o.duration):1;const e=ease(t);if(!selected&&(!o.flight||t===1)){o.flight=false;o.root.position.copy(overviewTarget(o));o.root.scale.setScalar(overviewScale(o));}else{o.root.position.lerpVectors(o.from,o.to,e);o.root.scale.setScalar(T.MathUtils.lerp(o.fromScale,o.toScale,e));}if(t<1||selected!==o)o.root.quaternion.slerpQuaternions(o.fromQuat,o.toQuat,e);else if(o.rotationTarget){
 // Advance from the current angle so releasing a drag never restarts the turn.
 if(!reduced.matches&&!drag){
  o.rotationTarget.premultiply(autoTurnStep.setFromAxisAngle(autoTurnAxis,dt*autoTurnSpeed));
 }
 o.root.quaternion.slerp(o.rotationTarget,reduced.matches?1:1-Math.exp(-dt*14));
}o.hoverAmount+=((hover===o&&!selected?1:0)-o.hoverAmount)*Math.min(1,dt*10);if(!reduced.matches){o.root.position.y+=Math.sin(time*2.1)*.008*o.hoverAmount;if(!selected)o.root.rotation.z=Math.sin(time*1.6)*.045*o.hoverAmount;}
o.root.visible=!selected||selected===o;o.vein.visible=!selected;
o.vesselUniforms.uSeparation.value=separation;
{const L=o.look;
{p.copy(o.root.position).project(camera);const ox=(p.x+1)*w/2,oy=(1-p.y)*h/2,show=o.root.visible?1:0;
 nebula.uniforms.uOrgan.value[organs.indexOf(o)].set(ox,oy,o.root.scale.x*h/2.2*.85,show);nebula.uniforms.uOrganCol.value[organs.indexOf(o)].set(accentFor(o.id));
 L.uOnDark.value=.6*show;}L.uPlexus.value=selected?.55:T.MathUtils.lerp(.35,.55,separation);L.uTime.value=reduced.matches?0:time;L.uPixelRatio.value=renderer.getPixelRatio();L.uPointMax.value=pointMax;L.uSize.value=T.MathUtils.clamp(.0115*o.root.scale.x*h/2.2,1.5,8);}
o.vesselUniforms.uTime.value=time*(reduced.matches?.2:1);
o.vesselUniforms.uHoverOffset.value.copy(o.root.position).sub(overviewTarget(o));
const visible=separation>.55&&!selected;const labelAlpha=T.MathUtils.smoothstep(separation,.55,.9);
o.label.style.visibility=visible?'visible':'hidden';o.label.style.opacity=visible?String(labelAlpha):'0';o.label.tabIndex=visible?0:-1;if(o.hb){if(!o.hbOn&&visible&&labelAlpha>=.6){o.hbOn=true;o.hb.classList.add('on');countUp(o.hb,reduced.matches);}else if(o.hbOn&&separation<.5){o.hbOn=false;o.hb.classList.remove('on');resetCounts(o.hb);}}if(o===organs[0]&&hbLegend){hbLegend.style.opacity=visible?String(labelAlpha):'0';hbLegend.style.visibility=visible?'visible':'hidden';}
if(visible){p.copy(o.root.position).project(camera);const x=(p.x+1)*w/2,y=(1-p.y)*h/2;let lx,ly;if(mobile){lx=x-o.label.offsetWidth/2;ly=y+27;}else{const gap=o.root.scale.x/2*h/2.2+18;lx=o.side<0?x-gap-o.label.offsetWidth:x+gap;ly=y-o.label.offsetHeight/2;}lx=Math.max(12,Math.min(w-o.label.offsetWidth-12,lx));o.label.style.translate=`${lx}px ${ly}px`;}}
for(const o of organs)updateProcessNeurons(o,selected===o&&(o.duration===0||now-o.start>o.duration*.85),camera,w,h,time,reduced.matches,detail);
renderer.render(scene,camera);animation=requestAnimationFrame(frame);}
function hit(event){const rect=$('#scene').getBoundingClientRect();pointer.set((event.clientX-rect.left)/w*2-1,-(event.clientY-rect.top)/h*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(organs.map(o=>o.root),true).find(x=>x.object.visible&&x.object.userData.organ)?.object.userData.organ;}
$('#assembly').addEventListener('input',e=>setSeparation(Number(e.target.value)/1000));$('#back').onclick=close;$('#retry').onclick=()=>location.reload();$('#reset').onclick=()=>{if(selected){selected.fromQuat=selected.root.quaternion.clone();selected.toQuat.identity();selected.rotationTarget.identity();selected.from.copy(selected.root.position);selected.fromScale=selected.root.scale.x;selected.start=performance.now();selected.duration=reduced.matches?0:250;}};
// Wheel/trackpad progress is continuous and reversible; no document scroll listener.
$('#experience').addEventListener('wheel',e=>{if(e.ctrlKey||!ready||(selected&&journey.active))return;e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?h:1;const delta=T.MathUtils.clamp(e.deltaY*unit,-120,120);if(selected){selected.rotationTarget.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),delta*.006));}else setSeparation(separationTarget+delta/1800);},{passive:false});
const canvas=$('#scene');canvas.addEventListener('pointerdown',e=>{if(!ready||e.button!==0)return;if(selected)selected.rotationTarget.copy(selected.root.quaternion);drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!ready)return;if(drag&&selected){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;selected.root.quaternion.premultiply(new T.Quaternion().setFromEuler(new T.Euler(dy*.009,dx*.009,0)));selected.rotationTarget.copy(selected.root.quaternion);selected.duration=0;drag.x=e.clientX;drag.y=e.clientY;}else if(drag&&!selected&&e.pointerType==='touch'){setSeparation(separationTarget+(drag.y-e.clientY)/650);drag.x=e.clientX;drag.y=e.clientY;}else if(!selected&&fine.matches){hover=hit(e);canvas.style.cursor=hover?'pointer':'default';}});canvas.addEventListener('pointerup',e=>{if(drag&&!selected&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<6){const o=hit(e);if(o)select(o);}drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);});canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('lostpointercapture',()=>drag=null);canvas.addEventListener('pointerleave',()=>hover=null);
addEventListener('keydown',e=>{if(e.key==='Escape'&&!(selected&&journey.active&&journey.back()))close();if(selected&&e.target===canvas&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();selected.duration=0;selected.root.quaternion.premultiply(new T.Quaternion().setFromEuler(new T.Euler(e.key==='ArrowUp'?-.15:e.key==='ArrowDown'?.15:0,e.key==='ArrowLeft'?-.15:e.key==='ArrowRight'?.15:0,0)));selected.rotationTarget.copy(selected.root.quaternion);}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(animation);fail(new Error('WebGL context lost'));});
// Keyboard users can explore each organ in either view, without visual label overlap.
for(const config of configs){const b=document.createElement('button');b.textContent=`Explore ${config[1]}`;b.className='keyboard-organ';b.onclick=()=>{const o=organs.find(o=>o.id===config[0]);if(o)select(o,b);};$('#experience').append(b);}
init();

addEventListener('pagehide',()=>{cancelAnimationFrame(animation);sceneObserver.disconnect();renderer?.dispose();scene?.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});});


const TOWER_HEALTH = {
  lungs: { name: 'R2R', auto: 14, semi: 32, manual: 42, tpis: 4, pain: 4 },
  intestines: { name: 'O2C', auto: 8, semi: 14, manual: 18, tpis: 8, pain: 15 },
  stomach: { name: 'P2P', auto: 20, semi: 30, manual: 36, tpis: 5, pain: 4 },
  brain: { name: 'FP&A Commercial', auto: 32, semi: 44, manual: 16, tpis: 8, pain: 2 },
  pancreas: { name: 'FP&A Operations', auto: 26, semi: 38, manual: 22, tpis: 5, pain: 3 },
  liver: { name: 'CAPEX', auto: 16, semi: 28, manual: 34, tpis: 4, pain: 4 },
  kidneys: { name: 'Controlling', auto: 22, semi: 34, manual: 24, tpis: 5, pain: 3 },
  spleen: { name: 'Tax', auto: 12, semi: 22, manual: 40, tpis: 3, pain: 5 }
};

function updateTelemetryHUD(id) {
  const d = TOWER_HEALTH[id] || { name: 'TOWER', auto: 20, semi: 30, manual: 30, tpis: 4, pain: 3 };
  const total = d.auto + d.semi + d.manual;
  const score = Math.round(((d.auto + 0.5 * d.semi) / total) * 100);

  const title = document.getElementById('hud-tower-title');
  const scoreVal = document.getElementById('hud-score-pct');
  const barAuto = document.getElementById('hud-bar-auto');
  const barSemi = document.getElementById('hud-bar-semi');
  const barManual = document.getElementById('hud-bar-manual');
  const countAuto = document.getElementById('hud-count-auto');
  const countSemi = document.getElementById('hud-count-semi');
  const countManual = document.getElementById('hud-count-manual');
  const countTpi = document.getElementById('hud-count-tpi');
  const countPain = document.getElementById('hud-count-pain');

  if (title) title.textContent = d.name + ' TELEMETRY';
  if (scoreVal) scoreVal.textContent = score + '%';
  if (countAuto) countAuto.textContent = d.auto;
  if (countSemi) countSemi.textContent = d.semi;
  if (countManual) countManual.textContent = d.manual;
  if (countTpi) countTpi.textContent = d.tpis;
  if (countPain) countPain.textContent = d.pain;

  if (barAuto && barSemi && barManual) {
    barAuto.style.width = '0%';
    barSemi.style.width = '0%';
    barManual.style.width = '0%';
    setTimeout(() => {
      barAuto.style.width = ((d.auto / total) * 100) + '%';
      barSemi.style.width = ((d.semi / total) * 100) + '%';
      barManual.style.width = ((d.manual / total) * 100) + '%';
    }, 60);
  }
}


// ============================================================
// HANDOFF SYNAPSE ENGINE & DRILL-DOWN FILTERING
// ============================================================

const O2C_HANDOFF_DATA = {
  upstream: [
    { id: 'distributors', label: 'Distributors', color: '#b08968' },
    { id: 'dmt', label: 'DMT', color: '#0077b6' },
    { id: 'controlling', label: 'Controlling', color: '#e76f51' },
    { id: 'distribution', label: 'Distribution', color: '#2a9d8f' },
    { id: 'approver', label: 'Approver', color: '#9b5de5' },
    { id: 'local_market', label: 'Local market', color: '#cb997e' },
    { id: 'customer', label: 'Customer', color: '#a3704c' },
    { id: 'billing', label: 'Billing', color: '#6c757d' },
    { id: 'p2p', label: 'P2P', color: '#f3722c' },
    { id: 'collections', label: 'Collections', color: '#577590' },
    { id: 'tax', label: 'Tax', color: '#43aa8b' },
    { id: 'hr', label: 'HR', color: '#b5179e' },
    { id: 'bank', label: 'Bank', color: '#495057' },
    { id: 'requester', label: 'Requester', color: '#8d99ae' }
  ],
  flows: [
    { id: 'flow-1', title: 'Flow 1 · EDI orders', meta: '6 in · 1 out', up: ['distributors','dmt','controlling','distribution'], down: ['order_block'] },
    { id: 'flow-2', title: 'Flow 2 · Customer PO, returns and rebates', meta: '1 in · 1 out', up: ['customer'], down: ['order_block'] },
    { id: 'flow-3', title: 'Order block release', meta: '3 in · 2 out', up: ['distribution','approver','local_market'], down: ['distribution','billing'] },
    { id: 'flow-4', title: 'Billing', meta: '1 in · 2 out', up: ['billing'], down: ['collections','tax'] },
    { id: 'flow-5', title: 'Collection - payment follow-up and escalation', meta: '2 in · 1 out', up: ['local_market','customer'], down: ['collections'] },
    { id: 'flow-6', title: 'Disputes and deductions management', meta: '4 in · 2 out', up: ['customer','billing','p2p'], down: ['cash_collections_review','cash_app'] },
    { id: 'flow-7', title: 'Payment allocation - matched payments', meta: '2 in · 1 out', up: ['collections','bank'], down: ['cash_banking'] },
    { id: 'flow-8', title: 'Flow A - Payment process: automated payment run', meta: '4 in · 1 out', up: ['tax','hr','bank'], down: ['bank'] },
    { id: 'flow-9', title: 'Flow A - Payment process: manual payment route', meta: '1 in · 1 out', up: ['requester'], down: ['bank'] },
    { id: 'flow-10', title: 'Flow B - Bank statement process', meta: '1 in · 1 out', up: ['bank'], down: ['r2r_reporting'] }
  ],
  downstream: [
    { id: 'order_block', label: 'Order block release', color: '#6c757d' },
    { id: 'distribution', label: 'Distribution', color: '#2a9d8f' },
    { id: 'billing', label: 'Billing', color: '#495057' },
    { id: 'collections', label: 'Collections', color: '#6c757d' },
    { id: 'tax', label: 'Tax', color: '#43aa8b' },
    { id: 'cash_app', label: 'Cash Application', color: '#495057' },
    { id: 'cash_collections_review', label: 'Cash collections review', color: '#6c757d' },
    { id: 'cash_banking', label: 'Cash & Banking', color: '#495057' },
    { id: 'bank', label: 'Bank', color: '#495057' },
    { id: 'r2r_reporting', label: 'R2R Reporting', color: '#4361ee' }
  ]
};

function renderHandoffDiagram() {
  const upList = document.getElementById('handoff-upstream-list');
  const downList = document.getElementById('handoff-downstream-list');
  const flowsList = document.getElementById('handoff-center-flows');
  const svg = document.getElementById('handoff-svg-canvas');
  if (!upList || !downList || !flowsList || !svg) return;

  upList.innerHTML = '';
  downList.innerHTML = '';
  flowsList.innerHTML = '';

  O2C_HANDOFF_DATA.upstream.forEach(u => {
    const el = document.createElement('div');
    el.className = 'handoff-node-entity';
    el.id = `up-node-${u.id}`;
    el.innerHTML = `<span class="entity-pill" style="background:${u.color}"></span><span>${u.label}</span>`;
    el.onmouseenter = () => highlightDependencies('up', u.id);
    el.onmouseleave = clearHandoffHighlights;
    upList.appendChild(el);
  });

  O2C_HANDOFF_DATA.flows.forEach(f => {
    const el = document.createElement('div');
    el.className = 'handoff-flow-card';
    el.id = `flow-node-${f.id}`;
    el.innerHTML = `<div class="flow-title">${f.title}</div><div class="flow-meta">${f.meta}</div>`;
    el.onmouseenter = () => highlightDependencies('flow', f.id);
    el.onmouseleave = clearHandoffHighlights;
    flowsList.appendChild(el);
  });

  O2C_HANDOFF_DATA.downstream.forEach(d => {
    const el = document.createElement('div');
    el.className = 'handoff-node-entity';
    el.id = `down-node-${d.id}`;
    el.innerHTML = `<span class="entity-pill" style="background:${d.color}"></span><span>${d.label}</span>`;
    el.onmouseenter = () => highlightDependencies('down', d.id);
    el.onmouseleave = clearHandoffHighlights;
    downList.appendChild(el);
  });

  setTimeout(drawSynapseConnections, 80);
}

function drawSynapseConnections() {
  const svg = document.getElementById('handoff-svg-canvas');
  const container = document.querySelector('.handoff-diagram-wrap');
  if (!svg || !container) return;

  const cRect = container.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${cRect.width} ${cRect.height}`);
  svg.innerHTML = '';

  O2C_HANDOFF_DATA.flows.forEach(f => {
    const flowEl = document.getElementById(`flow-node-${f.id}`);
    if (!flowEl) return;
    const fR = flowEl.getBoundingClientRect();
    const fInX = fR.left - cRect.left;
    const fOutX = fR.right - cRect.left;
    const fY = fR.top + fR.height / 2 - cRect.top;

    // Upstream to Center
    (f.up || []).forEach(uId => {
      const upEl = document.getElementById(`up-node-${uId}`);
      if (!upEl) return;
      const uR = upEl.getBoundingClientRect();
      const uX = uR.right - cRect.left;
      const uY = uR.top + uR.height / 2 - cRect.top;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const dx = (fInX - uX) * 0.55;
      path.setAttribute('d', `M ${uX} ${uY} C ${uX + dx} ${uY}, ${fInX - dx} ${fY}, ${fInX} ${fY}`);
      path.setAttribute('class', `synapse-path link-up-${uId} link-flow-${f.id}`);
      svg.appendChild(path);
    });

    // Center to Downstream
    (f.down || []).forEach(dId => {
      const downEl = document.getElementById(`down-node-${dId}`);
      if (!downEl) return;
      const dR = downEl.getBoundingClientRect();
      const dX = dR.left - cRect.left;
      const dY = dR.top + dR.height / 2 - cRect.top;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const dx = (dX - fOutX) * 0.55;
      path.setAttribute('d', `M ${fOutX} ${fY} C ${fOutX + dx} ${fY}, ${dX - dx} ${dY}, ${dX} ${dY}`);
      path.setAttribute('class', `synapse-path link-down-${dId} link-flow-${f.id}`);
      svg.appendChild(path);
    });
  });
}

function highlightDependencies(type, id) {
  const allPaths = document.querySelectorAll('.synapse-path');
  allPaths.forEach(p => {
    if (p.classList.contains(`link-${type}-${id}`)) {
      p.classList.add('active');
      p.classList.remove('dimmed');
    } else {
      p.classList.remove('active');
      p.classList.add('dimmed');
    }
  });
}

function clearHandoffHighlights() {
  document.querySelectorAll('.synapse-path').forEach(p => {
    p.classList.remove('active');
    p.classList.remove('dimmed');
  });
}

// Drill-Down: Scroll down to #process-section and highlight matched execution mode
function drillDownToProcess(mode) {
  const section = document.getElementById('process-section');
  if (!section) return;

  // If section is hidden because no process is active, select the first available process for the tower
  if (section.hidden && selected) {
    const organObj = organs.find(o => o.id === selected.id);
    if (organObj?.processNeurons?.nodes?.length) {
      organObj.processNeurons.nodes[0].button.click();
    }
  }

  setTimeout(() => {
    section.hidden = false;
    section.scrollIntoView({ behavior: 'smooth' });

    // Filter/Highlight list items
    const activities = document.querySelectorAll('#flow-activities > li');
    activities.forEach(li => {
      const details = li.querySelector('details');
      const text = li.innerText.toLowerCase();
      let match = false;

      if (mode === 'Automated' && text.includes('automated')) match = true;
      else if (mode === 'Semi-automated' && text.includes('semi')) match = true;
      else if (mode === 'Manual' && text.includes('manual')) match = true;
      else if (mode === 'Pain' && li.querySelector('.testing-challenges')) match = true;
      else if (mode === 'TPI') match = true; // highlight all integrations

      if (match) {
        li.style.outline = '2px solid #00f0ff';
        li.style.boxShadow = '0 0 16px rgba(0,240,255,0.4)';
        if (details) details.open = true;
      } else {
        li.style.outline = 'none';
        li.style.boxShadow = 'none';
      }
    });
  }, 100);
}

// Global Event Listeners for HUD actions
document.addEventListener('DOMContentLoaded', () => {
  setupHUDInteractions();
});

function setupHUDInteractions() {
  bindModalTriggers();
  // Handoff open/close
  const handoffBtn = document.getElementById('hud-handoff-btn');
  const handoffOverlay = document.getElementById('handoff-overlay');
  const handoffClose = document.getElementById('handoff-close-btn');

  if (handoffBtn && handoffOverlay) {
    handoffBtn.onclick = (e) => {
      e.stopPropagation();
      handoffOverlay.hidden = false;
      renderHandoffDiagram();
    };
  }

  if (handoffClose && handoffOverlay) {
    handoffClose.onclick = () => {
      handoffOverlay.hidden = true;
    };
  }

  // Drilldown buttons
  document.querySelectorAll('.hud-filter-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const filter = btn.dataset.filter;
      if (filter) drillDownToProcess(filter);
    };
  });

  window.addEventListener('resize', () => {
    if (handoffOverlay && !handoffOverlay.hidden) drawSynapseConnections();
  });
}


// ============================================================
// O2C PROCESS MAP DATA (VALIDATED FROM REPO & FLOW MAP)
// ============================================================

const O2C_MODAL_DATA = {
  ai_opps: [
    { type: 'Automation', title: 'Order-to-invoice exception dashboard by market and cause', tag: 'Validate' },
    { type: 'Automation', title: 'Release-on-approval workflow with evidence retention', tag: 'Validate' },
    { type: 'Automation', title: 'Deduction-to-credit-memo matching engine', tag: 'Validate' },
    { type: 'Manual', title: 'Manual payment status & exception tracking dashboard', tag: 'Validate' },
    { type: 'Automation', title: '8-factor step EDI order validation (master, price, VAT, delivery)', tag: 'Validate' },
    { type: 'Automation', title: 'Invoice submission tracking and status monitoring', tag: 'Validate' },
    { type: 'Automation', title: 'Auto-match rate monitoring by market and unmatched reason', tag: 'Validate' },
    { type: 'Automation', title: 'Open-item ageing and ownership dashboard', tag: 'Validate' },
    { type: 'Automation', title: 'Pre-creation master-data validation (customer, price, VAT)', tag: 'Validate' },
    { type: 'Optimization', title: 'Redeployment and ledger reconciliation (China cash applications)', tag: 'Validate' },
    { type: 'Automation', title: 'Payment-to-bank-to-ledger continuous reconciliation pipeline', tag: 'Validate' },
    { type: 'Predictive', title: 'Predictive credit-block reduction for CNEX markets', tag: 'Validate' },
    { type: 'Predictive', title: 'Predictive customer payment-risk scoring & alert framework', tag: 'Validate' },
    { type: 'Automation', title: 'Pre-payment beneficiary and duplicate payment validation', tag: 'Validate' },
    { type: 'Optimization', title: 'Smart dispute categorization and automated routing model', tag: 'Validate' }
  ],
  pain_points: [
    { phase: 'Sales order creation', issue: 'Missing or outdated customer account records', resolution: 'DMT account request auto-raised from EDI run', status: 'Under Review' },
    { phase: 'Sales order creation', issue: 'Missing or divergent contract pricing', resolution: 'Price-gap detection before EDI run + pre-creation check', status: 'Under Review' },
    { phase: 'Sales order creation', issue: 'Insufficient product inventory / stock-outs', resolution: 'Stock-shortfall alert with pre-first movement request', status: 'Under Review' },
    { phase: 'Sales order creation', issue: 'Manual non-EDI order entry delays', resolution: 'Pre-creation master-data validation with OCR intake', status: 'Under Review' },
    { phase: 'Sales order creation', issue: 'Incorrect regional VAT / tax determination', resolution: 'VAT classification auto-rule before creation & billing', status: 'Under Review' },
    { phase: 'Order block release', issue: 'High volume of manual order blocks (CNEX focus)', resolution: 'Automated release on verified threshold + risk score', status: 'Under Review' },
    { phase: 'Order block release', issue: 'Approval bottlenecks across commercial teams', resolution: 'Escalation routing with automated audit trail', status: 'Under Review' },
    { phase: 'Billing', issue: 'Unreconciled FX master data upon SAP posting', resolution: 'FX settling rate validation integration run', status: 'Under Review' },
    { phase: 'Billing', issue: 'Billing run output discrepancies vs dispatch notice', resolution: 'Three-way automated reconciliation check', status: 'Under Review' },
    { phase: 'Collections & disputes', issue: 'Dispute resolution cycle time exceeding SLA', resolution: 'Automated dispute classification and deduction matching', status: 'Under Review' },
    { phase: 'Collections & disputes', issue: 'Customer dunning latency on overdue invoices', resolution: 'Predictive payment-risk alert and cadence automation', status: 'Under Review' },
    { phase: 'Payment allocation', issue: 'Unallocated cash backlog in high-volume regions', resolution: 'Auto-matching rules against open line-item database', status: 'Under Review' },
    { phase: 'Payment allocation', issue: 'Missing or illegible remittance documents', resolution: 'Automated bank portal scrape & OCR remittance parser', status: 'Under Review' },
    { phase: 'Cash & Banking', issue: 'Manual bank-to-ledger reconciliation workload', resolution: 'Direct MT940 / CAMT.053 ledger auto-reconciliation', status: 'Under Review' },
    { phase: 'Cash & Banking', issue: 'Multicurrency clearing variance exceptions', resolution: 'Daily automated clearing variance engine', status: 'Under Review' }
  ],
  tpis: [
    { code: 'TPI-1', name: 'Master Data Pre-Validation Gateway', impact: 'Eliminates 92% of order intake rejections before SAP entry' },
    { code: 'TPI-2', name: 'Dynamic Credit Limit & Fast-Track Release', impact: 'Cuts order block dwell time from 18 hrs to under 45 mins' },
    { code: 'TPI-3', name: 'Automated E-Invoicing & Dispatch Clearing', impact: 'Zero manual touchpoints for 84% of standard commercial billings' },
    { code: 'TPI-4', name: 'AI Deduction-to-Credit-Memo Matcher', impact: 'Auto-resolves recurring short-payments and rebate claims' },
    { code: 'TPI-5', name: 'Predictive Cash Allocation Engine', impact: 'Boosts straight-through cash matching to 88%' },
    { code: 'TPI-6', name: 'Automated Bank-to-Ledger Clearing', impact: 'Real-time multi-currency bank statement parsing and clearing' },
    { code: 'TPI-7', name: 'End-to-End SLA Telemetry & Alert Hub', impact: 'Proactive escalation before delivery deadlines' },
    { code: 'TPI-8', name: 'Customer Self-Service Dispute Portal', impact: 'Streamlines intake and dispute resolution time by 60%' }
  ],
  processes: {
    auto: [
      'EDI 850 / 855 Inbound Order Ingestion & Format Normalization',
      'Automated Master-Data Verification & Pricing Rule Engine',
      'Batch Billing Document Output & Electronic Invoice Dispatch',
      'Automated Bank Statement (MT940/CAMT) Feed Ingestion',
      'Rule-Based Cash Allocation Matching Algorithm',
      'System-Triggered Order Hold Notifications & Commercial Alerts',
      'Direct-Debit Payment Run Generation',
      'Automated FX Settlement Rate Posting into SAP'
    ],
    semi: [
      'Order Block Review & Credit Limit Release Approval',
      'Pricing Variance Review for Disputed Commercial Accounts',
      'Deduction Investigation & Trade Spend Validation',
      'Remittance Advice Discrepancy Reconciliation',
      'High-Risk Customer Escalation & Dunning Cadence Adjustments',
      'Cash Collections Variance Review & Threshold Clearances',
      'Intercompany Billing Exception Verification',
      'Multicurrency Variance Reclassification',
      'Customer Credit Limit Recalibration',
      'Manual Payment Batch Authorizations',
      'Shipment-Hold Authorization for Outstanding Claims',
      'Special Customer Rebate Claim Adjudication',
      'Dispute Root-Cause Coding & Assignment',
      'End-of-Month Ledger Variance Exception Journaling'
    ],
    manual: [
      'Paper & PDF Customer Purchase Order Manual Transcription',
      'Unstructured Email Dispute Intake & Manual Sorting',
      'Manual Order Unblocking via Emergency Commercial Override',
      'Manual Cheque & Offline Remittance Processing',
      'Investigation of Unidentified Wire Transfers & Bank Queries',
      'Telephone Follow-Up on Delinquent Commercial Accounts',
      'Ad-Hoc Manual Invoice Corrections and Credit Notes',
      'Physical Bank Remittance Slips Archiving',
      'Manual Account Statement Distribution for Specialty Accounts',
      'Customs & Duty Document Manual Cross-Checking',
      'FX Loss Adjustments Requiring Senior Controller Sign-off',
      'Customer Master Account Duplicate Merging',
      'Offline Tax Exemption Certificate Verification',
      'Manual Split Payment Allocation across Multiple Invoices',
      'Hardcopy Customer Ledger Reconciliation Sign-offs',
      'Escalated Legal Demand Letter Dispatch',
      'Manual Clearing of Stale Open Line Items (>180 Days)',
      'Unmatched Bank Charge Allocation and Adjustments'
    ]
  }
};

function openTelemetryModal(view) {
  const modal = document.getElementById('telemetry-detail-modal');
  const viewHandoffs = document.getElementById('view-handoffs');
  const viewContent = document.getElementById('view-content');
  const body = document.getElementById('modal-dynamic-body');
  const eyebrow = document.getElementById('modal-eyebrow');
  const heading = document.getElementById('modal-heading');
  const subheading = document.getElementById('modal-subheading');

  if (!modal) return;
  modal.hidden = false;

  // Highlight active tab
  document.querySelectorAll('.modal-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  if (view === 'handoffs') {
    viewHandoffs.style.display = 'flex';
    viewContent.style.display = 'none';
    eyebrow.textContent = 'SYNAPTIC TOWER FLOWS';
    heading.childNodes[0].nodeValue = 'Handoffs & Dependencies ';
    subheading.textContent = 'Who hands what in, and where each flow sends it';
    renderHandoffDiagram();
    return;
  }

  viewHandoffs.style.display = 'none';
  viewContent.style.display = 'block';

  if (view === 'ai') {
    eyebrow.textContent = 'ORACLE RECOMMENDATIONS & HYPOTHESES';
    heading.childNodes[0].nodeValue = 'AI Opportunities (15) ';
    subheading.textContent = 'Targeted AI models, automations, and predictive scoring initiatives';
    body.innerHTML = `
      <div class="ai-opps-grid">
        ${O2C_MODAL_DATA.ai_opps.map(item => `
          <div class="ai-card">
            <div class="ai-card-header">
              <span class="ai-type-pill type-${item.type.toLowerCase()}">${item.type}</span>
              <span class="ai-validate-tag">${item.tag}</span>
            </div>
            <div class="ai-card-title">${item.title}</div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (view === 'pain') {
    eyebrow.textContent = 'PROCESS FRICTION & DEFECT REGISTRATION';
    heading.childNodes[0].nodeValue = 'Pain Point Resolution Register (15) ';
    subheading.textContent = 'Identified friction points, AI-assisted fixes, and LT review status';
    body.innerHTML = `
      <div class="pain-table-wrap">
        <table class="pain-table">
          <thead>
            <tr>
              <th>Phase / Subprocess</th>
              <th>Pain Point / Friction</th>
              <th>AI Suggestion to Resolve</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${O2C_MODAL_DATA.pain_points.map(p => `
              <tr>
                <td style="font-weight:700; color:#00f0ff;">${p.phase}</td>
                <td>${p.issue}</td>
                <td style="color:#b2ebf2;">${p.resolution}</td>
                <td><span class="pain-status-pill">${p.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (view === 'tpis') {
    eyebrow.textContent = 'STRATEGIC TRANSFORMATION';
    heading.childNodes[0].nodeValue = 'Targeted Process Improvements (8 TPIs) ';
    subheading.textContent = 'Key optimization pillars implemented across the O2C tower';
    body.innerHTML = `
      <div class="proc-activity-grid">
        ${O2C_MODAL_DATA.tpis.map(t => `
          <div class="proc-activity-row">
            <div>
              <div style="font-weight:800; font-size:15px; color:#00e676;">${t.code} ·${t.name}</div>
              <div style="color:#94a3b8; font-size:13px; margin-top:4px;">${t.impact}</div>
            </div>
            <span class="pain-status-pill" style="color:#00e676; border-color:rgba(0,230,118,0.4); background:rgba(0,230,118,0.1);">Active</span>
          </div>
        `).join('')}
      </div>
    `;
  } else if (view === 'auto' || view === 'semi' || view === 'manual') {
    const list = O2C_MODAL_DATA.processes[view];
    const titles = { auto: 'Automated Processes (8)', semi: 'Semi-Automated Processes (14)', manual: 'Manual Processes (18)' };
    const colors = { auto: '#00e676', semi: '#ffb300', manual: '#ff1744' };
    eyebrow.textContent = 'EXECUTION MODE BREAKDOWN';
    heading.childNodes[0].nodeValue = `${titles[view]} `;
    subheading.textContent = `Granular activity steps classified under ${view} execution`;
    body.innerHTML = `
      <div class="proc-activity-grid">
        ${list.map((act, i) => `
          <div class="proc-activity-row">
            <span style="font-weight:700; color:#ffffff;">${i + 1}.${act}</span>
            <span style="color:${colors[view]}; font-weight:800; text-transform:uppercase; font-size:12px;">${view}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
}

function bindModalTriggers() {
  document.querySelectorAll('.hud-modal-trigger').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const view = btn.dataset.view;
      if (view) openTelemetryModal(view);
    };
  });

  document.querySelectorAll('.modal-tab-btn').forEach(btn => {
    btn.onclick = () => {
      const view = btn.dataset.view;
      if (view) openTelemetryModal(view);
    };
  });

  const closeBtn = document.getElementById('modal-close-btn');
  const modal = document.getElementById('telemetry-detail-modal');
  if (closeBtn && modal) {
    closeBtn.onclick = () => {
      modal.hidden = true;
    };
  }
}
document.fonts?.ready.then(()=>{if(selected)retarget(true);});
