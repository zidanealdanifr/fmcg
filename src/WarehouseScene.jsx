import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { RACKS, getSku, rackStock, activeRackCount, pendingStock, dockCount, TRUCK_ARRIVAL_TICKS, allJobs } from './engine';
import { makeForkliftRoute, routePoint } from './movement.js';

const boxMat = (color, metalness = 0.02, roughness = 0.73) => ({ color, metalness, roughness });

function SceneLabel({ children, position, type = 'normal' }) {
  return <Html position={position} center distanceFactor={18} zIndexRange={[10, 0]}>
    <div className={`scene-label scene-label--${type}`}>{children}</div>
  </Html>;
}

function Ground({ dark }) {
  const tile = dark ? '#142031' : '#e4eaf2';
  return <group>
    <mesh receiveShadow position={[0, -0.68, 0]}>
      <boxGeometry args={[120, 0.45, 90]} />
      <meshStandardMaterial color={dark ? '#101b2a' : '#edf2f7'} roughness={1} />
    </mesh>
    <mesh receiveShadow position={[0, -0.38, 19]}>
      <boxGeometry args={[110, 0.12, 12]} />
      <meshStandardMaterial color={dark ? '#2d3642' : '#454e5b'} />
    </mesh>
    {Array.from({ length: 16 }, (_, i) => <mesh key={i} position={[-48 + i * 6.5, -0.309, 19]}>
      <boxGeometry args={[3, 0.015, 0.11]} />
      <meshBasicMaterial color="#f7f2d1" />
    </mesh>)}
    <mesh position={[0, -0.31, 12.5]}><boxGeometry args={[104, 0.017, 0.15]} /><meshBasicMaterial color="#f4bb4a" /></mesh>
    <mesh position={[0, -0.31, 25]}><boxGeometry args={[104, 0.017, 0.15]} /><meshBasicMaterial color="#f4bb4a" /></mesh>
    <mesh receiveShadow position={[0, -0.23, -0.4]}>
      <boxGeometry args={[47, 0.3, 27.7]} />
      <meshStandardMaterial color={tile} roughness={0.89} />
    </mesh>
    {Array.from({ length: 12 }, (_, i) => <mesh key={`lane-${i}`} position={[-22 + i * 4, -0.073, -0.4]}>
      <boxGeometry args={[0.035, 0.01, 27.5]} />
      <meshBasicMaterial color={dark ? '#283447' : '#cbd4df'} transparent opacity={0.7} />
    </mesh>)}
    {Array.from({ length: 7 }, (_, i) => <mesh key={`lanez-${i}`} position={[0, -0.068, -12.8 + i * 4.0]}>
      <boxGeometry args={[46.7, 0.01, 0.035]} />
      <meshBasicMaterial color={dark ? '#283447' : '#cbd4df'} transparent opacity={0.8} />
    </mesh>)}
    <mesh position={[0, -0.05, 11.7]}><boxGeometry args={[46, 0.015, 0.13]} /><meshBasicMaterial color="#f0b842" /></mesh>
    {/* Warehouse perimeter with an open front and a transparent back wall */}
    <mesh position={[0, 3.25, -13.9]}>
      <boxGeometry args={[47, 6.5, 0.16]} />
      <meshStandardMaterial color={dark ? '#4e7797' : '#a9c7d8'} transparent opacity={0.13} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
    {[-23.5, 23.5].map(x => <mesh key={x} position={[x, 3.25, 0]}>
      <boxGeometry args={[0.16, 6.5, 28]} />
      <meshStandardMaterial color={dark ? '#416781' : '#9cc5dc'} transparent opacity={0.17} depthWrite={false} />
    </mesh>)}
    {[-23.5, -15.5, -7.5, .5, 8.5, 16.5, 23.5].map(x => <mesh key={x} castShadow position={[x, 3.4, -13.92]}>
      <boxGeometry args={[0.22, 6.8, 0.24]} /><meshStandardMaterial color={dark ? '#55738a' : '#8199ad'} metalness={0.45} />
    </mesh>)}
    {[-23.5, 23.5].map(x => <mesh key={`front-${x}`} castShadow position={[x, 3.3, 13.75]}>
      <boxGeometry args={[0.22, 6.6, 0.25]} /><meshStandardMaterial color={dark ? '#55738a' : '#8199ad'} metalness={0.4} />
    </mesh>)}
    <mesh position={[0, 6.65, -13.8]}><boxGeometry args={[47.5, 0.22, .24]} /><meshStandardMaterial color={dark ? '#667c90' : '#849eb0'} /></mesh>
    <mesh position={[0, 6.65, 13.75]}><boxGeometry args={[47.5, 0.21, .24]} /><meshStandardMaterial color={dark ? '#667c90' : '#849eb0'} /></mesh>
    <mesh position={[0, 6.65, 0]}><boxGeometry args={[0.17, 0.18, 27.5]} /><meshStandardMaterial color={dark ? '#667c90' : '#849eb0'} /></mesh>
    {/* Industrial traffic guidance */}
    {[-18.5, 16.8].map(x => <mesh key={x} position={[x, -0.04, 2.1]} rotation={[0,0,0]}>
      <boxGeometry args={[0.1, .015, 15]} /><meshBasicMaterial color="#eeb842" transparent opacity={0.9} />
    </mesh>)}
  </group>;
}

