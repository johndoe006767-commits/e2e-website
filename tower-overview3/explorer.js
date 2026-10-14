import * as THREE from './three.module.js';
import {snakePosition,connectorEndpoints} from './flow-layout.js';
import {stages,processes,towers} from './process-data.js';
const root=document.querySelector('#process-explorer');
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selectedStage=null,selectedProcess=null,tracedBlocker=null,activityGraph=null,currentTransition=null,selectionRequest=0;
const counts=id=>processes.filter(p=>p.stage===id);
const imageFor=id=>`./stage-images/${id}.png`;
const alts={plan:'Finance colleagues planning demand in a contemporary office',invest:'Investment in a modern biopharmaceutical facility',source:'Inventory operations in a modern warehouse',sell:'Container logistics supporting export orders',close:'Financial records being reviewed for the period close',measure:'Finance colleagues reviewing business performance'};
const blockerOrders=[2,2,4,9,2,4,1,2,4,6,1,2,2,1,3,6,2,5,6,2,3,2,5,3,3,6,3,7,4,5,2,1];
const blockers=Object.fromEntries(processes.map((p,i)=>[p.id,p.activities[blockerOrders[i]-1].id]));
root.innerHTML=`<section class="journey-gallery" id="journey-overview" aria-labelledby="journey-heading"><div class="gallery-heading"><div><h2 id="journey-heading">The path from demand<br>to profit.</h2></div></div><div class="stage-gallery">${stages.map((s,i)=>`<button class="stage-card" data-stage="${s.id}" aria-controls="stage-section" aria-expanded="false"><span class="stage-image-wrap"><img src="${imageFor(s.id)}" alt="${alts[s.id]}" width="1536" height="1024" decoding="async"><span class="image-arrow" aria-hidden="true">↗</span></span><span class="stage-card-title">${esc(s.name)}<span aria-hidden="true">→</span></span></button>`).join('')}</div></section>
<nav class="journey-nav" aria-label="End-to-end journey" hidden><button class="overview-link" id="back-overview">Journey</button><div class="journey-nav-stages">${stages.map((s,i)=>`<button data-nav-stage="${s.id}" aria-controls="stage-section">${esc(s.name)}</button>`).join('')}</div></nav>
<section class="stage-section" id="stage-section" aria-labelledby="stage-heading" hidden></section>
<section class="work-section" id="work-section" aria-labelledby="work-heading" hidden></section>
<p class="model-note">Illustrative model. Not official AstraZeneca process documentation.</p><div class="sr" role="status" aria-live="polite" id="explorer-status"></div>`;
class SignalGraph{
 constructor(host,nodeRoot,selector){
  this.host=host;this.nodeRoot=nodeRoot;this.selector=selector;this.paths=[];this.active=-1;this.visible=true;
  this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(0,1,0,1,.1,100);this.camera.position.z=10;
  try{this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{this.renderer=null;}
  if(this.renderer){this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor(0,0);host.append(this.renderer.domElement);}
  this.scene.add(new THREE.AmbientLight(0xffffff,2));
  this.observer=new ResizeObserver(()=>this.layout());this.observer.observe(nodeRoot);
  this.visibility=new IntersectionObserver(e=>{this.visible=e[0].isIntersecting});this.visibility.observe(host);this.layout();
 }
 layout(){
  const list=this.nodeRoot.querySelector('.activity-list');
  const nodes=[...this.nodeRoot.querySelectorAll(this.selector)];
  const columns=Number.parseInt(getComputedStyle(list).getPropertyValue('--flow-columns'),10)||1;
  nodes.forEach((node,i)=>{const pos=snakePosition(i,columns);node.style.gridRow=String(pos.row);node.style.gridColumn=String(pos.column);});
  if(!this.renderer)return;
  for(const p of this.paths){p.line.geometry.dispose();p.line.material.dispose();p.dot.geometry.dispose();p.dot.material.dispose();this.scene.remove(p.line,p.dot);}this.paths=[];
  const area=this.nodeRoot.getBoundingClientRect(),w=area.width,h=area.height;if(!w||!h)return;
  this.renderer.setSize(w,h);Object.assign(this.camera,{left:0,right:w,top:0,bottom:h});this.camera.updateProjectionMatrix();
  for(let i=0;i<nodes.length-1;i++){
   const a=nodes[i].getBoundingClientRect(),b=nodes[i+1].getBoundingClientRect();
   const ends=connectorEndpoints(a,b,area);
   const path=new THREE.LineCurve3(new THREE.Vector3(ends[0].x,ends[0].y,0),new THREE.Vector3(ends[1].x,ends[1].y,0));
   const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.getPoints(50)),new THREE.LineBasicMaterial({color:0x8d729e,transparent:true,opacity:.8}));
   const dot=new THREE.Mesh(new THREE.SphereGeometry(2.8,10,10),new THREE.MeshBasicMaterial({color:0xefb1d4}));this.scene.add(line,dot);this.paths.push({line,dot,path,index:i});
  }
 }
 tick(time){
  if(!this.renderer||!this.visible)return;
  for(const p of this.paths){
   const phase=(time*.3+p.index*.19)%1;
   const flowing=!reduce.matches&&(this.blockedAt===undefined||p.index<this.blockedAt);
   p.dot.position.copy(p.path.getPoint(phase));p.dot.visible=flowing;
   p.line.material.color.set(p.index===this.blockedAt?0xf3b2a9:0x8d729e);
   p.line.material.opacity=this.blockedAt!==undefined&&p.index>this.blockedAt?.25:.8;
  }
  this.renderer.render(this.scene,this.camera);
 }
 destroy(){this.observer?.disconnect();this.visibility?.disconnect();for(const p of this.paths){p.line.geometry.dispose();p.line.material.dispose();p.dot.geometry.dispose();p.dot.material.dispose();}this.renderer?.dispose();this.host.replaceChildren();}
}
const status=s=>document.querySelector('#explorer-status').textContent=s;
const nav=root.querySelector('.journey-nav');
function reveal(el,animate=true){if(animate&&!reduce.matches)el.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'cubic-bezier(.23,1,.32,1)'});}
function scrollSection(el,smooth=true){const y=el.getBoundingClientRect().top+scrollY-(nav.hidden?0:nav.offsetHeight);window.scrollTo({top:Math.max(0,y),behavior:smooth&&!reduce.matches?'smooth':'instant'});}
function renderStage(id){
 const s=stages.find(s=>s.id===id);if(!s)throw Error('Unknown stage');
 selectedStage=id;selectedProcess=null;tracedBlocker=null;activityGraph?.destroy();activityGraph=null;
 root.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.stage===id)));
 root.querySelectorAll('[data-nav-stage]').forEach(b=>{b.classList.toggle('is-active',b.dataset.navStage===id);if(b.dataset.navStage===id)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
 nav.hidden=false;document.querySelector('#work-section').hidden=true;
 document.querySelector('#dependencies').hidden=true;
 const section=document.querySelector('#stage-section');section.hidden=false;
 section.innerHTML=`<aside class="stage-title-column"><div><h2 id="stage-heading" tabindex="-1">${esc(s.name)}</h2></div></aside><div class="stage-main"><div class="stage-detail-image"><img id="selected-stage-image" src="${imageFor(id)}" alt="${alts[id]}" width="1536" height="1024"></div><div class="stage-context"><p>${esc(s.description)}</p></div><div class="process-grid">${counts(id).map((p,i)=>`<button class="process-node" data-process="${p.id}" aria-controls="work-section" aria-expanded="false"><span class="process-top"><span class="tower-tag">${esc(p.tower)}</span><span aria-hidden="true">↗</span></span><strong>${esc(p.name)}</strong><span class="process-bottom"><span>${String(i+1).padStart(2,'0')}</span><span>View activities</span></span></button>`).join('')}</div></div>`;
 status(`${s.name}: ${counts(id).length} processes shown in section 03.`);
}
function chooseStage(id,animate=true){
 if(!stages.some(s=>s.id===id))throw Error('Unknown stage');
 currentTransition?.skipTransition();const request=++selectionRequest;
 const cardImg=root.querySelector(`[data-stage="${id}"] img`);
 const r=cardImg.getBoundingClientRect();const inView=r.bottom>0&&r.top<innerHeight;
 if(document.startViewTransition&&animate&&!reduce.matches&&inView){
  cardImg.style.viewTransitionName='stage-picture';
  currentTransition=document.startViewTransition(()=>{
   if(request!==selectionRequest){cardImg.style.viewTransitionName='none';return;}
   cardImg.style.viewTransitionName='none';renderStage(id);
   document.querySelector('#selected-stage-image').style.viewTransitionName='stage-picture';
   scrollSection(document.querySelector('#stage-section'),false);
  });
  currentTransition.finished.finally(()=>{cardImg.style.viewTransitionName='none';if(request!==selectionRequest)return;const img=document.querySelector('#selected-stage-image');if(img)img.style.viewTransitionName='none';}).catch(()=>{});
 }else{
  let ghost;
  if(animate&&!reduce.matches&&inView){ghost=cardImg.cloneNode();Object.assign(ghost.style,{position:'fixed',left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`,objectFit:'cover',zIndex:'100',borderRadius:'8px',pointerEvents:'none'});document.body.append(ghost);}
  renderStage(id);scrollSection(document.querySelector('#stage-section'),!ghost&&animate);
  if(ghost){const target=document.querySelector('#selected-stage-image').getBoundingClientRect();const motion=ghost.animate([{transform:'translate(0,0) scale(1,1)'},{transform:`translate(${target.left-r.left}px,${target.top-r.top}px) scale(${target.width/r.width},${target.height/r.height})`}],{duration:560,easing:'cubic-bezier(.23,1,.32,1)',fill:'forwards'});ghost.style.transformOrigin='top left';motion.finished.finally(()=>ghost.remove()).catch(()=>ghost.remove());}
  reveal(document.querySelector('.stage-main'),animate);
 }
}
function chooseProcess(id,animate=true){
 currentTransition?.skipTransition();selectionRequest++;
 const p=processes.find(p=>p.id===id);if(!p)throw Error('Unknown process');
 if(selectedStage!==p.stage)renderStage(p.stage);
 selectedProcess=id;tracedBlocker=null;activityGraph?.destroy();
 root.querySelectorAll('[data-process]').forEach(b=>{b.classList.toggle('is-active',b.dataset.process===id);b.setAttribute('aria-expanded',String(b.dataset.process===id));});
 const section=document.querySelector('#work-section');section.hidden=false;
 document.querySelector('#dependencies').hidden=false;
 const blocker=p.activities.find(a=>a.id===blockers[p.id]);
 section.innerHTML=`<div class="work-heading"><div><span class="tower-tag">${esc(p.tower)}</span><h2 id="work-heading" tabindex="-1">${esc(p.name)}</h2><p>${esc(p.description)}</p></div><button class="text-button" id="back-processes">Back to ${esc(stages.find(s=>s.id===p.stage).name)} <span aria-hidden="true">↑</span></button></div><div class="work-flow-caption"><span>Activities</span><span class="trace-status"></span></div><div class="activity-map"><div id="activity-signals" class="signal-layer" aria-hidden="true"></div><ol class="activity-list">${p.activities.map(a=>`<li class="activity-node" id="${a.id}" tabindex="-1" data-order="${a.order}"><span class="activity-number">${String(a.order).padStart(2,'0')}</span><div><span class="activity-name">${esc(a.name)}</span>${a.id===blocker.id?`<div class="blocker-detail" hidden><strong>Hard blocker · Illustrative</strong><p>${esc(p.challenge)}</p><button class="blocker-return text-button">Return to challenge ↓</button></div>`:''}</div></li>`).join('')}</ol></div><button class="challenge-card" id="challenge-trace" aria-describedby="challenge-explanation"><span class="challenge-icon" aria-hidden="true">!</span><span class="challenge-copy"><span class="challenge-label">The challenge <span>Illustrative</span></span><span id="challenge-explanation">${esc(p.challenge)}</span><span class="trace-link">Trace to activity ${String(blocker.order).padStart(2,'0')} · ${esc(blocker.name)} <span aria-hidden="true">↗</span></span></span><span class="challenge-trace-arrow" aria-hidden="true">↗</span></button>`;
 activityGraph=new SignalGraph(section.querySelector('#activity-signals'),section.querySelector('.activity-map'),'.activity-node');
 section.querySelector('#back-processes').onclick=()=>scrollSection(document.querySelector('#stage-section'));
 section.querySelector('#challenge-trace').onclick=()=>traceChallenge();
 section.querySelector('.blocker-return').onclick=()=>{const challenge=section.querySelector('#challenge-trace');scrollSection(challenge);challenge.focus({preventScroll:true});};
 reveal(section,animate);scrollSection(section,animate);status(`${p.name}: ten activities and one challenge shown in section 04.`);
}
function traceChallenge(){
 const p=processes.find(p=>p.id===selectedProcess);if(!p)throw Error('Select a process first.');
 const activity=p.activities.find(a=>a.id===blockers[p.id]);tracedBlocker=activity.id;
 root.querySelectorAll('.activity-node').forEach(el=>{el.classList.toggle('is-blocker',el.id===activity.id);el.classList.toggle('is-downstream',Number(el.dataset.order)>activity.order);});
 const target=document.getElementById(activity.id);target.querySelector('.blocker-detail').hidden=false;
 document.querySelector('.trace-status').textContent=`Hard blocker located at activity ${String(activity.order).padStart(2,'0')}`;
 if(activityGraph){activityGraph.blockedAt=activity.order-1;activityGraph.layout();}
 scrollSection(target,true);target.focus({preventScroll:true});reveal(target);
 status(`Hard blocker: activity ${activity.order}, ${activity.name}. ${p.challenge}`);
 return {processId:p.id,activityId:activity.id,activityOrder:activity.order,activityName:activity.name,illustrative:true};
}
root.addEventListener('click',e=>{const stage=e.target.closest('[data-stage]'),navStage=e.target.closest('[data-nav-stage]'),process=e.target.closest('[data-process]');const animate=e.detail!==0;if(stage)chooseStage(stage.dataset.stage,animate);if(navStage)chooseStage(navStage.dataset.navStage,animate);if(process)chooseProcess(process.dataset.process,animate);});
root.querySelector('#back-overview').onclick=()=>scrollSection(root.querySelector('#journey-overview'));
let previous=0;function draw(now){if(now-previous>32&&!document.hidden){activityGraph?.tick(now/1000);previous=now;}requestAnimationFrame(draw);}requestAnimationFrame(draw);
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
 register({name:'get_finance_demo_model',description:'Read the illustrative finance stages, processes, activities and challenge blocker mappings.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({illustrative:true,stages,processes,towers,blockers,selectedStage,selectedProcess,tracedBlocker})});
 register({name:'explore_finance_process',description:'Open a demo process in section 04 with its ten activities and challenge.',inputSchema:{type:'object',properties:{processId:{type:'string'}},required:['processId'],additionalProperties:false},execute:input=>{if(!input||typeof input.processId!=='string'||!processes.some(p=>p.id===input.processId))throw Error('A valid processId is required.');chooseProcess(input.processId,false);return{selectedStage,selectedProcess};}});
 register({name:'trace_finance_challenge',description:'Trace the selected process challenge to its specific illustrative hard blocker activity, highlight it and scroll to it.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:traceChallenge});
 addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
