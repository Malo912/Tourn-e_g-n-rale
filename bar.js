// Bar fixtures: counter, back bar, taps, fridge, food stations, dishwasher, glass rack, register, chalkboard, neon.
import { Node, Mesh, Glow, Material } from '../../engine/scene.js';
import { MeshBuilder, box, roundedBox, cylinder, lathe, sphere, torus, quad, capsule } from '../../engine/geometry.js';
import { MATS, PAL, colorMat, texMat, liquidMat } from '../materials.js';
import { beerBadge, chalkboard, neonSign } from '../textures.js';
import { LAYOUT } from '../../data/config.js';
import { RNG } from '../../core/rng.js';
import { damp, mixHex } from '../../engine/math.js';

const L = LAYOUT;
const TOP = L.counter.top;

export function buildCounter() {
  const n = new Node('counter');
  const b = new MeshBuilder();
  const c = L.counter;
  const len = c.x1 - c.x0;
  const cx = (c.x0 + c.x1) / 2;
  // body
  b.add(box(len, TOP - 0.06, 0.46), { color: PAL.woodRed, p: [cx, (TOP - 0.06) / 2, 1.76] });
  // front raised panels (customer side z ~ 2.0)
  for (let x = c.x0 + 0.45; x < c.x1 - 0.2; x += 0.9) {
    b.add(roundedBox(0.72, 0.62, 0.04, 0.02, 2), { color: mixHex(PAL.woodRed, 0x000000, 0.18), p: [x, 0.52, 2.0] });
    b.add(roundedBox(0.6, 0.5, 0.03, 0.02, 2), { color: PAL.woodRed, p: [x, 0.52, 2.02] });
  }
  b.add(box(len, 0.12, 0.06), { color: 0x2c1a10, p: [cx, 0.06, 2.0] });
  // top slab
  b.add(roundedBox(len + 0.05, 0.07, 0.86, 0.025, 2), { color: PAL.woodDark, p: [cx, TOP - 0.035, 1.8] });
  b.add(box(len + 0.05, 0.02, 0.03), { color: PAL.brass, p: [cx, TOP - 0.06, 2.22] });
  // brass foot rail + brackets
  b.add(cylinder(0.03, 0.03, len - 0.2, 10), { color: PAL.brass, r: [0, 0, Math.PI / 2], p: [cx, 0.2, 2.22] });
  for (let x = c.x0 + 0.4; x < c.x1; x += 1.6) b.add(box(0.04, 0.04, 0.22), { color: PAL.brass, p: [x, 0.2, 2.1] });
  // staff side: under-counter shelf
  b.add(box(len, 0.04, 0.3), { color: PAL.woodMid, p: [cx, 0.45, 1.5] });
  b.add(box(len, 0.85, 0.02), { color: 0x2c1a10, p: [cx, 0.5, 1.54] });
  // drip tray strip under taps
  b.add(roundedBox(4.8, 0.03, 0.18, 0.01, 1), { color: PAL.steel, p: [4.65, TOP + 0.01, 1.55] });
  // flap side: end cabinet
  const sb = L.sideBlock;
  b.add(box(sb.x1 - sb.x0, TOP - 0.05, sb.z1 - sb.z0), { color: PAL.woodRed, p: [(sb.x0 + sb.x1) / 2, (TOP - 0.05) / 2, (sb.z0 + sb.z1) / 2] });
  b.add(roundedBox(sb.x1 - sb.x0 + 0.08, 0.07, sb.z1 - sb.z0 + 0.08, 0.025, 2), { color: PAL.woodDark, p: [(sb.x0 + sb.x1) / 2, TOP - 0.035, (sb.z0 + sb.z1) / 2] });
  // swinging half-doors at both flaps (low)
  b.add(roundedBox(0.95, 0.75, 0.05, 0.02, 2), { color: PAL.woodMid, p: [8.5, 0.45, 1.98] });
  b.add(roundedBox(0.95, 0.75, 0.05, 0.02, 2), { color: PAL.woodMid, p: [0.5, 0.45, 1.98] });
  // end panels
  b.add(roundedBox(0.06, TOP - 0.05, 0.5, 0.02, 1), { color: mixHex(PAL.woodRed, 0x000000, 0.15), p: [c.x0 + 0.03, (TOP - 0.05) / 2, 1.75] });
  const m = new Mesh(b.build(), MATS.vc);
  m.outline = 0.01;
  m.static = true;
  n.add(m);
  return n;
}

