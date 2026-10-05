// Inline SVG icon set (chunky cartoon style, dark outline).
const O = '#2a1710';
const sw = 'stroke="' + O + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';

const ICONS = {
  notepad: `<rect x="6" y="4" width="20" height="25" rx="3" fill="#fff8e7" ${sw}/><path d="M10 11h12M10 16h12M10 21h8" ${sw}/><path d="M22 2l6 6-9 9-6 1 1-6z" fill="#f5a524" ${sw}/>`,
  euro: `<circle cx="16" cy="16" r="12" fill="#f4c430" ${sw}/><path d="M20.5 10.5a6.5 6.5 0 1 0 0 11M9 14.5h8M9 18h8" fill="none" ${sw}/>`,
  coin: `<circle cx="16" cy="16" r="11" fill="#f4c430" ${sw}/><circle cx="16" cy="16" r="6.5" fill="none" stroke="#c9961a" stroke-width="2"/>`,
  door: `<rect x="8" y="4" width="16" height="25" rx="2" fill="#8a4b2a" ${sw}/><circle cx="20" cy="17" r="1.6" fill="#f4c430"/><path d="M4 29h24" ${sw}/>`,
  star: `<path d="M16 3l3.9 8 8.8 1.2-6.4 6.1 1.6 8.7L16 22.8 8.1 27l1.6-8.7-6.4-6.1 8.8-1.2z" fill="#ffc83d" ${sw}/>`,
  starEmpty: `<path d="M16 3l3.9 8 8.8 1.2-6.4 6.1 1.6 8.7L16 22.8 8.1 27l1.6-8.7-6.4-6.1 8.8-1.2z" fill="#5a3a26" ${sw}/>`,
  beer: `<path d="M8 9h14l-1.5 19h-11z" fill="#f2b01e" ${sw}/><path d="M7 9c0-4 4-5 6-3 1-3 6-3 7 0 3-1 5 1 4 4H7z" fill="#fff6e2" ${sw}/><path d="M22 12h3a3 3 0 0 1 0 8h-3.6" fill="none" ${sw}/>`,
  bottle: `<path d="M13 3h6v6l3 4v15a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V13l3-4z" fill="#3f8f4a" ${sw}/><rect x="10" y="16" width="12" height="7" fill="#f6ecd0" ${sw}/>`,
  food: `<ellipse cx="16" cy="21" rx="12" ry="5" fill="#f4efe6" ${sw}/><circle cx="12" cy="18" r="4" fill="#b03a35" ${sw}/><circle cx="19" cy="17" r="4" fill="#b03a35" ${sw}/>`,
  tray: `<ellipse cx="16" cy="22" rx="13" ry="4" fill="#9aa4ad" ${sw}/><path d="M10 21V12h5v9M18 21v-8h5v8" fill="#f2b01e" ${sw}/>`,
  sponge: `<rect x="5" y="10" width="22" height="13" rx="4" fill="#ffd166" ${sw}/><circle cx="11" cy="15" r="1.5" fill="${O}"/><circle cx="18" cy="18" r="1.5" fill="${O}"/><circle cx="22" cy="14" r="1.2" fill="${O}"/>`,
  wash: `<rect x="5" y="6" width="22" height="22" rx="3" fill="#b9c4cc" ${sw}/><circle cx="16" cy="18" r="6" fill="#7fd1ff" ${sw}/><circle cx="10" cy="10" r="1.3" fill="${O}"/>`,
  keg: `<rect x="7" y="5" width="18" height="23" rx="5" fill="#c4ccd3" ${sw}/><path d="M7 12h18M7 21h18" ${sw}/><rect x="13" y="2" width="6" height="4" fill="#555" ${sw}/>`,
  crate: `<rect x="4" y="12" width="24" height="15" rx="2" fill="#c0392b" ${sw}/><path d="M9 12V6M14 12V5M19 12V6M24 12V5" ${sw}/>`,
  fridge: `<rect x="7" y="3" width="18" height="26" rx="3" fill="#7d1f2b" ${sw}/><rect x="10" y="7" width="12" height="18" rx="1" fill="#9fd8ff" ${sw}/>`,
  wrench: `<path d="M20 4a6 6 0 0 0-5.6 8.2L5 21.6 9.4 26l9.4-9.4A6 6 0 0 0 27 11l-4 1-3-3 1-4z" fill="#b9c4cc" ${sw}/>`,
  mop: `<path d="M20 3l-6 16" ${sw}/><path d="M8 18h12l3 10H5z" fill="#eeeeee" ${sw}/>`,
  clock: `<circle cx="16" cy="16" r="12" fill="#fff8e7" ${sw}/><path d="M16 9v7l5 3" fill="none" ${sw}/>`,
  ball: `<circle cx="16" cy="16" r="12" fill="#fff" ${sw}/><path d="M16 9l5 4-2 6h-6l-2-6z" fill="${O}"/>`,
  party: `<path d="M5 28l6-18 12 12z" fill="#ef476f" ${sw}/><path d="M19 5v4M25 9l-3 3M27 15h-4" ${sw}/>`,
  quiz: `<circle cx="16" cy="16" r="12" fill="#118ab2" ${sw}/><path d="M12 12a4 4 0 1 1 6 3.5c-1.5.8-2 1.6-2 3.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="23" r="1.6" fill="#fff"/>`,
  darts: `<circle cx="16" cy="16" r="12" fill="#d62828" ${sw}/><circle cx="16" cy="16" r="8" fill="#f3e2c0" ${sw}/><circle cx="16" cy="16" r="3.5" fill="#3c9a4a" ${sw}/>`,
  disco: `<circle cx="16" cy="17" r="11" fill="#c9d6df" ${sw}/><path d="M7 13h18M6 19h20M12 7v20M20 7v20" stroke="#8a9aa6" stroke-width="1.6"/><path d="M16 1v5" ${sw}/>`,
  pretzel: `<path d="M9 24c-6-6 0-16 7-9 7-7 13 3 7 9-3 3-7 0-7-4 0 4-4 7-7 4z" fill="none" stroke="#b5651d" stroke-width="4.5" stroke-linecap="round"/>`,
  mic: `<rect x="11" y="3" width="10" height="15" rx="5" fill="#555" ${sw}/><path d="M7 14a9 9 0 0 0 18 0M16 23v6M11 29h10" fill="none" ${sw}/>`,
  sun: `<circle cx="16" cy="16" r="7" fill="#ffc83d" ${sw}/><path d="M16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M6 26l3-3M23 9l3-3" ${sw}/>`,
  rain: `<path d="M8 18a6 6 0 0 1 1-12 8 8 0 0 1 15 3 5 5 0 0 1-1 9z" fill="#c9d6df" ${sw}/><path d="M11 22l-2 5M17 22l-2 5M23 22l-2 5" stroke="#3a86ff" stroke-width="2.4" stroke-linecap="round"/>`,
  snow: `<path d="M16 3v26M5 10l22 12M5 22l22-12" stroke="#7fd1ff" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="16" r="3" fill="#fff" ${sw}/>`,
  cloudsun: `<circle cx="20" cy="11" r="6" fill="#ffc83d" ${sw}/><path d="M7 26a5 5 0 0 1 1-10 7 7 0 0 1 13 2 4 4 0 0 1 0 8z" fill="#fff" ${sw}/>`,
  tap: `<rect x="13" y="9" width="6" height="17" rx="2" fill="#d6dde3" ${sw}/><path d="M16 9V4M12 4h8" ${sw}/><path d="M19 13h5v5" fill="none" ${sw}/><rect x="9" y="26" width="14" height="3" fill="#8e99a3" ${sw}/>`,
  stool: `<ellipse cx="16" cy="9" rx="9" ry="3.5" fill="#8b2f22" ${sw}/><path d="M16 12v14M10 28h12M12 21h8" ${sw}/>`,
  glass: `<path d="M9 5h14l-2 23h-10z" fill="#d9eef7" ${sw}/><path d="M11 10h10" stroke="#fff" stroke-width="2"/>`,
  jar: `<rect x="8" y="8" width="16" height="20" rx="4" fill="#d8eef7" ${sw}/><rect x="9" y="4" width="14" height="5" rx="1" fill="#d62828" ${sw}/><path d="M10 18h12v8H10z" fill="#c8894d"/>`,
  board: `<rect x="3" y="12" width="24" height="12" rx="3" fill="#c28a55" ${sw}/><circle cx="27" cy="18" r="2.5" fill="none" ${sw}/><circle cx="11" cy="17" r="3" fill="#f3cf63" ${sw}/><circle cx="18" cy="18" r="3" fill="#b03a35" ${sw}/>`,
  toaster: `<rect x="5" y="11" width="22" height="16" rx="5" fill="#d6dde3" ${sw}/><path d="M11 11V7h4v4M17 11V7h4v4" fill="#d9a35a" ${sw}/>`,
  shoe: `<path d="M4 22l2-11 6 1c1 4 6 5 10 5 4 0 6 2 6 5H4z" fill="#ef476f" ${sw}/><path d="M4 25h24" ${sw}/>`,
  bolt: `<path d="M18 3L7 18h8l-2 11 12-16h-8z" fill="#ffd166" ${sw}/>`,
  box: `<path d="M4 10l12-6 12 6v13l-12 6-12-6z" fill="#c28a55" ${sw}/><path d="M4 10l12 6 12-6M16 16v13" fill="none" ${sw}/>`,
  sign: `<rect x="4" y="7" width="24" height="12" rx="3" fill="#ff6fae" ${sw}/><path d="M10 19v9M22 19v9" ${sw}/><path d="M9 13h14" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  expand: `<path d="M5 12V5h7M27 12V5h-7M5 20v7h7M27 20v7h-7" fill="none" ${sw}/><rect x="11" y="11" width="10" height="10" rx="2" fill="#2bb3a3" ${sw}/>`,
  heart: `<path d="M16 27S4 20 4 11a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 9-12 16-12 16z" fill="#ef476f" ${sw}/>`,
  people: `<circle cx="11" cy="10" r="4.5" fill="#f6d3b3" ${sw}/><circle cx="22" cy="12" r="3.8" fill="#e0a982" ${sw}/><path d="M3 27c0-6 4-9 8-9s8 3 8 9zM16 27c1-5 3-7 6-7s6 2 6 7z" fill="#3e7cb1" ${sw}/>`,
  warning: `<path d="M16 3l14 25H2z" fill="#ffd166" ${sw}/><path d="M16 11v8" ${sw}/><circle cx="16" cy="23.5" r="1.6" fill="${O}"/>`,
  check: `<circle cx="16" cy="16" r="12" fill="#06d6a0" ${sw}/><path d="M10 16l4 4 8-8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  cross: `<circle cx="16" cy="16" r="12" fill="#ef476f" ${sw}/><path d="M11 11l10 10M21 11L11 21" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  pause: `<rect x="8" y="6" width="6" height="20" rx="1.5" fill="currentColor"/><rect x="18" y="6" width="6" height="20" rx="1.5" fill="currentColor"/>`,
  play: `<path d="M9 5l17 11L9 27z" fill="currentColor"/>`,
  fast: `<path d="M4 6l12 10L4 26zM16 6l12 10-12 10z" fill="currentColor"/>`,
  music: `<path d="M12 24V7l14-3v17" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="9" cy="24" r="4" fill="currentColor"/><circle cx="23" cy="21" r="4" fill="currentColor"/>`,
  sound: `<path d="M4 12h6l7-6v20l-7-6H4z" fill="currentColor"/><path d="M21 11a6 6 0 0 1 0 10M24 7a11 11 0 0 1 0 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
  mute: `<path d="M4 12h6l7-6v20l-7-6H4z" fill="currentColor"/><path d="M21 12l7 8M28 12l-7 8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`,
  gear: `<circle cx="16" cy="16" r="5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M16 3v5M16 24v5M3 16h5M24 16h5M7 7l3.5 3.5M21.5 21.5L25 25M7 25l3.5-3.5M21.5 10.5L25 7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  hammer: `<path d="M5 26l11-11" stroke="${O}" stroke-width="4" stroke-linecap="round"/><path d="M13 9l6-6 8 8-4 4-3-3-3 3-4-4 3-3z" fill="#8e99a3" ${sw}/>`,
  cart: `<path d="M3 5h4l3 15h14l3-10H9" fill="none" ${sw}/><circle cx="12" cy="26" r="2.5" fill="${O}"/><circle cx="22" cy="26" r="2.5" fill="${O}"/><path d="M11 10h15l-2 7H12z" fill="#f2b01e"/>`,
  list: `<rect x="5" y="3" width="22" height="26" rx="3" fill="#23302b" ${sw}/><path d="M10 10h12M10 16h12M10 22h8" stroke="#fbf3df" stroke-width="2.2" stroke-linecap="round"/>`,
  users: `<circle cx="12" cy="11" r="5" fill="#f6d3b3" ${sw}/><path d="M3 28c0-7 4-10 9-10s9 3 9 10z" fill="#2b2b2b" ${sw}/><rect x="9" y="19" width="6" height="8" fill="#fff"/><circle cx="23" cy="12" r="4" fill="#e0a982" ${sw}/><path d="M20 27c0-5 1-8 4-8s5 3 5 8z" fill="#2bb3a3" ${sw}/>`,
  calendar: `<rect x="4" y="6" width="24" height="22" rx="3" fill="#fff8e7" ${sw}/><path d="M4 12h24" ${sw}/><path d="M10 3v6M22 3v6" ${sw}/><circle cx="11" cy="18" r="2" fill="#ef476f"/><circle cx="17" cy="18" r="2" fill="${O}"/><circle cx="23" cy="18" r="2" fill="${O}"/><circle cx="11" cy="23" r="2" fill="${O}"/>`,
  trophy: `<path d="M9 4h14v7a7 7 0 0 1-14 0z" fill="#ffc83d" ${sw}/><path d="M9 7H4c0 5 3 7 6 7M23 7h5c0 5-3 7-6 7M16 18v5M10 28h12l-1-5H11z" fill="none" ${sw}/>`,
  regular: `<circle cx="14" cy="11" r="6" fill="#f6d3b3" ${sw}/><path d="M3 29c0-7 5-11 11-11s11 4 11 11z" fill="#8d5a97" ${sw}/><path d="M24 2l2 4 4.5.6-3.3 3.1.8 4.4-4-2.1-4 2.1.8-4.4-3.3-3.1L22 6z" fill="#ffc83d" ${sw}/>`,
  book: `<path d="M4 6c5-2 9-1 12 2 3-3 7-4 12-2v20c-5-2-9-1-12 2-3-3-7-4-12-2z" fill="#fff8e7" ${sw}/><path d="M16 8v20" ${sw}/>`,
  newspaper: `<rect x="3" y="5" width="26" height="22" rx="2" fill="#fff8e7" ${sw}/><rect x="7" y="9" width="8" height="7" fill="#c9d6df"/><path d="M18 10h7M18 14h7M7 20h18M7 23h12" stroke="${O}" stroke-width="1.8"/>`,
  rotate: `<path d="M25 13a10 10 0 1 0 1 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M27 5v8h-8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  trash: `<path d="M7 9h18l-2 19H9z" fill="#ef476f" ${sw}/><path d="M5 9h22M12 9V5h8v4M13 14v9M19 14v9" fill="none" ${sw}/>`,
  move: `<path d="M16 3v26M3 16h26M16 3l-4 4M16 3l4 4M16 29l-4-4M16 29l4-4M3 16l4-4M3 16l4 4M29 16l-4-4M29 16l-4 4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`,
  arrowDown: `<path d="M16 4v20M8 16l8 8 8-8" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  lock: `<rect x="7" y="14" width="18" height="14" rx="3" fill="#8e99a3" ${sw}/><path d="M11 14v-4a5 5 0 0 1 10 0v4" fill="none" ${sw}/>`,
  speech: `<path d="M5 6h22v15H14l-6 6v-6H5z" fill="#fff" ${sw}/>`,
  close: `<path d="M8 8l16 16M24 8L8 24" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>`,
  plus: `<path d="M16 6v20M6 16h20" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>`,
  minus: `<path d="M6 16h20" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>`,
  fire: `<path d="M16 3c2 6 9 8 9 16a9 9 0 0 1-18 0c0-5 3-7 4-10 1 3 2 4 4 4-1-4 0-7 1-10z" fill="#f77f00" ${sw}/><path d="M16 19c1 2 4 3 4 6a4 4 0 0 1-8 0c0-2 2-3 4-6z" fill="#ffd166"/>`,
  anger: `<path d="M5 12c4 0 7-3 7-7M20 5c0 4 3 7 7 7M27 20c-4 0-7 3-7 7M12 27c0-4-3-7-7-7" fill="none" stroke="#e53935" stroke-width="4.2" stroke-linecap="round"/>`,
  smile: `<circle cx="16" cy="16" r="12" fill="#ffd166" ${sw}/><circle cx="12" cy="13" r="1.8" fill="${O}"/><circle cx="20" cy="13" r="1.8" fill="${O}"/><path d="M10 18c2 4 10 4 12 0" fill="none" ${sw}/>`,
  peanut: `<path d="M12 6a6 6 0 0 1 8 8 6 6 0 1 1-8 8 6 6 0 0 1-8-8 6 6 0 0 1 8-8z" fill="#d9a066" ${sw}/>`,
};

export function iconSVG(name, size = 24, extra = '') {
  const body = ICONS[name] || ICONS.warning;
  return `<svg class="ico ico-${name}" ${extra} width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;
}
export const iconHTML = iconSVG;

