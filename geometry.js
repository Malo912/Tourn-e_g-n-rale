// Procedural primitive builders + MeshBuilder that merges primitives with baked vertex colors.
import { Geometry } from './scene.js';
import { mat4, normalMatrix, hexToLinear, TAU } from './math.js';

function prim() {
  return { positions: [], normals: [], uvs: [], indices: [] };
}

export function box(w, h, d) {
  const g = prim();
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const faces = [
    // normal, u axis, v axis
    [[1, 0, 0], [0, 0, -1], [0, 1, 0], hw, d, h],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0], hw, d, h],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1], hh, w, d],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1], hh, w, d],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0], hd, w, h],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0], hd, w, h],
  ];
  for (const [n, u, v, off, su, sv] of faces) {
    const base = g.positions.length / 3;
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 2; i++) {
        const a = (i - 0.5) * su, b = (j - 0.5) * sv;
        g.positions.push(n[0] * off + u[0] * a + v[0] * b, n[1] * off + u[1] * a + v[1] * b, n[2] * off + u[2] * a + v[2] * b);
        g.normals.push(n[0], n[1], n[2]);
        g.uvs.push(i, j);
      }
    g.indices.push(base, base + 1, base + 3, base, base + 3, base + 2);
  }
  return g;
}

/** Rounded box with smooth bevels (radius r). */
export function roundedBox(w, h, d, r = 0.05, seg = 3) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  if (r <= 0.0005) return box(w, h, d);
  const g = prim();
  const half = [w / 2, h / 2, d / 2];
  const coords = (hlen) => {
    const out = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * (Math.PI / 2);
      out.push(-hlen + r - r * Math.cos(a));
    }
    for (let i = seg; i >= 0; i--) {
      const a = (i / seg) * (Math.PI / 2);
      out.push(hlen - r + r * Math.cos(a));
    }
    // remove duplicate center if r == hlen
    return out;
  };
  const cx = coords(half[0]), cy = coords(half[1]), cz = coords(half[2]);
  const inner = [half[0] - r, half[1] - r, half[2] - r];
  const faces = [
    { axis: 0, sign: 1, u: 2, us: -1, v: 1, vs: 1 },
    { axis: 0, sign: -1, u: 2, us: 1, v: 1, vs: 1 },
    { axis: 1, sign: 1, u: 0, us: 1, v: 2, vs: -1 },
    { axis: 1, sign: -1, u: 0, us: 1, v: 2, vs: 1 },
    { axis: 2, sign: 1, u: 0, us: 1, v: 1, vs: 1 },
    { axis: 2, sign: -1, u: 0, us: -1, v: 1, vs: 1 },
  ];
  const cs = [cx, cy, cz];
  for (const f of faces) {
    const cu = cs[f.u], cv = cs[f.v];
    const base = g.positions.length / 3;
    const nu = cu.length, nv = cv.length;
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const p = [0, 0, 0];
        p[f.axis] = half[f.axis] * f.sign;
        p[f.u] = cu[f.us > 0 ? i : nu - 1 - i];
        p[f.v] = cv[f.vs > 0 ? j : nv - 1 - j];
        const q = [
          Math.max(-inner[0], Math.min(inner[0], p[0])),
          Math.max(-inner[1], Math.min(inner[1], p[1])),
          Math.max(-inner[2], Math.min(inner[2], p[2])),
        ];
        let nx = p[0] - q[0], ny = p[1] - q[1], nz = p[2] - q[2];
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l; ny /= l; nz /= l;
        g.positions.push(q[0] + nx * r, q[1] + ny * r, q[2] + nz * r);
        g.normals.push(nx, ny, nz);
        g.uvs.push(i / (nu - 1), j / (nv - 1));
      }
    }
    for (let j = 0; j < nv - 1; j++)
      for (let i = 0; i < nu - 1; i++) {
        const a = base + j * nu + i, b = a + 1, c = a + nu, dd = c + 1;
        g.indices.push(a, b, dd, a, dd, c);
      }
  }
  return g;
}

