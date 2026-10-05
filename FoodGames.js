// Food mini-games: saucisson cutting (rhythm/precision) and planche apéro (quick placement).
import { INK, rr, bg, label } from './draw.js';
import { clamp } from '../engine/math.js';

export class CutGame {
  constructor(mgr, opts) {
    this.mgr = mgr;
    this.n = 5;
    const m = opts.mods || {};
    this.win = m.window || 1;
    this.speed = (1 + (opts.rush ? 0.25 : 0) + (opts.pressure || 0) * 0.15) * (m.slow || 1);
    this.x0 = 70;
    this.x1 = 330;
    this.knife = 30;
    this.cuts = [];
    this.slices = [];
    this.misses = 0;
    this.t = 0;
    this.done = false;
    this.started = false;
    this.title = 'Couper le saucisson';
    this.hint = 'Tranchez pile sur les pointillés. Des tranches régulières = qualité supérieure.';
    this.controls = 'Cliquez ou <kbd>Espace</kbd> quand le couteau passe sur un trait';
    this.lines = [];
    for (let i = 0; i < this.n; i++) this.lines.push({ x: this.x0 + ((i + 0.5) * (this.x1 - this.x0)) / this.n, cut: false, err: null });
    this.spacing = (this.x1 - this.x0) / this.n;
    this.flash = 0;
  }
  update(dt, input) {
    if (this.done) return;
    this.t += dt;
    if (this.t < 0.35) return; // short intro
    this.knife += dt * (this.x1 - this.x0 + 60) / (2.0 / this.speed);
    if (input.pressed) {
      const free = this.lines.filter((l) => !l.cut);
      let best = null, bd = 1e9;
      for (const l of free) {
        const d = Math.abs(l.x - this.knife);
        if (d < bd) { bd = d; best = l; }
      }
      // error normalised by the tolerance (a better knife forgives more)
      const err = best ? bd / this.spacing / this.win : 1;
      if (best && err <= 0.45) {
        best.cut = true;
        best.err = err;
        this.slices.push({ x: this.knife, vy: -60, y: 0, rot: 0, good: err < 0.15 });
        this.mgr.sfx(err < 0.14 ? 'cutPerfect' : 'cut');
      } else {
        this.misses++;
        this.flash = 0.25;
        this.slices.push({ x: this.knife, vy: -40, y: 0, rot: 0, ruined: true });
        this.mgr.sfx('miss');
      }
    }
    // lines passed without cut
    for (const l of this.lines) if (!l.cut && l.err === null && this.knife > l.x + this.spacing * 0.45) l.err = 1;
    for (const s of this.slices) {
      s.vy += 400 * dt;
      s.y = Math.min(70, s.y + s.vy * dt);
      s.rot += dt * 6;
    }
    this.flash = Math.max(0, this.flash - dt);
    if (this.knife > this.x1 + 30) this.finish();
  }
  finish() {
    this.done = true;
    const errs = this.lines.map((l) => (l.err === null ? 1 : l.err));
    const missed = errs.filter((e) => e >= 1).length + this.misses;
    const avg = errs.reduce((a, b) => a + b, 0) / errs.length;
    const max = Math.max(...errs);
    let q;
    if (missed >= 2) q = 'bad';
    else if (missed === 0 && max < 0.14) q = 'perfect';
    else if (avg < 0.22 && missed === 0) q = 'good';
    else q = 'average';
    this.result = { quality: q, score: 1 - avg, notes: missed ? [`${missed} tranche${missed > 1 ? 's' : ''} ratée${missed > 1 ? 's' : ''}`] : [] };
  }
  draw(g, w, h, time) {
    bg(g, w, h);
    // cutting board
    rr(g, 30, 70, w - 60, 110, 14);
    g.fillStyle = '#c28a55';
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.stroke();
    g.strokeStyle = 'rgba(90,50,20,0.35)';
    g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(40, 85 + i * 18);
      g.lineTo(w - 40, 88 + i * 18);
      g.stroke();
    }
    // saucisson (remaining part shrinks as it is cut)
    const lastCut = Math.max(this.x0, ...this.lines.filter((l) => l.cut).map((l) => l.x));
    rr(g, lastCut - 6, 102, this.x1 - lastCut + 28, 46, 23);
    g.fillStyle = '#7a2421';
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = '#f4efe6';
    for (let i = 0; i < 14; i++) {
      const x = lastCut + ((i * 37) % (this.x1 - lastCut + 10));
      g.beginPath();
      g.arc(x, 112 + ((i * 13) % 26), 2, 0, Math.PI * 2);
      g.fill();
    }
    // string at the end
    g.strokeStyle = '#eee';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(this.x1 + 22, 125);
    g.lineTo(this.x1 + 36, 118);
    g.stroke();
    // target lines
    for (const l of this.lines) {
      g.setLineDash([4, 4]);
      g.strokeStyle = l.cut ? 'rgba(111,207,106,0.9)' : l.err === 1 ? 'rgba(239,83,80,0.9)' : 'rgba(255,209,102,0.95)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(l.x, 92);
      g.lineTo(l.x, 158);
      g.stroke();
      g.setLineDash([]);
    }
    // slices on a plate below
    rr(g, 60, h - 60, w - 120, 26, 13);
    g.fillStyle = '#f4efe6';
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.stroke();
    for (const s of this.slices) {
      g.save();
      g.translate(s.x, 125 + s.y);
      g.rotate(s.rot);
      g.fillStyle = s.ruined ? '#8a5040' : '#b03a35';
      g.beginPath();
      if (s.ruined) {
        for (let k = 0; k < 4; k++) g.arc((k - 1.5) * 5, (k % 2) * 4, 3, 0, Math.PI * 2);
      } else g.ellipse(0, 0, 10, 16, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.5;
      g.stroke();
      g.restore();
    }
    // knife
    const kx = this.knife;
    g.save();
    g.translate(kx, 60);
    g.fillStyle = '#d6dde3';
    g.beginPath();
    g.moveTo(-3, 0);
    g.lineTo(5, 0);
    g.lineTo(5, 90);
    g.lineTo(-3, 104);
    g.closePath();
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.stroke();
    rr(g, -6, -36, 14, 38, 4);
    g.fillStyle = '#2b2b2b';
    g.fill();
    g.stroke();
    g.restore();
    if (this.flash > 0) {
      g.fillStyle = `rgba(239,83,80,${this.flash})`;
      g.fillRect(0, 0, w, h);
    }
    const done = this.lines.filter((l) => l.cut).length;
    label(g, `${done}/${this.n} tranches`, w / 2, 30, 15, '#fbf1dc');
  }
}

