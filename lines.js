// Short speech-bubble lines. {beer}, {name}, {price} are substituted.
export const LINES = {
  waitOrder: ['On peut commander ?', 'Youhou !', 'Il y a quelqu’un ?', 'Patron !', 'Allôôô ?', 'S’il vous plaît !'],
  waitOrderLong: ['Ça fait trois heures…', 'On est invisibles ?', 'Je vais me servir moi-même !', 'Il dort, le barman ?'],
  waitServe: ['Elle arrive à pied, ma bière ?', 'J’ai soif…', 'Elle se brasse encore ?', 'On a le temps de vieillir.', 'Et ma pinte ?'],
  waitBill: ['L’addition !', 'On voudrait payer…', 'La douloureuse, svp !'],
  waitBillLong: ['Je peux partir sans payer alors ?', 'On va finir par dormir ici.'],
  served: ['Santé !', 'Ah, enfin !', 'Tchin !', 'Divin.', 'Merci chef !', 'Ça, c’est une pinte !', 'À la nôtre !'],
  servedFast: ['Déjà ?! Champion !', 'Service éclair !', 'Wow, rapide !'],
  rupture: ['QUOI ?! Plus de {beer} ?!', 'Comment ça, rupture ?', 'C’est un bar ou une bibliothèque ?', 'Pas de {beer}… je fais comment, moi ?'],
  regularMiss: ['Quinze ans que je bois ma {beer} ici !', 'Sans {beer}, c’est plus le même bar…', 'Ma {beer}… pourquoi ?!'],
  regularHello: ['Comme d’hab, chef !', 'Salut patron !', 'La même que d’habitude !', 'Ah, mon bar préféré !'],
  pricey: ['{price} ?! Vous êtes sérieux ?', 'C’est cher payé, la mousse.', 'Je vais devoir vendre un rein.', 'À ce prix-là, elle est en or ?'],
  cheap: ['À ce prix-là, je reprends une tournée !', 'C’est donné !', 'Les prix sont top ici.'],
  dirty: ['Euh… c’est collant ici.', 'Quelqu’un a oublié ses verres…', 'C’est propre, ça ?'],
  leaveAngry: ['Une étoile sur Internet !', 'On se casse.', 'Plus jamais ici !', 'Service de tortue !'],
  leaveHappy: ['Super soirée !', 'À demain patron !', 'Meilleur bar du quartier !', 'On reviendra !', 'Merci pour tout !'],
  drunk: ['Je vous aime tous !', 'TOURNÉE GÉNÉRALE !!', 'C’est MA chanson !', 'Hips !', 'T’es mon meilleur pote, toi.'],
  spill: ['Oups…', 'Ma pinte !!', 'C’est pas moi, c’est la table !', 'Noooon !'],
  birthday: ['C’est l’anniversaire de {name} !', 'Joyeux anniversaire !!'],
  doorFull: ['C’est plein à craquer !', 'Pas de place ? Tant pis…', 'On repassera.'],
  match: ['BUUUUT !!', 'Allez allez !', 'Arbitre, des lunettes !', 'Hors-jeu !!'],
  wrongItem: ['C’est pas ce que j’ai commandé…', 'Euh, non.'],
  badPint: ['C’est de la mousse ou de la bière ?!', 'Elle est à moitié vide, ma {beer} !', 'On m’a servi un cappuccino ?', 'Elle a pris la pluie, cette pinte ?'],
  badFood: ['C’est une planche ou un accident ?', 'Il a été coupé à la tronçonneuse ?', 'Euh… c’est du saucisson, ça ?', 'Ça a vécu, ce truc.'],
  avgItem: ['Mouais…', 'Ça ira.', 'Bof bof.'],
  perfectCombo: ['Quel artiste !', 'Il est en feu, le patron !', 'Du grand art !'],
  noGlass: ['Plus un verre propre !'],
};

export function line(key, vars = {}, rng = Math) {
  const arr = LINES[key];
  if (!arr) return '';
  let s = arr[Math.floor((rng.next ? rng.next() : rng.random()) * arr.length)];
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll('{' + k + '}', v);
  return s;
}
