// Physical bar layout: navigation grid, furniture & seats (spots), stools, wall items, decor scores, placement rules.
import { NavGrid, FREE, BLOCK, STAFF, OUTSIDE } from '../world/NavGrid.js';
import { LAYOUT } from '../data/config.js';
import { buildItemModel, stoolModel, parasolModel, planterModel } from '../world/models/furniture.js';
import { Mesh } from '../engine/scene.js';
import { MATS } from '../world/materials.js';
import { makeDirtyPile, makeCoinStack } from '../world/models/props.js';
import { Node, Decal } from '../engine/scene.js';

const L = LAYOUT;
let SPOT_ID = 1;

export class Spot {
  constructor(bar, kind, opts) {
    this.id = SPOT_ID++;
    this.bar = bar;
    this.kind = kind; // 'table' | 'counter'
    this.seats = opts.seats; // [{x,z,face,pose,seatY,approach:{x,z}, item:[x,y,z]}]
    this.center = opts.center;
    this.topY = opts.topY;
    this.furniture = opts.furniture || null;
    this.stoolIndex = opts.stoolIndex ?? null;
    this.comfort = opts.comfort || 0;
    this.group = null;
    this.reserved = null;
    this.dirty = { glasses: 0, bottles: 0, plates: 0 };
    this.cash = 0; // money left on the table
    this.label = '';
    this.pickPriority = 0;
    this.node = new Node('spotFx');
    bar.game.world.dynamic.add(this.node);
    this.pile = null;
    this.coins = null;
  }
  get isDirty() {
    return this.dirty.glasses + this.dirty.bottles + this.dirty.plates > 0 || this.cash > 0;
  }
  get free() {
    return !this.group && !this.reserved;
  }
  addDirty(kind, n = 1) {
    this.dirty[kind] += n;
    this.refreshDirt();
  }
  cleanUp() {
    const d = { ...this.dirty, cash: this.cash };
    this.dirty = { glasses: 0, bottles: 0, plates: 0 };
    this.cash = 0;
    this.refreshDirt();
    return d;
  }
  refreshDirt() {
    if (this.pile) this.node.remove(this.pile);
    this.pile = null;
    const n = this.dirty.glasses + this.dirty.bottles + this.dirty.plates;
    if (n > 0 && !this.group) {
      this.pile = makeDirtyPile(Math.min(6, n), this.id);
      this.pile.position = [this.center.x, this.topY, this.center.z];
      this.node.add(this.pile);
    }
    if (this.coins) this.node.remove(this.coins);
    this.coins = null;
    if (this.cash > 0) {
      this.coins = makeCoinStack();
      this.coins.position = [this.center.x + 0.12, this.topY, this.center.z - 0.1];
      this.node.add(this.coins);
    }
  }
  /** points where a worker can stand to interact */
  workerSpot(from) {
    if (this.kind === 'counter') return { x: this.seats[0].x, z: L.staffAccessZ, face: 0 };
    const ring = this.ring || [];
    let best = null, bd = Infinity;
    for (const p of ring) {
      const d = Math.hypot(p.x - from.x, p.z - from.z) + (this.bar.nav.walkableAt(p.x, p.z, true) ? 0 : 99);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    const c = best || this.center;
    return { x: c.x, z: c.z, face: Math.atan2(this.center.x - c.x, this.center.z - c.z) };
  }
  pickBox() {
    if (this.kind === 'counter') {
      const s = this.seats[0];
      return [s.x - 0.35, 0, s.z - 0.6, s.x + 0.35, L.counter.top + 0.2, s.z + 0.3];
    }
    const f = this.furniture;
    const hw = f.wCells * 0.25, hd = f.dCells * 0.25;
    return [this.center.x - hw, 0, this.center.z - hd, this.center.x + hw, this.topY + 0.25, this.center.z + hd];
  }
  dispose() {
    this.node.removeFromParent();
  }
}

export class BarLayout {
  constructor(game) {
    this.game = game;
    this.spots = [];
    this.furniture = []; // placed floor items {uid, def, x, z, rot, node, spot}
    this.wallItems = []; // {uid, def, wall, t, node}
    this.stools = [];
    this.puddles = [];
    this.nav = null;
  }

  get size() {
    return this.game.roomSize();
  }

