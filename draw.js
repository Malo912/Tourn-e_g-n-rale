// Small Canvas 2D helpers shared by the mini-games (cartoon look: thick dark outlines).
export const INK = '#2a1710';

export function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

let bgCache = null;
/** warm close-up backdrop: brick wall, back-bar shelf, spotlight and the counter top */
export function bg(g, w, h) {
  if (!bgCache || bgCache.w !== w || bgCache.h !== h) bgCache = makeBg(w, h);
  g.drawImage(bgCache.c, 0, 0, w, h);
}

function makeBg(w, h) {
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  const x = c.getContext('2d');
  x.scale(2, 2);
  x.fillStyle = '#5e3020';
  x.fillRect(0, 0, w, h);
  const bw = 34, bh = 14;
  for (let row = 0; row * bh < h; row++) {
    for (let col = -1; col * bw < w; col++) {
      const ox = (row % 2) * (bw / 2);
      const k = 0.82 + (((row * 7 + col * 13) % 5) + 5) % 5 / 22;
      x.fillStyle = `rgb(${(146 * k) | 0},${(76 * k) | 0},${(48 * k) | 0})`;
      x.fillRect(col * bw + ox + 1, row * bh + 1, bw - 2, bh - 2);
    }
  }
  // back-bar shelf with bottle silhouettes
  const cols = ['rgba(70,130,70,0.5)', 'rgba(140,70,30,0.5)', 'rgba(220,180,90,0.45)', 'rgba(60,30,20,0.55)', 'rgba(90,140,170,0.4)'];
  for (let i = 0; i < 15; i++) {
    const bx = 6 + i * 26 + (i % 3) * 3, hh = 16 + ((i * 5) % 12);
    x.fillStyle = cols[i % cols.length];
    rr(x, bx, 62 - hh, 11, hh, 3);
    x.fill();
    x.fillRect(bx + 3.5, 62 - hh - 7, 4, 8);
  }
  x.fillStyle = '#3a2216';
  x.fillRect(0, 62, w, 5);
  x.fillStyle = 'rgba(255,220,170,0.25)';
  x.fillRect(0, 62, w, 1.5);
  // spotlight on the work area + vignette
  const rg = x.createRadialGradient(w / 2, h * 0.58, 10, w / 2, h * 0.58, w * 0.62);
  rg.addColorStop(0, 'rgba(255,214,150,0.55)');
  rg.addColorStop(0.45, 'rgba(255,190,120,0.16)');
  rg.addColorStop(1, 'rgba(20,8,4,0.6)');
  x.fillStyle = rg;
  x.fillRect(0, 0, w, h);
  // counter top
  x.fillStyle = '#7a4a2a';
  x.fillRect(0, h - 26, w, 26);
  x.fillStyle = '#b07842';
  x.fillRect(0, h - 26, w, 5);
  x.fillStyle = 'rgba(0,0,0,0.28)';
  x.fillRect(0, h - 9, w, 9);
  return { c, w, h };
}

export function label(g, text, x, y, size = 13, color = '#fbf1dc', align = 'center') {
  g.font = `800 ${size}px 'Baloo 2', system-ui, sans-serif`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(20,10,5,0.85)';
  g.strokeText(text, x, y);
  g.fillStyle = color;
  g.fillText(text, x, y);
}

/** vertical gauge with a green ideal band and a needle */
export function vgauge(g, x, y, w, h, value, lo, hi, title, color = '#f5a524') {
  rr(g, x, y, w, h, 8);
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = INK;
  g.stroke();
  // ideal band
  const by0 = y + h - hi * h, by1 = y + h - lo * h;
  g.fillStyle = 'rgba(111,207,106,0.55)';
  g.fillRect(x + 3, by0, w - 6, by1 - by0);
  g.strokeStyle = '#9ff0a0';
  g.lineWidth = 1.5;
  g.strokeRect(x + 3, by0, w - 6, by1 - by0);
  // fill
  const vy = y + h - value * h;
  g.fillStyle = color;
  g.globalAlpha = 0.85;
  g.fillRect(x + 6, vy, w - 12, y + h - vy - 3);
  g.globalAlpha = 1;
  // needle
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(x + w + 2, vy);
  g.lineTo(x + w + 12, vy - 6);
  g.lineTo(x + w + 12, vy + 6);
  g.closePath();
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 1.5;
  g.stroke();
  if (title) label(g, title, x + w / 2, y - 10, 11, '#d6c3a1');
}

export function bubbles(g, x0, x1, y0, y1, t, n = 10, color = 'rgba(255,255,255,0.45)') {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const fx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const sp = 18 + (i % 4) * 9;
    const x = x0 + Math.abs(fx) * (x1 - x0);
    const y = y1 - (((t * sp + i * 37) % 1000) / 1000) * (y1 - y0) * 3;
    if (y < y0 || y > y1) continue;
    g.beginPath();
    g.arc(x, y, 1.2 + (i % 3) * 0.6, 0, Math.PI * 2);
    g.fill();
  }
}

export function star(g, x, y, r, fill = '#ffd166') {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr2 = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 2;
  g.stroke();
}
