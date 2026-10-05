// A worker (the owner or an employee): walks the bar and executes a queue of tasks.
import { CharacterView } from '../world/models/character.js';
import { makeKeg, makeCrate, makeTray, makeDirtyTray, makeMop, makeWrench, makeRag } from '../world/models/props.js';
import { makeServing } from './Customers.js';
import { CONFIG, LAYOUT } from '../data/config.js';
import { Node } from '../engine/scene.js';
import { iconHTML } from '../ui/icons.js';
import { staffQuality } from '../data/service.js';

// typical time a player spends in each mini-game (seconds, incl. result stamp)
const AUTO_MINI_TIME = { pour: 4.0, cut: 3.2, plank: 4.6, cap: 1.9, fill: 2.6, timing: 3.2 };

export class Worker {
  constructor(game, opts) {
    this.game = game;
    this.role = opts.role; // owner | serveur | barman
    this.name = opts.name;
    this.stats = opts.stats || { speed: 70, service: 70 };
    this.rec = opts.rec || null; // persistent staff record
    this.look = opts.look;
    this.view = new CharacterView(opts.look);
    this.pos = { ...(opts.pos || { x: 4.5, z: 1.0 }) };
    this.view.root.position = [this.pos.x, 0, this.pos.z];
    game.world.dynamic.add(this.view.root);
    this.hands = [];
    this.dirty = { glasses: 0, bottles: 0, plates: 0 };
    this.carrying = null;
    this.queue = [];
    this.current = null;
    this.phase = 'idle';
    this.timer = 0;
    this.path = [];
    this.idleT = 0;
    this.pickPriority = 0.2;
    this.markers = [];
    this.isOwner = this.role === 'owner';
    this.carryNode = new Node('carry');
    this.carryNode.position = [0, 0.62, 0.34];
    this.view.body.add(this.carryNode);
    if (!this.isOwner) {
      const tag = document.createElement('div');
      tag.className = 'name-tag staff';
      tag.textContent = this.name;
      this.tag = game.world.overlay.add(tag, () => [this.pos.x, 2.05, this.pos.z], { offsetY: -4 });
    }
    // progress ring above head
    const pr = document.createElement('div');
    pr.className = 'work-ring';
    pr.innerHTML = '<svg viewBox="0 0 36 36"><circle class="ring-bg" cx="18" cy="18" r="14"/><circle class="ring-fg" cx="18" cy="18" r="14"/></svg>';
    this.ringEl = pr.querySelector('.ring-fg');
    this.ring = game.world.overlay.add(pr, () => [this.pos.x, 2.25, this.pos.z], { offsetY: -10 });
    this.ring.setVisible(false);
    game.world.addPickable(this);
  }

  pickBox() {
    return [this.pos.x - 0.3, 0, this.pos.z - 0.3, this.pos.x + 0.3, 1.7, this.pos.z + 0.3];
  }

  get capacity() {
    if (this.isOwner) return this.game.upValue('tray', CONFIG.baseHands);
    if (this.role === 'barman') return this.stats.service >= 85 ? 4 : 3;
    return 2;
  }
  get freeHands() {
    return this.capacity - this.hands.length;
  }
  get dirtyCount() {
    return this.dirty.glasses + this.dirty.bottles + this.dirty.plates;
  }
  get speed() {
    if (this.isOwner) return CONFIG.baseSpeed * this.game.upValue('shoes', 1) * (this.game.onFire() ? 1.25 : 1);
    return CONFIG.baseSpeed * (0.72 + this.stats.speed / 230);
  }
  get workMult() {
    if (this.isOwner) return this.game.onFire() ? 0.85 : 1;
    return 1.35 - this.stats.speed / 260;
  }
  /** production skill used for automatic quality (employees) */
  get skill() {
    return this.role === 'barman' ? this.stats.service * 0.75 + this.stats.speed * 0.25 + 8 : this.stats.service * 0.6 + 5;
  }
  get serviceBonus() {
    if (this.isOwner) return 2;
    return (this.stats.service - 50) / 10;
  }

