// Pint pouring mini-game: control the tap opening (hold), the glass angle (drag / arrows) and stop at the line.
import { pourProfile } from '../data/service.js';
import { INK, rr, bg, label, vgauge, bubbles } from './draw.js';
import { clamp } from '../engine/math.js';

const TARGET = 0.96;

export class PourGame {
  constructor(mgr, opts) {
    this.mgr = mgr;
    this.beer = opts.product;
    this.count = opts.count || 1;
    const P = pourProfile(this.beer);
    this.P = P;
    const m = opts.mods || {};
    this.win = (m.window || 1) * (opts.rush ? 0.88 : 1);
    this.flowMult = m.flow || 1;
    this.foamMult = m.foam || 1;
    const c = (P.zone[0] + P.zone[1]) / 2, hw = ((P.zone[1] - P.zone[0]) / 2) * this.win;
    this.zone = [clamp(c - hw, 0.08, 0.95), clamp(c + hw, 0.12, 0.99)];
    const fc = (P.foamBand[0] + P.foamBand[1]) / 2, fw = ((P.foamBand[1] - P.foamBand[0]) / 2) * (0.75 + 0.25 * this.win) * (m.foamBand || 1);
    this.foamBand = [Math.max(0.01, fc - fw), fc + fw];
    this.q = 0;
    this.tilt = 1; // 1 = 45°, 0 = upright
    this.tiltTarget = 1;
    this.liquid = 0;
    this.foam = 0;
    this.spill = 0;
    this.surge = 0;
    this.t = 0;
    this.closedT = 0;
    this.started = false;
    this.done = false;
    this.drops = [];
    this.title = (this.count > 1 ? `Tirer ${this.count} × ` : 'Tirer une ') + this.beer.name;
    this.hint = P.hint;
    this.controls = '<kbd>Espace</kbd> / clic maintenu : verser · <kbd>↑</kbd> / glisser vers le haut : redresser · stop au trait doré';
    this.place = 0; // glass sliding in animation
  }

  get total() {
    return this.liquid + this.foam;
  }

