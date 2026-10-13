import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const noise=(seed)=>{const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n);};

/** One complete path per subprocess, sharing trunk positions before branching.
 * Both endpoint layouts are baked once; the GPU interpolates without reallocating tubes.
 */
export function buildVesselNetwork(origin, assembled, separated, count, side, seed){
  if(!Number.isInteger(count)||count<0||count>500)throw new Error('Vessel count must be an integer from 0 to 500');
  if(count===0)return new T.BufferGeometry();
  const pieces=[];
  for(let i=0;i<count;i++){
    const cluster=Math.floor(i/4),branch=i%4;
    const makeCurve=(end,expanded)=>{
      const delta=end.clone().sub(origin),length=delta.length();
      const points=[origin.clone().add(new T.Vector3(side*noise(seed+cluster)*.015,(noise(cluster+seed+4)-.5)*.02,0))];
      const perpendicular=new T.Vector3(-delta.y,delta.x,0).normalize();
      for(const t of [.12,.28,.47,.68,.86]){
        const fork=t<.3?cluster:cluster*5+branch;
        const amplitude=(expanded?.09:.026)*Math.sin(Math.PI*t)*(0.5+noise(seed+cluster+3));
        const offset=(noise(seed+fork*13+Math.round(t*100))-.5)*2*amplitude;
        const p=origin.clone().lerp(end,t);
        p.addScaledVector(perpendicular,offset);
        p.x+=side*Math.sin(Math.PI*t)*Math.min(length*.12,.09);
        p.z+=Math.sin(Math.PI*t)*(.03+noise(seed+fork)*.025);
        points.push(p);
      }
      points.push(end.clone().add(new T.Vector3((noise(i+seed)-.5)*.027,(noise(i+seed+50)-.5)*.035,0)));
      return new T.CatmullRomCurve3(points,false,'centripetal');
    };
    const radius=(.00085+noise(i*7+seed)*.0017)*(count===1?1.7:1);
    const initial=new T.TubeGeometry(makeCurve(assembled,false),40,radius,5,false);
    const expanded=new T.TubeGeometry(makeCurve(separated,true),40,radius,5,false);
    // Taper from the heart towards the organ, with small natural variations in calibre.
    for(const g of [initial,expanded]){
      const p=g.getAttribute('position'),normal=g.getAttribute('normal'),uv=g.getAttribute('uv');
      for(let v=0;v<p.count;v++){
        const t=uv.getX(v);const taper=1-.62*t+.13*Math.sin(t*15+seed+i);
        p.setXYZ(v,p.getX(v)+normal.getX(v)*radius*(taper-1),p.getY(v)+normal.getY(v)*radius*(taper-1),p.getZ(v)+normal.getZ(v)*radius*(taper-1));
      }
    }
    initial.setAttribute('expandedPosition',expanded.getAttribute('position').clone());
    initial.setAttribute('expandedNormal',expanded.getAttribute('normal').clone());
    initial.setAttribute('branchSeed',new T.BufferAttribute(new Float32Array(initial.getAttribute('position').count).fill(noise(i+seed)),1));
    expanded.dispose();pieces.push(initial);
  }
  const merged=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());
  if(!merged)throw new Error('Could not build the vessel network');
  merged.userData.pathCount=count;
  return merged;
}
