// Equipment & improvements bought from the "Améliorations" panel.
// tiers: each purchase moves to the next tier. `apply` effects are read by the simulation via game.up(id).
export const UPGRADES = [
  {
    id: 'tap', name: 'Tireuse supplémentaire', cat: 'bar', icon: 'tap',
    desc: 'Une tireuse de plus sur le comptoir = une bière pression de plus à la carte.',
    tiers: [
      { price: 380, level: 1, label: '2e tireuse' },
      { price: 650, level: 2, label: '3e tireuse' },
      { price: 950, level: 2, label: '4e tireuse' },
      { price: 1400, level: 3, label: '5e tireuse' },
      { price: 2000, level: 4, label: '6e tireuse' },
    ],
  },
  {
    id: 'stools', name: 'Tabouret de bar', cat: 'bar', icon: 'stool',
    desc: 'Une place au comptoir. Servie directement derrière le bar : super rapide.',
    tiers: [45, 50, 55, 60, 70, 80, 90].map((p, i) => ({ price: p, level: i < 4 ? 1 : 2, label: `Tabouret n°${i + 3}` })),
  },
  {
    id: 'glasses', name: 'Lot de 12 verres', cat: 'bar', icon: 'glass', repeatable: true,
    desc: 'Plus de verres propres = moins d’allers-retours au lave-verres pendant le rush.',
    tiers: [{ price: 35, level: 1 }],
  },
  {
    id: 'snack', name: 'Bocal à grignotages', cat: 'cuisine', icon: 'jar',
    desc: 'Débloque les cacahuètes (et les olives au niveau 2). Service instantané, donne soif.',
    tiers: [{ price: 70, level: 1 }],
  },
  {
    id: 'planche_station', name: 'Plan de travail à planches', cat: 'cuisine', icon: 'board',
    desc: 'Débloque la planche apéro : longue à préparer, énorme marge.',
    tiers: [{ price: 380, level: 2 }],
  },
  {
    id: 'toaster', name: 'Toaster à croques', cat: 'cuisine', icon: 'toaster',
    desc: 'Débloque les croque-monsieur. Les affamés de minuit vont adorer.',
    tiers: [{ price: 520, level: 4 }],
  },
  {
    id: 'cafetiere', name: 'Machine à expresso', cat: 'cuisine', icon: 'clock',
    desc: 'Débloque le café serré : petite marge, mais les couples et les habitués en redemandent. Mini-jeu : arrêter l’extraction pile au trait.',
    tiers: [{ price: 290, level: 2 }],
  },
  {
    id: 'tray', name: 'Plateau de service', cat: 'service', icon: 'tray',
    desc: 'Porter plus de commandes à la fois.',
    tiers: [
      { price: 160, level: 1, label: '3 articles', value: 3 },
      { price: 420, level: 2, label: '4 articles', value: 4 },
      { price: 850, level: 3, label: '6 articles', value: 6 },
    ],
  },
  {
    id: 'shoes', name: 'Baskets de course', cat: 'service', icon: 'shoe',
    desc: 'Le patron se déplace plus vite.',
    tiers: [
      { price: 120, level: 1, label: '+15 % vitesse', value: 1.15 },
      { price: 380, level: 2, label: '+30 % vitesse', value: 1.3 },
    ],
  },
  {
    id: 'multiTap', name: 'Tireuse multi-becs', cat: 'bar', icon: 'tap',
    desc: 'Remplir plusieurs pintes de la même bière en un seul tirage. Le mini-jeu gère tous les verres à la fois.',
    tiers: [
      { price: 340, level: 2, label: 'Tireuse double : 2 pintes', value: 2 },
      { price: 980, level: 3, label: 'Tireuse quadruple : 4 pintes', value: 4 },
    ],
  },
  {
    id: 'fastTap', name: 'Tireuse professionnelle', cat: 'bar', icon: 'bolt',
    desc: 'Robinet plus progressif : la zone de débit idéale et la tolérance au trait sont plus larges. Pintes parfaites plus faciles.',
    tiers: [
      { price: 260, level: 1, label: 'Zone idéale +35 %', value: 1.35 },
      { price: 720, level: 3, label: 'Zone idéale +70 %', value: 1.7 },
    ],
  },
  {
    id: 'cooling', name: 'Refroidissement amélioré', cat: 'bar', icon: 'snow',
    desc: 'Bière plus fraîche : elle coule plus vite, mousse moins, plaît davantage, et les tireuses tombent bien moins en panne.',
    tiers: [{ price: 420, level: 2 }],
  },
  {
    id: 'precision', name: 'Bec haute précision', cat: 'bar', icon: 'tap',
    desc: 'Contrôle fin de la mousse : −30 % de mousse parasite et une marge de mousse idéale plus large. Indispensable pour les IPA et les blanches.',
    tiers: [{ price: 480, level: 2 }],
  },
  {
    id: 'barkit', name: 'Kit du barman', cat: 'service', icon: 'bottle',
    desc: 'Décapsuleur mural et doseur : les bouteilles et les softs se servent presque à coup sûr.',
    tiers: [{ price: 140, level: 1 }],
  },
  {
    id: 'knife', name: 'Couteau de chef', cat: 'cuisine', icon: 'food',
    desc: 'Lame affûtée : découpe du saucisson plus tolérante et un peu plus de temps pour dresser les planches.',
    tiers: [{ price: 180, level: 1 }],
  },
  {
    id: 'dishwasher', name: 'Lave-verres pro', cat: 'bar', icon: 'wash',
    desc: 'Lave plus vite et plus de verres à la fois.',
    tiers: [
      { price: 260, level: 1, label: 'Cycle 5 s, 20 verres', value: { time: 5, cap: 20 } },
      { price: 640, level: 3, label: 'Cycle 3 s, 30 verres', value: { time: 3, cap: 30 } },
    ],
  },
  {
    id: 'fridgeXL', name: 'Frigo plus grand', cat: 'stock', icon: 'fridge',
    desc: 'Plus de bouteilles au frais derrière le bar.',
    tiers: [
      { price: 300, level: 1, label: '36 bouteilles', value: 36 },
      { price: 700, level: 3, label: '56 bouteilles', value: 56 },
    ],
  },
  {
    id: 'reserve', name: 'Réserve agrandie', cat: 'stock', icon: 'box',
    desc: 'Plus de place pour stocker fûts, caisses et nourriture.',
    tiers: [
      { price: 260, level: 1, label: '40 places', value: 40 },
      { price: 620, level: 2, label: '60 places', value: 60 },
      { price: 1250, level: 3, label: '90 places', value: 90 },
    ],
  },
  {
    id: 'sign', name: 'Enseigne lumineuse', cat: 'salle', icon: 'sign',
    desc: 'Le bar se voit de loin : +12 % de passage chaque soir.',
    tiers: [{ price: 280, level: 1 }],
  },
  {
    id: 'terrasse', name: 'Terrasse', cat: 'salle', icon: 'sun',
    desc: '3 tables sur le trottoir avec parasols. Un carton par grosse chaleur, fermée quand il pleut ou qu’il gèle.',
    tiers: [{ price: 1300, level: 3 }],
  },
  {
    id: 'room', name: 'Agrandir la salle', cat: 'salle', icon: 'expand',
    desc: 'Abattre un mur et récupérer le local d’à côté. Le loyer augmente.',
    tiers: [
      { price: 2400, level: 3, label: 'Salle 15 × 9 m (loyer +25 €)', value: 1 },
      { price: 4800, level: 4, label: 'Salle 15 × 11,5 m (loyer +35 €)', value: 2 },
    ],
  },
];

