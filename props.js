// Small props: glasses with liquid, bottles, food plates, kegs, crates, tools.
import { Node, Mesh } from '../../engine/scene.js';
import { MeshBuilder, lathe, cylinder, sphere, roundedBox, box, torus, capsule } from '../../engine/geometry.js';
import { MATS, PAL, liquidMat, colorMat } from '../materials.js';
import { texMat } from '../materials.js';

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

// ---- glass profiles (radius, y), exaggerated cartoon proportions
const PROFILES = {
  pint: [[0.0001, 0], [0.036, 0], [0.04, 0.006], [0.046, 0.12], [0.051, 0.15], [0.048, 0.17], [0.05, 0.19]],
  tulip: [[0.0001, 0], [0.032, 0], [0.034, 0.01], [0.05, 0.08], [0.054, 0.13], [0.046, 0.18], [0.049, 0.2]],
  chalice: [[0.0001, 0], [0.04, 0], [0.04, 0.008], [0.008, 0.02], [0.008, 0.07], [0.04, 0.085], [0.06, 0.13], [0.062, 0.17]],
  weizen: [[0.0001, 0], [0.03, 0], [0.032, 0.01], [0.034, 0.08], [0.048, 0.17], [0.044, 0.22], [0.046, 0.25]],
};
const GLASS_FOR_STYLE = { belge: 'tulip', abbaye: 'chalice', trappiste: 'chalice', weiss: 'weizen', ipa: 'tulip', pils: 'tulip' };

function insetProfile(pts, k = 0.86, fromIdx = 1) {
  // liquid profile: slightly inside the glass
  return pts.map(([r, y], i) => [Math.max(0.0001, r * k), Math.max(0.006, y)]).slice(fromIdx);
}

function glassGeo(kind) {
  return cached('glass:' + kind, () => {
    const b = new MeshBuilder();
    b.add(lathe(PROFILES[kind], 18, { capBottom: true }), { color: 0xffffff });
    return b.build();
  });
}
function liquidGeo(kind) {
  return cached('liq:' + kind, () => {
    const prof = PROFILES[kind];
    const top = prof[prof.length - 1][1];
    // normalized height 0..1 so we can scale by fill level
    let pts = insetProfile(prof, 0.84, 0).filter((p) => p[1] <= top * 0.92);
    if (kind === 'chalice') pts = [[0.0001, 0.088], [0.036, 0.09], [0.05, 0.13], [0.052, 0.155]];
    const y0 = pts[0][1], y1 = pts[pts.length - 1][1];
    const norm = pts.map(([r, y]) => [r, (y - y0) / (y1 - y0)]);
    const b = new MeshBuilder();
    b.add(lathe(norm, 16, { capBottom: true, capTop: true }), { color: 0xffffff });
    const g = b.build();
    g.y0 = y0;
    g.h = y1 - y0;
    g.topR = pts[pts.length - 1][0];
    return g;
  });
}

/** A served drink in a glass. Returns node with .setLevel(0..1) */
export function makeDraft(beer) {
  const kind = GLASS_FOR_STYLE[beer.style] || 'pint';
  const root = new Node('draft');
  const glass = new Mesh(glassGeo(kind), MATS.glass);
  glass.castShadow = false;
  const lg = liquidGeo(kind);
  const liquid = new Mesh(lg, liquidMat(beer.liquid));
  liquid.position[1] = lg.y0;
  liquid.castShadow = false;
  const foamGeo = cached('foam:' + kind, () => {
    const b = new MeshBuilder();
    b.add(cylinder(lg.topR * 1.02, lg.topR * 0.98, 0.022, 14), { color: 0xffffff });
    b.add(sphere(lg.topR * 0.95, 12, 6, { thetaLen: Math.PI / 2, sy: 0.35 }), { color: 0xffffff, p: [0, 0.01, 0] });
    return b.build();
  });
  const foam = new Mesh(foamGeo, colorMat(beer.foam, { toon: 0.5, rim: 0.3 }));
  foam.castShadow = false;
  root.add(liquid, foam, glass);
  root.level = 1;
  root.setLevel = (t) => {
    root.level = t;
    const h = Math.max(0.02, t) * lg.h;
    liquid.scale[1] = h;
    liquid.visible = t > 0.01;
    foam.position[1] = lg.y0 + h - 0.004;
    foam.visible = t > 0.03;
    const fs = t > 0.03 ? 0.6 + 0.4 * Math.min(1, t * 1.6) : 0;
    foam.scale[0] = foam.scale[2] = Math.max(0.5, 0.75 + 0.25 * t);
    foam.scale[1] = fs;
  };
  root.setLevel(1);
  root.kindTag = 'glass';
  return root;
}