  enqueue(task, front = false) {
    if (this.isOwner && this.queue.length >= CONFIG.maxQueue) {
      this.game.toast('File d’actions pleine', 'warn');
      return false;
    }
    if (front) this.queue.unshift(task);
    else this.queue.push(task);
    if (task.claim) this.game.claim(task.claim, this);
    this.refreshMarkers();
    return true;
  }

  cancelAll() {
    for (const t of this.queue) {
      if (t.claim) this.game.unclaim(t.claim, this);
      t.cancel?.(this);
    }
    this.queue = [];
    if (this.current) this._abort(this.current);
    this.refreshMarkers();
  }

  removeTask(t) {
    if (t === this.current) {
      this._abort(t);
    } else {
      this.queue = this.queue.filter((x) => x !== t);
      if (t.claim) this.game.unclaim(t.claim, this);
      t.cancel?.(this);
    }
    this.refreshMarkers();
  }

  _abort(t) {
    if (t.claim) this.game.unclaim(t.claim, this);
    if (this.phase === 'mini') {
      this._miniToken = (this._miniToken || 0) + 1;
      this.game.minigames.abort();
    }
    if (this.phase === 'work' || this.phase === 'mini') t.cancel?.(this);
    this.current = null;
    this.phase = 'idle';
    this.view.setAction(null);
    this.ring.setVisible(false);
  }

  hasQueued(kind) {
    return (this.current && this.current.kind === kind) || this.queue.some((t) => t.kind === kind);
  }

  _fail(reason, silent) {
    const t = this.current;
    if (t?.claim) this.game.unclaim(t.claim, this);
    t?.cancel?.(this);
    this.current = null;
    this.phase = 'idle';
    this.view.setAction(null);
    this.ring.setVisible(false);
    if (reason && this.isOwner && !silent) {
      this.game.toast(reason, 'warn');
      this.view.setAction('shrug');
      setTimeout(() => this.view.action === 'shrug' && this.view.setAction(null), 700);
    }
    this.refreshMarkers();
  }

  _start() {
    while (this.queue.length) {
      const t = this.queue.shift();
      // conversion / prerequisite hooks
      if (t.pre) {
        const r = t.pre(this);
        if (r && r.replace) {
          // replace this task by others
          for (let i = r.replace.length - 1; i >= 0; i--) {
            this.queue.unshift(r.replace[i]);
            if (r.replace[i].claim) this.game.claim(r.replace[i].claim, this);
          }
          if (t.claim) this.game.unclaim(t.claim, this);
          continue;
        }
        if (r && r.before) {
          this.queue.unshift(t);
          for (let i = r.before.length - 1; i >= 0; i--) this.queue.unshift(r.before[i]);
          continue;
        }
      }
      const reason = t.check(this, true);
      if (reason) {
        this.current = t;
        this._fail(reason, t.silentFail?.(reason));
        continue;
      }
      this.current = t;
      const dst = t.dest(this);
      this.dest = dst;
      const path = this.game.bar.nav.findPath(this.pos.x, this.pos.z, dst.x, dst.z, true);
      if (!path) {
        this._fail('Impossible d’y accéder');
        continue;
      }
      this.path = path;
      this.phase = 'move';
      this.refreshMarkers();
      return;
    }
  }