/** product icon (colored glass/bottle/food) */
export function itemIconHTML(p, size = 24) {
  if (!p) return iconSVG('warning', size);
  if (p.category === 'draft') {
    const liq = '#' + p.liquid.toString(16).padStart(6, '0');
    const foam = '#' + p.foam.toString(16).padStart(6, '0');
    const band = p.label?.bg || '#fff';
    return `<svg class="ico item" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 9h16l-1.8 19H9.8z" fill="${liq}" ${sw}/><path d="M7 9.5c0-4 4-5 6-3 1-3 6-3 7 0 3-1 5 1 4 3.5z" fill="${foam}" ${sw}/><rect x="10" y="16" width="12" height="5" rx="1" fill="${band}" stroke="${O}" stroke-width="1.4"/><path d="M11 12l.6 12" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/></svg>`;
  }
  if (p.category === 'bottle' || p.category === 'soft') {
    const spec = p.bottle || {};
    const glass = '#' + ((spec.can ? p.color : spec.glass) ?? 0x6b4a1a).toString(16).padStart(6, '0');
    const label = p.label?.bg || (p.color ? '#' + p.color.toString(16).padStart(6, '0') : '#fff');
    if (spec.can) return `<svg class="ico item" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><rect x="9" y="5" width="14" height="23" rx="3" fill="${glass}" ${sw}/><path d="M9 11h14M9 22h14" stroke="#fff" stroke-width="2"/><rect x="11" y="3" width="10" height="3" rx="1" fill="#d6dde3" ${sw}/></svg>`;
    return `<svg class="ico item" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><path d="M13 3h6v6l3 4v15a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V13l3-4z" fill="${glass}" ${sw}/><rect x="10" y="16" width="12" height="7" fill="${label}" stroke="${O}" stroke-width="1.4"/>${spec.lime ? `<circle cx="16" cy="4" r="3" fill="#7ac943" ${sw}/>` : ''}</svg>`;
  }
  // food
  const map = {
    saucisson: `<ellipse cx="16" cy="22" rx="13" ry="5" fill="#f4efe6" ${sw}/><circle cx="10" cy="18" r="4.2" fill="#a8302c" ${sw}/><circle cx="17" cy="16" r="4.2" fill="#a8302c" ${sw}/><circle cx="23" cy="19" r="4.2" fill="#a8302c" ${sw}/><circle cx="17" cy="16" r="1" fill="#fff"/><circle cx="10" cy="18" r="1" fill="#fff"/>`,
    cacahuetes: `<path d="M4 17h24a12 9 0 0 1-24 0z" fill="#d9a066" ${sw}/><circle cx="11" cy="15" r="3" fill="#c8894d" ${sw}/><circle cx="17" cy="13" r="3" fill="#c8894d" ${sw}/><circle cx="22" cy="15.5" r="3" fill="#c8894d" ${sw}/>`,
    olives: `<path d="M4 17h24a12 9 0 0 1-24 0z" fill="#f0e6d6" ${sw}/><ellipse cx="11" cy="14.5" rx="3.4" ry="2.6" fill="#6b8e23" ${sw}/><ellipse cx="18" cy="13" rx="3.4" ry="2.6" fill="#333" ${sw}/><ellipse cx="22" cy="15.5" rx="3.4" ry="2.6" fill="#6b8e23" ${sw}/>`,
    planche: `<rect x="2" y="15" width="28" height="10" rx="3" fill="#c28a55" ${sw}/><path d="M6 15l5-6 5 6z" fill="#f3cf63" ${sw}/><circle cx="21" cy="13" r="3.5" fill="#e68a8a" ${sw}/><circle cx="26" cy="14" r="2.6" fill="#a8302c" ${sw}/>`,
    cafe: `<ellipse cx="16" cy="25" rx="12" ry="4" fill="#f4efe6" ${sw}/><path d="M8 11h14v8a7 6 0 0 1-14 0z" fill="#fff" ${sw}/><ellipse cx="15" cy="11" rx="7" ry="2" fill="#4a250f"/><path d="M22 13h2a3 3 0 0 1 0 6h-2" fill="none" ${sw}/><path d="M12 7c0-2 2-2 2-4M17 7c0-2 2-2 2-4" stroke="#d6c3a1" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    croque: `<ellipse cx="16" cy="23" rx="13" ry="5" fill="#f4efe6" ${sw}/><rect x="7" y="10" width="18" height="11" rx="3" fill="#d9a35a" ${sw}/><path d="M7 15h18" stroke="#f5d36a" stroke-width="3"/>`,
  };
  return `<svg class="ico item" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">${map[p.id] || ICONS.food}</svg>`;
}
