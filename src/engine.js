/**
 * Pure deterministic simulation engine: no servers, database, or API requests.
 * One simulated step equals four warehouse minutes. LocalStorage persistence is
 * handled by the React UI, never by the engine.
 */
export const RACKS = Array.from({ length: 12 }, (_, index) => ({
  id: `R${index + 1}`,
  zone: String.fromCharCode(65 + (index % 4)),
  bay: Math.floor(index / 4) + 1,
  x: [-8.5, -1.3, 5.9, 13.1][index % 4],
  z: [-7.4, -1.15, 5.1][Math.floor(index / 4)],
  capacity: 12,
}));

export const PRODUCTS = [
  { id: 'MIN', name: 'Minyak Goreng 2L', category: 'Sembako', color: '#ed9c43', code: 'ZFG-101' },
  { id: 'MIE', name: 'Mi Instan Karton', category: 'Makanan', color: '#f0bd4c', code: 'ZFG-102' },
  { id: 'SUS', name: 'Susu UHT 1L', category: 'Minuman', color: '#58a2e0', code: 'ZFG-103' },
  { id: 'BRS', name: 'Beras Premium 5kg', category: 'Sembako', color: '#a9aeb9', code: 'ZFG-104' },
  { id: 'BIS', name: 'Biskuit Keluarga', category: 'Makanan', color: '#cc8c67', code: 'ZFG-105' },
  { id: 'AM', name: 'Air Mineral 600ml', category: 'Minuman', color: '#64c6bc', code: 'ZFG-106' },
  { id: 'SAB', name: 'Sabun Cair', category: 'Kebutuhan Harian', color: '#9f8edb', code: 'ZFG-107' },
];

export const CONTRACTS = [
  { key: 'sby', city: 'Surabaya', client: 'AlpaMoro Distribution', qty: 18, reward: 12600, deadline: 540, transit: 188, distance: '780 km', difficulty: 'Prioritas' },
  { key: 'smg', city: 'Semarang', client: 'Idomare Supply Hub', qty: 12, reward: 7900, deadline: 380, transit: 116, distance: '450 km', difficulty: 'Reguler' },
  { key: 'bdg', city: 'Bandung', client: 'Super Indah Retail', qty: 15, reward: 10200, deadline: 460, transit: 140, distance: '150 km', difficulty: 'Ekspres' },
  { key: 'yog', city: 'Yogyakarta', client: 'BelanjaMaju Mart', qty: 10, reward: 6800, deadline: 390, transit: 110, distance: '560 km', difficulty: 'Reguler' },
];

export const UPGRADES = [
  { id: 'conveyor', name: 'Automated Conveyor', description: 'Sortir inbound lebih sering, staging lebih cepat kosong.', prices: [9800, 18600], max: 2 },
  { id: 'forklifts', name: 'Robot Forklift AMR', description: 'Tambah kapasitas picking dan put-away setiap siklus.', prices: [14200, 24800], max: 2 },
  { id: 'racks', name: 'High-Bay Rack Expansion', description: 'Tambah 2 rak × 12 pallet (+24 slot) per level.', prices: [19600, 31600], max: 2 },
  { id: 'docks', name: 'Outbound Dock Bay', description: 'Izinkan satu pengiriman tambahan aktif dan percepat loading.', prices: [22400, 37200], max: 2 },
];

const initialLots = [
  ['R1','MIN',8,325], ['R2','MIE',10,3100],
  ['R3','SUS',8,750], ['R4','BRS',9,4300],
  ['R5','BIS',7,610], ['R6','AM',8,6200],
  ['R7','SAB',5,5400], ['R8','MIE',8,3900],
];

