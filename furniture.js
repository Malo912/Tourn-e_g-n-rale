// Furniture & decor models, keyed by catalog `model`.
import { Node, Mesh, Glow, Material } from '../../engine/scene.js';
import { MeshBuilder, roundedBox, box, cylinder, lathe, sphere, torus, capsule, quad } from '../../engine/geometry.js';
import { MATS, PAL, texMat, colorMat } from '../materials.js';
import { poster, painting, neonSign, tvScreen } from '../textures.js';
import { mixHex } from '../../engine/math.js';
import { RNG } from '../../core/rng.js';

const cache = new Map();
const C = (k, fn) => {
  if (!cache.has(k)) cache.set(k, fn());
  return cache.get(k);
};

function mesh(geo, mat = MATS.vc, outline = 0) {
  const m = new Mesh(geo, mat);
  m.outline = outline;
  return m;
}

// ------------------------------------------------ chairs
function chairGeo(kind) {
  return C('chair:' + kind, () => {
    const b = new MeshBuilder();
    if (kind === 'bistrot') {
      b.add(cylinder(0.22, 0.22, 0.05, 18), { color: 0xc9a46a, p: [0, 0.46, 0] });
      b.add(torus(0.2, 0.025, 6, 16, Math.PI), { color: 0x2b2b2b, p: [0, 0.68, -0.02], r: [0, 0, 0] });
      b.add(torus(0.16, 0.02, 6, 16, Math.PI), { color: 0xc9a46a, p: [0, 0.62, -0.02] });
      for (const [x, z] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) b.add(cylinder(0.018, 0.022, 0.46, 6), { color: 0x2b2b2b, p: [x, 0.23, z], r: [z * 0.3, 0, -x * 0.3] });
      for (const x of [-0.2, 0.2]) b.add(cylinder(0.02, 0.02, 0.26, 6), { color: 0x2b2b2b, p: [x, 0.57, -0.03] });
    } else if (kind === 'cushion') {
      b.add(roundedBox(0.44, 0.06, 0.42, 0.02, 2), { color: PAL.oak, p: [0, 0.44, 0] });
      b.add(roundedBox(0.4, 0.06, 0.38, 0.03, 2), { color: PAL.burgundy, p: [0, 0.49, 0.01] });
      b.add(roundedBox(0.44, 0.42, 0.05, 0.02, 2), { color: PAL.oak, p: [0, 0.7, -0.19] });
      b.add(roundedBox(0.36, 0.26, 0.04, 0.02, 2), { color: PAL.burgundy, p: [0, 0.72, -0.16] });
      for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) b.add(box(0.05, 0.44, 0.05), { color: PAL.woodMid, p: [x, 0.22, z] });
    } else if (kind === 'stool') {
      b.add(cylinder(0.2, 0.2, 0.07, 18), { color: PAL.leather, p: [0, 0.72, 0] });
      b.add(torus(0.19, 0.02, 6, 18), { color: PAL.leatherDark, r: [Math.PI / 2, 0, 0], p: [0, 0.7, 0] });
      b.add(cylinder(0.035, 0.035, 0.68, 8), { color: PAL.chrome, p: [0, 0.34, 0] });
      b.add(torus(0.16, 0.015, 6, 18), { color: PAL.chrome, r: [Math.PI / 2, 0, 0], p: [0, 0.28, 0] });
      b.add(cylinder(0.2, 0.22, 0.03, 18), { color: 0x2b2b2b, p: [0, 0.015, 0] });
    } else {
      // rickety wooden chair
      b.add(roundedBox(0.42, 0.05, 0.4, 0.015, 2), { color: PAL.woodWarm, p: [0, 0.45, 0], r: [0, 0, 0.02] });
      for (const [x, z] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]]) b.add(box(0.045, 0.45, 0.045), { color: PAL.woodMid, p: [x, 0.225, z] });
      for (const x of [-0.18, 0.18]) b.add(box(0.045, 0.45, 0.045), { color: PAL.woodMid, p: [x, 0.68, -0.18] });
      b.add(roundedBox(0.42, 0.1, 0.035, 0.015, 2), { color: PAL.woodWarm, p: [0, 0.86, -0.18], r: [0, 0, -0.04] });
      b.add(box(0.38, 0.04, 0.03), { color: PAL.woodWarm, p: [0, 0.7, -0.18] });
    }
    return b.build();
  });
}

