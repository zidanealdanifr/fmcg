import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine, ArrowRight, BatteryCharging, Boxes, Check, CheckCircle2,
  ChevronRight, CircleAlert, ClipboardList, Clock3, Factory, Truck as Forklift,
  Gauge, Info, Layers3, LayoutDashboard, Maximize2, Moon, Package,
  PackageCheck, Pause, Play, Plus, RotateCcw, Route, Settings2, ShieldCheck,
  ShoppingCart, Sun, Timer, TrendingUp, TriangleAlert, Truck, X,
  Zap, Sparkles, MapPin, History, HardHat, Award, Volume2, VolumeX, ZoomIn, ZoomOut
} from 'lucide-react';
import WarehouseScene from './WarehouseScene.jsx';
import {nextOperation,operationSnapshot} from './operationsView.js';
import {
  RACKS, UPGRADES, advanceGame, acceptContract, activeRackCount, buyUpgrade,
  cancelJob, capacityOf, currency, dateAt, dispatchTruck, dockCount, expiryQty,
  getSku, initialGame, liveStock, loadSavedGame, minuteLabel, otdRate,
  pendingStock, rackStock, rankName, shiftClock, startPicking, unloadCargo, STAGING_CAPACITY,
  SAVE_KEY, expeditePicking, operationalAlerts, opsScore, allJobs, openDocks, availableInventory, chooseJob
} from './engine';

const statusColor = { available: 'green', active: 'blue', transit: 'amber' };

function StatusPill({ children, tone='blue', dot=true }) {
  return <span className={`status-pill pill-${tone}`}>{dot && <span className="pill-dot" />}{children}</span>;
}
function InfoMetric({ icon: Icon, label, value, secondary, tone='blue', progress=null }) {
  return <div className={`metric metric-${tone}`}>
    <div className="metric-icon"><Icon size={19} strokeWidth={2.2}/></div>
    <div className="metric-info"><div className="metric-label">{label}</div><div className="metric-value">{value}</div>
      <div className="metric-secondary">{secondary}</div>
      {progress != null && <div className="metric-progress"><i style={{ width: `${Math.min(100,Math.max(0,progress))}%` }} /></div>}
    </div>
  </div>;
}
function SectionCaption({ children, aside }) {
  return <div className="section-caption"><span>{children}</span>{aside && <span className="section-caption-aside">{aside}</span>}</div>;
}
function PrimaryButton({ onClick, disabled, children, icon:Icon=ArrowRight, busy=false, className='' }) {
  return <button className={`primary-btn ${className}`} onClick={onClick} disabled={disabled}>{busy ? <span className="busy-spinner"/> : <Icon size={16} />}<span>{children}</span><ChevronRight size={15} className="primary-arrow"/></button>;
}

function Header({ game, dark, setDark, setGame, onReset, sound, setSound }) {
  return <header className="topbar">
    <div className="branding">
      <div className="brand-mark"><img src="/favicon.svg" alt="Zidane FMCG Operations" className="brand-mark-img"/></div>
      <div className="brand-copy"><div className="brand-title">ZIDANE <span className="brand-slash">/</span> <span>FMCG OPERATIONS</span></div><div className="brand-sub">PORTAL OPERASIONAL 3D · fmcg.zidane.id</div></div>
    </div>
    <div className="header-center"><span className="live-dot"/><span>SIMULATION LIVE</span><span className="divider-dot">·</span><Clock3 size={15}/><strong>{shiftClock(game.minute)}</strong></div>
    <div className="header-actions">
      <button className="icon-btn" title={sound ? 'Nonaktifkan suara' : 'Aktifkan suara'} onClick={()=>setSound(s=>!s)}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>
      <button className="icon-btn" title={dark?'Aktifkan light mode':'Aktifkan dark mode'} onClick={()=>setDark(d=>!d)}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
      <div className="header-separator"/>
      <div className="speed-control" title="Kecepatan simulasi">{[1,2,4].map(n=><button key={n} className={game.speed===n?'active':''} onClick={()=>setGame(g=>({...g,speed:n}))}>{n}×</button>)}</div>
      <button className={`action-outline ${game.paused ? 'paused' : ''}`} onClick={()=>setGame(g=>({...g,paused:!g.paused}))}>{game.paused?<Play size={16}/>:<Pause size={16}/>}<span>{game.paused?'Lanjut':'Jeda'}</span></button>
      <button className="icon-btn reset-btn" title="Reset permainan" onClick={onReset}><RotateCcw size={17}/></button>
    </div>
  </header>;
}

