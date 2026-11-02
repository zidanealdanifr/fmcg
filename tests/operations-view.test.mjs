import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGame} from '../src/engine.js';
import {nextOperation,operationSnapshot} from '../src/operationsView.js';

test('initial game suggests unloading rather than a completed tutorial tab',()=>{
  const g=initialGame();
  assert.equal(nextOperation(g).id,'unload');
  assert.match(nextOperation(g).detail,/Dock A/);
});
test('a paused game always surfaces a functioning resume command',()=>{
  const g=initialGame();g.paused=true;
  assert.equal(nextOperation(g).id,'resume');
});
test('accepted contract asks operator to start picking',()=>{
  const g=initialGame();g.job={status:'accepted',city:'Semarang',required:12,loaded:0};
  assert.equal(nextOperation(g).id,'pick');
});
test('ready shipment suggests dispatch',()=>{
  const g=initialGame();g.job={status:'ready',city:'Bandung',required:15,loaded:15};
  assert.equal(nextOperation(g).id,'dispatch');
});
test('on-road vehicle does not block dispatch from a bay',()=>{
  const g=initialGame();g.job={status:'ready',city:'Bandung',required:15,loaded:15};g.shipments=[{id:'wingbox1'}];
  assert.equal(nextOperation(g).id,'dispatch');
});
test('loading offers expedite only if cost and cooldown allow it',()=>{
  const g=initialGame();g.job={status:'loading',city:'Surabaya',required:23,loaded:3};
  assert.equal(nextOperation(g).id,'expedite');
  g.cash=0;
  assert.equal(nextOperation(g).id,'fleet');
});
test('loaded inbound staging skips unloading and suggests a contract',()=>{
  const g=initialGame();g.nextInboundAt=30;
  assert.equal(nextOperation(g).id,'contracts');
});
test('data snapshot is finite and respects capacity',()=>{
  const snap=operationSnapshot(initialGame());
  assert.ok(snap.storagePct>=0&&snap.storagePct<=100);
  assert.equal(snap.amrs,1);
  assert.equal(snap.docks,1);
  assert.ok(snap.capacity>=snap.stock);
});
