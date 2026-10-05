// Customers & groups: arrival, seating, ordering, patience, drinking, rounds, paying, leaving.
import { CharacterView, randomLook } from '../world/models/character.js';
import { makeDraft, makeBottle, makeFood } from '../world/models/props.js';
import { CONFIG, LAYOUT } from '../data/config.js';
import { line } from '../data/lines.js';
import { QUALITY } from '../data/service.js';
import { clamp } from '../engine/math.js';
import { itemIconHTML, iconHTML } from '../ui/icons.js';

let GROUP_ID = 1;
const WALK = 1.35;

export function makeServing(product) {
  if (product.category === 'draft') return makeDraft(product);
  if (product.category === 'food') return makeFood(product);
  return makeBottle(product);
}

class Customer {
  constructor(group, look, opts = {}) {
    this.group = group;
    this.game = group.game;
    this.view = new CharacterView(look);
    this.look = look;
    this.pos = { x: opts.x, z: opts.z };
    this.view.root.position = [this.pos.x, 0, this.pos.z];
    this.game.world.dynamic.add(this.view.root);
    this.path = [];
    this.speed = WALK * (0.9 + Math.random() * 0.2);
    this.view.speed = this.speed / WALK;
    this.mode = 'walk';
    this.seat = null;
    this.drink = null;
    this.drinksHad = 0;
    this.budget = opts.budget;
    this.regular = opts.regular || null;
    this.done = false;
    this.slide = null;
    this.lineCd = 2 + Math.random() * 4;
    this.pickPriority = 0.5;
    this.gone = false;
    this.history = {};
    this.game.world.addPickable(this);
    if (this.regular) {
      const tag = document.createElement('div');
      tag.className = 'name-tag';
      tag.innerHTML = `${iconHTML('star', 12)} ${this.regular.name}`;
      this.tag = this.game.world.overlay.add(tag, () => [this.pos.x, 2.05 * this.look.height + this.view.root.position[1], this.pos.z], { offsetY: -4 });
    }
  }
  pickBox() {
    const y = this.view.root.position[1];
    return [this.pos.x - 0.3, y, this.pos.z - 0.3, this.pos.x + 0.3, y + 1.6, this.pos.z + 0.3];
  }
  walkTo(x, z, cb) {
    const p = this.game.bar.nav.findPath(this.pos.x, this.pos.z, x, z, false);
    this.path = p || [{ x, z }];
    this.onArrive = cb;
    this.mode = 'walk';
  }
  sitDown(seat) {
    this.seat = seat;
    this.slide = { from: { ...this.pos }, to: { x: seat.x, z: seat.z }, t: 0, sit: true };
    this.mode = 'slide';
  }
  standUp(cb) {
    const s = this.seat;
    if (!s) return cb && cb();
    this.view.pose = 'stand';
    this.view.root.position[1] = 0;
    this.slide = { from: { ...this.pos }, to: { ...s.approach }, t: 0, sit: false, cb };
    this.mode = 'slide';
  }
  say(text, cls = '') {
    if (!text) return;
    this.game.ui?.speech(this, text, cls);
  }
  update(dt) {
    const v = this.view;
    let moving = false;
    if (this.mode === 'walk' && this.path.length) {
      const tgt = this.path[0];
      const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      const step = this.speed * dt;
      if (d <= step) {
        this.pos.x = tgt.x;
        this.pos.z = tgt.z;
        this.path.shift();
        if (!this.path.length) {
          this.mode = 'idle';
          const cb = this.onArrive;
          this.onArrive = null;
          cb && cb();
        }
      } else {
        this.pos.x += (dx / d) * step;
        this.pos.z += (dz / d) * step;
        v.targetFacing = Math.atan2(dx, dz);
        moving = true;
      }
      // open entrance door when passing
      const door = LAYOUT.door;
      const D = this.game.roomSize().d;
      if (Math.abs(this.pos.z - D) < 1.0 && this.pos.x > door.x0 - 0.5 && this.pos.x < door.x1 + 0.5) this.game.world.room.openDoor('entrance', 0.8);
    } else if (this.mode === 'slide' && this.slide) {
      const s = this.slide;
      s.t += dt / 0.45;
      const k = Math.min(1, s.t);
      this.pos.x = s.from.x + (s.to.x - s.from.x) * k;
      this.pos.z = s.from.z + (s.to.z - s.from.z) * k;
      if (s.sit) v.targetFacing = this.seat.face;
      else v.targetFacing = Math.atan2(s.to.x - s.from.x, s.to.z - s.from.z);
      moving = !s.sit;
      if (k >= 1) {
        this.slide = null;
        if (s.sit) {
          this.mode = 'seated';
          v.pose = this.seat.pose === 'stool' ? 'stool' : 'sit';
          v.seatY = this.seat.seatY;
          v.squash = 0.6;
          v.targetFacing = this.seat.face;
          this.group.memberSeated(this);
        } else {
          this.mode = 'idle';
          s.cb && s.cb();
        }
      }
    }
    v.root.position[0] = this.pos.x;
    v.root.position[2] = this.pos.z;
    // drinking
    if (this.drink) {
      const d = this.drink;
      d.t += dt;
      const lvl = Math.max(0, 1 - d.t / d.dur);
      d.node.setLevel(lvl);
      if (d.t >= d.dur) this.finishDrink();
    }
    v.update(dt, moving);
  }
  giveDrink(product) {
    const node = makeServing(product);
    this.view.hold('R', node);
    const g = this.group;
    const base = CONFIG.drinkTimeBase * (product.drinkTime || 1) / (g.type.drinkSpeed || 1);
    const rushK = this.game.rushActive() ? 0.78 : 1;
    this.drink = { pid: product.id, node, t: 0, dur: base * (0.85 + Math.random() * 0.35) * (g.slowFactor || 1) * rushK };
    this.view.setAction('drink');
    this.view.actionT = Math.random() * 2;
    this.done = false;
  }
  finishDrink() {
    const d = this.drink;
    const p = this.game.products.get(d.pid);
    this.view.hold('R', null);
    this.drink = null;
    this.done = true;
    this.drinksHad++;
    this.history[d.pid] = (this.history[d.pid] || 0) + 1;
    if (p.category === 'draft') this.group.dirtyGlasses++;
    else this.group.dirtyBottles++;
    const strength = p.style === 'belge' || p.style === 'trappiste' ? 0.4 : p.category === 'soft' ? 0 : 0.22;
    this.view.drunk = Math.min(1, this.view.drunk + strength * (this.group.drunkFactor || 1));
    this.view.setAction(null);
    if (this.view.drunk > 0.6 && Math.random() < 0.35) {
      this.say(line('drunk'), 'happy');
      this.view.setAction('dance');
      this.danceT = 2.5;
    }
  }
  remove() {
    this.gone = true;
    this.view.root.removeFromParent();
    this.game.world.removePickable(this);
    this.tag?.remove();
  }
}

