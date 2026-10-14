import * as T from 'three';
import {neutralizeBodyGeometry} from './body-shape.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// These atlas surfaces share the skeleton's coordinates, including the face,
// fingers and feet. Render each complete layer once, then crossfade its image:
// fading individual triangles would expose back faces and overlapping muscles.
export async function loadBodyLayers(lights) {
 const [metadata,response]=await Promise.all([fetch('./data/anatomy/body-layers.json'),fetch('./data/anatomy/body-layers.bin.gz')]);
 if(!metadata.ok||!response.ok)throw Error('Body layers missing');
 const atlas=await metadata.json();
 const buffer=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 if(buffer.byteLength!==atlas.bytes)throw Error('Incomplete body layers');
 const scenes={muscle:new T.Scene(),skin:new T.Scene()};
 for(const scene of Object.values(scenes))for(const light of lights)scene.add(light.clone());
 const palette={skin:0xb98265,muscle:0x983a42,hair:0x251b19,lip:0x9e5850,eye:0xeee5d8,iris:0x44392c};
 const grouped=new Map();
 for(const part of atlas.parts){
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,part.positions,part.vertexCount*3),3));
  geometry.setAttribute('normal',new T.BufferAttribute(new Int16Array(buffer,part.normals,part.vertexCount*3),3,true));
  geometry.setIndex(new T.BufferAttribute(new Uint32Array(buffer,part.indices,part.indexCount),1));
  neutralizeBodyGeometry(geometry,part.layer);
  if(!grouped.has(part.layer))grouped.set(part.layer,[]);
  grouped.get(part.layer).push(geometry);
 }
 for(const [layer,pieces]of grouped){
  const geometry=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());
  const material=new T.MeshStandardMaterial({color:palette[layer],roughness:layer==='eye'?.3:layer==='hair'?.92:.68,metalness:0});
  const mesh=new T.Mesh(geometry,material);mesh.name=layer;
  scenes[layer==='muscle'?'muscle':'skin'].add(mesh);
 }
 const targets={muscle:new T.WebGLRenderTarget(1,1,{samples:4}),skin:new T.WebGLRenderTarget(1,1,{samples:4})};
 const overlay=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const quads={};
 for(const layer of ['muscle','skin']){
  const material=new T.MeshBasicMaterial({map:targets[layer].texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
  const mesh=new T.Mesh(new T.PlaneGeometry(2,2),material);mesh.frustumCulled=false;overlay.add(mesh);quads[layer]=mesh;
 }
 let width=0,height=0,enabledAmount=1;
 const size=new T.Vector2(),clearColor=new T.Color();
 return {
  skinOpacity:1,
  update(separation,enabled,selected,dt,reduced){
   const target=enabled?1:0;
   enabledAmount=reduced?target:T.MathUtils.lerp(enabledAmount,target,1-Math.exp(-dt*14));
   if(Math.abs(enabledAmount-target)<.001)enabledAmount=target;
   // Reveal muscle before the organ labels arrive, then leave raw anatomy.
   const skin=selected?0:enabledAmount*(1-T.MathUtils.smoothstep(separation,0,.44));
   const muscle=selected?0:enabledAmount*(1-T.MathUtils.smoothstep(separation,.18,.72));
   quads.skin.material.opacity=skin;quads.muscle.material.opacity=muscle;
   quads.skin.visible=skin>.001;quads.muscle.visible=muscle>.001;
   this.skinOpacity=skin;
  },
  render(renderer,viewCamera){
   if(!quads.skin.visible&&!quads.muscle.visible)return;
   renderer.getDrawingBufferSize(size);
   if(width!==size.x||height!==size.y){
    width=size.x;height=size.y;
    const previousTarget=renderer.getRenderTarget(),alpha=renderer.getClearAlpha();
    renderer.getClearColor(clearColor);
    renderer.setClearColor(0x000000,0);
    for(const layer of ['muscle','skin']){
     targets[layer].setSize(width,height);renderer.setRenderTarget(targets[layer]);renderer.render(scenes[layer],viewCamera);
    }
    renderer.setRenderTarget(previousTarget);renderer.setClearColor(clearColor,alpha);
   }
   const autoClear=renderer.autoClear;renderer.autoClear=false;
   renderer.render(overlay,camera);renderer.autoClear=autoClear;
  },
  dispose(){
   for(const scene of [...Object.values(scenes),overlay])scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
   Object.values(targets).forEach(target=>target.dispose());
  },
 };
}
