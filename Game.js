// Game orchestrator: state, phases (prep / service / report), main loop, player actions, economy and progression.
import { EventBus } from './EventBus.js';
import { RNG } from './rng.js';
import { CONFIG, LAYOUT } from '../data/config.js';
import { BEERS } from '../data/beers.js';
import { buildProducts } from '../data/products.js';
import { CATALOG } from '../data/catalog.js';
import { CUSTOMER_TYPES } from '../data/customers.js';
import { UPGRADES, SUPPLIERS, PREMIUM_ONLY } from '../data/upgrades.js';
import { EVENTS } from '../data/events.js';
import { LEVELS, OBJECTIVES } from '../data/progression.js';
import { FIRST_NAMES_M, FIRST_NAMES_F, NICKNAMES, WEEKDAYS } from '../data/names.js';
import { World3D } from '../world/World3D.js';
import { BarLayout } from '../sim/Bar.js';
import { Tap, Fridge, FoodStation, Dishwasher } from '../sim/stations.js';
import { Inventory } from '../sim/Inventory.js';
import { OrderManager } from '../sim/Orders.js';
import { CustomerManager } from '../sim/Customers.js';
import { Worker } from '../sim/Worker.js';
import { createTasks } from '../sim/tasks.js';
import { StaffAI } from '../sim/StaffAI.js';
import { Director } from '../sim/Director.js';
import { randomLook } from '../world/models/character.js';
import { clamp } from '../engine/math.js';
import { Save } from './Save.js';
import { Ambient } from '../sim/Ambient.js';
import { QUALITY } from '../data/service.js';
import { line } from '../data/lines.js';

const START_WEEKDAY = 3; // day 1 is a Thursday

export function defaultState(barName = 'Chez Malo') {
  return {
    version: 1,
    barName,
    day: 1,
    money: CONFIG.startMoney,
    rep: CONFIG.startReputation,
    xp: 0,
    level: 1,
    stats: { drinks: 0, pints: 0, food: 0, planches: 0, nights: 0, bestSat: 0, events: 0, totalRevenue: 0, customers: 0, bestNight: 0 },
    taps: [{ beerId: 'kronfeld', level: 30 }],
    fridge: { products: ['coronado', 'kolaka'], stock: { coronado: 10, kolaka: 8 } },
    reserve: { kegs: { kronfeld: 2 }, bottles: { coronado: 12, kolaka: 12 }, food: { saucisson: 12 } },
    glasses: CONFIG.startGlasses,
    prices: {},
    menuOff: {},
    furniture: [
      { uid: 1, id: 'table_bancale', x: 2.5, z: 4.5, rot: 0 },
      { uid: 2, id: 'table_bancale', x: 6.5, z: 4.5, rot: 0 },
      { uid: 3, id: 'table_bancale', x: 4.5, z: 7.0, rot: 0 },
    ],
    wallItems: [{ uid: 4, id: 'affiche', wall: 'W', t: 4.2 }],
    upgrades: {},
    staff: [],
    regulars: [],
    objectives: { next: 3, active: ['serve10', 'night150', 'tables4'], done: [] },
    calendar: null,
    plannedEvent: null,
    tutorial: { done: false, seen: {} },
    uid: 100,
    history: [],
    settings: { music: 0.55, sfx: 0.8, quality: 'high' },
  };
}