/** Back bar: cabinets, mirror, shelves full of bottles. Static. */
export function buildBackBar() {
  const n = new Node('backbar');
  const b = new MeshBuilder();
  const shiny = new MeshBuilder();
  const x0 = 0, x1 = 6.8;
  // low cabinet along wall
  b.add(box(x1 - x0, 0.92, 0.5), { color: PAL.woodRed, p: [(x0 + x1) / 2, 0.46, 0.25] });
  b.add(roundedBox(x1 - x0 + 0.04, 0.06, 0.56, 0.02, 2), { color: PAL.woodDark, p: [(x0 + x1) / 2, 0.95, 0.27] });
  for (let x = x0 + 0.35; x < x1; x += 0.7) b.add(roundedBox(0.6, 0.7, 0.03, 0.02, 2), { color: mixHex(PAL.woodRed, 0x000000, 0.15), p: [x, 0.45, 0.51] });
  // mirror + shelves only above the bottle section
  const sx0 = 2.45, sx1 = 6.75;
  shiny.add(box(sx1 - sx0, 1.1, 0.02), { color: 0x9fb8c4, p: [(sx0 + sx1) / 2, 1.6, 0.03] });
  for (const y of [1.25, 1.65, 2.05]) b.add(roundedBox(sx1 - sx0, 0.04, 0.3, 0.01, 1), { color: PAL.woodDark, p: [(sx0 + sx1) / 2, y, 0.17] });
  for (const x of [sx0, sx1]) b.add(box(0.06, 1.2, 0.32), { color: PAL.woodDark, p: [x, 1.6, 0.17] });
  b.add(roundedBox(sx1 - sx0 + 0.2, 0.1, 0.36, 0.02, 1), { color: PAL.woodDark, p: [(sx0 + sx1) / 2, 2.2, 0.18] });
  // bottles
  const rng = new RNG(21);
  const cols = [0x2e6b3a, 0x6b4a1a, 0xe9e2c9, 0x8b2f22, 0x1d3557, 0xd9a441, 0x5a2a12, 0x9fd3c7, 0xc0392b];
  for (const y of [1.27, 1.67, 2.07]) {
    let x = sx0 + 0.12;
    while (x < sx1 - 0.1) {
      const col = rng.pick(cols);
      const h = rng.range(0.22, 0.32);
      const r = rng.range(0.035, 0.05);
      shiny.add(lathe([[0.0001, 0], [r, 0], [r, h * 0.62], [r * 0.4, h * 0.8], [r * 0.32, h], [r * 0.36, h + 0.02]], 10, { capTop: true }), { color: col, p: [x, y + 0.02, 0.17 + rng.range(-0.04, 0.04)] });
      if (rng.chance(0.7)) b.add(cylinder(r + 0.002, r + 0.002, h * 0.25, 10, { open: true }), { color: rng.pick([0xf3e2c0, 0xffffff, 0x222222, 0xd62828]), p: [x, y + 0.02 + h * 0.3, 0.17] });
      x += r * 2 + rng.range(0.02, 0.06);
    }
  }
  // food prep corner: hanging bar for saucissons
  b.add(cylinder(0.015, 0.015, 1.1, 6), { color: PAL.brass, r: [0, 0, Math.PI / 2], p: [L.board.x, 1.95, 0.18] });
  b.add(box(0.03, 0.12, 0.15), { color: PAL.brass, p: [L.board.x - 0.55, 1.95, 0.09] });
  b.add(box(0.03, 0.12, 0.15), { color: PAL.brass, p: [L.board.x + 0.55, 1.95, 0.09] });
  // little shelf with jars above snack corner
  b.add(roundedBox(0.8, 0.04, 0.25, 0.01, 1), { color: PAL.woodDark, p: [L.snack.x, 1.55, 0.13] });
  for (let i = 0; i < 3; i++) shiny.add(lathe([[0.0001, 0], [0.07, 0], [0.07, 0.18], [0.05, 0.2], [0.05, 0.22]], 12, { capTop: true }), { color: [0xe9c46a, 0x8ab17d, 0xe76f51][i], p: [L.snack.x - 0.25 + i * 0.25, 1.57, 0.13] });
  // cabinet (beyond fridge) near reserve door
  b.add(box(0.1, 0.92, 0.5), { color: PAL.woodRed, p: [6.8, 0.46, 0.25] });
  const m = new Mesh(b.build(), MATS.vc);
  m.static = true;
  const s = new Mesh(shiny.build(), MATS.vcShiny);
  s.static = true;
  s.castShadow = false;
  n.add(m, s);
  // shelf lights
  const g1 = new Glow(0xffcf8a, 1.4, 0.25);
  g1.position = [(sx0 + sx1) / 2, 2.2, 0.35];
  n.add(g1);
  return n;
}

