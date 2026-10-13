import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ORGANS, placementSide } from './game';

import {createSkeletonRig,type BonePart} from './skeleton-rig';
import {createAnatomyMesh} from './anatomy-meshes';

type Part = BonePart & {group:string; positions:number; normals:number; indices:number; vertexCount:number; indexCount:number};
export type Target = {id:string; x:number; y:number; width:number; height:number};
export type BodyScene = {
  celebrate: ()=>void;
  rotate: (radians:number)=>void;
  reset: ()=>void;
  setPlaced: (ids:string[])=>void;
  target: (id:string)=>Target | null;
  dispose: ()=>void;
};
const HEIGHT=1.7066899556666613*1.035;
const WIDTH=.6478489935398102*1.035;
const CENTER=.8609762778505683;
const colors:Record<string,string>={skeleton:'#dbd6c5',heart:'#b6335c',brain:'#d291b0',lungs:'#d9976a',liver:'#ac6552',stomach:'#e2b652',kidneys:'#cb657b',pancreas:'#c8bc64',intestines:'#8bc3ba',spleen:'#9f70b7'};
const depths:Record<string,number>={brain:-.02,heart:.015,lungs:0,liver:.03,stomach:.025,kidneys:-.055,pancreas:-.01,intestines:.025,esophagus:-.045,biceps:.07,quadriceps:.08,calves:-.06,hamstrings:-.075,triceps:-.06,glutes:-.1};

