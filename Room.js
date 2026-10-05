// The bar's shell: floor, walls with cut-away, windows, doors, street outside, pendant lamps.
import { Node, Mesh, Glow, Material } from '../engine/scene.js';
import { MeshBuilder, box, roundedBox, quad, plane, cylinder, lathe, sphere, torus } from '../engine/geometry.js';
import { MATS, PAL, texMat, colorMat } from './materials.js';
import { woodFloor, bricks, wallpaper, nightStreet } from './textures.js';
import { LAYOUT } from '../data/config.js';
import { hexToLinear, damp } from '../engine/math.js';
import { Texture } from '../engine/scene.js';

const T = 0.22; // wall thickness

let floorTex, brickTex, paperTex, streetTex, paverTex;
function textures() {
  if (!floorTex) {
    floorTex = woodFloor();
    brickTex = bricks();
    paperTex = wallpaper();
    streetTex = nightStreet();
    paverTex = pavers();
  }
}

function pavers() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6d6577';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      g.fillStyle = ['#7d7588', '#776f82', '#837b8e', '#71697c'][(x * 3 + y * 5) % 4];
      g.fillRect(x * 64 + (y % 2) * 32 + 3, y * 64 + 3, 58, 58);
    }
  return new Texture(c, { repeat: true });
}

/**
 * Build one wall in local space: runs along +X from 0..L, interior face at z=0 facing +Z.
 * openings: [{x0,x1,y0,y1}]
 */