  update(dt) {
    if (!this.current && this.queue.length) this._start();
    if (!this.current && !this.queue.length && !this.isOwner) this.game.staffAI.think(this);
    if (!this.current && this.queue.length) this._start();
    let moving = false;
    const v = this.view;
    if (this.current && this.phase === 'move') {
      if (this.path.length) {
        const tgt = this.path[0];
        const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        const step = this.speed * dt;
        if (d <= step) {
          this.pos.x = tgt.x;
          this.pos.z = tgt.z;
          this.path.shift();
        } else {
          this.pos.x += (dx / d) * step;
          this.pos.z += (dz / d) * step;
          v.targetFacing = Math.atan2(dx, dz);
          moving = true;
        }
      }
      if (!this.path.length) {
        if (this.dest.face !== undefined) v.targetFacing = this.dest.face;
        const t = this.current;
        const reason = t.check(this, false);
        if (reason) this._fail(reason, t.silentFail?.(reason));
        else {
          this.phase = 'work';
          this.timer = this.workDur = Math.max(0.05, t.duration(this));
          t.begin?.(this);
          if (t.anim) v.setAction(t.anim);
          // the owner plays a service mini-game instead of waiting
          const mg = this.isOwner && t.minigame && !this.game.autoService ? t.minigame(this) : null;
          if (mg) {
            this.phase = 'mini';
            const token = (this._miniToken = (this._miniToken || 0) + 1);
            this.game.minigames.start(mg.kind, mg.opts, (res) => {
              if (token !== this._miniToken || this.current !== t) return;
              if (!res) return this._fail(null, true);
              this._finishTask(t, res);
            });
          } else {
            // auto-played mini-games (tests) take as long as a human would
            if (this.isOwner && t.minigame && this.game.autoService) {
              const m2 = t.minigame(this);
              if (m2) this.timer = this.workDur = (AUTO_MINI_TIME[m2.kind] || this.workDur) * CONFIG.miniGameTimeScale;
            }
            this.ring.setVisible(this.workDur > 0.4);
          }
        }
      }
    } else if (this.current && this.phase === 'work') {
      this.timer -= dt;
      this.ringEl.style.strokeDashoffset = String(88 * Math.max(0, this.timer / this.workDur));
      if (this.timer <= 0) {
        const t = this.current;
        let res = null;
        if (t.minigame) {
          if (!this.isOwner) res = { quality: staffQuality(this.skill, this.game.rng) };
          else if (this.game.autoService) res = { quality: this.game.autoQuality() };
        }
        this._finishTask(t, res);
      }
    } else if (!this.current && !this.isOwner) {
      // wander back to idle post
      const post = this.role === 'barman' ? { x: 4.6, z: 1.0 } : { x: 8.8, z: 2.9 };
      this.idleT += dt;
      if (Math.hypot(this.pos.x - post.x, this.pos.z - post.z) > 0.6 && this.idleT > 1.5) {
        if (!this.path.length) this.path = this.game.bar.nav.findPath(this.pos.x, this.pos.z, post.x, post.z, true) || [];
      }
      if (this.path.length) {
        const tgt = this.path[0];
        const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        const step = this.speed * dt * 0.8;
        if (d <= step) {
          this.pos.x = tgt.x;
          this.pos.z = tgt.z;
          this.path.shift();
        } else {
          this.pos.x += (dx / d) * step;
          this.pos.z += (dz / d) * step;
          v.targetFacing = Math.atan2(dx, dz);
          moving = true;
        }
      }
    }
    if (this.current) this.idleT = 0;
    v.root.position[0] = this.pos.x;
    v.root.position[2] = this.pos.z;
    v.carry = this.hands.length || this.dirtyCount || this.carrying ? 1 : 0;
    v.update(dt, moving);
  }

  _finishTask(t, res) {
    const v = this.view;
    this.current = null;
    this.phase = 'idle';
    v.setAction(null);
    this.ring.setVisible(false);
    if (t.claim) this.game.unclaim(t.claim, this);
    const follow = t.done(this, res);
    if (Array.isArray(follow) && follow.length) {
      for (let i = follow.length - 1; i >= 0; i--) {
        this.queue.unshift(follow[i]);
        if (follow[i].claim) this.game.claim(follow[i].claim, this);
      }
    }
    if (!this.isOwner) this.gainXp(1);
    this.refreshMarkers();
  }

