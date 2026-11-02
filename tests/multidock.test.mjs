import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGame,buyUpgrade,acceptContract,chooseJob,allJobs,openDocks,availableInventory,liveStock,pendingStock,startPicking,advanceGame,dispatchTruck,cancelJob,dockCount} from '../src/engine.js';
const run=(game,n)=>{for(let i=0;i<n;i++)game=advanceGame(game);return game;};
const rich=()=>({...initialGame(),cash:200000});

test('without upgrade only one bay accepts a contract',()=>{
 let g=acceptContract(initialGame(),'smg');
 assert.equal(allJobs(g).length,1);
 assert.equal(g.job.dockId,1);
 assert.deepEqual(openDocks(g),[]);
 g=acceptContract(g,'bdg');
 assert.equal(allJobs(g).length,1);
 assert.equal(g.board.find(c=>c.key==='bdg').status,'available');
});
test('two dock upgrades allow 3 simultaneous, independent city orders',()=>{
 let g=rich();g=buyUpgrade(g,'docks');g=buyUpgrade(g,'docks');
 assert.equal(dockCount(g),3);
 for(const key of ['smg','bdg','sby'])g=acceptContract(g,key);
 assert.deepEqual(allJobs(g).map(j=>j.dockId),[1,2,3]);
 assert.equal(allJobs(g).length,3);
 assert.equal(availableInventory(g),63-12-15-18);
 assert.deepEqual(openDocks(g),[]);
 g=acceptContract(g,'yog');assert.equal(allJobs(g).length,3);
});
test('picking distributes real stock to 2 jobs without double counting',()=>{
 let g=rich();g=buyUpgrade(g,'docks');
 g=acceptContract(g,'smg');g=startPicking(g);
 g=acceptContract(g,'bdg');g=startPicking(g);
 const original=liveStock(g)+pendingStock(g)+allJobs(g).reduce((a,j)=>a+j.loaded,0);
 g=run(g,65);
 assert.equal(allJobs(g).length,2);
 assert.equal(allJobs(g).find(j=>j.key==='smg').status,'ready');
 assert.equal(allJobs(g).find(j=>j.key==='bdg').status,'ready');
 assert.equal(liveStock(g)+pendingStock(g)+allJobs(g).reduce((a,j)=>a+j.loaded,0),original);
});
test('dispatch frees only its bay and never blocks on-road shipments',()=>{
 let g=rich();g=buyUpgrade(g,'docks');
 g=acceptContract(g,'smg');g=startPicking(g);
 g=acceptContract(g,'bdg');g=startPicking(g);
 g=run(g,65);
 const first=allJobs(g).find(j=>j.key==='smg');
 g=chooseJob(g,first.id);g=dispatchTruck(g);
 assert.equal(g.shipments.length,1);
 assert.equal(g.shipments[0].dockId,1);
 assert.deepEqual(openDocks(g),[1]);
 assert.equal(allJobs(g).length,1);
 g=chooseJob(g,g.jobs[0].id);g=dispatchTruck(g);
 assert.equal(g.shipments.length,2);
 assert.deepEqual(openDocks(g),[1,2]);
 g=acceptContract(g,'yog');assert.equal(g.job.dockId,1);
});
test('cancel selected job only, leaving other bay and physical inventory unchanged',()=>{
 let g=rich();g=buyUpgrade(g,'docks');
 g=acceptContract(g,'smg');g=startPicking(g);
 g=acceptContract(g,'bdg');g=startPicking(g);
 g=run(g,9);
 const original=liveStock(g)+pendingStock(g)+allJobs(g).reduce((a,j)=>a+j.loaded,0);
 const first=allJobs(g).find(j=>j.key==='smg');
 g=chooseJob(g,first.id);g=cancelJob(g);
 assert.equal(allJobs(g).length,1);
 assert.equal(g.jobs[0].key,'bdg');
 assert.equal(g.board.find(c=>c.key==='smg').status,'available');
 assert.equal(liveStock(g)+pendingStock(g)+allJobs(g).reduce((a,j)=>a+j.loaded,0),original);
});
test('legacy single-order browser save migrates to Bay 1 without wiping progress',async()=>{
 const {loadSavedGame,SAVE_KEY}=await import('../src/engine.js');
 let old=acceptContract(initialGame(),'smg');
 old={...old};delete old.jobs;delete old.activeJobId;delete old.nextJobId;
 const previous=globalThis.window;
 globalThis.window={localStorage:{getItem:key=>key===SAVE_KEY?JSON.stringify(old):null}};
 try{
  const loaded=loadSavedGame();
  assert.equal(loaded.paused,false); // Auto-resume after a page refresh without simulating offline time.
  assert.equal(loaded.jobs.length,1);
  assert.equal(loaded.job.id,'ORD-001');
  assert.equal(loaded.job.dockId,1);
  assert.equal(loaded.job.required,12);
  assert.equal(liveStock(loaded),63);
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
