// Walkability grid (0.5 m cells) + A* path finding with line-of-sight smoothing.
export const FREE = 0, BLOCK = 1, STAFF = 2, OUTSIDE = 3;

class MinHeap {
  constructor() {
    this.a = [];
  }
  push(n, f) {
    const a = this.a;
    a.push([f, n]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top[1];
  }
  get size() {
    return this.a.length;
  }
}

export class NavGrid {
  /** origin = world coords of cell (0,0) corner */
  constructor(ox, oz, cols, rows, cell = 0.5) {
    this.ox = ox;
    this.oz = oz;
    this.cols = cols;
    this.rows = rows;
    this.cell = cell;
    this.cells = new Uint8Array(cols * rows).fill(BLOCK);
    this.g = new Float32Array(cols * rows);
    this.came = new Int32Array(cols * rows);
    this.stamp = new Uint32Array(cols * rows);
    this.closed = new Uint32Array(cols * rows);
    this.curStamp = 1;
  }
  idx(c, r) {
    return r * this.cols + c;
  }
  inside(c, r) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }
  toCell(x, z) {
    return [Math.floor((x - this.ox) / this.cell), Math.floor((z - this.oz) / this.cell)];
  }
  center(c, r) {
    return { x: this.ox + (c + 0.5) * this.cell, z: this.oz + (r + 0.5) * this.cell };
  }
  get(c, r) {
    if (!this.inside(c, r)) return BLOCK;
    return this.cells[this.idx(c, r)];
  }
  set(c, r, v) {
    if (this.inside(c, r)) this.cells[this.idx(c, r)] = v;
  }
  /** fill a world rect [x0,x1)x[z0,z1) */
  fillRect(x0, z0, x1, z1, v) {
    const [c0, r0] = this.toCell(x0 + 1e-4, z0 + 1e-4);
    const [c1, r1] = this.toCell(x1 - 1e-4, z1 - 1e-4);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.set(c, r, v);
  }
  walkable(c, r, staff) {
    const v = this.get(c, r);
    return v === FREE || v === OUTSIDE || (staff && v === STAFF);
  }
  walkableAt(x, z, staff) {
    const [c, r] = this.toCell(x, z);
    return this.walkable(c, r, staff);
  }
  nearestWalkable(x, z, staff, maxR = 8) {
    const [c0, r0] = this.toCell(x, z);
    if (this.walkable(c0, r0, staff)) return { c: c0, r: r0 };
    let best = null, bd = Infinity;
    for (let rad = 1; rad <= maxR; rad++) {
      for (let dr = -rad; dr <= rad; dr++)
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
          const c = c0 + dc, r = r0 + dr;
          if (!this.walkable(c, r, staff)) continue;
          const p = this.center(c, r);
          const d = Math.hypot(p.x - x, p.z - z);
          if (d < bd) {
            bd = d;
            best = { c, r };
          }
        }
      if (best) return best;
    }
    return null;
  }
  /** A* from world to world. returns array of {x,z} (excluding start) or null */
  findPath(sx, sz, tx, tz, staff = false) {
    const s = this.nearestWalkable(sx, sz, staff, 4);
    const t = this.nearestWalkable(tx, tz, staff, 8);
    if (!s || !t) return null;
    const cols = this.cols;
    const start = this.idx(s.c, s.r), goal = this.idx(t.c, t.r);
    this.curStamp++;
    const stamp = this.curStamp;
    const heap = new MinHeap();
    const h = (i) => {
      const c = i % cols, r = (i / cols) | 0;
      const dx = Math.abs(c - t.c), dz = Math.abs(r - t.r);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    this.g[start] = 0;
    this.stamp[start] = stamp;
    this.came[start] = -1;
    heap.push(start, h(start));
    let found = start === goal;
    let iter = 0;
    while (heap.size && !found && iter++ < 20000) {
      const cur = heap.pop();
      if (this.closed[cur] === stamp) continue;
      this.closed[cur] = stamp;
      if (cur === goal) {
        found = true;
        break;
      }
      const cc = cur % cols, cr = (cur / cols) | 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = cc + dc, nr = cr + dr;
          if (!this.walkable(nc, nr, staff)) continue;
          if (dr && dc && (!this.walkable(cc + dc, cr, staff) || !this.walkable(cc, cr + dr, staff))) continue;
          const ni = this.idx(nc, nr);
          if (this.closed[ni] === stamp) continue;
          let cost = dr && dc ? 1.414 : 1;
          if (this.get(nc, nr) === OUTSIDE) cost *= 1.0;
          const ng = this.g[cur] + cost;
          if (this.stamp[ni] !== stamp || ng < this.g[ni]) {
            this.stamp[ni] = stamp;
            this.g[ni] = ng;
            this.came[ni] = cur;
            heap.push(ni, ng + h(ni));
          }
        }
    }
    if (!found) return null;
    const cellsPath = [];
    let cur = goal;
    while (cur !== -1 && cur !== undefined) {
      cellsPath.push(cur);
      if (cur === start) break;
      cur = this.came[cur];
    }
    cellsPath.reverse();
    const pts = cellsPath.map((i) => this.center(i % cols, (i / cols) | 0));
    // replace final point by exact target if walkable
    if (this.walkableAt(tx, tz, staff)) pts[pts.length - 1] = { x: tx, z: tz };
    return this.smooth([{ x: sx, z: sz }, ...pts], staff).slice(1);
  }
  lineClear(a, b, staff) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(d / (this.cell * 0.35));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      // check a small radius around the line (character width)
      for (const [ox, oz] of [[0, 0], [0.16, 0], [-0.16, 0], [0, 0.16], [0, -0.16]]) if (!this.walkableAt(x + ox, z + oz, staff)) return false;
    }
    return true;
  }
  smooth(pts, staff) {
    if (pts.length <= 2) return pts;
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.lineClear(pts[i], pts[j], staff)) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }
  /** flood fill reachability from a world point */
  reachable(x, z, staff = false) {
    const s = this.nearestWalkable(x, z, staff, 2);
    const seen = new Uint8Array(this.cols * this.rows);
    if (!s) return seen;
    const q = [this.idx(s.c, s.r)];
    seen[q[0]] = 1;
    while (q.length) {
      const cur = q.pop();
      const cc = cur % this.cols, cr = (cur / this.cols) | 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = cc + dc, nr = cr + dr;
        if (!this.walkable(nc, nr, staff)) continue;
        const ni = this.idx(nc, nr);
        if (seen[ni]) continue;
        seen[ni] = 1;
        q.push(ni);
      }
    }
    return seen;
  }
  isReachableIn(seen, x, z) {
    const [c, r] = this.toCell(x, z);
    if (!this.inside(c, r)) return false;
    return !!seen[this.idx(c, r)];
  }
  clone() {
    const g = new NavGrid(this.ox, this.oz, this.cols, this.rows, this.cell);
    g.cells.set(this.cells);
    return g;
  }
}
