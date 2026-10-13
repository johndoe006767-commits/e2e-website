'use client';
import React, {useState,useRef,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {Lightbulb,ArrowRight,ArrowCounterClockwise,X,HandGrabbing} from '@phosphor-icons/react';
import {ORGANS,pointsForMatch,shuffled,organAsset,type Organ} from './game';
import type {BodyScene,Target} from './body-scene';
import './style.css';
import {Celebration} from './Celebration';

type Status='ready'|'playing'|'paused'|'won';
type Notice={title:string;text:string;kind:'neutral'|'good'|'bad'|'hint'};
type Drag={id:string;pointer:number;x:number;y:number;startX:number;startY:number;moved:boolean;homeX:number;homeY:number};
const asset=organAsset;
const SNAP_ENTER=24,SNAP_EXIT=36;
function App(){
  const [status,setStatus]=useState<Status>('ready');const statusRef=useRef<Status>('ready');
  const [placed,setPlaced]=useState<string[]>([]);const placedRef=useRef<string[]>([]);
  const [score,setScore]=useState(0);
  const [hints,setHints]=useState(3);
  const [order,setOrder]=useState(ORGANS),[selected,setSelected]=useState<string|null>(null),[dragging,setDragging]=useState<string|null>(null);
  const [notice,setNotice]=useState<Notice>({title:'',text:'',kind:'neutral'});
  const [confirmReset,setConfirmReset]=useState(false),[assetsReady,setAssetsReady]=useState(false),[sceneReady,setSceneReady]=useState(false),[error,setError]=useState('');
  const [feedback,setFeedback]=useState<{id:string;kind:'success'|'error';x:number;y:number;width:number;height:number;stamp:number}|null>(null);
  useEffect(()=>{if(!feedback)return;const timer=setTimeout(()=>setFeedback(null),800);return()=>clearTimeout(timer)},[feedback]);
  const [aim,setAim]=useState({x:50,y:30});
  const bodyRef=useRef<HTMLDivElement>(null),ghostRef=useRef<HTMLDivElement>(null),dialogRef=useRef<HTMLDialogElement>(null);
  const sceneRef=useRef<BodyScene|null>(null),matchStarted=useRef(0),pausedAt=useRef(0),hintHistory=useRef(new Set<string>());
  const drag=useRef<Drag|null>(null),snapped=useRef<string|null>(null),reduce=useRef(false);
  const rotation=useRef<{pointer:number;x:number;startX:number;startY:number;moved:boolean}|null>(null);
  const suppressClick=useRef(false);
  const active=ORGANS.find(o=>o.id===selected),loaded=assetsReady&&sceneReady&&!error;
  const finished=status==='won';
  useEffect(()=>{if(finished){setFeedback(null);sceneRef.current?.celebrate()}},[finished]);
  useEffect(()=>{
    const leaveFullscreen=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&document.fullscreenElement)void document.exitFullscreen().catch(()=>{});
    };
    window.addEventListener('keydown',leaveFullscreen);
    return()=>window.removeEventListener('keydown',leaveFullscreen);
  },[]);
  function changeStatus(next:Status){if(next==='won')sceneRef.current?.celebrate();statusRef.current=next;setStatus(next)}

  useEffect(()=>{
    let cancelled=false;
    const pref=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>{reduce.current=pref.matches};update();pref.addEventListener('change',update);
    Promise.all(ORGANS.map(o=>new Promise<void>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve();img.onerror=reject;img.src=asset(o.id)}))).then(()=>{if(!cancelled)setAssetsReady(true)}).catch(()=>{if(!cancelled)setError('An organ image could not load. Reload to try again.')});
    return()=>{cancelled=true;pref.removeEventListener('change',update)};
  },[]);
  useEffect(()=>{
    let cancelled=false;let controller:BodyScene|undefined;
    import('./body-scene').then(({createBodyScene})=>{
      if(cancelled)return;
      try{controller=createBodyScene(bodyRef.current!,()=>{if(!cancelled)setSceneReady(true)},message=>{if(!cancelled){setError(message);setSceneReady(false);if(statusRef.current==='playing')pause()}});sceneRef.current=controller}
      catch{setError('This browser could not start the 3D view. Enable WebGL and reload.')}
    }).catch(()=>{if(!cancelled)setError('The 3D viewer could not load. Reload to try again.')});
    return()=>{cancelled=true;controller?.dispose();sceneRef.current=null};
  },[]);
  useEffect(()=>{sceneRef.current?.setPlaced(placed)},[placed]);
  useEffect(()=>{const dialog=dialogRef.current;if(confirmReset){if(!dialog?.open)dialog?.showModal()}else if(dialog?.open)dialog.close()},[confirmReset]);
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!dialogRef.current?.open){cancelDrag();setSelected(null)}};
    const blur=()=>{cancelDrag();rotation.current=null};
    window.addEventListener('keydown',escape);window.addEventListener('blur',blur);
    return()=>{window.removeEventListener('keydown',escape);window.removeEventListener('blur',blur)};
  },[]);

  function setSnap(id:string|null){
    if(snapped.current===id)return;
    if(snapped.current)bodyRef.current?.querySelector(`[data-checkpoint="${snapped.current}"]`)?.classList.remove('magnetized');
    snapped.current=id;
    if(id)bodyRef.current?.querySelector(`[data-checkpoint="${id}"]`)?.classList.add('magnetized');
    if(ghostRef.current){ghostRef.current.dataset.snapTarget=id??'';ghostRef.current.classList.toggle('snapped',Boolean(id))}
  }
  function hideGhost(){const ghost=ghostRef.current;if(ghost){ghost.getAnimations().forEach(a=>a.cancel());ghost.style.opacity='0'}}
  function cancelDrag(){drag.current=null;setDragging(null);setSnap(null);hideGhost()}
  function start(){
    if(!loaded)return;
    // Request synchronously from the click gesture; native Escape exits fullscreen.
    if(!document.fullscreenElement)void document.documentElement.requestFullscreen?.().catch(()=>{});
    cancelDrag();setFeedback(null);placedRef.current=[];setPlaced([]);setScore(0);setHints(3);
    hintHistory.current.clear();setOrder(shuffled(ORGANS));setSelected(null);setConfirmReset(false);setNotice({title:'',text:'',kind:'neutral'});
    sceneRef.current?.reset();sceneRef.current?.setPlaced([]);matchStarted.current=Date.now();pausedAt.current=0;changeStatus('playing');
  }
  function finishGame(){
    if(!loaded||finished)return;
    cancelDrag();setFeedback(null);setSelected(null);setConfirmReset(false);
    const ids=ORGANS.map(o=>o.id);placedRef.current=ids;setPlaced(ids);
    sceneRef.current?.setPlaced(ids);changeStatus('won');
  }
  function pause(){if(statusRef.current==='playing'){pausedAt.current=Date.now();cancelDrag();changeStatus('paused')}else if(statusRef.current==='paused'){matchStarted.current+=Date.now()-pausedAt.current;changeStatus('playing')}}
  function cancelRestart(){setConfirmReset(false);if(statusRef.current==='paused')pause()}
  function choose(id:string){if(statusRef.current!=='playing'||placedRef.current.includes(id))return;setSelected(id);setNotice({title:'',text:'',kind:'neutral'})}

  function candidate(id:string,x:number,y:number,retain=true):Target|null {
    const scene=sceneRef.current;if(!scene)return null;
    const own=scene.target(id);
    // Prefer the matching anchor in crowded anatomical regions, without blocking wrong drops.
    if(own&&!placedRef.current.includes(id)&&Math.hypot(x-own.x,y-own.y)<=SNAP_ENTER)return own;
    if(retain&&snapped.current){const held=scene.target(snapped.current);if(held&&!placedRef.current.includes(held.id)&&Math.hypot(x-held.x,y-held.y)<=SNAP_EXIT)return held}
    let closest:Target|null=null,distance=SNAP_ENTER;
    for(const o of ORGANS){if(placedRef.current.includes(o.id))continue;const target=scene.target(o.id);if(!target)continue;const d=Math.hypot(x-target.x,y-target.y);if(d<distance){closest=target;distance=d}}
    return closest;
  }
  function attempt(id:string,x:number,y:number,target:Target|null){
    if(statusRef.current!=='playing'||placedRef.current.includes(id))return false;
    const rect=bodyRef.current!.getBoundingClientRect();
    if(!target&&(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom)){setNotice({title:'No points deducted.',text:'',kind:'neutral'});return false}
    const organ=ORGANS.find(o=>o.id===id)!;
    if(target?.id===id){
      const earned=pointsForMatch(Date.now()-matchStarted.current);
      setScore(value=>value+earned);matchStarted.current=Date.now();
      const next=[...placedRef.current,id];placedRef.current=next;setPlaced(next);sceneRef.current?.setPlaced(next);setSelected(null);
      setFeedback({id,kind:'success',x:target.x,y:target.y,width:Math.max(18,target.width),height:Math.max(18,target.height),stamp:performance.now()});
      setNotice({title:`${organ.name}, in place.`,text:`+${earned} points.`,kind:'good'});
      if(next.length===ORGANS.length)changeStatus('won');return true;
    }
    setFeedback({id,kind:'error',x,y,width:96,height:96,stamp:performance.now()});
    setScore(value=>value-0.5);
    setNotice({title:'Not quite there.',text:'0.5 points deducted.',kind:'bad'});return false;
  }
  function hint(){
    if(statusRef.current!=='playing'||hints===0)return;
    let organ=ORGANS.find(o=>o.id===selected&&!hintHistory.current.has(o.id));
    if(!organ)organ=order.find(o=>!placedRef.current.includes(o.id)&&!hintHistory.current.has(o.id));
    if(!organ)return;hintHistory.current.add(organ.id);setSelected(organ.id);setHints(h=>h-1);setNotice({title:`A clue for ${organ.name.toLowerCase()}`,text:organ.hint,kind:'hint'});
  }
  function pointerDown(event:React.PointerEvent<HTMLButtonElement>,organ:Organ){
    if(statusRef.current!=='playing'||placedRef.current.includes(organ.id)||event.button!==0||drag.current)return;
    event.currentTarget.setPointerCapture(event.pointerId);const r=event.currentTarget.getBoundingClientRect();
    drag.current={id:organ.id,pointer:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false,homeX:r.left+r.width/2,homeY:r.top+r.height/2};
    hideGhost();setSnap(null);choose(organ.id);
  }
  function pointerMove(event:React.PointerEvent){
    const d=drag.current;if(!d||d.pointer!==event.pointerId)return;d.x=event.clientX;d.y=event.clientY;
    if(!d.moved&&Math.hypot(d.x-d.startX,d.y-d.startY)>5){d.moved=true;setDragging(d.id)}
    if(!d.moved)return;
    const target=candidate(d.id,d.x,d.y);setSnap(target?.id??null);
    const ghost=ghostRef.current!;ghost.style.opacity='1';
    const organ=ORGANS.find(o=>o.id===d.id)!;const own=sceneRef.current?.target(d.id);
    const w=target&&own?Math.max(18,own.width):96,h=target&&own?Math.max(18,own.height):96;
    ghost.style.width=`${w}px`;ghost.style.height=`${h}px`;
    ghost.style.transform=`translate(${(target?.x??d.x)-w/2}px,${(target?.y??d.y)-h/2}px)`;
    ghost.setAttribute('aria-label',`${organ.name} placement preview`);
  }
  function endDrag(event:React.PointerEvent,cancel=false){
    const d=drag.current;if(!d||d.pointer!==event.pointerId)return;drag.current=null;
    if(!d.moved){setSnap(null);return}
    // The release coordinate is authoritative; hovering or entering a checkpoint never scores.
    const target=cancel?null:candidate(d.id,event.clientX,event.clientY);
    const correct=!cancel&&attempt(d.id,event.clientX,event.clientY,target);
    setSnap(null);setDragging(null);
    const ghost=ghostRef.current!;
    const bounds=bodyRef.current!.getBoundingClientRect();
    const droppedOnBody=event.clientX>=bounds.left&&event.clientX<=bounds.right&&event.clientY>=bounds.top&&event.clientY<=bounds.bottom;
    if(correct||reduce.current||(!cancel&&(target||droppedOnBody))){hideGhost();return}
    const from=ghost.style.transform;
    ghost.style.opacity='0';
    ghost.animate([{transform:from,opacity:1},{transform:`translate(${d.homeX-ghost.offsetWidth/2}px,${d.homeY-ghost.offsetHeight/2}px)`,opacity:0}],{duration:220,easing:'cubic-bezier(.23,1,.32,1)'});
  }
  function rotateStart(event:React.PointerEvent<HTMLDivElement>){
    if(event.button!==0||drag.current||rotation.current||!sceneReady||statusRef.current==='paused'||finished)return;
    setFeedback(null);suppressClick.current=false;event.currentTarget.setPointerCapture(event.pointerId);
    rotation.current={pointer:event.pointerId,x:event.clientX,startX:event.clientX,startY:event.clientY,moved:false};
  }
  function rotateMove(event:React.PointerEvent<HTMLDivElement>){
    const r=rotation.current;if(!r||r.pointer!==event.pointerId)return;
    if(!r.moved&&Math.hypot(event.clientX-r.startX,event.clientY-r.startY)>4)r.moved=true;
    if(r.moved){sceneRef.current?.rotate((event.clientX-r.x)/bodyRef.current!.clientWidth*Math.PI*2);bodyRef.current?.classList.add('rotating')}
    r.x=event.clientX;
  }
  function rotateEnd(event:React.PointerEvent,cancel=false){const r=rotation.current;if(!r||r.pointer!==event.pointerId)return;suppressClick.current=cancel||r.moved;rotation.current=null;bodyRef.current?.classList.remove('rotating')}
  function boardKey(event:React.KeyboardEvent){
    if(!active){if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();sceneRef.current?.rotate(event.key==='ArrowLeft'?-.15:.15)}return}
    if(statusRef.current!=='playing')return;
    const step=event.shiftKey?1:3,moves:Record<string,[number,number]>={ArrowUp:[0,-step],ArrowDown:[0,step],ArrowLeft:[-step,0],ArrowRight:[step,0]};
    if(moves[event.key]){event.preventDefault();const [dx,dy]=moves[event.key];setAim(a=>({x:Math.max(0,Math.min(100,a.x+dx)),y:Math.max(0,Math.min(100,a.y+dy))}))}
    else if(event.key==='Enter'||event.key===' '){event.preventDefault();const r=bodyRef.current!.getBoundingClientRect(),x=r.left+r.width*aim.x/100,y=r.top+r.height*aim.y/100;attempt(active.id,x,y,candidate(active.id,x,y,false))}
    else if(event.key==='Escape')setSelected(null);
  }
  function hoverOrgan(event:React.PointerEvent<HTMLButtonElement>,entering:boolean){
    if(event.pointerType!=='mouse'||reduce.current)return;
    const button=event.currentTarget,img=button.querySelector('img');
    if(!img||button.disabled)return;
    if(entering){img.getAnimations().forEach(a=>{if(a instanceof Animation&&!(a instanceof CSSAnimation))a.cancel()});button.classList.add('floating');return}
    const from=getComputedStyle(img).transform;
    button.classList.remove('floating');
    img.getAnimations().forEach(a=>a.cancel());
    img.animate([{transform:from},{transform:`rotate(${button.style.getPropertyValue('--tilt')})`}],{duration:180,easing:'cubic-bezier(.23,1,.32,1)'});
  }
  function renderOrgan(organ:Organ,index:number){const done=placed.includes(organ.id);return <button key={organ.id} data-organ={organ.id} className={`organ-piece ${selected===organ.id?'selected':''} ${done?'placed':''} ${dragging===organ.id?'in-hand':''}`} disabled={status!=='playing'||done} aria-label={`${organ.name}${done?', placed':', select or drag'}`} aria-pressed={selected===organ.id} onPointerEnter={e=>hoverOrgan(e,true)} onPointerLeave={e=>hoverOrgan(e,false)} onPointerDown={e=>pointerDown(e,organ)} onPointerMove={pointerMove} onPointerUp={e=>endDrag(e)} onPointerCancel={e=>endDrag(e,true)} onLostPointerCapture={e=>{if(drag.current?.pointer===e.pointerId)endDrag(e,true)}} onClick={e=>{if(e.detail===0)choose(organ.id)}} style={{'--tilt':`${[-5,4,3,-4,2][index%5]}deg`} as React.CSSProperties}><span className="specimen"><img src={asset(organ.id)} alt="" draggable={false}/></span><span className="organ-name">{organ.name}</span></button>}

  return <><div className="atmosphere" aria-hidden="true"><div/></div><div className="app-shell"><main>
    <div className="game-heading"><div className="scoreboard" role="group" aria-label="Game statistics">
      <div className="stat score"><span>SCORE</span><strong data-testid="score">{score}<small> pts</small></strong></div>
      <div className="stat progress"><span>IN PLACE</span><strong>{String(placed.length).padStart(2,'0')}<small> / {ORGANS.length}</small></strong></div>
    </div>{!finished&&<button className="secondary finish-game" onClick={finishGame} disabled={!loaded}>Finish game</button>}</div>
    <section className={`playfield ${finished?'is-complete':''}`} aria-label="Anatomy game">
      <div className="organ-bank left-bank" aria-label="Left body part collection">{order.slice(0,Math.ceil(ORGANS.length/2)).map(renderOrgan)}</div>
      <div className="body-column"><div className="body-stage"><div className="body-aura"/>
        <span className="side-label right-label" title="Screen left">L</span><span className="side-label left-label" title="Screen right">R</span>
        <div ref={bodyRef} className={`body ${sceneReady?'three-ready':''} ${selected?'has-selection':''}`} data-testid="body" tabIndex={0} role="application" aria-label={active?`Place ${active.name}. Arrow keys aim, Enter places, Escape cancels.`:'3D skeleton. Drag horizontally or use left and right arrow keys to rotate.'} onKeyDown={boardKey} onPointerDown={rotateStart} onPointerMove={rotateMove} onPointerUp={e=>rotateEnd(e)} onPointerCancel={e=>rotateEnd(e,true)} onLostPointerCapture={e=>{if(rotation.current?.pointer===e.pointerId)rotateEnd(e,true)}} onClick={e=>{if(suppressClick.current){suppressClick.current=false;return}if(active&&e.detail>0)attempt(active.id,e.clientX,e.clientY,candidate(active.id,e.clientX,e.clientY,false))}}>
          <img className="skeleton skeleton-placeholder" src={asset('skeleton')} alt="Human skeleton" draggable={false}/>
          <div className="checkpoints" aria-hidden="true">{ORGANS.map(o=><span key={o.id} data-checkpoint={o.id} className="blood-cell" hidden/>)}</div>
          {active&&<span className="keyboard-aim" style={{left:`${aim.x}%`,top:`${aim.y}%`}} aria-hidden="true">+</span>}
        </div>
      </div></div>
      <div className="organ-bank right-bank" aria-label="Right body part collection">{order.slice(Math.ceil(ORGANS.length/2)).map(renderOrgan)}</div>
      {finished&&<div className="start-layer result-layer"><div className="start-panel result-panel" role="region" aria-labelledby="result-title"><h2 id="result-title">All in place.</h2><div className="result-count" data-testid="final-score">{score}<span> points</span></div><p>{ORGANS.length} body parts matched</p><button className="primary" onClick={start}><ArrowCounterClockwise size={18} aria-hidden="true"/>Play again</button></div></div>}
    </section>
    <div className="bottom-bar">
      <div className={notice.kind==='hint'?'feedback hint':'sr-only'} role="status" aria-live="polite"><span className="feedback-symbol">{notice.kind==='hint'?<Lightbulb size={20}/>:<HandGrabbing size={20}/>}</span><div><strong>{notice.title}</strong><p>{notice.text}</p></div></div>
      {<div className={`start-control ${status==='ready'?'':'dismissed'}`} aria-hidden={status!=='ready'}><button className="primary" onClick={start} disabled={!loaded||status!=='ready'}>{error?'Unable to load':loaded?'Start game':'Preparing anatomy…'}{loaded&&<ArrowRight size={20}/>}</button></div>}
      <div className="game-actions"><button className="hint-button" onClick={hint} disabled={status!=='playing'||hints===0}><Lightbulb size={19}/>Get a hint <span>{hints}</span></button><button className="icon-button" onClick={()=>{if(status==='playing')pause();setConfirmReset(true)}} disabled={status==='ready'} aria-label="Restart game"><ArrowCounterClockwise size={20}/></button></div>
    </div>
    {error&&<p className="scene-error" role="alert">{error} <button onClick={()=>location.reload()}>Reload</button></p>}
  </main></div>
  {finished&&<Celebration/>}
  <div ref={ghostRef} className="drag-ghost" aria-hidden="true" style={{opacity:0}}>{(dragging||selected)&&<img src={asset(dragging||selected!)} alt=""/>}<span className="drop-point"/></div>
  {feedback&&<div key={feedback.stamp} className={`placement-feedback ${feedback.kind}`} data-feedback={feedback.kind} aria-hidden="true" style={{left:feedback.x,top:feedback.y,width:feedback.width,height:feedback.height}}><img src={asset(feedback.id)} alt=""/></div>}
  <dialog aria-labelledby="restart-title" ref={dialogRef} onCancel={cancelRestart} onClick={e=>{if(e.target===e.currentTarget)cancelRestart()}}><button className="dialog-close icon-button" aria-label="Close" onClick={cancelRestart}><X size={20}/></button><h2 id="restart-title">Start a fresh body?</h2><p>This resets your placements, score and hints.</p><div className="dialog-actions"><button className="secondary" onClick={cancelRestart}>Keep progress</button><button className="primary" onClick={start}>Restart</button></div></dialog>
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
