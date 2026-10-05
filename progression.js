// Bar levels (unlock tiers) and the objective chain that keeps the player busy.
export const LEVELS = [
  { level: 1, name: 'Rade de quartier', xp: 0 },
  { level: 2, name: 'Bar sympa', xp: 380 },
  { level: 3, name: 'Bar populaire', xp: 1250 },
  { level: 4, name: 'Pub réputé', xp: 3200 },
  { level: 5, name: 'Bar emblématique', xp: 7000 },
];

// check(g) returns current progress value; target is the goal.
export const OBJECTIVES = [
  { id: 'serve10', text: 'Servir 10 boissons', target: 10, check: (g) => g.state.stats.drinks, reward: 40 },
  { id: 'night150', text: 'Encaisser 150 € en une soirée', target: 150, check: (g) => g.night?.revenue ?? 0, reward: 50, perNight: true },
  { id: 'tables4', text: 'Avoir 4 tables', target: 4, check: (g) => g.bar.tableCount(), reward: 60 },
  { id: 'snack', text: 'Proposer des cacahuètes', target: 1, check: (g) => (g.up('snack') ? 1 : 0), reward: 30 },
  { id: 'sat70', text: 'Finir une soirée à 70 % de satisfaction', target: 70, check: (g) => g.state.stats.bestSat ?? 0, reward: 60 },
  { id: 'tap2', text: 'Installer une 2e tireuse', target: 2, check: (g) => g.state.taps.length, reward: 80 },
  { id: 'regular1', text: 'Fidéliser un habitué', target: 1, check: (g) => g.state.regulars.length, reward: 50 },
  { id: 'stars2', text: 'Atteindre 2 étoiles', target: 2, check: (g) => g.stars(), reward: 100 },
  { id: 'pints30', text: 'Tirer 30 pintes en une soirée', target: 30, check: (g) => g.night?.pints ?? 0, reward: 100, perNight: true },
  { id: 'event1', text: 'Organiser un événement', target: 1, check: (g) => g.state.stats.events, reward: 80 },
  { id: 'staff1', text: 'Embaucher un employé', target: 1, check: (g) => g.state.staff.length, reward: 100 },
  { id: 'beers4', text: 'Proposer 4 bières pression', target: 4, check: (g) => g.state.taps.filter((t) => t.beerId).length, reward: 120 },
  { id: 'stars3', text: 'Atteindre 3 étoiles', target: 3, check: (g) => g.stars(), reward: 200 },
  { id: 'night600', text: 'Encaisser 600 € en une soirée', target: 600, check: (g) => g.night?.revenue ?? 0, reward: 150, perNight: true },
  { id: 'regular5', text: 'Avoir 5 habitués', target: 5, check: (g) => g.state.regulars.length, reward: 150 },
  { id: 'planche40', text: 'Servir 40 planches apéro', target: 40, check: (g) => g.state.stats.planches ?? 0, reward: 250 },
  { id: 'room', text: 'Agrandir la salle', target: 1, check: (g) => g.up('room'), reward: 300 },
  { id: 'stars4', text: 'Atteindre 4 étoiles', target: 4, check: (g) => g.stars(), reward: 400 },
  { id: 'night1500', text: 'Encaisser 1 500 € en une soirée', target: 1500, check: (g) => g.night?.revenue ?? 0, reward: 400, perNight: true },
  { id: 'stars5', text: 'Devenir un bar 5 étoiles', target: 5, check: (g) => g.stars(), reward: 1000 },
];

export const STAFF_ROLES = [
  { id: 'serveur', name: 'Serveur', level: 2, desc: 'Prend les commandes, encaisse et débarrasse les tables. Ne tire pas les pintes.' },
  { id: 'barman', name: 'Barman', level: 3, desc: 'Prépare les commandes en attente (pintes, frigo, planches) et les sert. Change les fûts.' },
];