export const sumQty = (list) => list.reduce((acc, item) => acc + item.qty, 0);
export const capacityOf = (game) => (8 + game.upgrades.racks * 2) * 12;
export const activeRackCount = (game) => 8 + game.upgrades.racks * 2;
export const liveStock = (game) => sumQty(game.lots);
export const pendingStock = (game) => sumQty(game.staging);
export const STAGING_CAPACITY = 40;
export const SAVE_KEY = 'zidane_fmcg_3d_save_v3';
export const MISSION_CARDS = [
 {key:'inbound', title:'Terima barang manufaktur', description:'Bongkar 1 truk inbound', reward:900, xp:35},
 {key:'putaway', title:'Rapikan stok gudang', description:'Simpan 12 pallet ke High-Bay', reward:1300, xp:50},
 {key:'shipping', title:'Kirim pesanan toko', description:'Dispatch 1 truk Wingbox', reward:1700, xp:75},
 {key:'delivery', title:'Jaga pengiriman tepat waktu', description:'Selesaikan 1 pengiriman', reward:2000, xp:90},
 {key:'upgrade', title:'Modernisasi fasilitas', description:'Beli 1 upgrade gudang', reward:1500, xp:65},
];
export function missionProgress(game,key){
 switch(key){
  case 'inbound': return Math.min(1,game.inboundSerial);
  case 'putaway': return Math.min(12,game.stats.stored);
  case 'shipping': return Math.min(1,game.stats.dispatches);
  case 'delivery': return Math.min(1,game.stats.delivered);
  case 'upgrade': return Math.min(1,Object.values(game.upgrades).reduce((a,b)=>a+b,0));
  default:return 0;
 }
}
export const missionGoal = key => key==='putaway'?12:1;
export function operationalAlerts(game){
 const alerts=[];
 const urgent=expiryQty(game);
 if(urgent) alerts.push({kind:'danger',title:'Risiko kedaluwarsa',detail:`${urgent} pallet harus diprioritaskan sebelum expiry.`});
 if(pendingStock(game)>=STAGING_CAPACITY*.8) alerts.push({kind:'warning',title:'Cross-dock hampir penuh',detail:'Percepat sorting atau tingkatkan conveyor/AMR.'});
 if(game.job && game.job.deadlineAt-game.minute<=120) alerts.push({kind:'warning',title:'SLA kontrak menipis',detail:`Order ${game.job.city}: ${minuteLabel(game.job.deadlineAt-game.minute)} tersisa.`});
 if(game.job?.status==='loading' && liveStock(game)<game.job.required-game.job.loaded) alerts.push({kind:'warning',title:'Stok picking kurang',detail:'Inbound tambahan diperlukan untuk menyelesaikan order.'});
 if(!alerts.length) alerts.push({kind:'success',title:'Operasi terkendali',detail:'Tidak ada bottleneck kritis pada shift ini.'});
 return alerts;
}
export function opsScore(game){
 const otd=otdRate(game);
 return Math.max(0,Math.min(100,Math.round(42+(otd??95)*.43-(pendingStock(game)/STAGING_CAPACITY)*10-(expiryQty(game)/Math.max(1,liveStock(game)))*22+game.reputation*.16)));
}

