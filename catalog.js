// Buildable items. Floor items occupy a footprint on the 0.5 m grid; wall items hang on walls.
// seats: local positions (meters, relative to the footprint centre, before rotation) + facing yaw + pose.
// Gameplay stats:
//   comfort -> satisfaction bonus for customers seated there
//   decor   -> global decor score (reputation, base satisfaction)
//   fun     -> entertainment score (attracts groups/students/sportifs, longer stays)
//   ambiance-> music / atmosphere bonus
// Add an item: append here + (optionally) a model builder in world/models/furniture.js keyed by `model`.

const H = Math.PI / 2;

export const CATALOG = [
  // ---------------- tables
  {
    id: 'table_bancale', name: 'Table bancale', cat: 'tables', price: 60, level: 1, model: 'table2', variant: 'bancale',
    footprint: [4, 2], seats: [{ x: -0.6, z: 0, face: H }, { x: 0.6, z: 0, face: -H }], comfort: 0, decor: 0,
    desc: '2 places. Elle tient debout grâce à un sous-bock plié en quatre.',
  },
  {
    id: 'table_bistrot', name: 'Table bistrot marbre', cat: 'tables', price: 140, level: 1, model: 'table2', variant: 'bistrot',
    footprint: [4, 2], seats: [{ x: -0.6, z: 0, face: H }, { x: 0.6, z: 0, face: -H }], comfort: 4, decor: 1,
    desc: '2 places. Plateau en marbre, chaises cannées. Les clients s’y sentent bien.',
  },
  {
    id: 'table_chene', name: 'Table carrée en chêne', cat: 'tables', price: 240, level: 2, model: 'table4',
    footprint: [4, 4], seats: [{ x: -0.62, z: 0, face: H }, { x: 0.62, z: 0, face: -H }, { x: 0, z: -0.62, face: 0 }, { x: 0, z: 0.62, face: Math.PI }],
    comfort: 5, decor: 2, desc: '4 places. Idéale pour les groupes d’amis et les couples.',
  },
  {
    id: 'tonneau', name: 'Tonneau mange-debout', cat: 'tables', price: 170, level: 2, model: 'barrel',
    footprint: [4, 2], seats: [{ x: -0.5, z: 0, face: H, pose: 'stool' }, { x: 0.5, z: 0, face: -H, pose: 'stool' }], comfort: 2, decor: 3,
    desc: '2 places sur tabourets hauts. Ambiance pub irlandais garantie.',
  },
  {
    id: 'banquette', name: 'Box banquette cuir', cat: 'tables', price: 480, level: 3, model: 'booth',
    footprint: [4, 4], seats: [{ x: -0.35, z: -0.58, face: 0 }, { x: 0.35, z: -0.58, face: 0 }, { x: -0.35, z: 0.58, face: Math.PI }, { x: 0.35, z: 0.58, face: Math.PI }],
    approach: 'sides', comfort: 10, decor: 4, desc: '4 places en cuir capitonné. Très confortable, les clients restent plus longtemps.',
  },
  {
    id: 'grande_tablee', name: 'Grande tablée', cat: 'tables', price: 390, level: 3, model: 'table6',
    footprint: [6, 4], seats: [
      { x: -0.75, z: -0.62, face: 0 }, { x: 0, z: -0.62, face: 0 }, { x: 0.75, z: -0.62, face: 0 },
      { x: -0.75, z: 0.62, face: Math.PI }, { x: 0, z: 0.62, face: Math.PI }, { x: 0.75, z: 0.62, face: Math.PI },
    ], comfort: 4, decor: 2, desc: '6 places. Parfaite pour les supporters et les anniversaires.',
  },
  // ---------------- floor decor & entertainment
  { id: 'plante', name: 'Plante en pot', cat: 'deco', price: 40, level: 1, model: 'plant', footprint: [1, 1], decor: 3, desc: 'Un ficus qui a vu des choses.' },
  { id: 'tonneau_deco', name: 'Vieux tonneau', cat: 'deco', price: 55, level: 1, model: 'barrelDeco', footprint: [2, 2], decor: 2, desc: 'Décoratif. Vide. Probablement.' },
  { id: 'palmier', name: 'Grand palmier', cat: 'deco', price: 95, level: 2, model: 'palm', footprint: [2, 2], decor: 5, desc: 'Une touche tropicale dans la grisaille.' },
  { id: 'jukebox', name: 'Jukebox rétro', cat: 'fun', price: 320, level: 2, model: 'jukebox', footprint: [2, 1], decor: 4, ambiance: 6, attracts: { couple: 1.3, habitue: 1.2 }, desc: 'Plus d’ambiance, musique plus riche. Les couples adorent.' },
  { id: 'babyfoot', name: 'Baby-foot', cat: 'fun', price: 380, level: 2, model: 'babyfoot', footprint: [4, 3], decor: 2, fun: 8, attracts: { etudiant: 1.6, amis: 1.3 }, desc: 'Attire étudiants et bandes de potes. Ils restent plus longtemps.' },
  { id: 'arcade', name: 'Borne d’arcade', cat: 'fun', price: 520, level: 3, model: 'arcade', footprint: [2, 2], decor: 3, fun: 6, attracts: { etudiant: 1.4 }, desc: 'Une borne rétro qui clignote. Les étudiants y laissent leur monnaie.' },
  { id: 'billard', name: 'Billard', cat: 'fun', price: 900, level: 3, model: 'pool', footprint: [6, 4], decor: 4, fun: 10, attracts: { amis: 1.4, sportif: 1.2, gros_buveur: 1.2 }, desc: 'Le roi des jeux de bar. Les groupes viennent pour lui.' },
  // ---------------- wall items
  { id: 'affiche', name: 'Affiche de bière', cat: 'mur', wall: true, price: 25, level: 1, model: 'poster', size: [0.6, 0.85], y: 1.75, decor: 1, desc: 'Une affiche rétro d’une de vos marques.' },
  { id: 'tableau', name: 'Tableau', cat: 'mur', wall: true, price: 60, level: 1, model: 'painting', size: [0.9, 0.7], y: 1.8, decor: 2, desc: 'Un paysage acheté à un brocanteur.' },
  { id: 'fanions', name: 'Guirlande de fanions', cat: 'mur', wall: true, price: 45, level: 1, model: 'flags', size: [2, 0.4], y: 2.55, decor: 2, desc: 'Des petits drapeaux colorés. Festif.' },
  { id: 'guirlande', name: 'Guirlande lumineuse', cat: 'mur', wall: true, price: 75, level: 1, model: 'lights', size: [2.5, 0.4], y: 2.5, decor: 3, ambiance: 2, desc: 'Ampoules chaudes. Le bar devient instantanément plus cosy.' },
  { id: 'neon_mur', name: 'Néon « Cheers »', cat: 'mur', wall: true, price: 150, level: 2, model: 'neon', size: [1.3, 0.55], y: 2.1, decor: 4, ambiance: 2, desc: 'Un néon rose qui grésille juste ce qu’il faut.' },
  { id: 'flechettes', name: 'Cible de fléchettes', cat: 'mur', wall: true, price: 90, level: 2, model: 'darts', size: [0.6, 0.6], y: 1.65, decor: 1, fun: 5, attracts: { amis: 1.2, sportif: 1.2 }, desc: 'Débloque les tournois de fléchettes. Attention aux voisins de table.' },
  { id: 'tv', name: 'Écran TV', cat: 'mur', wall: true, price: 450, level: 2, model: 'tv', size: [1.4, 0.85], y: 2.0, decor: 1, ambiance: 3, attracts: { sportif: 1.5 }, tag: 'tv', desc: 'Indispensable pour les soirées match. Les sportifs débarquent.' },
  { id: 'elan', name: 'Tête d’élan en peluche', cat: 'mur', wall: true, price: 160, level: 3, model: 'moose', size: [1.0, 0.9], y: 2.1, decor: 5, desc: 'Personne ne sait d’où elle vient. Tout le monde l’adore.' },
  { id: 'miroir', name: 'Miroir publicitaire', cat: 'mur', wall: true, price: 110, level: 2, model: 'mirror', size: [0.8, 1.0], y: 1.8, decor: 3, desc: 'Un vieux miroir gravé. Agrandit la salle, paraît-il.' },
];

export const CATALOG_CATS = [
  { id: 'tables', label: 'Tables' },
  { id: 'deco', label: 'Déco' },
  { id: 'fun', label: 'Jeux' },
  { id: 'mur', label: 'Murs' },
];