/** chairs are merged in a single mesh per table (fewer draw calls) */
function addChairs(node, seats, kind) {
  const b = new MeshBuilder();
  const g = chairGeo(kind);
  for (const s of seats) b.add(g, { p: [s.x * 1.05, 0, s.z * 1.05], r: [0, s.face, 0] });
  node.add(mesh(b.build(), MATS.vc, 0.008));
}

// ------------------------------------------------ tables
const builders = {
  table2(def) {
    const n = new Node('table2');
    const geo = C('t2:' + def.variant, () => {
      const b = new MeshBuilder();
      if (def.variant === 'bistrot') {
        b.add(cylinder(0.4, 0.4, 0.05, 28), { color: PAL.marble, p: [0, 0.75, 0] });
        b.add(torus(0.4, 0.015, 6, 28), { color: PAL.brass, r: [Math.PI / 2, 0, 0], p: [0, 0.75, 0] });
        b.add(cylinder(0.035, 0.05, 0.72, 10), { color: 0x2b2b2b, p: [0, 0.37, 0] });
        b.add(cylinder(0.24, 0.26, 0.04, 18), { color: 0x2b2b2b, p: [0, 0.02, 0] });
      } else {
        b.add(roundedBox(0.76, 0.05, 0.72, 0.015, 2), { color: PAL.woodWarm, p: [0, 0.75, 0], r: [0.02, 0.05, -0.03] });
        for (const [x, z, l] of [[-0.3, -0.28, 0.73], [0.3, -0.28, 0.74], [-0.3, 0.28, 0.75], [0.3, 0.28, 0.7]]) b.add(box(0.06, l, 0.06), { color: PAL.woodMid, p: [x, l / 2, z] });
        b.add(cylinder(0.05, 0.05, 0.03, 8), { color: 0xd6c08a, p: [0.3, 0.015, 0.28] }); // folded coaster
      }
      return b.build();
    });
    n.add(mesh(geo, MATS.vc, 0.01));
    addChairs(n, def.seats, def.variant === 'bistrot' ? 'bistrot' : 'wood');
    n.tableTop = 0.775;
    return n;
  },
  table4(def) {
    const n = new Node('table4');
    n.add(mesh(C('t4', () => {
      const b = new MeshBuilder();
      b.add(roundedBox(0.98, 0.07, 0.98, 0.02, 2), { color: PAL.oak, p: [0, 0.74, 0] });
      b.add(roundedBox(0.9, 0.08, 0.9, 0.01, 1), { color: PAL.woodMid, p: [0, 0.68, 0] });
      for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) b.add(cylinder(0.04, 0.035, 0.7, 8), { color: PAL.woodMid, p: [x, 0.35, z] });
      return b.build();
    }), MATS.vc, 0.01));
    addChairs(n, def.seats, 'cushion');
    n.tableTop = 0.78;
    return n;
  },
  table6(def) {
    const n = new Node('table6');
    n.add(mesh(C('t6', () => {
      const b = new MeshBuilder();
      b.add(roundedBox(2.3, 0.07, 0.95, 0.02, 2), { color: PAL.woodLight, p: [0, 0.74, 0] });
      for (const x of [-1.0, 1.0]) b.add(roundedBox(0.08, 0.7, 0.7, 0.02, 1), { color: PAL.woodMid, p: [x, 0.35, 0] });
      b.add(box(2.0, 0.06, 0.06), { color: PAL.woodMid, p: [0, 0.2, 0] });
      return b.build();
    }), MATS.vc, 0.01));
    addChairs(n, def.seats, 'wood');
    n.tableTop = 0.775;
    return n;
  },
  barrel(def) {
    const n = new Node('barrel');
    n.add(mesh(C('barrelTable', () => {
      const b = new MeshBuilder();
      b.add(lathe([[0.0001, 0], [0.32, 0], [0.38, 0.25], [0.4, 0.5], [0.38, 0.75], [0.32, 0.95], [0.0001, 0.95]], 22), { color: PAL.woodWarm });
      for (const y of [0.12, 0.83]) b.add(torus(0.35, 0.018, 6, 24), { color: 0x333333, r: [Math.PI / 2, 0, 0], p: [0, y, 0] });
      for (const y of [0.38, 0.58]) b.add(torus(0.395, 0.018, 6, 24), { color: 0x333333, r: [Math.PI / 2, 0, 0], p: [0, y, 0] });
      b.add(cylinder(0.5, 0.5, 0.05, 26), { color: PAL.oak, p: [0, 1.0, 0] });
      return b.build();
    }), MATS.vc, 0.01));
    addChairs(n, def.seats.map((s) => ({ ...s, x: s.x * 1.1 })), 'stool');
    n.tableTop = 1.025;
    return n;
  },
  booth(def) {
    const n = new Node('booth');
    n.add(mesh(C('booth', () => {
      const b = new MeshBuilder();
      b.add(roundedBox(1.1, 0.06, 0.7, 0.02, 2), { color: PAL.woodRed, p: [0, 0.74, 0] });
      b.add(cylinder(0.06, 0.06, 0.7, 10), { color: 0x2b2b2b, p: [0, 0.36, 0] });
      b.add(box(0.5, 0.04, 0.4), { color: 0x2b2b2b, p: [0, 0.02, 0] });
      for (const sz of [-1, 1]) {
        b.add(roundedBox(1.5, 0.42, 0.5, 0.04, 2), { color: PAL.woodDark, p: [0, 0.21, sz * 0.62] });
        b.add(roundedBox(1.42, 0.12, 0.46, 0.05, 2), { color: PAL.leather, p: [0, 0.47, sz * 0.6] });
        b.add(roundedBox(1.5, 0.75, 0.14, 0.04, 2), { color: PAL.woodDark, p: [0, 0.8, sz * 0.9] });
        for (let i = 0; i < 3; i++) b.add(roundedBox(0.44, 0.5, 0.1, 0.06, 2), { color: PAL.leather, p: [-0.47 + i * 0.47, 0.82, sz * 0.83] });
      }
      return b.build();
    }), MATS.vc, 0.01));
    n.tableTop = 0.77;
    return n;
  },
  plant() {
    const n = new Node('plant');
    n.add(mesh(C('plant', () => {
      const b = new MeshBuilder();
      b.add(lathe([[0.0001, 0], [0.14, 0], [0.19, 0.32], [0.2, 0.34]], 16), { color: PAL.terracotta });
      b.add(cylinder(0.18, 0.18, 0.02, 14), { color: 0x4a2f1f, p: [0, 0.32, 0] });
      b.add(cylinder(0.025, 0.03, 0.5, 6), { color: 0x6b4a2a, p: [0, 0.55, 0] });
      const rng = new RNG(9);
      for (let i = 0; i < 14; i++) {
        const a = rng.range(0, 6.28), y = rng.range(0.6, 1.25), r = rng.range(0.08, 0.24);
        b.add(sphere(rng.range(0.1, 0.16), 8, 6), { color: rng.pick([PAL.plant, PAL.plantDark, 0x6dbb55]), p: [Math.cos(a) * r, y, Math.sin(a) * r], s: [1, 0.8, 1] });
      }
      return b.build();
    }), MATS.vc, 0.008));
    return n;
  },
  palm() {
    const n = new Node('palm');
    n.add(mesh(C('palm', () => {
      const b = new MeshBuilder();
      b.add(lathe([[0.0001, 0], [0.22, 0], [0.28, 0.4], [0.3, 0.42]], 16), { color: 0x2f6e8f });
      b.add(cylinder(0.27, 0.27, 0.02, 14), { color: 0x4a2f1f, p: [0, 0.4, 0] });
      for (let i = 0; i < 6; i++) b.add(cylinder(0.05 - i * 0.004, 0.055 - i * 0.004, 0.25, 8), { color: i % 2 ? 0x8a6a3a : 0x9a7a4a, p: [i * 0.012, 0.5 + i * 0.24, 0] });
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        b.add(roundedBox(0.75, 0.02, 0.2, 0.01, 1), { color: i % 2 ? PAL.plant : 0x5fae4a, p: [Math.cos(a) * 0.35 + 0.06, 1.9, Math.sin(a) * 0.35], r: [0, -a, -0.45] });
      }
      return b.build();
    }), MATS.vc, 0.008));
    return n;
  },
  barrelDeco() {
    const n = new Node('barrelDeco');
    n.add(mesh(C('barrelDeco', () => {
      const b = new MeshBuilder();
      b.add(lathe([[0.0001, 0], [0.3, 0], [0.36, 0.25], [0.38, 0.45], [0.36, 0.65], [0.3, 0.9], [0.0001, 0.9]], 20), { color: PAL.woodWarm });
      for (const y of [0.1, 0.8]) b.add(torus(0.33, 0.018, 6, 22), { color: 0x333333, r: [Math.PI / 2, 0, 0], p: [0, y, 0] });
      b.add(cylinder(0.025, 0.025, 0.12, 6), { color: PAL.brass, r: [Math.PI / 2, 0, 0], p: [0, 0.3, 0.38] });
      b.add(sphere(0.06, 8, 6), { color: 0x5a3a22, p: [0.1, 0.95, 0.05] });
      return b.build();
    }), MATS.vc, 0.01));
    return n;
  },
  jukebox() {
    const n = new Node('jukebox');
    n.add(mesh(C('jukebox', () => {
      const b = new MeshBuilder();
      b.add(roundedBox(0.8, 1.1, 0.45, 0.06, 2), { color: PAL.woodRed, p: [0, 0.55, 0] });
      b.add(cylinder(0.4, 0.4, 0.45, 20, {}), { color: PAL.woodRed, r: [Math.PI / 2, 0, 0], p: [0, 1.1, 0], s: [1, 1, 0.9] });
      b.add(roundedBox(0.6, 0.35, 0.05, 0.03, 2), { color: 0x2b2b2b, p: [0, 0.4, 0.22] });
      for (let i = 0; i < 5; i++) b.add(box(0.5, 0.012, 0.03), { color: PAL.chrome, p: [0, 0.27 + i * 0.06, 0.25] });
      b.add(roundedBox(0.5, 0.25, 0.04, 0.02, 2), { color: 0xf3e2c0, p: [0, 0.78, 0.22] });
      return b.build();
    }), MATS.vc, 0.01));
    const glowGeo = C('jukeArc', () => new MeshBuilder().add(torus(0.36, 0.035, 6, 24, Math.PI), { color: 0xffffff, p: [0, 1.1, 0.205] }).add(torus(0.28, 0.025, 6, 24, Math.PI), { color: 0xffffff, p: [0, 1.1, 0.21] }).build());
    const arc = new Mesh(glowGeo, colorMat(0xff8f3a, { emissive: 0xff7a2a, emissiveIntensity: 1.2 }));
    arc.castShadow = false;
    n.add(arc);
    const g = new Glow(0xff8a3a, 0.9, 0.5);
    g.position = [0, 1.2, 0.35];
    n.add(g);
    n.update = (dt, t) => {
      const k = 0.5 + 0.5 * Math.sin(t * 3);
      arc.material = colorMat(k > 0.5 ? 0xff8f3a : 0xff5fa2, { emissive: k > 0.5 ? 0xff7a2a : 0xff4f92, emissiveIntensity: 1.2 });
      g.intensity = 0.35 + 0.2 * k;
    };
    return n;
  },
  babyfoot() {
    const n = new Node('babyfoot');
    n.add(mesh(C('babyfoot', () => {
      const b = new MeshBuilder();
      b.add(roundedBox(1.2, 0.3, 0.7, 0.03, 2), { color: PAL.woodRed, p: [0, 0.75, 0] });
      b.add(box(1.1, 0.02, 0.6), { color: 0x3c9a4a, p: [0, 0.78, 0] });
      for (const [x, z] of [[-0.5, -0.28], [0.5, -0.28], [-0.5, 0.28], [0.5, 0.28]]) b.add(box(0.08, 0.6, 0.08), { color: PAL.woodDark, p: [x, 0.3, z] });
      const cols = [0xd62828, 0x1d3557];
      for (let i = 0; i < 6; i++) {
        const x = -0.45 + i * 0.18;
        b.add(cylinder(0.012, 0.012, 1.1, 6), { color: PAL.chrome, r: [Math.PI / 2, 0, 0], p: [x, 0.88, 0] });
        b.add(cylinder(0.03, 0.03, 0.12, 8), { color: 0x222222, r: [Math.PI / 2, 0, 0], p: [x, 0.88, i % 2 ? 0.58 : -0.58] });
        const count = [1, 2, 3, 3, 2, 1][i];
        for (let k = 0; k < count; k++) {
          const z = (k - (count - 1) / 2) * 0.16;
          b.add(roundedBox(0.04, 0.12, 0.05, 0.015, 1), { color: cols[i % 2], p: [x, 0.84, z] });
          b.add(sphere(0.025, 6, 5), { color: 0xf6d3b3, p: [x, 0.92, z] });
        }
      }
      return b.build();
    }), MATS.vc, 0.01));
    return n;
  },
  arcade() {
    const n = new Node('arcade');
    n.add(mesh(C('arcade', () => {
      const b = new MeshBuilder();
      b.add(roundedBox(0.7, 1.7, 0.7, 0.04, 2), { color: 0x3a2a6b, p: [0, 0.85, 0] });
      b.add(roundedBox(0.72, 0.2, 0.3, 0.03, 2), { color: 0x241a45, p: [0, 1.0, 0.4], r: [0.3, 0, 0] });
      b.add(cylinder(0.02, 0.02, 0.12, 6), { color: 0x222222, p: [-0.15, 1.13, 0.42] });
      b.add(sphere(0.04, 8, 6), { color: 0xd62828, p: [-0.15, 1.2, 0.42] });
      for (let i = 0; i < 3; i++) b.add(cylinder(0.03, 0.03, 0.03, 10), { color: [0xffd166, 0x06d6a0, 0xef476f][i], p: [0.05 + i * 0.09, 1.11, 0.44] });
      b.add(roundedBox(0.7, 0.2, 0.05, 0.03, 2), { color: 0xffd166, p: [0, 1.62, 0.34] });
      return b.build();
    }), MATS.vc, 0.01));
    const scr = new Mesh(C('arcScr', () => new MeshBuilder().add(box(0.5, 0.42, 0.02), { color: 0xffffff }).build()), colorMat(0x6fe3ff, { emissive: 0x3fb8ff, emissiveIntensity: 0.9, unlit: true }));
    scr.position = [0, 1.35, 0.34];
    scr.rotation[0] = -0.12;
    n.add(scr);
    const g = new Glow(0x58c8ff, 0.7, 0.45);
    g.position = [0, 1.35, 0.5];
    n.add(g);
    return n;
  },
  pool() {
    const n = new Node('pool');
    n.add(mesh(C('pool', () => {
      const b = new MeshBuilder();
      b.add(roundedBox(2.3, 0.18, 1.3, 0.05, 2), { color: PAL.woodDark, p: [0, 0.78, 0] });
      b.add(box(2.06, 0.02, 1.06), { color: 0x1f7a4a, p: [0, 0.875, 0] });
      for (const [x, z] of [[-1.0, -0.5], [1.0, -0.5], [-1.0, 0.5], [1.0, 0.5]]) b.add(cylinder(0.08, 0.06, 0.72, 10), { color: PAL.woodDark, p: [x, 0.36, z] });
      for (const [x, z] of [[-1.03, -0.53], [0, -0.55], [1.03, -0.53], [-1.03, 0.53], [0, 0.55], [1.03, 0.53]]) b.add(cylinder(0.05, 0.05, 0.02, 10), { color: 0x111111, p: [x, 0.886, z] });
      const cols = [0xffd166, 0x1d3557, 0xd62828, 0x6a4c93, 0xf77f00, 0x2a9d8f, 0x8d0801, 0x111111, 0xffffff];
      for (let i = 0; i < cols.length; i++) b.add(sphere(0.035, 8, 6), { color: cols[i], p: [0.3 + (i % 3) * 0.07, 0.92, -0.1 + Math.floor(i / 3) * 0.07] });
      b.add(cylinder(0.012, 0.018, 1.4, 6), { color: PAL.woodLight, r: [0, 0, Math.PI / 2 - 0.05], p: [-0.3, 0.92, 0.2] });
      return b.build();
    }), MATS.vc, 0.01));
    return n;
  },

  // ---------------------------------------------- wall items (built facing +Z, back at z=0)
  poster(def, ctx) {
    const n = new Node('poster');
    const beer = ctx.posterBeer();
    n.add(mesh(C('posterFrame', () => new MeshBuilder().add(roundedBox(0.66, 0.9, 0.04, 0.01, 1), { color: PAL.woodDark, p: [0, 0, 0.02] }).build())));
    const q = new Mesh(C('posterQuad', () => new MeshBuilder().add(quad(0.58, 0.82), { color: 0xffffff }).build()), texMat(poster(beer), { toon: 0.3, rim: 0 }));
    q.position[2] = 0.045;
    q.castShadow = false;
    n.add(q);
    return n;
  },
  painting(def, ctx) {
    const n = new Node('painting');
    n.add(mesh(C('paintFrame', () => {
      const b = new MeshBuilder();
      b.add(roundedBox(0.96, 0.76, 0.05, 0.015, 2), { color: PAL.brass, p: [0, 0, 0.025] });
      b.add(box(0.84, 0.64, 0.02), { color: 0x000000, p: [0, 0, 0.05] });
      return b.build();
    }), MATS.vcShiny));
    const q = new Mesh(C('paintQuad', () => new MeshBuilder().add(quad(0.82, 0.62), { color: 0xffffff }).build()), texMat(painting(ctx.seed || 1), { toon: 0.3 }));
    q.position[2] = 0.062;
    q.castShadow = false;
    n.add(q);
    return n;
  },
  mirror() {
    const n = new Node('mirror');
    n.add(mesh(C('mirror', () => {
      const b = new MeshBuilder();
      b.add(roundedBox(0.85, 1.05, 0.05, 0.02, 2), { color: PAL.woodDark, p: [0, 0, 0.025] });
      b.add(box(0.72, 0.9, 0.02), { color: 0xb8d4e0, p: [0, 0, 0.05] });
      b.add(box(0.6, 0.08, 0.005), { color: 0xd9a441, p: [0, 0.3, 0.062] });
      return b.build();
    }), MATS.vcShiny));
    return n;
  },
  flags(def) {
    const n = new Node('flags');
    n.add(mesh(C('flags', () => {
      const b = new MeshBuilder();
      const cols = [0xd62828, 0xffd166, 0x06d6a0, 0x118ab2, 0xf77f00, 0xef476f];
      const N = 10;
      for (let i = 0; i < N; i++) {
        const x = -1 + (i + 0.5) * (2 / N);
        const y = -0.12 * Math.sin(((i + 0.5) / N) * Math.PI);
        b.add(cylinder(0.0001, 0.07, 0.2, 3), { color: cols[i % cols.length], p: [x, y - 0.06, 0.05], r: [Math.PI, 0, 0], s: [1, 1, 0.15] });
      }
      for (let i = 0; i < 20; i++) {
        const x = -1 + (i + 0.5) * 0.1;
        b.add(box(0.1, 0.008, 0.008), { color: 0x333333, p: [x, 0.04 - 0.12 * Math.sin(((i + 0.5) / 20) * Math.PI), 0.05] });
      }
      return b.build();
    }), MATS.vcSoft));
    return n;
  },
  lights(def) {
    const n = new Node('lights');
    const N = 9;
    const bulbs = new MeshBuilder();
    const wire = new MeshBuilder();
    for (let i = 0; i < 25; i++) {
      const x = -1.25 + (i + 0.5) * 0.1;
      wire.add(box(0.1, 0.008, 0.008), { color: 0x222222, p: [x, -0.15 * Math.sin(((i + 0.5) / 25) * Math.PI), 0.06] });
    }
    for (let i = 0; i < N; i++) {
      const x = -1.25 + (i + 0.5) * (2.5 / N);
      const y = -0.15 * Math.sin(((i + 0.5) / N) * Math.PI) - 0.05;
      bulbs.add(sphere(0.04, 8, 6), { color: 0xffffff, p: [x, y, 0.07], s: [1, 1.3, 1] });
      const g = new Glow(0xffc46b, 0.28, 0.55);
      g.position = [x, y, 0.1];
      n.add(g);
    }
    n.add(mesh(wire.build(), MATS.vc));
    const bm = new Mesh(bulbs.build(), colorMat(0xffe2a8, { emissive: 0xffc46b, emissiveIntensity: 1.4 }));
    bm.castShadow = false;
    n.add(bm);
    return n;
  },
  neon(def) {
    const n = new Node('neon');
    const tex = C('neonCheers', () => neonSign(() => 'Cheers !', '#ff4fa3'));
    const q = new Mesh(C('neonQuad', () => new MeshBuilder().add(quad(1.3, 0.33), { color: 0xffffff }).build()), new Material({ map: tex, unlit: true, transparent: true, additive: true, depthWrite: false }));
    q.position[2] = 0.04;
    q.castShadow = false;
    n.add(q);
    const g = new Glow(0xff4fa3, 1.2, 0.35);
    g.position = [0, 0, 0.25];
    n.add(g);
    n.update = (dt, t) => {
      g.intensity = 0.3 + (Math.sin(t * 37) > 0.97 ? -0.2 : 0.05 * Math.sin(t * 2));
    };
    return n;
  },
  darts() {
    const n = new Node('darts');
    n.add(mesh(C('darts', () => {
      const b = new MeshBuilder();
      b.add(roundedBox(0.62, 0.62, 0.03, 0.02, 2), { color: PAL.woodDark, p: [0, 0, 0.015] });
      const rings = [[0.24, 0x1d1d1d], [0.2, 0xd62828], [0.17, 0xf3e2c0], [0.12, 0x1d1d1d], [0.08, 0x3c9a4a], [0.035, 0xd62828]];
      rings.forEach(([r, c], i) => b.add(cylinder(r, r, 0.02, 24), { color: c, r: [Math.PI / 2, 0, 0], p: [0, 0, 0.04 + i * 0.002] }));
      for (let i = 0; i < 3; i++) b.add(cylinder(0.006, 0.006, 0.12, 5), { color: [0xffd166, 0x06d6a0, 0x118ab2][i], r: [Math.PI / 2 - 0.2, 0, 0], p: [-0.05 + i * 0.06, 0.04 - i * 0.05, 0.1] });
      return b.build();
    }), MATS.vc, 0.008));
    return n;
  },
  tv(def, ctx) {
    const n = new Node('tv');
    n.add(mesh(C('tvBody', () => {
      const b = new MeshBuilder();
      b.add(roundedBox(1.42, 0.86, 0.08, 0.03, 2), { color: 0x1a1a1a, p: [0, 0, 0.06] });
      b.add(box(0.2, 0.2, 0.06), { color: 0x333333, p: [0, 0, 0.0] });
      return b.build();
    }), MATS.vcShiny));
    const tex = tvScreen((g, w, h, t) => drawTV(g, w, h, t, ctx.tvMode ? ctx.tvMode() : 'match'));
    const q = new Mesh(C('tvQuad', () => new MeshBuilder().add(quad(1.3, 0.74), { color: 0xffffff }).build()), new Material({ map: tex, unlit: true }));
    q.position[2] = 0.105;
    q.castShadow = false;
    n.add(q);
    const g = new Glow(0x7ab8ff, 1.3, 0.2);
    g.position = [0, 0, 0.4];
    n.add(g);
    let acc = 0;
    n.update = (dt, t) => {
      acc += dt;
      if (acc > 0.12) {
        acc = 0;
        tex.draw(t);
      }
    };
    return n;
  },
  moose() {
    const n = new Node('moose');
    n.add(mesh(C('moose', () => {
      const b = new MeshBuilder();
      b.add(roundedBox(0.5, 0.6, 0.05, 0.08, 2), { color: PAL.woodDark, p: [0, 0, 0.025] });
      b.add(sphere(0.2, 12, 10), { color: 0x8a5a3a, p: [0, 0.02, 0.2], s: [1, 1.1, 1] });
      b.add(capsule(0.12, 0.2, 10, 4), { color: 0x9a6a4a, p: [0, -0.1, 0.38], r: [Math.PI / 2 - 0.3, 0, 0] });
      b.add(sphere(0.05, 8, 6), { color: 0x2b1a12, p: [0, -0.06, 0.53] });
      for (const s of [-1, 1]) {
        b.add(sphere(0.035, 8, 6), { color: 0xffffff, p: [s * 0.09, 0.1, 0.36] });
        b.add(sphere(0.018, 6, 5), { color: 0x111111, p: [s * 0.09, 0.1, 0.39] });
        b.add(roundedBox(0.36, 0.05, 0.22, 0.02, 1), { color: 0xd9c39a, p: [s * 0.3, 0.3, 0.15], r: [0, 0, s * 0.4] });
        for (let i = 0; i < 3; i++) b.add(capsule(0.025, 0.12, 6, 2), { color: 0xd9c39a, p: [s * (0.22 + i * 0.1), 0.42 + i * 0.03, 0.15], r: [0, 0, s * 0.2] });
        b.add(capsule(0.04, 0.08, 6, 2), { color: 0x7a4a2a, p: [s * 0.17, 0.18, 0.2], r: [0, 0, s * 1.2] });
      }
      b.add(torus(0.12, 0.02, 6, 16), { color: 0xd62828, p: [0, -0.2, 0.36], r: [Math.PI / 2 - 0.3, 0, 0] });
      return b.build();
    }), MATS.vc, 0.01));
    return n;
  },
};