export const warnLots = (game) => game.lots.filter((p) => p.expiryAt - game.minute <= 720);
export const expiryQty = (game) => sumQty(warnLots(game));
export const getSku = (id) => PRODUCTS.find((p) => p.id === id) || PRODUCTS[0];
export const rackStock = (game, id) => game.lots.filter((p) => p.rackId === id);
export const dockCount = (game) => 1 + game.upgrades.docks;
// Arrival is measured in simulation ticks. One tick is one simulated step,
// while truck visuals interpolate over the same number of ticks.
export const TRUCK_ARRIVAL_TICKS = 8;
export const TRUCK_DEPART_TICKS = 7;
export const truckDocked = job => !job || (job.arrivalTicks ?? 0) <= 0;
// Active loading jobs occupy individual physical docks; en-route shipments do not.
export const allJobs = (game) => Array.isArray(game.jobs) ? game.jobs : (game.job ? [game.job] : []);
export const occupiedDocks = (game) => allJobs(game).map(j=>j.dockId ?? 1);
export const openDocks = (game) => Array.from({length:dockCount(game)},(_,i)=>i+1).filter(n=>!occupiedDocks(game).includes(n));
export const availableInventory = (game) => Math.max(0,liveStock(game)+pendingStock(game)-allJobs(game).reduce((n,j)=>n+(j.required-j.loaded),0));
function syncJob(game){
  game.job = game.jobs.find(j=>j.id===game.activeJobId) || game.jobs[0] || null;
  game.activeJobId = game.job?.id ?? null;
  return game;
}
export function chooseJob(game,id){
  if(!allJobs(game).some(j=>j.id===id))return game;
  const g=clone(game);g.activeJobId=id;return syncJob(g);
}
export const otdRate = (game) => game.stats.delivered ? Math.round(game.stats.ontime / game.stats.delivered * 100) : null;
export const rankName = (game) => game.stats.xp >= 900 ? 'National Logistics Director' : game.stats.xp >= 450 ? 'Regional Operations Manager' : game.stats.xp >= 160 ? 'Senior DC Manager' : 'DC Head of Operations';

export function dateAt(minute, withTime = false) {
  const date = new Date(Date.UTC(2026, 9, 30, 8, 0) + minute * 60000);
  const datePart = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
  if (!withTime) return datePart + ' ' + date.getUTCFullYear();
  const time = `${String(date.getUTCHours()).padStart(2, '0')}.${String(date.getUTCMinutes()).padStart(2, '0')}`;
  return `${datePart}, ${time}`;
}
export function shiftClock(minute) {
  const d = new Date(Date.UTC(2026, 9, 30, 8) + minute * 60000);
  return `${new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d)} · ${String(d.getUTCHours()).padStart(2,'0')}.${String(d.getUTCMinutes()).padStart(2,'0')} WIB`;
}
export function minuteLabel(minute) {
  if (minute <= 0) return 'Terlambat';
  if (minute < 60) return `${Math.ceil(minute)} menit`;
  const h = Math.floor(minute / 60);
  return `${h}j ${Math.ceil(minute % 60)}m`;
}
export function currency(value) {
  return '$' + Math.round(value).toLocaleString('en-US');
}

const makeBoard = () => CONTRACTS.map((c) => ({ ...c, status: 'available', cycle: 1 }));

export function initialGame() {
  return {
    version: 2,
    minute: 0,
    tick: 0,
    cash: 48500,
    reputation: 82,
    paused: false,
    speed: 1,
    upgrades: { conveyor: 0, forklifts: 0, racks: 0, docks: 0 },
    lots: initialLots.map(([rackId, sku, qty, expiryAt], i) => ({ id: `lot${i}`, rackId, sku, qty, expiryAt, receivedAt: -2000 + i * 185 })),
    staging: [],
    nextInboundAt: 0,
    inboundArrivalTicks: 0,
    inboundSerial: 0,
    board: makeBoard(),
    job: null,
    jobs: [],
    activeJobId: null,
    nextJobId: 1,
    shipments: [],
    lastDispatchId: 0,
    missionClaims: [],
    lastExpediteAt: -9999,
    expediteCount: 0,
    tutorial: 0,
    stats: { delivered: 0, ontime: 0, expired: 0, dispatches: 0, xp: 0, stored: 0 },
    logs: [
      { id: 1, minute: 0, type: 'info', text: 'Shift 08.00 dimulai. Truk manufaktur menunggu di Inbound Dock A.' },
      { id: 2, minute: 0, type: 'warning', text: 'Batch minyak goreng memiliki shelf life pendek. Terapkan FIFO.' },
    ],
    eventSeq: 2,
  };
}