function OperationsSidebar({game,onPrimary,onInspectRacks}) {
  const task=nextOperation(game);
  const data=operationSnapshot(game);
  const Icon=({resume:Play,dispatch:Truck,pick:PackageCheck,unload:ArrowDownToLine,expedite:Zap,contracts:ClipboardList,fleet:Timer,wait:Clock3})[task.id]||Gauge;
  return <aside className="sidebar-left operations-sidebar" aria-label="Ringkasan operasional">
    <section className="white-card next-action-card">
      <div className="ops-eyebrow"><span><Gauge size={15}/> PUSAT KENDALI SHIFT</span><StatusPill tone={game.paused?'amber':'green'}>{game.paused?'DIJEDA':'AKTIF'}</StatusPill></div>
      <div className="ops-guide-head"><span className={`ops-guide-icon ${task.tone}`}><Icon size={23}/></span><div><small>PRIORITAS SEKARANG</small><h2>{task.title}</h2></div></div>
      <p>{task.detail}</p>
      <button className="primary-btn ops-main-cta" onClick={()=>onPrimary(task.id)}><Icon size={16}/><span>{task.label}</span><ArrowRight size={15}/></button>
    </section>
    <section className="white-card quick-snapshot-card">
      <div className="ops-section-heading"><b><Layers3 size={16}/> Kondisi fasilitas</b><span>LIVE</span></div>
      <div className="ops-health-row"><div><strong>Kapasitas rak</strong><small>{data.stock} dari {data.capacity} pallet</small></div><b>{data.storagePct}%</b></div>
      <div className="bar-track small"><div className="bar-fill" style={{width:`${data.storagePct}%`}}/></div>
      <div className="ops-health-row"><div><strong>Cross-dock</strong><small>{data.staging} dari {data.stagingCapacity} pallet</small></div><b>{data.stagingPct}%</b></div>
      <div className="bar-track small"><div className="bar-fill amber" style={{width:`${data.stagingPct}%`}}/></div>
      <div className="ops-resource-grid">
        <div><Forklift size={17}/><b>{data.amrs}</b><small>Forklift AMR</small></div>
        <div><WarehouseIcon/><b>{data.racks}</b><small>Rak aktif</small></div>
        <div><Truck size={17}/><b>{data.docks}</b><small>Dock</small></div>
      </div>
    </section>
    <section className="white-card risks-card">
      <div className="ops-section-heading"><b><ShieldCheck size={16}/> Risiko & keputusan</b></div>
      <div className={`risk-mini ${data.urgent?'urgent':''}`}><TriangleAlert size={17}/><div><b>{data.urgent?`${data.urgent} pallet mendekati expired`:'Tidak ada batch kritis'}</b><small>{data.urgent?'Prioritaskan batch tersebut saat picking.':'Pemantauan umur simpan aktif.'}</small></div></div>
      <div className="ops-substats"><span>On-time delivery <strong>{data.onTime===null?'Belum dinilai':data.onTime+'%'}</strong></span><span>Armada di jalan <strong>{data.activeShipments}</strong></span></div>
      <button className="ops-outline" type="button" onClick={onInspectRacks}>Periksa kondisi stok <ArrowRight size={15}/></button>
    </section>
    <section className="white-card side-activity-card">
      <div className="ops-section-heading"><b><History size={16}/> Aktivitas terbaru</b></div>
      {game.logs.slice(0,3).map(log=><div className="ops-activity" key={log.id}><span className={`ops-event-dot ${log.type}`}/><span>{log.text}</span></div>)}
    </section>
  </aside>;
}
function WarehouseIcon(){return <Layers3 size={17}/>;}

