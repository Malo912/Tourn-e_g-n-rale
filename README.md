# Tournée Générale !

Jeu de gestion de bar en 3D cartoon, jouable dans le navigateur. Vous reprenez un petit rade et en faites le bar le plus couru du quartier : vous servez vous-même (mini-jeux de tirage, découpe, décapsulage…), vous gérez le stock, vous investissez, vous embauchez, et vous survivez aux rushs.

Aucune dépendance : moteur WebGL 2 maison, audio procédural (Web Audio), tout est en JavaScript ES modules.

## Lancer le jeu

- **Version prête à jouer** : ouvrir `dist/tournee-generale.html` dans un navigateur récent (Chrome, Firefox, Edge, Safari 15+).
- **Version de développement** : servir le dossier puis ouvrir `index.html` (les modules ES ne se chargent pas en `file://`).

```bash
python3 -m http.server 8123
# puis http://localhost:8123/index.html
```

- **Reconstruire le fichier unique** : `node tools/bundle.mjs` → `dist/tournee-generale.html` (page complète) et `dist/artifact.html` (corps de page seul, pour l'hébergement en Artifact).

## Commandes

| Action | Souris / tactile | Clavier |
|---|---|---|
| Agir (client, tireuse, frigo, table, flaque…) | clic | — |
| Caméra | glisser · clic droit + glisser pour tourner · molette | ZQSD / flèches · A/E |
| Pause / vitesse | boutons en haut à droite | Espace ou P · 1 2 3 |
| Annuler les actions du patron | clic droit | Échap |
| **Pinte** : verser / redresser le verre | maintenir le clic sur le panneau · glisser vers le haut | maintenir Espace · ↑ |
| Saucisson, bouteille, café, croque | clic | Espace |
| Planche apéro | clic sur la case | touches 1 à 5 |

## La boucle de jeu

Préparation (achats, construction, tireuses, carte & prix, équipe, événement) → ouverture → clients → commande → **préparation en mini-jeu** → service → consommation → addition → débarrassage → lavage des verres → stock qui baisse → bilan de fin de soirée → réinvestissement → niveau suivant.

### Le service (mini-jeux)

Chaque produit préparé par le patron passe par un mini-jeu de 1 à 5 secondes (`src/minigames/`) :

- **Pinte** (`PourGame.js`) : le verre glisse sous le bec, on maintient pour ouvrir la tireuse, on garde le **DÉBIT** dans la zone verte (relâcher un instant le fait redescendre), on **redresse le verre** au fil du remplissage (jauge INCLINAISON), et on s'arrête au **trait doré**. Notation : remplissage, mousse, débordement, verre redressé, rapidité.
- **Saucisson** (`FoodGames.js › CutGame`) : 5 tranches au passage du couteau.
- **Planche apéro** (`FoodGames.js › PlankGame`) : placer 5 ingrédients le plus vite possible.
- **Bouteille** (`QuickGames.js › CapGame`) : décapsuler quand l'aiguille est dans le vert.
- **Soft** (`QuickGames.js › FillGame`) : verser jusqu'au trait sans faire déborder les bulles.
- **Café / croque-monsieur** (`QuickGames.js › TimingGame`) : arrêter la machine au bon moment.

Cinq niveaux de qualité (`src/data/service.js › QUALITY`) : **parfait** (satisfaction et pourboire en plus, combo +1), **bien**, **moyen**, **raté**, **catastrophe** (la bière part sur le comptoir, flaque à éponger). Chaque style de bière a son profil (`POUR_PROFILES`) : lager facile, IPA à zone étroite et mousse explosive, blanche/weiss exigeantes sur l'inclinaison, stout en deux temps avec repos, trappiste rare et capricieuse.

**Perfection contre rapidité** : ouvrir à fond donne une pinte correcte en ~2,5 s ; une pinte parfaite demande ~3,5 à 4 s. Pendant qu'un mini-jeu est ouvert, le bar tourne à 80 % de la vitesse normale.

**Combos** : chaque service parfait du patron ajoute +1, une erreur le casse. Effets : pourboires (+4 % par niveau), satisfaction, et tous les 5 parfaits « EN FEU ! » (patron +25 % de vitesse pendant 16 s, confettis, applaudissements).

**Équipements à effet direct** (`src/data/upgrades.js`) : tireuse multi-becs (2 puis 4 pintes d'un coup), tireuse professionnelle (zone idéale +35 % / +70 %), refroidissement amélioré (débit plus rapide, moins de mousse, moins de pannes), bec haute précision (mousse maîtrisée), couteau de chef, kit du barman, machine à expresso.

**Employés** : ils produisent sans mini-jeu, avec une qualité tirée de leurs stats (`staffQuality`). Serveur (salle) puis barman (préparation) ; un barman à 85 de service gère 4 articles à la fois.

**Rushs** (`src/data/events.js › RUSHES`, `src/sim/Director.js`) : annoncés ~14 minutes de jeu à l'avance (« MATCH DANS 13 MIN ! »), puis afflux de clients (jusqu'à +150 %), commandes plus rapides, consommation accélérée, mini-jeux plus durs. Fin : panneau « RUSH TERMINÉ » (clients, commandes, CA, pourboires, services parfaits, ratés, clients perdus, réputation, XP). L'intensité s'adapte à la taille du bar (équipe, niveau, réputation).

Réglages → **Mini-jeux de service** : Normal, Assisté (zones bien plus larges) ou Automatique (qualité « bien », sans combo).

## Architecture

```
src/
  engine/     moteur 3D : maths, graphe de scène, géométrie procédurale, shaders toon + ombres, caméra
  world/      le bar en 3D : pièce, modèles (personnages, mobilier, comptoir), effets, overlay HTML ancré en 3D
  sim/        simulation : clients et groupes, ouvrier/patron et file de tâches, tâches (tasks.js),
              stations (tireuses, frigo, planche, lave-verres), stock, commandes, IA du personnel, directeur (affluence, rushs, incidents)
  minigames/  mini-jeux de service (Canvas 2D) et leur gestionnaire (entrées souris/tactile/clavier)
  core/       Game (état, phases, économie, progression, combos), sauvegarde, RNG, bus d'événements
  ui/         HUD, panneaux, mode construction, tutoriel (Gérard), icônes SVG
  audio/      musique adaptative et bruitages synthétisés
  data/       tout le contenu, piloté par les données
```

Le flux d'une action : un clic crée une tâche (`sim/tasks.js`) dans la file du patron (`sim/Worker.js`). Arrivé sur place, si la tâche a un `minigame`, le `MiniGameManager` ouvre le panneau ; le résultat (`{quality, ...}`) est passé à `task.done(worker, result)`, qui donne l'article en main avec sa qualité. À la livraison, `Group.deliver()` applique les effets (satisfaction, pourboire, réplique du client) et `Game.registerQuality()` gère combos et statistiques.

## Ajouter du contenu

- **Une bière** : une entrée dans `src/data/beers.js` (nom fictif, style, couleurs du liquide et de la mousse, étiquette, prix, niveau). Son mini-jeu vient du profil de son `style` dans `src/data/service.js › POUR_PROFILES` ; pour une mécanique spéciale, créer un nouveau style avec son profil.
- **Un plat** : une entrée dans `src/data/products.js › FOODS` (station, temps, prix, `requires` éventuel), un modèle dans `world/models/props.js › makeFood`, une icône dans `ui/icons.js › itemIconHTML`, et le choix du mini-jeu dans `sim/tasks.js › T.food` (table `kind`).
- **Un mini-jeu** : une classe avec `title`, `hint`, `controls`, `update(dt, input)`, `draw(ctx, w, h, t)`, `done` et `result = {quality, notes}` ; l'enregistrer dans `minigames/Manager.js › MINIGAMES` et ajouter son texte de tutoriel dans `TUTO`.
- **Un équipement** : une entrée dans `src/data/upgrades.js`, lue par `game.up(id)` / `game.upValue(id)` là où il agit (ex. `Game.pourMods()` pour la tireuse).
- **Un rush** : une entrée dans `RUSHES` (texte d'annonce, type de clients, multiplicateur, durée).
- **Un événement, un meuble, un type de client, un objectif** : `events.js`, `catalog.js`, `customers.js`, `progression.js`.

## Marques

Toutes les bières sont fictives : noms, étiquettes et couleurs sont inventés pour évoquer un style, sans reprendre de nom, logo, mascotte, slogan ou packaging réels.

## Tests (développement)

`dev/bot.js` ajoute des aides pour les tests automatisés dans un navigateur sans écran : `__fast(s)` (simule s secondes avec un joueur automatique et des mini-jeux résolus avec un mélange réaliste de qualités et de durées), `__botMorning()` (achats et investissements automatiques), `__tick(s)` / `__render()` (horloge manuelle pour piloter les mini-jeux au clavier).
