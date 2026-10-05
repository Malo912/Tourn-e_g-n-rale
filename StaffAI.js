// Autonomous behaviour for employees. They pick unclaimed jobs by priority.
export class StaffAI {
  constructor(game) {
    this.game = game;
  }

  think(w) {
    const g = this.game;
    if (g.phase !== 'service') return;
    const T = g.tasks;
    const groups = g.customers.groups;
    const free = (key) => !g.isClaimed(key);
    const near = (list, getPos) => list.sort((a, b) => dist(w.pos, getPos(a)) - dist(w.pos, getPos(b)));

    if (w.role === 'serveur') {
      if (w.dirtyCount >= 6) return w.enqueue(T.drop());
      const bills = near(groups.filter((x) => x.state === 'wantBill' && free('g' + x.id)), (x) => x.spots[0].center);
      if (bills.length) return w.enqueue(T.collect(bills[0]));
      const orders = near(groups.filter((x) => x.state === 'wantOrder' && free('g' + x.id)), (x) => x.spots[0].center);
      if (orders.length) return w.enqueue(T.takeOrder(orders[0]));
      const dirty = near(g.bar.spots.filter((s) => s.isDirty && free('s' + s.id) && (!s.group || s.kind === 'table')), (s) => s.center);
      if (dirty.length && w.dirtyCount < 10) return w.enqueue(T.clear(dirty[0]));
      if (w.dirtyCount) return w.enqueue(T.drop());
      const puddles = g.bar.puddles.filter((p) => free('p' + p.x.toFixed(2) + p.z.toFixed(2)));
      if (puddles.length) return w.enqueue(T.mop(puddles[0]));
      return;
    }

    if (w.role === 'barman') {
      if (w.dirtyCount) return w.enqueue(T.drop());
      // deliver what we hold
      if (w.hands.length) {
        const target = this.groupForHands(w);
        if (target) return w.enqueue(T.serve(target));
        // nobody needs it anymore: keep for later, but don't block forever
        if (w.hands.length >= w.capacity) {
          w.hands = [];
          w.refreshHands();
        }
      }
      const broken = g.taps.find((t) => t.broken && free('fix' + t.index));
      if (broken) return w.enqueue(T.fix(broken));
      const emptyTap = g.taps.find((t) => t.beer && t.level <= 0 && g.inventory.kegs(t.st.beerId) > 0 && free('keg' + t.index));
      if (emptyTap && !w.hands.length) {
        const tasks = T.changeKeg(emptyTap);
        tasks[0].claim = 'keg' + emptyTap.index;
        return w.enqueue(tasks[0]);
      }
      // produce uncovered items, grouping by ticket
      const job = this.nextProduction(w);
      if (job) return w.enqueue(job);
      if (w.hands.length) {
        const target = this.groupForHands(w);
        if (target) return w.enqueue(T.serve(target));
      }
      // keep the fridge stocked
      const f = g.fridge;
      if (f.total() < f.capacity * 0.45 && f.products.some((p) => g.inventory.bottles(p) > 0) && free('fridge') && !w.hands.length) {
        const t = T.fridgeFill()[0];
        t.claim = 'fridge';
        return w.enqueue(t);
      }
    }
  }

  groupForHands(w) {
    const g = this.game;
    for (const t of g.orders.tickets) {
      const pend = t.pending();
      if (w.hands.some((h) => pend.some((p) => p.pid === h.pid))) return t.group;
    }
    return null;
  }

  nextProduction(w) {
    const g = this.game;
    if (w.freeHands <= 0) return null;
    const covered = g.coverage();
    for (const { ticket, item } of g.orders.pendingList()) {
      if ((covered[item.pid] || 0) > 0) {
        covered[item.pid]--;
        continue;
      }
      const p = g.products.get(item.pid);
      if (p.category === 'draft') {
        const tap = g.taps.find((t) => t.st.beerId === item.pid && !t.broken && t.level > 0);
        if (tap && g.glasses.clean > 0) return g.tasks.pour(tap);
      } else if (p.category === 'food') {
        const st = g.foodStations.find((s) => s.products().includes(item.pid));
        if (st && g.inventory.portions(item.pid) > 0) return g.tasks.food(st, item.pid);
      } else if (g.fridge.count(item.pid) > 0) return g.tasks.fridgeTake(item.pid);
    }
    return null;
  }
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