export class Group {
  constructor(mgr, type, size, opts = {}) {
    this.id = GROUP_ID++;
    this.mgr = mgr;
    this.game = mgr.game;
    this.type = type;
    this.size = size;
    this.state = 'arriving';
    this.members = [];
    this.spots = [];
    this.seats = [];
    this.sat = 0;
    this.tab = 0;
    this.tipTotal = 0;
    this.round = 0;
    this.ticket = null;
    this.patience = 0;
    this.patienceMax = 1;
    this.timer = 0;
    this.roundsLeft = 1;
    this.dirtyGlasses = 0;
    this.dirtyBottles = 0;
    this.foodNodes = [];
    this.flags = {};
    this.regular = opts.regular || null;
    this.critic = !!opts.critic;
    this.birthday = null;
    this.lineCd = 3;
    this.seatedCount = 0;
    this.delivered = [];
    this.spentTotal = 0;
    this.slowFactor = 1;
    this.drunkFactor = 1;
    this._bubbleKey = '';
  }

  get anchor() {
    if (this.spots.length) {
      const s = this.spots[0];
      if (s.kind === 'counter') return [s.seats[0].x + (this.spots.length > 1 ? 0.4 : 0), 2.3, s.seats[0].z];
      return [s.center.x, s.topY + 1.35, s.center.z];
    }
    const m = this.members[0];
    return m ? [m.pos.x, 2.2, m.pos.z] : [0, 0, 0];
  }

  spawn(rng) {
    const g = this.game;
    const { d, w } = g.roomSize();
    const side = rng.chance(0.5) ? -2.5 : w + 2.5;
    const budgetR = this.type.budget;
    for (let i = 0; i < this.size; i++) {
      let look, regular = null;
      if (i === 0 && this.regular) {
        look = this.regular.look;
        regular = this.regular;
      } else look = this.mgr.lookFor(this.type, rng);
      const m = new Customer(this, look, {
        x: side + (side < 0 ? -i * 0.7 : i * 0.7),
        z: d + 1.3 + (i % 2) * 0.45,
        budget: rng.range(budgetR[0], budgetR[1]) * (this.critic ? 1.5 : 1),
        regular,
      });
      this.members.push(m);
    }
    this.goToDoor();
  }

