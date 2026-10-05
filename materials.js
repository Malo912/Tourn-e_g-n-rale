// Shared palette and materials.
import { Material } from '../engine/scene.js';

export const PAL = {
  woodDark: 0x4a2a18,
  woodMid: 0x7a4628,
  woodWarm: 0x9a5e34,
  woodLight: 0xc28a55,
  woodRed: 0x6e2a1a,
  oak: 0xb07a45,
  brass: 0xd9a441,
  brassDark: 0xa8782a,
  chrome: 0xd6dde3,
  steel: 0x8e99a3,
  black: 0x1d1714,
  cream: 0xf3e2c0,
  white: 0xf7f2ea,
  burgundy: 0x7d1f2b,
  bottle: 0x2e6b3a,
  wallGreen: 0x2f5d50,
  slate: 0x2a3330,
  leather: 0x8b2f22,
  leatherDark: 0x5e1d16,
  marble: 0xe9e2d6,
  plant: 0x4f9a45,
  plantDark: 0x2f6e33,
  terracotta: 0xc0643c,
  red: 0xd64545,
  teal: 0x2bb3a3,
  amber: 0xf5a524,
};

export const MATS = {
  vc: new Material({ toon: 0.85, rim: 0.22 }),
  vcSoft: new Material({ toon: 0.55, rim: 0.3 }),
  vcShiny: new Material({ toon: 0.85, rim: 0.35, spec: 0.55 }),
  glass: new Material({ color: 0xdff3ff, opacity: 0.32, rim: 1.1, spec: 0.9, toon: 0.4, transparent: true, depthWrite: false }),
  glassDouble: new Material({ color: 0xdff3ff, opacity: 0.28, rim: 1.0, spec: 0.9, toon: 0.4, transparent: true, depthWrite: false, doubleSided: true }),
  fridgeGlass: new Material({ color: 0xcfe9ff, opacity: 0.22, rim: 0.9, spec: 0.8, toon: 0.4, transparent: true, depthWrite: false, emissive: 0x2a5070, emissiveIntensity: 0.25 }),
  unlit: new Material({ unlit: true }),
  black: new Material({ color: 0x14100e, toon: 1, rim: 0 }),
};

const liquidCache = new Map();
export function liquidMat(hex) {
  if (!liquidCache.has(hex)) liquidCache.set(hex, new Material({ color: hex, toon: 0.6, rim: 0.4, spec: 0.5, emissive: hex, emissiveIntensity: 0.08 }));
  return liquidCache.get(hex);
}
const colorCache = new Map();
export function colorMat(hex, o = {}) {
  const key = hex + JSON.stringify(o);
  if (!colorCache.has(key)) colorCache.set(key, new Material({ color: hex, ...o }));
  return colorCache.get(key);
}
export function texMat(tex, o = {}) {
  return new Material({ map: tex, ...o });
}