function logEvent(g, text, type = 'info') {
  g.eventSeq++;
  g.logs = [{ id: g.eventSeq, minute: g.minute, type, text }, ...g.logs].slice(0, 14);
}
function clone(g) {
  const next={
    ...g,
    upgrades: { ...g.upgrades },
    lots: g.lots.map(p => ({ ...p })),
    staging: g.staging.map(p => ({ ...p })),
    board: g.board.map(c => ({ ...c })),
    jobs: allJobs(g).map(j=>({...j,picked:(j.picked||[]).map(p=>({...p}))})),
    shipments: g.shipments.map(s => ({ ...s })),
    stats: { ...g.stats },
    logs: [...g.logs],
    missionClaims: [...(g.missionClaims||[])],
  };
  return syncJob(next);
}
function actionError(g, message) {
  const next = clone(g); logEvent(next, message, 'warning'); return next;
}
function pickGoods(g,limit,job=g.job){
 if(job?.status!=='loading'||!truckDocked(job))return 0;
 let remaining=Math.min(limit,job.required-job.loaded);
 let picked=0;
 const sorted=[...g.lots].sort((a,b)=>{
   const urgentA=a.expiryAt-g.minute<=720;
   const urgentB=b.expiryAt-g.minute<=720;
   if(urgentA!==urgentB)return urgentA?-1:1;
   if(urgentA&&urgentB)return a.expiryAt-b.expiryAt;
   return (a.receivedAt??0)-(b.receivedAt??0)||a.expiryAt-b.expiryAt;
 });
 for(const lot of sorted){
  if(remaining<=0)break;
  const amount=Math.min(lot.qty,remaining);
  if(amount<=0)continue;
  job.picked.push({sku:lot.sku,qty:amount,expiryAt:lot.expiryAt,receivedAt:lot.receivedAt,rackId:lot.rackId});
  lot.qty-=amount;remaining-=amount;picked+=amount;
 }
 g.lots=g.lots.filter(p=>p.qty>0);
 job.loaded+=picked;
 if(job.loaded>=job.required){
  job.status='ready';
  if(g.tutorial===4)g.tutorial=5;
  logEvent(g,`Muatan ${job.city} di Bay ${job.dockId} siap (${job.loaded}/${job.required}).`,'success');
 }
 return picked;
}
export function expeditePicking(game){
 if(game.paused)return game; // Pause freezes all operational decisions and stock transitions.

 if(game.job?.status!=='loading')return actionError(game,'Belum ada picking aktif untuk dipercepat.');
 if(!truckDocked(game.job))return actionError(game,`Truk menuju Bay ${game.job.dockId}. Tunggu hingga selesai parkir.`);
 if(game.cash<480)return actionError(game,'Saldo tidak cukup untuk menambah kru picking.');
 if(game.minute-game.lastExpediteAt<12)return actionError(game,'Kru tambahan masih bertugas. Tunggu 12 menit simulasi.');
 const g=clone(game);
 const amount=pickGoods(g,3);
 if(!amount)return actionError(game,'Stok rak belum cukup. Terima dan sortir inbound terlebih dahulu.');
 g.cash-=480;g.stats.xp+=5;g.expediteCount++;g.lastExpediteAt=g.minute;
 logEvent(g,`Kru picking ekspres memuat ${amount} pallet. Biaya operasional -${currency(480)}.`,'info');
 return g;
}
export function claimMission(game,key){
 if(game.paused)return game; // Pause freezes all operational decisions and stock transitions.

 const mission=MISSION_CARDS.find(m=>m.key===key);
 if(!mission||game.missionClaims?.includes(key)||missionProgress(game,key)<missionGoal(key))return game;
 const g=clone(game);g.missionClaims.push(key);g.cash+=mission.reward;g.stats.xp+=mission.xp;
 g.reputation=Math.min(100,g.reputation+1);
 logEvent(g,`Misi '${mission.title}' selesai! Bonus ${currency(mission.reward)} +${mission.xp} XP.`,'success');
 return g;
}
function advanceOne(g) {
  g.minute += 4;
  g.tick += 1;
  if(g.minute>=g.nextInboundAt && g.inboundArrivalTicks==null)g.inboundArrivalTicks=TRUCK_ARRIVAL_TICKS;
  else if((g.inboundArrivalTicks??0)>0)g.inboundArrivalTicks=Math.max(0,g.inboundArrivalTicks-1);
  for(const job of g.jobs){
    if((job.arrivalTicks??0)>0){
      job.arrivalTicks = Math.max(0,job.arrivalTicks-1);
      if(job.arrivalTicks===0) logEvent(g,`Wingbox ${job.city} selesai parkir di Bay ${job.dockId}. Forklift boleh memulai pemuatan.`,'info');
    }
  }

  // Expired inventory is written off instead of magically staying on the rack.
  let expiredQty = 0;
  g.lots = g.lots.filter((p) => {
    if (p.expiryAt > g.minute) return true;
    expiredQty += p.qty;
    return false;
  });
  g.staging = g.staging.filter((p) => {
    if (p.expiryAt > g.minute) return true;
    expiredQty += p.qty;
    return false;
  });
  for(const job of g.jobs){
    if(!job.picked?.length)continue;
    const remains=job.picked.filter(p=>p.expiryAt>g.minute);
    const lost=job.picked.filter(p=>p.expiryAt<=g.minute).reduce((n,p)=>n+p.qty,0);
    if(lost){
      expiredQty+=lost;job.picked=remains;job.loaded=Math.max(0,job.loaded-lost);job.status='loading';
      logEvent(g,`${lost} pallet muatan ${job.city} di Bay ${job.dockId} kedaluwarsa; perlu pengganti.`, 'danger');
    }
  }
  if (expiredQty) {
    g.stats.expired += expiredQty;
    g.cash = Math.max(0, g.cash - expiredQty * 135);
    g.reputation = Math.max(0, g.reputation - Math.min(8, Math.ceil(expiredQty / 2)));
    logEvent(g, `${expiredQty} pallet kedaluwarsa dibuang. Kerugian $${(expiredQty * 135).toLocaleString()}.`, 'danger');
  }

  // Picking & manual priority use the same inventory-safe FEFO/FIFO implementation.
  if(g.tick%3===0){
    const loadingJobs=g.jobs.filter(j=>j.status==='loading');
    let budget=1+g.upgrades.forklifts+g.upgrades.docks;
    // Shared forklift capacity: multiple docks don't generate free pallet output.
    const offset=g.tick/3%Math.max(1,loadingJobs.length);
    const ordered=[...loadingJobs.slice(offset),...loadingJobs.slice(0,offset)];
    for(let i=0;i<ordered.length && budget>0;i++){
      const remaining=ordered.length-i;
      const allotment=Math.max(1,Math.ceil(budget/remaining));
      const picked=pickGoods(g,allotment,ordered[i]);budget-=picked;
      if(picked===0 && g.tick%9===0)logEvent(g,`Stok picking kurang untuk ${ordered[i].city}.`, 'warning');
    }
  }

  // Conveyor and forklift automatically put away sorted stock into open racks.
  const frequency = Math.max(1, 5 - g.upgrades.conveyor * 2);
  if (g.staging.length && g.tick % frequency === 0) {
    let remaining = 1 + g.upgrades.forklifts;
    const allowed = RACKS.slice(0, activeRackCount(g));
    for (const staged of g.staging) {
      if (remaining === 0) break;
      for (const rack of allowed) {
        if (remaining === 0 || staged.qty === 0) break;
        const available = rack.capacity - sumQty(g.lots.filter(p => p.rackId === rack.id));
        if (available <= 0) continue;
        const num = Math.min(staged.qty, available, remaining);
        const existing = g.lots.find(p => p.rackId === rack.id && p.sku === staged.sku && p.expiryAt === staged.expiryAt);
        if (existing) existing.qty += num;
        else g.lots.push({ ...staged, id: `stored-${staged.id}-${rack.id}`, rackId: rack.id, qty: num });
        staged.qty -= num;
        remaining -= num;
        g.stats.stored += num;
      }
    }
    g.staging = g.staging.filter(p => p.qty > 0);
    if (g.tutorial === 1 && g.stats.stored > 0) {
      g.tutorial = 2;
      logEvent(g, 'Forklift menyimpan pallet pertama ke high-bay rack. Buka kontrak distribusi.', 'success');
    }
  }

  // Delivery completion is timed by simulated minutes, not by frame rate.
  for (const s of g.shipments) {
    if (g.minute >= s.arriveAt && !s.completed) {
      s.completed = true;
      const ontime = s.arriveAt <= s.deadlineAt;
      const income = ontime ? s.reward : Math.round(s.reward * 0.58);
      g.cash += income;
      g.reputation = Math.max(0, Math.min(100, g.reputation + (ontime ? 3 : -7)));
      g.stats.delivered++;
      if (ontime) g.stats.ontime++;
      g.stats.xp += ontime ? 90 : 35;
      g.board = g.board.map(c => c.key === s.key ? {
        ...c, status: 'available', cycle: c.cycle + 1,
        qty: Math.min(24, c.qty + (c.cycle % 2 ? 2 : -1)),
        reward: c.reward + (c.cycle % 2 ? 850 : 600),
      } : c);
      logEvent(g, `Wingbox tiba di ${s.city} ${ontime ? 'TEPAT WAKTU' : 'TERLAMBAT'}! Pendapatan +${currency(income)}.`, ontime ? 'success' : 'danger');
    }
  }
  g.shipments = g.shipments.filter(s => !s.completed);
}

