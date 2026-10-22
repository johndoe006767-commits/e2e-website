import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {replacementModels} from './models.js?v=20261023-o2c10';
import {colorsFor} from './organs.js?v=20261023-o2c10';

// Same rounded IV-bag geometry as e2e-draft1's process endpoint.
function roundedGeometry(w,h,d,r){
 r=Math.min(r,w*.48,h*.48,d*.48);
 const g=new T.BoxGeometry(w,h,d,12,12,8),p=g.attributes.position;
 const limit=new T.Vector3(w/2-r,h/2-r,d/2-r),negative=limit.clone().negate(),v=new T.Vector3(),inside=new T.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);inside.copy(v).clamp(negative,limit);v.sub(inside).normalize().multiplyScalar(r).add(inside);p.setXYZ(i,v.x,v.y,v.z);}
 g.computeVertexNormals();return g;
}
export function createFlowModel(host,kind,onConnection,{zoom=1}={}){
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;
 host.append(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.1,30);camera.position.z=7;
 const pm=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pm.fromScene(room,.04);scene.environment=env.texture;pm.dispose();room.dispose();
 scene.add(new T.HemisphereLight(0xfff8f3,0xac959d,.85));const light=new T.DirectionalLight(0xfff5ef,2.8);light.position.set(-3,5,5);scene.add(light);
 const model=new T.Group();scene.add(model);
 const materials=[],geometries=[];
 const material=(color,extra={})=>{const m=new T.MeshPhysicalMaterial({color,roughness:.3,clearcoat:.35,envMapIntensity:.45,...extra});materials.push(m);return m;};
 const mesh=(g,m,x=0,y=0,z=0)=>{geometries.push(g);const o=new T.Mesh(g,m);o.position.set(x,y,z);model.add(o);return o;};
 const rounded=(w,h,d,r,m,x=0,y=0,z=0)=>mesh(roundedGeometry(w,h,d,r),m,x,y,z);
 if(kind==='bag'){
  const blood=material('#a92a4c'),ivory=material('#f0e4e4'),plastic=material('#e9dade',{transparent:true,opacity:.24,depthWrite:false});
  model.rotation.set(.08,-.18,-.04);
  rounded(1.7,2.2,.42,.23,plastic,0,.2);rounded(1.45,1.52,.3,.2,blood,0,-.04);
  rounded(1.7,.12,.36,.04,ivory,0,1.31);rounded(.72,.27,.15,.08,ivory,0,1.49);
  mesh(new T.TorusGeometry(.12,.04,8,24),ivory,0,1.53,.1);
  rounded(.94,.62,.055,.07,ivory,0,.37,.24);rounded(.12,.34,.065,.025,blood,0,.38,.28);rounded(.34,.12,.065,.025,blood,0,.38,.28);
  for(const x of [-.35,.28])mesh(new T.CylinderGeometry(.095,.095,.28,16),ivory,x,-1.02);
  mesh(new T.CapsuleGeometry(.115,.29,6,12),plastic,-.35,-1.39);mesh(new T.CapsuleGeometry(.055,.18,6,12),blood,-.35,-1.37);
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-.35,-1.57,0),new T.Vector3(-.3,-1.72,0),new T.Vector3(0,-1.9,0)]),32,.035,8,false),ivory);
 }else{
  // Reuse only the supplied organ surface, without duplicating its neurons.
  const source=replacementModels.get(kind),parts=[];source.updateWorldMatrix(true,true);const inverse=new T.Matrix4().copy(source.parent.matrixWorld).invert();
  source.traverse(o=>{if(o.isMesh&&o.renderOrder===3){parts.push(o.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld)));}});
  const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());g.computeBoundingBox();const box=g.boundingBox,center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());g.translate(-center.x,-center.y,-center.z);g.scale(2.8/size.y,2.8/size.y,2.8/size.y);const color=colorsFor(kind).base;mesh(g,material(color));model.rotation.set(.05,-.32,0);
 }
 function render(){
  const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
  renderer.setSize(w,h,false);camera.aspect=w/h;
  let point;
  if(kind==='bag'){
   point=new T.Vector3(0,-1.9,0);model.updateMatrixWorld(true);model.localToWorld(point);
  }else{
   // Fit both dimensions after rotation, with 20% breathing room on every viewport.
   const bounds=new T.Box3().setFromObject(model),tan=Math.tan(T.MathUtils.degToRad(camera.fov/2));
   let distance=7;
   for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    distance=Math.max(distance,z+Math.abs(x)/(tan*camera.aspect*.8),z+Math.abs(y)/(tan*.8));
   }
   camera.position.z=distance/zoom;
   point=bounds.getCenter(new T.Vector3());point.y=bounds.max.y*.96;
  }
  camera.updateProjectionMatrix();camera.updateMatrixWorld(true);renderer.render(scene,camera);
  point.project(camera);onConnection?.((point.x+1)*w/2,(1-point.y)*h/2);
 }
 const observer=new ResizeObserver(render);observer.observe(host);render();
 return {destroy(){observer.disconnect();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());env.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
}