// ------------------------------------------------ Tap
const tapGeo = (() => {
  let g = null;
  return () => {
    if (g) return g;
    const b = new MeshBuilder();
    b.add(cylinder(0.09, 0.11, 0.04, 16), { color: PAL.chrome, p: [0, 0.02, 0] });
    b.add(cylinder(0.04, 0.045, 0.42, 12), { color: PAL.chrome, p: [0, 0.23, 0] });
    b.add(sphere(0.06, 12, 8), { color: PAL.chrome, p: [0, 0.45, 0] });
    b.add(cylinder(0.03, 0.03, 0.18, 10), { color: PAL.chrome, r: [Math.PI / 2, 0, 0], p: [0, 0.44, -0.09] });
    b.add(cylinder(0.022, 0.016, 0.08, 10), { color: PAL.chrome, p: [0, 0.4, -0.17] });
    // frost ring
    b.add(cylinder(0.046, 0.046, 0.1, 12, { open: true }), { color: 0xe8f4ff, p: [0, 0.3, 0] });
    g = b.build();
    return g;
  };
})();
const handleGeo = (() => {
  let g = null;
  return () => {
    if (g) return g;
    const b = new MeshBuilder();
    b.add(capsule(0.03, 0.2, 10, 3), { color: 0xffffff, p: [0, 0.13, 0] });
    b.add(cylinder(0.018, 0.018, 0.04, 8), { color: 0xd6dde3, p: [0, 0.0, 0] });
    g = b.build();
    return g;
  };
})();

export class TapView {
  constructor(slotX) {
    this.node = new Node('tap');
    this.node.position = [slotX, TOP, 1.62];
    const tower = new Mesh(tapGeo(), MATS.vcShiny);
    tower.outline = 0.006;
    this.node.add(tower);
    this.handlePivot = new Node('handlePivot');
    this.handlePivot.position = [0, 0.48, -0.17];
    this.handle = new Mesh(handleGeo(), colorMat(0x888888, { rim: 0.3 }));
    this.handle.outline = 0.006;
    this.handlePivot.add(this.handle);
    this.badge = new Mesh(new MeshBuilder().add(cylinder(0.055, 0.055, 0.012, 20), { color: 0xffffff, r: [Math.PI / 2, 0, 0] }).build(), new Material({ toon: 0.3, rim: 0.1 }));
    this.badge.position = [0, 0.17, 0.035];
    this.badge.castShadow = false;
    this.handlePivot.add(this.badge);
    this.node.add(this.handlePivot);
    // status light (red when empty/broken)
    this.light = new Glow(0xff3b30, 0.35, 0);
    this.light.position = [0, 0.62, 0];
    this.node.add(this.light);
    // beer stream while pouring
    this.stream = new Mesh(new MeshBuilder().add(cylinder(0.011, 0.014, 0.26, 8), { color: 0xffffff }).build(), liquidMat(0xf2b01e));
    this.stream.position = [0, 0.24, -0.17];
    this.stream.castShadow = false;
    this.stream.visible = false;
    this.node.add(this.stream);
    this.pull = 0;
    this.pullTarget = 0;
    this.alarm = 0;
    this.t = 0;
    this.meshes = [tower, this.handle, this.badge];
  }
  setBeer(beer) {
    this.beer = beer;
    if (!beer) {
      this.handle.material = colorMat(0x6b6b6b);
      this.badge.visible = false;
      return;
    }
    this.handle.material = colorMat(beer.handle ?? 0x888888, { rim: 0.35, spec: 0.3 });
    this.stream.material = liquidMat(beer.liquid);
    this.badge.visible = true;
    this.badge.material = new Material({ map: beerBadge(beer), toon: 0.3, rim: 0.1 });
  }
  setHighlight(on) {
    for (const m of this.meshes) m.flash = on ? [0.12, 0.09, 0.03] : null;
  }
  update(dt, state) {
    this.t += dt;
    this.pull = damp(this.pull, this.pullTarget, 10, dt);
    this.handlePivot.rotation[0] = -this.pull * 0.7;
    this.stream.visible = this.pull > 0.6 && !!this.beer;
    if (this.stream.visible) this.stream.scale[0] = this.stream.scale[2] = 0.85 + 0.25 * Math.sin(this.t * 40);
    const alarm = state.broken ? 1 : state.empty ? 0.6 : 0;
    this.light.intensity = alarm > 0 ? (Math.sin(this.t * (state.broken ? 12 : 5)) > 0 ? 0.9 * alarm : 0.15) : 0;
    if (state.broken) this.handlePivot.rotation[2] = Math.sin(this.t * 30) * 0.06;
    else this.handlePivot.rotation[2] = 0;
  }
  nozzleWorld() {
    return [this.node.position[0], TOP + 0.38, 1.62 - 0.17];
  }
}

