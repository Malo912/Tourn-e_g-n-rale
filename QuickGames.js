// Quick mini-games: bottle opening (timing), soft drink fill (hold & release), machine timing (coffee, croque).
import { INK, rr, bg, label, bubbles } from './draw.js';
import { clamp } from '../engine/math.js';

/** Bottle: a needle swings, press when it is in the green zone (clean pop). */
export class CapGame {
  constructor(mgr, opts) {
    this.mgr = mgr;
    this.p = opts.product;
    this.can = !!this.p.bottle?.can;
    this.t = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.speed = (opts.rush ? 3.2 : 2.6) * (1 + (opts.pressure || 0) * 0.1);
    this.zone = 0.18 * (opts.mods?.window || 1);
    this.done = false;
    this.title = (this.can ? 'Ouvrir un ' : 'Décapsuler une ') + this.p.name;
    this.hint = this.can ? 'Tirez la languette au bon moment.' : 'Un coup sec au bon moment : POP !';
    this.controls = 'Cliquez ou <kbd>Espace</kbd> quand l’aiguille est dans le vert';
    this.foam = 0;
  }
  get needle() {
    return Math.sin(this.phase + this.t * this.speed);
  }
  update(dt, input) {
    if (this.done) {
      this.foam = Math.min(1, this.foam + dt * 2);
      return;
    }
    this.t += dt;
    if (this.t > 0.25 && input.pressed) {
      const e = Math.abs(this.needle);
      let q = e < this.zone * 0.5 ? 'perfect' : e < this.zone ? 'good' : e < this.zone * 2.2 ? 'average' : 'bad';
      this.done = true;
      this.result = { quality: q, notes: q === 'average' || q === 'bad' ? ['ça mousse'] : [] };
      this.popped = q === 'perfect' || q === 'good';
      this.mgr.sfx(this.popped ? 'pop' : 'fizz');
    }
    if (this.t > 3.5 && !this.done) {
      this.done = true;
      this.result = { quality: 'average', notes: ['trop lent'] };
    }
  }
  draw(g, w, h, time) {
    bg(g, w, h);
    // arc gauge
    const cx = w / 2, cy = 190, R = 120;
    g.lineWidth = 16;
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.arc(cx, cy, R, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
    const half = (Math.PI * 0.35);
    g.strokeStyle = 'rgba(111,207,106,0.9)';
    g.beginPath();
    g.arc(cx, cy, R, Math.PI * 1.5 - half * this.zone, Math.PI * 1.5 + half * this.zone);
    g.stroke();
    const a = Math.PI * 1.5 + this.needle * half;
    g.strokeStyle = '#fff';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * (R + 12), cy + Math.sin(a) * (R + 12));
    g.stroke();
    // bottle
    const col = '#' + ((this.can ? this.p.color : this.p.bottle?.glass) ?? 0x6b4a1a).toString(16).padStart(6, '0');
    g.save();
    g.translate(cx, h - 26);
    g.fillStyle = col;
    g.strokeStyle = INK;
    g.lineWidth = 3;
    if (this.can) {
      rr(g, -22, -95, 44, 95, 8);
      g.fill();
      g.stroke();
      g.fillStyle = '#d6dde3';
      rr(g, -18, -102, 36, 10, 4);
      g.fill();
      g.stroke();
    } else {
      g.beginPath();
      g.moveTo(-20, 0);
      g.lineTo(20, 0);
      g.lineTo(20, -70);
      g.lineTo(8, -95);
      g.lineTo(8, -118);
      g.lineTo(-8, -118);
      g.lineTo(-8, -95);
      g.lineTo(-20, -70);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = this.p.label?.bg || '#f3e2c0';
      g.fillRect(-19, -55, 38, 30);
      if (!this.popped) {
        g.fillStyle = '#d8c070';
        rr(g, -10, -124, 20, 8, 2);
        g.fill();
        g.stroke();
      }
    }
    g.restore();
    if (this.done && !this.popped) {
      g.fillStyle = 'rgba(255,250,235,0.9)';
      for (let i = 0; i < 14; i++) {
        g.beginPath();
        g.arc(cx + Math.sin(i * 7 + time * 3) * 26 * this.foam, h - 150 - i * 6 * this.foam, 8 + (i % 3) * 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (this.done && this.popped) label(g, 'POP !', cx + 40, h - 150, 26, '#ffd166');
  }
}

/** Soft drink: hold to pour into a glass, release at the line. Fizz rises and settles. */
export class FillGame {
  constructor(mgr, opts) {
    this.p = opts.product;
    this.level = 0;
    this.fizz = 0;
    this.q = 0;
    this.t = 0;
    this.closedT = 0;
    this.started = false;
    this.spill = 0;
    this.done = false;
    this.fizzy = this.p.id === 'kolaka' ? 0.5 : this.p.id === 'pulpeo' ? 0.3 : 0.15;
    this.target = 0.88;
    this.win = opts.mods?.window || 1;
    this.title = 'Servir un ' + this.p.name;
    this.hint = this.p.id === 'kolaka' ? 'Ça pétille : attention à la mousse !' : 'Remplissez jusqu’au trait.';
    this.controls = 'Maintenez <kbd>Espace</kbd> ou le clic, relâchez au trait';
  }
  update(dt, input) {
    if (this.done) return;
    this.t += dt;
    if (input.hold) {
      this.started = true;
      this.q = Math.min(1, this.q + dt * 3);
      this.closedT = 0;
    } else {
      this.q = Math.max(0, this.q - dt * 5);
      if (this.started && this.q === 0) this.closedT += dt;
    }
    const dV = this.q * 0.62 * dt;
    this.level += dV;
    this.fizz = Math.min(0.18, this.fizz + dV * this.fizzy * 1.2);
    this.fizz = Math.max(0, this.fizz - dt * 0.28);
    if (this.level + this.fizz > 1) {
      this.spill += this.level + this.fizz - 1;
      this.level = Math.min(this.level, 1 - this.fizz);
    }
    if (this.started && this.closedT > 0.4 && this.level > 0.3) this.finish();
    if (this.t > 6) this.finish();
  }
  finish() {
    this.done = true;
    const err = Math.abs(this.level - this.target) / this.win;
    let q;
    if (this.spill > 0.12) q = 'bad';
    else if (err < 0.04 && this.spill < 0.01) q = 'perfect';
    else if (err < 0.09) q = 'good';
    else if (err < 0.2) q = 'average';
    else q = 'bad';
    this.result = { quality: q, notes: this.spill > 0.01 ? ['débordement'] : err > 0.09 ? [this.level < this.target ? 'pas assez rempli' : 'trop rempli'] : [] };
  }
  draw(g, w, h, time) {
    bg(g, w, h);
    const gx = w / 2, base = h - 26, gh = 150, gw = 80;
    // bottle pouring
    const col = '#' + ((this.p.bottle?.can ? this.p.color : this.p.bottle?.glass) ?? 0x6b4a1a).toString(16).padStart(6, '0');
    g.save();
    g.translate(gx + 40, 40);
    g.rotate(-2.2 + (1 - this.q) * 0.6);
    g.fillStyle = col;
    g.strokeStyle = INK;
    g.lineWidth = 3;
    rr(g, -14, -10, 28, 70, 8);
    g.fill();
    g.stroke();
    g.restore();
    const liq = '#' + (this.p.liquid ?? 0x3a1608).toString(16).padStart(6, '0');
    if (this.q > 0.05) {
      g.fillStyle = liq;
      g.fillRect(gx - 2 - this.q * 2, 50, 4 + this.q * 4, base - this.level * gh - 50);
    }
    g.save();
    g.beginPath();
    g.moveTo(gx - gw * 0.38, base);
    g.lineTo(gx + gw * 0.38, base);
    g.lineTo(gx + gw / 2, base - gh);
    g.lineTo(gx - gw / 2, base - gh);
    g.closePath();
    g.fillStyle = 'rgba(220,240,255,0.18)';
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = liq;
    g.fillRect(gx - gw, base - this.level * gh, gw * 2, this.level * gh);
    bubbles(g, gx - gw * 0.3, gx + gw * 0.3, base - this.level * gh, base, time, 12);
    g.fillStyle = 'rgba(255,250,240,0.85)';
    g.fillRect(gx - gw, base - (this.level + this.fizz) * gh, gw * 2, this.fizz * gh);
    g.restore();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.stroke();
    g.restore();
    g.setLineDash([5, 4]);
    g.strokeStyle = '#ffd166';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(gx - gw / 2 - 10, base - this.target * gh);
    g.lineTo(gx + gw / 2 + 10, base - this.target * gh);
    g.stroke();
    g.setLineDash([]);
    if (!this.started) label(g, 'Maintenez pour verser !', w / 2, h / 2, 18, '#ffcb6b');
  }
}

/** Machine timing: a bar fills by itself; press to stop in the golden zone. Used for coffee and croque-monsieur. */
export class TimingGame {
  constructor(mgr, opts) {
    this.mgr = mgr;
    this.p = opts.product;
    this.kind = this.p.id === 'cafe' ? 'cafe' : 'croque';
    this.t = 0;
    this.v = 0;
    this.speed = (this.kind === 'cafe' ? 0.42 : 0.36) * (opts.rush ? 1.2 : 1);
    this.zone = this.kind === 'cafe' ? [0.62, 0.78] : [0.58, 0.74];
    const c = (this.zone[0] + this.zone[1]) / 2, hw = ((this.zone[1] - this.zone[0]) / 2) * (opts.mods?.window || 1);
    this.zone = [c - hw, c + hw];
    this.started = false;
    this.done = false;
    this.title = this.kind === 'cafe' ? 'Faire un café serré' : 'Griller un croque-monsieur';
    this.hint = this.kind === 'cafe' ? 'Arrêtez l’extraction quand la tasse atteint le trait doré.' : 'Sortez-le quand il est bien doré… pas carbonisé !';
    this.controls = 'Cliquez ou <kbd>Espace</kbd> pour lancer, puis pour arrêter';
  }
  update(dt, input) {
    if (this.done) return;
    this.t += dt;
    if (!this.started) {
      if (input.pressed || this.t > 0.8) {
        this.started = true;
        this.t = 0;
      }
      return;
    }
    this.v += dt * this.speed;
    if ((input.pressed && this.t > 0.2) || this.v >= 1) {
      this.done = true;
      const [a, b] = this.zone;
      const c = (a + b) / 2, hw = (b - a) / 2;
      const e = Math.abs(this.v - c);
      let q = e < hw * 0.45 ? 'perfect' : e < hw ? 'good' : e < hw * 2.2 ? 'average' : 'bad';
      this.mgr.sfx(q === 'perfect' || q === 'good' ? 'ding' : 'miss');
      this.result = { quality: q, notes: this.v < a ? [this.kind === 'cafe' ? 'trop court' : 'trop pâle'] : this.v > b ? [this.kind === 'cafe' ? 'trop long' : 'trop grillé'] : [] };
    }
  }
  draw(g, w, h, time) {
    bg(g, w, h);
    const [a, b] = this.zone;
    // gauge
    rr(g, 40, 28, w - 80, 22, 11);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fill();
    const grad = g.createLinearGradient(40, 0, w - 40, 0);
    if (this.kind === 'cafe') {
      grad.addColorStop(0, '#d9b38c');
      grad.addColorStop(0.7, '#6b3d1f');
      grad.addColorStop(1, '#2b1408');
    } else {
      grad.addColorStop(0, '#f6e7b8');
      grad.addColorStop(0.66, '#d9963a');
      grad.addColorStop(1, '#3a2010');
    }
    g.fillStyle = grad;
    g.fillRect(44, 32, (w - 88) * this.v, 14);
    g.strokeStyle = '#ffd166';
    g.lineWidth = 3;
    g.strokeRect(40 + (w - 80) * a, 26, (w - 80) * (b - a), 26);
    g.fillStyle = '#fff';
    g.fillRect(40 + (w - 80) * this.v - 2, 22, 4, 34);
    // object
    const cx = w / 2, cy = h - 80;
    if (this.kind === 'cafe') {
      g.fillStyle = '#d6dde3';
      rr(g, cx - 70, 70, 140, 40, 8);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.stroke();
      if (this.started && !this.done) {
        g.fillStyle = '#5a2e14';
        g.fillRect(cx - 3, 110, 6, cy - 100);
      }
      // cup
      g.fillStyle = '#fbf6ee';
      rr(g, cx - 34, cy - 20, 68, 56, 10);
      g.fill();
      g.stroke();
      g.save();
      rr(g, cx - 30, cy - 16, 60, 48, 8);
      g.clip();
      g.fillStyle = '#4a250f';
      g.fillRect(cx - 30, cy + 32 - this.v * 48, 60, this.v * 48);
      g.fillStyle = '#c99a62';
      g.fillRect(cx - 30, cy + 32 - this.v * 48, 60, 5);
      g.restore();
      g.setLineDash([4, 3]);
      g.strokeStyle = '#ffd166';
      g.beginPath();
      g.moveTo(cx - 40, cy + 32 - ((a + b) / 2) * 48);
      g.lineTo(cx + 40, cy + 32 - ((a + b) / 2) * 48);
      g.stroke();
      g.setLineDash([]);
    } else {
      const k = this.v;
      const col = mixHex('#f3e2b0', k < 0.66 ? '#d9963a' : '#2b1408', k < 0.66 ? k / 0.66 : (k - 0.66) / 0.34, k < 0.66 ? null : '#d9963a');
      // panini press
      g.fillStyle = '#9aa3ab';
      rr(g, cx - 92, cy - 4, 184, 50, 10);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = this.started && !this.done ? '#ff6b3d' : '#5a5a5a';
      g.beginPath();
      g.arc(cx + 74, cy + 30, 5, 0, Math.PI * 2);
      g.fill();
      // sandwich: bread, ham, melted cheese, bread
      g.fillStyle = col;
      rr(g, cx - 66, cy - 6, 132, 18, 7);
      g.fill();
      g.stroke();
      g.fillStyle = '#f2a5a0';
      g.fillRect(cx - 62, cy - 14, 124, 8);
      g.fillStyle = '#f5d36a';
      g.beginPath();
      g.moveTo(cx - 64, cy - 18);
      g.lineTo(cx + 64, cy - 18);
      g.lineTo(cx + 64, cy - 12);
      for (let i = 0; i < 6; i++) g.quadraticCurveTo(cx + 54 - i * 22, cy - 2 - (i % 2) * 6 * k, cx + 44 - i * 22, cy - 12);
      g.lineTo(cx - 64, cy - 12);
      g.closePath();
      g.fill();
      g.fillStyle = col;
      rr(g, cx - 66, cy - 40, 132, 24, 8);
      g.fill();
      g.stroke();
      // grill marks appear as it toasts
      if (k > 0.3) {
        g.strokeStyle = `rgba(60,25,8,${Math.min(0.8, (k - 0.3) * 1.6)})`;
        g.lineWidth = 3;
        for (let i = -2; i <= 2; i++) {
          g.beginPath();
          g.moveTo(cx + i * 24 - 8, cy - 36);
          g.lineTo(cx + i * 24 + 8, cy - 20);
          g.stroke();
        }
      }
      if (k > 0.85) {
        g.fillStyle = 'rgba(80,80,80,0.6)';
        for (let i = 0; i < 5; i++) {
          g.beginPath();
          g.arc(cx - 40 + i * 20, cy - 50 - ((time * 40 + i * 20) % 40), 8, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    if (!this.started) label(g, 'Cliquez pour lancer', w / 2, h / 2 - 10, 18, '#ffcb6b');
  }
}

function mixHex(a, b, t, mid) {
  const pa = parseInt((mid || a).slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (n, sh) => (n >> sh) & 255;
  const u = Math.max(0, Math.min(1, t));
  const r = Math.round(ch(pa, 16) + (ch(pb, 16) - ch(pa, 16)) * u), g = Math.round(ch(pa, 8) + (ch(pb, 8) - ch(pa, 8)) * u), bl = Math.round(ch(pa, 0) + (ch(pb, 0) - ch(pa, 0)) * u);
  return `rgb(${r},${g},${bl})`;
}