const PLANK_ITEMS = [
  { id: 'saucisson', name: 'Saucisson', color: '#b03a35', key: '1' },
  { id: 'fromage', name: 'Fromage', color: '#f3cf63', key: '2' },
  { id: 'olives', name: 'Olives', color: '#6b8e23', key: '3' },
  { id: 'pain', name: 'Pain', color: '#d9a35a', key: '4' },
  { id: 'cacahuetes', name: 'Cacahuètes', color: '#c8894d', key: '5' },
];

export class PlankGame {
  constructor(mgr, opts) {
    this.mgr = mgr;
    this.limit = (opts.rush ? 4.2 : 5.2) + (opts.mods?.time || 0);
    this.t = 0;
    this.mistakes = 0;
    this.done = false;
    this.title = 'Dresser la planche apéro';
    this.hint = 'Posez chaque ingrédient à sa place, le plus vite possible.';
    this.controls = 'Cliquez la bonne case (ou touches <kbd>1</kbd>–<kbd>5</kbd>)';
    // slot layout on the board (shuffled each time)
    const pos = [[85, 110], [160, 92], [235, 110], [122, 160], [200, 160]];
    const items = [...PLANK_ITEMS];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    this.slots = items.map((it, i) => ({ ...it, x: pos[i][0] + 20, y: pos[i][1], placed: false, pop: 0 }));
    this.order = [...items];
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    }
    this.flash = 0;
  }
  get current() {
    return this.order.find((o) => !this.slots.find((s) => s.id === o.id).placed);
  }
  update(dt, input) {
    if (this.done) return;
    this.t += dt;
    let pick = null;
    if (input.click) {
      for (const s of this.slots) if (!s.placed && Math.hypot(input.click.x - s.x, input.click.y - s.y) < 34) pick = s;
    }
    if (input.key) pick = this.slots.find((s) => s.key === input.key && !s.placed) || (input.key >= '1' && input.key <= '5' ? 'wrong' : null);
    const cur = this.current;
    if (pick && cur) {
      if (pick !== 'wrong' && pick.id === cur.id) {
        pick.placed = true;
        pick.pop = 1;
        this.mgr.sfx('place');
      } else {
        this.mistakes++;
        this.flash = 0.3;
        this.t += 0.35;
        this.mgr.sfx('miss');
      }
    }
    for (const s of this.slots) s.pop = Math.max(0, s.pop - dt * 4);
    this.flash = Math.max(0, this.flash - dt);
    if (!this.current || this.t >= this.limit) this.finish();
  }
  finish() {
    this.done = true;
    const missing = this.slots.filter((s) => !s.placed).length;
    let q;
    if (missing >= 3 || this.mistakes >= 3) q = 'bad';
    else if (missing === 0 && this.mistakes === 0 && this.t < this.limit * 0.62) q = 'perfect';
    else if (missing === 0 && this.mistakes <= 1) q = 'good';
    else q = 'average';
    const notes = [];
    if (missing) notes.push(`${missing} ingrédient${missing > 1 ? 's' : ''} oublié${missing > 1 ? 's' : ''}`);
    if (this.mistakes) notes.push(`${this.mistakes} erreur${this.mistakes > 1 ? 's' : ''}`);
    this.result = { quality: q, notes };
  }
  draw(g, w, h, time) {
    bg(g, w, h);
    // board
    rr(g, 50, 62, 280, 140, 18);
    g.fillStyle = '#c28a55';
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.stroke();
    for (const s of this.slots) {
      const r = 28 + s.pop * 8;
      if (s.placed) {
        drawIngredient(g, s.id, s.x, s.y, r);
      } else {
        g.setLineDash([5, 4]);
        g.strokeStyle = 'rgba(42,23,16,0.7)';
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(s.x, s.y, 26, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 0.28;
        drawIngredient(g, s.id, s.x, s.y, 22);
        g.globalAlpha = 1;
        label(g, s.key, s.x + 22, s.y - 22, 12, '#fbf1dc');
      }
    }
    // next ingredient
    const cur = this.current;
    if (cur) {
      rr(g, w / 2 - 90, 14, 180, 40, 12);
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fill();
      drawIngredient(g, cur.id, w / 2 - 62, 34, 16);
      label(g, cur.name + ' →', w / 2 + 12, 34, 16, '#ffcb6b');
    }
    // timer
    const k = clamp(1 - this.t / this.limit, 0, 1);
    rr(g, 50, h - 22, 280, 10, 5);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fill();
    g.fillStyle = k > 0.4 ? '#6fcf6a' : k > 0.2 ? '#f5a524' : '#ef5350';
    g.fillRect(52, h - 20, 276 * k, 6);
    if (this.flash > 0) {
      g.fillStyle = `rgba(239,83,80,${this.flash})`;
      g.fillRect(0, 0, w, h);
    }
  }
}