export function advanceGame(game) {
  if (game.paused) return game;
  const g = clone(game);
  for (let i = 0; i < game.speed; i++) advanceOne(g);
  return g;
}

export function unloadCargo(game) {
 if(game.paused)return game; // Pause freezes all operational decisions and stock transitions.

  if(game.minute>=game.nextInboundAt && (game.inboundArrivalTicks??0)>0)return actionError(game,`Truk inbound masih parkir di Dock A. Tunggu ${game.inboundArrivalTicks} langkah.`);
  if (game.minute < game.nextInboundAt) return actionError(game, `Truk manufaktur berikutnya tiba dalam ${minuteLabel(game.nextInboundAt - game.minute)}.`);
  if (pendingStock(game) + 23 > STAGING_CAPACITY) return actionError(game, 'Area cross-dock tidak cukup untuk satu muatan truk. Tunggu forklift menyelesaikan sorting.');
  const g = clone(game);
  const serial = g.inboundSerial + 1;
  const pattern = serial % 3;
  const pallets = [
    { sku: pattern === 0 ? 'SUS' : 'MIN', qty: 5 + (pattern === 2 ? 1 : 0), expiryAt: g.minute + 720 + pattern * 110 },
    { sku: pattern === 2 ? 'BIS' : 'MIE', qty: 6, expiryAt: g.minute + 2450 },
    { sku: pattern === 1 ? 'AM' : 'BRS', qty: 6, expiryAt: g.minute + 3800 },
    { sku: 'SAB', qty: 5, expiryAt: g.minute + 5200 },
  ];
  g.staging.push(...pallets.map((p, i) => ({ ...p, id: `inbound-${serial}-${i}`, rackId: null, receivedAt: g.minute }))); 
  g.inboundSerial = serial;
  g.nextInboundAt = g.minute + 300;
  g.inboundArrivalTicks = null;
  if (g.tutorial === 0) g.tutorial = 1;
  logEvent(g, `Inbound #${serial} dibongkar: ${sumQty(pallets)} pallet menuju cross-dock.`, 'success');
  return g;
}
export function acceptContract(game, key) {
 if(game.paused)return game; // Pause freezes all operational decisions and stock transitions.

  const c = game.board.find(x => x.key === key);
  if (!c || c.status !== 'available') return actionError(game, 'Kontrak belum tersedia.');
  if(!openDocks(game).length)return actionError(game,'Semua outbound bay sedang digunakan. Upgrade dock atau selesaikan pengiriman.');
  if(availableInventory(game)<c.qty)return actionError(game,`Stok bebas tidak cukup untuk ${c.qty} pallet (stok lain sudah dialokasikan).`);
  const g=clone(game);
  const dockId=openDocks(g)[0];
  const id=`ORD-${String(g.nextJobId++).padStart(3,'0')}`;
  // If a previous wingbox is still exiting this same bay, queue the next
  // arrival behind it. Dispatch frees commercial capacity, not the truck lane.
  const lastDeparture=[...g.shipments].reverse().find(s=>s.dockId===dockId && Number.isFinite(s.departTick));
  const exitRemaining=lastDeparture?Math.max(0,TRUCK_DEPART_TICKS-(g.tick-lastDeparture.departTick)):0;
  g.jobs.push({id,dockId,key,city:c.city,client:c.client,required:c.qty,loaded:0,reward:c.reward,
    deadlineAt:g.minute+c.deadline,transit:c.transit,status:'accepted',distance:c.distance,picked:[],arrivalTicks:TRUCK_ARRIVAL_TICKS+exitRemaining});
  g.activeJobId=id;
  syncJob(g);
  g.board = g.board.map(x => x.key === key ? { ...x, status: 'active' } : x);
  if (g.tutorial === 2) g.tutorial = 3;
  logEvent(g, `Kontrak ${c.city} diterima di Bay ${dockId}: ${c.qty} pallet. SLA ${minuteLabel(c.deadline)}.`, 'info');
  return g;
}
export function startPicking(game) {
 if(game.paused)return game; // Pause freezes all operational decisions and stock transitions.

  if (!game.job || game.job.status !== 'accepted') return game;
  const g = clone(game);
  g.job.status = 'loading';
  if (g.tutorial === 3) g.tutorial = 4;
  logEvent(g, truckDocked(g.job) ? `FIFO picking dimulai di Bay ${g.job.dockId}.` : `Picking dijadwalkan; forklift menunggu truk parkir di Bay ${g.job.dockId}.`, 'info');
  return g;
}
export function dispatchTruck(game) {
 if(game.paused)return game; // Pause freezes all operational decisions and stock transitions.

  if (!game.job || game.job.status !== 'ready') return actionError(game, 'Muatan belum lengkap. Tunggu picking selesai.');
  const g = clone(game);
  const j = g.job;
  g.shipments.push({ id: `wb-${g.lastDispatchId + 1}`, dockId:j.dockId, key: j.key, city: j.city, client: j.client,
    qty: j.required, reward: j.reward, departAt: g.minute, arriveAt: g.minute + j.transit,
    deadlineAt: j.deadlineAt, completed: false, departTick:g.tick });
  g.stats.dispatches += 1;
  g.lastDispatchId++;
  g.jobs=g.jobs.filter(x=>x.id!==j.id);
  syncJob(g);
  if (g.tutorial === 5) g.tutorial = 6;
  g.board = g.board.map(c => c.key === j.key ? { ...c, status: 'transit' } : c);
  logEvent(g, `WB-${String(g.lastDispatchId).padStart(3, '0')} BERANGKAT ke ${j.city}. ETA ${minuteLabel(j.transit)}.`, 'success');
  return g;
}
export function cancelJob(game) {
 if(game.paused)return game; // Pause freezes all operational decisions and stock transitions.

  if (!game.job) return game;
  const g = clone(game);
  const extra=[];
  // Restore to the rack the goods were taken from whenever possible.
  // Do not create more units or violate per-rack capacity.
  for(const [index,item] of (g.job.picked||[]).entries()){
    let remaining=item.qty;
    if(item.rackId && RACKS.some(r=>r.id===item.rackId)){
      const free=12-sumQty(g.lots.filter(p=>p.rackId===item.rackId));
      const amount=Math.max(0,Math.min(free,remaining));
      if(amount){
        const match=g.lots.find(p=>p.rackId===item.rackId&&p.sku===item.sku&&p.expiryAt===item.expiryAt&&p.receivedAt===item.receivedAt);
        if(match)match.qty+=amount;
        else g.lots.push({...item,id:`restored-${g.tick}-${index}`,qty:amount});
        remaining-=amount;
      }
    }
    if(remaining)extra.push({...item,id:`return-${g.tick}-${index}`,rackId:null,qty:remaining});
  }
  if(pendingStock(g)+sumQty(extra)>STAGING_CAPACITY)
    return actionError(game,'Area sortir terlalu penuh untuk mengembalikan order. Tunggu put-away terlebih dahulu.');
  g.staging.push(...extra);
  g.board=g.board.map(c=>c.key===g.job.key?{...c,status:'available'}:c);
  logEvent(g,`Order ${g.job.city} dibatalkan. ${g.job.loaded} pallet dikembalikan tanpa kehilangan stok.`,'warning');
  g.jobs=g.jobs.filter(x=>x.id!==g.job.id);
  syncJob(g);
  return g;
}
export function buyUpgrade(game, id) {
 if(game.paused)return game; // Pause freezes all operational decisions and stock transitions.

  const upgrade = UPGRADES.find(x => x.id === id);
  if (!upgrade) return game;
  const current = game.upgrades[id];
  if (current >= upgrade.max) return actionError(game, `${upgrade.name} sudah mencapai level maksimum.`);
  const price = upgrade.prices[current];
  if (game.cash < price) return actionError(game, `Saldo tidak mencukupi. Diperlukan ${currency(price)}.`);
  const g = clone(game);
  g.cash -= price;
  g.upgrades[id]++;
  g.stats.xp += 35;
  if (g.tutorial === 6) g.tutorial = 7;
  logEvent(g, `${upgrade.name} ditingkatkan ke level ${g.upgrades[id]}. -${currency(price)}`, 'success');
  return g;
}