function Inspector({ selected, game, onClose, onOpenContracts }) {
  if (!selected) return null;
  let content = null, heading = '', subtitle = '', Icon = Package;
  if (selected.type === 'rack') {
    const rack = RACKS.find(r=>r.id===selected.id);
    if (!rack || RACKS.indexOf(rack)>=activeRackCount(game)) return null;
    const lots = rackStock(game,rack.id);
    const qty = lots.reduce((s,p)=>s+p.qty,0);
    const urgent = lots.some(p=>p.expiryAt-game.minute<=720);
    heading = `Rak ${rack.zone}-${rack.bay}`; subtitle=`High-bay storage · ${qty}/12 pallet`; Icon=Layers3;
    content = <>
      <div className="inspector-meta"><StatusPill tone={urgent?'red':'green'}>{urgent?'Expiry Warning':'Kondisi Normal'}</StatusPill><span>{Math.round(qty/12*100)}% terisi</span></div>
      {lots.length ? <div className="inspector-skus">{lots.map(p=><div key={p.id} className="inspector-sku"><div className="sku-color" style={{background:getSku(p.sku).color}}/><div><b>{getSku(p.sku).name}</b><small>{getSku(p.sku).code} · {p.qty} pallet</small></div><div className={p.expiryAt-game.minute<=720?'sku-exp urgent':'sku-exp'}>EXP<br/><b>{dateAt(p.expiryAt)}</b></div></div>)}</div> : <div className="inspector-empty">Rak kosong. Pallet inbound akan disimpan otomatis.</div>}
      <div className="inspector-foot">Strategi picking: kedaluwarsa terdekat lebih dahulu.</div>
    </>;
  } else if(selected.type==='dock'){
    const dockId=selected.id;
    const assigned=allJobs(game).find(j=>j.dockId===dockId);
    heading=`Outbound Bay ${dockId}`;subtitle=assigned?'Truk sedang ditangani':'Bay siap digunakan';Icon=Truck;
    content=<><div className="inspector-meta"><StatusPill tone={assigned?'blue':'green'}>{assigned?assigned.status.toUpperCase():'TERSEDIA'}</StatusPill><span>{assigned?`DC ${assigned.city}`:'Tidak ada kendaraan'}</span></div>
    <div className="inspect-grid"><div><span>MUATAN</span><strong>{assigned?`${assigned.loaded}/${assigned.required} pallet`:'0 pallet'}</strong></div><div><span>STATUS DOCK</span><strong>{assigned?'TERPAKAI':'TERSEDIA'}</strong></div></div>
    <button className="inspect-link" onClick={onOpenContracts}>{assigned?'Pilih bay di Operations Console':'Isi bay dengan kontrak'} <ArrowRight size={13}/></button></>;
  } else if (selected.type==='forklift') {
    heading=`Robot Forklift AMR-${String(selected.id+1).padStart(2,'0')}`;
    subtitle='Autonomous material handling'; Icon=Forklift;
    const batt= Math.max(28, 96-((game.tick*2+selected.id*17)%65));
    const working=allJobs(game).some(j=>j.status==='loading')?'Outbound picking':pendingStock(game)?'Put-away inbound':'Standby / Charging';
    content=<><div className="inspect-grid"><div><span>BATTERY</span><strong><BatteryCharging size={16}/>{batt}%</strong></div><div><span>STATUS</span><strong>{working}</strong></div><div><span>LOAD</span><strong>{working==='Standby / Charging'?'0 kg':'850 kg'}</strong></div><div><span>AUTONOMY</span><strong>Enabled</strong></div></div><div className="inspector-foot">AMR bergerak secara otomatis setiap siklus kerja.</div></>;
  } else if (selected.type==='truck') {
    const inbound= selected.id==='inbound';
    heading=inbound?'Truk Manufaktur IN-01':`Wingbox Bay ${selected.id?.startsWith('dock-')?selected.id.slice(5):(game.job?.dockId??1)}`;
    subtitle=inbound?'Inbound Dock A · Supplier regional':'Outbound Dock B · Distribusi nasional'; Icon=Truck;
    const shipment=game.shipments[0];
    const selectedDock=Number(selected.id?.slice(5))||game.job?.dockId||1;
    const activeDockJob=allJobs(game).find(j=>j.dockId===selectedDock);
    const destination=inbound?'Gudang Pusat Zidane':activeDockJob?.city || shipment?.city || 'Menunggu kontrak';
    const eta=inbound?game.minute>=game.nextInboundAt?'Tiba di dermaga':minuteLabel(game.nextInboundAt-game.minute):shipment?minuteLabel(shipment.arriveAt-game.minute):activeDockJob?'Menunggu dispatch':'Belum dijadwalkan';
    content=<><div className="inspect-grid"><div><span>DRIVER</span><strong>{inbound?'Pak Andi':'Pak Budi'}</strong></div><div><span>STATUS</span><strong>{inbound?'Di dermaga':activeDockJob?'Sedang dimuat':shipment?'Dalam perjalanan':'Standby'}</strong></div><div><span>DESTINATION</span><strong>{destination}</strong></div><div><span>ETA</span><strong>{eta}</strong></div></div>{!inbound&&<button className="inspect-link" onClick={onOpenContracts}>Lihat kontrak <ArrowRight size={13}/></button>}</>;
  }
  return <div className="inspector white-card">
    <div className="inspector-heading"><div className="inspector-heading-icon"><Icon size={20}/></div><div><b>{heading}</b><span>{subtitle}</span></div><button className="inspector-close" onClick={onClose} aria-label="Tutup informasi objek"><X size={17}/></button></div>
    {content}
  </div>;
}