function LoadedPallet({ position, color = '#d7a15a', size = 1 }) {
  return <group position={position} scale={size}>
    <mesh castShadow receiveShadow position={[0, .1, 0]}><boxGeometry args={[1.15, .2, .9]} /><meshStandardMaterial {...boxMat('#9d7148')} /></mesh>
    <mesh castShadow receiveShadow position={[0, .47, 0]}><boxGeometry args={[1, .55, .8]} /><meshStandardMaterial {...boxMat(color)} /></mesh>
    <mesh position={[0, .47, .404]}><boxGeometry args={[.64, .26, .01]} /><meshStandardMaterial color="#fff9e4" /></mesh>
    <mesh position={[0, .47, .415]}><boxGeometry args={[.36, .034, .01]} /><meshBasicMaterial color="#a6a6a6" /></mesh>
  </group>;
}

function StorageRack({ rack, lots, selected, onSelect, dark, eco, paused }) {
  const warning = lots.some(p => p.expiryAt - selected.minute <= 720);
  const danger = lots.some(p => p.expiryAt - selected.minute <= 280);
  const qty = lots.reduce((n, p) => n + p.qty, 0);
  const contents = useMemo(() => lots.flatMap(p => Array.from({ length: p.qty }, () => getSku(p.sku).color)).slice(0, eco?8:12), [lots,eco]);
  const lamp = useRef();
  const blinkTime=useRef(0);
  useFrame((_, delta) => {
    if (paused) return;
    blinkTime.current += Math.min(.2, delta);
    if (lamp.current) lamp.current.emissiveIntensity = warning ? 0.35 + .55 * (1 + Math.sin(blinkTime.current * (danger ? 7 : 4))) / 2 : 0.11;
  });
  const isSelected = selected.type === 'rack' && selected.id === rack.id;
  return <group position={[rack.x, 0, rack.z]} onClick={(e) => { e.stopPropagation(); onSelect({ type: 'rack', id: rack.id }); }}>
    {/* Highlighted floor selection / status lamp */}
    {isSelected && <mesh rotation={[-Math.PI/2,0,0]} position={[0, -.015, 0]}>
      <ringGeometry args={[1.35, 2.5, 40]} /><meshBasicMaterial color="#2c96fa" transparent opacity={0.35} side={THREE.DoubleSide} />
    </mesh>}
    <mesh position={[0, 4.55, 0]}>
      <boxGeometry args={[3.4, .13, 1.4]} />
      <meshStandardMaterial ref={lamp} color={warning ? '#ef515e' : '#348dba'} emissive={warning ? '#ed263c' : '#1b5e80'} emissiveIntensity={0.3} />
    </mesh>
    {[-1.55,1.55].flatMap(x => [-.6,.6].map(z => <mesh key={`${x}-${z}`} castShadow position={[x,2.22,z]}>
      <boxGeometry args={[.17,4.45,.17]} /><meshStandardMaterial color="#5a748b" metalness={0.65} roughness={0.32} />
    </mesh>))}
    {[.55,1.87,3.18].map((y,i) => <mesh key={i} castShadow position={[0,y,0]}>
      <boxGeometry args={[3.24,.15,1.29]} /><meshStandardMaterial color={dark ? '#8797a8' : '#9baebd'} metalness={0.6} roughness={0.39} />
    </mesh>)}
    {contents.map((color, i) => {
      const tier = Math.floor(i / 4);
      const pos = [-1.16, -.39, .39, 1.16][i % 4];
      return <group key={i} position={[pos, [0.66, 1.98, 3.29][tier], 0]}>
        <mesh position={[0, .06, 0]}><boxGeometry args={[.67,.1,.9]} /><meshStandardMaterial color="#99714c" /></mesh>
        <mesh position={[0, .35, 0]}><boxGeometry args={[.63,.52,.83]} /><meshStandardMaterial color={color} roughness={0.77} /></mesh>
        <mesh position={[0,.36,.422]}><boxGeometry args={[.36,.22,.013]} /><meshBasicMaterial color="#f9f7e8" /></mesh>
      </group>;
    })}
    <mesh position={[0,4.7,.03]}><boxGeometry args={[1.5,.34,.1]} /><meshStandardMaterial color={warning ? '#c74550' : '#2b526f'} /></mesh>
    {(warning || isSelected) && <SceneLabel position={[0, 5.27, 0]} type={warning ? 'red' : 'blue'}>
      {rack.zone}-{rack.bay} <span className="scene-label-count">{qty}/12</span> {warning && '⚠'}
    </SceneLabel>}
    <mesh position={[0,2.25,0]}>
      <boxGeometry args={[3.6,4.7,1.6]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  </group>;
}

function Conveyor({ stagingQty, level, dark, paused, speed=1 }) {
  const movers = useRef([]);
  const elapsed = useRef(0);
  useFrame((_,delta) => {
    if (!paused) elapsed.current += Math.min(.2, delta)*speed;
    movers.current.forEach((m, i) => {
      if (m) m.position.x = -2.7 + ((elapsed.current * (0.55 + level * .25) + i * 1.52) % 5.3);
    });
  });
  return <group position={[-14.5,0,5.7]}>
    <mesh castShadow position={[0,.52,0]}><boxGeometry args={[7.1,.28,1.85]} /><meshStandardMaterial color={dark ? '#486377' : '#6c8498'} metalness={0.6} /></mesh>
    {[-2.85, -1.2, .45, 2.15].map(x => <mesh key={x} castShadow position={[x,.22,0]}><boxGeometry args={[.15,.57,1.42]} /><meshStandardMaterial color="#526375" /></mesh>)}
    {Array.from({ length: 13 }, (_, i) => <mesh key={i} position={[-3.11+i*.52,.68,0]} rotation={[Math.PI/2,0,0]}>
      <cylinderGeometry args={[.11,.11,1.52,12]} /><meshStandardMaterial color="#a8bdc9" metalness={0.8} roughness={.3} />
    </mesh>)}
    {Array.from({ length: Math.min(4, Math.ceil(stagingQty / 5)) }, (_, i) => <group key={i} ref={el => movers.current[i] = el} position={[-2.7+i*1.2,.85,0]}>
      <mesh castShadow><boxGeometry args={[.8,.6,.72]} /><meshStandardMaterial color={['#d79759','#65b1b6','#b98cd7','#edc16d'][i]} /></mesh>
      <mesh position={[0,0,.37]}><boxGeometry args={[.4,.24,.012]} /><meshBasicMaterial color="#fff9de" /></mesh>
    </group>)}
    <mesh position={[-3.43,.5,0]}><boxGeometry args={[.12,.72,2]} /><meshStandardMaterial color="#e8a43c" /></mesh>
  </group>;
}

// Traffic-safe waypoints: the service corridor runs at z=9.45, and each
// rack is approached through the clear aisle on its eastern side.
function ForkliftModel({ id, fleetSize, dockId, timeRef, selected, onSelect, mode, target, dark, paused, taskKey, speed=1 }) {
  const group = useRef();
  const wheels = useRef([]);
  const light = useRef();
  const loadRef = useRef();
  const home=[-15.5+id*3.2, 10.4];
  // The aisle remains beyond the rack footprint (rack half-width 1.8).
  const routeRef=useRef(makeForkliftRoute(target,id,mode,dockId));
  const lastSlot=useRef(-1);
  const routeProgress=useRef(1);
  useEffect(()=>{lastSlot.current=-1;},[taskKey]);
  useFrame((_, delta) => {
    if(!group.current)return;
    const dt=paused?0:Math.min(.2,delta)*speed;
    const time=timeRef.current;
    const slot=Math.floor(time/26);
    // A slot is granted once per robot turn. Other robots stay safely parked.
    if(!paused && slot!==lastSlot.current){
      lastSlot.current=slot;
      if(mode!=='idle'&&slot%fleetSize===id && routeProgress.current>=1){
        routeRef.current=makeForkliftRoute(target,id,mode,dockId);
        routeProgress.current=0;
      }
    }
    if(routeProgress.current<1 && !paused){
      routeProgress.current=Math.min(1,routeProgress.current+dt/24);
    }
    // Even if the job ends, the AMR finishes its safe route before parking.
    const traveling=routeProgress.current<1;
    const phase=routeProgress.current;
    const destination=traveling?routePoint(routeRef.current,phase):home;
    const dx=destination[0]-group.current.position.x;
    const dz=destination[1]-group.current.position.z;
    const distance=Math.hypot(dx,dz);
    const step=Math.min(distance,dt*4.7);
    if(distance>.0001 && step>0){
      group.current.position.x+=dx/distance*step;
      group.current.position.z+=dz/distance*step;
      const direction=Math.atan2(dx,dz);
      const difference=Math.atan2(Math.sin(direction-group.current.rotation.y),Math.cos(direction-group.current.rotation.y));
      group.current.rotation.y+=difference*(1-Math.exp(-dt*6));
    }
    if(light.current)light.current.emissiveIntensity=.75+.22*Math.sin(time*2);
    if(loadRef.current)loadRef.current.visible=traveling&&phase>.15&&phase<.65;
    wheels.current.forEach(w=>{if(w&&!paused)w.rotation.x+=step*2.7;});
  });
  const isSelected=selected.type==='forklift'&&selected.id===id;
  return <group ref={group} position={[home[0],.02,home[1]]} onClick={e=>{e.stopPropagation();onSelect({type:'forklift',id});}}>
    {isSelected && <mesh rotation={[-Math.PI/2,0,0]} position={[0,.025,0]}><ringGeometry args={[.9,1.18,32]}/><meshBasicMaterial color="#268af4" transparent opacity={.65} side={THREE.DoubleSide}/></mesh>}
    <mesh castShadow position={[0,.45,0]}><boxGeometry args={[1.28,.77,1.7]}/><meshStandardMaterial color="#f0ab24" metalness={.28} roughness={.4}/></mesh>
    <mesh castShadow position={[0,.9,-.5]}><boxGeometry args={[1.25,.48,.7]}/><meshStandardMaterial color="#d88a18"/></mesh>
    <mesh position={[0,1.46,-.35]}><boxGeometry args={[1.25,.085,1.18]}/><meshStandardMaterial color={dark?'#2c4152':'#374e60'}/></mesh>
    {[-.5,.5].map(x=><mesh key={x} position={[x,1.18,-.38]}><boxGeometry args={[.08,.72,.07]}/><meshStandardMaterial color="#374e60"/></mesh>)}
    {[-.37,.37].map(x=><mesh key={x} castShadow position={[x,1.15,.78]}><boxGeometry args={[.13,2,.15]}/><meshStandardMaterial color="#425363"/></mesh>)}
    <mesh position={[0,.3,1.38]}><boxGeometry args={[1.1,.1,1.25]}/><meshStandardMaterial color="#5c6876" metalness={.6}/></mesh>
    {[-.76,.76].flatMap((x,xi)=>[-.55,.64].map((z,zi)=><group key={`${x}-${z}`} position={[x,.26,z]}>
      <mesh rotation={[0,0,Math.PI/2]} ref={el=>{wheels.current[xi*2+zi]=el;}}><cylinderGeometry args={[.3,.3,.21,14]}/><meshStandardMaterial color="#2d3139" roughness={1}/></mesh>
      <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.14,.14,.22,14]}/><meshStandardMaterial color="#929da6" metalness={.6}/></mesh>
    </group>))}
    <mesh position={[0,1.74,-.36]}><sphereGeometry args={[.14,10,10]}/><meshStandardMaterial ref={light} color="#ffd574" emissive="#ffb31c" emissiveIntensity={1.3}/></mesh>
    <group ref={loadRef} position={[0,.42,1.26]}><mesh><boxGeometry args={[.9,.56,.7]}/><meshStandardMaterial color={id%2?'#69c4b0':'#d8a46c'}/></mesh></group>
    {isSelected && <SceneLabel position={[0,2.45,0]} type="blue">AMR-{String(id+1).padStart(2,'0')} · {mode==='idle'?'SIAGA':'BERTUGAS'}</SceneLabel>}
  </group>;
}