// ------------------------------------------------ Fridge
export class FridgeView {
  constructor(products) {
    const f = L.fridge;
    this.node = new Node('fridge');
    this.node.position = [f.x, 0, 0];
    const b = new MeshBuilder();
    const w = f.w, h = 1.95, d = 0.62;
    b.add(roundedBox(w, h, d, 0.05, 2), { color: 0x7d1f2b, p: [0, h / 2, d / 2] });
    b.add(box(w - 0.14, h - 0.32, 0.02), { color: 0x0d1a24, p: [0, h / 2 + 0.04, d + 0.005] });
    b.add(roundedBox(w + 0.02, 0.22, 0.04, 0.02, 2), { color: 0x2b2b2b, p: [0, h - 0.11, d + 0.01] });
    b.add(box(0.04, 0.5, 0.05), { color: PAL.chrome, p: [w / 2 - 0.12, h / 2, d + 0.04] });
    b.add(box(w - 0.1, 0.12, 0.03), { color: 0x2b2b2b, p: [0, 0.06, d + 0.01] });
    const body = new Mesh(b.build(), MATS.vc);
    body.outline = 0.01;
    this.node.add(body);
    // inside light
    this.innerGlow = new Glow(0x9fd8ff, 1.0, 0.35);
    this.innerGlow.position = [0, 1.1, d + 0.1];
    this.node.add(this.innerGlow);
    const glass = new Mesh(new MeshBuilder().add(quad(w - 0.14, h - 0.32), { color: 0xffffff }).build(), MATS.fridgeGlass);
    glass.position = [0, h / 2 + 0.04, d + 0.03];
    glass.castShadow = false;
    this.node.add(glass);
    // shelves lines
    const sb = new MeshBuilder();
    for (const y of [0.42, 0.82, 1.22, 1.62]) sb.add(box(w - 0.16, 0.015, 0.4), { color: 0xcfe6f2, p: [0, y, d - 0.2] });
    const shelves = new Mesh(sb.build(), colorMat(0xffffff, { emissive: 0x5aa0c8, emissiveIntensity: 0.25 }));
    shelves.castShadow = false;
    this.node.add(shelves);
    this.bottles = null;
    this.meshes = [body];
    this.depth = d;
    this.w = w;
    this._key = '';
    // sign on top
    this.sign = new Glow(0xffffff, 0.01, 0);
  }
  setStock(list, capacity, catalog) {
    // list: [{id, count}]
    const key = list.map((x) => x.id + ':' + x.count).join('|') + '/' + capacity;
    if (key === this._key) return;
    this._key = key;
    if (this.bottles) this.node.remove(this.bottles);
    const b = new MeshBuilder();
    const rows = [0.43, 0.83, 1.23, 1.63];
    const perRow = Math.max(6, Math.ceil(capacity / rows.length));
    const slots = [];
    for (const r of rows) for (let i = 0; i < perRow; i++) slots.push([-(this.w - 0.3) / 2 + (i + 0.5) * ((this.w - 0.3) / perRow), r]);
    let k = 0;
    for (const it of list) {
      const p = catalog.get(it.id);
      if (!p) continue;
      const spec = p.bottle || {};
      const col = spec.can ? p.color ?? 0xd62828 : spec.glass ?? 0x6b4a1a;
      for (let i = 0; i < it.count && k < slots.length; i++, k++) {
        const [x, y] = slots[k];
        const z = this.depth - 0.2 + ((k % 2) * 0.08 - 0.04);
        if (spec.can) b.add(cylinder(0.035, 0.035, 0.13, 8), { color: col, p: [x, y + 0.075, z] });
        else {
          b.add(lathe([[0.0001, 0], [0.032, 0], [0.032, 0.15], [0.014, 0.22], [0.014, 0.25]], 8, { capTop: true }), { color: col, p: [x, y + 0.01, z] });
          b.add(cylinder(0.034, 0.034, 0.05, 8, { open: true }), { color: p.label ? parseInt(p.label.bg.slice(1), 16) : 0xffffff, p: [x, y + 0.08, z] });
        }
      }
    }
    if (!b.empty) {
      this.bottles = new Mesh(b.build(), MATS.vcShiny);
      this.bottles.castShadow = false;
      this.node.add(this.bottles);
    } else this.bottles = null;
  }
  setHighlight(on) {
    for (const m of this.meshes) m.flash = on ? [0.12, 0.09, 0.03] : null;
  }
}

