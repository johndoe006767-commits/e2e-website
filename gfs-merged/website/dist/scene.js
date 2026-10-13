import * as THREE from './three.module.js';
const scene=new THREE.Scene();scene.background=new THREE.Color('#dedfdf');scene.fog=new THREE.Fog('#dedfdf',85,155);
let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch(e){document.querySelector('#error').style.display='flex';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;document.querySelector('#warehouse').prepend(renderer.domElement);
const camera=new THREE.OrthographicCamera(-35,35,24,-24,.1,200);camera.position.set(40,38,46);camera.lookAt(-1,0,0);
scene.add(new THREE.HemisphereLight(0xffffff,0x9a9a9d,2.1));const sun=new THREE.DirectionalLight(0xffffff,3.2);sun.position.set(-18,38,15);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-48,right:48,top:42,bottom:-42,near:.5,far:110});sun.shadow.bias=-.00025;sun.shadow.normalBias=.025;sun.shadow.radius=3;scene.add(sun);
const mat=(c,r=.75,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});const white=mat('#e3e4e3'),steel=mat('#aaaeb0',.55,.25),deck=mat('#b9bbba'),stock=mat('#d1d2d0'),tape=mat('#e0e0db'),wood=mat('#a4a39b'),burgundy=mat('#8A0051',.36,.25),dark=mat('#303338'),glass=mat('#62767e',.15,.45),yellow=mat('#ffd739',.4,.25),gold=mat('#efbb42',.28,.75);
const boxGeo=new THREE.BoxGeometry(1,1,1);function box(g,x,y,z,w,h,d,m){const o=new THREE.Mesh(boxGeo,m);o.position.set(x,y,z);o.scale.set(w,h,d);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}function cyl(g,x,y,z,r,h,m,rz=0){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),m);o.position.set(x,y,z);o.rotation.z=rz;o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}function beam(g,a,b,r,m){const d=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a));const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),8),m);o.position.copy(new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());g.add(o);o.castShadow=true;return o;}function group(x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);scene.add(g);return g;}
box(scene,0,-.24,0,130,.4,110,mat('#d6d8d7'));
// Expansion joints and loading apron.
const line=mat('#c4c7c6');for(let x=-48;x<=48;x+=12)box(scene,x,-.027,0,.022,.012,82,line);for(let z=-36;z<40;z+=12)box(scene,0,-.027,z,110,.012,.022,line);
box(scene,1,-.05,-2,34,.15,29,mat('#dfe0de'));
function pallet(parent,x,y,z){const p=new THREE.Group();parent.add(p);p.position.set(x,y,z);for(let i=-1;i<=1;i++){box(p,i*.64,.09,0,.22,.18,1.58,wood);box(p,0,.24,i*.57,1.9,.12,.22,wood);}box(p,0,.98,0,1.74,1.35,1.38,stock);box(p,0,1.663,0,.055,.015,1.39,tape);box(p,0,.97,.697,.055,1.34,.014,tape);box(p,.49,.91,.709,.33,.22,.015,white);for(let k=0;k<5;k++)box(p,.37+k*.05,.91,.719,.015,.14,.01,steel);return p;}
const racks=[],cargo=[],stockSlots=new Map();const rows=[-11,-5,1,7];for(let ri=0;ri<4;ri++){const z=rows[ri],r=group(0,0,z);racks.push(r);for(let i=0;i<=7;i++){const x=-9.8+i*2.8;for(const side of [-1,1]){box(r,x,4,side*.94,.12,8,.13,steel);box(r,x,.12,side*.94,.33,.18,.3,steel);}for(let lev=0;lev<3;lev++){beam(r,[x,.5+lev*2.5,-.93],[x,2.7+lev*2.5,.93],.027,steel);beam(r,[x,2.7+lev*2.5,-.93],[x,.5+lev*2.5,.93],.027,steel);}}for(let lev=0;lev<3;lev++){const y=.43+lev*2.5;box(r,0,y,0,19.7,.11,1.88,deck);for(const side of [-1,1])box(r,0,y+.04,side*.96,19.75,.17,.1,steel);for(let col=0;col<7;col++){if((ri===1&&lev===1&&col===3)||(ri===3&&lev===2&&col===5))continue;const p=pallet(r,-8.4+col*2.8,y+.08,0);stockSlots.set(`${ri}:${col}:${lev}`,p);if(lev===0&&col===6&&(ri===2||ri===3))cargo.push(p);}}}
// Office with exposed glazed frontage, desks, monitors, roof equipment.
const office=group(-20,0,-3);box(office,0,.14,0,9,.28,11,white);box(office,-4.3,2.1,0,.22,4.2,10.5,white);box(office,0,2.1,-5.15,8.7,4.2,.22,white);box(office,0,4.28,0,9.2,.3,11,white);box(office,0,4.49,0,8.8,.12,10.6,deck);
for(let z=-4;z<=4;z+=2){box(office,4.32,2.15,z,.06,3.8,1.89,glass);box(office,4.4,2.15,z-1,.1,4.1,.09,steel);}for(let x=-3;x<=3;x+=2){box(office,x,2.15,5.18,1.9,3.8,.06,glass);box(office,x-1,2.15,5.23,.09,4.1,.09,steel);}box(office,0,.3,6.1,5,.2,1.6,deck);box(office,0,.14,6.7,5.4,.18,1.5,deck);
for(let z=-3;z<=3;z+=3){box(office,1,1.5,z,2.8,.12,1.3,white);box(office,1,1.92,z-.3,.95,.63,.12,dark);box(office,1,1.92,z-.22,.82,.48,.03,glass);}for(let z=-3;z<=1;z+=4){box(office,-1,4.9,z,2,.72,1.6,steel);for(let k=0;k<7;k++)box(office,-1.8+k*.26,5.28,z,.07,.025,1.3,dark);}cyl(office,3,5.2,-4,.045,1.7,steel);const antenna=cyl(office,3,6.08,-4,.16,.19,burgundy);
// Bollards and ground lane markings.
for(let x=-12;x<=16;x+=4){box(scene,x,.025,11,1.4,.025,.07,white);box(scene,x,.025,18,1.4,.025,.07,white);}for(const x of [-12,13])for(const z of [10,19]){cyl(scene,x,.48,z,.11,.95,steel);cyl(scene,x,.76,z,.12,.17,burgundy);}
function forklift(){const g=group();box(g,0,.65,0,1.15,.75,1.8,burgundy);box(g,0,1.07,-.6,1.17,.4,.64,burgundy);for(const x of [-.59,.59])for(const z of [-.57,.61]){cyl(g,x,.42,z,.35,.19,dark,Math.PI/2);cyl(g,x*1.04,.42,z,.16,.205,steel,Math.PI/2);}box(g,0,1.3,-.18,.52,.14,.5,dark);box(g,0,1.61,-.43,.52,.58,.12,dark);for(const x of [-.47,.47])for(const z of [-.61,.48])box(g,x,1.88,z,.07,1.64,.07,burgundy);box(g,0,2.72,-.08,1.22,.12,1.4,burgundy);for(const x of [-.47,.47])box(g,x,1.66,1,.1,2.95,.14,steel);const lift=new THREE.Group();g.add(lift);box(lift,0,.5,1.1,1.17,.58,.12,burgundy);for(const x of [-.4,.4])box(lift,x,.23,1.68,.14,.1,1.3,steel);const load=pallet(lift,0,.3,1.69);box(g,0,1.7,.44,.12,.58,.12,dark);cyl(g,0,2.86,-.38,.09,.15,yellow);return {g,lift,load};}
const forks=[forklift(),forklift()];
function drone(index){const g=group();box(g,0,0,0,.68,.23,.52,burgundy);box(g,0,-.22,.12,.32,.22,.28,dark);const rotors=[];for(const x of [-.66,.66])for(const z of [-.54,.54]){beam(g,[x,-.01,z],[0,0,0],.065,burgundy);cyl(g,x,.09,z,.105,.17,burgundy);const rotor=new THREE.Group();rotor.position.set(x,.2,z);g.add(rotor);box(rotor,0,0,0,.87,.02,.085,dark);box(rotor,0,0,0,.085,.02,.87,dark);rotors.push(rotor);const ring=new THREE.Mesh(new THREE.RingGeometry(.39,.43,32),new THREE.MeshBasicMaterial({color:'#8A0051',side:THREE.DoubleSide,transparent:true,opacity:.28}));ring.rotation.x=-Math.PI/2;ring.position.set(x,.19,z);g.add(ring);}const sm=new THREE.MeshBasicMaterial({color:'#ffd733',transparent:true,opacity:.15,side:THREE.DoubleSide,depthWrite:false});const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([0,-.2,0,-1.2,-1.4,-2.2,1.2,-1.4,-2.2,0,-.2,0,1.2,-1.4,-2.2,1.2,.6,-2.2,0,-.2,0,1.2,.6,-2.2,-1.2,.6,-2.2,0,-.2,0,-1.2,.6,-2.2,-1.2,-1.4,-2.2],3));const scan=new THREE.Mesh(geo,sm);g.add(scan);const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.2,-1.4,-2.2),new THREE.Vector3(1.2,-1.4,-2.2),new THREE.Vector3(1.2,.6,-2.2),new THREE.Vector3(-1.2,.6,-2.2)]),new THREE.LineBasicMaterial({color:'#ffcf18',transparent:true,opacity:.85}));g.add(outline);return {g,rotors,sm,outline,index};}
const drones=[drone(0),drone(1)];
// Open-backed export container, real internal loads and folding rear doors.
const truck=group(0,0,15);box(truck,1,.83,0,11,.3,2.75,dark);box(truck,5.15,1.8,0,2.65,2.1,2.52,white);box(truck,6.02,2.27,0,1.05,.86,2.4,glass);box(truck,6.71,1.36,0,.09,.55,2.3,white);box(truck,6.78,.94,0,.12,.17,2.5,steel);for(const z of [-.87,.87])box(truck,6.79,1.4,z,.03,.22,.48,yellow);box(truck,-.87,1.22,0,9.1,.18,2.7,steel);box(truck,-.87,4.06,0,9.1,.16,2.7,white);box(truck,3.61,2.67,0,.14,2.8,2.7,white);for(const z of [-1.32,1.32]){box(truck,-.87,2.67,z,9.1,2.8,.1,white);for(let x=-5.2;x<3.6;x+=.32)box(truck,x,2.66,z*1.04,.075,2.69,.045,deck);}for(const x of [-3.8,-2.6,4.6])for(const z of [-1.34,1.34]){const wh=cyl(truck,x,.66,z,.61,.25,dark);wh.rotation.x=Math.PI/2;const hub=cyl(truck,x,.66,z*1.1,.3,.26,steel);hub.rotation.x=Math.PI/2;}const doors=[];for(const s of [-1,1]){const hinge=new THREE.Group();hinge.position.set(-5.45,1.3,s*1.3);truck.add(hinge);box(hinge,0,1.3,-s*.65,.12,2.6,1.3,white);box(hinge,-.1,1.3,-s*.75,.07,2.4,.06,steel);doors.push(hinge);}const loads=[pallet(truck,-4,1.33,0),pallet(truck,-1.7,1.33,0)];
// Wordless demand and return-on-order: a purchase-order sheet and gold coin stacks.
const order=group(-29,8,1);box(order,0,0,0,1.25,1.65,.12,white);for(let i=0;i<3;i++){box(order,-.36,.34-i*.32,.075,.13,.13,.02,burgundy);box(order,.13,.34-i*.32,.075,.55,.045,.02,steel);}// Green banknote bundles travel back and settle into a physical cash pile.
const banknote=mat('#5a886c',.7),banknoteEdge=mat('#b9ccb0'),banknoteInk=mat('#31553e'),cashBand=mat('#e7dfc3');
function cashBundle(){
  const g=group();box(g,0,0,0,1.24,.19,.66,banknoteEdge);
  for(let j=0;j<4;j++)box(g,0,-.067+j*.044,.332,1.21,.014,.008,banknote);
  box(g,0,.106,0,1.24,.018,.66,banknote);
  for(const z of [-.26,.26])box(g,0,.119,z,1.1,.009,.017,banknoteEdge);
  for(const x of [-.53,.53])box(g,x,.119,0,.017,.009,.53,banknoteEdge);
  const seal=cyl(g,-.27,.124,0,.14,.008,banknoteInk);seal.scale.z=.7;
  box(g,.16,.13,0,.19,.014,.68,cashBand);box(g,.16,0,.339,.19,.21,.014,cashBand);
  return g;
}
const cash=Array.from({length:18},(_,i)=>({g:cashBundle(),target:new THREE.Vector3(-19.8+(i%3)*1.34,4.72+Math.floor(i/6)*.23,-1.7+(Math.floor(i/3)%2)*.79),launch:34+i*.32}));

