// Bar stations: taps, fridge, food board, snack jar, dishwasher. Logic + binding to their 3D views.
import { TapView, FridgeView, BoardView, SnackView, DishwasherView } from '../world/models/bar.js';
import { LAYOUT, CONFIG } from '../data/config.js';

const L = LAYOUT;
const AZ = L.staffAccessZ;

export class Tap {
  constructor(game, index) {
    this.game = game;
    this.index = index;
    this.kind = 'tap';
    this.x = L.tapSlots[index];
    this.view = new TapView(this.x);
    game.world.fixtures.add(this.view.node);
    this.broken = false;
    this.pickPriority = 0.3;
    this.refresh();
    game.world.addPickable(this);
  }
  get st() {
    return this.game.state.taps[this.index];
  }
  get beer() {
    return this.st.beerId ? this.game.products.get(this.st.beerId) : null;
  }
  get level() {
    return this.st.level;
  }
  set level(v) {
    this.st.level = v;
  }
  get empty() {
    return !this.beer || this.st.level <= 0;
  }
  label() {
    return `Tireuse ${this.index + 1}`;
  }
  refresh() {
    this.view.setBeer(this.beer);
  }
  access() {
    return { x: this.x, z: AZ, face: 0 };
  }
  pickBox() {
    return [this.x - 0.2, L.counter.top - 0.1, 1.35, this.x + 0.2, L.counter.top + 0.8, 1.85];
  }
  update(dt) {
    this.view.update(dt, { broken: this.broken, empty: this.beer && this.st.level <= 0 });
  }
  dispose() {
    this.view.node.removeFromParent();
    this.game.world.removePickable(this);
  }
}

export class Fridge {
  constructor(game) {
    this.game = game;
    this.kind = 'fridge';
    this.view = new FridgeView();
    game.world.fixtures.add(this.view.node);
    this.pickPriority = 0.2;
    game.world.addPickable(this);
    this.refresh();
  }
  get st() {
    return this.game.state.fridge;
  }
  get capacity() {
    return this.game.upValue('fridgeXL', 24);
  }
  get products() {
    return this.st.products;
  }
  count(pid) {
    return this.st.stock[pid] || 0;
  }
  total() {
    return this.products.reduce((s, p) => s + this.count(p), 0);
  }
  /** per-product slot share */
  slotFor(pid) {
    const n = Math.max(1, this.products.length);
    return Math.floor(this.capacity / n);
  }
  take(pid) {
    if (this.count(pid) <= 0) return false;
    this.st.stock[pid]--;
    this.refresh();
    return true;
  }
  label() {
    return 'Frigo';
  }
  refresh() {
    this.view.setStock(this.products.map((id) => ({ id, count: this.count(id) })), this.capacity, this.game.products);
  }
  access() {
    return { x: L.fridge.x, z: AZ - 0.1, face: Math.PI };
  }
  pickBox() {
    const x = L.fridge.x, w = L.fridge.w;
    return [x - w / 2, 0, 0, x + w / 2, 2.0, 0.7];
  }
  update() {}
}

export class FoodStation {
  /** kind: 'board' (saucisson, planche, croque) | 'snack' (cacahuetes, olives) */
  constructor(game, kind) {
    this.game = game;
    this.kind = kind;
    this.view = kind === 'board' ? new BoardView() : new SnackView();
    game.world.fixtures.add(this.view.node);
    this.pickPriority = 0.25;
    game.world.addPickable(this);
    this.refresh();
  }
  get x() {
    return this.kind === 'board' ? L.board.x : L.snack.x;
  }
  products() {
    return this.game.menuFoods().filter((p) => p.station === this.kind).map((p) => p.id);
  }
  label() {
    return this.kind === 'board' ? 'Planche à découper' : 'Bocal à grignotages';
  }
  refresh() {
    const inv = this.game.inventory;
    if (this.kind === 'board') {
      this.view.setStock(Math.ceil(inv.portions('saucisson') / 6));
      this.view.setExtras(!!this.game.up('planche_station'), !!this.game.up('toaster'), !!this.game.up('cafetiere'));
    } else {
      this.view.setStock(inv.portions('cacahuetes'), 20, this.game.level() >= 2);
    }
  }
  access() {
    return { x: this.x, z: AZ - 0.1, face: Math.PI };
  }
  pickBox() {
    return [this.x - 0.45, 0.9, 0.0, this.x + 0.45, 2.0, 0.6];
  }
  update() {}
  dispose() {
    this.view.node.removeFromParent();
    this.game.world.removePickable(this);
  }
}

export class Dishwasher {
  constructor(game) {
    this.game = game;
    this.kind = 'dishwasher';
    this.view = new DishwasherView();
    game.world.fixtures.add(this.view.node);
    this.queue = 0; // dirty glasses waiting
    this.washing = 0; // glasses in the current cycle
    this.timer = 0;
    this.pickPriority = 0.1;
    game.world.addPickable(this);
  }
  get cap() {
    return this.game.upValue('dishwasher', { time: CONFIG.washTime, cap: CONFIG.washCapacity }).cap;
  }
  get time() {
    return this.game.upValue('dishwasher', { time: CONFIG.washTime, cap: CONFIG.washCapacity }).time;
  }
  label() {
    return 'Lave-verres';
  }
  access() {
    return { x: L.dishwasher.x, z: AZ, face: 0 };
  }
  pickBox() {
    const x = L.dishwasher.x;
    return [x - 0.4, 0, 1.3, x + 0.4, 1.3, 1.75];
  }
  add(n) {
    this.queue += n;
  }
  reset() {
    this.queue = 0;
    this.washing = 0;
    this.timer = 0;
  }
  update(dt) {
    if (this.washing > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.game.glasses.clean += this.washing;
        this.game.bus.emit('washed', { n: this.washing });
        this.washing = 0;
      }
    }
    if (this.washing === 0 && this.queue > 0) {
      this.washing = Math.min(this.cap, this.queue);
      this.queue -= this.washing;
      this.timer = this.time;
      this.game.bus.emit('washStart', {});
    }
    this.view.setDirty(this.queue);
    this.view.update(dt, this.washing > 0);
  }
}
