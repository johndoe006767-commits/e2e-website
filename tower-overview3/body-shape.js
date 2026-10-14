import * as T from 'three';

const smooth=T.MathUtils.smoothstep;

// Preserve the original atlas body and remove only external genital detail.
export function neutralizeBodyGeometry(geometry,layer){
 if(layer!=='skin')return;
 const positions=geometry.getAttribute('position');
 const originalNormals=geometry.getAttribute('normal');
 const changed=new Uint8Array(positions.count);
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),ax=Math.abs(x);
  const amount=(1-smooth(ax,.035,.065))*smooth(y,.70,.745)*(1-smooth(y,.855,.91))*smooth(z,-.012,.018);
  if(amount===0)continue;
  const pelvicY=Math.max(y,.835-.10*ax);
  const pelvicZ=.047+.48*(pelvicY-.835)-.7*x*x;
  positions.setXYZ(i,x,T.MathUtils.lerp(y,pelvicY,amount),T.MathUtils.lerp(z,pelvicZ,amount));
  changed[i]=1;
 }
 positions.needsUpdate=true;
 geometry.deleteAttribute('normal');geometry.computeVertexNormals();
 // Keep the atlas shading everywhere outside the edited pelvic surface.
 const normals=geometry.getAttribute('normal');
 for(let i=0;i<positions.count;i++)if(!changed[i])normals.setXYZ(i,originalNormals.getX(i),originalNormals.getY(i),originalNormals.getZ(i));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
}