function TruckModel({ variant = 'outbound', dark = false, selected = false, loaded = 0, onClick }) {
  const wingbox = variant === 'outbound';
  return <group onClick={e => { e.stopPropagation(); onClick?.(); }}>
    {selected && <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.1,0]}>
      <ringGeometry args={[1.7,2.25,40]} /><meshBasicMaterial color="#2e96f0" transparent opacity={.5} side={THREE.DoubleSide} />
    </mesh>}
    {/* Long cargo box */}
    <RoundedBox castShadow args={[2.6,2.65,5.2]} radius={.12} smoothness={3} position={[0,1.74,-1.14]}>
      <meshStandardMaterial color={wingbox ? '#f4f7fb' : '#e0e9ef'} metalness={.22} roughness={.48} transparent={wingbox && loaded > 0} opacity={wingbox && loaded > 0 ? .88 : 1} />
    </RoundedBox>
    <mesh position={[0,1.71,-3.77]}><boxGeometry args={[2.37,2.2,.055]} /><meshStandardMaterial color={wingbox ? '#d1dbe8' : '#abc3d3'} /></mesh>
    <mesh position={[1.325,1.56,-1.0]}><boxGeometry args={[.025,1.65,4.6]} /><meshStandardMaterial color={wingbox ? '#1c73bd' : '#df8a24'} /></mesh>
    <mesh position={[-1.326,1.56,-1.0]}><boxGeometry args={[.025,1.65,4.6]} /><meshStandardMaterial color={wingbox ? '#1c73bd' : '#df8a24'} /></mesh>
    <mesh castShadow position={[0,.82,2.32]}><boxGeometry args={[2.45,1.6,2.18]} /><meshStandardMaterial color={wingbox ? '#0c70ba' : '#ce7a24'} metalness={.23} /></mesh>
    <mesh position={[0,1.43,3.419]}><boxGeometry args={[2.17,.61,.04]} /><meshStandardMaterial color="#82b2ce" metalness={.65} roughness={.2} /></mesh>
    {[-1.23,1.23].map(x => <mesh key={x} position={[x,.7,2.9]}><boxGeometry args={[.1,.24,.48]} /><meshStandardMaterial color="#ffedaf" emissive="#ffe4a1" emissiveIntensity={.5} /></mesh>)}
    <mesh position={[0,.37,3.44]}><boxGeometry args={[2.3,.26,.17]} /><meshStandardMaterial color="#3e5365" /></mesh>
    {[-1.36,1.36].flatMap(x => [-3.08,-2.05,-.95,1.64,2.87].map(z => <group key={`${x}/${z}`} position={[x,.4,z]}>
      <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.38,.38,.25,15]} /><meshStandardMaterial color="#262b32" roughness={.96} /></mesh>
      <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.17,.17,.26,15]} /><meshStandardMaterial color="#abb6c0" metalness={.5} /></mesh>
    </group>))}
  </group>;
}

