// Automated player used for headless playtests.
window.__bot = function () {
  const g = window.__game;
  if (!g || g.phase !== 'service' && g.phase !== 'closing') return;
  const o = g.owner, T = g.tasks;
  if (o.queue.length >= 2 || (o.current && o.queue.length >= 1)) return;
  const groups = g.customers.groups;
  const queued = (kind, target) => [o.current, ...o.queue].some((t) => t && t.kind === kind && t.target === target);
  // serve what we hold (but first complete the same ticket if possible)
  if (o.hands.length) {
    for (const t of g.orders.tickets) {
      const pend = t.pending();
      if (o.hands.some((h) => pend.some((p) => p.pid === h.pid)) && !queued('serve', t.group)) {
        if (o.freeHands > 0 && !o.current) {
          const cov = g.coverage();
          for (const it of pend) {
            if ((cov[it.pid] || 0) > 0) { cov[it.pid]--; continue; }
            const p = g.products.get(it.pid);
            let job = null;
            if (p.category === 'draft') { const tap = g.taps.find((x) => x.st.beerId === it.pid && !x.broken && x.level > 0); if (tap && g.glasses.clean > 0) job = T.pour(tap); }
            else if (p.category === 'food') { const st = g.foodStations.find((s) => s.products().includes(it.pid)); if (st && g.inventory.portions(it.pid) > 0) job = T.food(st, it.pid); }
            else if (g.fridge.count(it.pid) > 0) job = T.fridgeTake(it.pid);
            if (job) return o.enqueue(job);
          }
        }
        if (!o.current) return o.enqueue(T.serve(t.group));
        return;
      }
    }
  }
  for (const tap of g.taps) if (tap.broken && !queued('fix', tap)) return o.enqueue(T.fix(tap));
  const bill = groups.find((x) => x.state === 'wantBill' && !queued('collect', x) && !g.isClaimed('g' + x.id));
  if (bill) { o.enqueue(T.collect(bill)); o.enqueue(T.clear(bill.spots[0])); return; }
  const ord = groups.find((x) => x.state === 'wantOrder' && !queued('takeOrder', x) && !g.isClaimed('g' + x.id));
  if (ord) return o.enqueue(T.takeOrder(ord));
  if (o.freeHands > 0 && !o.carrying) {
    const job = g.staffAI.nextProduction(o);
    if (job) return o.enqueue(job);
    // empty tap with pending items -> change keg
    const pend = g.orders.pendingList();
    for (const { item } of pend) {
      const p = g.products.get(item.pid);
      if (p.category === 'draft') {
        const tap = g.taps.find((t) => t.st.beerId === item.pid);
        if (tap && tap.level <= 0 && g.inventory.kegs(item.pid) > 0 && !o.hands.length) { for (const t of T.changeKeg(tap)) o.enqueue(t); return; }
      }
      if ((p.category === 'bottle' || p.category === 'soft') && g.fridge.count(item.pid) <= 0 && g.inventory.bottles(item.pid) > 0 && !o.hands.length) { for (const t of T.fridgeFill()) o.enqueue(t); return; }
    }
  }
  const dirty = g.bar.spots.find((s) => s.isDirty && !s.group && !queued('clear', s) && !g.isClaimed('s' + s.id));
  if (dirty) return o.enqueue(T.clear(dirty));
  if (o.dirtyCount && !queued('drop')) return o.enqueue(T.drop());
  const puddle = g.bar.puddles[0];
  if (puddle && !queued('mop', puddle)) return o.enqueue(T.mop(puddle));
  if (g.glasses.clean < 3) {
    const d2 = g.bar.spots.find((s) => s.isDirty && !queued('clear', s));
    if (d2) return o.enqueue(T.clear(d2));
  }
};

// fast-forward the simulation without rendering (headless tests)
window.__fast = function (simSeconds, step = 0.1) {
  const g = window.__game;
  if (!g.autoMini) g.autoMini = 'mix'; // mini-games auto-resolved with a realistic quality mix
  let t = 0;
  while (t < simSeconds && (g.phase === 'service' || g.phase === 'closing')) {
    g.simulate(step);
    g.world.effects.update(step);
    g.world.room.update(step, 0);
    window.__bot();
    t += step;
  }
  return { phase: g.phase, clock: g.clock };
};

