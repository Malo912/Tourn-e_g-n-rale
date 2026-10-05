// Planned evening events (chosen during preparation) + weather.
// effects:
//   arrival: global multiplier; window: [fromMin, toMin, mult] extra multiplier during a time window
//   types: customer type weight multipliers; styles: beer style/tag demand multipliers
//   priceCut: {category, mult, from, to}; rounds: extra rounds; rep: reputation bonus at the end
export const EVENTS = [
  {
    id: 'happyhour', name: 'Happy Hour', level: 2, cost: 0, icon: 'clock',
    desc: 'De 18 h à 20 h, −30 % sur la pression. Du monde tôt, des marges plus faibles.',
    effects: { arrival: 1.1, window: [18 * 60, 20 * 60, 2.2], priceCut: { category: 'draft', mult: 0.7, from: 18 * 60, to: 20 * 60 }, rep: 1 },
  },
  {
    id: 'match', name: 'Soirée match', level: 2, cost: 25, icon: 'ball', requires: 'tv', fixture: true,
    desc: 'Retransmission du match. Les supporters débarquent en masse vers 21 h. Prévoyez beaucoup de blonde !',
    effects: { arrival: 1.5, window: [20 * 60 + 30, 23 * 60, 2.0], types: { sportif: 5, amis: 1.4 }, styles: { lager: 1.5, pils: 1.4, cheap: 1.2 }, rep: 1.5, goals: true },
  },
  {
    id: 'etudiante', name: 'Soirée étudiante', level: 2, cost: 60, icon: 'party',
    desc: 'Flyers distribués à la fac. Une marée d’étudiants, de la bière pas chère qui coule à flots… et des verres renversés.',
    effects: { arrival: 1.7, types: { etudiant: 6 }, styles: { cheap: 1.9, aromatisee: 2.2 }, spills: 2.5, rep: 1 },
  },
  {
    id: 'quiz', name: 'Soirée quiz', level: 3, cost: 40, icon: 'quiz',
    desc: 'Questions de culture générale entre deux pintes. Les groupes restent plus longtemps.',
    effects: { arrival: 1.25, types: { amis: 3, couple: 1.6 }, rounds: 1, rep: 2 },
  },
  {
    id: 'flechettes', name: 'Tournoi de fléchettes', level: 3, cost: 50, icon: 'darts', requires: 'flechettes',
    desc: 'Tournoi sur votre cible. Habitués et sportifs se défient toute la soirée.',
    effects: { arrival: 1.35, types: { amis: 2, sportif: 2, habitue: 1.8 }, rounds: 1, rep: 1.5 },
  },
  {
    id: 'annees80', name: 'Soirée années 80', level: 3, cost: 70, icon: 'disco',
    desc: 'Tubes d’époque et néons. Les habitués et les couples adorent.',
    effects: { arrival: 1.45, types: { habitue: 2, couple: 2.2 }, rep: 2, music: 'disco' },
  },
  {
    id: 'oktoberfest', name: 'Oktoberfest', level: 4, cost: 120, icon: 'pretzel',
    desc: 'Lederhosen, chopes et saucisses. Les weissbiers et les gros buveurs déferlent.',
    effects: { arrival: 1.8, types: { gros_buveur: 3, amis: 2 }, styles: { weiss: 3.5, lager: 1.4 }, food: { saucisson: 2 }, rep: 2.5 },
  },
  {
    id: 'karaoke', name: 'Karaoké', level: 4, cost: 80, icon: 'mic',
    desc: 'Micro ouvert. Ça chante faux, ça boit beaucoup, ça s’amuse énormément.',
    effects: { arrival: 1.5, types: { amis: 2.5, etudiant: 1.5 }, drunk: 1.8, rep: 2 },
  },
];

export const WEATHERS = [
  { id: 'doux', name: 'Temps doux', icon: 'cloudsun', arrival: 1, styles: {} },
  { id: 'chaud', name: 'Grosse chaleur', icon: 'sun', arrival: 1.2, styles: { blanche: 1.6, lager: 1.3, soft: 1.6, pils: 1.3, stout: 0.6 } },
  { id: 'pluie', name: 'Pluie battante', icon: 'rain', arrival: 0.82, styles: { stout: 1.5, abbaye: 1.3, ambree: 1.3 } },
  { id: 'froid', name: 'Froid de canard', icon: 'snow', arrival: 0.9, styles: { stout: 1.7, ambree: 1.5, trappiste: 1.4, blanche: 0.6 } },
];

// Chaos moments during the night ("rushes"): announced a few in-game minutes ahead, then a flood of customers.
//   announce: banner text ({m} = minutes left); go: banner at the start; type: customer type that floods in
//   mult: arrival multiplier while live (+150 % = 2.5); dur: length in in-game minutes; burst: groups arriving at once
export const RUSHES = [
  { id: 'match', announce: 'MATCH DANS {m} MIN !', go: 'COUP D’ENVOI !', sub: 'Les supporters envahissent le bar', type: 'sportif', icon: 'ball', mult: 2.6, dur: 75, burst: 3, special: true },
  { id: 'evg', announce: 'UN ENTERREMENT DE VIE DE GARÇON DANS {m} MIN !', go: 'L’EVG DÉBARQUE !', sub: 'Une bande déchaînée réclame des tournées', type: 'amis', icon: 'party', mult: 2.4, dur: 55, burst: 2 },
  { id: 'partiels', announce: 'FIN DES PARTIELS DANS {m} MIN !', go: 'LES ÉTUDIANTS DÉFERLENT !', sub: 'Ils ont soif et pas beaucoup de sous', type: 'etudiant', icon: 'party', mult: 2.5, dur: 55, burst: 3 },
  { id: 'touristes', announce: 'UN CAR DE TOURISTES DANS {m} MIN !', go: 'LES TOURISTES DÉBARQUENT !', sub: 'Ils veulent goûter toutes les bières', type: 'touriste', icon: 'people', mult: 2.3, dur: 50, burst: 3, level: 2 },
  { id: 'concert', announce: 'FIN DU CONCERT D’À CÔTÉ DANS {m} MIN !', go: 'LA SALLE DE CONCERT SE VIDE !', sub: 'Tout le public vient finir la soirée chez vous', type: 'amis', icon: 'music', mult: 2.5, dur: 60, burst: 3, level: 2 },
];
export const RUSH_ANNOUNCE = 14; // in-game minutes of warning (~10 s)
