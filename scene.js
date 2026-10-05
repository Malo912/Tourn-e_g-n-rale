// Scene graph: Node, Mesh, Glow, Geometry, Material, Texture.
import { mat4, hexToLinear } from './math.js';

let NODE_ID = 1;

export class Node {
  constructor(name = '') {
    this.id = NODE_ID++;
    this.name = name;
    this.position = [0, 0, 0];
    this.rotation = [0, 0, 0]; // euler, order YXZ
    this.scale = [1, 1, 1];
    this.children = [];
    this.parent = null;
    this.visible = true;
    this.local = mat4.create();
    this.world = mat4.create();
    this.static = false; // when true, local matrix is computed once
    this._staticDone = false;
    this.userData = {};
  }
  add(...nodes) {
    for (const n of nodes) {
      if (!n) continue;
      if (n.parent) n.parent.remove(n);
      n.parent = this;
      this.children.push(n);
    }
    return this;
  }
  remove(n) {
    const i = this.children.indexOf(n);
    if (i >= 0) {
      this.children.splice(i, 1);
      n.parent = null;
    }
    return this;
  }
  removeFromParent() {
    if (this.parent) this.parent.remove(this);
  }
  setPos(x, y, z) {
    this.position[0] = x; this.position[1] = y; this.position[2] = z;
    return this;
  }
  setRot(x, y, z) {
    this.rotation[0] = x; this.rotation[1] = y; this.rotation[2] = z;
    return this;
  }
  setScale(x, y = x, z = x) {
    this.scale[0] = x; this.scale[1] = y; this.scale[2] = z;
    return this;
  }
  markDirty() {
    this._staticDone = false;
  }
  updateWorld(parentWorld) {
    if (!this.static || !this._staticDone) {
      mat4.compose(this.local, this.position, this.rotation, this.scale);
      this._staticDone = true;
    }
    if (parentWorld) mat4.multiply(this.world, parentWorld, this.local);
    else this.world.set(this.local);
    const ch = this.children;
    for (let i = 0; i < ch.length; i++) ch[i].updateWorld(this.world);
  }
  traverse(fn) {
    fn(this);
    for (const c of this.children) c.traverse(fn);
  }
  traverseVisible(fn) {
    if (!this.visible) return;
    fn(this);
    const ch = this.children;
    for (let i = 0; i < ch.length; i++) ch[i].traverseVisible(fn);
  }
  worldPos(out = [0, 0, 0]) {
    out[0] = this.world[12]; out[1] = this.world[13]; out[2] = this.world[14];
    return out;
  }
}

export class Mesh extends Node {
  constructor(geometry, material, name) {
    super(name);
    this.isMesh = true;
    this.geometry = geometry;
    this.material = material;
    this.castShadow = true;
    this.receiveShadow = true;
    this.outline = 0; // outline width in world units (0 = none)
    this.flash = null; // [r,g,b] additive highlight
    this.tint = null; // [r,g,b] multiplier override (linear)
    this.renderOrder = 0;
  }
}

/** Camera-facing additive glow (fake bloom / light halo). */
export class Glow extends Node {
  constructor(hex, size = 1, intensity = 1) {
    super('glow');
    this.isGlow = true;
    this.color = hexToLinear(hex);
    this.size = size;
    this.intensity = intensity;
  }
}

/** Flat ground decal (blob shadows, puddles, stains). */
export class Decal extends Node {
  constructor(hex, size = 1, opacity = 0.35, kind = 0) {
    super('decal');
    this.isDecal = true;
    this.color = hexToLinear(hex);
    this.size = size;
    this.opacity = opacity;
    this.kind = kind; // 0 = soft blob, 1 = puddle (wobbly), 2 = ring/marker
  }
}

let GEO_ID = 1;
export class Geometry {
  constructor({ positions, normals, uvs, colors, indices }) {
    this.id = GEO_ID++;
    this.positions = positions instanceof Float32Array ? positions : new Float32Array(positions);
    this.normals = normals ? (normals instanceof Float32Array ? normals : new Float32Array(normals)) : null;
    this.uvs = uvs ? (uvs instanceof Float32Array ? uvs : new Float32Array(uvs)) : null;
    this.colors = colors ? (colors instanceof Float32Array ? colors : new Float32Array(colors)) : null;
    const vcount = this.positions.length / 3;
    const IA = vcount > 65535 ? Uint32Array : Uint16Array;
    this.indices = indices ? (indices instanceof IA ? indices : new IA(indices)) : null;
    this.count = this.indices ? this.indices.length : vcount;
    this.vao = null;
    this.computeBounds();
  }
  computeBounds() {
    const p = this.positions;
    let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      if (x < minx) minx = x; if (y < miny) miny = y; if (z < minz) minz = z;
      if (x > maxx) maxx = x; if (y > maxy) maxy = y; if (z > maxz) maxz = z;
    }
    this.min = [minx, miny, minz];
    this.max = [maxx, maxy, maxz];
  }
  dispose(gl) {
    if (this.vao && gl) {
      gl.deleteVertexArray(this.vao);
      for (const b of this._buffers || []) gl.deleteBuffer(b);
    }
    this.vao = null;
  }
}

export class Material {
  constructor(o = {}) {
    this.color = o.color !== undefined ? hexToLinear(o.color) : [1, 1, 1];
    this.emissive = o.emissive !== undefined ? hexToLinear(o.emissive).map((v) => v * (o.emissiveIntensity ?? 1)) : [0, 0, 0];
    this.opacity = o.opacity ?? 1;
    this.transparent = o.transparent ?? this.opacity < 1;
    this.map = o.map || null;
    this.unlit = o.unlit ?? false;
    this.doubleSided = o.doubleSided ?? false;
    this.toon = o.toon ?? 0.8;
    this.rim = o.rim ?? 0.25;
    this.spec = o.spec ?? 0;
    this.depthWrite = o.depthWrite ?? !this.transparent;
    this.additive = o.additive ?? false;
  }
  setColor(hex) {
    this.color = hexToLinear(hex);
    return this;
  }
}

let TEX_ID = 1;
export class Texture {
  constructor(source, o = {}) {
    this.id = TEX_ID++;
    this.source = source; // canvas or image
    this.repeat = o.repeat ?? false;
    this.mipmap = o.mipmap ?? true;
    this.nearest = o.nearest ?? false;
    this.needsUpdate = true;
    this.glTex = null;
  }
}