function WarehouseViewport({ game, dark, selected, setSelected, setTab, focusMode, setFocusMode, onResume }) {
  const urgent = expiryQty(game);
  const sceneEl = useRef(null);
  const [eco,setEco] = useState(()=>{try{return localStorage.getItem('zidane.fmcg.graphics')!=='normal';}catch{return true;}});
  const [cameraCommand,setCameraCommand]=useState({seq:0,type:'reset'});
  const sendCamera=type=>setCameraCommand(prev=>({seq:prev.seq+1,type}));
  const toggleGraphics=()=>setEco(prev=>{const next=!prev;try{localStorage.setItem('zidane.fmcg.graphics',next?'hemat':'normal');}catch{}return next;});
  const fullscreen = () => {
    if (!sceneEl.current) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else sceneEl.current.requestFullscreen?.();
  };
  return <section className="scene-column">
    <div className="scene-head"><div><h2>Warehouse Digital Twin</h2><p>Live operations · Jakarta Central Distribution Hub</p></div><div className="scene-head-actions"><button type="button" className="focus-toggle" onClick={()=>setFocusMode(v=>!v)}><Maximize2 size={14}/>{focusMode?'Kembali ke dashboard':'Mode fokus 3D'}</button><StatusPill tone="green">OPERATIONAL</StatusPill><span className="scene-id">DC JKT-01</span></div></div>
    <div className="scene-shell" ref={sceneEl}>
      <WarehouseScene game={game} dark={dark} selected={selected} onSelect={setSelected} eco={eco} cameraCommand={cameraCommand} />
      <div className="scene-overlay-top"><div className="overlay-live"><span className="live-dot"/> LIVE 3D VIEW <span className="overlay-divider"/> {activeRackCount(game)} RACKS · {1+game.upgrades.forklifts} AMR</div><div className="scene-camera-tools"><button type="button" title="Zoom out kamera" aria-label="Zoom out kamera" onClick={()=>sendCamera('out')}><ZoomOut size={17}/></button><button type="button" title="Zoom in kamera" aria-label="Zoom in kamera" onClick={()=>sendCamera('in')}><ZoomIn size={17}/></button><button type="button" title="Reset kamera" aria-label="Reset kamera" onClick={()=>sendCamera('reset')}><RotateCcw size={16}/></button><button type="button" className="graphics-toggle" title="Ubah kualitas rendering" onClick={toggleGraphics}>{eco?'Mode hemat':'Mode normal'}</button><button className="scene-icon-btn" title="Fullscreen 3D" onClick={fullscreen}><Maximize2 size={17}/></button></div></div>
      {game.paused && <div className="pause-compact" role="status" aria-live="polite"><Pause size={16}/><span><b>Simulasi dijeda</b><small>Waktu dan aktivitas operasional berhenti. Kamera tetap bisa digerakkan.</small></span><button type="button" onClick={onResume}><Play size={14}/> Lanjutkan</button></div>}
      <div className="scene-overlay-bottom"><div className="camera-hint"><span className="hint-orbit">↻</span> Drag: orbit <i/> Scroll: zoom <i/> Klik objek: detail</div><div className="scene-legend"><span><i className="legend-dot teal"/> Operasional</span><span><i className="legend-dot red"/> Expiry alert</span></div></div>
      {!!urgent && <div className="expiry-floating"><TriangleAlert size={15}/> {urgent} pallet mendekati expired</div>}
      <Inspector selected={selected} game={game} onClose={()=>setSelected(null)} onOpenContracts={()=>setTab('contracts')} />
    </div>
    <div className="bottom-scene-stats"><div><span className="dot-key blue"/><b>{liveStock(game)}</b> Stored pallets</div><div><span className="dot-key amber"/><b>{pendingStock(game)}</b> Cross-dock</div><div><span className="dot-key green"/><b>{game.shipments.length}</b> On-road fleet</div><div><span className="dot-key purple"/><b>{allJobs(game).length}/{dockCount(game)}</b> Loading docks</div></div>
  </section>;
}