// Smooth Catmull-Rom movement provides curved truck approach/exit instead of
// teleports at segment boundaries. All points stay on the external road.
function truckCurve(points){return new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],0,p[1])),false,'centripetal',.38);}
const outboundRoad=truckCurve([[18.2,17],[18.2,19.5],[18.5,21.5],[21.2,22.5],[31,22.5],[55,22.5]]);
const inboundRoad=truckCurve([[-55,22.5],[-35,22.5],[-23,22.5],[-20,20.7],[-20,17]]);
const inboundExit=truckCurve([[-20,17],[-20,20.7],[-23,22.5],[-35,22.5],[-55,22.5]]);
function applyTruckPose(group,curve,t){
 const u=Math.max(0,Math.min(1,t));
 const p=curve.getPointAt(u),tan=curve.getTangentAt(u).normalize();
 group.position.copy(p);
 group.rotation.y=Math.atan2(tan.x,tan.z);
}
// One independently animated wingbox per outbound bay. No single-truck illusion.
function OutboundTruck({dockId,job,shipment,selected,onSelect,dark,paused,speed=1}){
 const x=18.2-(dockId-1)*7.2;
 const mesh=useRef();
 const motion=useRef({phase:job?((job.arrivalTicks??0)>0?'arriving':'parked'):'hidden',time:job?Math.max(0,8-(job.arrivalTicks??0)):0,jobId:job?.id||null,departId:shipment?.id||null});
 useFrame((_,delta)=>{
   if(!mesh.current)return;
   const m=motion.current;
   if(shipment?.id && shipment.id!==m.departId){
     m.departId=shipment.id;m.phase='leaving';m.time=0;
   }
   if(job?.id && job.id!==m.jobId){
     m.jobId=job.id;
     if(m.phase!=='leaving'){m.phase='arriving';m.time=0;}
     else m.pending=true;
   }
   if(!paused)m.time+=Math.min(.2,delta)*speed;
   if(m.phase==='leaving'){
     const t=Math.min(1,m.time/7);
     mesh.current.position.set(x + Math.max(0,t-.6)*17,0,17+10*Math.min(t/.6,1));
     mesh.current.rotation.y=t>.6?Math.PI/2:0;
     mesh.current.visible=true;
     if(t>=1){m.phase=m.pending?'arriving':'hidden';m.time=0;m.pending=false;}
   }else if(m.phase==='arriving'){
     const t=Math.min(1,m.time/8);
     const e=t*t*(3-2*t);
     mesh.current.position.set(x,0,27-10*e);
     mesh.current.rotation.y=0;mesh.current.visible=true;
     if(t>=1){m.phase='parked';m.time=0;}
   }else if(m.phase==='parked'){
     mesh.current.position.set(x,0,17);
     mesh.current.rotation.y=0;
     mesh.current.visible=Boolean(job);
     if(!job){m.phase='hidden';}
   }else{mesh.current.position.set(x,0,27);mesh.current.visible=false;}
 });
 return <group ref={mesh} position={[x,0,job&&!(job.arrivalTicks>0)?17:27]} visible={Boolean(job)}>
    <TruckModel variant="outbound" dark={dark} loaded={job?.loaded||0} selected={selected.type==='truck'&&selected.id===`dock-${dockId}`} onClick={()=>onSelect({type:'truck',id:`dock-${dockId}`})}/>
 </group>;
}
function InboundTruck({ dark, selected, onSelect, ready, arrivalTicks=0, paused, speed=1 }) {
 const group=useRef();
 const last=useRef(ready);
 const anim=useRef({mode:ready?(arrivalTicks>0?'arriving':'parked'):'away',t:ready&&arrivalTicks>0?7.5*(1-arrivalTicks/TRUCK_ARRIVAL_TICKS):0});
 useEffect(()=>{
  if(last.current===ready)return;
  last.current=ready;anim.current={mode:ready?'arriving':'departing',t:0};
 },[ready]);
 useFrame((_,delta)=>{
  if(!group.current)return;
  const state=anim.current;
  if(!paused)state.t+=Math.min(.2,delta)*speed;
  if(state.mode==='parked'){group.current.position.set(-20,0,17);group.current.rotation.y=0;}
  else if(state.mode==='away'){group.current.position.set(-70,0,22.5);}
  else if(state.mode==='arriving'){
   applyTruckPose(group.current,inboundRoad,state.t/7.5);
   if(state.t>=7.5)state.mode='parked';
  }else{
   applyTruckPose(group.current,inboundExit,state.t/6.7);
   if(state.t>=6.7)state.mode='away';
  }
 });
 return <group ref={group} position={ready?[-20,0,17]:[-70,0,22.5]}>
   <TruckModel variant="inbound" dark={dark} selected={selected.type==='truck'&&selected.id==='inbound'} onClick={()=>onSelect({type:'truck',id:'inbound'})}/>
 </group>;
}