function bottleGeo(spec) {
  const key = 'bottle:' + JSON.stringify(spec || {});
  return cached(key, () => {
    const b = new MeshBuilder();
    if (spec?.can) {
      b.add(cylinder(0.04, 0.04, 0.15, 16), { color: 0xffffff, p: [0, 0.075, 0] });
      b.add(cylinder(0.034, 0.04, 0.012, 16), { color: 0xd8dde2, p: [0, 0.156, 0] });
      return b.build();
    }
    if (spec?.round) {
      b.add(lathe([[0.0001, 0], [0.035, 0], [0.05, 0.04], [0.05, 0.07], [0.03, 0.13], [0.017, 0.17], [0.017, 0.19]], 16, { capTop: true }), { color: 0xffffff });
      return b.build();
    }
    b.add(lathe([[0.0001, 0], [0.034, 0], [0.036, 0.01], [0.036, 0.13], [0.03, 0.16], [0.015, 0.2], [0.014, 0.25], [0.016, 0.26]], 16, { capTop: true }), { color: 0xffffff });
    return b.build();
  });
}

/** Bottle or can of product (beer bottle or soft). */
export function makeBottle(prod) {
  const spec = prod.bottle || {};
  const root = new Node('bottle');
  const glassCol = spec.glass ?? 0x6b4a1a;
  const body = new Mesh(bottleGeo(spec), spec.can ? colorMat(prod.color ?? 0xd62828, { spec: 0.6, rim: 0.4 }) : colorMat(glassCol, { spec: 0.7, rim: 0.6, toon: 0.6 }));
  body.castShadow = true;
  root.add(body);
  // label band
  if (!spec.can) {
    const labelCol = prod.label ? parseInt(prod.label.bg.slice(1), 16) : prod.color ?? 0xffffff;
    const lb = new Mesh(cached('labelband' + (spec.round ? 'r' : ''), () => {
      const b = new MeshBuilder();
      if (spec.round) b.add(cylinder(0.052, 0.052, 0.035, 16, { open: true }), { color: 0xffffff, p: [0, 0.055, 0] });
      else b.add(cylinder(0.038, 0.038, 0.06, 16, { open: true }), { color: 0xffffff, p: [0, 0.075, 0] });
      return b.build();
    }), colorMat(labelCol, { toon: 0.8 }));
    lb.castShadow = false;
    root.add(lb);
    const cap = new Mesh(cached('cap', () => new MeshBuilder().add(cylinder(0.018, 0.018, 0.014, 10), { color: 0xffffff }).build()), colorMat(0xd8c070, { spec: 0.5 }));
    cap.position[1] = spec.round ? 0.19 : 0.262;
    cap.castShadow = false;
    root.add(cap);
    if (spec.lime) {
      const lime = new Mesh(cached('lime', () => new MeshBuilder().add(sphere(0.02, 8, 6), { color: 0x7ac943, s: [1, 0.7, 1] }).build()), MATS.vc);
      lime.position[1] = 0.262;
      lime.position[2] = 0.006;
      root.add(lime);
      cap.visible = false;
    }
  } else {
    const band = new Mesh(cached('canband', () => new MeshBuilder().add(cylinder(0.0405, 0.0405, 0.04, 16, { open: true }), { color: 0xffffff, p: [0, 0.08, 0] }).build()), colorMat(0xffffff));
    band.castShadow = false;
    root.add(band);
  }
  root.kindTag = 'bottle';
  root.setLevel = () => {};
  return root;
}