export function cylinder(rTop, rBottom, h, seg = 16, opts = {}) {
  const { capTop = true, capBottom = true, open = false } = opts;
  const g = prim();
  const hh = h / 2;
  const slope = (rBottom - rTop) / h;
  for (let j = 0; j <= 1; j++) {
    const y = j ? hh : -hh;
    const r = j ? rTop : rBottom;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TAU;
      const s = Math.sin(a), c = Math.cos(a);
      g.positions.push(r * s, y, r * c);
      const l = Math.hypot(1, slope);
      g.normals.push(s / l, slope / l, c / l);
      g.uvs.push(i / seg, j);
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = i, b = i + 1, c = i + seg + 1, d = i + seg + 2;
    g.indices.push(a, b, d, a, d, c);
  }
  if (!open) {
    const cap = (top) => {
      const r = top ? rTop : rBottom;
      if (r <= 0) return;
      const y = top ? hh : -hh;
      const ny = top ? 1 : -1;
      const center = g.positions.length / 3;
      g.positions.push(0, y, 0);
      g.normals.push(0, ny, 0);
      g.uvs.push(0.5, 0.5);
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * TAU;
        g.positions.push(r * Math.sin(a), y, r * Math.cos(a));
        g.normals.push(0, ny, 0);
        g.uvs.push(0.5 + Math.sin(a) / 2, 0.5 + Math.cos(a) / 2);
      }
      for (let i = 0; i < seg; i++) {
        if (top) g.indices.push(center, center + 1 + i, center + 2 + i);
        else g.indices.push(center, center + 2 + i, center + 1 + i);
      }
    };
    if (capTop) cap(true);
    if (capBottom) cap(false);
  }
  return g;
}

export function sphere(r, ws = 16, hs = 12, o = {}) {
  const { phiStart = 0, phiLen = TAU, thetaStart = 0, thetaLen = Math.PI, sy = 1 } = o;
  const g = prim();
  for (let j = 0; j <= hs; j++) {
    const t = thetaStart + (j / hs) * thetaLen;
    for (let i = 0; i <= ws; i++) {
      const p = phiStart + (i / ws) * phiLen;
      const x = Math.sin(t) * Math.sin(p), y = Math.cos(t), z = Math.sin(t) * Math.cos(p);
      g.positions.push(x * r, y * r * sy, z * r);
      const nl = Math.hypot(x, y / sy, z) || 1;
      g.normals.push(x / nl, y / sy / nl, z / nl);
      g.uvs.push(i / ws, j / hs);
    }
  }
  for (let j = 0; j < hs; j++)
    for (let i = 0; i < ws; i++) {
      const a = j * (ws + 1) + i, b = a + 1, c = a + ws + 1, d = c + 1;
      if (j !== 0 || thetaStart > 0) g.indices.push(a, c, b);
      if (j !== hs - 1 || thetaStart + thetaLen < Math.PI) g.indices.push(b, c, d);
    }
  return g;
}

/** Lathe around Y. pts = [[radius, y], ...] bottom to top. */
export function lathe(pts, seg = 20, o = {}) {
  const { capBottom = true, capTop = false } = o;
  const g = prim();
  const n = pts.length;
  // profile normals
  const pn = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dr = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dr, dy) || 1;
    pn.push([dy / l, -dr / l]);
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TAU;
      const s = Math.sin(a), c = Math.cos(a);
      g.positions.push(pts[j][0] * s, pts[j][1], pts[j][0] * c);
      g.normals.push(pn[j][0] * s, pn[j][1], pn[j][0] * c);
      g.uvs.push(i / seg, j / (n - 1));
    }
  }
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
      g.indices.push(a, b, d, a, d, c);
    }
  const cap = (j, up) => {
    const [r, y] = pts[j];
    if (r <= 0.0001) return;
    const center = g.positions.length / 3;
    g.positions.push(0, y, 0);
    g.normals.push(0, up ? 1 : -1, 0);
    g.uvs.push(0.5, 0.5);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TAU;
      g.positions.push(r * Math.sin(a), y, r * Math.cos(a));
      g.normals.push(0, up ? 1 : -1, 0);
      g.uvs.push(0.5, 0.5);
    }
    for (let i = 0; i < seg; i++) {
      if (up) g.indices.push(center, center + 1 + i, center + 2 + i);
      else g.indices.push(center, center + 2 + i, center + 1 + i);
    }
  };
  if (capBottom) cap(0, false);
  if (capTop) cap(n - 1, true);
  return g;
}

export function capsule(r, len, seg = 12, rings = 6) {
  const pts = [];
  for (let i = 0; i <= rings; i++) {
    const a = -Math.PI / 2 + (i / rings) * (Math.PI / 2);
    pts.push([Math.cos(a) * r, -len / 2 + Math.sin(a) * r]);
  }
  for (let i = 0; i <= rings; i++) {
    const a = (i / rings) * (Math.PI / 2);
    pts.push([Math.cos(a) * r, len / 2 + Math.sin(a) * r]);
  }
  pts[0][0] = 0.0001;
  pts[pts.length - 1][0] = 0.0001;
  return lathe(pts, seg, { capBottom: false, capTop: false });
}