function drawTV(g, w, h, t, mode) {
  if (mode === 'match') {
    g.fillStyle = '#2f8f46';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#37a352';
    for (let i = 0; i < 8; i++) if (i % 2) g.fillRect((i * w) / 8, 0, w / 8, h);
    g.strokeStyle = '#e8ffe8';
    g.lineWidth = 2;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.beginPath();
    g.moveTo(w / 2, 8);
    g.lineTo(w / 2, h - 8);
    g.stroke();
    g.beginPath();
    g.arc(w / 2, h / 2, 18, 0, Math.PI * 2);
    g.stroke();
    const bx = w / 2 + Math.sin(t * 0.9) * 90, by = h / 2 + Math.sin(t * 1.7) * 40;
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? '#d62828' : '#1d3557';
      g.fillRect(bx + Math.sin(t + i * 2) * 50 - 3, by + Math.cos(t * 1.3 + i) * 30 - 5, 6, 10);
    }
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(bx, by, 3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(6, 6, 74, 16);
    g.fillStyle = '#fff';
    g.font = 'bold 11px sans-serif';
    g.fillText('FCQ 1 - 1 OLR', 10, 18);
  } else {
    g.fillStyle = '#123';
    g.fillRect(0, 0, w, h);
    const hue = (t * 40) % 360;
    g.fillStyle = `hsl(${hue},70%,55%)`;
    g.fillRect(0, h * 0.65, w, h * 0.35);
    g.fillStyle = '#fff';
    g.font = 'bold 18px sans-serif';
    g.fillText('♪ Clips ♪', 80, 60 + Math.sin(t * 3) * 6);
  }
}

