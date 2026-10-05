// Reserve (back room) stock: kegs, bottles, food portions, with limited storage space.
export class Inventory {
  constructor(game) {
    this.game = game;
  }
  get st() {
    return this.game.state.reserve;
  }
  get capacity() {
    return this.game.upValue('reserve', 24);
  }
  kegs(id) {
    return this.st.kegs[id] || 0;
  }
  bottles(id) {
    return this.st.bottles[id] || 0;
  }
  portions(id) {
    return this.st.food[id] || 0;
  }
  /** storage units used */
  used() {
    let u = 0;
    const P = this.game.products;
    for (const [id, n] of Object.entries(this.st.kegs)) u += n * (P.get(id)?.storage ?? 2);
    for (const [id, n] of Object.entries(this.st.bottles)) u += Math.ceil(n / (P.get(id)?.kegSize || 12)) * (P.get(id)?.storage ?? 1);
    for (const [id, n] of Object.entries(this.st.food)) {
      const p = P.get(id);
      if (p) u += Math.ceil(n / p.kegSize) * p.storage;
    }
    return u;
  }
  free() {
    return this.capacity - this.used();
  }
  /** units needed to add `packs` packs of product */
  unitsFor(pid, packs) {
    const p = this.game.products.get(pid);
    if (p.category === 'draft') return packs * p.storage;
    const cur = p.category === 'food' ? this.portions(pid) : this.bottles(pid);
    const before = Math.ceil(cur / p.kegSize) * p.storage;
    const after = Math.ceil((cur + packs * p.kegSize) / p.kegSize) * p.storage;
    return after - before;
  }
  addPacks(pid, packs) {
    const p = this.game.products.get(pid);
    if (p.category === 'draft') this.st.kegs[pid] = this.kegs(pid) + packs;
    else if (p.category === 'food') this.st.food[pid] = this.portions(pid) + packs * p.kegSize;
    else this.st.bottles[pid] = this.bottles(pid) + packs * p.kegSize;
    this.game.bus.emit('stock', { pid });
  }
  takeKeg(id) {
    if (this.kegs(id) <= 0) return false;
    this.st.kegs[id]--;
    this.game.bus.emit('stock', { pid: id });
    return true;
  }
  takeBottles(id, n) {
    const k = Math.min(n, this.bottles(id));
    this.st.bottles[id] = this.bottles(id) - k;
    this.game.bus.emit('stock', { pid: id });
    return k;
  }
  takePortion(id) {
    if (this.portions(id) <= 0) return false;
    this.st.food[id]--;
    this.game.bus.emit('stock', { pid: id });
    return true;
  }
  /** total available servings of a product (station + reserve) */
  available(pid) {
    const g = this.game;
    const p = g.products.get(pid);
    if (!p) return 0;
    if (p.category === 'draft') {
      let n = this.kegs(pid) * p.kegSize;
      for (const t of g.taps) if (t.st.beerId === pid && !t.broken) n += t.level;
      return n;
    }
    if (p.category === 'food') return this.portions(pid);
    return this.bottles(pid) + (g.fridge?.count(pid) || 0);
  }
  /** servings immediately ready (no restock trip needed) */
  ready(pid) {
    const g = this.game;
    const p = g.products.get(pid);
    if (!p) return 0;
    if (p.category === 'draft') return g.taps.filter((t) => t.st.beerId === pid && !t.broken).reduce((s, t) => s + t.level, 0);
    if (p.category === 'food') return this.portions(pid);
    return g.fridge?.count(pid) || 0;
  }
}