  /** rebuild everything from game.state (after load / expansion) */
  rebuildAll() {
    for (const f of this.furniture) this._disposeItem(f);
    for (const w of this.wallItems) w.node.removeFromParent();
    for (const s of this.stools) s.node.removeFromParent();
    for (const s of this.spots) s.dispose();
    for (const t of this.terrace || []) if (t.spot) this.game.world.removePickable(t.spot);
    this.furniture = [];
    this.wallItems = [];
    this.stools = [];
    this.spots = [];
    const st = this.game.state;
    for (const f of st.furniture) this._spawnItem(f);
    for (const w of st.wallItems) this._spawnWall(w);
    this._spawnStools();
    this._spawnTerrace();
    this.rebuildNav();
    this.relabel();
  }

  /** fixed outdoor tables bought with the "terrasse" upgrade */
  _spawnTerrace() {
    for (const t of this.terrace || []) t.node.removeFromParent();
    this.terrace = [];
    if (!this.game.up('terrasse')) return;
    const { d } = this.size;
    const def = this.game.catalog.get('table_bistrot');
    const z = d + 2.0;
    [2.0, 4.6, 7.2].forEach((x, i) => {
      const rec = { uid: -100 - i, id: 'table_bistrot', x, z, rot: 0 };
      const item = this._spawnItem(rec, true);
      const par = new Mesh(parasolModel(i % 2 ? 0x1f6f8b : 0xc8102e), MATS.vc);
      par.outline = 0.008;
      par.position = [0, 0, 0];
      item.node.add(par);
      item.spot.outdoor = true;
      item.spot.comfort = def.comfort;
      this.terrace.push(item);
    });
    for (const x of [0.4, 8.6]) {
      const p = new Mesh(planterModel(), MATS.vc);
      p.position = [x, 0, d + 2.0];
      p.rotation[1] = Math.PI / 2;
      p.outline = 0.008;
      this.game.world.dynamic.add(p);
      this.terrace.push({ node: p, planter: true, x, z: d + 2.0 });
    }
  }

  rebuildNav() {
    const { w, d } = this.size;
    const ox = -3, oz = -0.5;
    const cols = Math.ceil((w + 6) / L.cell);
    const rows = Math.ceil((d + 4.5) / L.cell);
    const nav = new NavGrid(ox, oz, cols, rows, L.cell);
    // interior free
    nav.fillRect(0, 0, w, d, FREE);
    // sidewalk outside (beyond the front wall thickness)
    nav.fillRect(-3, d + 0.5, w + 3, d + 3.5, OUTSIDE);
    // door opening through the front wall
    nav.fillRect(L.door.x0, d, L.door.x1, d + 0.5, FREE);
    // back bar & fridge
    nav.fillRect(L.backBar.x0, L.backBar.z0, L.backBar.x1, L.backBar.z1, BLOCK);
    // staff zone
    nav.fillRect(L.staff.x0, L.staff.z0, L.staff.x1, L.staff.z1, STAFF);
    // counter
    nav.fillRect(L.counter.x0, L.counter.z0, L.counter.x1, L.counter.z1, BLOCK);
    nav.fillRect(L.flap.x0, L.counter.z0, L.flap.x1, L.counter.z1, STAFF);
    nav.fillRect(L.flapL.x0, L.counter.z0, L.flapL.x1, L.counter.z1, STAFF);
    nav.fillRect(L.sideBlock.x0, L.sideBlock.z0, L.sideBlock.x1, L.sideBlock.z1, BLOCK);
    // corner behind the side block: wall-side area (x 9.5..w, z 0..0.5) stays free for WC door
    // stools
    for (const s of this.stools) nav.fillRect(s.x - 0.25, L.stoolZ - 0.25, s.x + 0.25, L.stoolZ + 0.25, BLOCK);
    // terrace
    for (const t of this.terrace || []) {
      if (t.planter) nav.fillRect(t.x - 0.25, t.z - 0.5, t.x + 0.25, t.z + 0.5, BLOCK);
      else {
        const r = this.itemRect(t.def, t.x, t.z, t.rot);
        nav.fillRect(r.x0, r.z0, r.x1, r.z1, BLOCK);
      }
    }
    // furniture
    for (const f of this.furniture) {
      const r = this.itemRect(f.def, f.x, f.z, f.rot);
      nav.fillRect(r.x0, r.z0, r.x1, r.z1, BLOCK);
    }
    // puddles do not block
    this.nav = nav;
    // rings for tables
    for (const s of this.spots) if (s.kind === 'table') s.ring = this._ring(s.furniture);
  }