function InboundCard({ game, doAction, highlight }) {
  const isReady=game.minute>=game.nextInboundAt && (game.inboundArrivalTicks??0)<=0;
  const inboundParking=game.minute>=game.nextInboundAt && (game.inboundArrivalTicks??0)>0;
  const staging=pendingStock(game);
  return <div className={`operation-box ${highlight?'step-highlight':''}`}>
    <div className="operation-head"><div className="op-number">01</div><div><h3>Inbound & Sorting</h3><p>Dock A · Supplier Manufaktur</p></div><StatusPill tone={isReady?'green':'amber'}>{isReady?'TRUK TIBA':inboundParking?'PARKIR':'EN ROUTE'}</StatusPill></div>
    <div className="operation-visual"><div className="op-visual-icon amber"><Factory size={24}/></div><div><b>{isReady?'Supplier siap bongkar':inboundParking?'Truk sedang parkir':'Menunggu pemasok'}</b><span>{isReady?'Kargo FMCG telah tiba di dermaga':inboundParking?`Menunggu ${game.inboundArrivalTicks} langkah simulasi`:'ETA '+minuteLabel(game.nextInboundAt-game.minute)}</span></div></div>
    <div className="tiny-data"><span>Cross-dock staging</span><b>{staging} / {STAGING_CAPACITY} pallet</b></div>
    <div className="bar-track small"><div className="bar-fill amber" style={{width:`${Math.min(100,staging/STAGING_CAPACITY*100)}%`}}/></div>
    <PrimaryButton disabled={game.paused || !isReady || staging+23>STAGING_CAPACITY} icon={ArrowDownToLine} onClick={doAction}>{game.paused?'Lanjutkan simulasi terlebih dahulu':'Unload Cargo'}</PrimaryButton>
    <p className="btn-assist">Conveyor: Level {game.upgrades.conveyor} · AMR otomatis mengisi rak</p>
  </div>;
}
function OutboundCard({ game, doPick, doDispatch, cancel, onExpedite, setTab, highlight }) {
  const job=game.job;
  const full=false;
  return <div className={`operation-box ${highlight?'step-highlight':''}`}>
    <div className="operation-head"><div className="op-number blue">02</div><div><h3>Picking & Outbound</h3><p>{job ? `Bay ${job.dockId} · Armada Wingbox` : 'Pilih kontrak untuk mengisi bay'}</p></div><StatusPill tone={job?'blue':'muted'}>{job?'ORDER AKTIF':'STANDBY'}</StatusPill></div>
    {job ? <>
      <div className="active-order"><div><MapPin size={15}/> <strong>DC {job.city} · Bay {job.dockId}</strong></div><span>{job.loaded} / {job.required} pallet</span></div>
      <div className="bar-track"><div className="bar-fill" style={{width:`${Math.min(100, job.loaded / job.required * 100)}%`}}/></div>
      <div className="order-deadline"><Clock3 size={14}/> SLA tersisa <b className={job.deadlineAt-game.minute<110?'urgent-text':''}>{minuteLabel(job.deadlineAt-game.minute)}</b></div>
      {job.status==='accepted' && <PrimaryButton disabled={game.paused} icon={PackageCheck} onClick={doPick}>Mulai Picking FIFO</PrimaryButton>}
      {job.status==='loading' && <><div className="picking-status">{!game.paused&&liveStock(game)>0&&<span className="status-spinner"/>}{game.paused?'Simulasi dijeda — lanjutkan untuk memproses':(job.arrivalTicks??0)>0?`Truk menuju Bay ${job.dockId}, forklift menunggu parkir (${job.arrivalTicks} langkah)`:liveStock(game)===0?'Menunggu pasokan stok baru':'Picking otomatis sedang berjalan'}</div><button className="expedite-btn" onClick={onExpedite} disabled={game.paused || (job.arrivalTicks??0)>0 || liveStock(game)===0 || game.cash<480 || game.minute-game.lastExpediteAt<12}> <Zap size={15}/> Tambah kru picking · +3 pallet <b>{currency(480)}</b></button><small className="btn-assist">{game.minute-game.lastExpediteAt<12?`Cooldown ${minuteLabel(12-(game.minute-game.lastExpediteAt))}`:'Mengambil stok nyata dari rak · sesuai FEFO/FIFO'}</small></>}
      {job.status==='ready' && <PrimaryButton disabled={game.paused} icon={Truck} onClick={doDispatch}>Dispatch dari Bay {job.dockId}</PrimaryButton>}
      <button className="text-danger" disabled={game.paused} onClick={cancel}>Batalkan order</button>
    </> : <>
      <div className="empty-order"><div className="empty-order-icon"><Truck size={25}/></div><b>Belum ada order outbound</b><span>Pilih kontrak untuk menugaskan forklift memuat truk ke kota tujuan.</span></div>
      <PrimaryButton icon={ClipboardList} onClick={()=>setTab('contracts')}>Pilih Kontrak Distribusi</PrimaryButton>
    </>}
  </div>;
}
function LiveDeliveries({ game }) {
  return <div className="onroad-section"><SectionCaption aside={`${game.shipments.length} AKTIF`}>ARMADA DALAM PERJALANAN</SectionCaption>
    {game.shipments.length ? game.shipments.map(s=><div key={s.id} className="onroad-row"><div className="onroad-truck"><Truck size={18}/></div><div><b>{s.city}</b><span>{s.qty} pallet · {s.id.toUpperCase()}</span></div><div className="onroad-eta"><b>{minuteLabel(s.arriveAt-game.minute)}</b><span>ETA</span></div></div>) : <div className="no-onroad"><Route size={17}/> Belum ada armada dalam perjalanan</div>}
  </div>;
}
function ContractsPanel({ game, onAccept, setTab }) {
  const stock=availableInventory(game);
  return <div className="panel-content">
    <div className="panel-info-banner"><Info size={17}/><span>Pilih kontrak, lakukan picking, lalu dispatch. Pembayaran diterima saat truk tiba di DC tujuan.</span></div>
    <SectionCaption aside={`${game.board.filter(x=>x.status==='available').length} TERSEDIA`}>DISTRIBUTION CONTRACT BOARD</SectionCaption>
    <div className="contract-stack">{game.board.map((c,i)=><div key={c.key} className={`contract-card ${c.status!=='available'?'disabled':''}`}>
      <div className="contract-top"><div className="contract-city"><div className="route-icon"><MapPin size={17}/></div><div><b>DC {c.city}</b><small>{c.client}</small></div></div><StatusPill tone={statusColor[c.status] || 'muted'}>{c.status==='available'?c.difficulty:c.status==='active'?'LOADING':'ON ROAD'}</StatusPill></div>
      <div className="contract-metrics"><div><span>PALLET</span><strong>{c.qty}</strong></div><div><span>DEADLINE</span><strong>{minuteLabel(c.deadline)}</strong></div><div><span>REWARD</span><strong className="reward">{currency(c.reward)}</strong></div></div>
      <button className="contract-btn" disabled={game.paused || c.status !== 'available'|| !openDocks(game).length || stock < c.qty} onClick={()=>{onAccept(c.key);setTab('operations')}}>
        {c.status==='active'?'Sedang diproses':c.status==='transit'?'Dalam perjalanan':!openDocks(game).length?'Semua bay terisi':stock<c.qty?'Stok bebas belum cukup':`Terima ke Bay ${openDocks(game)[0]}`} <ArrowRight size={15}/>
      </button>
    </div>)}</div>
    <div className="small-help"><TriangleAlert size={15}/> Kontrak yang terlambat hanya dibayar 58% dan mengurangi reputasi.</div>
  </div>;
}
function UpgradesPanel({ game, onUpgrade }) {
  const icons={conveyor:Settings2,forklifts:Forklift,racks:Layers3,docks:Truck};
  return <div className="panel-content"><div className="panel-info-banner purple"><Zap size={17}/><span>Investasi mempercepat throughput gudang. Maksimal level 2 per fasilitas.</span></div><SectionCaption>WAREHOUSE IMPROVEMENT LAB</SectionCaption>
    <div className="upgrade-list">{UPGRADES.map((u)=>{
      const level=game.upgrades[u.id];
      const price=u.prices[level];
      const Icon=icons[u.id];
      return <div className="upgrade-card" key={u.id}>
        <div className="upgrade-head"><div className="upgrade-icon"><Icon size={21}/></div><div><b>{u.name}</b><span>{u.description}</span></div></div>
        <div className="upgrade-bottom"><div className="upgrade-level"><span>LEVEL {level}/2</span><div className="upgrade-pips">{[1,2].map(i=><span key={i} className={i<=level?'filled':''}/>)}</div></div>
        <button disabled={game.paused || level>=u.max || game.cash<price} onClick={()=>onUpgrade(u.id)}>{level===u.max?<><Check size={14}/> MAX</>:<><Plus size={14}/> {currency(price)}</>}</button></div>
      </div>;
    })}</div><div className="upgrade-tips"><Award size={16}/> Upgrade memberikan +35 XP dan membantu ekspansi operasional.</div>
  </div>;
}
function RightPanel({ game, tab, setTab, unload, pick, dispatch, accept, upgrade, cancel, expedite, selectJob }) {
  return <aside className="sidebar-right white-card">
    <div className="right-panel-heading"><div><div className="panel-kicker">CONTROL CENTER</div><h2>Operations Console</h2></div><div className="right-heading-icon"><LayoutDashboard size={21}/></div></div>
    <div className="tabs"><button className={tab==='operations'?'tab-active':''} onClick={()=>setTab('operations')}><Gauge size={16}/> Operasional</button><button className={tab==='contracts'?'tab-active':''} onClick={()=>setTab('contracts')}><ClipboardList size={16}/> Kontrak</button><button className={tab==='upgrades'?'tab-active':''} onClick={()=>setTab('upgrades')}><TrendingUp size={16}/> Upgrade</button></div>
    {tab === 'operations' ? <div className="panel-content"><SectionCaption>WORKFLOW PER SHIFT</SectionCaption><div className="dock-overview"><div className="dock-overview-title"><strong>OUTBOUND BAY MANAGEMENT</strong><span>{allJobs(game).length}/{dockCount(game)} digunakan</span></div><div className="dock-slots">{Array.from({length:dockCount(game)},(_,i)=>{const job=allJobs(game).find(j=>j.dockId===i+1);return <button key={i} type="button" className={`dock-slot ${job?'occupied':''} ${job?.id===game.activeJobId?'selected':''}`} onClick={()=>job?selectJob(job.id):setTab('contracts')}><Truck size={16}/><b>Bay {i+1}</b><small>{job?`${job.city} ${job.loaded}/${job.required}`:'Tersedia'}</small></button>})}</div></div><InboundCard game={game} doAction={unload} highlight={game.tutorial===0}/><OutboundCard game={game} doPick={pick} doDispatch={dispatch} cancel={cancel} onExpedite={expedite} setTab={setTab} highlight={[3,5].includes(game.tutorial)}/><LiveDeliveries game={game}/></div> : tab==='contracts' ? <ContractsPanel game={game} onAccept={accept} setTab={setTab}/> : <UpgradesPanel game={game} onUpgrade={upgrade}/>}
  </aside>;
}

