import {createFlowModel} from './flow-models.js?v=20261019-az';
import {organs} from './organs.js?v=20261019-az';
const $=s=>document.querySelector(s);
// Native-DOM port of e2e-draft1's ActivityInfusion. The document replaces its dialog scroll host.
export function initProcessFlow(data){
 const section=$('#process-section'),root=$('#activity-infusion'),list=$('#flow-activities'),svg=root.querySelector('svg'),track=root.querySelector('.infusion-tube-shell'),fluid=root.querySelector('.infusion-tube-blood'),end=root.querySelector('.infusion-end');
 const names=new Map(data.towers.map(t=>[t.id,t.name])),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let endpointKind=null;
 let rows=[],models=[],trigger=null,frame=0,layoutDirty=true,opened=new Set(),expanding=false,animations=[],generation=0;
 const connections={};
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
 function connection(key,host,x,y){const next={x:host.offsetLeft+x,y:host.offsetTop+y};const old=connections[key];if(!old||Math.abs(old.x-next.x)>.1||Math.abs(old.y-next.y)>.1){connections[key]=next;layoutDirty=true;queue();}}
 function layout(){
  if(!layoutDirty||!rows.length)return;layoutDirty=false;
  const x=innerWidth<768?36:68,start=connections.start??{x,y:136};end.style.top=`${rows.at(-1).offsetTop}px`;
  const finish={x:connections.end?.x??x,y:end.offsetTop+(connections.end?.y??32)};
  const points=[start,...rows.slice(1,-1).map(row=>({x,y:row.offsetTop+16})),finish];
  let path=`M ${start.x} ${start.y}`;
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],bend=i%2===0?-16:16;path+=` C ${a.x+bend} ${a.y+(b.y-a.y)*.32}, ${b.x+bend} ${a.y+(b.y-a.y)*.72}, ${b.x} ${b.y}`;}
  svg.setAttribute('viewBox',`0 0 ${root.clientWidth} ${root.clientHeight}`);svg.style.height=`${root.clientHeight}px`;track.setAttribute('d',path);fluid.setAttribute('d',path);
 }
 function reveal(row,i){
  opened.add(i);const details=row.querySelector('details');if(details.open)return;
  const before=details.getBoundingClientRect().height;details.open=true;
  if(reduced.matches){layoutDirty=true;return;}
  const token=generation,after=details.getBoundingClientRect().height;expanding=true;details.style.overflow='hidden';
  const expansion=details.animate([{height:`${before}px`},{height:`${after}px`}],{duration:720,easing:'cubic-bezier(.23,1,.32,1)'});animations.push(expansion);
  const finish=()=>{details.style.overflow='';if(token!==generation)return;expanding=false;layoutDirty=true;queue();};expansion.onfinish=finish;expansion.oncancel=finish;
  [...details.querySelector('.infusion-copy').children].forEach((block,n)=>{animations.push(block.animate([{opacity:0,transform:'translateY(12px) scale(.985)',filter:'blur(2px)'},{opacity:1,transform:'none',filter:'blur(0)'}],{duration:780,delay:120+n*140,easing:'cubic-bezier(.23,1,.32,1)',fill:'backwards'}));});
 }
 function draw(){
  frame=0;if(section.hidden||!rows.length)return;layout();
  const rect=root.getBoundingClientRect(),start=connections.start?.y??136,finish=end.offsetTop+(connections.end?.y??32);
  const atBottom=scrollY>0&&scrollY+innerHeight>=document.documentElement.scrollHeight-3;
  const leading=atBottom?finish:Math.max(start,Math.min(finish,innerHeight*.56-rect.top));
  const length=track.getTotalLength();let lo=0,hi=length;
  for(let i=0;i<15;i++){const mid=(lo+hi)/2;if(track.getPointAtLength(mid).y<leading)lo=mid;else hi=mid;}
  fluid.style.strokeDasharray=`${atBottom?length:(lo+hi)/2} ${length}`;
  rows.forEach((row,i)=>{const reached=i===0||leading>=row.offsetTop+15;row.dataset.reached=String(reached);if(reached&&!opened.has(i)&&!expanding)reveal(row,i);});
  root.dataset.complete=String(atBottom||leading>=finish);
 }
 function queue(){if(!frame)frame=requestAnimationFrame(draw);}
 function open(towerId,processId){
  const process=data.towers.find(t=>t.id===towerId)?.processes.find(p=>p.id===processId);if(!process)return;
  generation++;animations.forEach(a=>a.cancel());animations=[];expanding=false;opened=new Set();trigger=document.activeElement;
  section.hidden=false;$('#flow-title').textContent=process.name;list.replaceChildren();
  rows=process.activities.map((activity,i)=>{
   const row=el('li',''),details=el('details',''),summary=el('summary','');summary.append(el('span','infusion-step',String(i+1).padStart(2,'0')),document.createTextNode(activity.name));
   const copy=el('div','infusion-copy');copy.append(el('p','',activity.description));
   const metadata=el('dl','infusion-metadata');
   for(const [label,value,key] of [['System',activity.platform,'system'],['Execution',activity.executionMode,'execution'],['Process owner',names.get(activity.ownerTowerId),'owner']]){
    const field=el('div',`infusion-field infusion-field-${key}`);field.append(el('dt','',label),el('dd','',value));metadata.append(field);
   }
   copy.append(metadata);
   if(activity.collaboratorTowerIds?.length)copy.append(el('p','infusion-collaboration',`With ${activity.collaboratorTowerIds.map(id=>names.get(id)).join(' + ')}`));
   for(const c of process.challenges.filter(c=>c.activityId===activity.id)){const challenge=el('div','testing-challenges');challenge.append(el('strong','','Challenges'),el('p','',c.description));copy.append(challenge);}
   details.append(summary,copy);details.addEventListener('toggle',()=>{if(details.open)opened.add(i);layoutDirty=true;queue();});row.append(details);list.append(row);return row;
  });
  if(!models[0]){const host=$('#flow-bag');models[0]=createFlowModel(host,'bag',(x,y)=>connection('start',host,x,y));}
  if(endpointKind!==towerId){
   models[1]?.destroy();delete connections.end;
   const host=$('#flow-brain'),organ=organs.find(o=>o.id===towerId);
   host.setAttribute('aria-label',`${organ.label} receiving the ${names.get(towerId)} process flow`);
   host.dataset.organ=towerId;
   models[1]=createFlowModel(host,towerId,(x,y)=>connection('end',host,x,y));
   endpointKind=towerId;
  }
  layoutDirty=true;layout();section.scrollIntoView({behavior:reduced.matches?'instant':'smooth'});$('#flow-title').focus({preventScroll:true});queue();
 }
 document.addEventListener('process-select',e=>open(e.detail.towerId,e.detail.processId));
 $('#flow-back').onclick=()=>{$('#section-1').scrollIntoView({behavior:reduced.matches?'instant':'smooth'});trigger?.focus({preventScroll:true});};
 const resize=new ResizeObserver(()=>{layoutDirty=true;queue();});resize.observe(root);
 addEventListener('scroll',queue,{passive:true});addEventListener('resize',()=>{layoutDirty=true;queue();});
 addEventListener('pagehide',()=>{cancelAnimationFrame(frame);animations.forEach(a=>a.cancel());resize.disconnect();removeEventListener('scroll',queue);models.forEach(m=>m.destroy());});
}