  itemRect(def, x, z, rot) {
    const [fw, fd] = def.footprint;
    const w = (rot % 2 ? fd : fw) * L.cell, d = (rot % 2 ? fw : fd) * L.cell;
    return { x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, w, d };
  }

  _ring(f) {
    const r = this.itemRect(f.def, f.x, f.z, f.rot);
    const pts = [];
    const c = L.cell;
    for (let x = r.x0 + c / 2; x < r.x1; x += c) {
      pts.push({ x, z: r.z0 - c / 2 }, { x, z: r.z1 + c / 2 });
    }
    for (let z = r.z0 + c / 2; z < r.z1; z += c) {
      pts.push({ x: r.x0 - c / 2, z }, { x: r.x1 + c / 2, z });
    }
    return pts.filter((p) => this.nav.walkableAt(p.x, p.z, false));
  }

  // ------------------------------------------------ floor items
  _spawnItem(f, fixed = false) {
    const def = this.game.catalog.get(f.id);
    if (!def) return;
    const node = buildItemModel(def, {
      posterBeer: () => this.game.randomUnlockedBeer(f.uid),
      seed: f.uid,
      tvMode: () => (this.game.eventActive('match') ? 'match' : 'clips'),
    });
    node.position = [f.x, 0, f.z];
    node.rotation[1] = (f.rot * Math.PI) / 2;
    this.game.world.dynamic.add(node);
    const item = { uid: f.uid, def, x: f.x, z: f.z, rot: f.rot, node, spot: null, wCells: f.rot % 2 ? def.footprint[1] : def.footprint[0], dCells: f.rot % 2 ? def.footprint[0] : def.footprint[1] };
    item.meshes = [];
    node.traverse((n) => n.isMesh && item.meshes.push(n));
    if (node.update) this.game.world.updaters.add((item._upd = node.update));
    if (def.seats) {
      const th = (f.rot * Math.PI) / 2;
      const c = Math.cos(th), s = Math.sin(th);
      const seats = def.seats.map((sd) => {
        const lx = sd.x, lz = sd.z;
        const wx = f.x + lx * c + lz * s, wz = f.z - lx * s + lz * c;
        let ax, az;
        if (def.approach === 'sides') {
          const alx = Math.sign(lx) * (def.footprint[0] * 0.25 + 0.3), alz = lz;
          ax = f.x + alx * c + alz * s;
          az = f.z - alx * s + alz * c;
        } else {
          const dx = wx - f.x, dz = wz - f.z, l = Math.hypot(dx, dz) || 1;
          ax = wx + (dx / l) * 0.62;
          az = wz + (dz / l) * 0.62;
        }
        const ix = wx + (f.x - wx) * 0.42, iz = wz + (f.z - wz) * 0.42;
        return { x: wx, z: wz, face: sd.face + th, pose: sd.pose || 'sit', seatY: sd.pose === 'stool' ? 0.76 : def.model === 'booth' ? 0.52 : 0.48, approach: { x: ax, z: az }, item: [ix, node.tableTop || 0.78, iz] };
      });
      const spot = new Spot(this, 'table', { seats, center: { x: f.x, z: f.z }, topY: node.tableTop || 0.78, furniture: item, comfort: def.comfort || 0 });
      item.spot = spot;
      this.spots.push(spot);
      this.game.world.addPickable(spot);
    } else {
      item.pickBox = () => {
        const r = this.itemRect(def, item.x, item.z, item.rot);
        return [r.x0, 0, r.z0, r.x1, 1.4, r.z1];
      };
    }
    if (fixed) item.fixed = true;
    else this.furniture.push(item);
    return item;
  }

  _disposeItem(item) {
    item.node.removeFromParent();
    if (item._upd) this.game.world.updaters.delete(item._upd);
    if (item.spot) {
      this.game.world.removePickable(item.spot);
      item.spot.dispose();
      this.spots = this.spots.filter((s) => s !== item.spot);
    }
  }

  _spawnWall(w) {
    const def = this.game.catalog.get(w.id);
    if (!def) return;
    const node = buildItemModel(def, {
      posterBeer: () => this.game.randomUnlockedBeer(w.uid),
      seed: w.uid,
      tvMode: () => (this.game.eventActive('match') ? 'match' : 'clips'),
    });
    node.position = [w.t, def.y, 0.0];
    const decor = this.game.world.room.wallDecor[w.wall];
    decor.add(node);
    const item = { uid: w.uid, def, wall: w.wall, t: w.t, node };
    if (node.update) this.game.world.updaters.add((item._upd = node.update));
    this.wallItems.push(item);
    return item;
  }