function DockInfrastructure({dark,docks,onSelect}) {
  return <group>
    <group position={[-20,0,12.2]}>
      <mesh castShadow position={[0,.28,0]}><boxGeometry args={[5.4,.55,2.3]}/><meshStandardMaterial color={dark?'#586a7a':'#8da3b4'}/></mesh>
    </group>
    {Array.from({length:docks},(_,i)=>{
      const dockId=i+1;const x=18.2-i*7.2;
      return <group key={dockId} position={[x,0,12.2]} onClick={e=>{e.stopPropagation();onSelect({type:'dock',id:dockId});}}>
        <mesh castShadow position={[0,.25,0]}><boxGeometry args={[5.6,.5,2.4]}/><meshStandardMaterial color={dark?'#586a7a':'#8da3b4'}/></mesh>
        <mesh castShadow position={[0,2,-1.1]}><boxGeometry args={[5.1,3,.24]}/><meshStandardMaterial color={dark?'#395468':'#66869c'}/></mesh>
        <mesh position={[0,2,-.96]}><boxGeometry args={[3.8,2.4,.05]}/><meshStandardMaterial color={dark?'#293c50':'#d1e0ea'}/></mesh>
        <mesh position={[0,.15,2]}><boxGeometry args={[5.1,.04,.13]}/><meshBasicMaterial color="#e7ab37"/></mesh>
        <SceneLabel position={[0,4,0]} type="teal">BAY {dockId}</SceneLabel>
      </group>;
    })}
  </group>;
}
function MiniPalletStaging({ qty }) {
  return <group position={[-15.0,0,9.5]}>
    {Array.from({ length: Math.min(qty, 12) }, (_,i)=> <LoadedPallet key={i} size={.62} color={['#e6b95e','#e49e69','#8fbdd6','#bf95bb'][i%4]} position={[-2.35+(i%6)*.9, 0,-.8+Math.floor(i/6)*1.0]} />)}
  </group>;
}