export function loadSavedGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY) || window.localStorage.getItem('zidane_fmcg_3d_save_v2');
    if (!raw) return initialGame();
    const data = JSON.parse(raw);
    if (data?.version !== 2 || !data.stats || !Array.isArray(data.lots) || !data.upgrades || !Array.isArray(data.board)) return initialGame();
    const fresh=initialGame();
    const merged={...fresh,...data,missionClaims:Array.isArray(data.missionClaims)?data.missionClaims:[],paused:false};
    if(!Object.prototype.hasOwnProperty.call(data,'inboundArrivalTicks'))merged.inboundArrivalTicks=merged.minute<merged.nextInboundAt?null:0;
    if(merged.cash<0||!Number.isFinite(merged.cash)||!Number.isFinite(merged.minute))return initialGame();
    // Migration: the old single job moves into Bay 1, without modifying its stock.
    if(!Array.isArray(data.jobs)){
      merged.jobs=data.job?[{...data.job,id:'ORD-001',dockId:1,picked:data.job.picked||[]}]:[];
      merged.nextJobId=merged.jobs.length+1;
      merged.activeJobId=merged.jobs[0]?.id??null;
    }
    merged.jobs=merged.jobs.filter(j=>Number.isFinite(j.loaded)&&j.required>0&&j.dockId>=1&&j.dockId<=dockCount(merged));
    if(!merged.nextJobId||merged.nextJobId<=merged.jobs.length)merged.nextJobId=merged.jobs.length+1;
    return syncJob(merged);
  } catch { return initialGame(); }
}