export function torus(R, r, rs = 8, ts = 24, arc = TAU) {
  const g = prim();
  for (let j = 0; j <= rs; j++)
    for (let i = 0; i <= ts; i++) {
      const u = (i / ts) * arc, v = (j / rs) * TAU;
      const cx = Math.cos(u) * R, cy = Math.sin(u) * R;
      const x = (R + r * Math.cos(v)) * Math.cos(u);
      const y = (R + r * Math.cos(v)) * Math.sin(u);
      const z = r * Math.sin(v);
      g.positions.push(x, y, z);
      let nx = x - cx, ny = y - cy, nz = z;
      const l = Math.hypot(nx, ny, nz) || 1;
      g.normals.push(nx / l, ny / l, nz / l);
      g.uvs.push(i / ts, j / rs);
    }
  for (let j = 1; j <= rs; j++)
    for (let i = 1; i <= ts; i++) {
      const a = (ts + 1) * j + i - 1, b = (ts + 1) * (j - 1) + i - 1, c = (ts + 1) * (j - 1) + i, d = (ts + 1) * j + i;
      g.indices.push(a, b, d, b, c, d);
    }
  return g;
}

/** XZ plane facing +Y */
export function plane(w, d, uRep = 1, vRep = 1) {
  return {
    positions: [-w / 2, 0, -d / 2, w / 2, 0, -d / 2, -w / 2, 0, d / 2, w / 2, 0, d / 2],
    normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    uvs: [0, 0, uRep, 0, 0, vRep, uRep, vRep],
    indices: [0, 2, 3, 0, 3, 1],
  };
}

/** XY quad facing +Z */
export function quad(w, h, uRep = 1, vRep = 1) {
  return {
    positions: [-w / 2, -h / 2, 0, w / 2, -h / 2, 0, -w / 2, h / 2, 0, w / 2, h / 2, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uvs: [0, 0, uRep, 0, 0, vRep, uRep, vRep],
    indices: [0, 1, 3, 0, 3, 2],
  };
}

export function disc(r, seg = 20) {
  return cylinder(r, r, 0.001, seg, { capBottom: false });
}

/** Merge primitives with transforms and baked vertex colors. */
export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
    this._m = mat4.create();
    this._n = new Float32Array(9);
  }
  /**
   * @param g primitive
   * @param o {color, p, r, s, grad:[bottom,top], uvScale}
   */
  add(g, o = {}) {
    const color = Array.isArray(o.color) ? o.color : hexToLinear(o.color ?? 0xffffff);
    const srcCol = o.color === undefined && g.colors ? g.colors : null;
    const p = o.p || [0, 0, 0], r = o.r || [0, 0, 0], s = o.s || [1, 1, 1];
    const m = mat4.compose(this._m, p, r, s);
    const nm = normalMatrix(this._n, m);
    const base = this.pos.length / 3;
    const P = g.positions, N = g.normals, U = g.uvs;
    let ymin = Infinity, ymax = -Infinity;
    if (o.grad) for (let i = 1; i < P.length; i += 3) { ymin = Math.min(ymin, P[i]); ymax = Math.max(ymax, P[i]); }
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i], y = P[i + 1], z = P[i + 2];
      this.pos.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
      const nx = N[i], ny = N[i + 1], nz = N[i + 2];
      let ox = nm[0] * nx + nm[3] * ny + nm[6] * nz, oy = nm[1] * nx + nm[4] * ny + nm[7] * nz, oz = nm[2] * nx + nm[5] * ny + nm[8] * nz;
      const l = Math.hypot(ox, oy, oz) || 1;
      this.nor.push(ox / l, oy / l, oz / l);
      let k = 1;
      if (o.grad) {
        const t = ymax > ymin ? (y - ymin) / (ymax - ymin) : 1;
        k = o.grad[0] + (o.grad[1] - o.grad[0]) * t;
      }
      if (srcCol) this.col.push(srcCol[i] * k, srcCol[i + 1] * k, srcCol[i + 2] * k);
      else this.col.push(color[0] * k, color[1] * k, color[2] * k);
    }
    const us = o.uvScale || [1, 1];
    const uo = o.uvOffset || [0, 0];
    for (let i = 0; i < U.length; i += 2) this.uv.push(U[i] * us[0] + uo[0], U[i + 1] * us[1] + uo[1]);
    if (U.length === 0) for (let i = 0; i < P.length / 3; i++) this.uv.push(0, 0);
    for (const ix of g.indices) this.idx.push(base + ix);
    return this;
  }
  /** add another builder's content */
  get empty() {
    return this.pos.length === 0;
  }
  build() {
    return new Geometry({ positions: this.pos, normals: this.nor, uvs: this.uv, colors: this.col, indices: this.idx });
  }
}

export function toGeometry(g) {
  return new Geometry(g);
}
