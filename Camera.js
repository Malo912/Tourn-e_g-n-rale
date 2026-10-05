// Perspective camera + orbit rig with damping (pan / rotate / zoom, mouse, keyboard, touch).
import { mat4, clamp, damp } from './math.js';

export class Camera {
  constructor(fov = 32, aspect = 1, near = 0.3, far = 120) {
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.position = [10, 12, 14];
    this.target = [6, 0, 4];
    this.view = mat4.create();
    this.proj = mat4.create();
    this.viewProj = mat4.create();
    this.invViewProj = mat4.create();
  }
  update() {
    mat4.lookAt(this.view, this.position, this.target, [0, 1, 0]);
    mat4.perspective(this.proj, (this.fov * Math.PI) / 180, this.aspect, this.near, this.far);
    mat4.multiply(this.viewProj, this.proj, this.view);
    mat4.invert(this.invViewProj, this.viewProj);
  }
  /** ray from normalized device coords */
  ray(ndcX, ndcY) {
    const a = mat4.transformPoint([0, 0, 0], this.invViewProj, [ndcX, ndcY, -1]);
    const b = mat4.transformPoint([0, 0, 0], this.invViewProj, [ndcX, ndcY, 1]);
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(d[0], d[1], d[2]);
    return { o: a, d: [d[0] / l, d[1] / l, d[2] / l] };
  }
  /** world -> screen pixels; returns null when behind */
  project(p, w, h, out = { x: 0, y: 0, z: 0 }) {
    const m = this.viewProj;
    const x = p[0], y = p[1], z = p[2];
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0.01) return null;
    out.x = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / cw * 0.5 + 0.5) * w;
    out.y = (1 - ((m[1] * x + m[5] * y + m[9] * z + m[13]) / cw * 0.5 + 0.5)) * h;
    out.z = cw;
    return out;
  }
}

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.target = [6, 0, 5];
    this.yaw = 0.62; // around Y (0 = looking toward -Z from +Z)
    this.pitch = 0.8; // radians from horizontal
    this.distance = 17.5;
    this.goal = { target: [...this.target], yaw: this.yaw, pitch: this.pitch, distance: this.distance };
    this.bounds = { minX: -1, maxX: 13, minZ: -1, maxZ: 11 };
    this.minDist = 6;
    this.maxDist = 34;
    this.keys = new Set();
    this.dragging = null;
    this.enabled = true;
    this.onTap = null; // (x, y, event) => void
    this.onHover = null;
    this._pointers = new Map();
    this._bind();
  }

  _bind() {
    const el = this.dom;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => this._down(e));
    window.addEventListener('pointermove', (e) => this._move(e));
    window.addEventListener('pointerup', (e) => this._up(e));
    window.addEventListener('pointercancel', (e) => this._up(e));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.enabled) return;
      const k = Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0016);
      this.goal.distance = clamp(this.goal.distance * k, this.minDist, this.maxDist);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _down(e) {
    this.dom.setPointerCapture?.(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, type: e.pointerType });
    if (this._pointers.size === 2) {
      const [a, b] = [...this._pointers.values()];
      this._pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), dist: this.goal.distance, yaw: this.goal.yaw };
      this.dragging = 'pinch';
      return;
    }
    this.dragging = null;
    this._downInfo = { x: e.clientX, y: e.clientY, button: e.button, moved: false, t: performance.now() };
  }

  _move(e) {
    const p = this._pointers.get(e.pointerId);
    if (!p) {
      if (this.onHover && e.target === this.dom) this.onHover(e.clientX, e.clientY);
      else if (this.onHover) this.onHover(-1, -1);
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!this.enabled) return;
    if (this.dragging === 'pinch' && this._pointers.size >= 2) {
      const [a, b] = [...this._pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      this.goal.distance = clamp((this._pinch.dist * this._pinch.d) / Math.max(d, 1), this.minDist, this.maxDist);
      this.goal.yaw = this._pinch.yaw - (ang - this._pinch.ang);
      return;
    }
    const di = this._downInfo;
    if (!di) return;
    if (!di.moved && Math.hypot(e.clientX - di.x, e.clientY - di.y) > 6) {
      di.moved = true;
      this.dragging = di.button === 2 ? 'rotate' : 'pan';
    }
    if (this.dragging === 'rotate') {
      this.goal.yaw -= dx * 0.006;
      this.goal.pitch = clamp(this.goal.pitch + dy * 0.004, 0.45, 1.35);
    } else if (this.dragging === 'pan') {
      this._panPixels(dx, dy);
    }
    if (this.onHover) this.onHover(e.clientX, e.clientY);
  }

  _up(e) {
    const p = this._pointers.get(e.pointerId);
    this._pointers.delete(e.pointerId);
    if (!p) return;
    if (this.dragging === 'pinch') {
      if (this._pointers.size === 0) this.dragging = null;
      this._downInfo = null;
      return;
    }
    const di = this._downInfo;
    if (di && !di.moved && di.button === 0 && this.onTap && e.type === 'pointerup') this.onTap(e.clientX, e.clientY, e);
    if (di && !di.moved && di.button === 2 && this.onRightTap && e.type === 'pointerup') this.onRightTap(e.clientX, e.clientY, e);
    this._downInfo = null;
    this.dragging = null;
  }

  _panPixels(dx, dy) {
    const k = this.distance * 0.0018;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    // screen right in world XZ, screen up projected on ground
    const rx = cy, rz = -sy;
    const fx = -sy, fz = -cy;
    this.goal.target[0] -= (dx * rx - dy * fx / Math.sin(this.pitch) * 0.9) * k;
    this.goal.target[2] -= (dx * rz - dy * fz / Math.sin(this.pitch) * 0.9) * k;
    this._clampTarget();
  }

  _clampTarget() {
    const b = this.bounds;
    this.goal.target[0] = clamp(this.goal.target[0], b.minX, b.maxX);
    this.goal.target[2] = clamp(this.goal.target[2], b.minZ, b.maxZ);
  }

  rotateBy(a) {
    this.goal.yaw += a;
  }
  zoomBy(k) {
    this.goal.distance = clamp(this.goal.distance * k, this.minDist, this.maxDist);
  }

  update(dt) {
    if (this.enabled && this.keys.size) {
      const sp = 9 * dt;
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      let mx = 0, mz = 0;
      if (this.keys.has('w') || this.keys.has('z') || this.keys.has('arrowup')) mz -= 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) mz += 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
      if (mx || mz) {
        // forward = toward target from camera
        this.goal.target[0] += (mx * cy + mz * sy) * sp;
        this.goal.target[2] += (-mx * sy + mz * cy) * sp;
        this._clampTarget();
      }
      if (this.keys.has('q')) this.goal.yaw += 1.6 * dt;
      if (this.keys.has('e')) this.goal.yaw -= 1.6 * dt;
      if (this.keys.has('+') || this.keys.has('=')) this.zoomBy(Math.exp(-1.2 * dt));
      if (this.keys.has('-')) this.zoomBy(Math.exp(1.2 * dt));
    }
    const g = this.goal;
    const L = 10;
    this.target[0] = damp(this.target[0], g.target[0], L, dt);
    this.target[2] = damp(this.target[2], g.target[2], L, dt);
    this.yaw = damp(this.yaw, g.yaw, L, dt);
    this.pitch = damp(this.pitch, g.pitch, L, dt);
    this.distance = damp(this.distance, g.distance, L, dt);
    const c = this.camera;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    c.target[0] = this.target[0];
    c.target[1] = 0.6;
    c.target[2] = this.target[2];
    c.position[0] = this.target[0] + Math.sin(this.yaw) * cp * this.distance;
    c.position[1] = 0.6 + sp * this.distance;
    c.position[2] = this.target[2] + Math.cos(this.yaw) * cp * this.distance;
  }
}
