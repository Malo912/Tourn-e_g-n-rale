// Build mode: catalogue, ghost placement on the grid, move / rotate / sell furniture and wall items.
import { h, clear, eur } from './dom.js';
import { iconHTML } from './icons.js';
import { CATALOG, CATALOG_CATS } from '../data/catalog.js';
import { buildItemModel } from '../world/models/furniture.js';
import { Node, Mesh, Material } from '../engine/scene.js';
import { MeshBuilder, box } from '../engine/geometry.js';
import { LAYOUT } from '../data/config.js';

export class BuildMode {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.active = false;
    this.def = null;
    this.rot = 0;
    this.ghost = null;
    this.moving = null; // uid of furniture being moved
    this.selected = null;
    this.tab = 'tables';
    this.sheet = h('div', { class: 'panel build-sheet', hidden: true });
    this.hint = h('div', { class: 'build-hint', hidden: true });
    ui.root.append(this.sheet, this.hint);
    this.ghostMatOk = new Material({ color: 0x7dffa8, opacity: 0.55, transparent: true, depthWrite: false, rim: 0.6, toon: 0.3 });
    this.ghostMatBad = new Material({ color: 0xff6b6b, opacity: 0.55, transparent: true, depthWrite: false, rim: 0.6, toon: 0.3 });
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.key === 'r' || e.key === 'R') this.rotate();
      if (e.key === 'Escape') {
        if (this.def) this.cancelGhost();
        else this.exit();
      }
    });
  }

  toggle() {
    if (this.active) this.exit();
    else this.enter();
  }

  enter() {
    const g = this.game;
    if (g.phase !== 'prep') return;
    this.active = true;
    this.ui.hud.classList.add('building');
    this.ui.root.classList.add('building');
    this.sheet.hidden = false;
    this._grid();
    this.renderSheet();
    g.bus.emit('buildMode', { on: true });
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.cancelGhost();
    this.selected = null;
    this.ui.hud.classList.remove('building');
    this.ui.root.classList.remove('building');
    this.sheet.hidden = true;
    this.hint.hidden = true;
    if (this.grid) this.grid.removeFromParent();
    this.grid = null;
    this.game.bus.emit('buildMode', { on: false });
    this.game.save.write();
  }

  _grid() {
    const g = this.game;
    if (this.grid) this.grid.removeFromParent();
    const { w, d } = g.roomSize();
    const b = new MeshBuilder();
    for (let x = 0; x <= w + 0.001; x += LAYOUT.cell) b.add(box(0.015, 0.004, d - 3), { color: 0xffffff, p: [x, 0.012, 3 + (d - 3) / 2] });
    for (let z = 3; z <= d + 0.001; z += LAYOUT.cell) b.add(box(w, 0.004, 0.015), { color: 0xffffff, p: [w / 2, 0.012, z] });
    const m = new Mesh(b.build(), new Material({ color: 0xfff3c4, opacity: 0.22, transparent: true, depthWrite: false, unlit: true }));
    m.castShadow = false;
    this.grid = new Node('grid');
    this.grid.add(m);
    g.world.dynamic.add(this.grid);
  }

  renderSheet() {
    const g = this.game;
    clear(this.sheet);
    const tabs = h('div', { class: 'tabs' });
    for (const c of CATALOG_CATS) tabs.append(h('button', { class: 'tab' + (this.tab === c.id ? ' on' : ''), onClick: () => { this.tab = c.id; this.renderSheet(); } }, c.label));
    const sc = g.bar.scores();
    const head = h('div', { class: 'build-head' },
      h('b', { html: `${iconHTML('hammer', 20)} Construire` }),
      h('span', { class: 'bstat', html: `Déco <b>${Math.round(sc.decor)}</b> · Jeux <b>${Math.round(sc.fun)}</b> · Ambiance <b>${Math.round(sc.ambiance)}</b> · Places <b>${g.bar.seatCount()}</b>` }),
      h('span', { class: 'money-inline', html: `${iconHTML('coin', 16)} <b>${eur(g.state.money)}</b>` }),
      h('button', { class: 'btn', onClick: () => this.exit() }, 'Terminer'),
    );
    const list = h('div', { class: 'build-list' });
    for (const def of CATALOG.filter((c) => c.cat === this.tab)) {
      const locked = def.level > g.level();
      const can = !locked && g.state.money >= def.price;
      const chips = [];
      if (def.seats) chips.push(`${def.seats.length} places`);
      if (def.comfort) chips.push(`Confort +${def.comfort}`);
      if (def.decor) chips.push(`Déco +${def.decor}`);
      if (def.fun) chips.push(`Jeux +${def.fun}`);
      if (def.ambiance) chips.push(`Ambiance +${def.ambiance}`);
      list.append(h('button', { class: 'bitem' + (locked ? ' locked' : '') + (this.def?.id === def.id ? ' on' : '') + (can ? '' : ' poor'), title: def.desc, onClick: () => { if (!locked) this.select(def); } },
        h('b', { text: def.name }),
        h('span', { class: 'bprice', html: locked ? `${iconHTML('lock', 13)} Niv. ${def.level}` : eur(def.price) }),
        h('span', { class: 'bchips', text: chips.join(' · ') }),
        h('span', { class: 'bdesc', text: def.desc }),
      ));
    }
    this.sheet.append(head, tabs, list);
    if (this.selected) {
      const s = this.selected;
      this.sheet.append(h('div', { class: 'sel-bar' },
        h('span', { html: `Sélection : <b>${s.def.name}</b>` }),
        !s.wall ? h('button', { class: 'btn', html: `${iconHTML('move', 16)} Déplacer`, onClick: () => this.startMove(s) }) : null,
        !s.wall ? h('button', { class: 'btn', html: `${iconHTML('rotate', 16)} Pivoter`, onClick: () => this.rotateInPlace(s) }) : null,
        h('button', { class: 'btn danger', html: `${iconHTML('trash', 16)} Vendre (${eur(Math.round(s.def.price * 0.5))})`, onClick: () => this.sell(s) }),
        h('button', { class: 'btn', onClick: () => { this.selected = null; this.renderSheet(); } }, 'Annuler'),
      ));
    }
  }

  select(def) {
    this.cancelGhost();
    this.selected = null;
    this.def = def;
    this.rot = 0;
    this._makeGhost(def);
    this.renderSheet();
  }

  _makeGhost(def) {
    const g = this.game;
    const node = buildItemModel(def, { posterBeer: () => g.randomUnlockedBeer(1), seed: 1, tvMode: () => 'clips' });
    node.traverse((n) => {
      if (n.isMesh) {
        n.material = this.ghostMatOk;
        n.castShadow = false;
        n.outline = 0;
      }
      if (n.isGlow) n.visible = false;
    });
    this.ghost = new Node('ghost');
    this.ghost.add(node);
    this.ghostInner = node;
    this.ghost.visible = false;
    if (def.wall) {
      g.world.dynamic.add(this.ghost);
    } else g.world.dynamic.add(this.ghost);
  }

  cancelGhost() {
    if (this.ghost) this.ghost.removeFromParent();
    this.ghost = null;
    this.def = null;
    this.moving = null;
    this.place = null;
    this.hint.hidden = true;
    if (this.active) this.renderSheet();
  }

  rotate() {
    if (this.def && !this.def.wall) this.rot = (this.rot + 1) % 4;
  }

  _snap(def, x, z, rot) {
    const [fw, fd] = def.footprint;
    const w = rot % 2 ? fd : fw, d = rot % 2 ? fw : fd;
    const c = LAYOUT.cell;
    const sx = (w % 2 ? c / 2 : 0), sz = (d % 2 ? c / 2 : 0);
    return { x: Math.round((x - sx) / c) * c + sx, z: Math.round((z - sz) / c) * c + sz };
  }

  _wallFrame(wall, t, y) {
    const { w, d } = this.game.roomSize();
    switch (wall) {
      case 'N': return { pos: [t, y, 0.03], rot: 0 };
      case 'W': return { pos: [0.03, y, d - t], rot: Math.PI / 2 };
      case 'E': return { pos: [w - 0.03, y, t], rot: -Math.PI / 2 };
      default: return { pos: [w - t, y, d - 0.03], rot: Math.PI };
    }
  }

  update() {
    if (!this.active || !this.def || !this.ghost) return;
    const g = this.game;
    const xy = g.hoverXY;
    if (!xy) {
      this.ghost.visible = false;
      return;
    }
    const def = this.def;
    let ok = false, reason = '';
    if (def.wall) {
      let wp = g.world.wallPoint(xy.x, xy.y);
      if (!wp) {
        // pointing at the floor close to a wall works too
        const fp = g.world.floorPoint(xy.x, xy.y);
        const { w, d } = g.roomSize();
        if (fp) {
          const cands = [
            { wall: 'N', dist: fp.z, t: fp.x },
            { wall: 'W', dist: fp.x, t: d - fp.z },
            { wall: 'E', dist: w - fp.x, t: fp.z },
          ].filter((c) => c.dist > -0.5 && c.dist < 1.6 && !g.world.room.isWallCut(c.wall));
          cands.sort((a, b) => a.dist - b.dist);
          if (cands[0]) wp = cands[0];
        }
      }
      if (!wp) {
        this.ghost.visible = false;
        this.place = null;
        this._hint('Visez un mur', xy, false);
        return;
      }
      const t = Math.round(wp.t * 4) / 4;
      const fr = this._wallFrame(wp.wall, t, def.y);
      this.ghost.position = fr.pos;
      this.ghost.rotation[1] = fr.rot;
      this.ghost.visible = true;
      reason = g.bar.canPlaceWall(def, wp.wall, t);
      ok = !reason;
      this.place = ok ? { wall: wp.wall, t } : null;
    } else {
      const fp = g.world.floorPoint(xy.x, xy.y);
      if (!fp) return;
      const s = this._snap(def, fp.x, fp.z, this.rot);
      this.ghost.position = [s.x, 0.02, s.z];
      this.ghost.rotation[1] = (this.rot * Math.PI) / 2;
      this.ghost.visible = true;
      reason = g.bar.canPlace(def, s.x, s.z, this.rot, this.moving);
      ok = !reason;
      this.place = ok ? { x: s.x, z: s.z, rot: this.rot } : null;
    }
    if (ok && !this.moving && g.state.money < def.price) {
      ok = false;
      reason = 'Pas assez d’argent';
      this.place = null;
    }
    const mat = ok ? this.ghostMatOk : this.ghostMatBad;
    this.ghostInner.traverse((n) => n.isMesh && (n.material = mat));
    this._hint(ok ? (this.moving ? 'Cliquez pour poser' : `Cliquez pour acheter (${eur(def.price)})${def.wall ? '' : ' · R : pivoter'}`) : reason, xy, ok);
  }

  _hint(text, xy, ok) {
    this.hint.hidden = false;
    this.hint.textContent = text;
    this.hint.className = 'build-hint ' + (ok ? 'ok' : 'bad');
    this.hint.style.transform = `translate(${xy.x + 18}px, ${xy.y - 34}px)`;
  }

  tap(x, y) {
    const g = this.game;
    if (this.def) {
      g.hoverXY = { x, y };
      this.update();
      if (!this.place) {
        g.audio?.ui('warn');
        return true;
      }
      const def = this.def;
      if (this.moving) {
        g.bar.move(this.moving, this.place.x, this.place.z, this.place.rot);
        g.audio?.ui('place');
        this.cancelGhost();
        return true;
      }
      if (g.state.money < def.price) return true;
      g.spend(def.price, 'build');
      if (def.wall) g.bar.placeWall(def, this.place.wall, this.place.t);
      else g.bar.place(def, this.place.x, this.place.z, this.place.rot);
      g.world.effects.burst('dust', def.wall ? this.ghost.position : [this.place.x, 0.1, this.place.z]);
      g.audio?.ui('place');
      g.bus.emit('built', { def });
      g.checkObjectives();
      if (g.state.money < def.price) this.cancelGhost();
      else this.renderSheet();
      return true;
    }
    // select existing item
    const fp = g.world.floorPoint(x, y);
    let found = null;
    const wp = g.world.wallPoint(x, y);
    if (wp) {
      for (const w of g.bar.wallItems) {
        if (w.wall !== wp.wall) continue;
        if (Math.abs(w.t - wp.t) < w.def.size[0] / 2 && Math.abs(wp.y - w.def.y) < w.def.size[1] / 2 + 0.1) found = { wall: true, uid: w.uid, def: w.def, item: w };
      }
    }
    if (!found && fp) {
      for (const f of g.bar.furniture) {
        const r = g.bar.itemRect(f.def, f.x, f.z, f.rot);
        if (fp.x >= r.x0 && fp.x <= r.x1 && fp.z >= r.z0 && fp.z <= r.z1) found = { wall: false, uid: f.uid, def: f.def, item: f };
      }
    }
    if (this.selected?.item?.meshes) for (const m of this.selected.item.meshes) m.flash = null;
    this.selected = found;
    if (found?.item?.meshes) for (const m of found.item.meshes) m.flash = [0.15, 0.12, 0.02];
    this.renderSheet();
    return true;
  }

  startMove(s) {
    this.def = s.def;
    this.rot = s.item.rot;
    this.moving = s.uid;
    this.selected = null;
    this._makeGhost(s.def);
    this.renderSheet();
  }

  rotateInPlace(s) {
    const g = this.game;
    const it = s.item;
    for (let k = 1; k <= 3; k++) {
      const r = (it.rot + k) % 4;
      const p = this._snap(s.def, it.x, it.z, r);
      if (!g.bar.canPlace(s.def, p.x, p.z, r, it.uid)) {
        g.bar.move(it.uid, p.x, p.z, r);
        this.selected = null;
        this.renderSheet();
        return;
      }
    }
    g.toast('Pas la place de le pivoter ici', 'warn');
  }

  sell(s) {
    const g = this.game;
    const it = s.item;
    if (!s.wall && it.spot && (it.spot.group || it.spot.reserved)) return g.toast('Des clients sont assis ici', 'warn');
    if (!s.wall && it.def.seats && g.bar.tableCount() <= 1) return g.toast('Gardez au moins une table !', 'warn');
    const def = s.wall ? g.bar.removeWall(s.uid) : g.bar.remove(s.uid);
    if (def) {
      g.state.money += Math.round(def.price * 0.5);
      g.bus.emit('money', {});
      g.audio?.ui('sell');
    }
    this.selected = null;
    this.renderSheet();
  }
}