function Warehouse({ game, dark, selected, onSelect, eco, controlsRef }) {
  const racks = RACKS.slice(0,activeRackCount(game));
  const staging = pendingStock(game);
  const readyLoadJobs=allJobs(game).filter(j=>j.status==='loading'&&(j.arrivalTicks??0)<=0);
  // Never send the outbound AMRs to an empty bay: dispatch only after parking.
  const working = readyLoadJobs.length ? 'outbound' : staging ? 'storing' : 'idle';
  const sharedAmrClock=useRef(0);
  const activeTaskKey=readyLoadJobs.map(j=>j.id).join(':')+'|'+working;
  useEffect(()=>{sharedAmrClock.current=0;},[activeTaskKey]);
  useFrame((_,delta)=>{if(!game.paused)sharedAmrClock.current+=Math.min(.2,delta)*game.speed;});
  // Stable routes avoid hard snaps in the 3D path as inventory is picked.
  const pickedTarget = racks[2] || RACKS[0];
  return <>
    <color attach="background" args={[dark ? '#0b1624' : '#e7eef5']} />
    <fog attach="fog" args={[dark ? '#0b1624' : '#e7eef5', 80, 225]} />
    <ambientLight intensity={dark ? .8 : 1.05} />
    <hemisphereLight args={['#f0faff','#718291',dark ? 1.2 : 1.6]} />
    <directionalLight position={[-18,30,20]} intensity={dark ? 2.2 : 2.6} castShadow={!eco} shadow-mapSize={[1024,1024]} shadow-camera-left={-37} shadow-camera-right={37} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-bias={-.0002} />
    {!eco && <pointLight position={[0,8,0]} color="#ffedc3" intensity={dark ? 27 : 15} distance={34} decay={2} />}
    <Ground dark={dark} />
    {racks.map(rack => <StorageRack key={rack.id} rack={rack} lots={rackStock(game,rack.id)} selected={{...selected, minute:game.minute}} onSelect={onSelect} dark={dark} eco={eco} paused={game.paused} />)}
    <Conveyor stagingQty={staging} level={game.upgrades.conveyor} dark={dark} paused={game.paused} speed={game.speed} />
    <MiniPalletStaging qty={staging} />
    {Array.from({length: 1+game.upgrades.forklifts},(_,id)=><ForkliftModel key={id} id={id} fleetSize={1+game.upgrades.forklifts} timeRef={sharedAmrClock} taskKey={activeTaskKey} dockId={readyLoadJobs[id%Math.max(1,readyLoadJobs.length)]?.dockId||1} selected={selected} onSelect={onSelect} dark={dark} paused={game.paused} speed={game.speed} mode={working} target={[racks[(2+id*3)%racks.length]?.x ?? pickedTarget.x, racks[(2+id*3)%racks.length]?.z ?? pickedTarget.z]} />)}
    <DockInfrastructure dark={dark} docks={dockCount(game)} onSelect={onSelect}/>
    <InboundTruck dark={dark} ready={game.minute >= game.nextInboundAt} arrivalTicks={game.inboundArrivalTicks??0} paused={game.paused} speed={game.speed} selected={selected} onSelect={onSelect} />
    {Array.from({length:dockCount(game)},(_,i)=>{const dockId=i+1;return <OutboundTruck key={dockId} dockId={dockId} job={allJobs(game).find(j=>j.dockId===dockId)} shipment={game.shipments.filter(s=>s.dockId===dockId).at(-1)} paused={game.paused} speed={game.speed} selected={selected} onSelect={onSelect}/>})}
    <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={.085} zoomSpeed={1.05} minDistance={12} maxDistance={150} maxPolarAngle={Math.PI*.48} minPolarAngle={.22} target={[0,1.4,2.2]} enablePan={true} />
  </>;
}

