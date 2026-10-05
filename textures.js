// Procedurally painted canvas textures (wood, bricks, wallpaper, chalkboard, posters, labels, neon).
import { Texture } from '../engine/scene.js';
import { RNG } from '../core/rng.js';

const textTextures = [];
export const FONT_DISPLAY = "'Lilita One', 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif";
export const FONT_CHALK = "'Patrick Hand', 'Comic Sans MS', 'Chalkboard SE', cursive";
export const FONT_SCRIPT = "'Pacifico', 'Brush Script MT', 'Segoe Script', cursive";

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** register a texture whose drawing depends on web fonts; it is redrawn once fonts load */
function textTexture(w, h, draw, opts) {
  const c = canvas(w, h);
  const tex = new Texture(c, opts);
  tex.redraw = () => {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);
    tex.needsUpdate = true;
  };
  tex.redraw();
  textTextures.push(tex);
  return tex;
}

export function redrawTextTextures() {
  for (const t of textTextures) t.redraw();
}

export function woodFloor() {
  const c = canvas(1024, 1024);
  const ctx = c.getContext('2d');
  const rng = new RNG(7);
  const rows = 10;
  const ph = 1024 / rows;
  const tones = ['#6a4029', '#74472d', '#5f3923', '#7b5134', '#6c442d', '#825939', '#5a3622'];
  for (let r = 0; r < rows; r++) {
    let x = -rng.range(0, 400);
    while (x < 1024) {
      const len = rng.range(260, 520);
      ctx.fillStyle = rng.pick(tones);
      ctx.fillRect(x, r * ph, len, ph);
      // grain
      ctx.globalAlpha = 0.18;
      for (let g = 0; g < 7; g++) {
        ctx.strokeStyle = rng.chance(0.5) ? '#5e331c' : '#b07a50';
        ctx.lineWidth = rng.range(1, 3);
        ctx.beginPath();
        const y0 = r * ph + rng.range(6, ph - 6);
        ctx.moveTo(x, y0);
        for (let t = 0; t <= len; t += 40) ctx.lineTo(x + t, y0 + Math.sin(t * 0.02 + g) * rng.range(1, 4));
        ctx.stroke();
      }
      // knots
      if (rng.chance(0.35)) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#4d2a17';
        ctx.beginPath();
        ctx.ellipse(x + rng.range(30, len - 30), r * ph + rng.range(20, ph - 20), rng.range(6, 12), rng.range(3, 6), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // plank end gap
      ctx.fillStyle = '#3a2013';
      ctx.fillRect(x, r * ph, 3, ph);
      x += len;
    }
    ctx.fillStyle = '#3a2013';
    ctx.fillRect(0, r * ph, 1024, 3);
    // light bevel
    ctx.fillStyle = 'rgba(255,220,180,0.12)';
    ctx.fillRect(0, r * ph + 3, 1024, 3);
  }
  return new Texture(c, { repeat: true });
}

export function bricks() {
  const c = canvas(512, 512);
  const ctx = c.getContext('2d');
  const rng = new RNG(11);
  ctx.fillStyle = '#d9c3a3';
  ctx.fillRect(0, 0, 512, 512);
  const bh = 512 / 12, bw = 512 / 4;
  const tones = ['#a4492f', '#b3553a', '#954029', '#bb6142', '#8f3d27', '#a85238'];
  for (let r = 0; r < 12; r++) {
    const off = r % 2 ? bw / 2 : 0;
    for (let i = -1; i < 5; i++) {
      const x = i * bw + off;
      ctx.fillStyle = rng.pick(tones);
      ctx.beginPath();
      ctx.roundRect(x + 4, r * bh + 4, bw - 8, bh - 8, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,200,170,0.18)';
      ctx.fillRect(x + 8, r * bh + 6, bw - 16, 4);
      ctx.fillStyle = 'rgba(60,20,10,0.18)';
      ctx.fillRect(x + 8, r * bh + bh - 12, bw - 16, 5);
    }
  }
  return new Texture(c, { repeat: true });
}

export function wallpaper(base = '#2f5d50', stripe = '#356a5b', motif = '#c9a45c') {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = stripe;
  for (let i = 0; i < 4; i++) ctx.fillRect(i * 64 + 22, 0, 20, 256);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = motif;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const x = i * 64 + 0, y = j * 64 + (i % 2 ? 32 : 0);
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 5, y);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 5, y);
      ctx.closePath();
      ctx.fill();
    }
  ctx.globalAlpha = 1;
  return new Texture(c, { repeat: true });
}