function buildWall(L, H, openings, opts) {
  const full = new Node('wallFull');
  const low = new Node('wallLow');
  const struct = new MeshBuilder();
  const wains = new MeshBuilder();
  const paper = new MeshBuilder();
  const brick = new MeshBuilder();
  const lowB = new MeshBuilder();
  const WH = 1.0; // wainscot height
  const LOWH = 0.55;
  const useBrick = opts.brick;
  // horizontal intervals
  const segs = [];
  let cursor = 0;
  const ops = [...openings].sort((a, b) => a.x0 - b.x0);
  for (const o of ops) {
    if (o.x0 > cursor) segs.push({ x0: cursor, x1: o.x0, y0: 0, y1: H });
    segs.push({ x0: o.x0, x1: o.x1, y0: 0, y1: o.y0, op: o });
    segs.push({ x0: o.x0, x1: o.x1, y0: o.y1, y1: H, op: o });
    cursor = o.x1;
  }
  if (cursor < L) segs.push({ x0: cursor, x1: L, y0: 0, y1: H });
  for (const s of segs) {
    const w = s.x1 - s.x0;
    const h = s.y1 - s.y0;
    if (w <= 0.001 || h <= 0.001) continue;
    const cx = (s.x0 + s.x1) / 2;
    // structural core (exterior + thickness)
    struct.add(box(w, h, T), { color: 0x3a2a24, p: [cx, s.y0 + h / 2, -T / 2] });
    // interior surfaces
    const wy0 = s.y0, wy1 = Math.min(s.y1, WH);
    if (wy1 > wy0) {
      wains.add(box(w, wy1 - wy0, 0.04), { color: PAL.woodDark, p: [cx, (wy0 + wy1) / 2, 0.02] });
      // vertical panel grooves
      for (let x = s.x0 + 0.25; x < s.x1 - 0.1; x += 0.5) wains.add(box(0.03, Math.max(0, wy1 - wy0 - 0.2), 0.012), { color: 0x3b2112, p: [x, (wy0 + wy1) / 2, 0.045] });
    }
    const py0 = Math.max(s.y0, WH), py1 = s.y1;
    if (py1 > py0) {
      const target = useBrick ? brick : paper;
      target.add(quad(w, py1 - py0), { color: 0xffffff, p: [cx, (py0 + py1) / 2, 0.005], uvScale: useBrick ? [w / 2, (py1 - py0) / 1.4] : [w / 1.0, (py1 - py0) / 1.0], uvOffset: [s.x0 / (useBrick ? 2 : 1), (py0 - WH) / (useBrick ? 1.4 : 1)] });
    }
    // chair rail
    if (s.y0 <= WH && s.y1 >= WH) wains.add(box(w, 0.06, 0.07), { color: PAL.woodMid, p: [cx, WH, 0.035] });
    // crown
    if (s.y1 >= H - 0.01) wains.add(box(w, 0.12, 0.08), { color: PAL.woodMid, p: [cx, H - 0.06, 0.04] });
    // baseboard
    if (s.y0 === 0) wains.add(box(w, 0.14, 0.06), { color: 0x2c1a10, p: [cx, 0.07, 0.03] });
    // ---- low version
    const ly1 = Math.min(s.y1, LOWH);
    if (ly1 > s.y0 && s.y0 < LOWH) {
      lowB.add(box(w, ly1 - s.y0, T), { color: 0x3a2a24, p: [cx, (s.y0 + ly1) / 2, -T / 2] });
      lowB.add(box(w, ly1 - s.y0, 0.04), { color: PAL.woodDark, p: [cx, (s.y0 + ly1) / 2, 0.02] });
      if (ly1 === LOWH) lowB.add(roundedBox(w + 0.0, 0.06, T + 0.1, 0.02, 1), { color: PAL.woodMid, p: [cx, LOWH + 0.03, -T / 2 + 0.03] });
      if (s.y0 === 0) lowB.add(box(w, 0.14, 0.06), { color: 0x2c1a10, p: [cx, 0.07, 0.03] });
    }
  }
  // opening frames
  for (const o of ops) {
    const w = o.x1 - o.x0;
    const cx = (o.x0 + o.x1) / 2;
    const fw = 0.08;
    struct.add(box(w + fw * 2, fw, T + 0.08), { color: PAL.woodMid, p: [cx, o.y1 + fw / 2, -T / 2] });
    struct.add(box(fw, o.y1 - o.y0, T + 0.08), { color: PAL.woodMid, p: [o.x0 - fw / 2, (o.y0 + o.y1) / 2, -T / 2] });
    struct.add(box(fw, o.y1 - o.y0, T + 0.08), { color: PAL.woodMid, p: [o.x1 + fw / 2, (o.y0 + o.y1) / 2, -T / 2] });
    if (o.y0 > 0) {
      struct.add(box(w + fw * 2, 0.06, T + 0.16), { color: PAL.woodMid, p: [cx, o.y0 - 0.03, -T / 2 + 0.04] });
      // window mullions
      struct.add(box(0.05, o.y1 - o.y0, 0.05), { color: PAL.woodMid, p: [cx, (o.y0 + o.y1) / 2, -T / 2] });
      struct.add(box(w, 0.05, 0.05), { color: PAL.woodMid, p: [cx, o.y0 + (o.y1 - o.y0) * 0.62, -T / 2] });
    }
  }
  const sm = new Mesh(struct.build(), MATS.vc);
  const wm = new Mesh(wains.build(), MATS.vc);
  full.add(sm, wm);
  if (!paper.empty) full.add(new Mesh(paper.build(), texMat(paperTex, { toon: 0.6 })));
  if (!brick.empty) full.add(new Mesh(brick.build(), texMat(brickTex, { toon: 0.6 })));
  for (const m of full.children) m.receiveShadow = true;
  if (!lowB.empty) low.add(new Mesh(lowB.build(), MATS.vc));
  // window glass + outside painting
  for (const o of ops) {
    if (o.y0 <= 0) continue;
    const w = o.x1 - o.x0, h = o.y1 - o.y0;
    const out = new Mesh(new MeshBuilder().add(quad(w, h), { color: 0xffffff, uvScale: [w / 4, h / 2], uvOffset: [(o.x0 * 0.13) % 1, 0.1] }).build(), new Material({ map: streetTex, unlit: true }));
    out.position = [(o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2, -T - 0.05];
    out.castShadow = false;
    full.add(out);
    const g = new Mesh(new MeshBuilder().add(quad(w, h), { color: 0xffffff }).build(), MATS.glassDouble);
    g.position = [(o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2, -T / 2];
    g.castShadow = false;
    full.add(g);
  }
  return { full, low };
}

export class Room {
  constructor(scene) {
    textures();
    this.scene = scene;
    this.node = new Node('room');
    scene.add(this.node);
    this.walls = [];
    this.lamps = [];
    this.doors = {};
    this.size = { w: 12, d: 9 };
    this.wallDecor = { N: new Node(), W: new Node(), E: new Node(), S: new Node() };
  }

  build(w, d) {
    this.size = { w, d };
    for (const c of [...this.node.children]) this.node.remove(c);
    this.walls = [];
    this.lamps = [];
    const H = LAYOUT.wallH;
    // ---- floor
    const fb = new MeshBuilder();
    fb.add(plane(w, d), { color: 0xffffff, p: [w / 2, 0, d / 2], uvScale: [w / 2.6, d / 2.6] });
    const floor = new Mesh(fb.build(), texMat(floorTex, { toon: 0.5, rim: 0 }));
    floor.castShadow = false;
    this.node.add(floor);
    // staff floor tiles behind the counter
    const tb = new MeshBuilder();
    for (let x = 0; x < LAYOUT.flap.x1; x += 0.5)
      for (let z = 0; z < LAYOUT.counter.z0; z += 0.5) tb.add(box(0.48, 0.01, 0.48), { color: ((x + z) * 2) % 2 ? 0xe9e2d0 : 0x2f2a28, p: [x + 0.25, 0.006, z + 0.25] });
    const tiles = new Mesh(tb.build(), MATS.vcSoft);
    tiles.castShadow = false;
    this.node.add(tiles);
    // ---- outside: sidewalk + street
    const sb = new MeshBuilder();
    sb.add(plane(w + 16, 3.4), { color: 0xffffff, p: [w / 2, -0.02, d + T + 1.7], uvScale: [(w + 16) / 1.2, 3.4 / 1.2] });
    const sidewalk = new Mesh(sb.build(), texMat(paverTex, { toon: 0.6, rim: 0 }));
    sidewalk.castShadow = false;
    this.node.add(sidewalk);
    const rb = new MeshBuilder();
    rb.add(box(w + 16, 0.12, 0.25), { color: 0x8c8496, p: [w / 2, 0.0, d + T + 3.45] });
    rb.add(plane(w + 16, 12), { color: 0x24222e, p: [w / 2, -0.06, d + T + 9.6] });
    for (let x = -8; x < w + 8; x += 3) rb.add(box(1.4, 0.01, 0.15), { color: 0xe8e2c8, p: [x, -0.05, d + T + 8] });
    // side walls outside (neighbour facades) at x<0 and x>w along street
    rb.add(box(8, 0.05, d + T), { color: 0x2b2633, p: [-4 - 0.12, -0.03, (d + T) / 2] });
    rb.add(box(8, 0.05, d + T), { color: 0x2b2633, p: [w + 4 + 0.12, -0.03, (d + T) / 2] });
    const road = new Mesh(rb.build(), MATS.vcSoft);
    road.castShadow = false;
    this.node.add(road);
    // street lamps
    for (const x of [-2.5, w + 2.5]) this._streetLamp(x, d + T + 2.9);

    // ---- walls
    const door = LAYOUT.door;
    const rd = LAYOUT.reserveDoor, wc = LAYOUT.wcDoor;
    const mk = (id, L, openings, opts, pos, rotY, outward) => {
      const { full, low } = buildWall(L, H, openings, opts);
      const n = new Node('wall' + id);
      n.position = pos;
      n.rotation[1] = rotY;
      n.add(full, low);
      const decor = this.wallDecor[id];
      decor.position = [0, 0, 0];
      full.add(decor);
      low.visible = false;
      this.node.add(n);
      this.walls.push({ id, node: n, full, low, outward, cut: false });
    };
    // North (back) wall: z = 0, runs +X, interior faces +Z
    mk('N', w, [
      { x0: rd.x0, x1: rd.x1, y0: 0, y1: 2.15, door: true },
      { x0: wc.x0, x1: wc.x1, y0: 0, y1: 2.15, door: true },
    ], { brick: true }, [0, 0, 0], 0, [0, -1]);
    // West wall: x = 0, runs from z=d to z=0 (local +X maps to -Z), interior faces +X
    mk('W', d, [], {}, [0, 0, d], Math.PI / 2, [-1, 0]);
    // East wall: x = w, runs z=0..d, interior faces -X
    const winsE = [];
    for (let z = 3.3; z + 1.6 < d - 0.5; z += 2.9) winsE.push({ x0: z, x1: z + 1.6, y0: 0.95, y1: 2.35 });
    mk('E', d, winsE, {}, [w, 0, 0], -Math.PI / 2, [1, 0]);
    // South (front) wall: z = d, runs from x=w to 0, interior faces -Z
    const winsS = [{ x0: w - door.x1, x1: w - door.x0, y0: 0, y1: 2.25, door: true }];
    for (const [a, b] of [[1.4, 3.6], [4.8, 7.0]]) if (b < door.x0 - 0.3) winsS.push({ x0: w - b, x1: w - a, y0: 0.95, y1: 2.35 });
    mk('S', w, winsS, {}, [w, 0, d], Math.PI, [0, 1]);

    // ---- doors
    this.doors.entrance = this._door(door.x0, d, Math.PI, 1.0, 0x6e2a1a, true);
    this.doors.reserve = this._door(rd.x0, 0, 0, rd.x1 - rd.x0, PAL.woodMid, false, 'RÉSERVE');
    this.doors.wc = this._door(wc.x0, 0, 0, wc.x1 - wc.x0, 0x2f5d50, false, 'WC');

    // ---- pendant lamps
    const lampSpots = [[2.0, 1.75], [4.6, 1.75], [7.0, 1.75]];
    const cols = Math.max(2, Math.round(w / 3.6));
    for (let i = 0; i < cols; i++) lampSpots.push([1.8 + (i * (w - 3.4)) / (cols - 1), 4.6]);
    for (let i = 0; i < cols; i++) if (d > 8) lampSpots.push([1.8 + (i * (w - 3.4)) / (cols - 1), d - 1.9]);
    for (const [x, z] of lampSpots.slice(0, 9)) this._lamp(x, z, z < 2.5);
    this.node.traverse((n) => {
      if (n.isMesh && n !== floor) n.static = true;
    });
  }

  _streetLamp(x, z) {
    const b = new MeshBuilder();
    b.add(cylinder(0.06, 0.08, 3.6, 8), { color: 0x1d1f2a, p: [x, 1.8, z] });
    b.add(lathe([[0.0001, 0], [0.22, 0.0], [0.12, 0.3], [0.0001, 0.34]], 10), { color: 0x1d1f2a, p: [x, 3.6, z] });
    const m = new Mesh(b.build(), MATS.vc);
    this.node.add(m);
    const g = new Glow(0xffc46b, 1.6, 0.6);
    g.position = [x, 3.5, z];
    this.node.add(g);
  }

  _door(x0, z, rotY, width, color, entrance, sign) {
    const pivot = new Node('door');
    const b = new MeshBuilder();
    const hgt = entrance ? 2.2 : 2.1;
    b.add(roundedBox(width - 0.04, hgt, 0.06, 0.02, 2), { color, p: [width / 2, hgt / 2, 0] });
    b.add(box(width * 0.7, hgt * 0.32, 0.07), { color: entrance ? 0x9fc9e8 : 0x000000, p: [width / 2, hgt * 0.68, 0] });
    if (!entrance) b.add(box(width * 0.7, hgt * 0.32, 0.075), { color, p: [width / 2, hgt * 0.68, 0] });
    b.add(box(width * 0.75, 0.05, 0.08), { color: PAL.woodDark, p: [width / 2, hgt * 0.45, 0] });
    b.add(sphere(0.04, 8, 6), { color: PAL.brass, p: [width - 0.12, 1.0, 0.05] });
    b.add(sphere(0.04, 8, 6), { color: PAL.brass, p: [width - 0.12, 1.0, -0.05] });
    if (sign) b.add(roundedBox(0.36, 0.16, 0.02, 0.01, 1), { color: 0xf3e2c0, p: [width / 2, 1.62, 0.04] });
    const m = new Mesh(b.build(), MATS.vc);
    m.outline = 0.006;
    pivot.add(m);
    if (sign) {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 112;
      const g = c.getContext('2d');
      g.fillStyle = '#f3e2c0';
      g.fillRect(0, 0, 256, 112);
      g.fillStyle = '#4a2a18';
      g.font = `bold ${sign.length > 3 ? 46 : 64}px 'Lilita One', sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(sign, 128, 58);
      const q = new Mesh(new MeshBuilder().add(quad(0.34, 0.14), { color: 0xffffff }).build(), texMat(new Texture(c), { toon: 0.2 }));
      q.position = [width / 2, 1.62, 0.052];
      q.castShadow = false;
      pivot.add(q);
    }
    // place: local x along wall
    const holder = new Node('doorHolder');
    if (rotY === Math.PI) {
      // front wall: runs from x=w toward 0; position at world x0..x0+width, z
      holder.position = [x0 + width, 0, z - T / 2];
      holder.rotation[1] = Math.PI;
    } else {
      holder.position = [x0, 0, -T / 2 + 0.02];
    }
    holder.add(pivot);
    this.node.add(holder);
    const d = { pivot, open: 0, target: 0, timer: 0, width, holder, entrance };
    return d;
  }

  openDoor(name, seconds = 1.2) {
    const d = this.doors[name];
    if (!d) return;
    if (d.timer <= 0 && d.open < 0.15 && this.onOpen) this.onOpen(name);
    d.timer = seconds;
  }

  _lamp(x, z, overBar) {
    const b = new MeshBuilder();
    const y = overBar ? 2.4 : 2.8;
    b.add(cylinder(0.01, 0.01, LAYOUT.wallH + 0.3 - y, 4), { color: 0x111111, p: [x, (LAYOUT.wallH + 0.3 + y) / 2, z] });
    const shadeCol = overBar ? 0x1f5c45 : 0x2a4a3c;
    const sr = overBar ? 0.2 : 0.16;
    b.add(lathe([[sr, -0.16], [sr * 0.86, -0.11], [0.08, 0.0], [0.03, 0.05], [0.0001, 0.06]], 18, { capBottom: false }), { color: shadeCol, p: [x, y, z] });
    b.add(torus(sr, 0.012, 6, 20), { color: PAL.brass, r: [Math.PI / 2, 0, 0], p: [x, y - 0.16, z] });
    const m = new Mesh(b.build(), new Material({ toon: 0.8, rim: 0.2, doubleSided: true }));
    m.castShadow = false;
    this.node.add(m);
    const bulb = new Mesh(new MeshBuilder().add(sphere(0.05, 10, 8), { color: 0xffffff, p: [x, y - 0.12, z] }).build(), colorMat(0xfff1c9, { emissive: 0xffd28a, emissiveIntensity: 1.6, unlit: true }));
    bulb.castShadow = false;
    this.node.add(bulb);
    const g = new Glow(0xffb45c, 0.8, 0.3);
    g.position = [x, y - 0.16, z];
    this.node.add(g);
    this.lamps.push({ pos: [x, y - 0.35, z], color: hexToLinear(0xffc792), intensity: overBar ? 1.15 : 1.0, range: overBar ? 4.2 : 5.2, glow: g, base: 0.3 });
  }

  /** hide walls that are between the camera and the room */
  updateCutaway(camPos, force = false) {
    const { w, d } = this.size;
    for (const wl of this.walls) {
      let cut = false;
      if (wl.id === 'N') cut = camPos[2] < 0.5;
      if (wl.id === 'S') cut = camPos[2] > d - 0.5;
      if (wl.id === 'W') cut = camPos[0] < 0.5;
      if (wl.id === 'E') cut = camPos[0] > w - 0.5;
      if (cut !== wl.cut || force) {
        wl.cut = cut;
        wl.full.visible = !cut;
        wl.low.visible = cut;
        if (wl.id === 'S' && this.doors.entrance) this.doors.entrance.holder.visible = !cut;
        if (wl.id === 'N') for (const k of ['reserve', 'wc']) if (this.doors[k]) this.doors[k].holder.visible = !cut;
      }
    }
  }

  update(dt, t, dimmer = 1) {
    for (const d of Object.values(this.doors)) {
      d.timer -= dt;
      d.target = d.timer > 0 ? 1 : 0;
      d.open = damp(d.open, d.target, 8, dt);
      d.pivot.rotation[1] = -d.open * 1.35;
    }
    for (const l of this.lamps) l.glow.intensity = l.base * dimmer;
  }

  isWallCut(id) {
    return this.walls.find((w) => w.id === id)?.cut;
  }
}
