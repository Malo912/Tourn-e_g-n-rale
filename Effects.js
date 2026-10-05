// Lightweight particle bursts (foam, coins, sparkles, steam, confetti, splashes).
import { Mesh, Glow, Node } from '../engine/scene.js';
import { MeshBuilder, sphere, cylinder, box } from '../engine/geometry.js';
import { colorMat, MATS } from './materials.js';

const geos = {};
function geo(k) {
  if (!geos[k]) {
    const b = new MeshBuilder();
    if (k === 'ball') b.add(sphere(0.04, 6, 5), { color: 0xffffff });
    if (k === 'coin') b.add(cylinder(0.05, 0.05, 0.012, 12), { color: 0xffffff });
    if (k === 'chip') b.add(box(0.05, 0.05, 0.008), { color: 0xffffff });
    geos[k] = b.build();
  }
  return geos[k];
}

const KINDS = {
  foam: { geo: 'ball', color: 0xfffaf0, n: 10, speed: [0.6, 1.6], up: [1.2, 2.4], life: [0.6, 1.1], g: 5, size: [0.6, 1.2] },
  splash: { geo: 'ball', color: 0xf2b01e, n: 12, speed: [0.8, 1.8], up: [1, 2], life: [0.5, 0.9], g: 7, size: [0.5, 1] },
  coins: { geo: 'coin', color: 0xf4c430, n: 7, speed: [0.3, 0.9], up: [2.2, 3.2], life: [0.7, 1.0], g: 7, size: [1, 1.2], spin: true, mat: { spec: 0.9, emissive: 0x5a3a00, emissiveIntensity: 0.4 } },
  confetti: { geo: 'chip', color: null, n: 26, speed: [1, 2.4], up: [2.5, 4], life: [1.2, 2], g: 4, size: [0.8, 1.3], spin: true, palette: [0xef476f, 0xffd166, 0x06d6a0, 0x118ab2, 0xf77f00] },
  dust: { geo: 'ball', color: 0xd8c8b0, n: 8, speed: [0.3, 0.8], up: [0.3, 0.8], life: [0.4, 0.7], g: -0.5, size: [0.8, 1.6] },
  glass: { geo: 'chip', color: 0xcfe9ff, n: 12, speed: [1, 2.2], up: [1, 2], life: [0.5, 0.9], g: 9, size: [0.6, 1], spin: true },
  anger: { geo: 'ball', color: 0x3a3a3a, n: 5, speed: [0.1, 0.3], up: [0.6, 1.0], life: [0.6, 1.0], g: -0.6, size: [1, 1.8] },
};

export class Effects {
  constructor(scene) {
    this.root = new Node('fx');
    scene.add(this.root);
    this.parts = [];
    this.glows = [];
    this.pool = new Map();
  }
  _get(kind, color) {
    const k = KINDS[kind];
    const key = kind + ':' + color;
    const list = this.pool.get(key);
    if (list && list.length) return list.pop();
    const m = new Mesh(geo(k.geo), colorMat(color, { toon: 0.6, rim: 0.3, ...(k.mat || {}) }));
    m.castShadow = false;
    m.poolKey = key;
    return m;
  }
  burst(kind, pos, count) {
    const k = KINDS[kind];
    if (!k) return;
    const n = count ?? k.n;
    for (let i = 0; i < n; i++) {
      const color = k.palette ? k.palette[i % k.palette.length] : k.color;
      const m = this._get(kind, color);
      const a = Math.random() * Math.PI * 2;
      const sp = k.speed[0] + Math.random() * (k.speed[1] - k.speed[0]);
      m.position = [pos[0], pos[1], pos[2]];
      const s = k.size[0] + Math.random() * (k.size[1] - k.size[0]);
      m.setScale(s);
      m.rotation = [Math.random() * 3, Math.random() * 3, 0];
      this.root.add(m);
      this.parts.push({
        m, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: k.up[0] + Math.random() * (k.up[1] - k.up[0]),
        life: k.life[0] + Math.random() * (k.life[1] - k.life[0]), t: 0, g: k.g, s, spin: k.spin,
      });
    }
  }
  sparkle(pos, color = 0xfff2a8, n = 6) {
    for (let i = 0; i < n; i++) {
      const g = new Glow(color, 0.25 + Math.random() * 0.2, 0.9);
      g.position = [pos[0] + (Math.random() - 0.5) * 0.6, pos[1] + Math.random() * 0.4, pos[2] + (Math.random() - 0.5) * 0.6];
      this.root.add(g);
      this.glows.push({ g, t: 0, life: 0.5 + Math.random() * 0.4, vy: 0.4 + Math.random() * 0.4, base: g.intensity });
    }
  }
  steam(pos, n = 4, color = 0xffffff) {
    for (let i = 0; i < n; i++) {
      const g = new Glow(color, 0.3, 0.25);
      g.position = [pos[0] + (Math.random() - 0.5) * 0.2, pos[1], pos[2] + (Math.random() - 0.5) * 0.2];
      this.root.add(g);
      this.glows.push({ g, t: -i * 0.15, life: 1.2, vy: 0.5, base: 0.25, grow: 1.5 });
    }
  }
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      const m = p.m;
      p.vy -= p.g * dt;
      m.position[0] += p.vx * dt;
      m.position[1] += p.vy * dt;
      m.position[2] += p.vz * dt;
      if (m.position[1] < 0.02 && p.g > 0) {
        m.position[1] = 0.02;
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
      if (p.spin) {
        m.rotation[0] += dt * 9;
        m.rotation[2] += dt * 7;
      }
      const k = 1 - Math.max(0, (p.t - p.life * 0.6) / (p.life * 0.4));
      m.setScale(p.s * Math.max(0.01, k));
      if (p.t >= p.life) {
        this.root.remove(m);
        if (!this.pool.has(m.poolKey)) this.pool.set(m.poolKey, []);
        this.pool.get(m.poolKey).push(m);
        this.parts.splice(i, 1);
      }
    }
    for (let i = this.glows.length - 1; i >= 0; i--) {
      const q = this.glows[i];
      q.t += dt;
      if (q.t < 0) {
        q.g.intensity = 0;
        continue;
      }
      q.g.position[1] += q.vy * dt;
      const k = Math.sin(Math.min(1, q.t / q.life) * Math.PI);
      q.g.intensity = q.base * k;
      if (q.grow) q.g.size = 0.3 + q.t * q.grow * 0.3;
      if (q.t >= q.life) {
        this.root.remove(q.g);
        this.glows.splice(i, 1);
      }
    }
  }
  clear() {
    for (const p of this.parts) this.root.remove(p.m);
    for (const q of this.glows) this.root.remove(q.g);
    this.parts.length = 0;
    this.glows.length = 0;
  }
}
