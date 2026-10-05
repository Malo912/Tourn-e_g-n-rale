// HTML elements anchored to 3D positions (bubbles, name tags, markers, floating texts).
export class Overlay {
  constructor(container, camera) {
    this.el = container;
    this.camera = camera;
    this.items = new Set();
    this.floats = [];
    this._p = { x: 0, y: 0, z: 0 };
  }
  /** getPos: () => [x,y,z]; returns handle */
  add(el, getPos, opts = {}) {
    // the wrapper is positioned on screen; the element inside keeps its own centering & animations
    const wrap = document.createElement('div');
    wrap.className = 'anchor';
    wrap.style.transform = 'translate(-9999px,-9999px)';
    wrap.appendChild(el);
    this.el.appendChild(wrap);
    const h = { el, wrap, getPos, offsetY: opts.offsetY ?? 0, visible: true, z: opts.z ?? 0, onScreen: false, sx: 0, sy: 0 };
    h.remove = () => {
      wrap.remove();
      this.items.delete(h);
    };
    h.setVisible = (v) => {
      if (h.visible === v) return;
      h.visible = v;
      wrap.style.display = v ? '' : 'none';
    };
    this.items.add(h);
    return h;
  }
  /** floating text that rises and fades */
  float(text, pos, cls = '', dur = 1.4) {
    const el = document.createElement('div');
    el.className = 'float-text ' + cls;
    el.textContent = text;
    this.el.appendChild(el);
    this.floats.push({ el, pos: [...pos], t: 0, dur });
  }
  floatHTML(html, pos, cls = '', dur = 1.6) {
    const el = document.createElement('div');
    el.className = 'float-text ' + cls;
    el.innerHTML = html;
    this.el.appendChild(el);
    this.floats.push({ el, pos: [...pos], t: 0, dur });
  }
  update(dt, w, h) {
    const cam = this.camera;
    const p = this._p;
    for (const it of this.items) {
      if (!it.visible) continue;
      const pos = it.getPos();
      const r = pos && cam.project(pos, w, h, p);
      if (!r || r.x < -80 || r.y < -80 || r.x > w + 80 || r.y > h + 80) {
        if (it.onScreen) {
          it.wrap.style.transform = 'translate(-9999px,-9999px)';
          it.onScreen = false;
        }
        continue;
      }
      it.onScreen = true;
      const x = Math.round(r.x), y = Math.round(r.y + it.offsetY);
      if (x !== it.sx || y !== it.sy) {
        it.sx = x;
        it.sy = y;
        it.wrap.style.transform = `translate(${x}px, ${y}px)`;
      }
      it.wrap.style.zIndex = String(1000 - Math.round(r.z * 10));
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      const k = f.t / f.dur;
      const r = cam.project([f.pos[0], f.pos[1] + k * 0.9, f.pos[2]], w, h, p);
      if (r) {
        f.el.style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px) scale(${k < 0.15 ? 0.6 + k * 2.7 : 1})`;
        f.el.style.opacity = String(k > 0.7 ? (1 - k) / 0.3 : 1);
      }
      if (k >= 1) {
        f.el.remove();
        this.floats.splice(i, 1);
      }
    }
  }
  clearFloats() {
    for (const f of this.floats) f.el.remove();
    this.floats.length = 0;
  }
}
