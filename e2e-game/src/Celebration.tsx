import {useEffect,useRef} from 'react';
export function Celebration(){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const canvas=ref.current!,ctx=canvas.getContext('2d')!;let frame=0,elapsed=0,last=performance.now();
  const colors=['#ffdc79','#fff1c2','#b5f3df','#ecc7ff','#ffb9d2','#ffffff'];
  // Recycle a bounded pool into continuing showers for 25 seconds.
  const paper=Array.from({length:330},(_,i)=>({x:Math.random(),y:-.08-Math.random()*.2,delay:Math.floor(i/110)*2.1+Math.random()*.8,speed:.15+Math.random()*.12,angle:Math.random()*6,spin:(Math.random()-.5)*4,w:10+Math.random()*12,h:i%5===0?28+Math.random()*18:7+Math.random()*8,color:colors[i%colors.length],phase:Math.random()*6}));
  function resize(){const dpr=Math.min(devicePixelRatio,2);canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}resize();window.addEventListener('resize',resize);
  function tick(now:number){const dt=Math.min((now-last)/1000,.04);last=now;if(document.hidden){frame=requestAnimationFrame(tick);return}elapsed+=dt;ctx.clearRect(0,0,innerWidth,innerHeight);
   ctx.globalAlpha=Math.max(0,Math.min(1,(25-elapsed)/2));
   for(const p of paper){if(elapsed<p.delay)continue;p.y+=p.speed*dt;p.angle+=dt*p.spin;if(p.y>1.15){if(elapsed<20){p.y=-.08-Math.random()*.2;p.x=Math.random();p.delay=elapsed+Math.random()*.5}continue;}
    ctx.save();ctx.translate(p.x*innerWidth+Math.sin(elapsed*1.4+p.phase)*65,p.y*innerHeight);ctx.rotate(p.angle);ctx.scale(Math.cos(elapsed*3+p.phase),1);ctx.fillStyle=p.color;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore();
   }
   ctx.globalAlpha=1;
   if(elapsed<25)frame=requestAnimationFrame(tick);else ctx.clearRect(0,0,innerWidth,innerHeight);
  }frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize)};
 },[]);
 return <canvas className="celebration-particles" ref={ref} aria-hidden="true"/>;
}
