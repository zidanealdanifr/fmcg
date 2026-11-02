/** Pure 2D routing, shared by 3D animations and regression tests.
 * Layout convention: main service corridor z=9.45; racks have footprint
 * width=3.4, depth=1.4 with clear eastern aisles.
 */
export const FORKLIFT_CORRIDOR_Z = 9.45;
export function makeForkliftRoute(target,id=0,mode='storing',dockId=1){
  const home=[-15.5+id*3.2, 10.4];
  const aisle=[target[0]+2.55,FORKLIFT_CORRIDOR_Z];
  const approach=[target[0]+2.55,target[1]];
  return mode==='outbound'
    ? [home,[-13,FORKLIFT_CORRIDOR_Z],aisle,approach,aisle,[16-7*(dockId-1),FORKLIFT_CORRIDOR_Z],[16-7*(dockId-1),11.5],[16-7*(dockId-1),FORKLIFT_CORRIDOR_Z],[-13,FORKLIFT_CORRIDOR_Z],home]
    : [home,[-13,FORKLIFT_CORRIDOR_Z],aisle,approach,aisle,[-13,FORKLIFT_CORRIDOR_Z],home];
}
export function routePoint(waypoints,t){
  const progress=((t%1)+1)%1;
  const paths=waypoints.slice(1).map((b,i)=>({a:waypoints[i],b,length:Math.hypot(b[0]-waypoints[i][0],b[1]-waypoints[i][1])}));
  const length=paths.reduce((s,v)=>s+v.length,0)||1;
  let distance=progress*length;
  for(const path of paths){
    if(distance<=path.length){
      const fraction=path.length?distance/path.length:0;
      const smooth=fraction*fraction*(3-2*fraction);
      return [path.a[0]+(path.b[0]-path.a[0])*smooth,path.a[1]+(path.b[1]-path.a[1])*smooth];
    }
    distance-=path.length;
  }
  return waypoints[waypoints.length-1];
}
