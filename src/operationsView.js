import { capacityOf, liveStock, pendingStock, expiryQty, dockCount, otdRate, minuteLabel, STAGING_CAPACITY, openDocks, availableInventory } from './engine.js';

// Human-readable, state-driven instructions. Every CTA is an existing operation,
// never a link back to the already-selected tab.
export function nextOperation(game) {
  if (game.paused) return { id:'resume', title:'Simulasi sedang dijeda', detail:'Lanjutkan waktu gudang agar armada, picking dan inbound kembali bergerak.', label:'Lanjutkan simulasi', tone:'blue' };
  if (game.job?.status === 'ready') {
    return { id:'dispatch', title:'Wingbox siap diberangkatkan', detail:`Muatan ${game.job.city} lengkap (${game.job.loaded}/${game.job.required} pallet). Lakukan dispatch sebelum SLA habis.`, label:'Dispatch wingbox', tone:'green' };
  }
  if (game.job?.status === 'accepted') return {id:'pick', title:'Mulai muat kontrak aktif', detail:`Kontrak ${game.job.city} diterima. Mulai picking berdasarkan FEFO/FIFO.`, label:'Mulai picking', tone:'blue'};
  if (game.job?.status === 'loading') {
    if((game.job.arrivalTicks??0)>0) return {id:'fleet',title:'Truk menuju loading bay',detail:`Wingbox ${game.job.city} sedang parkir di Bay ${game.job.dockId}. Forklift menunggu sekitar ${game.job.arrivalTicks} langkah simulasi.`,label:'Pantau kedatangan',tone:'blue'};
    const need = Math.max(0, game.job.required-game.job.loaded);
    if (need>0 && liveStock(game)>0 && game.cash>=480 && game.minute-game.lastExpediteAt>=12) return {id:'expedite', title:'Percepat picking aktif', detail:`${need} pallet belum dimuat untuk ${game.job.city}. Kru tambahan mempercepat 3 pallet dengan biaya $480.`,label:'Tambah kru · $480',tone:'amber'};
    return {id:'fleet',title:'Picking otomatis berlangsung',detail:`${game.job.loaded}/${game.job.required} pallet telah dimuat. Tunggu forklift atau periksa stok rak.`,label:'Pantau proses',tone:'blue'};
  }
  if (game.minute >= game.nextInboundAt && (game.inboundArrivalTicks??0)<=0 && pendingStock(game) + 23 <= STAGING_CAPACITY) return {id:'unload', title:'Truk pemasok siap dibongkar', detail:'Ada inbound di Dock A. Bongkar barang untuk menjaga pasokan dan throughput gudang.', label:'Bongkar inbound', tone:'blue'};
  if(game.minute>=game.nextInboundAt && (game.inboundArrivalTicks??0)>0)return {id:'fleet',title:'Truk inbound sedang parkir',detail:`Tunggu ${game.inboundArrivalTicks} langkah hingga supplier aman dibongkar di Dock A.`,label:'Pantau parkir',tone:'blue'};
  if (!game.job) {
    if (openDocks(game).length && game.board.some(c=>c.status==='available' && availableInventory(game)>=c.qty)) return {id:'contracts',title:'Ambil kontrak distribusi',detail:'Stok tersedia. Pilih pengiriman antarkota dan jadwalkan picking sebelum SLA habis.',label:'Lihat kontrak tersedia',tone:'green'};
    return {id:'wait',title:'Menunggu suplai atau stok',detail:`Inbound berikutnya ${minuteLabel(game.nextInboundAt-game.minute)}. Percepat simulasi untuk memantau alur berikutnya.`,label:'Percepat waktu 4×',tone:'amber'};
  }
  return {id:'fleet',title:'Operasi berjalan',detail:'Pantau progress dan cegah bottleneck.',label:'Lihat operasi',tone:'blue'};
}
export function operationSnapshot(game) {
  const stock=liveStock(game), cap=capacityOf(game), staging=pendingStock(game);
  return {
    stock, capacity:cap, storagePct:Math.min(100,Math.round(stock/cap*100)),
    staging, stagingCapacity:STAGING_CAPACITY, stagingPct:Math.round(staging/STAGING_CAPACITY*100),
    urgent:expiryQty(game),activeShipments:game.shipments.length,
    onTime:otdRate(game), racks:8+game.upgrades.racks*2,
    amrs:1+game.upgrades.forklifts, docks:dockCount(game),
  };
}
