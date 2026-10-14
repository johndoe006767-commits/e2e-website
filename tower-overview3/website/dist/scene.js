import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {loadReplacement} from './models.js';
import {buildVesselNetwork} from './vessels.js';
import {createProcessNeurons,updateProcessNeurons} from './process-neurons.js';
import {initProcessFlow} from './process-flow.js';
const $=s=>document.querySelector(s);
const configs=[['brain','FP&A Commercial','Brain',-1,0,.18],['liver','CAPEX','Liver',-1,1,.25],['kidneys','Controlling','Kidneys',-1,2,.23],['spleen','Tax','Spleen',-1,3,.12],['lungs','R2R','Lungs',1,0,.32],['stomach','P2P','Stomach',1,1,.17],['pancreas','FP&A Operations','Pancreas',1,2,.20],['intestines','O2C','Intestines',1,3,.29]];
const reduced=matchMedia('(prefers-reduced-motion: reduce)'), fine=matchMedia('(hover: hover) and (pointer: fine)');
const skeletonOpacity=.6; // 1 = solid bones; lower values make the skeleton more see-through
let renderer,scene,camera,heart,bones,skull,ready=false,expanded=false,separation=0,separationTarget=0,selected=null,hover=null,animation=0,last=0,time=0,w=1,h=1,mobile=false,drag=null,lastTrigger=null;
let sceneInView=true;
const sceneObserver=new IntersectionObserver(([entry])=>sceneInView=entry.isIntersecting);sceneObserver.observe($('#section-1'));
const autoTurnAxis=new T.Vector3(0,1,0),autoTurnStep=new T.Quaternion(),autoTurnSpeed=Math.PI/30;
const organs=[],ray=new T.Raycaster(),pointer=new T.Vector2(),p=new T.Vector3();
// All continuous motion stays in Three.js, outside UI rendering.
function ease(x){ // Skill's cubic-bezier(.77,0,.175,1), inverted on its x axis.
 let lo=0,hi=1,t=x;for(let i=0;i<12;i++){t=(lo+hi)/2;const v=3*(1-t)*(1-t)*t*.77+3*(1-t)*t*t*.175+t*t*t;if(v<x)lo=t;else hi=t;}return 3*(1-t)*t*t+t*t*t;
}
function resize(){w=innerWidth;h=Math.max(innerHeight,innerWidth<768?700:640);mobile=w<768;renderer.setSize(w,h);const half=1.10;camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();if(ready){buildConnections();retarget(true);}}
function separatedPosition(o){const x=mobile?camera.right*.68:Math.min(camera.right*.49,1.12);return new T.Vector3(o.side*x,1.48-o.row*.355,.20);}
function overviewTarget(o){return o.home.clone().lerp(separatedPosition(o),separation);}
function overviewScale(o){return T.MathUtils.lerp(o.size,mobile?.17:.23,separation);}
function retarget(instant=false){for(const o of organs){o.flight=true;o.from=o.root.position.clone();o.to=selected===o?new T.Vector3(0,.88,.8):overviewTarget(o);o.fromScale=o.root.scale.x;o.toScale=selected===o?Math.min(2.2,camera.right-camera.left)*.8:overviewScale(o);o.start=performance.now();o.duration=instant||reduced.matches?0:700;o.fromQuat=o.root.quaternion.clone();o.toQuat=new T.Quaternion();} }
function setSeparation(value){if(!ready||selected)return;separationTarget=T.MathUtils.clamp(value,0,1);expanded=separationTarget>.5;$('#assembly').value=String(Math.round(separationTarget*1000));}
function setView(value){setSeparation(value?1:0);}
function select(o,trigger){if(!ready||selected)return;lastTrigger=trigger||o.label;$('#process-status').textContent='';selected=o;o.rotationTarget=new T.Quaternion();hover=null;document.body.dataset.detail='true';$('#detail').hidden=false;$('#organ-name').textContent=o.organ;$('#tower-name').textContent=o.name;updateTelemetryHUD(o.id);$('#back').focus({preventScroll:true});$('#scene').tabIndex=0;$('#scene').setAttribute('aria-label',`${o.name} ${o.organ}. Scroll to rotate left or right. Drag or use arrow keys to rotate in all directions.`);retarget();}
function close(){if(!selected)return;selected=null;$('#scene').setAttribute('aria-label','Skeleton, heart and eight finance organs');document.body.dataset.detail='false';$('#detail').hidden=true;retarget();lastTrigger?.focus({preventScroll:true});}
// Exact tapered Catmull-Rom tubes and traveling flow shader from tower-overview2.
function buildConnections(){organs.forEach((o,index)=>{
 if(o.vein){scene.remove(o.vein);o.vein.geometry.dispose();o.vein.material.dispose();}
 const origin=heart.position.clone().add(new T.Vector3(0,.02,.035));
 const geometry=buildVesselNetwork(origin,o.home,separatedPosition(o),1,o.side,index*31+7);
      const uniforms = {
        uSeparation: { value: 0 },
        uTime: { value: 0 },
        uHoverOffset: { value: new T.Vector3() },
      };
      const material = new T.MeshPhysicalMaterial({
        color: '#ad566c',
        transparent: true,
        opacity: 0.46,
        roughness: 0.26,
        metalness: 0,
        depthWrite: false,
        side: T.DoubleSide,
        envMapIntensity: 0.25,
      });
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader =
          'attribute vec3 expandedPosition; attribute vec3 expandedNormal; attribute float branchSeed; uniform float uSeparation; uniform vec3 uHoverOffset; varying float vPath; varying float vBranch;\n' +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <beginnormal_vertex>',
          '#include <beginnormal_vertex>\nobjectNormal = normalize(mix(normal,expandedNormal,uSeparation));',
        );
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\ntransformed = mix(position,expandedPosition,uSeparation) + uHoverOffset * smoothstep(0.45,1.0,uv.x); vPath=uv.x; vBranch=branchSeed;',
        );
        shader.fragmentShader =
          'uniform float uTime; varying float vPath; varying float vBranch;\n' +
          shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          '#include <color_fragment>\nfloat flow = 0.5 + 0.5*sin(vPath*10.0-uTime*3.8+vBranch*2.3); diffuseColor.rgb *= 0.7+0.4*flow; diffuseColor.a *= 0.5+0.5*flow;',
        );
      };
      material.customProgramCacheKey = () => 'gfs-branching-vessels-v1';
      const mesh = new T.Mesh(geometry, material);
      mesh.frustumCulled = false;

 mesh.renderOrder=4;scene.add(mesh);o.vein=mesh;o.vesselUniforms=uniforms;
});}
function fail(error){console.error(error);$('#loading').hidden=false;$('#load-message').textContent='The anatomy could not load. Please retry in a WebGL-enabled browser.';$('#retry').hidden=false;}
async function init(){try{
renderer=new T.WebGLRenderer({canvas:$('#scene'),antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0x331c41,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
scene=new T.Scene();camera=new T.OrthographicCamera(-1,1,1,-1,.01,20);camera.position.set(0,.86,5);camera.lookAt(0,.86,0);
scene.add(new T.HemisphereLight(0xfff4ed,0x765580,2.2));const light=new T.DirectionalLight(0xfff5ee,3);light.position.set(-2,3,4);scene.add(light);const rim=new T.DirectionalLight(0xe9d3e8,1.6);rim.position.set(3,2,-2);scene.add(rim);
bones=new T.Group();scene.add(bones);
const [atlasResponse,bodyResponse,processResponse]=await Promise.all([fetch('./data/anatomy/atlas.json'),fetch('./data/anatomy/body.bin.gz'),fetch('./data/processes.json')]);if(!processResponse.ok)throw Error('Process data missing');const processData=await processResponse.json();if(!atlasResponse.ok||!bodyResponse.ok)throw Error('Atlas missing');const atlas=await atlasResponse.json();const zip=await bodyResponse.arrayBuffer();const buffer=await new Response(new Blob([zip]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();if(buffer.byteLength!==atlas.bytes)throw Error('Incomplete atlas');
const grouped=new Map(),homes=new Map();for(const part of atlas.parts){const bounds=new T.Box3(new T.Vector3(...part.bounds[0]),new T.Vector3(...part.bounds[1]));if(!homes.has(part.group))homes.set(part.group,bounds);else homes.get(part.group).union(bounds);if(!['skeleton','heart'].includes(part.group))continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,part.positions,part.vertexCount*3),3));g.setAttribute('normal',new T.BufferAttribute(new Int16Array(buffer,part.normals,part.vertexCount*3),3,true));g.setIndex(new T.BufferAttribute(new Uint32Array(buffer,part.indices,part.indexCount),1));const id=part.group==='skeleton'&&part.bounds[0][1]>1.45?'skull':part.group;if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push(g);}
for(const [id,pieces]of grouped){const geo=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());const mat=new T.MeshPhysicalMaterial({color:id==='heart'?0xc72e66:0xe1ddd2,roughness:.45,metalness:.02,clearcoat:.16,depthTest:false,transparent:true,opacity:1});const mesh=new T.Mesh(geo,mat);mesh.renderOrder=id==='heart'?11:-1/* skeleton draws first, behind organs, vessels and heart */;if(id==='heart'){geo.computeBoundingBox();const c=geo.boundingBox.getCenter(new T.Vector3());geo.translate(-c.x,-c.y,-c.z);mesh.position.copy(c);heart=mesh;heart.position.z=.23;scene.add(mesh);}else{bones.add(mesh);if(id==='skull')skull=mesh;}}
for(const [id,name,organ,side,row,size] of configs){const {model,geometry,network}=await loadReplacement(id);geometry.computeBoundingBox();const visibleBounds=geometry.boundingBox.clone();const root=new T.Group();root.add(model);root.updateMatrixWorld(true);const box=visibleBounds;const center=box.getCenter(new T.Vector3());model.position.sub(center);const max=Math.max(...box.getSize(new T.Vector3()).toArray());model.scale.multiplyScalar(1/max);model.position.multiplyScalar(1/max);const home=homes.get(id).getCenter(new T.Vector3());home.z=Math.max(home.z,.13);if(id==='brain')home.z=.015;root.position.copy(home);root.scale.setScalar(size);scene.add(root);
const label=document.createElement('button');label.className=`label ${side<0?'left':'right'}`;label.innerHTML=`<small>${organ}</small><strong>${name}</strong><span>Explore tower ↗</span>`;label.setAttribute('aria-label',`Explore ${name}, ${organ}`);$('#labels').append(label);
const o={id,name,organ,side,row,size,root,home,label,from:home.clone(),to:home.clone(),fromScale:size,toScale:size,start:0,duration:0,fromQuat:new T.Quaternion(),toQuat:new T.Quaternion(),hoverAmount:0};root.traverse(m=>{if(m.isMesh)m.userData.organ=o;});label.onclick=()=>select(o,label);label.onpointerenter=()=>{if(fine.matches)hover=o;};label.onpointerleave=()=>{hover=null;};
o.processNeurons=createProcessNeurons(o,network,processData.towers.find(t=>t.id===id).processes,$('#process-neurons'));geometry.dispose();organs.push(o);$('#load-message').textContent=`Preparing ${organ.toLowerCase()}…`;}
initProcessFlow(processData);
ready=true;resize();$('#loading').hidden=true;addEventListener('resize',resize);frame(performance.now());
}catch(error){fail(error);}}
function frame(now){if(!sceneInView){last=now;animation=requestAnimationFrame(frame);return;}const dt=Math.min((now-last)/1000,.05);last=now;time+=dt;separation=reduced.matches?separationTarget:T.MathUtils.lerp(separation,separationTarget,1-Math.exp(-dt*12));if(Math.abs(separation-separationTarget)<.0001)separation=separationTarget;const beat=reduced.matches?1:1.12+Math.pow(Math.max(0,Math.sin(time*6)),8)*.035;heart.scale.setScalar(beat);
const bodyAlpha=selected?0:1;for(const mesh of bones.children){const target=(mesh===skull?T.MathUtils.lerp(.20,1,separation):1)*skeletonOpacity;mesh.material.opacity+=(target*bodyAlpha-mesh.material.opacity)*Math.min(1,dt*10);mesh.visible=mesh.material.opacity>.01;}heart.visible=!selected;
for(const o of organs){const t=o.duration?Math.min(1,(now-o.start)/o.duration):1;const e=ease(t);if(!selected&&(!o.flight||t===1)){o.flight=false;o.root.position.copy(overviewTarget(o));o.root.scale.setScalar(overviewScale(o));}else{o.root.position.lerpVectors(o.from,o.to,e);o.root.scale.setScalar(T.MathUtils.lerp(o.fromScale,o.toScale,e));}if(t<1||selected!==o)o.root.quaternion.slerpQuaternions(o.fromQuat,o.toQuat,e);else if(o.rotationTarget){
 // Advance from the current angle so releasing a drag never restarts the turn.
 if(!reduced.matches&&!drag){
  o.rotationTarget.premultiply(autoTurnStep.setFromAxisAngle(autoTurnAxis,dt*autoTurnSpeed));
 }
 o.root.quaternion.slerp(o.rotationTarget,reduced.matches?1:1-Math.exp(-dt*14));
}o.hoverAmount+=((hover===o&&!selected?1:0)-o.hoverAmount)*Math.min(1,dt*10);if(!reduced.matches){o.root.position.y+=Math.sin(time*2.1)*.008*o.hoverAmount;if(!selected)o.root.rotation.z=Math.sin(time*1.6)*.045*o.hoverAmount;}
o.root.visible=!selected||selected===o;o.vein.visible=!selected;
o.vesselUniforms.uSeparation.value=separation;
o.vesselUniforms.uTime.value=time*(reduced.matches?.2:1);
o.vesselUniforms.uHoverOffset.value.copy(o.root.position).sub(overviewTarget(o));
const visible=separation>.55&&!selected;const labelAlpha=T.MathUtils.smoothstep(separation,.55,.9);
o.label.style.visibility=visible?'visible':'hidden';o.label.style.opacity=visible?String(labelAlpha):'0';o.label.tabIndex=visible?0:-1;
if(visible){p.copy(o.root.position).project(camera);const x=(p.x+1)*w/2,y=(1-p.y)*h/2;let lx,ly;if(mobile){lx=x-o.label.offsetWidth/2;ly=y+27;}else{const gap=o.root.scale.x/2*h/2.2+18;lx=o.side<0?x-gap-o.label.offsetWidth:x+gap;ly=y-o.label.offsetHeight/2;}lx=Math.max(12,Math.min(w-o.label.offsetWidth-12,lx));o.label.style.translate=`${lx}px ${ly}px`;}}
for(const o of organs)updateProcessNeurons(o,selected===o&&(o.duration===0||now-o.start>o.duration*.85),camera,w,h,time,reduced.matches);
renderer.render(scene,camera);animation=requestAnimationFrame(frame);}
function hit(event){const rect=$('#scene').getBoundingClientRect();pointer.set((event.clientX-rect.left)/w*2-1,-(event.clientY-rect.top)/h*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(organs.map(o=>o.root),true).find(x=>x.object.visible&&x.object.userData.organ)?.object.userData.organ;}
$('#assembly').addEventListener('input',e=>setSeparation(Number(e.target.value)/1000));$('#back').onclick=close;$('#retry').onclick=()=>location.reload();$('#reset').onclick=()=>{if(selected){selected.fromQuat=selected.root.quaternion.clone();selected.toQuat.identity();selected.rotationTarget.identity();selected.from.copy(selected.root.position);selected.fromScale=selected.root.scale.x;selected.start=performance.now();selected.duration=reduced.matches?0:250;}};
// Wheel/trackpad progress is continuous and reversible; no document scroll listener.
$('#experience').addEventListener('wheel',e=>{if(e.ctrlKey||!ready)return;e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?h:1;const delta=T.MathUtils.clamp(e.deltaY*unit,-120,120);if(selected){selected.rotationTarget.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),delta*.006));}else setSeparation(separationTarget+delta/1800);},{passive:false});
const canvas=$('#scene');canvas.addEventListener('pointerdown',e=>{if(!ready||e.button!==0)return;if(selected)selected.rotationTarget.copy(selected.root.quaternion);drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!ready)return;if(drag&&selected){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;selected.root.quaternion.premultiply(new T.Quaternion().setFromEuler(new T.Euler(dy*.009,dx*.009,0)));selected.rotationTarget.copy(selected.root.quaternion);selected.duration=0;drag.x=e.clientX;drag.y=e.clientY;}else if(drag&&!selected&&e.pointerType==='touch'){setSeparation(separationTarget+(drag.y-e.clientY)/650);drag.x=e.clientX;drag.y=e.clientY;}else if(!selected&&fine.matches){hover=hit(e);canvas.style.cursor=hover?'pointer':'default';}});canvas.addEventListener('pointerup',e=>{if(drag&&!selected&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<6){const o=hit(e);if(o)select(o);}drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);});canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('lostpointercapture',()=>drag=null);canvas.addEventListener('pointerleave',()=>hover=null);
addEventListener('keydown',e=>{if(e.key==='Escape')close();if(selected&&e.target===canvas&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();selected.duration=0;selected.root.quaternion.premultiply(new T.Quaternion().setFromEuler(new T.Euler(e.key==='ArrowUp'?-.15:e.key==='ArrowDown'?.15:0,e.key==='ArrowLeft'?-.15:e.key==='ArrowRight'?.15:0,0)));selected.rotationTarget.copy(selected.root.quaternion);}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(animation);fail(new Error('WebGL context lost'));});
// Keyboard users can explore each organ in either view, without visual label overlap.
for(const config of configs){const b=document.createElement('button');b.textContent=`Explore ${config[1]}`;b.className='keyboard-organ';b.onclick=()=>{const o=organs.find(o=>o.id===config[0]);if(o)select(o,b);};$('#experience').append(b);}
init();

addEventListener('pagehide',()=>{cancelAnimationFrame(animation);sceneObserver.disconnect();renderer?.dispose();scene?.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});});


const TOWER_HEALTH = {
  lungs: { name: 'R2R', auto: 14, semi: 32, manual: 42, tpis: 4, pain: 4 },
  intestines: { name: 'O2C', auto: 24, semi: 38, manual: 26, tpis: 6, pain: 5 },
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
