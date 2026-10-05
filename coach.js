// First-night tutorial: Gérard, the previous owner, gives contextual tips with a pointer.
import { h } from './dom.js';
import { iconHTML } from './icons.js';
import { avatar } from './panels.js';

const GERARD = {
  female: false, skin: 0xe0a982, hair: 0xd9d9d9, hairStyle: 'bald', top: 0x5a3a22, topStyle: 'sweater', bottom: 0x3c3c3c, shoes: 0x222222,
  hat: 'beret', hatColor: 0x22223b, glasses: true, beard: false, mustache: true, build: 'big', height: 1, age: 'old',
};

export class Coach {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.card = h('div', { class: 'panel coach', hidden: true });
    this.arrow = h('div', { class: 'coach-arrow', hidden: true, html: '<svg viewBox="0 0 32 32" width="38" height="38"><path d="M16 30L4 14h7V2h10v12h7z" fill="#f5a524" stroke="#2a1710" stroke-width="2.2" stroke-linejoin="round"/></svg>' });
    ui.root.append(this.card, this.arrow);
    this.step = null;
    this.worldArrow = null;
    this.timer = 0;
    const b = this.game.bus;
    b.on('orderTaken', ({ ticket }) => this.trigger('ticket', { ticket }));
    b.on('served', () => this.trigger('queueTip'));
    b.on('kegEmpty', () => this.trigger('keg'));
    b.on('tapBroken', () => this.trigger('broken'));
  }

  get st() {
    return this.game.state.tutorial;
  }

  start() {
    if (this.st.done) return;
    this.trigger('welcome');
  }

  skip() {
    this.st.done = true;
    this.hide();
  }

  onPhase(phase) {
    if (!this.game.state || this.st.done) return;
    if (phase === 'service') this.hide();
    if (phase === 'prep' && this.game.state.day === 2) this.trigger('day2');
    if (phase === 'report') this.hide();
  }

  trigger(id, ctx = {}) {
    if (!this.game.state || this.st.done || this.st.seen[id]) return;
    const S = this.steps()[id];
    if (!S) return;
    if (S.phase && S.phase !== this.game.phase) return;
    this.st.seen[id] = true;
    this.step = { id, ...S, ctx };
    this.timer = 0;
    this.show();
    if (id === 'day2') this.st.done = true;
  }

  steps() {
    const g = this.game;
    return {
      welcome: {
        phase: 'prep',
        text: `Salut ! Moi c’est Gérard, l’ancien patron. Je te laisse mon rade : trois tables bancales, une tireuse de Kronfeld et un vieux frigo. Ton but : en faire le bar le plus couru du quartier. Quand tu es prêt, ouvre !`,
        dom: () => this.ui.openBtn,
      },
      order: {
        phase: 'service',
        text: 'Un client lève la main ! Clique sur lui (ou sur sa bulle) pour prendre sa commande.',
        world: (ctx) => ctx.group.anchor,
      },
      ticket: {
        phase: 'service',
        text: 'Sa commande s’affiche à gauche. Une pinte ? Clique sur la tireuse. Une bouteille ou un soda ? Le frigo rouge. Du saucisson ? La planche au fond à gauche.',
        world: (ctx) => {
          const it = ctx.ticket?.items[0];
          const p = it && g.products.get(it.pid);
          if (!p) return null;
          if (p.category === 'draft') {
            const tap = g.taps.find((t) => t.st.beerId === p.id);
            return tap ? [tap.x, 1.65, 1.62] : null;
          }
          if (p.category === 'food') return [1.0, 1.4, 0.3];
          return [7.4, 2.0, 0.5];
        },
      },
      serve: {
        phase: 'service',
        text: 'Tu as ce qu’il faut en main ! Clique sur leur table pour servir.',
        world: (ctx) => ctx.group.anchor,
      },
      queueTip: {
        phase: 'service',
        text: 'Astuce : tu peux cliquer plusieurs choses d’affilée, le patron enchaîne les actions dans l’ordre (les numéros). Clic droit ou Échap pour tout annuler.',
        auto: 7,
      },
      bill: {
        phase: 'service',
        text: 'Ils veulent payer : clique pour encaisser. Astuce : enchaîne les services PARFAITS (pintes, planches…) pour faire monter le combo et les pourboires !',
        world: (ctx) => ctx.group.anchor,
      },
      dirty: {
        phase: 'service',
        text: 'Verres sales sur la table : clique dessus pour débarrasser. Le patron les dépose au lave-verres. Sans verres propres, pas de pinte !',
        world: (ctx) => [ctx.spot.center.x, ctx.spot.topY + 0.9, ctx.spot.center.z],
      },
      keg: {
        phase: 'service',
        text: 'Fût vide ! Clique sur la tireuse : le patron file en chercher un dans la réserve (il lui faut les mains libres).',
        auto: 8,
      },
      broken: {
        phase: 'service',
        text: 'Aïe, la tireuse fuit ! Clique dessus pour la réparer avant que les clients ne s’impatientent.',
        auto: 8,
      },
      day2: {
        phase: 'prep',
        text: 'Pas mal pour une première ! Avant d’ouvrir : vérifie ton stock dans Marchandises, et investis petit à petit : tables, tabourets, cacahuètes… Astuce de vieux briscard : clique sur un ticket de commande et le patron prépare puis sert toute la commande d’un coup.',
        dom: () => this.ui.dock,
      },
    };
  }

  show() {
    const s = this.step;
    this.card.hidden = false;
    this.card.innerHTML = '';
    const av = avatar(GERARD, 56);
    this.card.append(
      h('div', { class: 'coach-av' }, av),
      h('div', { class: 'coach-body' }, h('b', { text: 'Gérard' }), h('p', { text: s.text }),
        h('div', { class: 'coach-btns' },
          h('button', { class: 'btn tiny', onClick: () => this.hide() }, 'Compris'),
          h('button', { class: 'btn tiny ghost', onClick: () => this.skip() }, 'Passer le tutoriel'),
        )),
    );
    if (this.worldArrow) this.worldArrow.remove();
    this.worldArrow = null;
    this.arrow.hidden = true;
    if (s.world) {
      const pos = s.world(s.ctx);
      if (pos) {
        const el = h('div', { class: 'coach-arrow world', html: this.arrow.innerHTML });
        this.worldArrow = this.game.world.overlay.add(el, () => s.world(s.ctx) || pos, { offsetY: -36 });
      }
    }
    this.game.audio?.ui('coach');
  }

  hide() {
    this.card.hidden = true;
    this.arrow.hidden = true;
    if (this.worldArrow) this.worldArrow.remove();
    this.worldArrow = null;
    this.step = null;
  }

  update(dt) {
    const g = this.game;
    if (!g.state || this.st.done) return;
    if (this.step) {
      this.timer += dt;
      if (this.step.auto && this.timer > this.step.auto) this.hide();
      if (this.step?.dom) {
        const el = this.step.dom();
        if (el && el.offsetParent !== null) {
          const r = el.getBoundingClientRect();
          this.arrow.hidden = false;
          this.arrow.style.transform = `translate(${r.left + r.width / 2 - 19}px, ${r.top - 46}px)`;
        } else this.arrow.hidden = true;
      }
      // close contextual steps when their goal is reached
      const id = this.step?.id;
      if (id === 'order' && this.step.ctx.group.state !== 'wantOrder') this.hide();
      if (id === 'bill' && this.step.ctx.group.state !== 'wantBill') this.hide();
      if (id === 'serve' && !this.step.ctx.group.pendingItems().length) this.hide();
      if (id === 'dirty' && !this.step.ctx.spot.isDirty) this.hide();
      if (id === 'ticket' && g.owner.hands.length) this.hide();
    }
    if (g.phase !== 'service' || this.step) return;
    // contextual triggers
    for (const grp of g.customers.groups) {
      if (grp.state === 'wantOrder') return this.trigger('order', { group: grp });
      if (grp.state === 'wantBill') return this.trigger('bill', { group: grp });
      if (grp.state === 'round' && grp.pendingItems().some((i) => g.owner.hands.some((h) => h.pid === i.pid))) return this.trigger('serve', { group: grp });
    }
    const dirty = g.bar.spots.find((s) => s.isDirty && !s.group);
    if (dirty) this.trigger('dirty', { spot: dirty });
  }
}
