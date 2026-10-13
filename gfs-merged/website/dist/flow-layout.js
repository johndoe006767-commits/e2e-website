// Keep DOM / screen-reader order chronological while alternating visual row direction.
export function snakePosition(index, columns) {
  const row = Math.floor(index / columns);
  const offset = index % columns;
  return {row:row+1,column:row%2===0?offset+1:columns-offset};
}
export function connectorEndpoints(a,b,origin) {
  const sameRow=Math.abs(a.top-b.top)<10;
  if(sameRow){
    const right=b.left>a.left;
    return [
      {x:(right?a.right:a.left)-origin.left,y:a.top-origin.top+a.height/2},
      {x:(right?b.left:b.right)-origin.left,y:b.top-origin.top+b.height/2}
    ];
  }
  return [
    {x:a.left-origin.left+a.width/2,y:a.bottom-origin.top},
    {x:b.left-origin.left+b.width/2,y:b.top-origin.top}
  ];
}