  update(dt, input) {
    if (this.done) return;
    this.place = Math.min(1, this.place + dt * 4);
    if (this.place < 1) return;
    // the clock starts with the first pull on the tap
    if (this.started) this.t += dt;
    else if ((this.idle = (this.idle || 0) + dt) > 12) return this.finish();
    const P = this.P;
    // tilt control
    if (input.tiltSet !== null) this.tiltTarget = input.tiltSet;
    if (input.up) this.tiltTarget = clamp(this.tiltTarget - dt * 1.6, 0, 1);
    if (input.down) this.tiltTarget = clamp(this.tiltTarget + dt * 1.6, 0, 1);
    this.tilt += (this.tiltTarget - this.tilt) * Math.min(1, dt * 14);
    // valve
    // valve: holding opens the tap progressively, releasing closes it (feather it to stay in the green zone)
    if (input.hold) {
      this.started = true;
      this.q = Math.min(1, this.q + dt * (this.q < 0.35 ? 1.6 : 0.95));
      this.closedT = 0;
    } else {
      this.q = Math.max(0, this.q - dt * 1.6);
      if (this.q === 0 && this.started) this.closedT += dt;
    }
    const r = this.q * P.flow * this.flowMult;
    const level = this.total;
    if (r > 0) {
      const dV = r * dt;
      // glass angle: straight too early = foam explosion, still tilted at the end = flat beer
      const idealTilt = clamp(1 - this.liquid / 0.62, 0, 1);
      const e = this.tilt - idealTilt;
      // a tilted glass makes little foam (beer slides down the side), an upright one builds the head
      const angleK = 0.2 + 0.8 * (1 - this.tilt);
      const tiltK = e < -0.08 ? 1 + (e + 0.08) * (e + 0.08) * P.tiltW * 4 : 1;
      const over = Math.max(0, this.q - this.zone[1]) / Math.max(0.05, 1 - this.zone[1]);
      const under = Math.max(0, this.zone[0] - this.q) / Math.max(0.05, this.zone[0]);
      let foamFrac = P.foam * this.foamMult * (1 + over * (P.overK || 1) + under * 0.3) * angleK * tiltK;
      if (P.rest) {
        this.surge = Math.min(1, this.surge + dV * (this.liquid < 0.72 ? 1.4 : 0.45));
        if (this.liquid >= 0.7 && this.surge > 0.42) foamFrac *= 3.2;
      }
      foamFrac = clamp(foamFrac, 0, 0.85);
      this.liquid += dV * (1 - foamFrac);
      this.foam += dV * foamFrac * 1.8;
    } else if (P.rest) this.surge = Math.max(0, this.surge - dt * 0.9);
    // foam slowly settles
    const settle = this.foam * 0.1 * dt;
    this.foam -= settle;
    this.liquid += settle * 0.45;
    // overflow
    if (this.total > 1) {
      const ex = this.total - 1;
      this.spill += ex;
      const f2 = Math.min(this.foam, ex);
      this.foam -= f2;
      this.liquid -= ex - f2;
      if (Math.random() < 0.7) this.drops.push({ x: Math.random() < 0.5 ? -1 : 1, y: 0, vy: 0, life: 0.6 });
    }
    for (const d of this.drops) {
      d.vy += 600 * dt;
      d.y += d.vy * dt;
      d.life -= dt;
    }
    this.drops = this.drops.filter((d) => d.life > 0);
    // end conditions
    if (this.spill > 0.42) return this.finish();
    if (this.started && this.q === 0) {
      const restWait = this.P.rest && this.surge > 0.05 && this.total < 0.88;
      if (this.total >= 0.86 && this.closedT > 0.3) return this.finish();
      if (!restWait && this.total >= 0.3 && this.closedT > 1.7) return this.finish();
    }
    if (this.t > 10) this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const total = this.total;
    const fr = total > 0 ? this.foam / total : 1;
    const sFill = 1 - clamp(Math.abs(total - TARGET) / (0.12 * this.win), 0, 1);
    const fb = this.foamBand;
    const fd = fr < fb[0] ? fb[0] - fr : fr > fb[1] ? fr - fb[1] : 0;
    const sFoam = 1 - clamp(fd / (0.08 * (0.8 + 0.2 * this.win)), 0, 1);
    const sSpill = 1 - clamp(this.spill / 0.15, 0, 1);
    const sAngle = 1 - clamp((this.tilt - 0.25) / 0.5, 0, 1); // the glass must end upright
    const par = this.P.par;
    const sTime = 1 - clamp((this.t - par) / (par * 0.9), 0, 1);
    const score = 0.3 * sFill + 0.28 * sFoam + 0.17 * sSpill + 0.1 * sAngle + 0.15 * sTime;
    let q;
    if (this.spill > 0.4) q = 'catastrophe';
    else if (total < 0.55 || this.spill > 0.15 || fd > 0.14) q = 'bad';
    else if (score >= 0.88 && this.spill < 0.03 && Math.min(sFill, sFoam, sAngle) >= 0.7) q = 'perfect';
    else if (score >= 0.7 && (sAngle >= 0.5 || this.P.tiltW < 0.8)) q = 'good';
    else q = 'average';
    const notes = [];
    if (this.spill > 0.03) notes.push('débordement');
    if (fr > fb[1] + 0.015) notes.push('trop de mousse');
    if (fr < fb[0] - 0.015) notes.push('pas assez de mousse');
    if (total < TARGET - 0.08) notes.push('pas assez rempli');
    if (sAngle < 0.7) notes.push('verre pas redressé');
    if (this.t > par * 1.4) notes.push('trop lent');
    this.result = { quality: q, score, notes: q === 'catastrophe' ? ['ça a débordé de partout !'] : notes.slice(0, 2), time: this.t, wasted: this.spill };
  }