function Events({ game }) {
  const [expanded,setExpanded] = useState(false);
  return <section className="events-section white-card"><div className="events-heading"><div><History size={18}/><b>Warehouse Activity Log</b><span>Event simulasi real-time</span></div><button onClick={()=>setExpanded(s=>!s)}>{expanded?'Tutup detail':'Lihat semua'} <ChevronRight size={15} className={expanded?'rotate-down':''}/></button></div>
    <div className={`events-list ${expanded?'expanded':''}`}>{game.logs.slice(0,expanded?12:4).map(ev=><div key={ev.id} className="event-row"><span className={`event-type event-${ev.type}`}>{ev.type==='success'?<CheckCircle2 size={14}/>:ev.type==='danger'?<CircleAlert size={14}/>:ev.type==='warning'?<TriangleAlert size={14}/>:<Info size={14}/>}</span><span className="event-message">{ev.text}</span><time>{dateAt(ev.minute,true)}</time></div>)}</div>
  </section>;
}
function ResetDialog({ onCancel, onConfirm }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Reset permainan"><div className="modal-card"><div className="modal-icon"><RotateCcw size={25}/></div><h2>Mulai shift dari awal?</h2><p>Semua kontrak, upgrade, uang, pengalaman, dan stok gudang tersimpan saat ini akan diganti dengan data permainan baru.</p><div className="modal-actions"><button onClick={onCancel}>Batal</button><button onClick={onConfirm}>Ya, reset permainan</button></div></div></div>;
}