  goToDoor() {
    const g = this.game;
    const seating = g.bar.findSeating(this.size, this.wantsCounter(), g.rng);
    if (seating) {
      this.assign(seating);
      this.state = 'arriving';
    } else {
      this.state = 'queue';
      this.patienceMax = this.patience = CONFIG.patienceDoor * this.type.patience;
      const { d } = g.roomSize();
      const qi = this.mgr.groups.filter((x) => x.state === 'queue').indexOf(this);
      this.members.forEach((m, i) => m.walkTo(LAYOUT.door.x0 - 0.8 - qi * 1.3 - i * 0.45, d + 1.2 + (i % 2) * 0.4, () => (m.view.targetFacing = Math.PI)));
      if (!this.flags.queueToast) {
        this.flags.queueToast = true;
        g.bus.emit('doorQueue', { group: this });
      }
    }
  }

  wantsCounter() {
    if (this.regular) return true;
    return this.size <= 2 && this.game.rng.chance(this.type.counterChance);
  }

  assign(spots) {
    this.spots = spots;
    for (const s of spots) s.group = this;
    const seats = spots.flatMap((s) => s.seats);
    this.seats = seats.slice(0, this.size);
    const D = this.game.roomSize().d;
    const door = LAYOUT.door;
    this.members.forEach((m, i) => {
      const seat = this.seats[i];
      const go = () => m.walkTo(seat.approach.x, seat.approach.z, () => m.sitDown(seat));
      // walk through the door first
      if (m.pos.z > D && !spots[0].outdoor) m.walkTo((door.x0 + door.x1) / 2 + (i % 2 ? 0.15 : -0.15), D - 0.4, go);
      else go();
    });
    const dirty = spots.some((s) => s.isDirty);
    if (dirty) this.flags.dirtyAtSit = true;
    // hide dirty piles under the group (they stay as "dirty" state until cleared)
    for (const s of spots) s.refreshDirt();
  }

  memberSeated(m) {
    this.seatedCount++;
    if (this.seatedCount === this.size && this.state === 'arriving') this.onSeated();
  }

  onSeated() {
    const g = this.game;
    this.state = 'settling';
    this.timer = (1.2 + g.rng.next() * 1.8) * (g.rushActive() ? 0.5 : 1);
    // base satisfaction
    const sc = g.bar.scores();
    const comfort = this.spots.reduce((s, x) => s + (x.comfort || 0), 0) / this.spots.length;
    let sat = 55 + comfort + Math.min(16, sc.decor * 0.55) + Math.min(6, sc.ambiance * 0.5);
    if (sc.attracts[this.type.id]) sat += 4;
    if (this.spots[0]?.outdoor) sat += g.director.weather().id === 'chaud' ? 7 : 2;
    if (sc.fun > 0 && ['etudiant', 'amis', 'sportif'].includes(this.type.id)) sat += Math.min(6, sc.fun * 0.4);
    if (this.flags.dirtyAtSit) {
      sat -= 12 * (this.type.cleanSens || 1);
      const m = this.members[0];
      m.say(line('dirty'), 'grumpy');
    }
    this.sat = clamp(sat, 5, 100);
    const ev = g.eventEffects();
    this.roundsLeft = g.rng.int(this.type.thirst[0], this.type.thirst[1]) + (ev.rounds || 0);
    this.drunkFactor = ev.drunk || 1;
    if (this.regular) {
      this.roundsLeft = Math.max(this.roundsLeft, 2);
      this.members[0].say(line('regularHello'), 'happy');
    }
    // birthdays
    if (this.size >= 3 && g.rng.chance(0.07)) {
      const names = this.game.rngNames();
      this.birthday = names;
      this.roundsLeft++;
      this.members[1].say(line('birthday', { name: names }), 'party');
      g.bus.emit('birthday', { group: this, name: names });
    }
  }

  setPatience(seconds) {
    const sc = this.game.bar.scores();
    const k = (1 + Math.min(0.25, sc.ambiance * 0.02) + (this.regular ? 0.2 : 0)) * (this.rushCrowd ? 1.25 : 1);
    this.patienceMax = this.patience = seconds * this.type.patience * k;
  }

  get patienceFrac() {
    return clamp(this.patience / this.patienceMax, 0, 1);
  }