  _spawnStools() {
    const n = this.game.stoolCount();
    for (let i = 0; i < n && i < L.stoolSlots.length; i++) {
      const x = L.stoolSlots[i];
      const node = stoolModel();
      node.position = [x, 0, L.stoolZ];
      this.game.world.dynamic.add(node);
      const seat = { x, z: L.stoolZ, face: Math.PI, pose: 'stool', seatY: 0.78, approach: { x, z: L.stoolZ + 0.62 }, item: [x, L.counter.top, 1.86] };
      const spot = new Spot(this, 'counter', { seats: [seat], center: { x, z: 1.86 }, topY: L.counter.top, stoolIndex: i, comfort: 1 });
      this.spots.push(spot);
      this.game.world.addPickable(spot);
      this.stools.push({ x, node, spot });
    }
  }

  addStool() {
    const i = this.stools.length;
    if (i >= L.stoolSlots.length) return;
    const x = L.stoolSlots[i];
    const node = stoolModel();
    node.position = [x, 0, L.stoolZ];
    this.game.world.dynamic.add(node);
    const seat = { x, z: L.stoolZ, face: Math.PI, pose: 'stool', seatY: 0.78, approach: { x, z: L.stoolZ + 0.62 }, item: [x, L.counter.top, 1.86] };
    const spot = new Spot(this, 'counter', { seats: [seat], center: { x, z: 1.86 }, topY: L.counter.top, stoolIndex: i, comfort: 1 });
    this.spots.push(spot);
    this.game.world.addPickable(spot);
    this.stools.push({ x, node, spot });
    this.rebuildNav();
    this.relabel();
  }

  relabel() {
    let t = 1;
    const tables = this.spots.filter((s) => s.kind === 'table' && !s.outdoor).sort((a, b) => a.center.z - b.center.z || a.center.x - b.center.x);
    for (const s of tables) s.label = 'Table ' + t++;
    let k = 1;
    for (const s of this.spots.filter((x) => x.outdoor)) s.label = 'Terrasse ' + k++;
    for (const s of this.spots) if (s.kind === 'counter') s.label = 'Comptoir';
  }

  tableCount() {
    return this.furniture.filter((f) => f.def.seats).length;
  }
  seatCount() {
    return this.spots.reduce((n, s) => n + s.seats.length, 0);
  }
  counterSpots() {
    return this.spots.filter((s) => s.kind === 'counter').sort((a, b) => a.stoolIndex - b.stoolIndex);
  }

  /** find seating for a group of n */
  findSeating(n, preferCounter, rng) {
    const clean = (s) => !s.isDirty;
    // counter: adjacent stools
    const counter = this.counterSpots();
    const counterPick = () => {
      if (n > 2) return null;
      const runs = [];
      for (let i = 0; i + n <= counter.length; i++) {
        const run = counter.slice(i, i + n);
        if (run.every((s) => s.free && s.stoolIndex === run[0].stoolIndex + run.indexOf(s))) runs.push(run);
      }
      if (!runs.length) return null;
      const cleanRuns = runs.filter((r) => r.every(clean));
      const pool = cleanRuns.length ? cleanRuns : runs;
      return pool[Math.floor(rng.next() * pool.length)];
    };
    const terraceOpen = this.game.terraceOpen();
    const hot = this.game.director.weather().id === 'chaud';
    const tablePick = () => {
      const cands = this.spots.filter((s) => s.kind === 'table' && s.free && s.seats.length >= n && (!s.outdoor || terraceOpen));
      if (!cands.length) return null;
      // prefer clean, then (when it's hot) outside, then smallest fitting
      cands.sort((a, b) => (a.isDirty - b.isDirty) || (hot ? !!b.outdoor - !!a.outdoor : 0) || (a.seats.length - b.seats.length) || (rng.next() - 0.5));
      return [cands[0]];
    };
    if (preferCounter) return counterPick() || tablePick();
    return tablePick() || counterPick();
  }

