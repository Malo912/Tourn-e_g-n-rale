// Service mini-game tuning: pour profiles per beer style, quality levels and their effects.

// flow    : fill speed (glass/second) with the tap fully open
// zone    : ideal tap opening [lo, hi] (0..1) shown on the DÉBIT gauge
// foam    : base share of poured beer that turns into foam
// foamBand: ideal foam share of the finished pint
// tiltW   : how much a wrong glass angle creates foam
// par     : time (s) for a pint to still count as "fast"
// rest    : stout two-part pour (fill, let it settle, top up)
export const POUR_PROFILES = {
  lager: { flow: 0.52, zone: [0.42, 0.86], foam: 0.13, overK: 0.6, foamBand: [0.06, 0.17], tiltW: 0.6, par: 4.0, hint: 'Facile : débit rapide, peu de mousse.' },
  cheap: { flow: 0.56, zone: [0.4, 0.9], foam: 0.12, overK: 0.5, foamBand: [0.05, 0.17], tiltW: 0.5, par: 3.8, hint: 'Ça coule tout seul.' },
  pils: { flow: 0.5, zone: [0.45, 0.82], foam: 0.14, overK: 0.8, foamBand: [0.07, 0.17], tiltW: 0.8, par: 4.0, hint: 'Une belle mousse fine au sommet.' },
  ambree: { flow: 0.46, zone: [0.45, 0.8], foam: 0.14, overK: 0.9, foamBand: [0.07, 0.16], tiltW: 0.9, par: 4.1, hint: 'Régulier et sans à-coups.' },
  local: { flow: 0.44, zone: [0.45, 0.76], foam: 0.15, overK: 1.0, foamBand: [0.07, 0.16], tiltW: 1.0, par: 4.2, hint: 'Artisanale : un peu vive.' },
  abbaye: { flow: 0.43, zone: [0.46, 0.76], foam: 0.16, overK: 1.0, foamBand: [0.08, 0.17], tiltW: 1.1, par: 4.3, hint: 'Dans un calice, doucement.' },
  ipa: { flow: 0.42, zone: [0.5, 0.72], foam: 0.15, overK: 1.5, foamBand: [0.07, 0.14], tiltW: 1.2, par: 4.4, hint: 'Mousse explosive : restez dans la zone étroite !' },
  blanche: { flow: 0.42, zone: [0.44, 0.74], foam: 0.2, overK: 1.1, foamBand: [0.1, 0.2], tiltW: 2.6, par: 4.4, hint: 'Gardez le verre bien incliné, redressez tard !' },
  weiss: { flow: 0.4, zone: [0.44, 0.72], foam: 0.21, overK: 1.2, foamBand: [0.1, 0.21], tiltW: 2.8, par: 4.6, hint: 'Weissbier : inclinaison cruciale.' },
  belge: { flow: 0.4, zone: [0.5, 0.68], foam: 0.18, overK: 1.5, foamBand: [0.09, 0.17], tiltW: 1.5, par: 4.6, hint: 'Très capricieuse. Zone minuscule.' },
  aromatisee: { flow: 0.45, zone: [0.4, 0.8], foam: 0.19, overK: 1.0, foamBand: [0.09, 0.2], tiltW: 1.0, par: 4.2, hint: 'Fruitée et pétillante : la mousse monte vite.' },
  trappiste: { flow: 0.36, zone: [0.5, 0.66], foam: 0.2, overK: 1.4, foamBand: [0.1, 0.18], tiltW: 1.7, par: 4.9, hint: 'Bière rare : zone minuscule, inclinaison exigeante.' },
  stout: { flow: 0.34, zone: [0.32, 0.62], foam: 0.13, overK: 1.0, foamBand: [0.06, 0.13], tiltW: 0.8, par: 6.5, rest: true, hint: 'Remplir aux ¾, laisser reposer, puis compléter.' },
};

export function pourProfile(beer) {
  return POUR_PROFILES[beer.style] || POUR_PROFILES.lager;
}

export const QUALITY = {
  perfect: { label: 'PARFAIT !', sat: 6, tip: 0.05, combo: 1, color: '#ffd166', icon: 'star' },
  good: { label: 'Bien', sat: 1.5, tip: 0.01, combo: 0, color: '#9ff0a0', icon: 'check' },
  average: { label: 'Moyen', sat: -3, tip: 0, combo: -1, color: '#ffcf8a', icon: 'warning' },
  bad: { label: 'Raté…', sat: -8, tip: 0, combo: -1, color: '#ff9a8a', icon: 'cross' },
  catastrophe: { label: 'CATASTROPHE !', sat: 0, tip: 0, combo: -1, color: '#ff5a4f', icon: 'anger' },
};

// product-specific result wording
export const RESULT_TEXT = {
  draft: { perfect: 'PINTE PARFAITE !', good: 'Bonne pinte', average: 'Pinte moyenne', bad: 'Pinte ratée…', catastrophe: 'CATASTROPHE !' },
  saucisson: { perfect: 'DÉCOUPE DE CHEF !', good: 'Belles tranches', average: 'Tranches irrégulières', bad: 'Massacre de saucisson…' },
  planche: { perfect: 'PLANCHE DE CONCOURS !', good: 'Jolie planche', average: 'Planche un peu brouillon', bad: 'Planche catastrophique…' },
  bottle: { perfect: 'POP PARFAIT !', good: 'Décapsulée', average: 'Ça mousse partout !', bad: 'Geyser !' },
  soft: { perfect: 'PILE AU TRAIT !', good: 'Bien servi', average: 'Un peu à côté', bad: 'Ça déborde…' },
  cafe: { perfect: 'SERRÉ PARFAIT !', good: 'Bon café', average: 'Un peu fade', bad: 'Jus de chaussette…' },
  croque: { perfect: 'DORÉ À POINT !', good: 'Bien grillé', average: 'Un peu pâle', bad: 'Carbonisé…' },
};

/** quality distribution for an employee producing an item (0..100 skill) */
export function staffQuality(skill, rng) {
  const s = Math.max(0, Math.min(100, skill));
  const pPerfect = Math.max(0.02, (s - 45) / 70);
  const pBad = Math.max(0.01, (60 - s) / 260);
  const pAvg = Math.max(0.04, (75 - s) / 140);
  const r = rng.next();
  if (r < pPerfect) return 'perfect';
  if (r < pPerfect + pBad) return 'bad';
  if (r < pPerfect + pBad + pAvg) return 'average';
  return 'good';
}