// Explicit 30/50 FPS cap: keeps GPU usage down while preserving fluid motion.
// OrbitControls will still invalidate frames as the user moves the camera.
function FramePacer({eco,paused}){
  const invalidate=useThree(s=>s.invalidate);
  useEffect(()=>{
    let visible=!document.hidden;
    const onVisibility=()=>{visible=!document.hidden; if(visible)invalidate();};
    document.addEventListener('visibilitychange',onVisibility);
    const id=window.setInterval(()=>{if(visible)invalidate();},1000/(paused?8:eco?30:50));
    return ()=>{window.clearInterval(id);document.removeEventListener('visibilitychange',onVisibility);};
  },[eco,paused,invalidate]);
  return null;
}
function CameraCommander({command,controlsRef}){
  const camera=useThree(s=>s.camera);
  useEffect(()=>{
    if(!command?.seq||!controlsRef.current)return;
    const controls=controlsRef.current;
    if(command.type==='reset'){
      controls.target.set(0,1.4,2.2);
      camera.position.set(31,35,47);
    }else{
      const delta=camera.position.clone().sub(controls.target);
      const factor=command.type==='out'?1.45:1/1.45;
      const next=Math.max(12,Math.min(150,delta.length()*factor));
      delta.setLength(next);
      camera.position.copy(controls.target).add(delta);
    }
    controls.update();
  },[command?.seq,command?.type,camera,controlsRef]);
  return null;
}