export function nightStreet() {
  const c = canvas(1024, 512);
  const ctx = c.getContext('2d');
  const rng = new RNG(3);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#0b1230');
  g.addColorStop(0.6, '#1c2552');
  g.addColorStop(1, '#2a2440');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);
  // buildings across the street
  let x = 0;
  while (x < 1024) {
    const w = rng.range(120, 220), h = rng.range(220, 420);
    ctx.fillStyle = rng.pick(['#161b38', '#1b1f40', '#141832']);
    ctx.fillRect(x, 512 - h, w, h);
    for (let wy = 512 - h + 20; wy < 470; wy += 46)
      for (let wx = x + 16; wx < x + w - 24; wx += 38) {
        const lit = rng.chance(0.45);
        ctx.fillStyle = lit ? rng.pick(['#ffcf6b', '#ffb84d', '#ffe4a1']) : '#252b55';
        ctx.fillRect(wx, wy, 18, 26);
      }
    x += w + rng.range(4, 20);
  }
  // street lamps glow
  for (let i = 0; i < 3; i++) {
    const lx = 160 + i * 340;
    const rg = ctx.createRadialGradient(lx, 300, 2, lx, 300, 140);
    rg.addColorStop(0, 'rgba(255,210,140,0.9)');
    rg.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(lx - 140, 160, 280, 280);
    ctx.fillStyle = '#0d0f22';
    ctx.fillRect(lx - 3, 300, 6, 212);
  }
  // sidewalk
  ctx.fillStyle = '#3a3550';
  ctx.fillRect(0, 470, 1024, 42);
  // stars
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 40; i++) ctx.fillRect(rng.range(0, 1024), rng.range(0, 160), 2, 2);
  return new Texture(c);
}