/** striped parasol for the terrace */
export function parasolModel(colA = 0xc8102e, colB = 0xf3e2c0) {
  return C('parasol' + colA, () => {
    const b = new MeshBuilder();
    b.add(cylinder(0.03, 0.03, 2.7, 8), { color: PAL.woodLight, p: [0, 1.35, 0] });
    b.add(cylinder(0.25, 0.3, 0.08, 14), { color: 0x2b2b2b, p: [0, 0.04, 0] });
    const N = 10, R = 0.85, H = 0.36, y0 = 2.4;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
      const p0 = [Math.cos(a0) * R, y0, Math.sin(a0) * R], p1 = [Math.cos(a1) * R, y0, Math.sin(a1) * R], ap = [0, y0 + H, 0];
      const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
      const vx = ap[0] - p0[0], vy = ap[1] - p0[1], vz = ap[2] - p0[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz);
      const n = [nx / l, ny / l, nz / l];
      const prim = { positions: [...p0, ...ap, ...p1], normals: [...n, ...n, ...n], uvs: [0, 0, 0.5, 1, 1, 0], indices: [0, 1, 2] };
      b.add(prim, { color: i % 2 ? colA : colB });
      // scalloped edge
      b.add(sphere(0.06, 6, 4), { color: i % 2 ? colA : colB, p: [Math.cos((a0 + a1) / 2) * R * 0.98, y0 - 0.02, Math.sin((a0 + a1) / 2) * R * 0.98], s: [1.6, 0.6, 1.6] });
    }
    b.add(sphere(0.06, 8, 6), { color: PAL.brass, p: [0, y0 + H + 0.03, 0] });
    return b.build();
  });
}