export default function WarehouseScene({ game, dark, selected, onSelect, eco=true, cameraCommand=null }) {
  const controlsRef=useRef();
  const [error, setError] = useState(false);
  const [supported] = useState(() => { try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch { return false; } });
  if (error || !supported) return <div className="scene-fallback">
    <div className="scene-fallback-icon">◈</div>
    <b>3D tidak dapat dimuat</b>
    <p>Browser tidak menyediakan WebGL yang diperlukan. Perbarui driver GPU atau aktifkan hardware acceleration, lalu muat ulang halaman.</p>
    <button onClick={() => setError(false)}>Coba muat kembali</button>
  </div>;
  return <Canvas
    key={eco?'low-gpu':'normal-gpu'}
    shadows={!eco}
    frameloop="demand"
    dpr={eco?[0.75,1.0]:[1,1.4]}
    camera={{ position:[31,35,47], fov:34, near:.1, far:350 }}
    gl={{ antialias:!eco, alpha:false, powerPreference:'high-performance' }}
    onPointerMissed={() => onSelect(null)}
    onCreated={({ gl }) => {
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = dark ? 1.25 : 1.48;
    }}
    onError={() => setError(true)}
  >
    <FramePacer eco={eco} paused={game.paused}/>
    <CameraCommander command={cameraCommand} controlsRef={controlsRef}/>
    <Warehouse game={game} dark={dark} selected={selected || {}} onSelect={onSelect} eco={eco} controlsRef={controlsRef} />
  </Canvas>;
}