// ------------------------------------------------ Food board (saucisson / planches)
export class BoardView {
  constructor() {
    this.node = new Node('board');
    this.node.position = [L.board.x, 0.98, 0.3];
    const b = new MeshBuilder();
    b.add(roundedBox(0.6, 0.04, 0.34, 0.015, 2), { color: PAL.woodLight, p: [0, 0.02, 0] });
    b.add(capsule(0.045, 0.3, 10, 4), { color: 0x7a2421, r: [0, 0, Math.PI / 2], p: [-0.02, 0.07, 0.02] });
    for (let i = 0; i < 5; i++) b.add(sphere(0.008, 5, 4), { color: 0xf4efe6, p: [-0.15 + i * 0.07, 0.11, 0.03] });
    b.add(box(0.2, 0.006, 0.035), { color: PAL.chrome, p: [0.18, 0.05, -0.08], r: [0, 0.4, 0] });
    b.add(box(0.1, 0.02, 0.025), { color: 0x2b2b2b, p: [0.04, 0.05, -0.12], r: [0, 0.4, 0] });
    const m = new Mesh(b.build(), MATS.vc);
    m.outline = 0.006;
    this.node.add(m);
    this.meshes = [m];
    this.hanging = null;
    this.extras = new Node('extras');
    this.node.add(this.extras);
    this._n = -1;
  }
  setStock(n) {
    n = Math.min(6, n);
    if (n === this._n) return;
    this._n = n;
    if (this.hanging) this.node.remove(this.hanging);
    if (n <= 0) {
      this.hanging = null;
      return;
    }
    const b = new MeshBuilder();
    for (let i = 0; i < n; i++) {
      const x = -0.45 + i * 0.18;
      b.add(cylinder(0.004, 0.004, 0.1, 4), { color: 0xeeeeee, p: [x, 0.92, -0.12] });
      b.add(capsule(0.04, 0.26, 8, 3), { color: 0x7a2421, p: [x, 0.7, -0.12], r: [0, 0, 0.05 * (i % 2 ? 1 : -1)] });
      b.add(torus(0.042, 0.005, 4, 10), { color: 0xeeeeee, r: [Math.PI / 2, 0, 0], p: [x, 0.76, -0.12] });
      b.add(torus(0.042, 0.005, 4, 10), { color: 0xeeeeee, r: [Math.PI / 2, 0, 0], p: [x, 0.64, -0.12] });
    }
    this.hanging = new Mesh(b.build(), MATS.vc);
    this.node.add(this.hanging);
  }
  setExtras(hasPlanche, hasToaster, hasCafe) {
    for (const c of [...this.extras.children]) this.extras.remove(c);
    if (hasPlanche) {
      const b = new MeshBuilder();
      b.add(cylinder(0.12, 0.12, 0.08, 16), { color: 0xf3cf63, p: [0.4, 0.06, 0.05] });
      b.add(cylinder(0.12, 0.12, 0.08, 16, { open: true }), { color: 0xe0a83a, p: [0.4, 0.06, 0.05], s: [1.01, 1, 1.01] });
      this.extras.add(new Mesh(b.build(), MATS.vc));
    }
    if (hasToaster) {
      const b = new MeshBuilder();
      b.add(roundedBox(0.3, 0.2, 0.22, 0.04, 2), { color: PAL.chrome, p: [-0.45, 0.12, 0.0] });
      b.add(box(0.2, 0.01, 0.03), { color: 0x222222, p: [-0.45, 0.22, -0.04] });
      b.add(box(0.2, 0.01, 0.03), { color: 0x222222, p: [-0.45, 0.22, 0.04] });
      this.extras.add(new Mesh(b.build(), MATS.vcShiny));
    }
    if (hasCafe) {
      // small espresso machine against the wall
      const b = new MeshBuilder();
      b.add(roundedBox(0.26, 0.3, 0.24, 0.03, 2), { color: 0xb3263a, p: [-0.82, 0.17, -0.02] });
      b.add(roundedBox(0.22, 0.05, 0.2, 0.02, 2), { color: PAL.chrome, p: [-0.82, 0.34, -0.02] });
      b.add(box(0.2, 0.02, 0.12), { color: PAL.chrome, p: [-0.82, 0.03, 0.08] });
      b.add(cylinder(0.025, 0.025, 0.05, 10), { color: PAL.chrome, p: [-0.82, 0.13, 0.12] });
      b.add(box(0.025, 0.02, 0.1), { color: 0x222222, p: [-0.82, 0.125, 0.19] });
      b.add(lathe([[0.0001, 0], [0.022, 0], [0.028, 0.045]], 10), { color: 0xffffff, p: [-0.82, 0.04, 0.1] });
      this.extras.add(new Mesh(b.build(), MATS.vcShiny));
    }
  }
  setHighlight(on) {
    for (const m of this.meshes) m.flash = on ? [0.12, 0.09, 0.03] : null;
  }
}

