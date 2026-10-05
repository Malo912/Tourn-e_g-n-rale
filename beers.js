// Fictional beer brands. Each one winks at a real-life style/brand without copying its name, logo or packaging.
// Add a beer: append an entry. `serve: 'tap'` -> sold in kegs and poured at a tireuse; `serve: 'bottle'` -> fridge.
//
// kegSize  : pints per keg (tap) or bottles per crate (bottle)
// packCost : price of one keg / crate at the standard supplier
// basePrice: "fair" selling price customers expect for one serving
// quality  : 1..5, matters a lot for picky customers
// popularity: 0..1 base appeal; drinkTime: >1 means sipped slower (strong beers)

export const BEERS = [
  {
    id: 'kronfeld', name: 'Kronfeld 1866', short: 'Kronfeld', style: 'lager', styleLabel: 'Lager blonde',
    serve: 'tap', kegSize: 30, packCost: 42, basePrice: 5, quality: 2, popularity: 1.0, drinkTime: 1,
    liquid: 0xf2b01e, foam: 0xfff6e2, level: 1, tags: ['classic'],
    label: { bg: '#1f3c88', fg: '#f6d365', accent: '#f6d365', initial: 'K', motif: 'crown' }, handle: 0x1f3c88,
    tagline: 'La blonde du comptoir', desc: 'La blonde de comptoir par excellence. Pas chère, pas prétentieuse, tout le monde en boit.',
  },
  {
    id: 'kanterbock', name: 'Kanterbock Éco', short: 'Kanterbock', style: 'cheap', styleLabel: 'Blonde premier prix',
    serve: 'tap', kegSize: 30, packCost: 26, basePrice: 3.5, quality: 1, popularity: 0.7, drinkTime: 0.9,
    liquid: 0xf6c94a, foam: 0xfffbea, level: 1, tags: ['cheap'],
    label: { bg: '#ffd400', fg: '#d62828', accent: '#d62828', initial: 'K€', initialSize: 96 }, handle: 0xffd400,
    tagline: 'Le prix avant tout', desc: 'Très bon marché, goût… discutable. Les étudiants l’adorent, les connaisseurs fuient.',
  },
  {
    id: 'heinberg', name: 'Heinberg', short: 'Heinberg', style: 'lager', styleLabel: 'Lager premium',
    serve: 'tap', kegSize: 30, packCost: 60, basePrice: 6, quality: 3, popularity: 0.95, drinkTime: 1,
    liquid: 0xf0b53a, foam: 0xfff8ea, level: 2, tags: ['classic', 'premium'],
    label: { bg: '#17713a', fg: '#ffffff', accent: '#e9f5ec', initial: 'H', motif: 'star' }, handle: 0x17713a,
    tagline: 'Verte et fraîche', desc: 'La lager premium « verte » qu’on trouve partout. Une valeur sûre, un peu plus chère.',
  },
  {
    id: 'dublinness', name: 'Dublinness', short: 'Dublinness', style: 'stout', styleLabel: 'Stout irlandaise',
    serve: 'tap', kegSize: 30, packCost: 78, basePrice: 7, quality: 4, popularity: 0.75, drinkTime: 1.15,
    liquid: 0x170c07, foam: 0xf1e2c0, level: 2, tags: ['dark', 'irish'],
    label: { bg: '#121212', fg: '#f1e2c0', accent: '#c9a45c', initial: 'D' }, handle: 0x121212,
    tagline: 'Noire, crémeuse, irlandaise', desc: 'Stout noire à la mousse crémeuse. Les amateurs ne jurent que par elle.',
  },
  {
    id: 'hoeghaven', name: 'Hoeghaven', short: 'Hoeghaven', style: 'blanche', styleLabel: 'Bière blanche',
    serve: 'tap', kegSize: 30, packCost: 66, basePrice: 6.5, quality: 3, popularity: 0.8, drinkTime: 1,
    liquid: 0xf2d886, foam: 0xffffff, level: 2, tags: ['wheat', 'summer'],
    label: { bg: '#d6e8f7', fg: '#2b5d9e', accent: '#2b5d9e', initial: 'H', motif: 'wheat' }, handle: 0xd6e8f7,
    tagline: 'Blanche, trouble et fière', desc: 'Blanche belge trouble aux notes d’agrumes. Parfaite les soirs de chaleur.',
  },
  {
    id: 'pelfjord', name: 'Pelfjord', short: 'Pelfjord', style: 'ambree', styleLabel: 'Ambrée du Nord',
    serve: 'tap', kegSize: 30, packCost: 64, basePrice: 6.5, quality: 3, popularity: 0.65, drinkTime: 1.05,
    liquid: 0xa5461a, foam: 0xfdf0dc, level: 2, tags: ['amber'],
    label: { bg: '#7a3b12', fg: '#ffcf7a', accent: '#ffcf7a', initial: 'P' }, handle: 0x7a3b12,
    tagline: 'L’ambrée du Nord', desc: 'Ambrée ronde et caramélisée, brassée « quelque part dans le Nord ».',
  },
  {
    id: 'stella', name: 'Stella Astrale', short: 'Stella A.', style: 'pils', styleLabel: 'Pils premium',
    serve: 'tap', kegSize: 30, packCost: 69, basePrice: 6.5, quality: 3, popularity: 0.9, drinkTime: 1,
    liquid: 0xf1bf3d, foam: 0xffffff, level: 3, tags: ['classic', 'premium'],
    label: { bg: '#fdfaf2', fg: '#b3122e', accent: '#c9a227', initial: 'S', motif: 'star' }, handle: 0xc9a227,
    tagline: 'La pils des grandes occasions', desc: 'Pils dorée « de prestige », servie dans un beau verre à pied.',
  },
  {
    id: 'chouette', name: 'La Chouette', short: 'Chouette', style: 'belge', styleLabel: 'Belge blonde forte',
    serve: 'tap', kegSize: 20, packCost: 72, basePrice: 8, quality: 5, popularity: 0.72, drinkTime: 1.35,
    liquid: 0xe5a136, foam: 0xfffaf0, level: 3, tags: ['belgian', 'strong'],
    label: { bg: '#f3e4c6', fg: '#c8102e', accent: '#3c7a3a', initial: 'C', motif: 'owl' }, handle: 0xc8102e,
    tagline: 'Forte comme un hibou', desc: 'Blonde belge forte et épicée, avec une chouette sur l’étiquette. Petit fût, grosse marge.',
  },
  {
    id: 'leffbaye', name: 'Leffbaye', short: 'Leffbaye', style: 'abbaye', styleLabel: 'Blonde d’abbaye',
    serve: 'tap', kegSize: 30, packCost: 84, basePrice: 7.5, quality: 4, popularity: 0.85, drinkTime: 1.2,
    liquid: 0xd88a22, foam: 0xfff3dc, level: 3, tags: ['belgian', 'abbey'],
    label: { bg: '#6d1a1f', fg: '#e8c872', accent: '#e8c872', initial: 'L' }, handle: 0x6d1a1f,
    tagline: 'Recette d’abbaye, ou presque', desc: 'Blonde d’abbaye ronde et fruitée, servie dans un calice.',
  },
  {
    id: 'punkypup', name: 'Punky Pup IPA', short: 'Punky Pup', style: 'ipa', styleLabel: 'IPA houblonnée',
    serve: 'tap', kegSize: 20, packCost: 74, basePrice: 8, quality: 4, popularity: 0.62, drinkTime: 1.1,
    liquid: 0xe2862a, foam: 0xfff7e6, level: 3, tags: ['craft', 'hoppy'],
    label: { bg: '#11a3a3', fg: '#111111', accent: '#ffffff', initial: 'P!' , initialSize: 100 }, handle: 0x11a3a3,
    tagline: 'Houblonnée et insolente', desc: 'IPA craft amère et fruitée. Adorée des amateurs, incomprise des autres.',
  },
  {
    id: 'mousseducoin', name: 'La Mousse du Coin', short: 'Mousse du Coin', style: 'local', styleLabel: 'Bière locale',
    serve: 'tap', kegSize: 20, packCost: 62, basePrice: 7, quality: 4, popularity: 0.65, drinkTime: 1.1,
    liquid: 0xc77b2c, foam: 0xfff3e0, level: 4, tags: ['local', 'craft'],
    label: { bg: '#2f5d3a', fg: '#f6ecd0', accent: '#f6ecd0', initial: 'M' }, handle: 0x2f5d3a,
    tagline: 'Brassée à deux rues d’ici', desc: 'Bière de la micro-brasserie du quartier. Les touristes en raffolent.',
  },
  {
    id: 'pauleiner', name: 'Pauleiner Weiss', short: 'Pauleiner', style: 'weiss', styleLabel: 'Weissbier bavaroise',
    serve: 'tap', kegSize: 30, packCost: 76, basePrice: 7, quality: 4, popularity: 0.7, drinkTime: 1.15,
    liquid: 0xeaa33c, foam: 0xffffff, level: 4, tags: ['german', 'wheat'],
    label: { bg: '#1b4f9c', fg: '#ffffff', accent: '#ffffff', initial: 'P' }, handle: 0x1b4f9c,
    tagline: 'Prost !', desc: 'Weissbier de Munich, star de l’Oktoberfest.',
  },
  {
    id: 'coronado', name: 'Coronado', short: 'Coronado', style: 'lager', styleLabel: 'Blonde mexicaine',
    serve: 'bottle', kegSize: 12, packCost: 15, basePrice: 5, quality: 2, popularity: 0.85, drinkTime: 0.9,
    liquid: 0xf5d36a, foam: 0xffffff, level: 1, tags: ['bottle', 'summer'], bottle: { glass: 0xf6f0d0, clear: true, lime: true },
    label: { bg: '#ffe066', fg: '#1d3f8f', accent: '#1d3f8f', initial: 'C', motif: 'crown' }, handle: 0xffe066,
    tagline: 'Avec un quartier de citron', desc: 'Bouteille transparente et rondelle de citron vert. Facile, rapide à servir.',
  },
  {
    id: 'desesperados', name: 'Desesperados', short: 'Desespe.', style: 'aromatisee', styleLabel: 'Bière aromatisée tequila',
    serve: 'bottle', kegSize: 12, packCost: 21, basePrice: 5.5, quality: 2, popularity: 0.75, drinkTime: 0.9,
    liquid: 0xf4c242, foam: 0xffffff, level: 3, tags: ['bottle', 'party'], bottle: { glass: 0x2f7d32 },
    label: { bg: '#1f7a33', fg: '#ffffff', accent: '#e63946', initial: 'D' }, handle: 0x1f7a33,
    tagline: 'Un goût de fiesta', desc: 'Bière aromatisée façon tequila. Carton plein en soirée étudiante.',
  },
  {
    id: 'chimere', name: 'Chimère Bleue', short: 'Chimère', style: 'trappiste', styleLabel: 'Trappiste brune',
    serve: 'bottle', kegSize: 12, packCost: 38, basePrice: 9.5, quality: 5, popularity: 0.5, drinkTime: 1.5,
    liquid: 0x5a2810, foam: 0xf3e3c6, level: 4, tags: ['bottle', 'belgian', 'rare'], bottle: { glass: 0x3a2412 },
    label: { bg: '#123a7a', fg: '#e9d9a6', accent: '#e9d9a6', initial: 'C', motif: 'crown' }, handle: 0x123a7a,
    tagline: 'Brassée par des moines rêveurs', desc: 'Trappiste brune rare et puissante. Clientèle exigeante, prix élevé.',
  },
];

for (const b of BEERS) {
  b.liquidCss = '#' + b.liquid.toString(16).padStart(6, '0');
  b.foamCss = '#' + b.foam.toString(16).padStart(6, '0');
}