  // ------------------------------------------------ decor scores
  scores() {
    let decor = 0, fun = 0, ambiance = 0;
    const attracts = {};
    const all = [...this.furniture.map((f) => f.def), ...this.wallItems.map((w) => w.def)];
    const counts = {};
    for (const d of all) {
      counts[d.id] = (counts[d.id] || 0) + 1;
      const dim = Math.pow(0.75, counts[d.id] - 1); // diminishing returns for duplicates
      decor += (d.decor || 0) * dim;
      fun += (d.fun || 0) * dim;
      ambiance += (d.ambiance || 0) * dim;
      if (d.attracts) for (const [k, v] of Object.entries(d.attracts)) attracts[k] = Math.max(attracts[k] || 1, v);
    }
    if (this.game.up('sign')) decor += 2;
    return { decor, fun, ambiance, attracts };
  }
  hasTag(tag) {
    return this.wallItems.some((w) => w.def.tag === tag || w.def.id === tag) || this.furniture.some((f) => f.def.id === tag);
  }

  // ------------------------------------------------ placement
  canPlace(def, x, z, rot, ignoreUid = null) {
    const { w, d } = this.size;
    const r = this.itemRect(def, x, z, rot);
    if (r.x0 < 0 - 1e-6 || r.z0 < 0 || r.x1 > w + 1e-6 || r.z1 > d + 1e-6) return 'Hors de la salle';
    // keep the area in front of the counter (stool row + aisle) clear
    if (r.z0 < L.counter.z1 + 1.0 && r.x0 < L.flap.x1 + 0.5) return 'Laissez le comptoir accessible';
    if (r.z0 < L.sideBlock.z1 && r.x0 < L.sideBlock.x1) return 'Zone réservée au bar';
    // door clearance
    if (r.z1 > d - 1.5 && r.x1 > L.door.x0 - 0.5 && r.x0 < L.door.x1 + 0.5) return 'Ça bloque l’entrée';
    // WC door clearance
    if (r.z0 < 1.2 && r.x1 > L.wcDoor.x0 - 0.3 && r.x0 < L.wcDoor.x1 + 0.3) return 'Ça bloque les toilettes';
    for (const f of this.furniture) {
      if (f.uid === ignoreUid) continue;
      const o = this.itemRect(f.def, f.x, f.z, f.rot);
      if (r.x0 < o.x1 - 1e-6 && r.x1 > o.x0 + 1e-6 && r.z0 < o.z1 - 1e-6 && r.z1 > o.z0 + 1e-6) return 'Emplacement occupé';
    }
    // spots occupied by customers can't move
    if (ignoreUid) {
      const it = this.furniture.find((f) => f.uid === ignoreUid);
      if (it?.spot && (it.spot.group || it.spot.reserved)) return 'Des clients sont assis ici';
    }
    // connectivity test: simulate
    const test = this.nav.clone();
    if (ignoreUid) {
      const it = this.furniture.find((f) => f.uid === ignoreUid);
      if (it) {
        const o = this.itemRect(it.def, it.x, it.z, it.rot);
        test.fillRect(o.x0, o.z0, o.x1, o.z1, FREE);
      }
    }
    test.fillRect(r.x0, r.z0, r.x1, r.z1, BLOCK);
    const seen = test.reachable(L.door.x0 + 0.5, d + 1.5, false);
    // every seat approach must stay reachable
    const checkSeats = (seats) => seats.every((s) => {
      const nw = test.nearestWalkable(s.approach.x, s.approach.z, false, 1);
      if (!nw) return false;
      const p = test.center(nw.c, nw.r);
      return test.isReachableIn(seen, p.x, p.z);
    });
    for (const s of this.spots) {
      if (s.furniture && s.furniture.uid === ignoreUid) continue;
      if (!checkSeats(s.seats)) return 'Ça bloque le passage';
    }
    // the new item's own seats
    if (def.seats) {
      const th = (rot * Math.PI) / 2, c = Math.cos(th), sn = Math.sin(th);
      const seats = def.seats.map((sd) => {
        const wx = x + sd.x * c + sd.z * sn, wz = z - sd.x * sn + sd.z * c;
        let ax, az;
        if (def.approach === 'sides') {
          const alx = Math.sign(sd.x) * (def.footprint[0] * 0.25 + 0.3);
          ax = x + alx * c + sd.z * sn;
          az = z - alx * sn + sd.z * c;
        } else {
          const dx = wx - x, dz = wz - z, l = Math.hypot(dx, dz) || 1;
          ax = wx + (dx / l) * 0.62;
          az = wz + (dz / l) * 0.62;
        }
        return { approach: { x: ax, z: az } };
      });
      if (!checkSeats(seats)) return 'Les chaises seraient inaccessibles';
    }
    // staff must still reach the floor through the flap
    if (!test.isReachableIn(seen, (L.flap.x0 + L.flap.x1) / 2, L.counter.z1 + 0.25)) return 'Ça bloque la sortie du bar';
    return null;
  }