  update(dt) {
    const g = this.game;
    this.lineCd -= dt;
    for (const m of this.members) {
      m.update(dt);
      if (m.danceT > 0) {
        m.danceT -= dt;
        if (m.danceT <= 0 && m.view.action === 'dance') m.view.setAction(m.drink ? 'drink' : null);
      }
    }
    switch (this.state) {
      case 'queue': {
        this.patience -= dt;
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = 0.8;
          const seating = g.bar.findSeating(this.size, this.wantsCounter(), g.rng);
          if (seating) {
            this.state = 'arriving';
            this.assign(seating);
            return;
          }
        }
        if (this.patience <= 0) {
          this.members[0].say(line('doorFull'), 'grumpy');
          this.leave('lost');
        }
        break;
      }
      case 'settling':
        this.timer -= dt;
        for (const m of this.members) if (m.mode === 'seated' && !m.view.action) m.view.setAction(Math.random() < 0.5 ? 'talk' : null);
        if (this.timer <= 0) {
          this.state = 'wantOrder';
          this.setPatience(CONFIG.patienceOrder);
          this.callAnim();
        }
        break;
      case 'wantOrder':
        this.patience -= dt;
        this.impatience(dt, 'waitOrder', 'waitOrderLong');
        if (this.patience <= 0) this.giveUp();
        break;
      case 'round': {
        const pending = this.pendingItems();
        if (pending.length) {
          this.patience -= dt;
          this.impatience(dt, 'waitServe', 'waitServe');
          if (this.patience <= 0) this.giveUp();
        }
        // talk animations for idle members
        for (const m of this.members) {
          if (m.mode !== 'seated') continue;
          if (!m.drink && !m.view.action && Math.random() < dt * 0.4) m.view.setAction(Math.random() < 0.5 ? 'talk' : Math.random() < 0.5 ? 'phone' : 'laugh');
          if (!m.drink && m.view.action && m.view.actionT > 3) m.view.setAction(null);
          if (m.drink && m.view.action !== 'drink' && m.view.action !== 'dance' && m.view.action !== 'cheer') m.view.setAction('drink');
        }
        if (!pending.length && this.members.every((m) => !m.drink)) this.nextRound();
        break;
      }
      case 'wantBill':
        this.patience -= dt;
        this.impatience(dt, 'waitBill', 'waitBillLong');
        if (this.patience <= 0) this.leaveCash();
        break;
      default:
    }
    this.updateBubble();
  }

  callAnim() {
    const m = this.members[Math.floor(Math.random() * this.members.length)];
    m.view.setAction('wave');
    setTimeout(() => {
      if (m.view.action === 'wave') m.view.setAction(null);
    }, 1600);
  }

  impatience(dt, key, keyLong) {
    const f = this.patienceFrac;
    if (f < 0.5) {
      for (const m of this.members) {
        if (m.mode !== 'seated' || m.drink) continue;
        if (!m.view.action || m.view.actionT > 2.5) m.view.setAction(f < 0.25 ? (Math.random() < 0.5 ? 'impatient' : 'wave') : Math.random() < 0.5 ? 'watch' : 'impatient');
      }
      if (this.lineCd <= 0) {
        this.lineCd = 6 + Math.random() * 4;
        const m = this.members[Math.floor(Math.random() * this.members.length)];
        m.say(line(f < 0.25 ? keyLong : key), 'grumpy');
      }
      for (const m of this.members) m.view.mood = f < 0.25 ? 'angry' : 'sad';
    } else for (const m of this.members) m.view.mood = this.sat > 75 ? 'happy' : 'neutral';
  }

  pendingItems() {
    return this.ticket ? this.ticket.items.filter((i) => !i.done && !i.cancelled) : [];
  }

  /** build an order */
  makeOrder(worker) {
    const g = this.game;
    const menu = g.menu();
    const items = [];
    const ev = g.eventEffects();
    let priceDelta = 0, priceCount = 0, pricey = null, cheapFlag = false;
    for (const m of this.members) {
      let pid = null;
      if (m.regular && menu.drinks.includes(m.regular.favorite)) pid = m.regular.favorite;
      else if (m.regular && !menu.drinks.includes(m.regular.favorite)) {
        const fav = g.products.get(m.regular.favorite);
        m.say(line('regularMiss', { beer: fav?.short || 'bière' }), 'grumpy');
        this.sat -= 22;
        m.regular.loyalty = Math.max(0, m.regular.loyalty - 1);
        g.bus.emit('regularMiss', { regular: m.regular });
      }
      if (!pid) pid = this.mgr.chooseDrink(this, m, menu.drinks);
      if (!pid) continue;
      const price = g.priceOf(pid);
      if (price > m.budget) continue;
      m.budget -= price;
      items.push({ pid, member: m, price, done: false, cancelled: false });
      const ratio = price / (g.products.get(pid).basePrice * (ev.priceRef || 1));
      priceDelta += clamp((1.05 - ratio) * 28 * this.type.priceSens, -16, 5);
      priceCount++;
      if (ratio > 1.3) pricey = price;
      if (ratio < 0.85) cheapFlag = true;
    }
    // food
    const foods = menu.foods;
    if (foods.length) {
      const fc = this.type.foodChance * (this.round > 0 ? 0.45 : 1) * (ev.foodChance || 1);
      if (g.rng.chance(fc)) {
        const n = this.type.foodCount || (this.size >= 4 ? 2 : 1);
        for (let k = 0; k < n; k++) {
          const fid = this.mgr.chooseFood(this, foods);
          if (!fid) break;
          const price = g.priceOf(fid);
          const payer = this.members.reduce((a, b) => (a.budget > b.budget ? a : b));
          if (payer.budget < price) break;
          payer.budget -= price;
          items.push({ pid: fid, member: null, price, done: false, cancelled: false });
          const ratio = price / g.products.get(fid).basePrice;
          priceDelta += clamp((1.05 - ratio) * 20 * this.type.priceSens, -12, 4);
          priceCount++;
          if (ratio > 1.3 && !pricey) pricey = price;
        }
      }
    }
    if (!items.length) {
      // nothing affordable / wanted
      this.state = 'wantBill';
      this.setPatience(CONFIG.patienceBill);
      if (this.tab <= 0) this.leave('nothing');
      return null;
    }
    this.round++;
    if (priceCount) this.sat += priceDelta / priceCount;
    if (pricey) this.members[0].say(line('pricey', { price: g.fmtPrice(pricey) }), 'grumpy');
    else if (cheapFlag && g.rng.chance(0.4)) this.members[0].say(line('cheap'), 'happy');
    // order speed bonus
    this.sat += (this.patienceFrac - 0.45) * 16 + (worker?.serviceBonus || 0);
    this.ticket = this.mgr.game.orders.create(this, items);
    this.state = 'round';
    // bigger orders take longer: customers understand (a bit)
    let serveTime = CONFIG.patienceServe + items.filter((i) => g.products.get(i.pid).category === 'food').length * 7 + Math.max(0, items.length - 2) * 6;
    this.setPatience(serveTime);
    for (const m of this.members) {
      m.done = false;
      if (m.view.action === 'wave' || m.view.action === 'watch' || m.view.action === 'impatient') m.view.setAction(null);
      m.view.mood = 'neutral';
    }
    return this.ticket;
  }

  /** deliver one product; returns true if accepted */
  deliver(pid, worker, q = 'good') {
    const it = this.ticket?.items.find((i) => i.pid === pid && !i.done && !i.cancelled);
    if (!it) return false;
    const g = this.game;
    const p = g.products.get(pid);
    it.done = true;
    this.tab += it.free ? 0 : it.price;
    this.delivered.push(it);
    if (p.category === 'food') {
      const node = makeServing(p);
      const s = this.spots[0];
      const idx = this.foodNodes.length;
      const seat = this.seats[idx % this.seats.length];
      const pos = s.kind === 'counter' ? [seat.item[0] + 0.18, s.topY, seat.item[2]] : [s.center.x + (seat.item[0] - s.center.x) * 0.25, s.topY, s.center.z + (seat.item[2] - s.center.z) * 0.25];
      node.position = pos;
      g.world.dynamic.add(node);
      this.foodNodes.push({ node, pid, t: 0 });
      g.state.stats.food = (g.state.stats.food || 0) + 1;
      if (pid === 'planche') g.state.stats.planches = (g.state.stats.planches || 0) + 1;
    } else {
      const m = it.member && !it.member.drink ? it.member : this.members.find((x) => !x.drink && x.mode === 'seated') || it.member;
      if (m) {
        m.giveDrink(p);
        m.view.squash = 0.4;
      }
      g.state.stats.drinks++;
      if (g.night) g.night.drinks++;
    }
    // quality / preference
    const qs = this.type.qualitySens;
    this.sat += (p.quality - 3) * 2.5 * qs + (g.up('cooling') && p.category === 'draft' ? 1.5 : 0);
    if (this.critic) this.sat += (p.quality - 3) * 3;
    // how well it was prepared (service mini-games)
    const Q = QUALITY[q] || QUALITY.good;
    this.sat += Q.sat * (0.7 + 0.3 * qs) * (this.critic ? 1.6 : 1) + (g.comboLevel() >= 3 ? 1 : 0) + (g.comboLevel() >= 6 ? 1 : 0);
    this.qualityTip = (this.qualityTip || 0) + Q.tip;
    it.q = q;
    if (g.rushActive()) {
      const rs = g.rush.stats;
      rs.served++;
      rs.groups.add(this.id);
      if (!it.free) rs.revenue += it.price;
    }
    const m0 = this.members[Math.floor(Math.random() * this.members.length)];
    if (q === 'perfect') g.ui?.emote([this.anchor[0] + (Math.random() - 0.5) * 0.4, this.anchor[1] - 0.3, this.anchor[2]], 'star', 26);
    else if (q === 'bad') m0?.say(line(p.category === 'draft' ? 'badPint' : 'badFood', { beer: p.short }), 'grumpy');
    else if (q === 'average' && Math.random() < 0.35) m0?.say(line('avgItem'), 'grumpy');
    if (this.pendingItems().length) {
      // partial delivery: they calm down a bit
      this.patience = Math.min(this.patienceMax, this.patience + this.patienceMax * 0.3);
    } else {
      // whole order delivered
      this.sat += (this.patienceFrac - 0.4) * 20 + (worker?.serviceBonus || 0);
      const m = this.members[Math.floor(Math.random() * this.members.length)];
      if (this.patienceFrac > 0.75 && g.rng.chance(0.5)) m.say(line('servedFast'), 'happy');
      else if (g.rng.chance(0.45)) m.say(line('served'), 'happy');
      if (this.birthday && !this.flags.cake) {
        this.flags.cake = true;
        for (const mm of this.members) mm.view.setAction('cheer');
        g.world.effects.burst('confetti', this.anchor);
        g.bus.emit('cheer', {});
        setTimeout(() => this.members.forEach((mm) => mm.view.action === 'cheer' && mm.view.setAction(mm.drink ? 'drink' : null)), 2200);
      }
      for (const mm of this.members) mm.view.mood = this.sat > 70 ? 'happy' : 'neutral';
      if (this.sat > 72) g.ui?.emote(this.anchor, 'heart');
    }
    this.sat = clamp(this.sat, 0, 100);
    return true;
  }

  nextRound() {
    const g = this.game;
    // food plates become dirty
    for (const f of this.foodNodes) f.node.removeFromParent();
    if (this.foodNodes.length) this.flags.plates = (this.flags.plates || 0) + this.foodNodes.length;
    this.foodNodes = [];
    this.roundsLeft--;
    const menu = g.menu();
    const cheapest = Math.min(...menu.drinks.map((p) => g.priceOf(p)), 99);
    const canAfford = this.members.some((m) => m.budget >= cheapest);
    if (this.roundsLeft > 0 && canAfford && this.sat >= 35 && g.clock < CONFIG.lastCall && g.phase === 'service') {
      this.state = 'wantOrder';
      this.setPatience(CONFIG.patienceOrder * 1.1);
      this.callAnim();
      this.ticket?.close();
      this.ticket = null;
    } else {
      this.askBill();
    }
  }

  askBill() {
    this.ticket?.close();
    this.ticket = null;
    if (this.tab <= 0) {
      this.leave('nothing');
      return;
    }
    this.state = 'wantBill';
    this.setPatience(CONFIG.patienceBill);
    const m = this.members[0];
    m.view.setAction('wave');
    setTimeout(() => m.view.action === 'wave' && m.view.setAction(null), 1500);
  }

  pay(worker) {
    const g = this.game;
    this.sat += (this.patienceFrac - 0.5) * 10 + (worker?.serviceBonus || 0);
    this.sat = clamp(this.sat, 0, 100);
    const loyalty = this.regular?.loyalty || 0;
    const tipRate = (clamp((this.sat - 55) / 45, 0, 1) * 0.2 * this.type.tip + (this.qualityTip || 0) / Math.max(1, this.delivered.length) * this.type.tip) * (1 + loyalty * 0.04) * (this.birthday ? 1.5 : 1);
    const tip = Math.round(this.tab * tipRate * g.comboMult() * 10) / 10;
    g.earn(this.tab, tip, this);
    this.tipTotal = tip;
    const m = this.members[0];
    m.view.setAction('pay');
    setTimeout(() => m.view.action === 'pay' && m.view.setAction(null), 800);
    this.leave('paid');
  }

  /** patience ran out while waiting to order / to be served */
  giveUp() {
    const g = this.game;
    const pending = this.pendingItems();
    if (g.night) {
      const why = (g.night.angryWhy ||= {});
      const k = this.state === 'round' ? (pending.some((i) => g.products.get(i.pid).category === 'food') ? 'serveFood' : 'serveDrink') : this.state;
      why[k] = (why[k] || 0) + this.size;
    }
    for (const it of pending) {
      it.cancelled = true;
      // refund budget
      if (it.member) it.member.budget += it.price;
    }
    this.sat -= 30;
    for (const m of this.members) {
      m.view.mood = 'angry';
      m.view.setAction('angry');
    }
    this.members[0].say(line('leaveAngry'), 'angry');
    g.world.effects.burst('anger', this.anchor);
    g.ui?.emote(this.anchor, 'anger', 34);
    g.bus.emit('angry', { group: this });
    if (this.tab > 0) {
      // they still pay what they had (no tip), leaving money on the table
      this.leaveCash(true);
    } else this.leave('angry');
  }

  leaveCash(angry) {
    const g = this.game;
    if (!angry) {
      this.sat -= 12;
      this.members[0].say(line('waitBillLong'), 'grumpy');
    }
    this.spots[0].cash += this.tab;
    this.spots[0].refreshDirt();
    this.flags.cashLeft = true;
    this.leave(angry ? 'angry' : 'cash');
  }

  leave(outcome) {
    if (this.state === 'leaving') return;
    const g = this.game;
    this.outcome = outcome;
    this.state = 'leaving';
    this.ticket?.close();
    this.ticket = null;
    // drop leftovers
    for (const m of this.members) {
      if (m.drink) {
        const p = g.products.get(m.drink.pid);
        if (p.category === 'draft') this.dirtyGlasses++;
        else this.dirtyBottles++;
        m.view.hold('R', null);
        m.drink = null;
      }
    }
    for (const f of this.foodNodes) f.node.removeFromParent();
    if (this.foodNodes.length) this.flags.plates = (this.flags.plates || 0) + this.foodNodes.length;
    this.foodNodes = [];
    const spot = this.spots[0];
    if (spot) {
      spot.dirty.glasses += this.dirtyGlasses;
      spot.dirty.bottles += this.dirtyBottles;
      spot.dirty.plates += this.flags.plates || 0;
    }
    this.dirtyGlasses = this.dirtyBottles = 0;
    this.flags.plates = 0;
    for (const s of this.spots) {
      s.group = null;
      s.refreshDirt();
    }
    this.mgr.onGroupLeft(this, outcome);
    const { d, w } = g.roomSize();
    const door = LAYOUT.door;
    const exitX = Math.random() < 0.5 ? -3 : w + 3;
    for (const m of this.members) {
      const away = () => m.walkTo((door.x0 + door.x1) / 2, d + 1.0, () => m.walkTo(exitX, d + 1.3 + Math.random() * 0.8, () => m.remove()));
      if (m.mode === 'seated') m.standUp(away);
      else away();
      if (outcome === 'paid' && this.sat > 75 && Math.random() < 0.35) m.say(line('leaveHappy'), 'happy');
      m.view.mood = outcome === 'paid' ? (this.sat > 65 ? 'happy' : 'neutral') : 'angry';
    }
    this.removeBubble();
  }

  get finished() {
    return this.state === 'leaving' && this.members.every((m) => m.gone);
  }

  // ---------------------------------------------- UI bubble
  bubbleState() {
    switch (this.state) {
      case 'wantOrder':
        return { kind: 'order' };
      case 'round': {
        const p = this.pendingItems();
        if (!p.length) return null;
        return { kind: 'items', items: p.map((i) => i.pid) };
      }
      case 'wantBill':
        return { kind: 'bill' };
      case 'queue':
        return { kind: 'queue' };
      default:
        return null;
    }
  }

  updateBubble() {
    const bs = this.bubbleState();
    const g = this.game;
    if (!bs) {
      if (this.bubble) this.bubble.setVisible(false);
      return;
    }
    if (!this.bubble) {
      const el = document.createElement('button');
      el.className = 'bubble';
      el.type = 'button';
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        g.clickGroup(this);
      });
      el.innerHTML = '<svg class="ring" viewBox="0 0 36 36"><circle class="ring-bg" cx="18" cy="18" r="15.5"/><circle class="ring-fg" cx="18" cy="18" r="15.5"/></svg><div class="bubble-body"></div>';
      this.bubbleBody = el.querySelector('.bubble-body');
      this.bubbleRing = el.querySelector('.ring-fg');
      this.bubble = g.world.overlay.add(el, () => (this.state === 'queue' ? [this.members[0].pos.x, 2.1, this.members[0].pos.z] : this.anchor), { offsetY: -6 });
    }
    this.bubble.setVisible(true);
    const key = bs.kind + (bs.items ? bs.items.join(',') : '');
    if (key !== this._bubbleKey) {
      this._bubbleKey = key;
      let html = '';
      if (bs.kind === 'order') html = iconHTML('notepad', 26);
      else if (bs.kind === 'bill') html = iconHTML('euro', 26);
      else if (bs.kind === 'queue') html = iconHTML('door', 22);
      else html = bs.items.slice(0, 6).map((pid) => itemIconHTML(g.products.get(pid), 22)).join('');
      this.bubbleBody.innerHTML = html;
      this.bubble.el.dataset.kind = bs.kind;
      this.bubble.el.classList.toggle('wide', bs.kind === 'items' && bs.items.length > 1);
    }
    const f = this.patienceFrac;
    this.bubbleRing.style.strokeDashoffset = String(97.4 * (1 - f));
    this.bubble.el.dataset.mood = f > 0.5 ? 'ok' : f > 0.25 ? 'warn' : 'bad';
    this.bubble.el.classList.toggle('vip', !!this.regular || this.critic);
  }

  removeBubble() {
    if (this.bubble) {
      this.bubble.remove();
      this.bubble = null;
    }
  }

  dispose() {
    this.removeBubble();
    for (const m of this.members) if (!m.gone) m.remove();
    for (const f of this.foodNodes) f.node.removeFromParent();
    for (const s of this.spots) if (s.group === this) s.group = null;
  }
}

