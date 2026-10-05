// Runs one service mini-game at a time in a close-up panel; collects input (mouse/touch/keyboard) and returns a quality result.
import { h } from '../ui/dom.js';
import { iconHTML } from '../ui/icons.js';
import { PourGame } from './PourGame.js';
import { CutGame, PlankGame } from './FoodGames.js';
import { CapGame, FillGame, TimingGame } from './QuickGames.js';
import { QUALITY, RESULT_TEXT } from '../data/service.js';

export const MINIGAMES = { pour: PourGame, cut: CutGame, plank: PlankGame, cap: CapGame, fill: FillGame, timing: TimingGame };

const CW = 380, CH = 270;

// first-time explanations (shown inside the panel the first time each mini-game appears)
const TUTO = {
  pour: 'Maintiens <kbd>Espace</kbd> (ou le clic) : la tireuse s’ouvre. Garde le <b>DÉBIT</b> dans le vert — relâche un instant s’il monte trop. Verre incliné au début, <b>redresse-le</b> (<kbd>↑</kbd> ou glisser vers le haut) à mi-hauteur. Lâche juste avant le <b>trait doré</b> !',
  cut: 'Le couteau avance tout seul : appuie pile quand il passe sur chaque pointillé.',
  plank: 'Pose l’ingrédient demandé sur sa case : clique-la ou tape son chiffre. Vite et sans erreur !',
  cap: 'Appuie quand l’aiguille passe dans le vert : <b>POP</b> ! Sinon… geyser.',
  fill: 'Maintiens pour verser, relâche au trait. Ça pétille : fais de petites pauses pour laisser retomber la mousse.',
  timing: 'Lance la machine, puis appuie quand la jauge arrive dans la zone dorée.',
};

export class MiniGameManager {
  constructor(game, root) {
    this.game = game;
    this.active = null;
    this.panel = h('div', { class: 'panel minigame', hidden: true });
    this.head = h('div', { class: 'mg-head' });
    this.canvas = h('canvas', { class: 'mg-canvas', width: String(CW * 2), height: String(CH * 2) });
    this.canvas.style.width = CW + 'px';
    this.canvas.style.height = CH + 'px';
    this.tuto = h('div', { class: 'mg-tuto', hidden: true });
    this.foot = h('div', { class: 'mg-foot' });
    this.stamp = h('div', { class: 'mg-stamp', hidden: true });
    this.panel.append(this.head, this.tuto, h('div', { class: 'mg-stage' }, this.canvas, this.stamp), this.foot);
    root.append(this.panel);
    this.g2 = this.canvas.getContext('2d');
    this.g2.scale(2, 2);
    this.t = 0;
    this.input = { hold: false, pressed: false, click: null, key: null, up: false, down: false, tiltSet: null };
    this._ptr = null;
    this._keys = new Set();
    this._bind();
  }

