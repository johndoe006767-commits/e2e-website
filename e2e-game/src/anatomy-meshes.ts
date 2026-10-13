import * as T from 'three';

// Simplified educational volumes, modeled locally. No camera-facing image surfaces.
export function createAnatomyMesh(id:string):T.Group {
 const group=new T.Group();
 const muscle=new T.MeshPhysicalMaterial({color:'#d87972',roughness:.48,clearcoat:.15});
 const tendon=new T.MeshStandardMaterial({color:'#e5d7c7',roughness:.6});
 const soft=new T.MeshPhysicalMaterial({color:'#cf817e',roughness:.38,clearcoat:.2});
 const white=new T.MeshPhysicalMaterial({color:'#efe8d9',roughness:.25});
 const iris=new T.MeshStandardMaterial({color:'#638c8e',roughness:.4});
 const pupil=new T.MeshStandardMaterial({color:'#202331',roughness:.4});
 const used=new Set<T.Material>();
 function ellipsoid(x:number,y:number,z:number,sx:number,sy:number,sz:number,material:T.Material=muscle,angle=0){
  const mesh=new T.Mesh(new T.SphereGeometry(1,24,18),material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.z=angle;group.add(mesh);used.add(material);return mesh;
 }
 function tube(points:number[][],radius:number,material:T.Material){
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p as [number,number,number])));
  const mesh=new T.Mesh(new T.TubeGeometry(curve,32,radius,10,false),material);group.add(mesh);used.add(material);
 }
 function belly(x:number,y:number,width:number,length:number,angle=0){
  ellipsoid(x,y,0,width,length,width*.72,muscle,angle);
  // Fine raised fiber bundles follow the long axis and give the volume readable surface detail.
  for(let i=-2;i<=2;i++){
   const rib=ellipsoid(x+i*width*.26,y,width*.55,.018,length*.84,.018,muscle,angle);
   rib.rotation.z=angle;
  }
 }
 switch(id){
  case 'deltoid':
   belly(-.23,.12,.3,.5,-.35);belly(.23,.12,.3,.5,.35);belly(0,-.12,.28,.62);break;
  case 'forearm':
   for(let i=-1;i<=1;i++){belly(i*.2,.22,.16,.65,i*.1);tube([[i*.2,-.3,0],[i*.14,-.95,0]],.035,tendon)}break;
  case 'tibialis':
   belly(0,.18,.24,.85,-.1);tube([[.05,-.5,0],[.14,-1.05,0],[.3,-1.2,.08]],.06,tendon);break;
  case 'adductors':
   belly(-.16,.15,.26,.75,-.22);belly(.16,0,.17,.92,.08);belly(0,.42,.32,.4,-.15);break;
  case 'masseter':
   belly(0,0,.4,.57,.12);break;
  case 'biceps':
   belly(-.13,.05,.23,.7,-.07);belly(.14,.06,.22,.68,.07);
   tube([[-.15,.65,0],[-.2,.92,0],[-.24,1.05,0]],.055,tendon);tube([[.15,.65,0],[.23,1,0]],.05,tendon);
   tube([[0,-.5,0],[0,-.83,0],[.06,-1.05,0]],.065,tendon);break;
  case 'triceps':
   belly(-.22,.05,.23,.68,-.16);belly(.19,.02,.25,.63,.15);belly(0,.29,.22,.76);
   tube([[0,-.5,0],[0,-.85,0],[0,-1.04,0]],.09,tendon);break;
  case 'quadriceps':
   belly(-.29,0,.26,.87,-.08);belly(.29,-.03,.25,.84,.1);belly(0,.08,.26,.98);belly(.18,-.57,.24,.35,.16);
   tube([[0,-.65,0],[0,-1.1,0]],.13,tendon);break;
  case 'hamstrings':
   belly(-.28,.02,.23,.88,-.08);belly(0,.03,.17,.95);belly(.27,.05,.22,.8,.12);
   for(const x of [-.28,0,.27])tube([[x,-.65,0],[x*.85,-1.08,0],[x*.9,-1.25,0]],.045,tendon);break;
  case 'calves':
   belly(-.23,.28,.3,.65,-.12);belly(.23,.31,.29,.62,.12);
   ellipsoid(0,-.08,-.1,.31,.72,.18,muscle);tube([[0,-.37,0],[0,-.82,0],[0,-1.18,.07]],.075,tendon);break;
  case 'glutes':
   ellipsoid(-.43,0,0,.48,.59,.34,muscle,-.17);ellipsoid(.43,0,0,.48,.59,.34,muscle,.17);break;
  case 'bladder':
   ellipsoid(0,.1,0,.58,.56,.4,soft);tube([[0,-.3,0],[0,-.66,0]],.1,soft);
   for(const side of [-1,1])tube([[side*.4,.37,0],[side*.55,.7,0],[side*.58,.85,0]],.055,soft);break;
  case 'thyroid':
   ellipsoid(-.32,0,0,.25,.52,.2,soft,-.25);ellipsoid(.32,0,0,.25,.52,.2,soft,.25);ellipsoid(0,-.08,0,.28,.13,.12,soft);break;
  case 'trachea':
   tube([[0,1,0],[0,.25,0],[0,-.3,0]],.14,soft);
   for(let i=0;i<10;i++){
    const ring=new T.Mesh(new T.TorusGeometry(.145,.035,8,20),tendon);ring.rotation.x=Math.PI/2;ring.position.y=1-i*.13;group.add(ring);used.add(tendon);
   }
   tube([[0,-.24,0],[-.23,-.57,0],[-.48,-.82,0]],.11,soft);tube([[0,-.24,0],[.23,-.57,0],[.48,-.82,0]],.11,soft);break;
  case 'esophagus':tube([[.03,1,0],[-.04,.6,0],[.02,0,-.04],[.05,-.6,0],[.2,-1,.06]],.085,soft);break;
  case 'tongue':ellipsoid(0,0,0,.43,.72,.2,soft);break;
  case 'eyes':
   for(const x of [-.47,.47]){ellipsoid(x,0,0,.3,.3,.3,white);ellipsoid(x,0,.274,.14,.14,.045,iris);ellipsoid(x,0,.312,.065,.065,.02,pupil);tube([[x,0,-.2],[x,0,-.43]],.07,soft)}break;
  default:throw new Error(`Missing anatomy geometry: ${id}`);
 }
 for(const mat of [muscle,tendon,soft,white,iris,pupil])if(!used.has(mat))mat.dispose();
 return group;
}
