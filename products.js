// Non-beer products (softs + food) and the unified product catalog.
import { BEERS } from './beers.js';

export const SOFTS = [
  {
    id: 'kolaka', name: 'Kolaka', short: 'Kolaka', styleLabel: 'Cola bien frais', kegSize: 12, packCost: 9, basePrice: 3,
    level: 1, liquid: 0x3a1608, color: 0xd62828, bottle: { glass: 0x6b1d12, can: true }, desc: 'Le cola du bar. Pour ceux qui conduisent… ou qui font semblant.',
  },
  {
    id: 'diabolo', name: 'Diabolo menthe', short: 'Diabolo', styleLabel: 'Limonade + sirop menthe', kegSize: 12, packCost: 7, basePrice: 3,
    level: 2, liquid: 0x52c46a, color: 0x2bb673, bottle: { glass: 0xbfeccf }, desc: 'Le grand classique vert fluo des terrasses.',
  },
  {
    id: 'pulpeo', name: 'Pulpéo', short: 'Pulpéo', styleLabel: 'Orange pétillante', kegSize: 12, packCost: 11, basePrice: 3.5,
    level: 2, liquid: 0xf28c28, color: 0xf28c28, bottle: { glass: 0xf6a64b, round: true }, desc: 'La petite bouteille ronde qu’on secoue.',
  },
];

// station: which food station prepares it. pack = unit bought from suppliers
export const FOODS = [
  {
    id: 'saucisson', name: 'Assiette de saucisson', short: 'Saucisson', station: 'board', prepTime: 2.0, kegSize: 6,
    packLabel: 'saucisson entier', packCost: 7, basePrice: 6, level: 1, popularity: 1, desc: 'Coupé à la main sur la planche. Le roi de l’apéro.',
  },
  {
    id: 'cacahuetes', name: 'Bol de cacahuètes', short: 'Cacahuètes', station: 'snack', prepTime: 0.5, kegSize: 10,
    packLabel: 'sachet', packCost: 4, basePrice: 2.5, level: 1, popularity: 0.8, desc: 'Salées. Donnent soif. C’est le but.',
  },
  {
    id: 'olives', name: 'Bol d’olives', short: 'Olives', station: 'snack', prepTime: 0.5, kegSize: 8,
    packLabel: 'pot', packCost: 6, basePrice: 3.5, level: 2, popularity: 0.6, desc: 'Vertes et noires, avec un pique.',
  },
  {
    id: 'planche', name: 'Planche apéro', short: 'Planche', station: 'board', prepTime: 4.5, kegSize: 1,
    packLabel: 'kit charcuterie-fromage', packCost: 4.5, basePrice: 14, level: 2, popularity: 0.75, requires: 'planche_station',
    desc: 'Charcuterie, fromage, cornichons. Longue à préparer, énorme marge, à partager.',
  },
  {
    id: 'croque', name: 'Croque-monsieur', short: 'Croque', station: 'board', prepTime: 3.5, kegSize: 4,
    packLabel: 'lot de 4', packCost: 6, basePrice: 7, level: 4, popularity: 0.7, requires: 'toaster',
    desc: 'Jambon, fromage, grillé minute. Les affamés de minuit en raffolent.',
  },
  {
    id: 'cafe', name: 'Café serré', short: 'Café', station: 'board', prepTime: 1.8, kegSize: 20,
    packLabel: 'paquet de 20 doses', packCost: 6, basePrice: 2.5, level: 2, popularity: 0.55, requires: 'cafetiere',
    desc: 'Un petit noir pour finir la soirée. Les couples et les habitués adorent.',
  },
];

/** Unified catalog: id -> product */
export function buildProducts() {
  const map = new Map();
  for (const b of BEERS) {
    map.set(b.id, {
      ...b,
      kind: 'beer',
      category: b.serve === 'tap' ? 'draft' : 'bottle',
      source: b.serve === 'tap' ? 'tap' : 'fridge',
      packLabel: b.serve === 'tap' ? `fût de ${b.kegSize} pintes` : `caisse de ${b.kegSize}`,
      storage: b.serve === 'tap' ? 2 : 1,
      unitCost: b.packCost / b.kegSize,
    });
  }
  for (const s of SOFTS) {
    map.set(s.id, { ...s, kind: 'soft', category: 'soft', source: 'fridge', style: 'soft', quality: 3, popularity: 0.5, drinkTime: 0.8, packLabel: `pack de ${s.kegSize}`, storage: 1, unitCost: s.packCost / s.kegSize, tags: ['soft'] });
  }
  for (const f of FOODS) {
    map.set(f.id, { ...f, kind: 'food', category: 'food', source: f.station, style: 'food', quality: 3, storage: f.kegSize >= 6 ? 1 : 0.5, unitCost: f.packCost / f.kegSize, tags: ['food'] });
  }
  return map;
}