  _bind() {
    const c = this.canvas;
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * CW, y: ((e.clientY - r.top) / r.height) * CH };
    };
    this.panel.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      e.preventDefault();
      e.stopPropagation();
      this.panel.setPointerCapture?.(e.pointerId);
      const p = pos(e);
      this._ptr = { id: e.pointerId, y0: p.y, tilt0: this.active.game.tiltTarget ?? 1 };
      this.input.hold = true;
      this.input.pressed = true;
      this.input.click = p;
    });
    this.panel.addEventListener('pointermove', (e) => {
      if (!this._ptr || e.pointerId !== this._ptr.id) return;
      const p = pos(e);
      this.input.tiltSet = Math.max(0, Math.min(1, this._ptr.tilt0 + (p.y - this._ptr.y0) / 110));
    });
    const up = (e) => {
      if (!this._ptr || e.pointerId !== this._ptr.id) return;
      this._ptr = null;
      this.input.hold = this._keys.has('space');
    };
    this.panel.addEventListener('pointerup', up);
    this.panel.addEventListener('pointercancel', up);
    this.panel.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.target && e.target.tagName === 'INPUT') return;
      const k = e.key;
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!this._keys.has('space')) this.input.pressed = true;
        this._keys.add('space');
        this.input.hold = true;
      } else if (k === 'ArrowUp' || k === 'w' || k === 'z' || k === 'W' || k === 'Z') {
        this.input.up = true;
        e.stopImmediatePropagation();
      } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
        this.input.down = true;
        e.stopImmediatePropagation();
      } else if (k >= '1' && k <= '9') {
        this.input.key = k;
        e.stopImmediatePropagation();
      }
    }, true);
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this._keys.delete('space');
        if (!this._ptr) this.input.hold = false;
      }
      const k = e.key;
      if (k === 'ArrowUp' || k === 'w' || k === 'z' || k === 'W' || k === 'Z') this.input.up = false;
      if (k === 'ArrowDown' || k === 's' || k === 'S') this.input.down = false;
    }, true);
    window.addEventListener('blur', () => {
      this._keys.clear();
      this.input.hold = false;
      this.input.up = this.input.down = false;
    });
  }

  /** start a mini-game; done(result) is called with {quality, notes, ...} */
  start(kind, opts, done) {
    const Cls = MINIGAMES[kind];
    if (!Cls) return done({ quality: 'good', notes: [] });
    const game = new Cls(this, opts);
    this.active = { kind, opts, game, done, resultT: 0 };
    this.input = { hold: this._keys.has('space'), pressed: false, click: null, key: null, up: false, down: false, tiltSet: null };
    this.head.innerHTML = `<b>${game.title}</b><span>${game.hint || ''}</span>`;
    this.foot.innerHTML = game.controls || '';
    // first time: Gérard explains
    const st = this.game.state;
    const seen = st ? (st.tutorial.mg ||= {}) : {};
    const key = kind === 'timing' ? 'timing' : kind;
    this.tuto.hidden = !!seen[key] || !TUTO[key];
    if (!this.tuto.hidden) {
      seen[key] = (seen[key] || 0) + 1;
      this.tuto.innerHTML = `<span class="mg-tuto-ic">${iconHTML('speech', 20)}</span><p><b>Gérard :</b> ${TUTO[key]}</p>`;
    }
    this.stamp.hidden = true;
    this.panel.hidden = false;
    this.panel.dataset.kind = kind;
    this.game.ui?.root.classList.add('mg-on');
    this.game.bus.emit('minigameStart', { kind, opts });
  }

  abort() {
    if (!this.active) return;
    const a = this.active;
    this.active = null;
    this.panel.hidden = true;
    this.game.ui?.root.classList.remove('mg-on');
    a.done(null);
  }

  sfx(name) {
    this.game.bus.emit('mgSfx', { name });
  }

  update(dt) {
    const a = this.active;
    if (!a) return;
    if (dt <= 0) {
      // paused: keep the picture, ignore input
      this.input.pressed = false;
      this.input.click = null;
      this.input.key = null;
      this.panel.classList.add('paused');
      return;
    }
    this.panel.classList.remove('paused');
    this.t += dt;
    const gm = a.game;
    if (!gm.done) gm.update(dt, this.input);
    else if (gm.update && a.resultT < 0.75) gm.update(dt, this.input);
    this.input.pressed = false;
    this.input.click = null;
    this.input.key = null;
    this.input.tiltSet = null;
    gm.draw(this.g2, CW, CH, this.t);
    if (gm.done && gm.result) {
      if (a.resultT === 0) this._showResult(a, gm.result);
      a.resultT += dt;
      if (a.resultT > 0.7) {
        this.active = null;
        this.panel.hidden = true;
        this.game.ui?.root.classList.remove('mg-on');
        a.done(gm.result);
      }
    }
  }

  _showResult(a, r) {
    const cat = a.opts.resultKey || 'draft';
    const txt = (RESULT_TEXT[cat] || RESULT_TEXT.draft)[r.quality] || QUALITY[r.quality].label;
    const Q = QUALITY[r.quality];
    this.stamp.hidden = false;
    this.stamp.className = 'mg-stamp q-' + r.quality;
    this.stamp.innerHTML = `${iconHTML(Q.icon, 30)}<b>${txt}</b>${r.notes?.length ? `<small>${r.notes.join(' · ')}</small>` : ''}`;
    this.game.bus.emit('minigameResult', { kind: a.kind, result: r, opts: a.opts });
  }
}
