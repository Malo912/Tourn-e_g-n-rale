// Entry point: boots the game, title screen, audio.
import { Game } from './core/Game.js';
import { UI } from './ui/UI.js';
import { AudioEngine } from './audio/Audio.js';
import { h } from './ui/dom.js';
import { iconHTML } from './ui/icons.js';
import { CONFIG } from './data/config.js';

function boot() {
  const canvas = document.getElementById('gl');
  const overlay = document.getElementById('overlay');
  const uiRoot = document.getElementById('ui');
  let game;
  try {
    game = new Game(canvas, overlay);
  } catch (e) {
    uiRoot.append(h('div', { class: 'fatal' }, h('h1', { text: 'Oups !' }), h('p', { text: 'Ce navigateur ne supporte pas WebGL 2, nécessaire pour afficher le bar en 3D. Essayez avec un navigateur récent (Chrome, Firefox, Edge, Safari 15+).' })));
    console.error(e);
    return;
  }
  const ui = new UI(game, uiRoot);
  game.audio = new AudioEngine(game);
  window.__game = game;
  const settings = game.save.readSettings();
  const saved = game.save.read();
  game.preview(saved || null);
  if (settings && game.state) Object.assign(game.state.settings, settings);
  game.world.setQuality(game.state.settings.quality || 'high');
  showTitle(game, ui, saved);
  game.start();
}

function showTitle(game, ui, saved) {
  const root = document.getElementById('ui');
  const input = h('input', { id: 'bar-name', type: 'text', maxlength: '22', value: saved?.barName || 'Chez Malo', 'aria-label': 'Nom du bar' });
  const start = (load) => {
    game.audio.init();
    const name = (input.value || 'Chez Malo').trim().slice(0, 22) || 'Chez Malo';
    title.classList.add('out');
    setTimeout(() => title.remove(), 500);
    if (load && saved) game.loadGame(saved);
    else {
      game.save.clear();
      game.newGame(name);
    }
    game.world.neon.refresh();
    game.audio.applySettings();
  };
  const confirmNew = h('div', { class: 'confirm-new', hidden: true },
    h('span', { text: 'Écraser la partie en cours ?' }),
    h('button', { class: 'btn danger', onClick: () => start(false) }, 'Oui, recommencer'),
    h('button', { class: 'btn', onClick: () => (confirmNew.hidden = true) }, 'Non'),
  );
  const title = h('div', { class: 'title-screen' },
    h('div', { class: 'title-card' },
      h('div', { class: 'title-logo' },
        h('span', { class: 'tl-small', text: 'Le jeu de gestion de bar' }),
        h('h1', {}, h('span', { text: 'Tournée' }), h('span', { text: 'Générale\u00a0!' })),
      ),
      h('p', { class: 'title-pitch', text: 'Reprenez un petit rade miteux et faites-en le bar le plus couru du quartier. Tirez les pintes, coupez le saucisson, gérez les fûts… et survivez au rush du vendredi soir.' }),
      saved ? h('div', { class: 'save-info', html: `${iconHTML('beer', 20)} <b>${saved.barName}</b> · jour ${saved.day} · niveau ${saved.level} · ${Math.round(saved.money).toLocaleString('fr-FR')} €` }) : null,
      saved ? h('button', { class: 'btn primary big', onClick: () => start(true) }, 'Continuer') : null,
      h('label', { class: 'name-row', for: 'bar-name' }, h('span', { text: 'Nom de votre bar' }), input),
      h('button', { class: 'btn ' + (saved ? '' : 'primary big'), onClick: () => (saved ? (confirmNew.hidden = false) : start(false)) }, 'Nouvelle partie'),
      confirmNew,
      h('ul', { class: 'title-help' },
        h('li', { html: `${iconHTML('beer', 18)} <b>Cliquez</b> sur les clients, la tireuse, le frigo, les tables : le patron enchaîne les actions.` }),
        h('li', { html: `${iconHTML('star', 18)} <b>Servez vous-même</b> : tirez les pintes (maintenez <b>Espace</b>), coupez le saucisson, décapsulez… Enchaînez les services parfaits pour le combo !` }),
        h('li', { html: `${iconHTML('move', 18)} <b>Glissez</b> pour bouger la caméra, <b>clic droit</b> pour tourner, <b>molette</b> pour zoomer.` }),
        h('li', { html: `${iconHTML('sound', 18)} Avec le son, c’est mieux.` }),
      ),
    ),
  );
  input.addEventListener('keydown', (e) => e.key === 'Enter' && start(!!saved && false));
  root.append(title);
  // slow orbit on title
  const rig = game.world.rig;
  const spin = () => {
    if (!title.isConnected || game.phase !== 'title') return;
    rig.goal.yaw += 0.0012;
    requestAnimationFrame(spin);
  };
  spin();
}

boot();
