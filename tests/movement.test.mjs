import test from 'node:test';
import assert from 'node:assert/strict';
import {RACKS} from '../src/engine.js';
import {makeForkliftRoute,routePoint} from '../src/movement.js';

const nearRack=(p,r)=>Math.abs(p[0]-r.x)<2.22 && Math.abs(p[1]-r.z)<1.25;

test('forklift service corridor stays clear of all rack footprints',()=>{
  for(const id of [0,1]){
    for(const r of RACKS){
      for(const mode of ['storing','outbound']){
        const route=makeForkliftRoute([r.x,r.z],id,mode);
        for(let i=0;i<1000;i++){
          const pos=routePoint(route,i/1000);
          const collision=RACKS.find(other=>nearRack(pos,other));
          assert.equal(collision,undefined,`AMR-${id} hit ${collision?.id} on route to ${r.id} at ${i}/1000`);
        }
      }
    }
  }
});
test('routePoint is periodic and stays inside the service yard',()=>{
  const path=makeForkliftRoute([-8.5,-7.4],0,'outbound');
  assert.deepEqual(routePoint(path,0),routePoint(path,1));
  for(let i=0;i<100;i++){
    const [x,z]=routePoint(path,i/100);
    assert.ok(x>=-16 && x<=17 && z>=-13 && z<=13);
  }
});
test('forklift home position and outbound holding point are different',()=>{
  const path=makeForkliftRoute([5.9,-1.15],1,'outbound');
  assert.ok(path.some(([x,z])=>x===16&&z===11.5));
  assert.notDeepEqual(path[0],path.at(-2));
});

test('three AMR parking positions have independent physical footprint clearance',()=>{
 const stops=[0,1,2].map(id=>makeForkliftRoute([-8.5,-7.4],id,'storing')[0]);
 for(let i=0;i<stops.length;i++)for(let j=i+1;j<stops.length;j++){
  assert.ok(Math.hypot(stops[i][0]-stops[j][0],stops[i][1]-stops[j][1])>=3.1);
 }
});
test('outbound routes to upgraded bays stay outside the rack footprints',()=>{
 for(const dockId of [1,2,3])for(const id of [0,1,2]){
  const path=makeForkliftRoute([-8.5,-7.4],id,'outbound',dockId);
  for(let i=0;i<=100;i++){
   const pos=routePoint(path,i/101);
   assert.equal(RACKS.find(r=>nearRack(pos,r)),undefined,`AMR ${id} hit rack on Bay ${dockId}`);
  }
  assert.ok(path.some(([x,z])=>x===16-7*(dockId-1) && z===11.5));
 }
});

test('smoothed 30 FPS AMR travel remains clear of rack hitboxes',()=>{
 for(const id of [0,1,2])for(const rack of RACKS)for(const mode of ['storing','outbound']){
  const route=makeForkliftRoute([rack.x,rack.z],id,mode,Math.min(3,id+1));
  const point=[...route[0]];
  for(let frame=0;frame<=720;frame++){
   const target=routePoint(route,Math.min(1,frame/720));
   const dx=target[0]-point[0],dz=target[1]-point[1],dist=Math.hypot(dx,dz);
   const step=Math.min(dist,4.7/30);
   if(dist>0){point[0]+=dx/dist*step;point[1]+=dz/dist*step;}
   assert.equal(RACKS.find(r=>nearRack(point,r)),undefined,`AMR-${id} crossed rack boundary near ${rack.id}`);
  }
 }
});
