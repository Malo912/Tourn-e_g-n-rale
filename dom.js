// Minimal DOM helpers.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function fmtTime(min) {
  const m = Math.floor(min) % (24 * 60);
  const hh = Math.floor(m / 60), mm = m % 60;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

export function eur(v, dec = 0) {
  const s = dec ? v.toFixed(dec).replace('.', ',') : Math.round(v).toLocaleString('fr-FR');
  return s + ' €';
}

export function starsHTML(v, iconFn, size = 16) {
  let out = '';
  for (let i = 1; i <= 5; i++) {
    if (v >= i) out += iconFn('star', size);
    else if (v >= i - 0.5) out += `<span class="half-star" style="width:${size}px;height:${size}px">${iconFn('starEmpty', size)}<span>${iconFn('star', size)}</span></span>`;
    else out += iconFn('starEmpty', size);
  }
  return out;
}
