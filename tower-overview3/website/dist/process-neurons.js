import * as T from 'three';

// Labels use the actual soma objects from the supplied organ-specific network.
// Geometry, bifurcating dendrites and surface connections live in neurons.js.
export function createProcessNeurons(organ, group, processes, host) {
  group.visible = false;
  const neurons=group.children.filter(child=>/^Neuron \d+$/.test(child.name));
  if(neurons.length!==processes.length)throw new Error('Process and neuron counts must match');
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

export function updateProcessNeurons(organ, active, camera, width, height, time, reduced) {
  const network=organ.processNeurons;
  network.group.visible=active;
  if(active)organ.root.updateMatrixWorld(true);
  const mobile=width<768;
  for(const node of network.nodes){
    node.label.hidden=!active;node.leader.hidden=!active;node.button.tabIndex=active?0:-1;
    if(!active)continue;
    node.neuron.getWorldPosition(node.world).project(camera);
    node.x=(node.world.x+1)*width/2;node.y=(1-node.world.y)*height/2;
    node.side=node.x<width/2?-1:1;
  }
  if(!active)return;
  // Resolve labels into two readable columns while retaining surface anchors.
  // On narrow screens the labels form two rows above and below the organ.
  for(const side of [-1,1]){
    const sorted=network.nodes.filter(n=>n.side===side).sort((a,b)=>a.y-b.y);
    let previous=72;
    for(const node of sorted){
      node.label.dataset.side=String(side);
      const rectWidth=node.label.offsetWidth,rectHeight=node.label.offsetHeight;
      let left=side<0?node.x-rectWidth-30:node.x+30;
      let top=Math.max(86,Math.min(height-135,node.y-rectHeight/2));
      top=Math.max(previous,top);previous=top+rectHeight+16;
      left=Math.max(16,Math.min(width-rectWidth-16,left));
      node.left=left;node.top=top;node.label.style.transform=`translate3d(${left}px,${top}px,0)`;
    }
  }
  if(mobile){
    network.nodes.forEach((node,i)=>{
      const row=i<2?0:1,col=i%2;
      const left=16+col*(width/2-8);
      const top=row===0?94:height-224;
      node.left=left;node.top=top;node.label.style.transform=`translate3d(${left}px,${top}px,0)`;
      node.label.dataset.side='1';
    });
  }
  for(const node of network.nodes){
    const x=node.left+node.button.offsetLeft+node.button.offsetWidth/2;
    const y=node.top+node.button.offsetTop+node.button.offsetHeight/2;
    const dx=x-node.x,dy=y-node.y;
    node.leader.style.transform=`translate3d(${node.x}px,${node.y}px,0) rotate(${Math.atan2(dy,dx)}rad) scaleX(${Math.hypot(dx,dy)})`;
  }

}
