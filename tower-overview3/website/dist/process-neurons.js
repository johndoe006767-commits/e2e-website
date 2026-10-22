import * as T from 'three';

// Labels use the actual soma objects from the supplied organ-specific network.
// Geometry, bifurcating dendrites and surface connections live in neurons.js.
export function createProcessNeurons(organ, group, processes, host) {
  group.visible = false;
  const neurons=group.children.filter(child=>/^Neuron \d+$/.test(child.name));
  if(neurons.length<processes.length)throw new Error('More processes than neurons');
  // a tower can list fewer processes than its organ has neurons: hide the spares and the connections that run to them
  neurons.slice(processes.length).forEach(n=>{n.visible=false;});
  group.traverse(m=>{if(m.userData.ends?.some(i=>i>=processes.length))m.visible=false;});
  const nodes = processes.map((process, i) => {
    const neuron=neurons[i];
    neuron.userData.processId=process.id;
    const side=i%2===0?-1:1;
    const label=document.createElement('div'); label.className='process-node'; label.dataset.processId=process.id;
    const title=document.createElement('span');title.className='process-name';title.textContent=process.name;
    const button=document.createElement('button');button.type='button';button.className='process-plus';button.textContent='+';
    button.setAttribute('aria-label',`Open ${process.name} process`);button.setAttribute('aria-pressed','false');
    button.setAttribute('aria-describedby','process-status');
    label.append(title,button);const leader=document.createElement('span');leader.className='process-leader';leader.setAttribute('aria-hidden','true');host.append(leader,label);
    button.addEventListener('click',()=>{
      host.querySelectorAll('.process-plus').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      host.querySelectorAll('.process-node').forEach(el=>el.classList.toggle('is-selected',el===label));
      document.querySelector('#process-status').textContent=`${process.name} process opened.`;
      // Open the selected process in the section below.
      host.dispatchEvent(new CustomEvent('process-select',{detail:{towerId:organ.id,processId:process.id},bubbles:true}));
    });
    return {neuron,label,button,leader,side,process,world:new T.Vector3()};
  });
  return {group,nodes};
}

export function updateProcessNeurons(organ, active, camera, width, height, time, reduced, layout) {
  const network=organ.processNeurons;
  network.group.visible=active;
  if(active)organ.root.updateMatrixWorld(true);
  for(const node of network.nodes){
    node.label.hidden=!active;node.leader.hidden=!active;node.button.tabIndex=active?0:-1;
    if(!active)continue;
    node.neuron.getWorldPosition(node.world).project(camera);
    node.x=(node.world.x+1)*width/2;node.y=(1-node.world.y)*height/2;
  }
  if(!active||!layout)return;
  // scene.js reserves space beside the organ (columns) or above and below it (rows); the cards
  // follow their neurons inside that space, so they never cover the organ, the HUD or the controls.
  const nodes=network.nodes,gap=12,half=Math.ceil(nodes.length/2);
  const place=(node,left,top,side)=>{node.left=left;node.top=top;node.label.dataset.side=String(side);node.label.style.transform=`translate3d(${left}px,${top}px,0)`;};
  if(layout.mode==='columns'){
    const byX=[...nodes].sort((a,b)=>a.x-b.x);
    for(const [side,column] of [[-1,byX.slice(0,half)],[1,byX.slice(half)]]){
      column.sort((a,b)=>a.y-b.y);
      let next=layout.T;
      for(const node of column){node.h=node.label.offsetHeight;node.top=Math.max(next,Math.min(layout.B-node.h,node.y-node.h/2));next=node.top+node.h+gap;}
      const over=next-gap-layout.B;
      for(const node of column)place(node,side<0?layout.leftX:layout.rightX,Math.max(layout.T,node.top-Math.max(0,over)),side);
    }
  }else{
    const byY=[...nodes].sort((a,b)=>a.y-b.y);
    [byY.slice(0,half),byY.slice(half)].forEach((row,r)=>{
      row.sort((a,b)=>a.x-b.x).forEach((node,i)=>{
        const h=node.label.offsetHeight;
        place(node,layout.rowX+i*(layout.cw+gap),r===0?layout.above-h:layout.below,1);
      });
    });
  }
  for(const node of network.nodes){
    const x=node.left+node.button.offsetLeft+node.button.offsetWidth/2;
    const y=node.top+node.button.offsetTop+node.button.offsetHeight/2;
    const dx=x-node.x,dy=y-node.y;
    node.leader.style.transform=`translate3d(${node.x}px,${node.y}px,0) rotate(${Math.atan2(dy,dx)}rad) scaleX(${Math.hypot(dx,dy)})`;
  }

}