export class CustomerManager {
  constructor(game) {
    this.game = game;
    this.groups = [];
  }

  types() {
    return this.game.data.customerTypes;
  }

  lookFor(type, rng) {
    const h = type.look || {};
    const hints = {};
    if (h.topStyle) hints.topStyle = rng.pick(h.topStyle);
    if (h.age) hints.age = h.age;
    if (h.build) hints.build = h.build;
    if (h.accessory) for (const [a, p] of h.accessory) if (rng.chance(p)) hints.accessory = a;
    if (h.hat) {
      hints.hat = null;
      for (const [a, p] of h.hat) if (!hints.hat && rng.chance(p)) hints.hat = a;
    }
    if (h.beard !== undefined) hints.beard = rng.chance(h.beard);
    if (h.mustache !== undefined) hints.mustache = rng.chance(h.mustache);
    if (h.glasses !== undefined) hints.glasses = rng.chance(h.glasses);
    if (hints.topStyle === 'jersey') {
      const kits = [[0xd62828, 0xffffff], [0x1d3557, 0xffd166], [0x2a9d8f, 0xffffff], [0xffd166, 0x1d3557]];
      const k = this.game.night?.kit || rng.pick(kits);
      hints.top = k[0];
      hints.stripe = k[1];
      hints.accColor = k[0];
    }
    if (hints.topStyle === 'suit') hints.top = rng.pick([0x2b2d42, 0x3d405b, 0x22223b]);
    if (hints.topStyle === 'hawaii') hints.top = rng.pick([0x48cae4, 0xf77f00, 0x06d6a0, 0xef476f]);
    return randomLook(rng, hints);
  }

