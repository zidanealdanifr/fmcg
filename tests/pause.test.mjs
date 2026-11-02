import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAVE_KEY, initialGame, advanceGame, loadSavedGame, acceptContract, startPicking,
  dispatchTruck, cancelJob, unloadCargo, buyUpgrade, expeditePicking, claimMission,
  chooseJob, TRUCK_ARRIVAL_TICKS, allJobs
} from '../src/engine.js';

const step=(g,n)=>Array.from({length:n}).reduce(x=>advanceGame(x),g);

test('pause completely freezes simulation time, inventory, arrival, and SLA',()=>{
  let g=acceptContract(initialGame(),'smg');g=startPicking(g);
  g=step(g,2);g={...g,paused:true};
  const before=JSON.stringify(g);
  for(let i=0;i<50;i++)assert.equal(advanceGame(g),g);
  assert.equal(JSON.stringify(g),before);
});

test('pause prevents ALL stock-moving and money-moving operations',()=>{
  let g=acceptContract(initialGame(),'smg');
  g={...g,paused:true};
  for(const action of [startPicking,dispatchTruck,cancelJob,unloadCargo,expeditePicking]){
    const next=action(g);
    assert.deepEqual(next,g,action.name);
  }
  for(const action of [x=>acceptContract(x,'bdg'),x=>buyUpgrade(x,'forklifts'),x=>claimMission(x,'inbound')]){
    assert.deepEqual(action(g),g);
  }
});

test('pause allows harmless selection of a bay, without moving cargo',()=>{
  let g=initialGame();g=acceptContract(g,'smg');g={...g,paused:true};
  const next=chooseJob(g,g.job.id);
  assert.equal(next.minute,g.minute);
  assert.equal(next.jobs[0].loaded,g.jobs[0].loaded);
});

test('resume continues arrival countdown from its exact paused progress',()=>{
  let g=acceptContract(initialGame(),'smg');g=startPicking(g);g=step(g,3);
  assert.equal(g.job.arrivalTicks,TRUCK_ARRIVAL_TICKS-3);
  g={...g,paused:true};const frozen=step(g,10);
  assert.equal(frozen.job.arrivalTicks,TRUCK_ARRIVAL_TICKS-3);
  const resumed=step({...frozen,paused:false},2);
  assert.equal(resumed.job.arrivalTicks,TRUCK_ARRIVAL_TICKS-5);
});

test('previous save reload resumes without auto pause or offline catch-up',()=>{
  let g=acceptContract(initialGame(),'smg');g=startPicking(g);g=step(g,3);
  g={...g,paused:true,speed:2};
  const previous=globalThis.window;
  globalThis.window={localStorage:{getItem:key=>key===SAVE_KEY?JSON.stringify(g):null}};
  try{
    const loaded=loadSavedGame();
    assert.equal(loaded.paused,false);
    assert.equal(loaded.minute,g.minute);
    assert.equal(loaded.jobs[0].arrivalTicks,g.jobs[0].arrivalTicks);
    assert.equal(loaded.jobs[0].loaded,g.jobs[0].loaded);
    assert.equal(loaded.speed,2);
  }finally{
    if(previous===undefined)delete globalThis.window;
    else globalThis.window=previous;
  }
});

test('multi-dock jobs and paused state both resume without duplicating inventory',()=>{
  let g={...initialGame(),cash:100000};
  g=buyUpgrade(g,'docks');
  g=acceptContract(g,'smg');g=startPicking(g);
  g=acceptContract(g,'bdg');g=startPicking(g);
  const before=allJobs(g).map(j=>[j.id,j.dockId,j.loaded]);
  const paused={...g,paused:true};
  for(let i=0;i<30;i++)assert.equal(advanceGame(paused),paused);
  assert.deepEqual(allJobs(paused).map(j=>[j.id,j.dockId,j.loaded]),before);
  const resumed=step({...paused,paused:false},1);
  assert.equal(resumed.jobs.length,2);
  assert.equal(new Set(resumed.jobs.map(j=>j.dockId)).size,2);
});