export function makeFood(prod) {
  const root = new Node('food');
  const geo = cached('food:' + prod.id, () => {
    const b = new MeshBuilder();
    if (prod.id === 'saucisson') {
      b.add(cylinder(0.11, 0.1, 0.018, 20), { color: 0xf4efe6, p: [0, 0.009, 0] });
      b.add(torus(0.1, 0.008, 6, 20), { color: 0x2f6f9f, r: [Math.PI / 2, 0, 0], p: [0, 0.018, 0] });
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, r = i === 8 ? 0 : 0.06;
        b.add(cylinder(0.026, 0.026, 0.008, 12), { color: 0x9b2d2a, p: [Math.cos(a) * r, 0.024 + (i % 3) * 0.002, Math.sin(a) * r], r: [0.15 * (i % 2), 0, 0.12] });
        b.add(cylinder(0.024, 0.024, 0.009, 10), { color: 0xc4574b, p: [Math.cos(a) * r, 0.0245 + (i % 3) * 0.002, Math.sin(a) * r], r: [0.15 * (i % 2), 0, 0.12], s: [0.9, 1, 0.9] });
      }
      // little white fat dots
      for (let i = 0; i < 6; i++) b.add(sphere(0.005, 5, 4), { color: 0xffffff, p: [Math.cos(i) * 0.05, 0.03, Math.sin(i * 2) * 0.05] });
    } else if (prod.id === 'cacahuetes' || prod.id === 'olives') {
      b.add(lathe([[0.0001, 0], [0.04, 0], [0.07, 0.03], [0.075, 0.05], [0.07, 0.052]], 18), { color: prod.id === 'olives' ? 0xf0e6d6 : 0xd9a066 });
      const col = prod.id === 'olives' ? [0x6b8e23, 0x2b2b2b] : [0xc8894d, 0xb5773f];
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4, r = 0.012 + (i % 4) * 0.012;
        b.add(sphere(0.014, 7, 5), { color: col[i % 2], p: [Math.cos(a) * r, 0.045 + (i % 3) * 0.006, Math.sin(a) * r], s: [1.3, 1, 1] });
      }
    } else if (prod.id === 'planche') {
      b.add(roundedBox(0.34, 0.025, 0.2, 0.01, 2), { color: PAL.woodLight, p: [0, 0.0125, 0] });
      b.add(box(0.05, 0.02, 0.03), { color: PAL.woodLight, p: [0.19, 0.012, 0] });
      // cheese wedges
      for (let i = 0; i < 3; i++) b.add(cylinder(0.045, 0.045, 0.035, 3), { color: 0xf3cf63, p: [-0.09 + i * 0.035, 0.04, -0.04], r: [0, i, 0] });
      // ham rolls
      for (let i = 0; i < 4; i++) b.add(capsule(0.018, 0.05, 8, 3), { color: 0xe68a8a, p: [0.02 + i * 0.03, 0.04, 0.03], r: [Math.PI / 2, 0, 0] });
      // saucisson slices
      for (let i = 0; i < 5; i++) b.add(cylinder(0.022, 0.022, 0.008, 10), { color: 0x9b2d2a, p: [0.11, 0.03 + i * 0.006, -0.04 + i * 0.01], r: [0.3, 0, 0] });
      // cornichons
      for (let i = 0; i < 3; i++) b.add(capsule(0.009, 0.03, 6, 3), { color: 0x5f8f2f, p: [-0.1 + i * 0.03, 0.032, 0.05], r: [Math.PI / 2, i, 0] });
    } else if (prod.id === 'croque') {
      b.add(cylinder(0.11, 0.1, 0.018, 20), { color: 0xf4efe6, p: [0, 0.009, 0] });
      b.add(roundedBox(0.12, 0.022, 0.12, 0.008, 2), { color: 0xd9a35a, p: [0, 0.03, 0], r: [0, 0.3, 0] });
      b.add(roundedBox(0.115, 0.012, 0.115, 0.004, 2), { color: 0xf5d36a, p: [0, 0.046, 0], r: [0, 0.3, 0] });
      b.add(roundedBox(0.12, 0.02, 0.12, 0.008, 2), { color: 0xc98b44, p: [0, 0.062, 0], r: [0, 0.3, 0] });
    } else if (prod.id === 'cafe') {
      b.add(cylinder(0.065, 0.06, 0.012, 16), { color: 0xf4efe6, p: [0, 0.006, 0] });
      b.add(lathe([[0.0001, 0], [0.026, 0], [0.034, 0.05], [0.036, 0.055]], 14), { color: 0xffffff, p: [0, 0.012, 0] });
      b.add(cylinder(0.031, 0.031, 0.004, 14), { color: 0x4a250f, p: [0, 0.058, 0] });
      b.add(cylinder(0.022, 0.022, 0.0045, 12), { color: 0xc99a62, p: [0, 0.0585, 0] });
      b.add(torus(0.014, 0.005, 5, 10), { color: 0xffffff, p: [0.04, 0.04, 0], r: [Math.PI / 2, 0, Math.PI / 2] });
    } else {
      b.add(cylinder(0.1, 0.09, 0.018, 18), { color: 0xffffff });
    }
    return b.build();
  });
  const m = new Mesh(geo, MATS.vc);
  root.add(m);
  root.kindTag = 'plate';
  root.setLevel = (t) => {
    m.scale[0] = m.scale[2] = 0.7 + 0.3 * t;
    m.scale[1] = Math.max(0.3, t);
  };
  return root;
}