  draw(g, w, h, time) {
    bg(g, w, h);
    const P = this.P;
    // gauges
    vgauge(g, 22, 44, 26, h - 92, this.q, this.zone[0], this.zone[1], 'DÉBIT');
    // tilt gauge (arc)
    const cx = w - 58, cy = h - 70, R = 44;
    g.lineWidth = 9;
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI / 4);
    g.stroke();
    const idealTilt = clamp(1 - this.liquid / 0.62, 0, 1);
    const tol = 0.22 / Math.sqrt(P.tiltW);
    g.strokeStyle = 'rgba(111,207,106,0.8)';
    g.beginPath();
    g.arc(cx, cy, R, -Math.PI / 2 + Math.max(0, idealTilt - tol) * (Math.PI / 4), -Math.PI / 2 + Math.min(1, idealTilt + tol) * (Math.PI / 4));
    g.stroke();
    const na = -Math.PI / 2 + this.tilt * (Math.PI / 4);
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(na) * (R + 8), cy + Math.sin(na) * (R + 8));
    g.stroke();
    g.fillStyle = INK;
    g.beginPath();
    g.arc(cx, cy, 5, 0, Math.PI * 2);
    g.fill();
    label(g, 'INCLINAISON', cx + 6, cy + 20, 11, '#d6c3a1');
    // time bar
    const par = P.par;
    const tk = clamp(this.t / (par * 1.6), 0, 1);
    rr(g, 70, 12, w - 140, 8, 4);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fill();
    g.fillStyle = this.t < par ? '#6fcf6a' : this.t < par * 1.35 ? '#f5a524' : '#ef5350';
    g.fillRect(72, 14, (w - 144) * tk, 4);
    // stout rest meter
    if (P.rest) {
      const needRest = this.surge > 0.42 && this.liquid >= 0.55;
      label(g, needRest ? 'LAISSEZ REPOSER…' : this.liquid > 0.6 ? 'Complétez !' : 'Remplir aux ¾', w / 2, 34, 12, needRest ? '#ffcf8a' : '#9ff0a0');
      rr(g, w - 110, 30, 80, 8, 4);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fill();
      g.fillStyle = '#c9a07a';
      g.fillRect(w - 108, 32, 76 * this.surge, 4);
    }
    // glasses
    const n = this.count;
    const gw = n > 1 ? 70 : 92, gh = n > 1 ? 130 : 160;
    const baseY = h - 26;
    const xs = n === 1 ? [w / 2] : n === 2 ? [w / 2 - 48, w / 2 + 48] : [w / 2 - 105, w / 2 - 35, w / 2 + 35, w / 2 + 105];
    const slide = (1 - this.place) * 160;
    for (const gx of xs) this.drawGlass(g, gx - slide, baseY, gw, gh, time);
    // nozzle(s)
    for (const gx of xs) {
      g.fillStyle = '#cfd6dc';
      rr(g, gx - 14, 0, 28, 30, 6);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.stroke();
      rr(g, gx - 6, 26, 12, 14, 3);
      g.fill();
      g.stroke();
      // stream
      if (this.q > 0.02 && this.place >= 1) {
        const sw = 3 + this.q * 9;
        const top = 40;
        const surfaceY = baseY - Math.min(1, this.total) * gh * Math.cos((this.tilt * Math.PI) / 4) * 0.98;
        g.fillStyle = this.beer.liquidCss;
        const wob = Math.sin(time * 40) * 1.2;
        g.fillRect(gx - sw / 2 + wob, top, sw, Math.max(0, surfaceY - top));
      }
    }
    // overflow drops
    for (const d of this.drops) {
      for (const gx of xs) {
        g.fillStyle = this.beer.liquidCss;
        g.beginPath();
        g.arc(gx + d.x * (gw / 2 + 6), baseY - gh + d.y, 4, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (this.spill > 0.02) {
      g.fillStyle = this.beer.liquidCss;
      g.globalAlpha = 0.8;
      g.beginPath();
      g.ellipse(w / 2, baseY + 4, Math.min(w / 2 - 10, 40 + this.spill * 260), 6 + this.spill * 10, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
    if (!this.started && this.place >= 1) label(g, 'Maintenez pour verser !', w / 2, h / 2, 18, '#ffcb6b');
  }

  drawGlass(g, gx, baseY, gw, gh, time) {
    const a = (this.tilt * Math.PI) / 4;
    g.save();
    g.translate(gx, baseY);
    g.rotate(-a * 0.55);
    // glass shape (pint, slightly flared)
    const bw = gw * 0.74, tw = gw;
    const path = () => {
      g.beginPath();
      g.moveTo(-bw / 2, 0);
      g.lineTo(bw / 2, 0);
      g.lineTo(tw / 2, -gh);
      g.lineTo(-tw / 2, -gh);
      g.closePath();
    };
    path();
    g.fillStyle = 'rgba(220,240,255,0.18)';
    g.fill();
    g.save();
    path();
    g.clip();
    // liquid: surface stays horizontal in screen space -> counter-rotate
    g.rotate(a * 0.55);
    const L = Math.min(1, this.liquid), F = Math.min(1 - L, this.foam);
    const yl = -L * gh, yf = -(L + F) * gh;
    const grd = g.createLinearGradient(0, 0, 0, -gh);
    grd.addColorStop(0, this.beer.liquidCss);
    grd.addColorStop(1, shade(this.beer.liquidCss, 1.25));
    g.fillStyle = grd;
    g.fillRect(-tw, yl, tw * 2, -yl + 40);
    bubbles(g, -bw / 2, bw / 2, yl, 0, time, 14);
    if (this.P.rest && this.surge > 0.15) {
      g.fillStyle = `rgba(200,170,140,${0.35 * this.surge})`;
      g.fillRect(-tw, yl, tw * 2, -yl);
    }
    g.fillStyle = this.beer.foamCss;
    g.fillRect(-tw, yf, tw * 2, yl - yf + 1);
    // foam bubbles
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(-tw / 2 + (i + 0.5) * (tw / 6), yf + 2, Math.max(1, Math.min(6, (yl - yf) * 0.4)), 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    // outline + target line
    path();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.stroke();
    const ty = -TARGET * gh;
    g.setLineDash([5, 4]);
    g.strokeStyle = '#ffd166';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-tw / 2 - 8, ty);
    g.lineTo(tw / 2 + 8, ty);
    g.stroke();
    g.setLineDash([]);
    // shine
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-bw / 2 + 8, -10);
    g.lineTo(-tw / 2 + 10, -gh + 14);
    g.stroke();
    g.restore();
  }
}

function shade(css, k) {
  const n = parseInt(css.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * k), gg = Math.min(255, ((n >> 8) & 255) * k), b = Math.min(255, (n & 255) * k);
  return `rgb(${r | 0},${gg | 0},${b | 0})`;
}
