// Rendering front-end: renderer, camera rig, room, fixtures, effects, overlay & picking.
import { Renderer } from '../engine/Renderer.js';
import { Camera, CameraRig } from '../engine/Camera.js';
import { Node } from '../engine/scene.js';
import { Room } from './Room.js';
import { Effects } from './Effects.js';
import { Overlay } from './Overlay.js';
import { buildCounter, buildBackBar, ChalkboardView, NeonNameView, RegisterView, GlassRackView } from './models/bar.js';
import { redrawTextTextures } from './textures.js';

export class World3D {
  constructor(game, canvas, overlayEl) {
    this.game = game;
    this.canvas = canvas;
    this.quality = 'high';
    this.renderer = new Renderer(canvas, { antialias: true, shadows: true, shadowSize: 2048 });
    this.camera = new Camera(30, 1);
    this.rig = new CameraRig(this.camera, canvas);
    this.scene = new Node('scene');
    this.room = new Room(this.scene);
    this.room.onOpen = (name) => name !== 'wc' && game.bus.emit('door', { name });
    this.dynamic = new Node('dynamic');
    this.scene.add(this.dynamic);
    this.effects = new Effects(this.scene);
    this.overlay = new Overlay(overlayEl, this.camera);
    this.pickables = new Set();
    this.time = 0;
    this.updaters = new Set();
    this.fixtures = new Node('fixtures');
    this.scene.add(this.fixtures);
    this.fixtures.add(buildCounter());
    this.fixtures.add(buildBackBar());
    this.chalk = new ChalkboardView(() => game.menuLines());
    this.fixtures.add(this.chalk.node);
    this.neon = new NeonNameView(() => game.state?.barName || 'Chez Malo');
    this.fixtures.add(this.neon.node);
    this.register = new RegisterView();
    this.fixtures.add(this.register.node);
    this.glassRack = new GlassRackView();
    this.fixtures.add(this.glassRack.node);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => redrawTextTextures());
    setTimeout(() => redrawTextTextures(), 1500);
  }

  buildRoom(w, d) {
    this.room.build(w, d);
    this.renderer.env.points = this.room.lamps;
    this.renderer.env.shadowCenter = [w / 2, 0, d / 2];
    this.renderer.env.shadowRadius = Math.max(w, d) * 0.62 + 1;
    this.rig.bounds = { minX: -1, maxX: w + 1, minZ: -0.5, maxZ: d + 2 };
    this.room.updateCutaway(this.camera.position, true);
  }

  setQuality(q) {
    this.quality = q;
    this.renderer.shadows = q !== 'low';
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = this.quality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : 1.5);
    this.renderer.setSize(w, h, dpr);
    this.camera.aspect = w / h;
    this.w = w;
    this.h = h;
    // phones: zoom out a bit in portrait
    if (w < h) this.camera.fov = 44;
    else this.camera.fov = 30;
  }

  addPickable(p) {
    this.pickables.add(p);
  }
  removePickable(p) {
    this.pickables.delete(p);
  }

  _ray(cx, cy) {
    const rect = this.canvas.getBoundingClientRect();
    const nx = ((cx - rect.left) / rect.width) * 2 - 1;
    const ny = -(((cy - rect.top) / rect.height) * 2 - 1);
    this.camera.update();
    return this.camera.ray(nx, ny);
  }

  pick(cx, cy, filter) {
    const { o, d } = this._ray(cx, cy);
    let best = null, bd = Infinity;
    for (const p of this.pickables) {
      if (filter && !filter(p)) continue;
      if (p.pickable === false) continue;
      const b = p.pickBox();
      if (!b) continue;
      const t = rayBox(o, d, b);
      if (t !== null) {
        const score = t - (p.pickPriority || 0);
        if (score < bd) {
          bd = score;
          best = p;
        }
      }
    }
    return best;
  }

  floorPoint(cx, cy, y = 0) {
    const { o, d } = this._ray(cx, cy);
    if (Math.abs(d[1]) < 1e-5) return null;
    const t = (y - o[1]) / d[1];
    if (t < 0) return null;
    return { x: o[0] + d[0] * t, z: o[2] + d[2] * t };
  }

  /** intersect visible (full) walls; returns {wall, t, y} */
  wallPoint(cx, cy) {
    const { o, d } = this._ray(cx, cy);
    const { w, d: D } = this.room.size;
    let best = null;
    const test = (id, axis, value, along, len, flip) => {
      if (this.room.isWallCut(id)) return;
      const den = d[axis];
      if (Math.abs(den) < 1e-6) return;
      const t = (value - o[axis]) / den;
      if (t < 0) return;
      const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
      if (p[1] < 0 || p[1] > 3.2) return;
      let a = p[along];
      if (a < 0 || a > len) return;
      if (flip) a = len - a;
      if (!best || t < best.dist) best = { wall: id, t: a, y: p[1], dist: t };
    };
    test('N', 2, 0.02, 0, w, false);
    test('W', 0, 0.02, 2, D, true);
    test('E', 0, w - 0.02, 2, D, false);
    test('S', 2, D - 0.02, 0, w, true);
    return best;
  }

  update(dt) {
    this.time += dt;
    this.rig.update(dt);
    this.room.updateCutaway(this.camera.position);
    this.room.update(dt, this.time);
    this.neon.update(dt);
    this.register.update(dt);
    this.effects.update(dt);
    for (const u of this.updaters) u(dt, this.time);
  }

  render(dt) {
    this.renderer.render(this.scene, this.camera, dt);
    this.overlay.update(dt, this.w, this.h);
  }
}

function rayBox(o, d, b) {
  let tmin = -Infinity, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const inv = 1 / (d[i] || 1e-9);
    let t1 = (b[i] - o[i]) * inv, t2 = (b[i + 3] - o[i]) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmax < tmin) return null;
  }
  return tmax < 0 ? null : Math.max(0, tmin);
}