function softSound(positive=true) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type='sine'; oscillator.frequency.setValueAtTime(positive?680:290,ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(positive?940:230,ctx.currentTime+.14);
    gain.gain.setValueAtTime(.09,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.18);
    oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+.19);
    oscillator.onended=()=>ctx.close();
  } catch { /* browsers may block audio until interaction */ }
}

export default function App() {
  const [game, setGame] = useState(loadSavedGame);
  const [dark, setDark] = useState(()=> { try { return localStorage.getItem('zidane_fmcg_3d_theme')==='dark'; } catch { return false; } });
  const [sound, setSound] = useState(false);
  const [tab, setTab] = useState('operations');
  const [selected, setSelected] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [focusMode,setFocusMode]=useState(false);
  const [toast, setToast] = useState(null);
  const previousEvent = useRef(game.eventSeq);
  const timerRef = useRef(null);

  useEffect(()=>{
    const interval=window.setInterval(()=>{ if (!document.hidden) setGame(g=>advanceGame(g)); }, 1000);
    return ()=>window.clearInterval(interval);
  },[]);
  useEffect(()=>{
    try { localStorage.setItem(SAVE_KEY,JSON.stringify(game)); } catch { /* private browsing */ }
  },[game]);
  useEffect(()=>{ try { localStorage.setItem('zidane_fmcg_3d_theme',dark?'dark':'light'); } catch {} },[dark]);
  useEffect(()=>{
    if (game.eventSeq <= previousEvent.current) { previousEvent.current = game.eventSeq; return; }
    previousEvent.current=game.eventSeq;
    const last=game.logs[0];
    if (last && last.type !== 'info') setToast(last);
  },[game.eventSeq,game.logs]);
  useEffect(()=>{
    if (!toast) return;
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(()=>setToast(null),4100);
    return ()=>clearTimeout(timerRef.current);
  },[toast]);
  const act=(fn, ...args)=>{
    if(game.paused){setToast({type:'warning',text:'Simulasi masih dijeda. Klik Lanjutkan sebelum menjalankan tindakan operasional.'});return;}
    if(sound) softSound();
    setGame(g=>fn(g,...args));
  };
  const stock=liveStock(game), capacity=capacityOf(game), urgent=expiryQty(game), otd=otdRate(game);
  const selectObject=(value)=>{setSelected(value);if(value?.type==='truck'&&value?.id?.startsWith('dock-')){const dockNumber=Number(value.id.slice(5));const job=allJobs(game).find(j=>j.dockId===dockNumber);if(job)setGame(g=>chooseJob(g,job.id));}};
  const handlePriority=(id)=>{
    switch(id){
      case 'resume': setGame(g=>({...g,paused:false})); break;
      case 'dispatch': act(dispatchTruck); break;
      case 'pick': act(startPicking); break;
      case 'unload': act(unloadCargo); break;
      case 'expedite': act(expeditePicking); break;
      case 'contracts': setTab('contracts'); break;
      case 'fleet': setTab('operations'); setSelected({type:'truck',id:'outbound'}); break;
      case 'wait': setGame(g=>({...g,speed:4,paused:false})); break;
      default: setTab('operations');
    }
  };
  const reset=()=>{setGame(initialGame());setSelected(null);setTab('operations');setToast(null);setResetOpen(false);previousEvent.current=2;};
  return <div className={`app-shell ${focusMode?'is-focused':''}`} data-theme={dark?'dark':'light'}>
    <div className="app-container">
      <Header game={game} dark={dark} setDark={setDark} setGame={setGame} onReset={()=>setResetOpen(true)} sound={sound} setSound={setSound}/>
      <div className="page-intro compact"><div><div className="page-kicker"><span className="kicker-line"/> ZIDANE FMCG OPERATIONS</div><h1>Kelola <span>Central Warehouse</span> lebih rapi dan tepat waktu.</h1><p>Kontrol inbound, put-away, picking, dan pengiriman dari satu portal operasional.</p></div><div className="profile-chip"><img className="profile-avatar" src="/manager-avatar.svg" alt="Avatar Manajer Operasi"/><div><b>{rankName(game)}</b><small>Level {Math.floor(game.stats.xp/160)+1} · {game.stats.xp} XP</small></div><ChevronRight size={15}/></div></div>
      <div className="metrics-grid">
        <InfoMetric icon={ShoppingCart} label="CASH BALANCE" value={currency(game.cash)} secondary="Available operating budget" tone="blue"/>
        <InfoMetric icon={Boxes} label="WAREHOUSE CAPACITY" value={`${Math.round(stock/capacity*100)}%`} secondary={`${stock} / ${capacity} pallet tersimpan`} tone="purple" progress={stock/capacity*100}/>
        <InfoMetric icon={TriangleAlert} label="EXPIRY WARNING" value={urgent} secondary={urgent?'Pallet perlu diprioritaskan':'Seluruh batch aman'} tone={urgent?'red':'green'}/>
        <InfoMetric icon={Truck} label="ON-TIME DELIVERY" value={otd == null ? '—' : `${otd}%`} secondary={game.stats.delivered ? `${game.stats.ontime} / ${game.stats.delivered} pengiriman tepat waktu` : 'Belum ada pengiriman'} tone="green" progress={otd ?? 0}/>
        <InfoMetric icon={Award} label="REPUTATION SCORE" value={`${game.reputation}/100`} secondary={`${game.stats.xp} XP · ${game.stats.expired} pallet waste`} tone="amber" progress={game.reputation}/>
      </div>
      <div className="shift-alert-strip">
        <div className="shift-alert-title"><ShieldCheck size={16}/><strong>STATUS OPERASI</strong><span>SKOR SHIFT {opsScore(game)}/100</span></div>
        <div className={`shift-alert-message ${operationalAlerts(game)[0].kind}`}><CircleAlert size={15}/><b>{operationalAlerts(game)[0].title}</b><span>{operationalAlerts(game)[0].detail}</span></div>
        <div className="shift-alert-note">Autosave lokal aktif</div>
      </div>
      <div className="workspace-grid">
<OperationsSidebar game={game} onPrimary={handlePriority} onInspectRacks={()=>{const urgentLot=game.lots.filter(l=>l.expiryAt>game.minute).sort((a,b)=>a.expiryAt-b.expiryAt)[0]; setSelected({type:'rack',id:urgentLot?.rackId||RACKS[0].id});}}/>
        <WarehouseViewport game={game} dark={dark} selected={selected} setSelected={selectObject} setTab={setTab} focusMode={focusMode} setFocusMode={setFocusMode} onResume={()=>setGame(g=>({...g,paused:false}))}/>
        <RightPanel game={game} tab={tab} setTab={setTab} selectJob={id=>setGame(g=>chooseJob(g,id))} unload={()=>act(unloadCargo)} pick={()=>act(startPicking)} dispatch={()=>act(dispatchTruck)} accept={key=>act(acceptContract,key)} upgrade={id=>act(buyUpgrade,id)} cancel={()=>act(cancelJob)} expedite={()=>act(expeditePicking)}/>
      </div>

      <footer className="app-footer"><span>© 2026 Zidane Operations · Z-FMCG</span><span>Standalone · Save lokal di browser · Tanpa sinkronisasi</span></footer>
    </div>
    {toast && <div className={`toast toast-${toast.type}`} role="status"><span className="toast-icon">{toast.type==='success'?<CheckCircle2 size={19}/>:<TriangleAlert size={19}/>}</span><div><b>{toast.type==='success'?'Operasi berhasil':toast.type==='danger'?'Insiden operasional':'Perhatian operasional'}</b><p>{toast.text}</p></div><button onClick={()=>setToast(null)} aria-label="Tutup notifikasi"><X size={16}/></button></div>}
    {resetOpen && <ResetDialog onCancel={()=>setResetOpen(false)} onConfirm={reset}/>}
  </div>;
}