const pulses=[];for(let i=0;i<12;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.12,10,10),new THREE.MeshBasicMaterial({color:'#e4b832'}));scene.add(p);pulses.push(p);}const halo=new THREE.Mesh(new THREE.RingGeometry(.7,.76,48),new THREE.MeshBasicMaterial({color:'#e0b32f',transparent:true,side:THREE.DoubleSide}));halo.rotation.x=-Math.PI/2;scene.add(halo);
function clamp(x){return Math.max(0,Math.min(1,x));}
function ease(x){x=clamp(x);return x*x*(3-2*x);}
function mix(a,b,t){return a+(b-a)*t;}
function shortestAngle(a,b){return Math.atan2(Math.sin(b-a),Math.cos(b-a));}
const CYCLE=48;
// Each drone shuffles entire columns, scans bottom to top, then flies to the next.
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const edgeGeometry=new THREE.EdgesGeometry(new THREE.BoxGeometry(.78,.59,.58));
drones.forEach((d,i)=>{
  d.queue=[];d.target=null;d.previous=null;d.started=-1;
  d.xray=group();
  d.xmat=new THREE.LineBasicMaterial({color:'#ffe03b',transparent:true,opacity:.92,depthTest:false,depthWrite:false});
  d.fillmat=new THREE.MeshBasicMaterial({color:'#ffe03b',transparent:true,opacity:.095,depthTest:false,depthWrite:false});
  for(const x of [-.42,.42])for(const y of [-.32,.32])for(const z of [-.31,.31]){
    const wire=new THREE.LineSegments(edgeGeometry,d.xmat);wire.position.set(x,y,z);wire.renderOrder=12;d.xray.add(wire);
    const fill=new THREE.Mesh(boxGeo,d.fillmat);fill.position.set(x,y,z);fill.scale.set(.78,.59,.58);fill.renderOrder=11;d.xray.add(fill);
  }
  d.empty=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.79,1.42,1.43)),new THREE.LineBasicMaterial({color:'#ff2525',transparent:true,depthTest:false,depthWrite:false}));scene.add(d.empty);d.empty.renderOrder=12;
  d.slice=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.42),new THREE.MeshBasicMaterial({color:'#ffe03b',transparent:true,opacity:.25,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));scene.add(d.slice);d.slice.renderOrder=13;
  d.next=()=>{
    if(!d.queue.length)d.queue=shuffle(Array.from({length:14},(_,n)=>({row:i*2+Math.floor(n/7),col:n%7})));
    const next=d.queue.shift();d.previous=d.target;d.target=next;
    d.from=d.g.position.clone();d.to=new THREE.Vector3(-8.4+next.col*2.8,2.05,rows[next.row]+3.12);
    d.travel=new THREE.CatmullRomCurve3([d.from,d.from.clone().setY(9.4),new THREE.Vector3(d.to.x,9.4,d.to.z),d.to],false,'centripetal');
  };
  d.g.position.set(-8.4,2.05,rows[i*2]+3.12);
  d.next();d.from.copy(d.to);d.g.position.copy(d.to);
});
function animateDrone(d,now){
  if(d.started<0)d.started=now-2.4;
  let age=now-d.started;
  if(age>=9.6){d.next();d.started=now;age=0;}
  const travelling=age<2.4;
  if(travelling)d.g.position.copy(d.travel.getPoint(ease(age/2.4)));
  else{const q=clamp((age-2.4)/7.2);d.g.position.copy(d.to);d.g.position.y=2.05+5*ease(q);}
  d.g.position.y+=Math.sin(now*3+d.index)*.045;
  d.rotors.forEach((r,j)=>r.rotation.y=now*48*(j%2?1:-1));
  const level=Math.max(0,Math.min(2,Math.round((d.g.position.y-2.05)/2.5)));
  const {row,col}=d.target,slot=stockSlots.get(`${row}:${col}:${level}`);
  const missing=!slot||!slot.visible;
  const active=!travelling&&Math.abs(d.g.position.y-(2.05+level*2.5))<.8;
  d.sm.visible=active;d.sm.opacity=active?.10:0;d.outline.visible=active;
  const color=missing?'#ff2525':'#ffe03b';d.sm.color.set(color);d.outline.material.color.set(color);
  const center=new THREE.Vector3(-8.4+col*2.8,1.49+level*2.5,rows[row]);
  d.xray.position.copy(center);d.xray.visible=active&&!missing;
  d.xmat.opacity=.8+Math.sin(now*8)*.15;
  d.empty.position.copy(center);d.empty.visible=active&&missing;
  d.slice.position.copy(center);d.slice.position.z+=Math.sin(now*4)*.69;
  d.slice.material.color.set(color);d.slice.visible=active;
}
// Rounded, tangent-following routes; reversing preserves the forklift's heading.
function curve(points){return new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],0,p[1])),false,'centripetal');}
forks.forEach((f,i)=>{
  const z=rows[2+i];
  f.approach=curve([[14,z+3.3],[11.5,z+3.3],[8.4,z+3],[8.4,z+1.75]]);
  f.delivery=curve([[14,z+3.3],[15,10.8],[12,11.6],[3,11.6],[-7.8,11.6],[-10.3,12.7],[-10.3,14.6],[-8.9,15],[-7.2,15]]);
  f.returning=curve([[-7.2,15],[-9.1,15],[-10.8,13.9],[-9.5,11.4],[-3,11.1],[8,11.1],[14,10.8],[14,z+3.3]]);
  f.g.position.copy(f.approach.getPoint(0));
  const v=f.approach.getTangent(0);f.g.rotation.y=Math.atan2(v.x,v.z);
});
function follow(f,path,u,reverse,dt){
  const p=path.getPointAt(clamp(u)),v=path.getTangentAt(clamp(u));f.g.position.copy(p);
  const heading=Math.atan2(v.x,v.z)+(reverse?Math.PI:0);
  const turn=shortestAngle(f.g.rotation.y,heading)*(1-Math.exp(-dt*4));
  f.g.rotation.y+=Math.max(-dt*1.8,Math.min(dt*1.8,turn));
}
function animateFork(f,i,t,dt){
  const ft=t-(8+i*3);let lift=0;
  if(ft<0)follow(f,f.approach,0,false,dt);
  else if(ft<2)follow(f,f.approach,ease(ft/2),false,dt);
  else if(ft<3){follow(f,f.approach,1,false,dt);lift=.2*ease(ft-2);}
  else if(ft<5){follow(f,f.approach,1-ease((ft-3)/2),false,dt);lift=.2;}
  else if(ft<13){follow(f,f.delivery,ease((ft-5)/8),false,dt);lift=mix(.2,.78,ease((ft-11)/2));}
  else if(ft<14.5){follow(f,f.delivery,1,false,dt);lift=.78;}
  else if(ft<23){follow(f,f.returning,ease((ft-14.5)/8.5),false,dt);lift=.78*(1-ease((ft-14.5)/2));}
  else follow(f,f.approach,0,false,dt);
  f.lift.position.y=lift;f.load.visible=ft>=2.8&&ft<14;
  cargo[i].visible=ft<2.8||t>46;
}
let elapsed=0,last=performance.now(),warehouseVisible=true;
new IntersectionObserver(entries=>{warehouseVisible=entries[0].isIntersecting;}).observe(document.querySelector('#warehouse'));
function frame(now){
  const dt=Math.min((now-last)/1000,.08);last=now;if(document.hidden||!warehouseVisible){requestAnimationFrame(frame);return;}elapsed+=dt;
  const t=elapsed%CYCLE;
  order.visible=t<5;order.position.set(mix(-31,-20,ease(t/3)),mix(8,5.9,ease(t/3)),0);order.rotation.y=-.35;order.scale.setScalar(t>3.4?1-ease((t-3.4)/1.6):1);
  cash.forEach(({g,target,launch},i)=>{
    const q=clamp((t-launch)/3.4);g.visible=t>=launch;
    g.position.set(mix(29,target.x,ease(q)),mix(3.4,target.y,ease(q))+Math.sin(q*Math.PI)*7,mix(15,target.z,ease(q)));
    g.rotation.set(Math.sin(q*Math.PI)*.3,Math.sin(q*Math.PI)*(i%2?1:-1)*1.4,Math.sin(q*Math.PI)*.2);
    g.scale.setScalar(t>46?1-ease((t-46)/2):1);
  });
  pulses.forEach((p,i)=>{p.visible=t>3&&t<8;const q=(t*.42+i/12)%1;p.position.set(mix(-17,-7,q),.2+Math.sin(q*Math.PI)*2,mix(-7,-4,q));});
  halo.visible=t>3&&t<8;halo.position.set(-17,6.2,-7);halo.scale.setScalar(1+(t%1)*2);halo.material.opacity=1-(t%1);
  drones.forEach(d=>animateDrone(d,elapsed));
  truck.position.x=t<29?0:mix(0,76,ease((t-29)/8));truck.visible=t<38;
  if(t>43){truck.visible=true;truck.position.x=mix(-76,0,ease((t-43)/5));}
  doors.forEach((d,i)=>d.rotation.y=(i===0?-1:1)*Math.PI*.85*(1-ease((t-27)/2)));
  loads.forEach((l,i)=>{const loaded=22+i*3;l.visible=t>=loaded&&t<39;l.position.x=mix(-5.6,i===0?-4:-1.7,ease((t-loaded)/1.2));});
  forks.forEach((f,i)=>animateFork(f,i,t,dt));
  renderer.render(scene,camera);requestAnimationFrame(frame);
}
// Fit the complete working scene to 90% of the available viewport.
function resize(){
  const host=document.querySelector('#warehouse');
  const w=host.clientWidth,h=host.clientHeight,aspect=w/h;
  camera.updateMatrixWorld(true);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const x of [-25,15])for(const y of [0,8.4])for(const z of [-12,18]){
    const p=new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
    minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
  }
  const halfH=Math.max((maxY-minY)/1.8,(maxX-minX)/(1.8*aspect));
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  camera.left=cx-halfH*aspect;camera.right=cx+halfH*aspect;camera.top=cy+halfH;camera.bottom=cy-halfH;
  camera.updateProjectionMatrix();renderer.setSize(w,h);
}
addEventListener('resize',resize);new ResizeObserver(resize).observe(document.querySelector('#warehouse'));resize();requestAnimationFrame(frame);