  place(def, x, z, rot) {
    const uid = this.game.nextUid();
    const rec = { uid, id: def.id, x, z, rot };
    this.game.state.furniture.push(rec);
    const item = this._spawnItem(rec);
    this.rebuildNav();
    this.relabel();
    return item;
  }

  move(uid, x, z, rot) {
    const rec = this.game.state.furniture.find((f) => f.uid === uid);
    const item = this.furniture.find((f) => f.uid === uid);
    if (!rec || !item) return;
    this._disposeItem(item);
    this.furniture = this.furniture.filter((f) => f !== item);
    rec.x = x;
    rec.z = z;
    rec.rot = rot;
    this._spawnItem(rec);
    this.rebuildNav();
    this.relabel();
  }

  remove(uid) {
    const item = this.furniture.find((f) => f.uid === uid);
    if (!item) return null;
    this._disposeItem(item);
    this.furniture = this.furniture.filter((f) => f !== item);
    this.game.state.furniture = this.game.state.furniture.filter((f) => f.uid !== uid);
    this.rebuildNav();
    this.relabel();
    return item.def;
  }

  canPlaceWall(def, wall, t) {
    const { w, d } = this.size;
    const len = wall === 'N' || wall === 'S' ? w : d;
    const half = def.size[0] / 2;
    if (t - half < 0.2 || t + half > len - 0.2) return 'Hors du mur';
    if (wall === 'S') return 'Mur de façade : choisissez un autre mur';
    if (wall === 'N') {
      if (t - half < L.backBar.x1 + 0.1) return 'Derrière le bar : pas de place';
      if (t + half > L.wcDoor.x0 - 0.1 && t - half < L.wcDoor.x1 + 0.1 && def.y - def.size[1] / 2 < 2.2) return 'Ça cache la porte des WC';
    }
    if (wall === 'E') {
      // windows on east wall: z 3.3..4.9, 6.2..7.8
      for (let z = 3.3; z + 1.6 < d - 0.5; z += 2.9) if (t + half > z - 0.1 && t - half < z + 1.7 && def.y - def.size[1] / 2 < 2.4 && def.y + def.size[1] / 2 > 0.9) return 'Il y a une fenêtre ici';
    }
    for (const o of this.wallItems) {
      if (o.wall !== wall) continue;
      const oh = o.def.size[0] / 2;
      const overlapX = t - half < o.t + oh && t + half > o.t - oh;
      const overlapY = def.y - def.size[1] / 2 < o.def.y + o.def.size[1] / 2 && def.y + def.size[1] / 2 > o.def.y - o.def.size[1] / 2;
      if (overlapX && overlapY) return 'Emplacement occupé';
    }
    return null;
  }

  placeWall(def, wall, t) {
    const uid = this.game.nextUid();
    const rec = { uid, id: def.id, wall, t };
    this.game.state.wallItems.push(rec);
    return this._spawnWall(rec);
  }

  removeWall(uid) {
    const item = this.wallItems.find((w) => w.uid === uid);
    if (!item) return null;
    item.node.removeFromParent();
    if (item._upd) this.game.world.updaters.delete(item._upd);
    this.wallItems = this.wallItems.filter((w) => w !== item);
    this.game.state.wallItems = this.game.state.wallItems.filter((w) => w.uid !== uid);
    return item.def;
  }

  // ------------------------------------------------ puddles
  addPuddle(x, z, color = 0xf2c14e) {
    const p = { x, z, decal: new Decal(color, 0.55, 0.85, 1), pickPriority: 0.15, kind: 'puddle' };
    p.decal.position = [x, 0.012, z];
    this.game.world.dynamic.add(p.decal);
    p.pickBox = () => [x - 0.45, 0, z - 0.45, x + 0.45, 0.15, z + 0.45];
    p.label = () => 'Flaque de bière';
    this.puddles.push(p);
    this.game.world.addPickable(p);
    return p;
  }
  removePuddle(p) {
    p.decal.removeFromParent();
    this.game.world.removePickable(p);
    this.puddles = this.puddles.filter((q) => q !== p);
  }
}
