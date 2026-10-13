import * as T from 'three';
export type BonePart={name:string;bounds:number[][]};
const CENTER=.8609762778505683;
const v=(x:number,y:number,z=0)=>new T.Vector3(x,y-CENTER,z);
export function createSkeletonRig(root:T.Group,material:T.MeshPhysicalMaterial){
 const torso=new T.Group(),head=new T.Group();torso.position.copy(v(0,1));root.add(torso);head.position.copy(v(0,1.5).sub(v(0,1)));torso.add(head);
 const skull=material.clone(),mouth=material.clone();
 const arms=[-1,1].map(sign=>{
  const shoulder=new T.Group(),elbow=new T.Group(),wrist=new T.Group();
  const s=v(sign*.158,1.4,-.025),e=v(sign*.222,1.12,-.02),w=v(sign*.255,.884,.02);
  shoulder.position.copy(s.clone().sub(v(0,1)));torso.add(shoulder);elbow.position.copy(e.clone().sub(s));shoulder.add(elbow);wrist.position.copy(w.clone().sub(e));elbow.add(wrist);
  const fingers=new Map<string,T.Group>();
  return {sign,shoulder,elbow,wrist,fingers};
 });
 function attach(object:T.Object3D,parent:T.Object3D){root.updateMatrixWorld(true);root.add(object);parent.attach(object)}
 function add(geometry:T.BufferGeometry,part:BonePart){
  // The atlas includes isolated soft nose-tip cartilage without the connecting
  // lateral cartilage. A bare skull retains its nasal bones and nasal aperture.
  if(/major alar cartilage/i.test(part.name))return;
  geometry.translate(-.0000105053,-CENTER,0);
  const n=part.name.toLowerCase(),y=(part.bounds[0][1]+part.bounds[1][1])/2,x=(part.bounds[0][0]+part.bounds[1][0])/2;
  const isHead=y>1.51&&!/vertebra|disk|atlas|axis|levator/.test(n);
  const cranial=/frontal|parietal|occipital|temporal|sphenoid|ethmoid/.test(n);
  const mesh=new T.Mesh(geometry,isHead?(cranial?skull:mouth):material);mesh.name=part.name;
  const arm=arms[x>0?1:0];let parent:T.Object3D=root;
  if(/humerus/.test(n))parent=arm.shoulder;
  else if(/radius|ulna/.test(n))parent=arm.elbow;
  else if(Math.abs(x)>.19&&y>.7&&y<.9){
   parent=arm.wrist;
   const finger=n.match(/(index|middle|ring|little) finger|thumb|first metacarpal/);
   if(finger){const digit=finger[1]||'thumb',segment=n.startsWith('distal')?2:n.startsWith('middle')?1:0;const key=digit;let hinge=arm.fingers.get(key);
    if(!hinge){hinge=new T.Group();const px=key==='thumb'?.276:key==='index'?.287:key==='middle'?.267:key==='ring'?.247:.229;hinge.position.copy(v(arm.sign*px,key==='thumb'?.874:.803,.04));attach(hinge,arm.wrist);arm.fingers.set(key,hinge);
     const middle=new T.Group(),tip=new T.Group();middle.position.set(0,-.031,.012);tip.position.set(0,-.022,.013);hinge.add(middle);middle.add(tip);hinge.userData.middle=middle;hinge.userData.tip=tip;
    }parent=segment===2?hinge.userData.tip:segment===1?hinge.userData.middle:hinge;
   }
  } else if(isHead)parent=head;
  else if(y>1.01)parent=torso;
  attach(mesh,parent);
 }
 function reveal(brain:boolean,tongue:boolean,fade=0){
  for(const [mat,visible] of [[skull,brain],[mouth,tongue]] as const){const opacity=visible?T.MathUtils.lerp(.2,1,fade):1,transparent=opacity<1;mat.opacity=opacity;if(mat.transparent===transparent)continue;mat.transparent=transparent;mat.depthWrite=!transparent;mat.side=transparent?T.FrontSide:T.DoubleSide;mat.needsUpdate=true}
 }
 // Hand basis uses the real carpal/metacarpal and phalanx meshes, not a replacement icon.
 function handOrientation(x:T.Vector3,y:T.Vector3,z:T.Vector3){return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z))}
 function pose(thumb:number,victory:number){
  const lean=.12,armElevation=T.MathUtils.degToRad(35);
  const upperRest=Math.atan2(-.28,.064),forearmRest=Math.atan2(-.236,.033);
  torso.rotation.z=lean*victory;head.quaternion.identity();
  for(const a of arms){
   // Right means screen right, matching the game's L/R labels.
   const straight=a.sign>0;
   a.shoulder.rotation.z=a.sign*.52*thumb+(straight?armElevation-upperRest-lean:-1.25)*victory;
   a.elbow.rotation.z=a.sign*2.05*thumb+(straight?upperRest-forearmRest:-1.85)*victory;
   a.wrist.quaternion.identity();root.updateMatrixWorld(true);
   const parentRotation=a.elbow.getWorldQuaternion(new T.Quaternion()).invert();
   const thumbsWorld=handOrientation(new T.Vector3(0,a.sign,0),new T.Vector3(0,0,-1),new T.Vector3(-a.sign,0,0));
   const palmDown=handOrientation(new T.Vector3(0,0,1),new T.Vector3(-1,0,0),new T.Vector3(0,-1,0));
   palmDown.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),armElevation));
   const thumbLocal=parentRotation.clone().multiply(thumbsWorld);
   const winLocal=parentRotation.clone().multiply(straight?palmDown:thumbsWorld);
   const weight=thumb+victory;
   if(weight>0)a.wrist.quaternion.slerp(thumbLocal.slerp(winLocal,victory/weight),weight);
   for(const [name,f] of a.fingers){
    const isThumb=name==='thumb',curl=thumb+(straight?0:1)*victory;
    const flat=straight?victory:0;
    f.rotation.set(isThumb?0:-1.75*curl+.5*flat,0,isThumb?a.sign*.9*curl:0);
    f.userData.middle.rotation.x=isThumb?0:-1.3*curl+.25*flat;
    f.userData.tip.rotation.x=isThumb?0:-.7*curl+.1*flat;
   }
  }
  root.updateMatrixWorld(true);
  const right=arms[1],eye=head.localToWorld(new T.Vector3(0,.11,.03));
  const target=right.wrist.localToWorld(new T.Vector3(0,-.065,0));
  const gaze=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(target,eye,new T.Vector3(0,1,0)));
  gaze.premultiply(torso.getWorldQuaternion(new T.Quaternion()).invert());
  head.quaternion.identity().slerp(gaze,victory);
 }
 function attachPiece(object:T.Object3D,id:string){
  const arm=arms[object.position.x>0?1:0];
  if(['biceps','triceps','deltoid'].includes(id))attach(object,arm.shoulder);
  else if(id==='forearm')attach(object,arm.elbow);
  else if(['brain','eyes','tongue'].includes(id))attach(object,head);
  else if(!['glutes','bladder','hamstrings','quadriceps','calves','tibialis','adductors'].includes(id))attach(object,torso);
 }
 return {add,reveal,pose,attachPiece,materials:[skull,mouth]};
}
