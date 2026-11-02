import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialGame, unloadCargo, advanceGame, acceptContract, startPicking,
  dispatchTruck, cancelJob, buyUpgrade, liveStock, pendingStock,
  capacityOf, expiryQty, otdRate
} from '../src/engine.js';

const run = (g, n) => { for (let i=0; i<n; i++) g=advanceGame(g); return g; };

test('initial stock is physical, inside rack capacity, and OTD is undefined before delivery',()=>{
  const g=initialGame();
  assert.equal(liveStock(g),63);
  assert.equal(capacityOf(g),96);
  assert.equal(otdRate(g),null);
  assert.equal(expiryQty(g),15);
});

test('inbound unloads exactly 22 pallets, stages stock, and enables tutorial',()=>{
  let g=initialGame();g=unloadCargo(g);
  assert.equal(pendingStock(g),22);
  assert.equal(g.inboundSerial,1);
  assert.equal(g.tutorial,1);
  g=run(g,5);
  assert.equal(pendingStock(g),21);
  assert.equal(liveStock(g),64);
  assert.equal(g.tutorial,2);
});

test('contract picking transfers goods out of racks without duplicating them',()=>{
  let g=initialGame();
  g=acceptContract(g,'smg');
  assert.equal(g.job.status,'accepted');
  assert.equal(g.job.required,12);
  g=startPicking(g);
  g=run(g,48);
  assert.equal(g.job.status,'ready');
  assert.equal(g.job.loaded,12);
  assert.equal(g.job.picked.reduce((n,p)=>n+p.qty,0),12);
  assert.equal(liveStock(g),51);
});

test('canceling picking returns identical original SKU and expiration',()=>{
  let g=initialGame();g=acceptContract(g,'bdg');g=startPicking(g);g=run(g,12);
  const beforeTotal=liveStock(g)+pendingStock(g)+g.job.loaded;
  const picked=g.job.picked.map(p=>({sku:p.sku,expiryAt:p.expiryAt,receivedAt:p.receivedAt,qty:p.qty}));
  g=cancelJob(g);
  assert.equal(g.job,null);
  assert.equal(liveStock(g)+pendingStock(g),beforeTotal);
  for(const p of picked) assert.ok([...g.lots,...g.staging].some(s=>s.sku===p.sku&&s.expiryAt===p.expiryAt&&s.receivedAt===p.receivedAt&&s.qty>=p.qty));
});

test('truck departure and arrival generate correct revenue, OTD, and renewed contract',()=>{
  let g=initialGame();g=acceptContract(g,'smg');g=startPicking(g);g=run(g,48);
  const oldCash=g.cash;
  g=dispatchTruck(g);
  assert.equal(g.shipments.length,1);
  assert.equal(g.lastDispatchId,1);
  assert.equal(g.board.find(c=>c.key==='smg').status,'transit');
  g=run(g,29);
  assert.equal(g.shipments.length,0);
  assert.equal(g.cash,oldCash+7900);
  assert.equal(g.stats.delivered,1);
  assert.equal(otdRate(g),100);
  assert.equal(g.board.find(c=>c.key==='smg').status,'available');
});

test('rack upgrades increase capacity without increasing inventory',()=>{
  let g=initialGame();const oldCash=g.cash;g=buyUpgrade(g,'racks');
  assert.equal(g.cash,oldCash-19600);
  assert.equal(g.upgrades.racks,1);
  assert.equal(capacityOf(g),120);
  assert.equal(liveStock(g),63);
});

test('expiry removes perishable inventory, applies financial losses',()=>{
  let g=initialGame();g=run(g,82);
  assert.ok(g.stats.expired>=8);
  assert.ok(g.cash<48500);
  assert.ok(g.reputation<82);
});

test('pause freezes both physical warehouse and simulated clock',()=>{
  let g=initialGame();g={...g,paused:true};const advanced=advanceGame(g);
  assert.equal(advanced,g);
});

// v4 regressions: claimed missions, safe manual priority, expiry alerts and preservation of inventory.
import {MISSION_CARDS,missionProgress,claimMission,expeditePicking,operationalAlerts,opsScore,STAGING_CAPACITY} from '../src/engine.js';
test('mission rewards are gated, paid once, and do not require a server',()=>{
 let g=initialGame();
 assert.equal(claimMission(g,'inbound'),g);
 g=unloadCargo(g);
 assert.equal(missionProgress(g,'inbound'),1);
 const cash=g.cash;
 const first=claimMission(g,'inbound');
 assert.equal(first.cash,cash+MISSION_CARDS[0].reward);
 assert.equal(first.stats.xp,MISSION_CARDS[0].xp);
 assert.equal(claimMission(first,'inbound'),first);
});
test('manual expedite respects cooldown, charges only for actual picking, and preserves quantities',()=>{
 let g=initialGame();g=acceptContract(g,'smg');g=startPicking(g);g=run(g,8);
 const original=liveStock(g)+pendingStock(g)+g.job.loaded;
 const cash=g.cash;
 g=expeditePicking(g);
 assert.equal(g.cash,cash-480);
 assert.equal(g.job.loaded,3);
 assert.equal(liveStock(g)+pendingStock(g)+g.job.loaded,original);
 const blocked=expeditePicking(g);
 assert.equal(blocked.cash,g.cash);
 assert.equal(blocked.job.loaded,g.job.loaded);
});
test('manual expedite does not bypass capacity or double-count after ready',()=>{
 let g=initialGame();g=acceptContract(g,'yog');g=startPicking(g);
 g=run(g,48);
 assert.equal(g.job.status,'ready');
 const cash=g.cash;
 g=expeditePicking(g);
 assert.equal(g.cash,cash);
});
test('quality alerts and operation score are deterministic',()=>{
 const g=initialGame();
 assert.ok(operationalAlerts(g).some(x=>x.kind==='danger'));
 assert.ok(opsScore(g)>=0&&opsScore(g)<=100);
 g.staging=[{id:'test',rackId:null,qty:STAGING_CAPACITY,expiryAt:5000,sku:'MIE',receivedAt:0}];
 assert.ok(operationalAlerts(g).some(x=>x.title.includes('Cross-dock')));
});
test('cancel restores to racks and does not exceed their individual capacities',()=>{
 let g=initialGame();g=acceptContract(g,'bdg');g=startPicking(g);g=run(g,9);
 const total=liveStock(g)+pendingStock(g)+g.job.loaded;
 g=cancelJob(g);
 assert.equal(liveStock(g)+pendingStock(g),total);
 for(let i=1;i<=12;i++){
  assert.ok(g.lots.filter(l=>l.rackId==='R'+i).reduce((sum,l)=>sum+l.qty,0)<=12);
 }
});
