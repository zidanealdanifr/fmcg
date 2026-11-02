import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGame,acceptContract,startPicking,advanceGame,expeditePicking,liveStock,allJobs,buyUpgrade,chooseJob,TRUCK_ARRIVAL_TICKS,TRUCK_DEPART_TICKS,truckDocked,dispatchTruck,unloadCargo,pendingStock} from '../src/engine.js';

const step=(g,n)=>Array.from({length:n}).reduce(s=>advanceGame(s),g);

test('outbound cargo cannot be picked until incoming wingbox has parked',()=>{
  let g=acceptContract(initialGame(),'smg');
  assert.equal(g.job.arrivalTicks,TRUCK_ARRIVAL_TICKS);
  g=startPicking(g);
  const original=liveStock(g);
  g=step(g,TRUCK_ARRIVAL_TICKS-1);
  assert.equal(g.job.loaded,0);
  assert.equal(liveStock(g),original);
  assert.equal(truckDocked(g.job),false);
  g=step(g,2);
  assert.equal(truckDocked(g.job),true);
  assert.ok(g.job.loaded>0,'Picking should begin automatically after parking');
});

test('express picking is blocked until the truck finishes docking',()=>{
  let g=acceptContract(initialGame(),'smg');
  g=startPicking(g);
  const before=g.cash;
  const blocked=expeditePicking(g);
  assert.equal(blocked.cash,before);
  assert.equal(blocked.job.loaded,0);
  assert.match(blocked.logs[0].text,/parkir/i);
});

test('speed 4 still completes arrival after eight simulation ticks',()=>{
  let g=acceptContract(initialGame(),'smg');
  g=startPicking(g);
  g={...g,speed:4};
  g=advanceGame(g);
  assert.equal(g.job.arrivalTicks,4);
  assert.equal(g.job.loaded,0);
  g=advanceGame(g);
  assert.equal(g.job.arrivalTicks,0);
  assert.equal(g.job.loaded,0); // tick 8, first picking cycle at tick 9
  g=advanceGame(g);
  assert.ok(g.job.loaded>0);
});

test('simultaneous wingboxes have independent arrival countdown and cargo',()=>{
  let g=initialGame();g={...g,cash:200000};g=buyUpgrade(g,'docks');
  g=acceptContract(g,'smg');g=startPicking(g);
  g=step(g,4);
  assert.equal(g.jobs[0].arrivalTicks,4);
  g=acceptContract(g,'bdg');g=startPicking(g);
  assert.equal(g.jobs[1].arrivalTicks,TRUCK_ARRIVAL_TICKS);
  g=step(g,4);
  assert.equal(g.jobs[0].arrivalTicks,0);
  assert.equal(g.jobs[1].arrivalTicks,4);
  assert.ok(g.jobs[0].loaded>=0);
  assert.equal(g.jobs[1].loaded,0);
});

test('legacy jobs without arrivalTicks count as parked and remain playable',()=>{
  const g=initialGame();
  assert.equal(truckDocked({status:'loading'}),true);
  assert.equal(truckDocked(null),true);
});

test('reusing a bay waits for old truck to leave before the new truck may load',()=>{
  let g=acceptContract(initialGame(),'smg');
  g=startPicking(g);
  g=step(g,50);
  assert.equal(g.job.status,'ready');
  g=dispatchTruck(g);
  const next=acceptContract(g,'bdg');
  assert.equal(next.job.arrivalTicks,TRUCK_ARRIVAL_TICKS+TRUCK_DEPART_TICKS);
  assert.equal(next.job.dockId,1);
  const started=startPicking(next);
  const waiting=step(started,TRUCK_DEPART_TICKS);
  assert.equal(waiting.job.loaded,0);
  assert.equal(waiting.job.arrivalTicks,TRUCK_ARRIVAL_TICKS);
});

test('subsequent inbound stock cannot be unloaded before supplier parks',()=>{
  let g=unloadCargo(initialGame());
  g=step(g,75); // next inbound due; cinematic arrival begins
  assert.equal(g.inboundArrivalTicks,TRUCK_ARRIVAL_TICKS);
  const stock=pendingStock(g);
  const blocked=unloadCargo(g);
  assert.equal(pendingStock(blocked),stock);
  assert.match(blocked.logs[0].text,/parkir/i);
  g=step(g,TRUCK_ARRIVAL_TICKS);
  assert.equal(g.inboundArrivalTicks,0);
  const unloaded=unloadCargo(g);
  assert.ok(unloaded.inboundSerial>g.inboundSerial);
});