// Three.js owns its canvas and projected marker positions. No React render loop.
export function createBodyScene(host:HTMLDivElement, onReady:()=>void, onError:(message:string)=>void):BodyScene {
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.3;
  renderer.domElement.className='anatomy-canvas';
  renderer.domElement.setAttribute('aria-hidden','true');
  host.prepend(renderer.domElement);
  const scene=new T.Scene();
  const group=new T.Group();scene.add(group);
  const camera=new T.OrthographicCamera(-WIDTH/2,WIDTH/2,HEIGHT/2,-HEIGHT/2,.01,20);
  camera.position.set(0,0,5);camera.lookAt(0,0,0);
  scene.add(new T.HemisphereLight(0xfff5ea,0x655778,2));
  const key=new T.DirectionalLight(0xfff4e9,3);key.position.set(-2,3,5);scene.add(key);
  const fill=new T.DirectionalLight(0xeae4ff,1);fill.position.set(2,1,3);scene.add(fill);
  const anchors=new Map(ORGANS.map(o=>[o.id,new T.Vector3((o.x/100-.5)*WIDTH,(.5-o.y/100)*HEIGHT,depths[o.id]??.025)]));
  const markers=new Map(ORGANS.map(o=>[o.id,host.querySelector<HTMLElement>(`[data-checkpoint="${o.id}"]`)!]));
  const pieces=new Map<string,T.Object3D>();
  const geometrySet=new Set<T.BufferGeometry>();const materials=new Set<T.Material>();const textures=new Set<T.Texture>();
  const boneMaterial=new T.MeshPhysicalMaterial({color:colors.skeleton,roughness:.38,side:T.DoubleSide});materials.add(boneMaterial);
  const rig=createSkeletonRig(group,boneMaterial);rig.materials.forEach(m=>materials.add(m));
  let celebrating=false,frame=0,celebrationStart=0,framing=0,organAlpha=1,startYaw=0;
  let origin:DOMRect|null=null;
  host.dataset.sceneId=scene.uuid;
  const abort=new AbortController();let dead=false;let ready=false;let yaw=0;let placed=new Set<string>();
  const projected=new Map<string,{x:number;y:number}>();
  function isFacing(id:string){return Math.cos(yaw)*(placementSide(id)==='front'?1:-1)>.2}
  function draw(){
    if(dead)return;
    group.rotation.set(0,yaw,0);group.updateMatrixWorld(true);
    host.dataset.yaw=String(yaw);host.dataset.pitch='0';
    const facing=Math.cos(yaw);
    const view=Math.abs(facing)<.2?'Side view':facing>0?'Front view':'Back view';
    host.dataset.view=view;
    for(const [id,piece] of pieces)piece.visible=placed.has(id)&&organAlpha>0;
    const r=host.getBoundingClientRect();
    for(const o of ORGANS){
      const point=anchors.get(o.id)!.clone().applyMatrix4(group.matrixWorld).project(camera);
      const x=(point.x+1)*r.width/2,y=(1-point.y)*r.height/2;
      projected.set(o.id,{x,y});
      const marker=markers.get(o.id);
      if(marker){marker.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;marker.hidden=!ready||placed.has(o.id)||!isFacing(o.id);marker.dataset.side=placementSide(o.id);}
    }
    const organMaterials=new Set<T.Material>();
    for(const p of pieces.values())p.traverse(node=>{if(node instanceof T.Mesh){const mats=Array.isArray(node.material)?node.material:[node.material];mats.forEach(m=>organMaterials.add(m))}});
    for(const mat of organMaterials){const transparent=organAlpha<1;if(mat.transparent!==transparent){mat.transparent=transparent;mat.depthWrite=!transparent;mat.needsUpdate=true}mat.opacity=organAlpha}
    rig.reveal(placed.has('brain'),placed.has('tongue'),1-organAlpha);
    host.dataset.organOpacity=String(organAlpha);
    host.dataset.brainRevealed=String(placed.has('brain')&&organAlpha>0);host.dataset.tongueRevealed=String(placed.has('tongue')&&organAlpha>0);
    host.dataset.attachedCount=String([...pieces.values()].filter(p=>p.visible).length);
    if(ready)renderer.render(scene,camera);
  }
  function projection(){
    const r=host.getBoundingClientRect();
    if(celebrating&&origin){
      // Off-axis framing preserves the existing skeleton's on-screen position and size
      // while the same canvas expands into the completed layout.
      const unit=HEIGHT/origin.height;
      const height=T.MathUtils.lerp(r.height*unit,HEIGHT/.82,framing);
      const cx=((r.left+r.width/2)-(origin.left+origin.width/2))*unit*(1-framing);
      const cy=((origin.top+origin.height/2)-(r.top+r.height/2))*unit*(1-framing);
      const half=height*r.width/r.height/2;
      camera.left=cx-half;camera.right=cx+half;camera.top=cy+height/2;camera.bottom=cy-height/2;
    }else {camera.left=-WIDTH/2;camera.right=WIDTH/2;camera.top=HEIGHT/2;camera.bottom=-HEIGHT/2}
    camera.zoom=1;camera.updateProjectionMatrix();
  }
  function resize(){const r=host.getBoundingClientRect();projection();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);draw()}
  const observer=new ResizeObserver(resize);observer.observe(host);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();if(!dead)onError('3D view interrupted. Reload to restore it.')},{signal:abort.signal});
  async function load(){
    try{
      const [atlasResponse,bodyResponse]=await Promise.all([fetch('/anatomy/atlas.json',{signal:abort.signal}),fetch('/anatomy/body.bin.gz',{signal:abort.signal})]);
      if(!atlasResponse.ok||!bodyResponse.ok)throw new Error('The 3D anatomy could not load. Reload to try again.');
      const atlas=await atlasResponse.json() as {parts:Part[];bytes:number};
      const zipped=await bodyResponse.arrayBuffer();
      const signature=new Uint8Array(zipped,0,2);
      const buffer=signature[0]===31&&signature[1]===139?await new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():zipped;
      if(dead)return;
      if(buffer.byteLength!==atlas.bytes)throw new Error('The anatomy download was incomplete. Reload to try again.');
      for(const id of Object.keys(colors)){
        const parts=atlas.parts.filter(p=>p.group===id).map(p=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,p.positions,p.vertexCount*3),3));g.setAttribute('normal',new T.BufferAttribute(new Int16Array(buffer,p.normals,p.vertexCount*3),3,true));g.setIndex(new T.BufferAttribute(new Uint32Array(buffer,p.indices,p.indexCount),1));return g;});
        if(id==='skeleton'){const metadata=atlas.parts.filter(p=>p.group===id);parts.forEach((g,i)=>{geometrySet.add(g);rig.add(g,metadata[i])});continue;}
        const geometry=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());geometrySet.add(geometry);
        const material=new T.MeshPhysicalMaterial({color:colors[id],roughness:.38,metalness:.02,clearcoat:.25,side:T.DoubleSide,depthTest:true,depthWrite:true});materials.add(material);
        const mesh=new T.Mesh(geometry,material);
        // Share the depth buffer with anatomy: ribs, skull and pelvis naturally occlude internal parts.
        if(id==='skeleton'){mesh.renderOrder=-1;geometry.translate(-.0000105053,-CENTER,0);group.add(mesh);}
        else {
          geometry.computeBoundingBox();const box=geometry.boundingBox!;const center=box.getCenter(new T.Vector3());const size=box.getSize(new T.Vector3());
          geometry.translate(-center.x,-center.y,-center.z);
          const organ=ORGANS.find(o=>o.id===id)!;
          mesh.scale.set(WIDTH*organ.w/100/size.x,HEIGHT*organ.h/100/size.y,1);
          mesh.position.copy(anchors.get(id)!);mesh.visible=placed.has(id);mesh.renderOrder=organ.layer;group.add(mesh);pieces.set(id,mesh);
        }
      }
      for(const o of ORGANS.filter(o=>!colors[o.id])){
        const model=createAnatomyMesh(o.id);
        model.traverse(node=>{if(node instanceof T.Mesh){geometrySet.add(node.geometry);materials.add(node.material as T.Material)}});
        const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
        for(const child of model.children)child.position.sub(center);
        const sx=WIDTH*o.w/100/size.x,sy=HEIGHT*o.h/100/size.y;
        model.scale.set(sx,sy,Math.min(sx,sy));
        if(placementSide(o.id)==='back')model.rotation.y=Math.PI;
        model.position.copy(anchors.get(o.id)!);model.visible=placed.has(o.id);group.add(model);pieces.set(o.id,model);
      }
      for(const [id,piece] of pieces)rig.attachPiece(piece,id);
      if(dead)return;ready=true;host.dataset.sceneReady='true';resize();onReady();
    }catch(error){if(!dead&&!abort.signal.aborted)onError(error instanceof Error?error.message:'The 3D anatomy could not load.')}
  }
  function celebrate(){
    if(celebrating)return;origin=host.getBoundingClientRect();startYaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));celebrating=true;framing=0;host.dataset.celebrating='true';celebrationStart=performance.now();resize();
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const smooth=(t:number)=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x)};
    function tick(now:number){
      if(dead||!celebrating)return;const t=(now-celebrationStart)/1000;
      framing=reduce?1:smooth(t/1.2);yaw=startYaw*(1-framing);
      organAlpha=reduce?0:1-smooth(t/.9);projection();
      const up=smooth((t-1.2)/1.1),win=smooth((t-7.3)/1.3);
      rig.pose(reduce?0:up*(1-win),reduce?1:win);
      host.dataset.pose=reduce||t>=8.6?'victory':t>=7.3?'transition':t>=2.3?'thumbs-up':'standing';draw();
      if(!reduce&&t<8.8)frame=requestAnimationFrame(tick);
    }frame=requestAnimationFrame(tick);
  }
  void load();
  return {
    celebrate,
    rotate(delta){yaw+=delta;draw()},
    reset(){cancelAnimationFrame(frame);celebrating=false;framing=0;organAlpha=1;origin=null;delete host.dataset.celebrating;delete host.dataset.pose;rig.pose(0,0);yaw=0;resize()},
    setPlaced(ids){placed=new Set(ids);for(const [id,piece]of pieces)piece.visible=placed.has(id)&&organAlpha>0;draw()},
    target(id){const o=ORGANS.find(o=>o.id===id),point=projected.get(id);if(!o||!point||!ready||!isFacing(id))return null;const r=host.getBoundingClientRect();return {id,x:r.left+point.x,y:r.top+point.y,width:r.width*o.w/100,height:r.height*o.h/100}},
    dispose(){dead=true;cancelAnimationFrame(frame);abort.abort();observer.disconnect();geometrySet.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();host.dataset.sceneReady='false'},
  };
}