/** Dirty leftovers for a table spot (empty glasses + crumbs) */
export function makeDirtyPile(count = 2, seed = 1) {
  const b = new MeshBuilder();
  for (let i = 0; i < count; i++) {
    const a = seed * 1.7 + i * 2.1, r = 0.06 + (i % 2) * 0.05;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    b.add(lathe(PROFILES.pint, 10), { color: 0xcfe0e8, p: [x, 0, z] });
    b.add(cylinder(0.04, 0.04, 0.02, 10), { color: 0xf2dfb0, p: [x, 0.03, z] });
  }
  b.add(sphere(0.012, 5, 4), { color: 0xc8894d, p: [0.05, 0.01, -0.07] });
  b.add(sphere(0.01, 5, 4), { color: 0xc8894d, p: [-0.08, 0.01, 0.05] });
  const m = new Mesh(b.build(), MATS.vcShiny);
  m.castShadow = false;
  return m;
}

export function makeKeg(color = PAL.steel) {
  return new Mesh(cached('keg' + color, () => {
    const b = new MeshBuilder();
    b.add(lathe([[0.0001, 0], [0.17, 0], [0.18, 0.02], [0.19, 0.12], [0.2, 0.25], [0.19, 0.38], [0.18, 0.48], [0.17, 0.5], [0.0001, 0.5]], 20), { color: 0xc4ccd3 });
    b.add(torus(0.195, 0.012, 6, 24), { color: 0x9aa4ad, r: [Math.PI / 2, 0, 0], p: [0, 0.12, 0] });
    b.add(torus(0.195, 0.012, 6, 24), { color: 0x9aa4ad, r: [Math.PI / 2, 0, 0], p: [0, 0.38, 0] });
    b.add(cylinder(0.035, 0.035, 0.04, 10), { color: 0x333333, p: [0, 0.52, 0] });
    b.add(cylinder(0.12, 0.12, 0.04, 16, { open: true }), { color, p: [0, 0.25, 0] });
    return b.build();
  }), MATS.vcShiny);
}