export class SnackView {
  constructor() {
    this.node = new Node('snack');
    this.node.position = [L.snack.x, 0.98, 0.3];
    const b = new MeshBuilder();
    b.add(lathe([[0.0001, 0], [0.11, 0], [0.12, 0.05], [0.12, 0.24], [0.09, 0.27], [0.09, 0.3]], 16, { capTop: true }), { color: 0xd8eef7, p: [-0.15, 0, 0] });
    b.add(cylinder(0.1, 0.1, 0.04, 16), { color: 0xd62828, p: [-0.15, 0.32, 0] });
    const jar = new Mesh(b.build(), MATS.vcShiny);
    jar.outline = 0.006;
    this.node.add(jar);
    this.fill = new Mesh(new MeshBuilder().add(cylinder(0.105, 0.105, 1, 14), { color: 0xc8894d, p: [0, 0.5, 0] }).build(), MATS.vc);
    this.fill.position = [-0.15, 0.03, 0];
    this.node.add(this.fill);
    this.olives = new Mesh(new MeshBuilder().add(lathe([[0.0001, 0], [0.08, 0], [0.09, 0.2], [0.07, 0.22]], 14, { capTop: true }), { color: 0x6b8e23 }).add(cylinder(0.075, 0.075, 0.03, 14), { color: 0xf3e2c0, p: [0, 0.235, 0] }).build(), MATS.vcShiny);
    this.olives.position = [0.15, 0, 0];
    this.olives.visible = false;
    this.node.add(this.olives);
    this.meshes = [jar, this.fill];
  }
  setStock(peanuts, max, hasOlives) {
    const t = Math.max(0, Math.min(1, peanuts / Math.max(1, max)));
    this.fill.scale[1] = 0.22 * t + 0.0001;
    this.fill.visible = t > 0.01;
    this.olives.visible = hasOlives;
  }
  setHighlight(on) {
    for (const m of this.meshes) m.flash = on ? [0.12, 0.09, 0.03] : null;
  }
}