  spawnGroup(type, size, opts = {}) {
    const g = new Group(this, type, size, opts);
    this.groups.push(g);
    g.spawn(this.game.rng);
    this.game.bus.emit('groupSpawn', { group: g });
    return g;
  }

  chooseDrink(group, member, drinks) {
    const g = this.game;
    const t = group.type;
    const ev = g.eventEffects();
    let best = g.rng.weighted(drinks, (pid) => {
      const p = g.products.get(pid);
      let w = p.popularity ?? 0.6;
      if (p.category === 'soft') w = (t.softChance || 0.05) * 6 * (t.prefs.soft || 1);
      else {
        w *= t.prefs[p.style] ?? 1;
        for (const tag of p.tags || []) if (t.prefs[tag]) w *= t.prefs[tag];
        w *= 1 + (p.quality - 3) * 0.18 * t.qualitySens;
      }
      w *= g.styleMult(p);
      w *= g.trendMult(pid);
      const ratio = g.priceOf(pid) / p.basePrice;
      w *= clamp(1.35 - (ratio - 1) * t.priceSens * 2.2, 0.06, 1.7);
      if (member.history[pid]) w *= 2.5;
      if (g.priceOf(pid) > member.budget) w *= 0.02;
      return w;
    });
    return best;
  }

  chooseFood(group, foods) {
    const g = this.game;
    const ev = g.eventEffects();
    return g.rng.weighted(foods, (pid) => {
      const p = g.products.get(pid);
      let w = (group.type.foodPrefs?.[pid] ?? 0.6) * (p.popularity ?? 1);
      if (ev.food?.[pid]) w *= ev.food[pid];
      const ratio = g.priceOf(pid) / p.basePrice;
      w *= clamp(1.3 - (ratio - 1) * group.type.priceSens * 2, 0.05, 1.6);
      return w;
    });
  }

  onGroupLeft(group, outcome) {
    this.game.onGroupLeft(group, outcome);
  }

  update(dt) {
    for (const g of this.groups) g.update(dt);
    for (let i = this.groups.length - 1; i >= 0; i--) {
      if (this.groups[i].finished) {
        this.groups[i].dispose();
        this.groups.splice(i, 1);
      }
    }
  }

  present() {
    return this.groups.filter((g) => g.state !== 'leaving' && g.state !== 'queue');
  }
  customerCount() {
    return this.present().reduce((s, g) => s + g.size, 0);
  }
  clearAll() {
    for (const g of this.groups) g.dispose();
    this.groups = [];
  }
}