export function makeCrate(color = 0xc0392b, bottleCol = 0x6b4a1a) {
  return new Mesh(cached('crate' + color + bottleCol, () => {
    const b = new MeshBuilder();
    b.add(roundedBox(0.44, 0.2, 0.32, 0.02, 2), { color, p: [0, 0.1, 0] });
    b.add(box(0.36, 0.06, 0.02), { color: 0x000000, p: [0, 0.15, 0.161] });
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3; j++) {
        b.add(cylinder(0.028, 0.028, 0.14, 8), { color: bottleCol, p: [-0.15 + i * 0.1, 0.25, -0.1 + j * 0.1] });
        b.add(cylinder(0.012, 0.012, 0.06, 6), { color: bottleCol, p: [-0.15 + i * 0.1, 0.35, -0.1 + j * 0.1] });
      }
    return b.build();
  }), MATS.vc);
}

export function makeTray() {
  return new Mesh(cached('tray', () => new MeshBuilder().add(cylinder(0.2, 0.19, 0.015, 24), { color: 0x3a3f45 }).add(torus(0.195, 0.008, 6, 24), { color: 0x6c757d, r: [Math.PI / 2, 0, 0], p: [0, 0.008, 0] }).build()), MATS.vcShiny);
}

export function makeDirtyTray() {
  return new Mesh(cached('dtray', () => {
    const b = new MeshBuilder();
    b.add(cylinder(0.2, 0.19, 0.015, 20), { color: 0x3a3f45 });
    for (let i = 0; i < 5; i++) b.add(lathe(PROFILES.pint, 8), { color: 0xcfe0e8, p: [Math.cos(i * 1.3) * 0.1, 0.008, Math.sin(i * 1.3) * 0.1] });
    return b.build();
  }), MATS.vcShiny);
}

export function makePhone() {
  return new Mesh(cached('phone', () => new MeshBuilder().add(roundedBox(0.06, 0.11, 0.012, 0.008, 2), { color: 0x222222 }).add(box(0.05, 0.09, 0.002), { color: 0x6fc3ff, p: [0, 0, 0.007] }).build()), MATS.vcShiny);
}

export function makeWrench() {
  return new Mesh(cached('wrench', () => new MeshBuilder().add(box(0.03, 0.22, 0.015), { color: 0x9aa4ad }).add(torus(0.03, 0.012, 6, 12, Math.PI * 1.5), { color: 0x9aa4ad, p: [0, 0.12, 0] }).build()), MATS.vcShiny);
}

export function makeMop() {
  return new Mesh(cached('mop', () => {
    const b = new MeshBuilder();
    b.add(cylinder(0.012, 0.012, 1.1, 8), { color: PAL.woodLight, p: [0, 0.55, 0] });
    for (let i = 0; i < 10; i++) b.add(capsule(0.015, 0.12, 6, 2), { color: 0xeeeeee, p: [Math.cos(i) * 0.04, 0.05, Math.sin(i) * 0.04], r: [Math.cos(i) * 0.4, 0, Math.sin(i) * 0.4] });
    return b.build();
  }), MATS.vc);
}

export function makeRag() {
  return new Mesh(cached('rag', () => new MeshBuilder().add(roundedBox(0.12, 0.02, 0.1, 0.008, 2), { color: 0xf2f2f2 }).add(box(0.12, 0.022, 0.015), { color: 0xd64545, p: [0, 0, 0.02] }).build()), MATS.vc);
}

export function makeCoinStack() {
  return new Mesh(cached('coins', () => {
    const b = new MeshBuilder();
    for (let i = 0; i < 4; i++) b.add(cylinder(0.025, 0.025, 0.008, 12), { color: i === 3 ? 0xf0c75e : 0xd9a441, p: [i * 0.004, 0.004 + i * 0.008, 0] });
    b.add(roundedBox(0.09, 0.004, 0.05, 0.002, 1), { color: 0x7ac08a, p: [0.05, 0.003, 0.03], r: [0, 0.4, 0] });
    return b.build();
  }), MATS.vcShiny);
}

export function makeBillNote() {
  return new Mesh(cached('bill', () => new MeshBuilder().add(roundedBox(0.08, 0.003, 0.12, 0.002, 1), { color: 0xfffbf0 }).add(box(0.05, 0.004, 0.008), { color: 0x888888, p: [0, 0.001, -0.03] }).build()), MATS.vc);
}