// morning routine: restock + invest (used by headless balance tests)
window.__botMorning = function () {
  const g = window.__game;
  const log = [];
  const P = g.products;
  const buy = (pid, packs) => {
    for (let i = 0; i < packs; i++) {
      const before = g.state.money;
      g.buyStock(pid, 'depot');
      if (g.state.money === before) break;
      log.push('buy ' + pid);
    }
  };
  // second tap gets a new beer
  g.state.taps.forEach((t, i) => {
    if (!t.beerId) {
      const cands = g.data.beers.filter((b) => b.serve === 'tap' && b.level <= g.level() && !g.state.taps.some((x) => x.beerId === b.id));
      const pick = cands.sort((a, b) => b.popularity - a.popularity)[0];
      if (pick) {
        g.buyStock(pick.id, 'depot');
        g.assignTap(i, pick.id);
        log.push('tap ' + i + ' -> ' + pick.id);
      }
    }
  });
  for (const t of g.state.taps) if (t.beerId) {
    const need = 2 - g.inventory.kegs(t.beerId) + (t.level < 10 ? 1 : 0);
    if (need > 0) buy(t.beerId, need);
  }
  for (const pid of g.state.fridge.products) if (g.inventory.bottles(pid) < 12) buy(pid, 1);
  for (const f of g.menuFoods()) {
    const n = g.inventory.portions(f.id);
    if (n < 14) buy(f.id, Math.ceil((14 - n) / f.kegSize));
  }
  // investments
  const keep = 120;
  const tryUp = (id) => {
    const u = g.upgradeDefs.get(id);
    const tier = u.repeatable ? u.tiers[0] : u.tiers[g.up(id)];
    if (tier && tier.level <= g.level() && g.state.money - tier.price > keep) {
      g.buyUpgrade(id);
      log.push('upgrade ' + id);
      return true;
    }
    return false;
  };
  const tryPlace = (id) => {
    const def = g.catalog.get(id);
    if (def.level > g.level() || g.state.money - def.price < keep) return false;
    const { w, d } = g.roomSize();
    for (let z = 3.5; z < d - 0.5; z += 0.5)
      for (let x = 1; x < w - 0.5; x += 0.5)
        for (const rot of [0, 1]) {
          if (!g.bar.canPlace(def, x, z, rot)) {
            g.spend(def.price, 'build');
            g.bar.place(def, x, z, rot);
            log.push('place ' + id + ' @' + x + ',' + z);
            return true;
          }
        }
    return false;
  };
  const plan = [
    () => g.up('stools') < 2 && tryUp('stools'),
    () => g.bar.tableCount() < 4 && tryPlace('table_bancale'),
    () => !g.up('snack') && tryUp('snack'),
    () => g.state.taps.length < 2 && tryUp('tap'),
    () => g.bar.tableCount() < 5 && tryPlace('table_bistrot'),
    () => !g.up('tray') && tryUp('tray'),
    () => g.up('stools') < 4 && tryUp('stools'),
    () => g.bar.tableCount() < 6 && tryPlace(g.level() >= 2 ? 'table_chene' : 'table_bistrot'),
    () => g.state.glasses < 24 && tryUp('glasses'),
    () => g.bar.wallItems.length < 3 && (() => { const def = g.catalog.get('guirlande'); if (g.state.money - def.price < keep) return false; for (let t = 1; t < 8; t += 0.5) if (!g.bar.canPlaceWall(def, 'W', t)) { g.spend(def.price, 'build'); g.bar.placeWall(def, 'W', t); log.push('wall'); return true; } return false; })(),
    () => g.level() >= 2 && g.state.taps.length < 3 && tryUp('tap'),
    () => g.level() >= 2 && !g.up('planche_station') && tryUp('planche_station'),
    () => g.level() >= 2 && g.state.staff.length < 1 && g.state.money > 300 && (g.hireStaff(g.staffCandidates('serveur')[0]), true),
    () => g.bar.tableCount() < 8 && tryPlace(g.level() >= 2 ? 'table_chene' : 'table_bistrot'),
    () => !g.up('shoes') && tryUp('shoes'),
    () => !g.up('dishwasher') && tryUp('dishwasher'),
    () => !g.up('barkit') && tryUp('barkit'),
    () => !g.up('fastTap') && tryUp('fastTap'),
    () => g.level() >= 2 && !g.up('multiTap') && tryUp('multiTap'),
  ];
  for (let k = 0; k < 3; k++) for (const step of plan) step();
  g.morningRestock();
  return log.join(' | ');
};

// manual clock for headless tests: advance game time without waiting for (very slow) software-rendered frames
window.__tick = function (sec, step = 1 / 30) {
  const g = window.__game;
  if (!g.__manual) {
    g.__manual = true;
    g.__upd = g.update.bind(g);
    g.update = () => {};
  }
  for (let t = 0; t < sec - 1e-6; t += step) {
    const live = g.phase === 'service' || g.phase === 'closing';
    const spd = g.minigames?.active ? Math.min(g.speed, 1) * 0.8 : g.speed;
    if (live && !g.paused) g.simulate(step * spd);
    g.minigames.update(live && !g.paused ? step : 0);
    g.world.effects.update(step);
    g.ui.update(step);
  }
};
window.__render = function () {
  const g = window.__game;
  if (g.__upd) {
    const s = g.speed;
    g.speed = 0;
    g.__upd(0.0001);
    g.speed = s;
  }
};