function drawIngredient(g, id, x, y, r) {
  g.save();
  g.translate(x, y);
  g.strokeStyle = INK;
  g.lineWidth = 2;
  switch (id) {
    case 'saucisson':
      for (let i = 0; i < 3; i++) {
        g.fillStyle = '#b03a35';
        g.beginPath();
        g.arc((i - 1) * r * 0.55, (i % 2) * r * 0.3 - r * 0.1, r * 0.45, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      break;
    case 'fromage':
      g.fillStyle = '#f3cf63';
      g.beginPath();
      g.moveTo(-r * 0.8, r * 0.5);
      g.lineTo(r * 0.8, r * 0.5);
      g.lineTo(r * 0.1, -r * 0.7);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#e0a83a';
      g.beginPath();
      g.arc(0, r * 0.1, r * 0.12, 0, Math.PI * 2);
      g.fill();
      break;
    case 'olives':
      for (let i = 0; i < 4; i++) {
        g.fillStyle = i % 2 ? '#2b2b2b' : '#6b8e23';
        g.beginPath();
        g.ellipse(((i % 2) - 0.5) * r * 0.7, (Math.floor(i / 2) - 0.5) * r * 0.6, r * 0.3, r * 0.22, 0.4, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      break;
    case 'pain':
      g.fillStyle = '#d9a35a';
      g.beginPath();
      g.ellipse(0, 0, r * 0.85, r * 0.5, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.strokeStyle = '#a8742f';
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(i * r * 0.35 - 4, -r * 0.3);
        g.lineTo(i * r * 0.35 + 4, r * 0.3);
        g.stroke();
      }
      break;
    default:
      for (let i = 0; i < 6; i++) {
        g.fillStyle = '#c8894d';
        g.beginPath();
        g.ellipse(Math.cos(i * 2.1) * r * 0.45, Math.sin(i * 2.1) * r * 0.35, r * 0.24, r * 0.16, i, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
  }
  g.restore();
}