export function planterModel() {
  return C('planter', () => {
    const b = new MeshBuilder();
    b.add(roundedBox(1.0, 0.45, 0.4, 0.04, 2), { color: PAL.woodMid, p: [0, 0.225, 0] });
    for (let i = 0; i < 6; i++) b.add(sphere(0.16, 8, 6), { color: i % 2 ? PAL.plant : PAL.plantDark, p: [-0.38 + i * 0.15, 0.55 + (i % 3) * 0.05, (i % 2 ? 0.05 : -0.05)] });
    for (let i = 0; i < 3; i++) b.add(sphere(0.05, 6, 4), { color: [0xef476f, 0xffd166, 0xffffff][i], p: [-0.25 + i * 0.25, 0.72, 0.08] });
    return b.build();
  });
}

/** Build model for a catalog item. ctx: {posterBeer(), seed, tvMode()} */
export function buildItemModel(def, ctx = {}) {
  const fn = builders[def.model];
  if (!fn) {
    const n = new Node('unknown');
    n.add(mesh(new MeshBuilder().add(roundedBox(0.5, 0.5, 0.5, 0.05), { color: 0xff00ff, p: [0, 0.25, 0] }).build()));
    return n;
  }
  return fn(def, ctx);
}

export function stoolModel() {
  return mesh(chairGeo('stool'), MATS.vc, 0.008);
}