  // ---------------------------------------------------------------- hands
  pickUp(pid, q = 'good') {
    this.hands.push({ pid, q });
    this.refreshHands();
  }
  takeFromHands(pid, q) {
    let i = this.hands.findIndex((h) => h.pid === pid && (q === undefined || h.q === q));
    if (i < 0) i = this.hands.findIndex((h) => h.pid === pid);
    if (i < 0) return false;
    this.hands.splice(i, 1);
    this.refreshHands();
    return true;
  }
  refreshHands() {
    const v = this.view;
    v.clearHands();
    for (const c of [...this.carryNode.children]) this.carryNode.remove(c);
    if (this.carrying) {
      const n = this.carrying.kind === 'keg' ? makeKeg(this.game.products.get(this.carrying.beerId)?.handle ?? 0x888888) : makeCrate();
      n.setScale(0.8);
      n.position = [0, this.carrying.kind === 'keg' ? -0.22 : -0.05, 0];
      this.carryNode.add(n);
      return;
    }
    const P = this.game.products;
    const useTray = this.capacity > 2 && this.hands.length >= 2 && !this.dirtyCount;
    if (this.dirtyCount) {
      const tray = makeDirtyTray();
      tray.kindTag = 'tray';
      v.hold('L', tray);
      if (this.hands[0]) v.hold('R', makeServing(P.get(this.hands[0].pid)));
    } else if (useTray) {
      const tray = new Node('trayHolder');
      const t = makeTray();
      tray.add(t);
      tray.kindTag = 'tray';
      this.hands.forEach((h, i) => {
        const n = makeServing(P.get(h.pid));
        const a = (i / this.hands.length) * Math.PI * 2;
        n.position = [Math.cos(a) * 0.11, 0.01, Math.sin(a) * 0.11];
        tray.add(n);
      });
      v.hold('L', tray);
      tray.position = [0.08, 0.0, 0.12];
    } else {
      if (this.hands[0]) v.hold('R', makeServing(P.get(this.hands[0].pid)));
      if (this.hands[1]) v.hold('L', makeServing(P.get(this.hands[1].pid)));
    }
  }

  holdTool(kind) {
    const v = this.view;
    if (kind === 'mop') v.hold('R', makeMop());
    else if (kind === 'wrench') v.hold('R', makeWrench());
    else if (kind === 'rag') v.hold('R', makeRag());
    else if (kind === 'glass') {
      // a glass being filled in the left hand
      return null;
    }
  }

  gainXp(n) {
    if (!this.rec) return;
    this.rec.xp = (this.rec.xp || 0) + n;
    if (this.rec.xp >= 30) {
      this.rec.xp -= 30;
      const k = Math.random() < 0.5 ? 'speed' : 'service';
      if (this.rec[k] < 99) {
        this.rec[k] = Math.min(99, this.rec[k] + 2);
        this.stats = { speed: this.rec.speed, service: this.rec.service };
        this.game.toast(`${this.name} progresse : ${k === 'speed' ? 'Vitesse' : 'Service'} ${this.rec[k]}`, 'good');
      }
    }
  }

  // ---------------------------------------------------------------- markers
  refreshMarkers() {
    if (!this.isOwner) return;
    for (const m of this.markers) m.remove();
    this.markers = [];
    const list = [...(this.current ? [this.current] : []), ...this.queue];
    list.forEach((t, i) => {
      const p = t.markerPos?.();
      if (!p) return;
      const el = document.createElement('div');
      el.className = 'task-pin' + (i === 0 && this.current ? ' active' : '');
      el.innerHTML = `<span>${i + 1}</span>${t.icon ? iconHTML(t.icon, 14) : ''}`;
      this.markers.push(this.game.world.overlay.add(el, () => p, { offsetY: -2 }));
    });
    this.game.bus.emit('queue', { worker: this });
  }

  resetForNight(pos) {
    this.cancelAll();
    this.hands = [];
    this.dirty = { glasses: 0, bottles: 0, plates: 0 };
    this.carrying = null;
    this.refreshHands();
    if (pos) this.pos = { ...pos };
  }

  dispose() {
    this.cancelAll();
    this.view.root.removeFromParent();
    this.tag?.remove();
    this.ring.remove();
    this.game.world.removePickable(this);
  }
}