export class Game {
  constructor(canvas, overlayEl) {
    this.bus = new EventBus();
    this.rng = new RNG((Date.now() ^ 0x5bd1e995) >>> 0);
    this.products = buildProducts();
    this.catalog = new Map(CATALOG.map((c) => [c.id, c]));
    this.upgradeDefs = new Map(UPGRADES.map((u) => [u.id, u]));
    this.data = { beers: BEERS, customerTypes: CUSTOMER_TYPES, catalog: CATALOG, upgrades: UPGRADES, events: EVENTS, suppliers: SUPPLIERS, levels: LEVELS };
    this.world = new World3D(this, canvas, overlayEl);
    this.bar = new BarLayout(this);
    this.inventory = new Inventory(this);
    this.orders = new OrderManager(this);
    this.customers = new CustomerManager(this);
    this.tasks = createTasks(this);
    this.staffAI = new StaffAI(this);
    this.director = new Director(this);
    this.ambient = new Ambient(this);
    this.save = new Save(this);
    this.phase = 'title';
    this.speed = 1;
    this.paused = false;
    this.clock = CONFIG.serviceStart;
    this.taps = [];
    this.foodStations = [];
    this.workers = [];
    this.claims = new Map();
    this.glasses = { clean: CONFIG.startGlasses, dirty: 0 };
    this.combo = { n: 0, fireUntil: 0 };
    this.rush = null;
    this.autoMini = false;
    this.simTime = 0;
    this.night = null;
    this.state = null;
    this.ui = null;
    this.audio = null;
    this._last = performance.now();
    this.world.rig.onTap = (x, y) => this.handleTap(x, y);
    this.world.rig.onHover = (x, y) => this.handleHover(x, y);
    this.world.rig.onRightTap = () => this.owner && this.phase === 'service' && this.owner.cancelAll();
    window.addEventListener('keydown', (e) => this.onKey(e));
    // pause automatically when the tab is hidden during service
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.phase === 'service' && !this.paused) {
        this.paused = true;
        this.bus.emit('speed', {});
      }
    });
  }

  // ======================================================== setup
  newGame(name) {
    const prev = this.state?.settings;
    this.state = defaultState(name || 'Chez Malo');
    if (prev) this.state.settings = { ...this.state.settings, ...prev };
    this._setup();
    this.director.planDay();
    this.bus.emit('newGame', {});
    this.enterPrep(true);
    this.save.write();
  }

  /** show a bar behind the title screen without starting a game */
  preview(st) {
    this.state = { ...defaultState(st?.barName), ...(st || {}) };
    this._setup();
    if (!this.state.calendar) this.director.planDay();
    this.phase = 'title';
  }

  loadGame(st) {
    const prev = this.state?.settings;
    this.state = { ...defaultState(st.barName), ...st };
    if (prev) this.state.settings = { ...this.state.settings, ...prev };
    this._setup();
    if (!this.state.calendar) this.director.planDay();
    this.enterPrep(false);
  }

  _setup() {
    const st = this.state;
    // clean previous
    for (const t of this.taps) t.dispose();
    for (const f of this.foodStations) f.dispose();
    for (const w of this.workers) w.dispose();
    this.customers.clearAll();
    this.taps = [];
    this.foodStations = [];
    this.workers = [];
    this.claims.clear();
    const size = this.roomSize();
    this.world.buildRoom(size.w, size.d);
    this.world.neon.refresh();
    if (!this.fridge) this.fridge = new Fridge(this);
    if (!this.dishwasher) this.dishwasher = new Dishwasher(this);
    this.dishwasher.reset();
    this.fridge.refresh();
    st.taps.forEach((_, i) => this.taps.push(new Tap(this, i)));
    this.foodStations.push(new FoodStation(this, 'board'));
    if (this.up('snack')) this.foodStations.push(new FoodStation(this, 'snack'));
    this.bar.rebuildAll();
    this.owner = new Worker(this, { role: 'owner', name: 'Vous', look: ownerLook(), pos: { x: 4.5, z: 1.0 } });
    this.workers.push(this.owner);
    for (const s of st.staff) this._spawnStaff(s);
    this.world.chalk.refresh();
    this.glasses = { clean: st.glasses, dirty: 0 };
    this.world.glassRack.setCount(this.glasses.clean);
    this.world.rig.goal.target = [size.w / 2, 0, size.d / 2 - 0.3];
    this.world.rig.target = [...this.world.rig.goal.target];
  }

  _spawnStaff(rec) {
    const w = new Worker(this, {
      role: rec.role, name: rec.name, rec, stats: { speed: rec.speed, service: rec.service }, look: rec.look,
      pos: rec.role === 'barman' ? { x: 5.5, z: 1.0 } : { x: 8.8, z: 2.9 },
    });
    this.workers.push(w);
    return w;
  }

  // ======================================================== queries
  roomSize() {
    const lvl = this.up('room');
    return LAYOUT.sizes[Math.min(lvl, LAYOUT.sizes.length - 1)];
  }
  level() {
    return this.state.level;
  }
  stars() {
    return Math.min(5, 1 + Math.floor((this.state.rep / 25) * 2) / 2);
  }
  starsExact() {
    return Math.min(5, 1 + this.state.rep / 25);
  }
  weekday(day = this.state.day) {
    return (day - 1 + START_WEEKDAY) % 7;
  }
  weekdayName(day) {
    return WEEKDAYS[this.weekday(day)];
  }
  up(id) {
    return this.state.upgrades[id] || 0;
  }
  upValue(id, def) {
    const n = this.up(id);
    if (!n) return def;
    const u = this.upgradeDefs.get(id);
    const t = u.tiers[Math.min(n, u.tiers.length) - 1];
    return t.value ?? def;
  }
  stoolCount() {
    return 2 + this.up('stools');
  }
  nextUid() {
    return ++this.state.uid;
  }
  rent() {
    return CONFIG.rent + (this.level() - 1) * 8 + [0, 25, 60][this.up('room')];
  }
  terraceOpen() {
    const w = this.director.weather().id;
    return w !== 'pluie' && w !== 'froid';
  }
  handsCapacity() {
    return this.upValue('tray', CONFIG.baseHands);
  }

  menuFoods() {
    const out = [];
    const off = this.state.menuOff;
    const lvl = this.level();
    const add = (id) => {
      const p = this.products.get(id);
      if (p && p.level <= lvl && !off[id] && !this.autoOff?.has(id)) out.push(p);
    };
    add('saucisson');
    if (this.up('snack')) {
      add('cacahuetes');
      add('olives');
    }
    if (this.up('planche_station')) add('planche');
    if (this.up('toaster')) add('croque');
    if (this.up('cafetiere')) add('cafe');
    return out;
  }
  menu() {
    const drinks = new Set();
    for (const t of this.state.taps) if (t.beerId) drinks.add(t.beerId);
    for (const p of this.state.fridge.products) if (!this.state.menuOff[p]) drinks.add(p);
    return { drinks: [...drinks], foods: this.menuFoods().map((p) => p.id) };
  }
  menuLines() {
    if (!this.state) return [];
    const lines = [];
    const seen = new Set();
    for (const t of this.state.taps) {
      if (!t.beerId || seen.has(t.beerId)) continue;
      seen.add(t.beerId);
      const p = this.products.get(t.beerId);
      lines.push({ name: p.name, price: this.fmtPrice(this.priceOf(p.id, true)) });
    }
    for (const id of this.state.fridge.products) {
      const p = this.products.get(id);
      if (p && lines.length < 7) lines.push({ name: p.short + (p.category === 'soft' ? '' : ' (bouteille)'), price: this.fmtPrice(this.priceOf(id, true)), color: '#cfe8ff' });
    }
    return lines;
  }
  basePrice(pid) {
    return this.state.prices[pid] ?? this.products.get(pid).basePrice;
  }
  priceOf(pid, ignoreEvent = false) {
    let p = this.basePrice(pid);
    if (!ignoreEvent && this.phase === 'service') {
      const ev = this.eventEffects();
      const cut = ev.priceCut;
      if (cut && this.products.get(pid).category === cut.category && this.clock >= cut.from && this.clock <= cut.to) p *= cut.mult;
    }
    return Math.round(p * 10) / 10;
  }
  fmtPrice(v) {
    return v.toFixed(2).replace('.', ',') + ' €';
  }
  fmtMoney(v) {
    const r = Math.round(v);
    return r.toLocaleString('fr-FR') + ' €';
  }
  priceLabel(pid) {
    const r = this.basePrice(pid) / this.products.get(pid).basePrice;
    if (r < 0.85) return { label: 'Bon marché', cls: 'good' };
    if (r <= 1.1) return { label: 'Correct', cls: 'ok' };
    if (r <= 1.3) return { label: 'Cher', cls: 'warn' };
    return { label: 'Abusé', cls: 'bad' };
  }
  activeEvent() {
    const pe = this.state.plannedEvent;
    if (pe && pe.day === this.state.day) return EVENTS.find((e) => e.id === pe.id) || null;
    return null;
  }
  eventActive(id) {
    return this.activeEvent()?.id === id;
  }
  eventEffects() {
    const ev = this.activeEvent();
    const e = ev ? { ...ev.effects } : {};
    if (ev?.id === 'match') {
      const fx = this.state.calendar?.fixtures?.[this.state.day];
      if (fx?.importance === 2) e.arrival = (e.arrival || 1) * 1.35;
    }
    return e;
  }
  styleMult(p) {
    const w = this.director.weather();
    const ev = this.eventEffects();
    let m = 1;
    const keys = [p.style, ...(p.tags || [])];
    if (p.category === 'soft') keys.push('soft');
    for (const k of keys) {
      if (w.styles[k]) m *= w.styles[k];
      if (ev.styles?.[k]) m *= ev.styles[k];
    }
    return m;
  }
  trendMult(pid) {
    const t = this.state.calendar?.trend;
    return t && t.pid === pid ? 2.3 : 1;
  }
  randomUnlockedBeer(seed) {
    const list = BEERS.filter((b) => b.level <= Math.max(2, this.level()));
    return list[(seed * 7) % list.length];
  }
  rngNames() {
    return this.rng.pick(this.rng.chance(0.5) ? FIRST_NAMES_F : FIRST_NAMES_M);
  }

  // coverage: how many of each product are already in hands / being produced
  coverage() {
    const cov = {};
    for (const w of this.workers) {
      for (const h of w.hands) cov[h.pid] = (cov[h.pid] || 0) + 1;
      const tasks = [...(w.current ? [w.current] : []), ...w.queue];
      for (const t of tasks) if ((t.kind === 'pour' || t.kind === 'fridgeTake' || t.kind === 'food') && t.pid) cov[t.pid] = (cov[t.pid] || 0) + 1;
    }
    return cov;
  }
  claim(key, w) {
    this.claims.set(key, w);
  }
  unclaim(key, w) {
    if (this.claims.get(key) === w) this.claims.delete(key);
  }
  isClaimed(key) {
    return this.claims.has(key);
  }

  // ======================================================== service quality, combos & rush
  /** tuning of the pint mini-game from the equipment */
  /** owner mini-games resolved automatically (tests, or the "Automatique" setting) */
  get autoService() {
    return this.autoMini || this.state?.settings?.assist === 2;
  }
  pourMods() {
    const cool = this.up('cooling'), prec = this.up('precision');
    const learn = (this.state.day === 1 ? 1.2 : this.state.day === 2 ? 1.1 : 1) * (this.state.settings?.assist === 1 ? 1.6 : 1);
    return {
      window: this.upValue('fastTap', 1) * learn,
      flow: cool ? 1.18 : 1,
      foam: (cool ? 0.9 : 1) * (prec ? 0.7 : 1),
      foamBand: prec ? 1.35 : 1,
    };
  }
  /** tuning of the other mini-games */
  serviceMods(kind) {
    const learn = (this.state.day === 1 ? 1.15 : 1) * (this.state.settings?.assist === 1 ? 1.5 : 1);
    const knife = this.up('knife'), kit = this.up('barkit');
    if (kind === 'cut') return { window: (knife ? 1.4 : 1) * learn, slow: knife ? 0.85 : 1 };
    if (kind === 'plank') return { time: knife ? 1.2 : 0 };
    if (kind === 'cap') return { window: (kit ? 1.55 : 1) * learn };
    if (kind === 'fill') return { window: (kit ? 1.45 : 1) * learn };
    return { window: learn };
  }
  rushActive() {
    return this.rush?.phase === 'live';
  }
  /** 0..1: how swamped the bar is right now */
  pressure() {
    return clamp(this.orders.pendingList().length / 8, 0, 1);
  }
  /** called for every item produced (mini-game or staff) */
  registerQuality(q, w, cat, n = 1) {
    const night = this.night;
    if (night) {
      const Q = (night.quality ||= { perfect: 0, good: 0, average: 0, bad: 0, catastrophe: 0 });
      Q[q] = (Q[q] || 0) + n;
      if (cat === 'draft' && q === 'perfect') night.perfectPints = (night.perfectPints || 0) + n;
      if (q === 'bad' || q === 'catastrophe') night.failed = (night.failed || 0) + n;
      const r = this.rush;
      if (r && r.phase === 'live') {
        if (q === 'perfect') r.stats.perfect += n;
        if (q === 'bad' || q === 'catastrophe') r.stats.failed += n;
      }
    }
    if (!w?.isOwner) return;
    const c = this.combo;
    if (q === 'perfect') {
      const before = c.n;
      c.n += n;
      if (night) night.bestCombo = Math.max(night.bestCombo || 0, c.n);
      this.state.stats.bestCombo = Math.max(this.state.stats.bestCombo || 0, c.n);
      if (Math.floor(c.n / 5) > Math.floor(before / 5)) this.comboMilestone(c.n);
      this.bus.emit('combo', { n: c.n, up: true });
    } else if (q === 'good') {
      this.bus.emit('combo', { n: c.n, up: false });
    } else {
      if (c.n >= 3) {
        this.world.overlay.float('Combo cassé !', [w.pos.x, 2.3, w.pos.z], 'fail', 1.3);
        this.bus.emit('comboBreak', { n: c.n });
      }
      c.n = 0;
      c.fireUntil = 0;
      this.bus.emit('combo', { n: 0 });
    }
  }
  comboMilestone(n) {
    const o = this.owner;
    this.combo.fireUntil = this.simTime + 16;
    this.world.effects.burst('confetti', [o.pos.x, 2.1, o.pos.z], 30);
    this.world.overlay.float(`COMBO ×${n} !`, [o.pos.x, 2.5, o.pos.z], 'perfect', 1.8);
    // the crowd applauds the artist
    const fans = this.customers.groups.filter((g) => g.state === 'round' || g.state === 'wantOrder');
    for (const g of this.rng.shuffle([...fans]).slice(0, 2)) g.members[0]?.say(line('perfectCombo'), 'happy');
    for (const g of fans) g.sat = Math.min(100, g.sat + 2);
    this.bus.emit('comboMilestone', { n });
  }
  comboLevel() {
    return this.combo.n;
  }
  /** temporary boost after a combo milestone: the owner moves and works faster */
  onFire() {
    return this.phase === 'service' && this.simTime < (this.combo.fireUntil || 0);
  }
  /** tip multiplier from the current combo */
  comboMult() {
    return 1 + Math.min(10, this.combo.n) * 0.04 + (this.onFire() ? 0.1 : 0);
  }
  /** quality used when mini-games are auto-played (tests / bots) */
  autoQuality() {
    if (!this.autoMini && this.state?.settings?.assist === 2) return 'good';
    const a = this.autoMini;
    if (typeof a === 'string' && QUALITY[a]) return a;
    return this.rng.weighted([{ id: 'perfect', w: 34 }, { id: 'good', w: 42 }, { id: 'average', w: 14 }, { id: 'bad', w: 8 }, { id: 'catastrophe', w: 2 }]).id;
  }

  // ======================================================== money

  earn(amount, tip, group, spot) {
    const st = this.state;
    st.money += amount + tip;
    if (this.night) {
      this.night.revenue += amount;
      this.night.tips += tip;
    }
    st.stats.totalRevenue += amount;
    const pos = group ? group.anchor : spot ? [spot.center.x, spot.topY + 0.6, spot.center.z] : [4, 2, 2];
    this.world.overlay.float('+' + this.fmtPrice(amount), pos, 'money');
    if (tip > 0.05) this.world.overlay.float('+' + this.fmtPrice(tip) + ' pourboire', [pos[0], pos[1] + 0.35, pos[2]], 'tip', 1.7);
    this.world.effects.burst('coins', [pos[0], pos[1] - 0.6, pos[2]]);
    this.world.register.kaching();
    this.bus.emit('money', { amount, tip });
  }
  spend(amount, reason) {
    this.state.money -= amount;
    if (this.night && this.phase === 'service') this.night.purchases += amount;
    else if (this.prepSpend) this.prepSpend[reason] = (this.prepSpend[reason] || 0) + amount;
    this.bus.emit('money', { amount: -amount });
  }

  toast(text, kind = 'info', icon) {
    this.bus.emit('toast', { text, kind, icon });
  }

  // ======================================================== player actions (purchases & configuration)
  buyStock(pid, supplierId, packs = null) {
    const sup = SUPPLIERS.find((s) => s.id === supplierId);
    const p = this.products.get(pid);
    if (!sup || !p) return false;
    if (sup.when === 'prep' && this.phase !== 'prep') return this.toast('Ce fournisseur ne livre qu’avant l’ouverture', 'warn');
    if (sup.id !== 'eclair' && PREMIUM_ONLY.includes(pid) !== !!sup.premium) return this.toast(sup.premium ? 'La Cave des Moines ne vend que des bières rares' : 'Bière rare : uniquement à la Cave des Moines', 'warn');
    const n = packs ?? sup.qty;
    const cost = this.packPrice(pid, sup.id) * n;
    if (this.state.money < cost) return this.toast('Pas assez d’argent', 'bad');
    const units = this.inventory.unitsFor(pid, n) + (this.pendingUnits || 0);
    if (units > this.inventory.free()) return this.toast('La réserve est pleine !', 'bad');
    this.spend(cost, 'stock');
    if (this.night) this.night.purchases += 0;
    if (sup.id === 'eclair' && this.phase === 'service') {
      this.night.express = (this.night.express || 0) + 1;
      this.pendingUnits = (this.pendingUnits || 0) + this.inventory.unitsFor(pid, n);
      this.deliveries.push({ pid, n, t: CONFIG.expressDelay, units: this.inventory.unitsFor(pid, n) });
      this.toast(`Livraison Éclair en route : ${p.short} (≈${CONFIG.expressDelay} s)`, 'info', 'bolt');
    } else {
      this.inventory.addPacks(pid, n);
      this.bus.emit('bought', { pid, n });
    }
    return true;
  }

  /** price of one pack from a supplier, contracts included */
  packPrice(pid, supplierId) {
    const sup = SUPPLIERS.find((s) => s.id === supplierId);
    const p = this.products.get(pid);
    let k = sup.priceMult;
    const c = this.state.contract;
    if (c && c.pid === pid && c.until >= this.state.day) k *= c.discount;
    return Math.round(p.packCost * k * 100) / 100;
  }

  // ---- brewery contracts
  contractOffers() {
    const st = this.state;
    const week = Math.floor((st.day - 1) / 7);
    if (st.contractOffers?.week === week) return st.contractOffers.list;
    const rng = new RNG(week * 7919 + 13);
    const pool = BEERS.filter((b) => b.serve === 'tap' && b.level <= Math.max(2, this.level()) && !PREMIUM_ONLY.includes(b.id));
    rng.shuffle(pool);
    const list = pool.slice(0, 2).map((b) => ({
      pid: b.id, discount: [0.8, 0.75, 0.85][rng.int(0, 2)], bonus: 60 + rng.int(0, 7) * 20, penalty: 80 + rng.int(0, 4) * 10, days: 7,
    }));
    st.contractOffers = { week, list };
    return list;
  }
  signContract(offer) {
    const st = this.state;
    if (this.level() < 2) return this.toast('Contrats disponibles au niveau 2', 'warn');
    if (st.contract && st.contract.until >= st.day) return this.toast('Vous avez déjà un contrat en cours', 'warn');
    st.contract = { ...offer, until: st.day + offer.days - 1 };
    st.money += offer.bonus;
    st.contractOffers.list = st.contractOffers.list.filter((o) => o.pid !== offer.pid);
    const p = this.products.get(offer.pid);
    this.toast(`Contrat signé avec ${p.name} : +${offer.bonus} € de prime, −${Math.round((1 - offer.discount) * 100)} % sur les fûts`, 'good', 'book');
    this.bus.emit('money', { amount: offer.bonus });
    this.save.write();
  }

  buyUpgrade(id) {
    const u = this.upgradeDefs.get(id);
    const n = this.up(id);
    const tier = u.repeatable ? u.tiers[0] : u.tiers[n];
    if (!tier) return;
    if (tier.level > this.level()) return this.toast(`Débloqué au niveau ${tier.level}`, 'warn');
    if (this.state.money < tier.price) return this.toast('Pas assez d’argent', 'bad');
    if (id === 'room' && this.customers.groups.length) return this.toast('Attendez la fermeture pour les travaux', 'warn');
    this.spend(tier.price, 'upgrades');
    this.state.upgrades[id] = n + 1;
    this.applyUpgrade(id);
    this.bus.emit('upgrade', { id });
    this.save.write();
    return true;
  }

  applyUpgrade(id) {
    switch (id) {
      case 'tap': {
        this.state.taps.push({ beerId: null, level: 0 });
        const t = new Tap(this, this.state.taps.length - 1);
        this.taps.push(t);
        this.toast('Nouvelle tireuse installée : choisissez une bière à brancher', 'good', 'tap');
        break;
      }
      case 'stools':
        this.bar.addStool();
        break;
      case 'glasses':
        this.state.glasses += 12;
        this.glasses.clean += 12;
        this.state.upgrades.glasses = 0;
        break;
      case 'snack':
        if (!this.foodStations.some((f) => f.kind === 'snack')) this.foodStations.push(new FoodStation(this, 'snack'));
        if (!this.inventory.portions('cacahuetes')) this.inventory.addPacks('cacahuetes', 1);
        break;
      case 'planche_station':
      case 'toaster':
      case 'cafetiere':
        if (id === 'cafetiere' && !this.inventory.portions('cafe')) this.inventory.addPacks('cafe', 1);
        for (const f of this.foodStations) f.refresh();
        break;
      case 'fridgeXL':
        this.fridge.refresh();
        break;
      case 'terrasse':
        this.bar.rebuildAll();
        this.toast('La terrasse est installée devant le bar !', 'good', 'sun');
        break;
      case 'room':
        this._setup();
        this.toast('Travaux terminés : la salle est plus grande !', 'good', 'expand');
        break;
      default:
    }
    this.world.chalk.refresh();
  }

  assignTap(i, beerId) {
    const t = this.state.taps[i];
    if (!t || t.beerId === beerId) return;
    if (this.phase === 'service') return this.toast('On ne change pas de bière en plein service', 'warn');
    // remaining beer of the old keg goes back in stock if more than half full
    if (t.beerId && t.level > 0) {
      const old = this.products.get(t.beerId);
      if (t.level >= old.kegSize * 0.5) this.inventory.addPacks(t.beerId, 1);
    }
    t.beerId = beerId;
    t.level = 0;
    if (beerId && this.inventory.kegs(beerId) > 0) {
      this.inventory.takeKeg(beerId);
      t.level = this.products.get(beerId).kegSize;
    }
    this.taps[i].refresh();
    this.world.chalk.refresh();
    this.bus.emit('tapsChanged', {});
  }

  setFridgeProducts(list) {
    const f = this.state.fridge;
    // removed products go back to the reserve
    for (const p of f.products) if (!list.includes(p) && f.stock[p]) {
      this.state.reserve.bottles[p] = (this.state.reserve.bottles[p] || 0) + f.stock[p];
      f.stock[p] = 0;
    }
    f.products = list;
    this.fridge.refresh();
    this.world.chalk.refresh();
  }

  /** prep phase helper: refill fridge & taps instantly from reserve (morning set-up is free) */
  morningRestock() {
    const f = this.state.fridge;
    for (const p of f.products) {
      const need = this.fridge.slotFor(p) - (f.stock[p] || 0);
      if (need > 0) f.stock[p] = (f.stock[p] || 0) + this.inventory.takeBottles(p, need);
    }
    for (const t of this.state.taps) {
      if (t.beerId && t.level <= 0 && this.inventory.kegs(t.beerId) > 0) {
        this.inventory.takeKeg(t.beerId);
        t.level = this.products.get(t.beerId).kegSize;
      }
    }
    this.fridge.refresh();
  }

  setPrice(pid, v) {
    const p = this.products.get(pid);
    v = clamp(Math.round(v * 2) / 2, Math.max(1, p.basePrice * 0.5), p.basePrice * 2.2);
    this.state.prices[pid] = v;
    this.world.chalk.refresh();
    this.bus.emit('prices', {});
  }

  planEvent(id) {
    const ev = EVENTS.find((e) => e.id === id);
    if (!ev) return;
    if (this.state.plannedEvent?.day === this.state.day) return this.toast('Un événement est déjà prévu ce soir', 'warn');
    if (ev.requires && !this.bar.hasTag(ev.requires)) return this.toast('Équipement manquant : ' + (this.catalog.get(ev.requires)?.name || ev.requires), 'warn');
    if (ev.fixture && !this.state.calendar.fixtures[this.state.day]) return this.toast('Pas de match ce soir', 'warn');
    if (this.state.money < ev.cost) return this.toast('Pas assez d’argent', 'bad');
    this.spend(ev.cost, 'event');
    this.state.plannedEvent = { id, day: this.state.day };
    this.state.stats.events++;
    this.bus.emit('eventPlanned', { ev });
    this.toast(`${ev.name} prévu(e) ce soir !`, 'good', ev.icon);
  }

  hireStaff(cand) {
    if (this.state.money < cand.salary) return this.toast('Pas assez d’argent pour la première paie', 'bad');
    if (this.state.staff.filter((s) => s.role === cand.role).length >= 2) return this.toast('Équipe complète pour ce poste', 'warn');
    const rec = { ...cand, id: this.nextUid(), xp: 0 };
    this.state.staff.push(rec);
    this._spawnStaff(rec);
    this.bus.emit('hired', { rec });
    this.toast(`${rec.name} rejoint l’équipe !`, 'good', 'users');
    this.save.write();
  }
  fireStaff(id) {
    const rec = this.state.staff.find((s) => s.id === id);
    if (!rec) return;
    this.state.staff = this.state.staff.filter((s) => s.id !== id);
    const w = this.workers.find((x) => x.rec === rec);
    if (w) {
      w.dispose();
      this.workers = this.workers.filter((x) => x !== w);
    }
    this.toast(`${rec.name} quitte le bar.`, 'info');
  }
  staffCandidates(role) {
    const key = role + this.state.day;
    if (this._cands?.key === key) return this._cands.list;
    const rng = new RNG(this.state.day * 977 + role.length * 31 + this.state.uid);
    const list = [];
    for (let i = 0; i < 3; i++) {
      const female = rng.chance(0.5);
      const name = rng.pick(female ? FIRST_NAMES_F : FIRST_NAMES_M);
      const speed = Math.round(rng.range(40, 92)), service = Math.round(rng.range(40, 92));
      const salary = Math.round(20 + (speed + service) * 0.2 + (role === 'barman' ? 10 : 0));
      const look = randomLook(rng, { female, topStyle: role === 'barman' ? 'apron' : 'shirt', hat: null });
      look.apron = role === 'barman' ? 0x2b2b2b : 0x7d1f2b;
      if (role === 'serveur') {
        look.topStyle = 'apron';
        look.top = 0xffffff;
      }
      list.push({ role, name, speed, service, salary, look, trait: rng.pick(['Toujours souriant', 'Ancien sprinteur', 'Un peu tête en l’air', 'Connaît tout le quartier', 'Jongle avec les verres', 'Très calme']) });
    }
    this._cands = { key, list };
    return list;
  }

  // ======================================================== phases
  enterPrep(first) {
    this.phase = 'prep';
    this.autoOff = null;
    this.morningRestock();
    this.clock = CONFIG.serviceStart - 60;
    this.prepSpend = { stock: 0, upgrades: 0, build: 0, event: 0 };
    this.bus.emit('phase', { phase: 'prep', first });
  }

  openBar() {
    if (this.phase !== 'prep') return;
    const st = this.state;
    if (!st.taps.some((t) => t.beerId)) return this.toast('Branchez au moins une bière sur une tireuse !', 'warn');
    // items without any stock are crossed off the menu for tonight
    this.autoOff = new Set();
    const crossed = [];
    for (const p of this.menuFoods()) if (this.inventory.portions(p.id) <= 0) {
      this.autoOff.add(p.id);
      crossed.push(p.short);
    }
    if (crossed.length) this.toast(`Rayé de l’ardoise ce soir (plus de stock) : ${crossed.join(', ')}`, 'warn', 'list');
    this.phase = 'service';
    this.clock = CONFIG.serviceStart;
    this.deliveries = [];
    this.pendingUnits = 0;
    this.glasses = { clean: st.glasses, dirty: 0 };
    this.dishwasher.reset();
    this.night = {
      revenue: 0, tips: 0, drinks: 0, pints: 0, served: 0, lost: 0, angry: 0, satSum: 0, satN: 0, purchases: 0,
      startMoney: st.money, prep: { ...this.prepSpend }, customers: 0, newRegulars: [], express: 0,
      kit: this.rng.pick([[0xd62828, 0xffffff], [0x1d3557, 0xffd166], [0x2a9d8f, 0xffffff]]),
    };
    this.combo = { n: 0, fireUntil: 0 };
    this.rush = null;
    this.director.startNight();
    this.speed = 1;
    this.paused = false;
    this.bus.emit('phase', { phase: 'service' });
    this.bus.emit('open', {});
  }

  endNight() {
    const st = this.state;
    const n = this.night;
    this.minigames?.abort();
    if (this.rush) this.director.endRush(true);
    this.rush = null;
    this.phase = 'report';
    // remaining deliveries arrive anyway
    for (const d of this.deliveries || []) this.inventory.addPacks(d.pid, d.n);
    this.deliveries = [];
    this.pendingUnits = 0;
    // costs
    const rent = this.rent();
    const elec = CONFIG.electricityBase + st.taps.length * CONFIG.electricityPerTap + (this.up('fridgeXL') ? 3 : 0) + this.bar.wallItems.filter((w) => ['tv', 'neon_mur'].includes(w.def.id)).length * 2 + this.bar.furniture.filter((f) => ['jukebox', 'arcade'].includes(f.def.id)).length * 2;
    const wages = st.staff.reduce((s, x) => s + x.salary, 0);
    let contractPenalty = 0;
    const c = st.contract;
    if (c && c.until >= st.day) {
      if (!st.taps.some((t) => t.beerId === c.pid)) {
        contractPenalty = c.penalty;
        this.toast(`Contrat non respecté : ${this.products.get(c.pid).short} n’était pas à la pression (−${c.penalty} €)`, 'bad', 'book');
      }
      if (c.until === st.day) this.toast(`Fin du contrat ${this.products.get(c.pid).short}.`, 'info', 'book');
    }
    st.money -= rent + elec + wages + contractPenalty;
    const avgSat = n.satN ? n.satSum / n.satN : 0;
    if (n.satN >= 4) st.stats.bestSat = Math.max(st.stats.bestSat || 0, Math.round(avgSat));
    st.stats.nights++;
    st.stats.bestNight = Math.max(st.stats.bestNight || 0, n.revenue);
    // event reputation bonus
    const ev = this.activeEvent();
    let repBonus = 0;
    if (ev && avgSat >= 55) repBonus += ev.effects.rep || 0;
    // word of mouth: a nice-looking bar slowly builds its reputation
    if (avgSat >= 50) {
      const sc = this.bar.scores();
      repBonus += Math.min(3, sc.decor * 0.07 + sc.ambiance * 0.05 + sc.fun * 0.03);
    }
    st.rep = clamp(st.rep + repBonus, 0, 100);
    const repDelta = st.rep - n.repStart;
    const report = {
      day: st.day, weekday: this.weekdayName(st.day), revenue: n.revenue, tips: n.tips,
      purchasesPrep: (n.prep.stock || 0), upgrades: (n.prep.upgrades || 0) + (n.prep.build || 0), eventCost: n.prep.event || 0, express: n.purchases,
      rent, elec, wages, contractPenalty, served: n.served, lost: n.lost, angry: n.angry, avgSat, drinks: n.drinks, pints: n.pints,
      repDelta, xpGain: n.xp || 0, newRegulars: n.newRegulars, customers: n.customers, event: ev?.name || null,
      quality: n.quality || null, perfectPints: n.perfectPints || 0, failed: n.failed || 0, bestCombo: n.bestCombo || 0, rushes: n.rushes || [],
    };
    report.profit = report.revenue + report.tips - report.purchasesPrep - report.upgrades - report.eventCost - report.express - rent - elec - wages - contractPenalty;
    st.history.push({ day: st.day, revenue: Math.round(n.revenue + n.tips), profit: Math.round(report.profit), sat: Math.round(avgSat), customers: n.customers });
    if (st.history.length > 30) st.history.shift();
    this.lastReport = report;
    // clean up the bar
    this.customers.clearAll();
    this.orders.clear();
    for (const s of this.bar.spots) {
      s.cleanUp();
      s.group = null;
      s.reserved = null;
    }
    for (const p of [...this.bar.puddles]) this.bar.removePuddle(p);
    for (const t of this.taps) t.broken = false;
    for (const w of this.workers) w.resetForNight(w.isOwner ? { x: 4.5, z: 1.0 } : null);
    this.claims.clear();
    this.dishwasher.reset();
    this.glasses = { clean: st.glasses, dirty: 0 };
    this.world.effects.clear();
    this.world.overlay.clearFloats();
    this.checkLevel();
    this.checkObjectives(true);
    this.bus.emit('phase', { phase: 'report', report });
  }

  nextDay() {
    const st = this.state;
    st.day++;
    if (st.plannedEvent && st.plannedEvent.day < st.day) st.plannedEvent = null;
    this.night = null;
    this.director.planDay();
    this.enterPrep(false);
    this.save.write();
  }

  // ======================================================== reputation / progression
  onGroupLeft(group, outcome) {
    const st = this.state;
    const n = this.night;
    const size = group.size;
    let delta = 0;
    const sat = clamp(group.sat, 0, 100);
    if (outcome === 'paid' || outcome === 'cash') delta = ((sat - 55) / 45) * 0.6 * size - (outcome === 'cash' ? 0.15 * size : 0);
    else if (outcome === 'angry') delta = -0.45 * size;
    else if (outcome === 'lost') delta = (this.activeEvent() ? -0.02 : -0.05) * size;
    else delta = -0.05 * size;
    if (group.critic) {
      delta *= 6;
      this.toast(delta >= 0 ? 'Le critique du Guide du Zinc a adoré ! Votre réputation grimpe.' : 'Le critique est reparti déçu… Ça va se savoir.', delta >= 0 ? 'good' : 'bad', 'book');
    }
    if (delta > 0) delta *= 1 - st.rep / 125;
    st.rep = clamp(st.rep + delta, 0, 100);
    if (n) {
      if (outcome === 'paid' || outcome === 'cash') {
        n.served++;
        n.satSum += sat * size;
        n.satN += size;
        n.customers += size;
        st.stats.customers += size;
        const xp = group.tab / 2 + Math.max(0, sat - 50) / 6 * size;
        n.xp = (n.xp || 0) + xp;
        st.xp += xp;
      } else if (outcome === 'lost') n.lost += size;
      else if (outcome === 'angry') {
        n.angry += size;
        n.customers += size;
      }
    }
    // regulars
    for (const m of group.members) {
      if (m.regular) {
        const r = m.regular;
        r.visits = (r.visits || 0) + 1;
        if (outcome === 'paid' && sat >= 68) r.loyalty = Math.min(5, r.loyalty + 1);
        else if (sat < 45 || outcome === 'angry') r.loyalty--;
        if (r.loyalty <= 0) {
          st.regulars = st.regulars.filter((x) => x !== r);
          this.toast(`${r.name} ne reviendra plus… Il faut mieux soigner ses habitués.`, 'bad', 'regular');
        }
      } else if (outcome === 'paid' && sat >= 78 && st.regulars.length < 6 + this.level() * 3 && (!n || n.newRegulars.length < 2)) {
        const chance = group.type.regularChance * 0.4 * (0.3 + (sat - 78) / 22);
        if (this.rng.chance(chance)) this.makeRegular(m, group);
      }
    }
    this.checkLevel();
    this.bus.emit('groupLeft', { group, outcome });
  }

  makeRegular(m, group) {
    const st = this.state;
    const fav = Object.entries(m.history).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!fav) return;
    const female = m.look.female;
    let name = this.rng.pick(female ? FIRST_NAMES_F : FIRST_NAMES_M);
    if (st.regulars.some((r) => r.name === name)) name += ' ' + 'BCDFGHJLMNPRT'[this.rng.int(0, 12)] + '.';
    const r = {
      id: this.nextUid(), name, type: group.type.id, look: m.look, favorite: fav, day: this.weekday(), hour: Math.round(this.clock / 15) * 15,
      loyalty: 2, visits: 1, since: st.day,
    };
    st.regulars.push(r);
    if (this.night) this.night.newRegulars.push(r);
    const p = this.products.get(fav);
    this.toast(`${name} devient ${female ? 'une habituée' : 'un habitué'} ! ${female ? 'Elle' : 'Il'} reviendra le ${this.weekdayName().toLowerCase()} pour sa ${p.short}.`, 'good', 'regular');
    this.bus.emit('newRegular', { regular: r });
  }

  checkLevel() {
    const st = this.state;
    const next = LEVELS.find((l) => l.level === st.level + 1);
    if (next && st.xp >= next.xp) {
      st.level = next.level;
      this.bus.emit('levelUp', { level: next });
      this.checkLevel();
    }
  }

  checkObjectives(endOfNight = false) {
    const o = this.state.objectives;
    let changed = false;
    for (const id of [...o.active]) {
      const def = OBJECTIVES.find((x) => x.id === id);
      if (!def) continue;
      const v = def.check(this);
      if (v >= def.target) {
        o.active = o.active.filter((x) => x !== id);
        o.done.push(id);
        this.state.money += def.reward;
        this.state.xp += Math.round(def.reward / 2);
        this.bus.emit('objective', { def });
        changed = true;
        while (o.next < OBJECTIVES.length && o.active.length < 3) {
          const nd = OBJECTIVES[o.next++];
          if (!o.done.includes(nd.id)) o.active.push(nd.id);
        }
      }
    }
    if (changed) this.checkLevel();
  }

  // ======================================================== input
  handleHover(x, y) {
    this.hoverXY = x < 0 ? null : { x, y };
  }

  handleTap(x, y) {
    if (this.ui?.handleWorldTap?.(x, y)) return;
    if (this.phase !== 'service') {
      const e = this.world.pick(x, y);
      if (e) this.ui?.inspect?.(e);
      return;
    }
    const e = this.world.pick(x, y);
    if (!e) return;
    this.clickEntity(e);
  }

  clickEntity(e) {
    const o = this.owner;
    const T = this.tasks;
    this.bus.emit('click', { entity: e });
    if (e.group && e.view && !e.role) return this.clickGroup(e.group);
    if (e === o) {
      if (o.queue.length || o.current) {
        o.cancelAll();
        this.toast('Actions annulées', 'info');
      }
      return;
    }
    if (e instanceof Worker) return this.toast(`${e.name} — vitesse ${e.stats.speed}, service ${e.stats.service}`, 'info', 'users');
    if (e.kind === 'table' || e.kind === 'counter') {
      if (e.group && e.group.state !== 'leaving') return this.clickGroup(e.group);
      if (e.isDirty) return o.enqueue(T.clear(e));
      return this.toast(`${e.label} : libre et propre`, 'info');
    }
    if (e instanceof Tap) {
      if (e.broken) return o.enqueue(T.fix(e));
      if (!e.beer) return this.toast('Aucune bière branchée (à régler avant l’ouverture)', 'warn');
      if (e.level <= 0) {
        if (this.inventory.kegs(e.st.beerId) <= 0) return this.toast(`Plus de fût de ${e.beer.short} ! Commandez en Livraison Éclair`, 'bad', 'keg');
        for (const t of T.changeKeg(e)) o.enqueue(t);
        return;
      }
      return o.enqueue(T.pour(e));
    }
    if (e instanceof Fridge) {
      const avail = e.products;
      const smart = T.smartPick(avail);
      if (smart) return o.enqueue(T.fridgeTake(smart));
      return this.ui?.showPicker('Frigo', avail.map((pid) => ({ pid, count: e.count(pid) })), (pid) => (pid === '__fill' ? T.fridgeFill().forEach((t) => o.enqueue(t)) : o.enqueue(T.fridgeTake(pid))), true);
    }
    if (e instanceof FoodStation) {
      const prods = e.products();
      if (!prods.length) return this.toast('Rien à préparer ici', 'info');
      const smart = T.smartPick(prods);
      if (smart) return o.enqueue(T.food(e, smart));
      if (prods.length === 1) return o.enqueue(T.food(e, prods[0]));
      return this.ui?.showPicker(e.label(), prods.map((pid) => ({ pid, count: this.inventory.portions(pid) })), (pid) => o.enqueue(T.food(e, pid)));
    }
    if (e instanceof Dishwasher) {
      if (o.dirtyCount) return o.enqueue(T.drop());
      return this.toast(`Lave-verres : ${e.washing ? e.washing + ' en lavage' : 'à l’arrêt'}${e.queue ? ', ' + e.queue + ' en attente' : ''} · ${this.glasses.clean} verres propres`, 'info', 'wash');
    }
    if (e.kind === 'puddle') return o.enqueue(T.mop(e));
  }

  /** queue everything needed to complete a ticket (up to hand capacity), then serve it */
  prepareTicket(ticket) {
    const o = this.owner;
    const T = this.tasks;
    const grp = ticket.group;
    if (this.phase !== 'service' && this.phase !== 'closing') return;
    if (grp.state !== 'round') return;
    const pend = ticket.pending();
    if (!pend.length) return;
    const cov = this.coverage();
    let slots = o.capacity - o.hands.length - o.queue.filter((t) => t.pid && ['pour', 'fridgeTake', 'food'].includes(t.kind)).length - (o.current?.pid ? 1 : 0);
    let queued = 0;
    const missing = [];
    for (const it of pend) {
      if ((cov[it.pid] || 0) > 0) {
        cov[it.pid]--;
        continue;
      }
      if (slots <= 0) break;
      const p = this.products.get(it.pid);
      let task = null;
      if (p.category === 'draft') {
        const tap = this.taps.find((t) => t.st.beerId === it.pid && !t.broken && t.level > 0) || this.taps.find((t) => t.st.beerId === it.pid);
        if (tap) task = tap.level > 0 && !tap.broken ? T.pour(tap) : null;
      } else if (p.category === 'food') {
        const st = this.foodStations.find((s) => s.products().includes(it.pid));
        if (st) task = T.food(st, it.pid);
      } else task = T.fridgeTake(it.pid);
      if (!task) {
        missing.push(p.short);
        continue;
      }
      if (!o.enqueue(task)) return;
      slots--;
      queued++;
    }
    if (missing.length) this.toast(`Impossible à préparer pour l’instant : ${missing.join(', ')}`, 'warn');
    if (queued || o.hands.some((h) => pend.some((p) => p.pid === h.pid))) o.enqueue(T.serve(grp));
  }

  clickGroup(group) {
    const o = this.owner;
    const T = this.tasks;
    if (this.phase !== 'service') return;
    switch (group.state) {
      case 'wantOrder':
        return o.enqueue(T.takeOrder(group));
      case 'round':
        if (group.pendingItems().length) return o.enqueue(T.serve(group));
        if (group.spots[0]?.isDirty) return o.enqueue(T.clear(group.spots[0]));
        return this.toast('Ils sont servis et boivent tranquillement', 'info');
      case 'wantBill':
        return o.enqueue(T.collect(group));
      case 'queue':
        return this.toast('Ils attendent une place libre…', 'info');
      case 'settling':
      case 'arriving':
        return this.toast('Ils s’installent et regardent la carte…', 'info');
      default:
    }
  }

  onKey(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (this.phase !== 'service') return;
    if (e.code === 'Space' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      this.togglePause();
    }
    if (e.key === '1') this.setSpeed(1);
    if (e.key === '2') this.setSpeed(2);
    if (e.key === '3') this.setSpeed(3);
    if (e.key === 'Escape' && this.owner) this.owner.cancelAll();
  }
  togglePause() {
    this.paused = !this.paused;
    this.bus.emit('speed', {});
  }
  setSpeed(s) {
    this.speed = s;
    this.paused = false;
    this.bus.emit('speed', {});
  }

  // ======================================================== loop
  start() {
    const loop = (now) => {
      const rdt = Math.min(0.05, (now - this._last) / 1000);
      this._last = now;
      try {
        this.update(rdt);
      } catch (err) {
        console.error(err);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update(rdt) {
    const live = this.phase === 'service' || this.phase === 'closing';
    // while the player is busy with a mini-game, the bar never runs faster than real time
    const spd = this.minigames?.active ? Math.min(this.speed, 1) * CONFIG.miniGameTimeScale : this.speed;
    const simDt = live ? (this.paused ? 0 : rdt * spd) : 0;
    if (simDt > 0) this.simulate(simDt);
    else if (this.phase === 'prep' || this.phase === 'title' || this.phase === 'report') this.idleWorld(rdt);
    this.minigames?.update(live && !this.paused ? rdt : 0);
    this.ambient.update(this.paused && this.phase === 'service' ? 0 : rdt * (this.phase === 'service' ? this.speed : 1));
    this.world.update(rdt);
    this.world.render(rdt);
    this.ui?.update(rdt);
    this.audio?.update(rdt);
  }

  idleWorld(dt) {
    // characters still breathe in prep mode
    for (const w of this.workers) w.view.update(dt, false);
  }

  simulate(dt) {
    // fixed sub-steps for stability at high speed
    const steps = Math.ceil(dt / 0.034);
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.step(h);
  }

  step(dt) {
    const st = this.state;
    this.simTime += dt;
    if (this.phase === 'service') {
      this.clock += dt * CONFIG.minutesPerSecond;
      if (this.night.repStart === undefined) this.night.repStart = st.rep;
      if (this.clock >= CONFIG.closing) {
        this.phase = 'closing';
        this.closingT = 0;
        this.bus.emit('closing', {});
      }
    } else if (this.phase === 'closing') {
      this.clock += dt * CONFIG.minutesPerSecond;
      this.closingT += dt;
      // last orders: everybody wants to pay
      for (const g of this.customers.groups) {
        if (g.state === 'wantOrder' || g.state === 'settling') g.askBill();
        if (g.state === 'queue' || g.state === 'arriving') g.leave('nothing');
      }
      if (this.closingT > 45) for (const g of this.customers.groups) if (g.state !== 'leaving') g.tab > 0 ? g.leaveCash() : g.leave('nothing');
      if (!this.customers.groups.length) return this.endNight();
    }
    this.director.update(dt);
    this.customers.update(dt);
    for (const w of this.workers) w.update(dt);
    for (const t of this.taps) t.update(dt);
    this.dishwasher.update(dt);
    // express deliveries
    for (let i = (this.deliveries?.length || 0) - 1; i >= 0; i--) {
      const d = this.deliveries[i];
      d.t -= dt;
      if (d.t <= 0) {
        this.deliveries.splice(i, 1);
        this.pendingUnits -= d.units;
        this.inventory.addPacks(d.pid, d.n);
        this.world.room.openDoor('reserve', 1.2);
        this.toast(`Livraison Éclair arrivée : ${this.products.get(d.pid).short} en réserve !`, 'good', 'bolt');
        this.bus.emit('delivery', { pid: d.pid });
      }
    }
    // puddles annoy nearby customers
    if (this.bar.puddles.length) {
      for (const g of this.customers.groups) {
        if (!g.spots.length || g.state === 'arriving' || g.state === 'queue') continue;
        const c = g.spots[0].center;
        if (this.bar.puddles.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < 2.2)) g.sat = Math.max(0, g.sat - 0.25 * dt);
      }
    }
    this.world.glassRack.setCount(this.glasses.clean);
    this._objT = (this._objT || 0) + dt;
    if (this._objT > 1) {
      this._objT = 0;
      this.checkObjectives();
    }
  }
}

function ownerLook() {
  return {
    female: false, skin: 0xedc19c, hair: 0x3d2516, hairStyle: 'short', top: 0xf3e2c0, topStyle: 'apron', apron: 0x7d1f2b,
    bottom: 0x2b3a55, shoes: 0x5a3a22, hat: null, glasses: false, beard: false, mustache: true, accessory: 'towel', build: 'normal', height: 1.04, age: 'adult',
  };
}