export const UPGRADE_CATS = [
  { id: 'bar', label: 'Bar' },
  { id: 'service', label: 'Service' },
  { id: 'cuisine', label: 'Cuisine' },
  { id: 'stock', label: 'Stockage' },
  { id: 'salle', label: 'Salle' },
];

export const SUPPLIERS = [
  { id: 'megadis', name: 'Mégadis Gros', desc: 'Grossiste : −20 % mais par lots de 5. Livré avant l’ouverture.', priceMult: 0.8, qty: 5, when: 'prep' },
  { id: 'depot', name: 'Le Dépôt du coin', desc: 'Prix normal, à l’unité. Livré avant l’ouverture.', priceMult: 1.0, qty: 1, when: 'prep' },
  { id: 'eclair', name: 'Livraison Éclair', desc: '+45 %, livré en ~20 s même en plein service. Le sauveur des ruptures.', priceMult: 1.45, qty: 1, when: 'always' },
  { id: 'moines', name: 'Cave des Moines', desc: 'Fournisseur premium : seul à proposer les bières rares. Un peu plus cher.', priceMult: 1.1, qty: 1, when: 'prep', premium: true },
];

// Rare products only sold by the premium supplier
export const PREMIUM_ONLY = ['chimere', 'mousseducoin', 'pauleiner'];