// ------------------------------------------------ Dishwasher + dirty pile
export class DishwasherView {
  constructor() {
    this.node = new Node('dishwasher');
    this.node.position = [L.dishwasher.x, 0, 1.5];
    const b = new MeshBuilder();
    b.add(roundedBox(0.72, 0.8, 0.06, 0.02, 2), { color: PAL.steel, p: [0, 0.45, 0.0] });
    b.add(box(0.5, 0.04, 0.05), { color: PAL.chrome, p: [0, 0.78, -0.02] });
    b.add(box(0.6, 0.03, 0.01), { color: 0x2b2b2b, p: [0, 0.68, -0.035] });
    // sink on counter top (staff side)
    b.add(roundedBox(0.6, 0.08, 0.3, 0.03, 2), { color: PAL.chrome, p: [0, TOP + 0.0, 0.12] });
    b.add(box(0.5, 0.02, 0.22), { color: 0x6d7a84, p: [0, TOP + 0.03, 0.12] });
    b.add(cylinder(0.015, 0.015, 0.3, 8), { color: PAL.chrome, p: [0.2, TOP + 0.18, 0.22] });
    b.add(cylinder(0.012, 0.012, 0.14, 8), { color: PAL.chrome, r: [Math.PI / 2, 0, 0], p: [0.2, TOP + 0.32, 0.16] });
    const m = new Mesh(b.build(), MATS.vcShiny);
    m.outline = 0.006;
    this.node.add(m);
    this.meshes = [m];
    this.light = new Glow(0x44ff88, 0.18, 0);
    this.light.position = [0.25, 0.68, -0.06];
    this.node.add(this.light);
    this.steam = new Glow(0xffffff, 0.7, 0);
    this.steam.position = [0, TOP + 0.3, 0.1];
    this.node.add(this.steam);
    this.pile = null;
    this._n = -1;
    this.t = 0;
  }
  setDirty(n) {
    n = Math.min(14, n);
    if (n === this._n) return;
    this._n = n;
    if (this.pile) this.node.remove(this.pile);
    this.pile = null;
    if (n <= 0) return;
    const b = new MeshBuilder();
    for (let i = 0; i < n; i++) {
      const layer = Math.floor(i / 5);
      const k = i % 5;
      b.add(lathe([[0.0001, 0], [0.036, 0], [0.046, 0.12], [0.05, 0.17]], 8), { color: 0xc9dbe3, p: [-0.5 + (k % 3) * 0.1 + layer * 0.03, TOP + 0.005 + layer * 0.16, 0.0 + Math.floor(k / 3) * 0.1], r: [layer ? 0.2 : 0, 0, layer ? (k - 2) * 0.12 : 0] });
    }
    this.pile = new Mesh(b.build(), MATS.vcShiny);
    this.node.add(this.pile);
  }
  update(dt, washing) {
    this.t += dt;
    this.light.intensity = washing ? 0.5 + 0.3 * Math.sin(this.t * 6) : 0.0;
    this.steam.intensity = washing ? 0.12 + 0.08 * Math.sin(this.t * 3) : 0;
    this.steam.position[1] = TOP + 0.3 + Math.sin(this.t * 2) * 0.05;
  }
  setHighlight(on) {
    for (const m of this.meshes) m.flash = on ? [0.12, 0.09, 0.03] : null;
  }
}

export class GlassRackView {
  constructor() {
    this.node = new Node('glassrack');
    this.node.position = [L.glassRack.x, TOP, 1.65];
    const b = new MeshBuilder();
    b.add(roundedBox(0.5, 0.03, 0.34, 0.01, 1), { color: 0x2b2b2b, p: [0, 0.015, 0] });
    const m = new Mesh(b.build(), MATS.vc);
    this.node.add(m);
    this.glasses = null;
    this._n = -1;
  }
  setCount(n) {
    n = Math.min(20, n);
    if (n === this._n) return;
    this._n = n;
    if (this.glasses) this.node.remove(this.glasses);
    this.glasses = null;
    if (n <= 0) return;
    const b = new MeshBuilder();
    for (let i = 0; i < n; i++) {
      const layer = Math.floor(i / 8);
      const k = i % 8;
      const x = -0.18 + (k % 4) * 0.12 + layer * 0.05, z = -0.07 + Math.floor(k / 4) * 0.13;
      b.add(lathe([[0.05, 0], [0.046, 0.03], [0.04, 0.16], [0.0001, 0.17]], 10), { color: 0xd9eef7, p: [x, 0.03 + layer * 0.17, z] });
    }
    this.glasses = new Mesh(b.build(), MATS.glass);
    this.glasses.castShadow = false;
    this.node.add(this.glasses);
  }
}

