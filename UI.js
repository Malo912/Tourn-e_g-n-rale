// HUD: top bar, tickets, stock, hands & queue, dock, toasts, speech bubbles, tooltip, picker.
import { h, clear, fmtTime, eur, starsHTML } from './dom.js';
import { iconHTML, itemIconHTML } from './icons.js';
import { Panels } from './panels.js';
import { BuildMode } from './build.js';
import { Coach } from './coach.js';
import { CONFIG } from '../data/config.js';
import { LEVELS, OBJECTIVES } from '../data/progression.js';
import { line } from '../data/lines.js';
import { MiniGameManager } from '../minigames/Manager.js';
import { QUALITY } from '../data/service.js';

export class UI {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    game.ui = this;
    this.panels = new Panels(this);
    this.build = new BuildMode(this);
    this.coach = new Coach(this);
    this._buildHUD();
    game.minigames = new MiniGameManager(game, this.hud);
    this._bind();
    this.t = 0;
    this.slowT = 0;
  }

  // ------------------------------------------------------------- layout
  _buildHUD() {
    const g = this.game;
    const R = this.root;
    this.hud = h('div', { class: 'hud', hidden: true });
    // top-left: brand
    this.brand = h('div', { class: 'panel brand' },
      h('div', { class: 'brand-name' }),
      h('div', { class: 'brand-row' }, h('span', { class: 'lvl-badge' }), h('span', { class: 'stars' })),
      h('div', { class: 'xpbar' }, h('i')),
      h('div', { class: 'lvl-name' }),
    );
    // top-center: clock
    this.clockEl = h('div', { class: 'panel clock' },
      h('div', { class: 'clock-top' }, h('span', { class: 'day' }), h('span', { class: 'time' })),
      h('div', { class: 'clock-bar' }, h('i')),
      h('div', { class: 'chips' }),
    );
    // top-right: money + speed
    this.moneyEl = h('div', { class: 'panel money' },
      h('div', { class: 'money-main' }, h('span', { html: iconHTML('coin', 22) }), h('b')),
      h('div', { class: 'money-sub' }),
      h('div', { class: 'money-row' },
        h('span', { class: 'pill guests', title: 'Clients dans le bar' }),
        h('span', { class: 'pill sat', title: 'Satisfaction moyenne' }),
      ),
    );
    this.combo = h('div', { class: 'combo', hidden: true },
      h('div', { class: 'combo-main' }, h('span', { class: 'combo-ic', html: iconHTML('fire', 22) }), h('b', { class: 'combo-n' }), h('span', { class: 'combo-lbl', text: 'COMBO' })),
      h('div', { class: 'combo-pips' }, ...[0, 1, 2, 3, 4].map(() => h('i'))),
      h('div', { class: 'combo-sub' }),
      h('div', { class: 'combo-fire', hidden: true }, h('span', { text: 'EN FEU ! vitesse +25 %' }), h('i')),
    );
    this.speedEl = h('div', { class: 'panel speed' });
    const sp = (s, icon, title) => h('button', { class: 'icon-btn', 'data-speed': s, title, html: iconHTML(icon, 18), onClick: () => (s === 0 ? g.togglePause() : g.setSpeed(s)) });
    this.speedEl.append(sp(0, 'pause', 'Pause (Espace ou P)'), sp(1, 'play', 'Vitesse normale (1)'), sp(2, 'fast', 'Vitesse ×2 (2)'), sp(3, 'fast', 'Vitesse ×3 (3)'));
    this.speedEl.lastChild.classList.add('x3');
    this.settingsBtn = h('button', { class: 'icon-btn settings-btn', title: 'Réglages', html: iconHTML('gear', 20), onClick: () => this.panels.open('settings') });
    this.topRight = h('div', { class: 'top-right' }, this.moneyEl, h('div', { class: 'tr-row' }, this.speedEl, this.settingsBtn));

    // left: tickets
    this.tickets = h('div', { class: 'tickets' });
    // right: stock
    this.stock = h('div', { class: 'panel stock' });
    this.stockToggle = h('button', { class: 'stock-toggle icon-btn', title: 'Stock', html: iconHTML('box', 20), onClick: () => this.stock.classList.toggle('open') });
    // bottom: hands + queue
    this.hands = h('div', { class: 'panel hands' });
    // objectives
    this.objectives = h('div', { class: 'panel objectives' });
    // dock (prep)
    this.dock = h('div', { class: 'dock' });
    const dockBtn = (id, icon, label) => h('button', { class: 'dock-btn', 'data-panel': id, onClick: () => (id === 'build' ? this.build.toggle() : this.panels.open(id)) }, h('span', { html: iconHTML(icon, 30) }), h('span', { class: 'lbl', text: label }));
    this.dock.append(
      dockBtn('build', 'hammer', 'Construire'),
      dockBtn('stock', 'cart', 'Marchandises'),
      dockBtn('bar', 'tap', 'Tireuses'),
      dockBtn('menu', 'list', 'Carte & prix'),
      dockBtn('upgrades', 'wrench', 'Améliorer'),
      dockBtn('staff', 'users', 'Équipe'),
      dockBtn('events', 'calendar', 'Événements'),
      dockBtn('regulars', 'regular', 'Habitués'),
    );
    this.openBtn = h('button', { class: 'btn primary big open-btn', onClick: () => this.openBar() }, h('span', { html: iconHTML('beer', 28) }), h('span', { text: 'Ouvrir le bar' }));
    this.dockWrap = h('div', { class: 'dock-wrap' }, this.dock);
    // express order quick button (service)
    this.expressBtn = h('button', { class: 'btn express', onClick: () => this.panels.open('stock', { express: true }) }, h('span', { html: iconHTML('bolt', 18) }), h('span', { text: 'Commande express' }));

    this.toasts = h('div', { class: 'toasts' });
    this.tooltip = h('div', { class: 'tooltip', hidden: true });
    this.picker = h('div', { class: 'panel picker', hidden: true });
    this.banner = h('div', { class: 'banner', hidden: true });
    // rush (chaos moments)
    this.rushAlert = h('div', { class: 'rush-alert', hidden: true });
    this.rushLive = h('div', { class: 'panel rush-live', hidden: true });
    this.rushSummary = h('div', { class: 'panel rush-summary', hidden: true });

    this.hud.append(this.brand, this.clockEl, this.topRight, this.tickets, this.stock, this.stockToggle, this.hands, this.objectives, this.dockWrap, this.openBtn, this.expressBtn, this.banner, this.rushAlert, this.rushLive, this.rushSummary);
    R.append(this.hud, this.toasts, this.tooltip, this.picker);
  }

  _bind() {
    const g = this.game;
    const b = g.bus;
    b.on('toast', (t) => this.toast(t.text, t.kind, t.icon));
    b.on('phase', (p) => this.onPhase(p));
    b.on('speed', () => this.refreshSpeed());
    b.on('levelUp', ({ level }) => {
      if (g.phase !== 'prep') {
        if (g.phase !== 'report') this.showBanner(`Niveau ${level.level} : ${level.name} !`, 'trophy');
        this.pendingLevel = level;
      } else this.panels.queue('levelup', { level });
    });
    b.on('objective', ({ def }) => this.toast(`Objectif réussi : ${def.text} (+${def.reward} €)`, 'good', 'trophy'));
    b.on('rushAnnounce', ({ rush }) => this.rushAnnounce(rush));
    b.on('rushStart', ({ rush }) => this.rushStart(rush));
    b.on('rushEnd', ({ summary }) => this.rushEnd(summary));
    b.on('comboBreak', () => {
      this.combo.classList.remove('break');
      void this.combo.offsetWidth;
      this.combo.classList.add('break');
      clearTimeout(this._breakT);
      this._breakT = setTimeout(() => {
        this.combo.classList.remove('break');
        this.refreshCombo();
      }, 700);
    });
    b.on('comboMilestone', ({ n }) => this.showBanner(`COMBO ×${n} ! Vous êtes en feu !`, 'fire'));
    b.on('pourFail', () => this.toast('CATASTROPHE ! La pinte a débordé partout. Épongez la flaque !', 'bad', 'mop'));
    b.on('tapBroken', ({ tap }) => {
      this.toast(`${tap.label()} tombe en panne ! Ça mousse partout !`, 'bad', 'wrench');
      g.world.effects.burst('foam', tap.view.nozzleWorld(), 14);
    });
    b.on('kegEmpty', ({ tap }) => {
      const k = g.inventory.kegs(tap.st.beerId);
      this.toast(`Fût de ${tap.beer.short} vide !${k ? ' Cliquez sur la tireuse pour le changer.' : ' Plus de fût en réserve !'}`, k ? 'warn' : 'bad', 'keg');
    });
    b.on('critic', () => this.showBanner('Un critique du Guide du Zinc vient d’entrer… Soignez-le !', 'book'));
    b.on('regularArrives', ({ regular }) => {
      const p = g.products.get(regular.favorite);
      this.toast(`${regular.name} est là ! Toujours une ${p?.short || 'pinte'}.`, 'info', 'regular');
    });
    b.on('goal', () => this.showBanner('BUUUUUT !!! Tout le bar exulte !', 'ball'));
    b.on('closing', () => this.showBanner('Dernière tournée ! On ferme bientôt.', 'clock'));
    b.on('doorQueue', () => {
      if (!this._queueWarned) {
        this._queueWarned = true;
        this.toast('Des clients attendent dehors : il manque de la place !', 'warn', 'door');
      }
    });
    b.on('combo', ({ n, up }) => {
      this.refreshCombo();
      if (up) {
        this.combo.classList.remove('pop');
        void this.combo.offsetWidth;
        this.combo.classList.add('pop');
      }
    });
    b.on('birthday', ({ name }) => this.toast(`C’est l’anniversaire de ${name} ! Ils vont commander plus.`, 'info', 'party'));
    b.on('spill', () => this.toast('Une pinte renversée ! Épongez la flaque, et ils en veulent une autre (offerte).', 'warn', 'mop'));
    b.on('drop', () => {});
    b.on('newRegular', () => {});
    b.on('queue', () => this.refreshHands());
    b.on('regularMiss', ({ regular }) => this.toast(`${regular.name} ne trouve pas sa ${g.products.get(regular.favorite)?.short} à la carte… ${regular.look?.female ? 'Elle est vexée' : 'Il est vexé'}.`, 'bad', 'regular'));
    // hover
    let hoverEnt = null;
    this._hoverCheck = () => {
      const xy = g.hoverXY;
      let e = null;
      if (xy && !this.build.active && (g.phase === 'service' || g.phase === 'prep' || g.phase === 'closing')) e = g.world.pick(xy.x, xy.y);
      if (e !== hoverEnt) {
        if (hoverEnt) this.setEntityHighlight(hoverEnt, false);
        hoverEnt = e;
        if (e) this.setEntityHighlight(e, true);
        g.world.canvas.style.cursor = e ? 'pointer' : '';
      }
      if (e && xy) {
        const txt = this.describe(e);
        if (txt) {
          this.tooltip.hidden = false;
          this.tooltip.innerHTML = txt;
          const tw = this.tooltip.offsetWidth;
          this.tooltip.style.transform = `translate(${Math.min(xy.x + 16, innerWidth - tw - 8)}px, ${xy.y + 18}px)`;
        } else this.tooltip.hidden = true;
      } else this.tooltip.hidden = true;
    };
    document.addEventListener('pointerdown', (e) => {
      if (!this.picker.hidden && !this.picker.contains(e.target)) this.hidePicker();
    });
  }

  setEntityHighlight(e, on) {
    if (e.view?.setHighlight) e.view.setHighlight(on);
    else if (e.group && e.view) e.view.setHighlight(on);
    if (e.furniture?.meshes) for (const m of e.furniture.meshes) m.flash = on ? [0.1, 0.08, 0.03] : null;
    if (e.kind === 'counter' || e.kind === 'table') {
      if (e.group) for (const m of e.group.members) m.view.setHighlight(on);
    }
    if (e.group && !e.kind) for (const m of e.group.members) m.view.setHighlight(on);
  }

  describe(e) {
    const g = this.game;
    const P = g.products;
    if (e.group && e.view && !e.role) e = e.group.spots[0] && e.group.state !== 'queue' ? e.group.spots[0] : { groupOnly: e.group };
    if (e.groupOnly) return `<b>${e.groupOnly.type.name}</b><br>Attend une place libre`;
    if (e.kind === 'table' || e.kind === 'counter') {
      const gr = e.group;
      if (!gr) return `<b>${e.label}</b><br>${e.isDirty ? 'Sale : cliquez pour débarrasser' : 'Libre'}${e.cash ? ` · ${eur(e.cash, 2)} laissés` : ''}`;
      const who = gr.regular ? `${iconHTML('star', 12)} ${gr.regular.name}` : gr.critic ? 'Critique gastronomique' : `${gr.type.name}${gr.size > 1 ? ' ×' + gr.size : ''}`;
      const st = { wantOrder: 'Veut commander', round: gr.pendingItems().length ? 'Attend : ' + gr.pendingItems().map((i) => P.get(i.pid).short).join(', ') : 'Consomme', wantBill: 'Veut payer', settling: 'S’installe', arriving: 'Arrive', ordering: 'Commande…', paying: 'Paie…' }[gr.state] || '';
      return `<b>${e.label}</b> · ${who}<br>${st}<br><span class="tt-sat">Satisfaction ${Math.round(gr.sat)} %</span>`;
    }
    if (e.kind === 'tap') {
      if (!e.beer) return `<b>${e.label()}</b><br>Aucune bière branchée`;
      return `<b>${e.label()} · ${e.beer.name}</b><br>${e.broken ? '<span class="bad">EN PANNE : cliquez pour réparer</span>' : `${e.level}/${e.beer.kegSize} pintes · réserve : ${g.inventory.kegs(e.st.beerId)} fût(s)`}`;
    }
    if (e.kind === 'fridge') return `<b>Frigo</b><br>${e.products.map((p) => `${P.get(p).short} : ${e.count(p)}`).join(' · ')}`;
    if (e.kind === 'board' || e.kind === 'snack') return `<b>${e.label()}</b><br>${e.products().map((p) => `${P.get(p).short} : ${g.inventory.portions(p)}`).join(' · ') || '—'}`;
    if (e.kind === 'dishwasher') return `<b>Lave-verres</b><br>${g.glasses.clean} verres propres · ${e.washing ? e.washing + ' en lavage' : 'à l’arrêt'}${e.queue ? ' · ' + e.queue + ' en attente' : ''}`;
    if (e.kind === 'puddle') return '<b>Flaque de bière</b><br>Cliquez pour éponger';
    if (e.isOwner) return '<b>Vous</b><br>Cliquez pour annuler vos actions';
    if (e.role) return `<b>${e.name}</b> (${e.role})<br>Vitesse ${e.stats.speed} · Service ${e.stats.service}`;
    return null;
  }

  // ------------------------------------------------------------- phases
  onPhase({ phase, first, report }) {
    const g = this.game;
    this.hud.hidden = false;
    this.hud.dataset.phase = phase;
    this.root.dataset.phase = phase;
    this.panels.closeAll();
    this.build.exit();
    if (phase === 'prep') {
      this._queueWarned = false;
      if (first) this.coach.start();
      else {
        if (this.pendingLevel) {
          this.panels.queue('levelup', { level: this.pendingLevel });
          this.pendingLevel = null;
        }
        this.panels.queue('morning');
      }
    }
    if (phase === 'service') this.toast(`Le bar est ouvert ! ${g.weekdayName()} soir.`, 'good', 'beer');
    if (phase === 'report') setTimeout(() => this.panels.open('report', { report }), 600);
    this.refreshAll();
    this.coach.onPhase(phase);
  }

  openBar() {
    const g = this.game;
    const st = g.state;
    // warn about empty taps
    const empty = st.taps.filter((t) => t.beerId && t.level <= 0 && g.inventory.kegs(t.beerId) <= 0);
    if (empty.length && !this._warnedEmpty) {
      this._warnedEmpty = true;
      return this.toast('Attention : une tireuse est vide et sans fût en réserve. Cliquez encore pour ouvrir quand même.', 'warn', 'keg');
    }
    this._warnedEmpty = false;
    g.morningRestock();
    g.openBar();
    g.save.write();
  }

  refreshAll() {
    this.refreshBrand();
    this.refreshSpeed();
    this.refreshObjectives();
    this.refreshHands();
    this.refreshStock();
  }

  refreshBrand() {
    const g = this.game;
    const st = g.state;
    if (!st) return;
    this.brand.querySelector('.brand-name').textContent = st.barName;
    this.brand.querySelector('.lvl-badge').textContent = 'Niv. ' + st.level;
    this.brand.querySelector('.stars').innerHTML = starsHTML(g.starsExact(), iconHTML, 15);
    const cur = LEVELS.find((l) => l.level === st.level), next = LEVELS.find((l) => l.level === st.level + 1);
    const k = next ? (st.xp - cur.xp) / (next.xp - cur.xp) : 1;
    this.brand.querySelector('.xpbar i').style.width = Math.min(100, Math.max(2, k * 100)) + '%';
    this.brand.querySelector('.lvl-name').textContent = cur.name + (next ? ` · ${Math.round(st.xp)}/${next.xp} XP` : ' · niveau max');
  }

  refreshSpeed() {
    const g = this.game;
    for (const b of this.speedEl.querySelectorAll('button')) {
      const s = +b.dataset.speed;
      b.classList.toggle('on', s === 0 ? g.paused : !g.paused && g.speed === s);
    }
    this.hud.classList.toggle('paused', g.paused);
  }

  refreshObjectives() {
    const g = this.game;
    if (!g.state) return;
    const o = g.state.objectives;
    clear(this.objectives);
    this.objectives.append(h('div', { class: 'obj-title', html: `${iconHTML('trophy', 16)} Objectifs` }));
    for (const id of o.active) {
      const d = OBJECTIVES.find((x) => x.id === id);
      if (!d) continue;
      const v = Math.min(d.target, d.check(g));
      const k = v / d.target;
      this.objectives.append(h('div', { class: 'obj' }, h('div', { class: 'obj-text', text: d.text }), h('div', { class: 'obj-bar' }, h('i', { style: { width: Math.max(3, k * 100) + '%' } })), h('div', { class: 'obj-meta', text: `${Math.floor(v)}/${d.target} · +${d.reward} €${d.perNight ? ' · en 1 soirée' : ''}` })));
    }
  }

  refreshHands() {
    const g = this.game;
    const o = g.owner;
    if (!o) return;
    clear(this.hands);
    const slots = h('div', { class: 'slots' });
    for (let i = 0; i < o.capacity; i++) {
      const it = o.hands[i];
      slots.append(h('div', { class: 'slot' + (it ? ' full q-' + (it.q || 'good') : ''), title: it ? g.products.get(it.pid).short + ' · ' + (QUALITY[it.q || 'good']?.label || '') : '', html: it ? itemIconHTML(g.products.get(it.pid), 30) + (it.q === 'perfect' ? `<em>${iconHTML('star', 12)}</em>` : '') : '' }));
    }
    const extra = [];
    if (o.dirtyCount) extra.push(h('div', { class: 'carry dirty', html: `${iconHTML('glass', 20)}<span>×${o.dirtyCount} sale${o.dirtyCount > 1 ? 's' : ''}</span>` }));
    if (o.carrying) extra.push(h('div', { class: 'carry', html: `${iconHTML(o.carrying.kind === 'keg' ? 'keg' : 'crate', 20)}<span>${o.carrying.kind === 'keg' ? 'Fût' : 'Caisses'}</span>` }));
    const q = h('div', { class: 'queue' });
    const list = [...(o.current ? [o.current] : []), ...o.queue];
    list.forEach((t, i) => {
      const chip = h('button', { class: 'qchip' + (i === 0 && o.current ? ' active' : ''), title: (t.label || '') + ' — cliquer pour annuler', onClick: () => o.removeTask(t) }, h('span', { class: 'n', text: String(i + 1) }), h('span', { html: iconHTML(t.icon || 'warning', 16) }));
      q.append(chip);
    });
    if (!list.length) q.append(h('span', { class: 'q-empty', text: g.phase === 'service' ? 'Cliquez sur un client, une tireuse, une table…' : '' }));
    this.hands.append(h('div', { class: 'hands-label', text: 'Mains' }), slots, ...extra, q, this.combo);
  }

  refreshStock() {
    const g = this.game;
    if (!g.state) return;
    const P = g.products;
    clear(this.stock);
    this.stock.append(h('div', { class: 'stock-title', html: `${iconHTML('box', 16)} Stock` }));
    for (const t of g.taps) {
      if (!t.beer) {
        this.stock.append(h('div', { class: 'srow muted', html: `${iconHTML('tap', 18)}<span>Tireuse ${t.index + 1} : vide</span>` }));
        continue;
      }
      const k = t.level / t.beer.kegSize;
      const kegs = g.inventory.kegs(t.st.beerId);
      const cls = t.broken ? 'bad' : k <= 0 ? 'bad' : k < 0.25 ? 'warn' : '';
      const row = h('div', { class: 'srow ' + cls },
        h('span', { html: itemIconHTML(t.beer, 20) }),
        h('div', { class: 'sinfo' }, h('div', { class: 'sname', text: `${t.index + 1}. ${t.beer.short}` }), h('div', { class: 'gauge' }, h('i', { style: { width: k * 100 + '%' } }))),
        h('span', { class: 'snum', text: t.broken ? 'PANNE' : `${t.level}` }),
        h('span', { class: 'sres', title: 'Fûts en réserve', html: `${iconHTML('keg', 14)}${kegs}` }),
      );
      this.stock.append(row);
    }
    const f = g.fridge;
    const fr = h('div', { class: 'sgroup' }, h('div', { class: 'sgroup-title', html: `${iconHTML('fridge', 16)} Frigo <small>${f.total()}/${f.capacity}</small>` }));
    for (const p of f.products) {
      const n = f.count(p), res = g.inventory.bottles(p);
      fr.append(h('div', { class: 'srow mini ' + (n === 0 ? 'bad' : n < 4 ? 'warn' : '') }, h('span', { html: itemIconHTML(P.get(p), 18) }), h('span', { class: 'sname', text: P.get(p).short }), h('span', { class: 'snum', text: String(n) }), h('span', { class: 'sres', title: 'En réserve', html: `${iconHTML('crate', 13)}${res}` })));
    }
    if (g.phase === 'service' || g.phase === 'closing') fr.append(h('button', { class: 'btn tiny', onClick: () => g.tasks.fridgeFill().forEach((t) => g.owner.enqueue(t)), html: `${iconHTML('crate', 14)} Remplir le frigo` }));
    this.stock.append(fr);
    const foods = g.menuFoods();
    if (foods.length) {
      const fo = h('div', { class: 'sgroup' }, h('div', { class: 'sgroup-title', html: `${iconHTML('food', 16)} Cuisine` }));
      for (const p of foods) {
        const n = g.inventory.portions(p.id);
        fo.append(h('div', { class: 'srow mini ' + (n === 0 ? 'bad' : n < 4 ? 'warn' : '') }, h('span', { html: itemIconHTML(p, 18) }), h('span', { class: 'sname', text: p.short }), h('span', { class: 'snum', text: String(n) })));
      }
      this.stock.append(fo);
    }
    const gl = g.glasses.clean;
    this.stock.append(h('div', { class: 'srow glasses ' + (gl === 0 ? 'bad' : gl < 4 ? 'warn' : '') }, h('span', { html: iconHTML('glass', 18) }), h('span', { class: 'sname', text: 'Verres propres' }), h('span', { class: 'snum', text: `${gl}/${g.state.glasses}` }), g.dishwasher.washing || g.dishwasher.queue ? h('span', { class: 'sres', html: `${iconHTML('wash', 14)}${g.dishwasher.washing + g.dishwasher.queue}` }) : null));
    const used = g.inventory.used(), cap = g.inventory.capacity;
    this.stock.append(h('div', { class: 'srow reserve' }, h('span', { html: iconHTML('box', 16) }), h('span', { class: 'sname', text: 'Réserve' }), h('div', { class: 'gauge wide' }, h('i', { style: { width: Math.min(100, (used / cap) * 100) + '%' } })), h('span', { class: 'snum', text: `${Math.ceil(used)}/${cap}` })));
  }

  refreshTickets() {
    const g = this.game;
    const P = g.products;
    const tickets = g.orders.tickets.filter((t) => t.open);
    const key = tickets.map((t) => t.id + ':' + t.items.map((i) => (i.done ? 1 : i.cancelled ? 2 : 0)).join('')).join('|');
    if (key !== this._tkey) {
      this._tkey = key;
      clear(this.tickets);
      for (const t of tickets.slice(0, 8)) {
        const items = h('div', { class: 'titems' });
        for (const it of t.items) {
          if (it.cancelled) continue;
          const p = P.get(it.pid);
          const avail = g.inventory.available(it.pid);
          const out = !it.done && avail <= 0;
          const el = h('div', { class: 'titem' + (it.done ? ' done' : '') + (out ? ' out' : '') + (it.free ? ' free' : ''), title: p.name + (out ? ' — RUPTURE' : '') + (it.free ? ' (offerte)' : '') }, h('span', { html: itemIconHTML(p, 26) }));
          if (it.done) el.append(h('span', { class: 'tick', html: iconHTML('check', 14) }));
          if (out) {
            el.append(h('button', { class: 'rupture', title: 'Annoncer la rupture : le client choisit autre chose', text: 'Rupture', onClick: (e) => { e.stopPropagation(); this.announceRupture(t, it); } }));
          }
          items.append(el);
        }
        const card = h('div', { class: 'panel ticket', 'data-id': t.id, title: 'Cliquer : le patron prépare et sert cette commande', onClick: () => { this.focusGroup(t.group); g.prepareTicket(t); } },
          h('div', { class: 'thead' }, h('b', { text: t.label }), h('span', { class: 'twho', html: t.group.regular ? `${iconHTML('star', 12)} ${t.group.regular.name}` : t.group.critic ? `${iconHTML('book', 12)} Critique` : t.group.type.name })),
          items,
          h('div', { class: 'tpat' }, h('i')),
        );
        this.tickets.append(card);
      }
    }
    // patience bars
    for (const card of this.tickets.children) {
      const t = tickets.find((x) => String(x.id) === card.dataset.id);
      if (!t) continue;
      const f = t.group.pendingItems().length ? t.group.patienceFrac : 1;
      const bar = card.querySelector('.tpat i');
      bar.style.width = f * 100 + '%';
      card.dataset.mood = f > 0.5 ? 'ok' : f > 0.25 ? 'warn' : 'bad';
    }
  }

  announceRupture(ticket, it) {
    const g = this.game;
    const grp = ticket.group;
    const p = g.products.get(it.pid);
    it.cancelled = true;
    if (it.member) it.member.budget += it.price;
    grp.sat -= 12;
    const m = it.member || grp.members[0];
    m.say(line('rupture', { beer: p.short }), 'angry');
    m.view.setAction('angry');
    setTimeout(() => m.view.action === 'angry' && m.view.setAction(null), 1500);
    // alternative choice
    const menu = g.menu();
    const pool = (p.category === 'food' ? menu.foods : menu.drinks).filter((x) => x !== it.pid && g.inventory.available(x) > 0);
    if (pool.length) {
      const alt = p.category === 'food' ? g.customers.chooseFood(grp, pool) : g.customers.chooseDrink(grp, m, pool);
      if (alt) {
        const price = g.priceOf(alt);
        if (!it.member || it.member.budget >= price) {
          if (it.member) it.member.budget -= price;
          ticket.items.push({ pid: alt, member: it.member, price, done: false, cancelled: false });
        }
      }
    }
    if (m.regular && m.regular.favorite === it.pid) {
      grp.sat -= 10;
      m.regular.loyalty = Math.max(0, m.regular.loyalty - 1);
    }
    g.bus.emit('rupture', { pid: it.pid });
  }

  focusGroup(group) {
    const s = group.spots[0];
    if (!s) return;
    const rig = this.game.world.rig;
    rig.goal.target = [s.center.x, 0, s.center.z + 0.5];
  }

  refreshTop() {
    const g = this.game;
    const st = g.state;
    if (!st) return;
    // money
    this.moneyEl.querySelector('.money-main b').textContent = eur(st.money);
    const n = g.night;
    this.moneyEl.querySelector('.money-sub').textContent = n ? `Ce soir : ${eur(n.revenue + n.tips)}` : `Charges ce soir : ~${eur(g.rent() + st.staff.reduce((s, x) => s + x.salary, 0) + CONFIG.electricityBase + st.taps.length * CONFIG.electricityPerTap)}`;
    const cnt = g.customers.customerCount();
    const seats = g.bar.seatCount();
    this.moneyEl.querySelector('.guests').innerHTML = `${iconHTML('people', 16)} ${cnt}/${seats}`;
    const groups = g.customers.present().filter((x) => x.state !== 'arriving' && x.state !== 'queue');
    const sat = groups.length ? groups.reduce((s, x) => s + x.sat * x.size, 0) / groups.reduce((s, x) => s + x.size, 0) : n && n.satN ? n.satSum / n.satN : null;
    const satEl = this.moneyEl.querySelector('.sat');
    satEl.innerHTML = `${iconHTML('heart', 16)} ${sat === null ? '–' : Math.round(sat) + ' %'}`;
    satEl.dataset.mood = sat === null ? '' : sat >= 70 ? 'ok' : sat >= 45 ? 'warn' : 'bad';
    // clock
    const isService = g.phase === 'service' || g.phase === 'closing';
    this.clockEl.querySelector('.day').textContent = `${g.weekdayName()} · Jour ${st.day}`;
    this.clockEl.querySelector('.time').textContent = isService ? fmtTime(g.clock) : 'Préparation';
    const k = isService ? Math.min(1, (g.clock - CONFIG.serviceStart) / (CONFIG.closing - CONFIG.serviceStart)) : 0;
    this.clockEl.querySelector('.clock-bar i').style.width = k * 100 + '%';
    const chips = this.clockEl.querySelector('.chips');
    const w = g.director.weather();
    const ev = g.activeEvent();
    const trend = st.calendar?.trend;
    const key = w.id + (ev?.id || '') + (trend?.pid || '') + g.phase;
    if (chips.dataset.key !== key) {
      chips.dataset.key = key;
      clear(chips);
      chips.append(h('span', { class: 'chip', title: w.name, html: `${iconHTML(w.icon, 14)} ${w.name}` }));
      if (ev) chips.append(h('span', { class: 'chip event', html: `${iconHTML(ev.icon, 14)} ${ev.name}` }));
      if (trend) chips.append(h('span', { class: 'chip trend', title: 'Bière à la mode : demande ×2', html: `${iconHTML('fire', 14)} ${g.products.get(trend.pid).short}` }));
    }
    this.refreshCombo();
  }

  refreshCombo() {
    const g = this.game;
    const n = g.combo.n;
    const fire = g.onFire();
    const show = (g.phase === 'service' || g.phase === 'closing') && (n > 0 || fire || this.combo.classList.contains('break'));
    this.combo.hidden = !show;
    if (!show) return;
    this.combo.dataset.level = n >= 10 ? 3 : n >= 5 ? 2 : n >= 3 ? 1 : 0;
    this.combo.querySelector('.combo-n').textContent = '×' + n;
    const pips = this.combo.querySelectorAll('.combo-pips i');
    const k = n % 5;
    pips.forEach((p, i) => p.classList.toggle('on', i < k || (n > 0 && k === 0)));
    const tip = Math.round((g.comboMult() - 1) * 100);
    this.combo.querySelector('.combo-sub').textContent = tip > 0 ? `pourboires +${tip} %` : 'enchaînez les services parfaits';
    const fe = this.combo.querySelector('.combo-fire');
    fe.hidden = !fire;
    if (fire) fe.querySelector('i').style.width = Math.max(0, Math.min(1, (g.combo.fireUntil - g.simTime) / 16)) * 100 + '%';
  }

  // ------------------------------------------------------------- rush (chaos moments)
  rushAnnounce(r) {
    this.rushAlert.hidden = false;
    this.rushAlert.className = 'rush-alert show';
    this.rushAlert.innerHTML = `<div class="ra-top">${iconHTML(r.def.icon, 34)}<b></b></div><div class="ra-sub">${r.def.sub}</div><div class="ra-tips">Remplissez le frigo, préparez les fûts, débarrassez les tables !</div>`;
    this._rushRef = r;
    this.game.audio?.rushAlarm?.();
    this.updateRush();
  }
  rushStart(r) {
    this.rushAlert.hidden = true;
    this.showBanner(r.def.go, r.def.icon);
    this.rushLive.hidden = false;
    this.hud.classList.add('rush-on');
    this._rushRef = r;
    this.updateRush();
  }
  rushEnd(sm) {
    const g = this.game;
    this.rushLive.hidden = true;
    this.rushAlert.hidden = true;
    this.hud.classList.remove('rush-on');
    this._rushRef = null;
    const row = (ic, label, v, cls = '') => `<div class="rs-row ${cls}">${iconHTML(ic, 18)}<span>${label}</span><b>${v}</b></div>`;
    const verdict = ['', 'Débordé… mais vivant !', 'Rush encaissé !', 'RUSH MAÎTRISÉ !'][sm.grade];
    this.rushSummary.innerHTML = `
      <div class="rs-head">${iconHTML(sm.icon, 30)}<div><b>RUSH TERMINÉ !</b><small>${verdict}</small></div><span class="rs-stars">${'★'.repeat(sm.grade)}<i>${'★'.repeat(3 - sm.grade)}</i></span></div>
      <div class="rs-grid">
        ${row('people', 'Clients servis', sm.customers)}
        ${row('beer', 'Commandes servies', sm.served)}
        ${row('coin', 'Chiffre d’affaires', eur(sm.revenue), 'good')}
        ${row('heart', 'Pourboires', eur(sm.tips, sm.tips % 1 ? 2 : 0), 'good')}
        ${row('star', 'Services parfaits', sm.perfect, sm.perfect ? 'gold' : '')}
        ${row('cross', 'Commandes ratées', sm.failed, sm.failed ? 'bad' : '')}
        ${row('door', 'Clients perdus', sm.lost, sm.lost ? 'bad' : '')}
        ${row('trophy', 'Réputation', (sm.rep >= 0 ? '+' : '−') + Math.abs(sm.rep).toFixed(1), sm.rep >= 0 ? 'good' : 'bad')}
      </div>
      <div class="rs-foot"><span>+${sm.xp} XP</span><button class="btn primary">Au boulot !</button></div>`;
    this.rushSummary.hidden = false;
    this.rushSummary.classList.remove('show');
    void this.rushSummary.offsetWidth;
    this.rushSummary.classList.add('show');
    const close = () => (this.rushSummary.hidden = true);
    this.rushSummary.querySelector('button').onclick = close;
    clearTimeout(this._rsT);
    this._rsT = setTimeout(close, 9000);
    g.world.effects.burst('confetti', [g.owner.pos.x, 2.2, g.owner.pos.z], 36);
    g.audio?.fanfare();
  }
  updateRush() {
    const g = this.game;
    const r = this._rushRef;
    if (!r || (g.phase !== 'service' && g.phase !== 'closing')) {
      this.rushAlert.hidden = true;
      this.rushLive.hidden = true;
      this.hud.classList.remove('rush-on');
      return;
    }
    if (r.phase === 'announce') {
      const m = Math.max(1, Math.ceil(r.at - g.clock));
      const b = this.rushAlert.querySelector('b');
      const txt = r.def.announce.replace('{m}', m);
      if (b.textContent !== txt) b.textContent = txt;
    } else if (r.phase === 'live') {
      const s = r.stats;
      const k = Math.max(0, Math.min(1, (r.end - g.clock) / (r.end - r.at)));
      const key = `${s.served}|${s.perfect}|${s.failed}|${Math.round(s.revenue)}`;
      if (this.rushLive.dataset.key !== key) {
        this.rushLive.dataset.key = key;
        this.rushLive.innerHTML = `<div class="rl-top">${iconHTML('fire', 18)}<b>RUSH !</b><span>${r.def.go}</span></div><div class="rl-bar"><i></i></div><div class="rl-stats"><span>${iconHTML('beer', 14)} ${s.served}</span><span class="gold">${iconHTML('star', 14)} ${s.perfect}</span><span class="${s.failed ? 'bad' : ''}">${iconHTML('cross', 14)} ${s.failed}</span><span>${iconHTML('coin', 14)} ${eur(s.revenue)}</span></div>`;
      }
      this.rushLive.querySelector('.rl-bar i').style.width = k * 100 + '%';
    }
  }

  // ------------------------------------------------------------- feedback
  toast(text, kind = 'info', icon) {
    // never cover a service mini-game: messages wait until it is over
    if (this.game.minigames?.active) {
      (this._deferred ||= []).push([text, kind, icon]);
      if (this._deferred.length > 3) this._deferred.shift();
      return;
    }
    const el = h('div', { class: 'toast ' + kind }, icon ? h('span', { html: iconHTML(icon, 20) }) : null, h('span', { text }));
    this.toasts.prepend(el);
    while (this.toasts.children.length > 3) this.toasts.lastChild.remove();
    setTimeout(() => el.classList.add('out'), 3800);
    setTimeout(() => el.remove(), 4300);
    this.game.audio?.ui(kind);
  }

  showBanner(text, icon) {
    this.banner.hidden = false;
    this.banner.innerHTML = `${iconHTML(icon || 'fire', 28)}<span>${text}</span>`;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => (this.banner.hidden = true), 3200);
    this.game.audio?.sting();
  }

  emote(pos, icon, size = 30) {
    this.game.world.overlay.floatHTML(iconHTML(icon, size), pos, 'emote', 1.3);
  }

  speech(customer, text, cls) {
    const g = this.game;
    if (customer._speech) customer._speech.remove();
    const el = h('div', { class: 'speech ' + (cls || '') }, h('span', { text }));
    const handle = g.world.overlay.add(el, () => [customer.pos.x, 1.95 * customer.look.height + customer.view.root.position[1], customer.pos.z], { offsetY: -30 });
    customer._speech = handle;
    setTimeout(() => {
      if (customer._speech === handle) customer._speech = null;
      handle.remove();
    }, 2800);
  }

  showPicker(title, items, onPick, withFill) {
    const g = this.game;
    clear(this.picker);
    this.picker.append(h('div', { class: 'picker-title', text: title }));
    const row = h('div', { class: 'picker-row' });
    for (const it of items) {
      const p = g.products.get(it.pid);
      row.append(h('button', { class: 'pick' + (it.count <= 0 ? ' empty' : ''), onClick: () => { this.hidePicker(); onPick(it.pid); } }, h('span', { html: itemIconHTML(p, 34) }), h('span', { class: 'pn', text: p.short }), h('span', { class: 'pc', text: String(it.count) })));
    }
    if (withFill) row.append(h('button', { class: 'pick fill', onClick: () => { this.hidePicker(); onPick('__fill'); } }, h('span', { html: iconHTML('crate', 34) }), h('span', { class: 'pn', text: 'Remplir' }), h('span', { class: 'pc', text: 'réserve' })));
    this.picker.append(row);
    this.picker.hidden = false;
    const xy = g.hoverXY || { x: innerWidth / 2, y: innerHeight / 2 };
    const pw = this.picker.offsetWidth, ph = this.picker.offsetHeight;
    this.picker.style.left = Math.max(8, Math.min(innerWidth - pw - 8, xy.x - pw / 2)) + 'px';
    this.picker.style.top = Math.max(8, Math.min(innerHeight - ph - 8, xy.y - ph - 20)) + 'px';
  }
  hidePicker() {
    this.picker.hidden = true;
  }

  // world tap interception (build mode)
  handleWorldTap(x, y) {
    if (this.build.active) return this.build.tap(x, y);
    return false;
  }

  inspect(e) {
    const g = this.game;
    if (g.phase !== 'prep') return;
    if (e.kind === 'tap' || e.kind === 'fridge') return this.panels.open('bar');
    if (e.kind === 'board' || e.kind === 'snack') return this.panels.open('menu');
    if (e.kind === 'table' || e.furniture) return this.build.enter();
  }

  // ------------------------------------------------------------- loop
  update(dt) {
    const g = this.game;
    if (!g.state) return;
    this.t += dt;
    const now = performance.now();
    this.slowT = (now - (this._lastSlow || 0)) / 1000;
    this.build.update(dt);
    this._hoverCheck?.();
    if (g.phase === 'service' || g.phase === 'closing') this.refreshTickets();
    if (this._rushRef || !this.rushLive.hidden || !this.rushAlert.hidden) this.updateRush();
    if (this._deferred?.length && !g.minigames?.active) for (const d of this._deferred.splice(0)) this.toast(...d);
    if (this.slowT > 0.25) {
      this._lastSlow = now;
      this.refreshTop();
      this.refreshStock();
      this.refreshBrand();
      if (this.t - (this._objT || 0) > 1) {
        this._objT = this.t;
        this.refreshObjectives();
      }
      this.refreshHandsIfChanged();
    }
    this.coach.update(dt);
    this.panels.update(dt);
  }

  refreshHandsIfChanged() {
    const o = this.game.owner;
    if (!o) return;
    const key = o.hands.map((x) => x.pid + (x.q || '')).join(',') + '|' + o.dirtyCount + '|' + (o.carrying?.kind || '') + '|' + o.capacity + '|' + o.queue.length + (o.current?.kind || '');
    if (key !== this._hkey) {
      this._hkey = key;
      this.refreshHands();
    }
  }
}