export function chalkboard(getLines) {
  return textTexture(768, 512, (ctx, w, h) => {
    ctx.fillStyle = '#23302b';
    ctx.fillRect(0, 0, w, h);
    // smudges
    const rng = new RNG(5);
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      ctx.ellipse(rng.range(0, w), rng.range(0, h), rng.range(30, 120), rng.range(10, 40), rng.range(0, 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const lines = getLines ? getLines() : [];
    ctx.fillStyle = '#fbf3df';
    ctx.textBaseline = 'middle';
    ctx.font = `64px ${FONT_CHALK}`;
    ctx.textAlign = 'center';
    ctx.fillText('À la pression', w / 2, 52);
    ctx.strokeStyle = 'rgba(251,243,223,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.25, 90);
    ctx.quadraticCurveTo(w / 2, 100, w * 0.75, 88);
    ctx.stroke();
    ctx.font = `44px ${FONT_CHALK}`;
    let y = 140;
    const max = Math.min(lines.length, 8);
    const lh = max > 6 ? 44 : 52;
    for (let i = 0; i < max; i++) {
      const l = lines[i];
      ctx.textAlign = 'left';
      ctx.fillStyle = l.color || '#fbf3df';
      ctx.fillText(l.name, 50, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd77a';
      ctx.fillText(l.price, w - 50, y);
      ctx.strokeStyle = 'rgba(251,243,223,0.25)';
      ctx.setLineDash([4, 10]);
      ctx.beginPath();
      const tw = ctx.measureText(l.price).width;
      ctx.moveTo(50 + Math.min(ctx.measureText(l.name).width + 16, w * 0.6), y + 10);
      ctx.lineTo(w - 60 - tw, y + 10);
      ctx.stroke();
      ctx.setLineDash([]);
      y += lh;
    }
    if (!lines.length) {
      ctx.textAlign = 'center';
      ctx.fillText('Rien pour l’instant…', w / 2, 220);
    }
  }, { mipmap: true });
}

export function neonSign(text, color = '#ff6fae') {
  return textTexture(1024, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 150;
    ctx.font = `${size}px ${FONT_SCRIPT}`;
    while (ctx.measureText(text()).width > w - 80 && size > 40) {
      size -= 6;
      ctx.font = `${size}px ${FONT_SCRIPT}`;
    }
    ctx.shadowColor = color;
    for (let i = 0; i < 3; i++) {
      ctx.shadowBlur = 40 - i * 12;
      ctx.strokeStyle = color;
      ctx.lineWidth = 10 - i * 3;
      ctx.strokeText(text(), w / 2, h / 2);
    }
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#fff4fb';
    ctx.fillText(text(), w / 2, h / 2);
  }, { mipmap: true });
}

/** Square medallion label for a beer (tap badge / bottle label). */
export function beerBadge(beer) {
  const L = beer.label;
  return textTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = L.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = L.accent || L.fg;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = L.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${L.initialSize || 120}px ${FONT_DISPLAY}`;
    ctx.fillText(L.initial || beer.name[0], w / 2, h / 2 + 6);
    if (L.motif === 'star') drawStar(ctx, w / 2, 46, 18, L.accent || L.fg);
    if (L.motif === 'owl') drawOwl(ctx, w / 2, 52, L.accent || L.fg);
    if (L.motif === 'crown') drawCrown(ctx, w / 2, 44, L.accent || L.fg);
    if (L.motif === 'wheat') drawWheat(ctx, w / 2, 46, L.accent || L.fg);
  }, { mipmap: true });
}

function drawStar(ctx, x, y, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.fill();
}
function drawOwl(ctx, x, y, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 22, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x - 9, y, 7, 0, Math.PI * 2); ctx.arc(x + 9, y, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(x - 9, y, 3, 0, Math.PI * 2); ctx.arc(x + 9, y, 3, 0, Math.PI * 2); ctx.fill();
}
function drawCrown(ctx, x, y, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x - 26, y + 12); ctx.lineTo(x - 26, y - 8); ctx.lineTo(x - 13, y + 2); ctx.lineTo(x, y - 14);
  ctx.lineTo(x + 13, y + 2); ctx.lineTo(x + 26, y - 8); ctx.lineTo(x + 26, y + 12); ctx.closePath();
  ctx.fill();
}
function drawWheat(ctx, x, y, col) {
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.lineTo(x, y - 18); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.ellipse(x - 6, y - 12 + i * 8, 6, 3, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 6, y - 12 + i * 8, 6, 3, 0.6, 0, Math.PI * 2); ctx.fill();
  }
}

/** Retro beer poster for a fictional brand. */
export function poster(beer, variant = 0) {
  const L = beer.label;
  return textTexture(256, 360, (ctx, w, h) => {
    ctx.fillStyle = '#f1e2c2';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = L.bg;
    ctx.fillRect(12, 12, w - 24, h - 24);
    // sunburst
    ctx.save();
    ctx.translate(w / 2, h * 0.48);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-18, -260);
      ctx.lineTo(18, -260);
      ctx.fill();
    }
    ctx.restore();
    // glass silhouette
    const gx = w / 2, gy = h * 0.5;
    ctx.fillStyle = beer.liquidCss || '#f3b52f';
    ctx.beginPath();
    ctx.moveTo(gx - 34, gy - 50);
    ctx.lineTo(gx + 34, gy - 50);
    ctx.lineTo(gx + 26, gy + 60);
    ctx.lineTo(gx - 26, gy + 60);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = beer.foamCss || '#fff8e7';
    ctx.beginPath();
    ctx.ellipse(gx, gy - 52, 38, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(gx - 20, gy - 36);
    ctx.lineTo(gx - 16, gy + 48);
    ctx.stroke();
    ctx.fillStyle = L.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 40;
    ctx.font = `${size}px ${FONT_DISPLAY}`;
    while (ctx.measureText(beer.name).width > w - 40 && size > 16) {
      size -= 2;
      ctx.font = `${size}px ${FONT_DISPLAY}`;
    }
    ctx.fillText(beer.name, w / 2, 52);
    ctx.font = `20px ${FONT_CHALK}`;
    ctx.fillText(beer.tagline || beer.styleLabel, w / 2, h - 46);
  }, { mipmap: true });
}

/** generic painting / frame art */
export function painting(seed = 1) {
  const c = canvas(256, 200);
  const ctx = c.getContext('2d');
  const rng = new RNG(seed);
  const sky = ctx.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, rng.pick(['#f6b26b', '#9fc5e8', '#d5a6bd']));
  sky.addColorStop(1, '#fff2cc');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 256, 200);
  ctx.fillStyle = rng.pick(['#6aa84f', '#38761d', '#93c47d']);
  ctx.beginPath();
  ctx.moveTo(0, 140);
  for (let x = 0; x <= 256; x += 32) ctx.lineTo(x, 120 + Math.sin(x * 0.03 + seed) * 20);
  ctx.lineTo(256, 200);
  ctx.lineTo(0, 200);
  ctx.fill();
  ctx.fillStyle = '#fff2cc';
  ctx.beginPath();
  ctx.arc(rng.range(40, 210), 50, 22, 0, Math.PI * 2);
  ctx.fill();
  return new Texture(c);
}

export function tvScreen(drawFn) {
  const c = canvas(256, 144);
  const tex = new Texture(c, { mipmap: false });
  tex.ctx = c.getContext('2d');
  tex.draw = (t) => {
    drawFn(tex.ctx, 256, 144, t);
    tex.needsUpdate = true;
  };
  tex.draw(0);
  return tex;
}