export class RegisterView {
  constructor() {
    this.node = new Node('register');
    this.node.position = [7.55, TOP, 1.7];
    this.node.rotation[1] = 0.25;
    const b = new MeshBuilder();
    b.add(roundedBox(0.42, 0.18, 0.36, 0.03, 2), { color: PAL.brass, p: [0, 0.09, 0] });
    b.add(roundedBox(0.36, 0.2, 0.22, 0.03, 2), { color: PAL.brassDark, p: [0, 0.25, -0.05], r: [0.35, 0, 0] });
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) b.add(cylinder(0.018, 0.018, 0.02, 8), { color: 0xf3e2c0, p: [-0.12 + j * 0.08, 0.31 + i * 0.03, 0.02 - i * 0.05], r: [0.35, 0, 0] });
    b.add(roundedBox(0.3, 0.1, 0.03, 0.01, 1), { color: 0x111111, p: [0, 0.42, -0.12] });
    const m = new Mesh(b.build(), MATS.vcShiny);
    m.outline = 0.006;
    this.node.add(m);
    this.drawer = new Mesh(new MeshBuilder().add(roundedBox(0.38, 0.06, 0.3, 0.01, 1), { color: PAL.brassDark }).build(), MATS.vcShiny);
    this.drawer.position = [0, 0.03, 0.05];
    this.node.add(this.drawer);
    this.open = 0;
    this.timer = 0;
  }
  kaching() {
    this.timer = 0.6;
  }
  update(dt) {
    this.timer -= dt;
    this.open = damp(this.open, this.timer > 0 ? 1 : 0, 14, dt);
    this.drawer.position[2] = 0.05 + this.open * 0.16;
  }
}

export class ChalkboardView {
  constructor(getLines) {
    const c = L.chalkboard;
    this.node = new Node('chalkboard');
    const w = c.x1 - c.x0, h = c.y1 - c.y0;
    this.node.position = [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, 0.06];
    const fr = new Mesh(new MeshBuilder().add(roundedBox(w + 0.12, h + 0.12, 0.05, 0.02, 2), { color: PAL.woodMid }).build(), MATS.vc);
    this.node.add(fr);
    this.tex = chalkboard(getLines);
    const q = new Mesh(new MeshBuilder().add(quad(w, h), { color: 0xffffff }).build(), new Material({ map: this.tex, toon: 0.2, rim: 0 }));
    q.position[2] = 0.03;
    q.castShadow = false;
    this.node.add(q);
  }
  refresh() {
    this.tex.redraw();
  }
}

export class NeonNameView {
  constructor(getName) {
    this.node = new Node('neonName');
    this.node.position = [L.neon.x, L.neon.y, 0.08];
    this.tex = neonSign(getName, '#ffb347');
    const back = new Mesh(new MeshBuilder().add(roundedBox(2.3, 0.62, 0.03, 0.03, 2), { color: 0x1d1714 }).build(), MATS.vc);
    back.position[2] = -0.02;
    this.node.add(back);
    const q = new Mesh(new MeshBuilder().add(quad(2.2, 0.55), { color: 0xffffff }).build(), new Material({ map: this.tex, unlit: true, transparent: true, additive: true, depthWrite: false }));
    q.position[2] = 0.02;
    q.castShadow = false;
    this.node.add(q);
    this.glow = new Glow(0xffa53a, 1.9, 0.3);
    this.glow.position = [0, 0, 0.35];
    this.node.add(this.glow);
    this.t = 0;
  }
  refresh() {
    this.tex.redraw();
  }
  update(dt) {
    this.t += dt;
    this.glow.intensity = 0.28 + 0.03 * Math.sin(this.t * 2.3) + (Math.sin(this.t * 13.7) > 0.995 ? -0.15 : 0);
  }
}
