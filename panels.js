// Modal panels: stock, taps & fridge, menu & prices, upgrades, staff, events, regulars, morning paper, night report, level up, settings, title.
import { h, clear, eur, starsHTML } from './dom.js';
import { iconHTML, itemIconHTML } from './icons.js';
import { SUPPLIERS, UPGRADES, UPGRADE_CATS, PREMIUM_ONLY } from '../data/upgrades.js';
import { EVENTS } from '../data/events.js';
import { LEVELS, STAFF_ROLES } from '../data/progression.js';
import { CATALOG } from '../data/catalog.js';
import { BEERS } from '../data/beers.js';
import { SOFTS, FOODS } from '../data/products.js';
import { CUSTOMER_TYPES } from '../data/customers.js';
import { WEEKDAYS } from '../data/names.js';
import { QUALITY } from '../data/service.js';

export class Panels {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.root = h('div', { class: 'modal-root', hidden: true });
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root && this.current && !this.current.sticky) this.close();
    });
    ui.root.append(this.root);
    this.current = null;
    this.game.bus.on('money', () => this.current?.live && this.render());
    this.game.bus.on('stock', () => this.current?.live && this.render());
  }

  /** open now, or after the current modal is closed */
  queue(id, opts = {}) {
    if (this.current) {
      (this._queue ||= []).push([id, opts]);
      return;
    }
    this.open(id, opts);
  }

  open(id, opts = {}) {
    this.current = { id, opts, sticky: ['report', 'title', 'levelup'].includes(id), live: ['stock', 'upgrades', 'bar', 'menu', 'staff', 'events'].includes(id) };
    this.render();
    this.root.hidden = false;
    this.game.audio?.ui('open');
  }
  close() {
    const c = this.current;
    this.current = null;
    this.root.hidden = true;
    clear(this.root);
    if (c?.opts?.onClose) c.opts.onClose();
    this.ui.refreshAll();
    this.game.bus.emit('panelClosed', { id: c?.id });
    if (this._queue?.length && !this._flushing) {
      const [nid, nopts] = this._queue.shift();
      setTimeout(() => this.open(nid, nopts), 150);
    }
  }
  closeAll() {
    this._flushing = true;
    if (this.current) this.close();
    this._flushing = false;
  }
  update() {}

  render() {
    const c = this.current;
    if (!c) return;
    const scroll = this.root.querySelector('.modal-body')?.scrollTop || 0;
    clear(this.root);
    const fn = this['p_' + c.id];
    if (!fn) return;
    const body = fn.call(this, c.opts);
    this.root.append(body);
    const mb = this.root.querySelector('.modal-body');
    if (mb) mb.scrollTop = scroll;
  }

  frame(title, icon, content, opts = {}) {
    const m = h('div', { class: 'panel modal ' + (opts.cls || '') });
    const head = h('div', { class: 'modal-head' }, h('span', { class: 'mh-ico', html: iconHTML(icon, 30) }), h('h2', { text: title }));
    if (opts.sub) head.append(h('div', { class: 'mh-sub', html: opts.sub }));
    if (!opts.noClose) head.append(h('button', { class: 'icon-btn close', title: 'Fermer', html: iconHTML('close', 18), onClick: () => this.close() }));
    m.append(head, h('div', { class: 'modal-body' }, content));
    if (opts.foot) m.append(h('div', { class: 'modal-foot' }, opts.foot));
    return m;
  }

  moneyLine() {
    const g = this.game;
    return `${iconHTML('coin', 16)} <b>${eur(g.state.money)}</b>`;
  }

  // =========================================================== stock
  p_stock(opts) {
    const g = this.game;
    const P = g.products;
    const service = g.phase === 'service' || g.phase === 'closing';
    const tab = opts.tab || 'draft';
    const tabs = h('div', { class: 'tabs' });
    const mk = (id, label) => h('button', { class: 'tab' + (tab === id ? ' on' : ''), onClick: () => { opts.tab = id; this.render(); } }, label);
    tabs.append(mk('draft', 'Fûts pression'), mk('bottle', 'Bouteilles & softs'), mk('food', 'Nourriture'));
    if (!service) tabs.append(mk('contracts', 'Contrats'));
    if (tab === 'contracts') return this.frame('Marchandises', 'cart', h('div', {}, tabs, this.contractsView()), { cls: 'wide', sub: 'Un contrat avec une brasserie : une prime tout de suite et des fûts moins chers… mais sa bière doit rester à la pression.' });
    const used = g.inventory.used(), cap = g.inventory.capacity;
    const head = h('div', { class: 'stock-head' },
      h('div', { class: 'res-cap' }, h('span', { html: `${iconHTML('box', 18)} Réserve <b>${Math.ceil(used)}/${cap}</b> places` }), h('div', { class: 'gauge wide' }, h('i', { style: { width: Math.min(100, (used / cap) * 100) + '%' } }))),
      h('div', { class: 'money-inline', html: this.moneyLine() }),
    );
    const sups = service ? SUPPLIERS.filter((s) => s.when === 'always') : SUPPLIERS.filter((s) => s.when === 'prep');
    const supInfo = h('div', { class: 'sup-info' }, ...sups.map((s) => h('div', { class: 'sup' }, h('b', { text: s.name }), h('span', { text: ' — ' + s.desc }))));
    const list = h('div', { class: 'plist' });
    const lvl = g.level();
    let items = [];
    if (tab === 'draft') items = BEERS.filter((b) => b.serve === 'tap').map((b) => P.get(b.id));
    else if (tab === 'bottle') items = [...BEERS.filter((b) => b.serve === 'bottle').map((b) => P.get(b.id)), ...SOFTS.map((s) => P.get(s.id))];
    else items = FOODS.map((f) => P.get(f.id));
    for (const p of items) {
      const locked = p.level > lvl;
      const station = p.category === 'draft' ? g.taps.filter((t) => t.st.beerId === p.id).reduce((s, t) => s + t.level, 0) : p.category === 'food' ? 0 : g.fridge.count(p.id);
      const res = p.category === 'draft' ? g.inventory.kegs(p.id) : p.category === 'food' ? g.inventory.portions(p.id) : g.inventory.bottles(p.id);
      const onMenu = g.menu().drinks.includes(p.id) || g.menu().foods.includes(p.id);
      const needsEquip = p.category === 'food' && ((p.station === 'snack' && !g.up('snack')) || (p.requires && !g.up(p.requires)));
      const row = h('div', { class: 'prow' + (locked ? ' locked' : '') + (onMenu ? ' onmenu' : '') });
      row.append(
        h('div', { class: 'pico', html: itemIconHTML(p, 40) }),
        h('div', { class: 'pmain' },
          h('div', { class: 'pname' }, h('b', { text: p.name }), onMenu ? h('span', { class: 'tag', text: 'à la carte' }) : null, g.trendMult(p.id) > 1 ? h('span', { class: 'tag trend', html: `${iconHTML('fire', 12)} tendance` }) : null),
          h('div', { class: 'pmeta', html: `${p.styleLabel || ''}${p.quality ? ' · ' + starsHTML(p.quality, iconHTML, 11) : ''}` }),
          h('div', { class: 'pdesc', text: locked ? `Débloqué au niveau ${p.level} (${LEVELS[p.level - 1].name})` : needsEquip ? 'Nécessite un équipement (Améliorer)' : p.desc || '' }),
        ),
        h('div', { class: 'pstock' },
          h('div', { html: `<small>${p.category === 'draft' ? 'Fûts' : p.category === 'food' ? 'Portions' : 'Réserve'}</small><b>${res}</b>` }),
          p.category === 'draft' || p.category === 'bottle' || p.category === 'soft' ? h('div', { html: `<small>${p.category === 'draft' ? 'En tireuse' : 'Frigo'}</small><b>${station}</b>` }) : null,
          h('div', { html: `<small>Coût/service</small><b>${eur(p.unitCost, 2)}</b>` }),
        ),
      );
      const buy = h('div', { class: 'pbuy' });
      if (!locked) {
        for (const s of sups.filter((x) => x.when === 'always' || PREMIUM_ONLY.includes(p.id) === !!x.premium)) {
          const n = s.qty;
          const cost = g.packPrice(p.id, s.id) * n;
          const units = g.inventory.unitsFor(p.id, n);
          const can = g.state.money >= cost && units <= g.inventory.free();
          buy.append(h('button', { class: 'btn buy ' + s.id + (can ? '' : ' disabled'), title: `${s.name} : ${n} × ${p.packLabel}`, onClick: () => { g.buyStock(p.id, s.id); this.render(); } },
            h('span', { class: 'bq', text: `${n > 1 ? n + ' × ' : '+1 '}${p.category === 'draft' ? 'fût' + (n > 1 ? 's' : '') : p.category === 'food' ? (p.kegSize > 1 ? p.packLabel.split(' ')[0] : 'kit') : 'caisse' + (n > 1 ? 's' : '')}` }),
            h('span', { class: 'bp', text: eur(cost, cost % 1 ? 2 : 0) }),
            h('span', { class: 'bs', text: { megadis: 'Mégadis', depot: 'Dépôt', eclair: 'Éclair', moines: 'Moines' }[s.id] }),
          ));
        }
      }
      row.append(buy);
      list.append(row);
    }
    return this.frame(service ? 'Commande express' : 'Marchandises', 'cart', h('div', {}, head, tabs, supInfo, list), { cls: 'wide', sub: service ? 'Livraison Éclair : livré en ~20 s dans la réserve, même en plein rush.' : 'Achetez avant d’ouvrir. Attention : trop de stock immobilise votre argent et votre réserve.' });
  }

  contractsView() {
    const g = this.game;
    const st = g.state;
    const wrap = h('div', { class: 'contracts' });
    const c = st.contract;
    if (c && c.until >= st.day) {
      const p = g.products.get(c.pid);
      wrap.append(h('div', { class: 'planned', html: `${itemIconHTML(p, 26)} Contrat en cours : <b>${p.name}</b> · −${Math.round((1 - c.discount) * 100)} % sur les fûts jusqu’au jour ${c.until} · pénalité ${eur(c.penalty)} par soir sans elle à la pression` }));
    }
    if (g.level() < 2) {
      wrap.append(h('p', { class: 'locked-line', html: `${iconHTML('lock', 16)} Les brasseries proposent des contrats à partir du niveau 2.` }));
      return wrap;
    }
    const grid = h('div', { class: 'cards' });
    for (const o of g.contractOffers()) {
      const p = g.products.get(o.pid);
      const busy = c && c.until >= st.day;
      grid.append(h('div', { class: 'card' },
        h('div', { class: 'card-ico', html: itemIconHTML(p, 42) }),
        h('div', { class: 'card-title' }, h('b', { text: `Brasserie ${p.name}` }), h('span', { class: 'card-lvl', text: `${o.days} jours` })),
        h('div', { class: 'card-desc', html: `Prime à la signature : <b>+${eur(o.bonus)}</b><br>Fûts : <b>−${Math.round((1 - o.discount) * 100)} %</b><br>Condition : ${p.short} à la pression chaque soir, sinon <b>−${eur(o.penalty)}</b>.` }),
        h('button', { class: 'btn ' + (busy ? 'disabled' : 'primary'), onClick: () => { if (!busy) { g.signContract(o); this.render(); } } }, busy ? 'Un contrat à la fois' : 'Signer'),
      ));
    }
    if (!g.contractOffers().length) wrap.append(h('p', { class: 'hint', text: 'Plus d’offre cette semaine. Revenez lundi prochain !' }));
    wrap.append(grid);
    return wrap;
  }

  // =========================================================== taps & fridge
  p_bar() {
    const g = this.game;
    const P = g.products;
    const service = g.phase === 'service' || g.phase === 'closing';
    const lvl = g.level();
    const wrap = h('div', { class: 'barcfg' });
    const tapsBox = h('div', { class: 'cfg-section' }, h('h3', { html: `${iconHTML('tap', 22)} Tireuses (${g.state.taps.length})` }));
    g.state.taps.forEach((t, i) => {
      const cur = t.beerId ? P.get(t.beerId) : null;
      const sel = h('div', { class: 'tap-choices' });
      for (const b of BEERS.filter((x) => x.serve === 'tap')) {
        const p = P.get(b.id);
        const locked = b.level > lvl;
        const kegs = g.inventory.kegs(b.id);
        const usedElsewhere = g.state.taps.some((o, j) => j !== i && o.beerId === b.id);
        sel.append(h('button', { class: 'tap-choice' + (t.beerId === b.id ? ' on' : '') + (locked ? ' locked' : ''), disabled: locked || service, title: locked ? `Niveau ${b.level}` : `${p.name} — ${kegs} fût(s) en réserve`, onClick: () => { g.assignTap(i, b.id); this.render(); } },
          h('span', { html: locked ? iconHTML('lock', 26) : itemIconHTML(p, 30) }), h('span', { class: 'tc-name', text: p.short }), h('span', { class: 'tc-meta', text: locked ? `Niv. ${b.level}` : `${kegs} fût${kegs > 1 ? 's' : ''}${usedElsewhere ? ' · déjà branchée' : ''}` })));
      }
      tapsBox.append(h('div', { class: 'tap-row' },
        h('div', { class: 'tap-head' }, h('b', { text: `Tireuse ${i + 1}` }), cur ? h('span', { text: ` · ${cur.name} — ${t.level}/${cur.kegSize} pintes` }) : h('span', { class: 'muted', text: ' · aucune bière' })),
        sel));
    });
    if (!service) tapsBox.append(h('p', { class: 'hint', text: 'Changer de bière : le fût en cours retourne en réserve s’il est à moitié plein ou plus. Pas de fût en réserve ? Passez par Marchandises.' }));
    const fridgeBox = h('div', { class: 'cfg-section' }, h('h3', { html: `${iconHTML('fridge', 22)} Frigo — ${g.fridge.capacity} places, jusqu’à 4 références` }));
    const fl = h('div', { class: 'fridge-choices' });
    const all = [...BEERS.filter((b) => b.serve === 'bottle').map((b) => P.get(b.id)), ...SOFTS.map((s) => P.get(s.id))];
    for (const p of all) {
      const locked = p.level > lvl;
      const on = g.state.fridge.products.includes(p.id);
      fl.append(h('button', { class: 'tap-choice' + (on ? ' on' : '') + (locked ? ' locked' : ''), disabled: locked || service, onClick: () => {
        let list = [...g.state.fridge.products];
        if (on) list = list.filter((x) => x !== p.id);
        else if (list.length < 4) list.push(p.id);
        else return g.toast('4 références maximum dans le frigo', 'warn');
        g.setFridgeProducts(list);
        this.render();
      } }, h('span', { html: locked ? iconHTML('lock', 26) : itemIconHTML(p, 30) }), h('span', { class: 'tc-name', text: p.short }), h('span', { class: 'tc-meta', text: locked ? `Niv. ${p.level}` : on ? `${g.fridge.count(p.id)} au frais` : `${g.inventory.bottles(p.id)} en réserve` })));
    }
    fridgeBox.append(fl, h('p', { class: 'hint', text: 'Le frigo est rempli automatiquement depuis la réserve à l’ouverture. Pendant le service, il faut aller chercher les caisses.' }));
    wrap.append(tapsBox, fridgeBox);
    return this.frame('Tireuses & frigo', 'tap', wrap, { cls: 'wide', sub: service ? 'Lecture seule pendant le service.' : 'Choisissez ce que vous servez ce soir.' });
  }

  // =========================================================== menu & prices (chalkboard)
  p_menu() {
    const g = this.game;
    const P = g.products;
    const m = g.menu();
    const ids = [...m.drinks, ...g.menuFoods().map((p) => p.id)];
    // include toggled-off foods so they can be re-enabled
    for (const f of FOODS) if (g.state.menuOff[f.id] && !ids.includes(f.id)) ids.push(f.id);
    const board = h('div', { class: 'chalk' });
    for (const id of ids) {
      const p = P.get(id);
      const price = g.basePrice(id);
      const lab = g.priceLabel(id);
      const margin = price - p.unitCost;
      const isFood = p.category === 'food';
      const off = !!g.state.menuOff[id];
      board.append(h('div', { class: 'chalk-row' + (off ? ' off' : '') },
        h('span', { class: 'cico', html: itemIconHTML(p, 30) }),
        h('div', { class: 'cname' }, h('b', { text: p.name }), h('small', { text: `Prix conseillé ${eur(p.basePrice, 2)} · coût ${eur(p.unitCost, 2)}` })),
        h('div', { class: 'cprice' },
          h('button', { class: 'icon-btn small', html: iconHTML('minus', 14), onClick: () => { g.setPrice(id, price - 0.5); this.render(); } }),
          h('b', { text: eur(price, 2) }),
          h('button', { class: 'icon-btn small', html: iconHTML('plus', 14), onClick: () => { g.setPrice(id, price + 0.5); this.render(); } }),
        ),
        h('span', { class: 'clabel ' + lab.cls, text: lab.label }),
        h('span', { class: 'cmargin', text: `marge ${eur(margin, 2)}` }),
        isFood ? h('button', { class: 'btn tiny', onClick: () => { g.state.menuOff[id] = !off; this.render(); g.world.chalk.refresh(); } }, off ? 'Remettre' : 'Retirer') : null,
      ));
    }
    return this.frame('Carte & prix', 'list', h('div', {}, h('p', { class: 'hint', text: 'Trop cher : les clients râlent et commandent moins. Pas assez cher : vous travaillez pour rien. Chaque type de client a sa sensibilité au prix.' }), board), { cls: 'wide chalk-modal' });
  }

  // =========================================================== upgrades
  p_upgrades(opts) {
    const g = this.game;
    const tab = opts.tab || 'bar';
    const tabs = h('div', { class: 'tabs' });
    for (const c of UPGRADE_CATS) tabs.append(h('button', { class: 'tab' + (tab === c.id ? ' on' : ''), onClick: () => { opts.tab = c.id; this.render(); } }, c.label));
    const grid = h('div', { class: 'cards' });
    for (const u of UPGRADES.filter((x) => x.cat === tab)) {
      const n = g.up(u.id);
      const tier = u.repeatable ? u.tiers[0] : u.tiers[n];
      const maxed = !tier;
      const locked = tier && tier.level > g.level();
      const can = tier && !locked && g.state.money >= tier.price;
      const lvlTxt = u.repeatable ? (u.id === 'glasses' ? `${g.state.glasses} verres` : '') : `${n}/${u.tiers.length}`;
      grid.append(h('div', { class: 'card' + (maxed ? ' maxed' : '') + (locked ? ' locked' : '') },
        h('div', { class: 'card-ico', html: iconHTML(u.icon, 40) }),
        h('div', { class: 'card-title' }, h('b', { text: u.name }), h('span', { class: 'card-lvl', text: lvlTxt })),
        h('div', { class: 'card-desc', text: u.desc }),
        tier?.label ? h('div', { class: 'card-next', text: 'Prochain : ' + tier.label }) : null,
        h('button', { class: 'btn ' + (can ? 'primary' : 'disabled'), onClick: () => { if (!maxed) { g.buyUpgrade(u.id); this.render(); } } },
          maxed ? 'Au maximum' : locked ? `${iconHTML('lock', 14)} Niveau ${tier.level}` : eur(tier.price)),
      ));
      grid.lastChild.querySelector('button').innerHTML = maxed ? 'Au maximum' : locked ? `${iconHTML('lock', 14)} Niveau ${tier.level}` : eur(tier.price);
    }
    return this.frame('Améliorations', 'wrench', h('div', {}, h('div', { class: 'money-inline right', html: this.moneyLine() }), tabs, grid), { cls: 'wide' });
  }

  // =========================================================== staff
  p_staff() {
    const g = this.game;
    const wrap = h('div', { class: 'staff' });
    const team = h('div', { class: 'cfg-section' }, h('h3', { html: `${iconHTML('users', 22)} Votre équipe` }));
    if (!g.state.staff.length) team.append(h('p', { class: 'hint', text: 'Personne pour l’instant : vous faites tout vous-même !' }));
    for (const s of g.state.staff) {
      team.append(h('div', { class: 'staff-row' },
        avatar(s.look, 44),
        h('div', { class: 'st-main' }, h('b', { text: `${s.name} · ${s.role === 'barman' ? 'Barman' : 'Serveur'}` }), statBars(s)),
        h('div', { class: 'st-sal', html: `<small>Salaire</small><b>${eur(s.salary)}/soir</b>` }),
        h('button', { class: 'btn tiny danger', onClick: () => { if (this._confirmFire === s.id) { g.fireStaff(s.id); this._confirmFire = null; } else { this._confirmFire = s.id; } this.render(); } }, this._confirmFire === s.id ? 'Confirmer' : 'Renvoyer'),
      ));
    }
    wrap.append(team);
    for (const role of STAFF_ROLES) {
      const sec = h('div', { class: 'cfg-section' }, h('h3', { text: `Recruter : ${role.name}` }), h('p', { class: 'hint', text: role.desc }));
      if (role.level > g.level()) {
        sec.append(h('p', { class: 'locked-line', html: `${iconHTML('lock', 16)} Débloqué au niveau ${role.level}` }));
      } else if (g.phase !== 'prep') {
        sec.append(h('p', { class: 'hint', text: 'Le recrutement se fait avant l’ouverture.' }));
      } else {
        const cands = h('div', { class: 'cands' });
        for (const c of g.staffCandidates(role.id)) {
          const hired = g.state.staff.some((s) => s.name === c.name && s.role === c.role);
          cands.append(h('div', { class: 'cand' }, avatar(c.look, 52), h('b', { text: c.name }), h('small', { text: c.trait }), statBars(c), h('div', { class: 'cand-sal', text: `${eur(c.salary)} / soir` }), h('button', { class: 'btn ' + (hired ? 'disabled' : 'primary'), onClick: () => { if (!hired) { g.hireStaff(c); this.render(); } } }, hired ? 'Embauché' : 'Embaucher')));
        }
        sec.append(cands);
      }
      wrap.append(sec);
    }
    return this.frame('Équipe', 'users', wrap, { cls: 'wide', sub: 'Les salaires sont payés à la fin de chaque soirée. Les employés progressent avec l’expérience.' });
  }

  // =========================================================== events
  p_events() {
    const g = this.game;
    const st = g.state;
    const wrap = h('div', {});
    const cal = h('div', { class: 'calendar' });
    for (let d = st.day; d < st.day + 7; d++) {
      const fx = st.calendar?.fixtures?.[d];
      const wd = WEEKDAYS[g.weekday(d)];
      cal.append(h('div', { class: 'cal-day' + (d === st.day ? ' today' : '') }, h('b', { text: d === st.day ? 'Ce soir' : wd.slice(0, 3) + '.' }), h('small', { text: 'Jour ' + d }), fx ? h('div', { class: 'cal-fx', html: `${iconHTML('ball', 16)} ${fx.name}` }) : h('div', { class: 'cal-fx muted', text: '—' }), [4, 5].includes(g.weekday(d)) ? h('div', { class: 'cal-busy', text: 'Soir chargé' }) : null));
    }
    wrap.append(h('h3', { html: `${iconHTML('calendar', 20)} Les 7 prochains jours` }), cal);
    const planned = g.activeEvent();
    if (planned) wrap.append(h('div', { class: 'planned', html: `${iconHTML(planned.icon, 22)} Ce soir : <b>${planned.name}</b>` }));
    const grid = h('div', { class: 'cards' });
    for (const ev of EVENTS) {
      const locked = ev.level > g.level();
      const reqOk = !ev.requires || g.bar.hasTag(ev.requires);
      const fxOk = !ev.fixture || st.calendar?.fixtures?.[st.day];
      const can = !locked && reqOk && fxOk && !planned && g.phase === 'prep' && st.money >= ev.cost;
      let why = '';
      if (locked) why = `Niveau ${ev.level}`;
      else if (!reqOk) why = 'Il faut : ' + (g.catalog.get(ev.requires)?.name || ev.requires);
      else if (!fxOk) why = 'Pas de match ce soir';
      grid.append(h('div', { class: 'card' + (locked ? ' locked' : '') },
        h('div', { class: 'card-ico', html: iconHTML(ev.icon, 40) }),
        h('div', { class: 'card-title' }, h('b', { text: ev.name }), h('span', { class: 'card-lvl', text: ev.cost ? eur(ev.cost) : 'gratuit' })),
        h('div', { class: 'card-desc', text: ev.desc }),
        why ? h('div', { class: 'card-next bad', text: why }) : null,
        h('button', { class: 'btn ' + (can ? 'primary' : 'disabled'), onClick: () => { if (can) { g.planEvent(ev.id); this.render(); } } }, planned?.id === ev.id ? 'Prévu ce soir' : 'Organiser ce soir'),
      ));
    }
    wrap.append(grid);
    return this.frame('Événements', 'calendar', wrap, { cls: 'wide', sub: 'Un événement attire plus de monde : préparez le stock en conséquence !' });
  }

  // =========================================================== regulars
  p_regulars() {
    const g = this.game;
    const st = g.state;
    const wrap = h('div', { class: 'regs' });
    if (!st.regulars.length) wrap.append(h('p', { class: 'hint', text: 'Pas encore d’habitués. Des clients très satisfaits (80 % et plus) peuvent le devenir : ils reviennent chaque semaine, le même jour, et commandent toujours la même chose.' }));
    for (const r of st.regulars) {
      const p = g.products.get(r.favorite);
      const t = CUSTOMER_TYPES.find((x) => x.id === r.type);
      const onMenu = g.menu().drinks.includes(r.favorite);
      wrap.append(h('div', { class: 'reg' }, avatar(r.look, 52), h('div', { class: 'reg-main' },
        h('b', { text: r.name }), h('small', { text: t?.name || '' }),
        h('div', { class: 'reg-habit', html: `Vient le <b>${WEEKDAYS[r.day].toLowerCase()}</b> vers ${String(Math.floor(r.hour / 60) % 24).padStart(2, '0')} h · commande toujours ${itemIconHTML(p, 18)} <b>${p?.short}</b>` }),
        !onMenu ? h('div', { class: 'reg-warn', html: `${iconHTML('warning', 14)} Sa bière n’est pas à la carte !` }) : null,
      ), h('div', { class: 'reg-loy', title: 'Fidélité', html: Array.from({ length: 5 }, (_, i) => iconHTML(i < r.loyalty ? 'heart' : 'starEmpty', 14)).join('') }), h('div', { class: 'reg-vis', text: `${r.visits} visite${r.visits > 1 ? 's' : ''}` })));
    }
    return this.frame('Habitués', 'regular', wrap, { cls: 'wide', sub: `${st.regulars.length} habitué${st.regulars.length > 1 ? 's' : ''}. Ne les décevez pas : sans leur bière préférée, ils perdent patience… et fidélité.` });
  }

  // =========================================================== morning newspaper
  p_morning() {
    const g = this.game;
    const st = g.state;
    const w = g.director.weather();
    const cal = st.calendar;
    const fx = cal?.fixtures?.[st.day];
    const trend = cal?.trend;
    const wd = g.weekday();
    const regs = st.regulars.filter((r) => r.day === wd);
    const items = [];
    items.push(h('div', { class: 'news-item' }, h('span', { html: iconHTML(w.icon, 34) }), h('div', {}, h('b', { text: `Météo : ${w.name}` }), h('p', { text: w.id === 'chaud' ? 'Les terrasses débordent : blanches, blondes et softs vont couler à flots.' : w.id === 'pluie' ? 'Moins de passants, mais les stouts et les ambrées réchauffent les cœurs.' : w.id === 'froid' ? 'Brr ! Les bières brunes et les stouts ont la cote.' : 'Une soirée tranquille s’annonce… ou pas.' }))));
    if (trend) {
      const p = g.products.get(trend.pid);
      items.push(h('div', { class: 'news-item' }, h('span', { html: itemIconHTML(p, 34) }), h('div', {}, h('b', { text: `Tendance : la ${p.name} fait un carton` }), h('p', { text: `Encore ${trend.days} jour${trend.days > 1 ? 's' : ''} : la demande est doublée.${p.level > g.level() ? ' (Pas encore disponible pour vous.)' : g.menu().drinks.includes(p.id) ? ' Vous l’avez à la carte, parfait !' : ' Branchez-la ce soir ?'}` }))));
    }
    if (fx) items.push(h('div', { class: 'news-item' }, h('span', { html: iconHTML('ball', 34) }), h('div', {}, h('b', { text: `Ce soir : ${fx.name}` }), h('p', { text: `${fx.teams[0]} – ${fx.teams[1]}.${g.bar.hasTag('tv') ? ' Organisez une soirée match (Événements) !' : ' Avec un écran TV, vous pourriez organiser une soirée match.'}` }))));
    if (g.up('terrasse') && !g.terraceOpen()) items.push(h('div', { class: 'news-item warn' }, h('span', { html: iconHTML('rain', 34) }), h('div', {}, h('b', { text: 'Terrasse fermée ce soir' }), h('p', { text: 'Trop mauvais temps : personne ne voudra s’asseoir dehors.' }))));
    if ([4, 5].includes(wd)) items.push(h('div', { class: 'news-item' }, h('span', { html: iconHTML('people', 34) }), h('div', {}, h('b', { text: `${WEEKDAYS[wd]} soir : grosse affluence attendue` }), h('p', { text: 'Prévoyez du stock et des verres propres.' }))));
    if (regs.length) items.push(h('div', { class: 'news-item' }, h('span', { html: iconHTML('regular', 34) }), h('div', {}, h('b', { text: `Habitués attendus : ${regs.map((r) => r.name).join(', ')}` }), h('p', { html: regs.map((r) => `${r.name} → ${g.products.get(r.favorite)?.short}`).join(' · ') }))));
    const low = [];
    for (const t of st.taps) if (t.beerId && g.inventory.kegs(t.beerId) === 0 && t.level < 15) low.push(g.products.get(t.beerId).short);
    if (g.inventory.portions('saucisson') < 6) low.push('Saucisson');
    if (low.length) items.push(h('div', { class: 'news-item warn' }, h('span', { html: iconHTML('warning', 34) }), h('div', {}, h('b', { text: 'Stock bas' }), h('p', { text: low.join(', ') + ' : passez commande dans Marchandises.' }))));
    const last = g.lastReport;
    const paper = h('div', { class: 'news' },
      h('div', { class: 'news-mast' }, h('span', { text: 'Le Petit Écho du Quartier' }), h('small', { text: `${g.weekdayName()} · jour ${st.day}` })),
      last ? h('div', { class: 'news-headline', text: last.avgSat >= 75 ? `« ${st.barName}, l’adresse qui monte ! »` : last.avgSat >= 55 ? `« Soirée animée chez ${st.barName} »` : `« Service poussif chez ${st.barName} ? »` }) : null,
      ...items,
    );
    return this.frame('Le journal du matin', 'newspaper', paper, { foot: h('button', { class: 'btn primary', onClick: () => this.close() }, 'Au boulot !') });
  }

  // =========================================================== night report
  p_report({ report: r }) {
    const g = this.game;
    const st = g.state;
    const row = (label, v, cls = '') => h('div', { class: 'lrow ' + cls }, h('span', { text: label }), h('b', { text: (v >= 0 ? '+' : '−') + eur(Math.abs(v), Math.abs(v) % 1 ? 2 : 0) }));
    const ledger = h('div', { class: 'ledger' },
      h('h3', { text: 'La caisse' }),
      row('Ventes', r.revenue, 'good'),
      row('Pourboires', r.tips, 'good'),
      r.purchasesPrep ? row('Marchandises', -r.purchasesPrep, 'bad') : null,
      r.express ? row('Livraisons express', -r.express, 'bad') : null,
      r.upgrades ? row('Investissements', -r.upgrades, 'bad') : null,
      r.eventCost ? row('Événement', -r.eventCost, 'bad') : null,
      row('Loyer', -r.rent, 'bad'),
      r.contractPenalty ? row('Pénalité de contrat', -r.contractPenalty, 'bad') : null,
      row('Électricité', -r.elec, 'bad'),
      r.wages ? row('Salaires', -r.wages, 'bad') : null,
      h('div', { class: 'lrow total ' + (r.profit >= 0 ? 'good' : 'bad') }, h('span', { text: 'Résultat de la journée' }), h('b', { text: (r.profit >= 0 ? '+' : '−') + eur(Math.abs(r.profit)) })),
      h('div', { class: 'lrow cash' }, h('span', { text: 'En caisse' }), h('b', { text: eur(st.money) })),
    );
    const satCls = r.avgSat >= 70 ? 'good' : r.avgSat >= 50 ? 'warn' : 'bad';
    const stats = h('div', { class: 'rstats' },
      h('h3', { text: 'La soirée' }),
      stat('people', `${r.customers}`, 'clients servis'),
      stat('beer', `${r.pints}`, 'pintes tirées'),
      stat('heart', r.avgSat ? Math.round(r.avgSat) + ' %' : '–', 'satisfaction', satCls),
      stat('door', `${r.lost}`, 'clients refoulés', r.lost ? 'warn' : ''),
      stat('cross', `${r.angry}`, 'partis fâchés', r.angry ? 'bad' : ''),
      stat('star', (r.repDelta >= 0 ? '+' : '') + r.repDelta.toFixed(1), 'réputation', r.repDelta >= 0 ? 'good' : 'bad'),
      stat('trophy', '+' + Math.round(r.xpGain), 'XP'),
    );
    // service quality (mini-games)
    const Q = r.quality || {};
    const made = (Q.perfect || 0) + (Q.good || 0) + (Q.average || 0) + (Q.bad || 0) + (Q.catastrophe || 0);
    const service = made ? h('div', { class: 'rservice' },
      h('h3', { text: 'Le service' }),
      h('div', { class: 'qbar' }, ...['perfect', 'good', 'average', 'bad', 'catastrophe'].filter((k) => Q[k]).map((k) => h('i', { class: 'q-' + k, style: `flex:${Q[k]}`, title: `${QUALITY[k].label} : ${Q[k]}` }))),
      h('div', { class: 'qlegend' },
        h('span', { class: 'q-perfect', html: `${iconHTML('star', 14)} ${r.perfectPints} pinte${r.perfectPints > 1 ? 's' : ''} parfaite${r.perfectPints > 1 ? 's' : ''}` }),
        h('span', { html: `${iconHTML('fire', 14)} combo max ×${r.bestCombo}` }),
        h('span', { class: r.failed ? 'q-bad' : '', html: `${iconHTML('cross', 14)} ${r.failed} ratée${r.failed > 1 ? 's' : ''}` }),
      ),
      ...(r.rushes || []).map((x) => h('div', { class: 'rrush', html: `${iconHTML(x.icon, 18)} <b>${x.title}</b> ${'★'.repeat(x.grade)}${'☆'.repeat(3 - x.grade)} · ${x.served} servis · ${eur(x.revenue)} · ${x.perfect} parfaites` })),
    ) : null;
    const tips = [];
    if (made >= 6 && (Q.perfect || 0) / made < 0.2) tips.push('Peu de service parfait : à la tireuse, gardez le débit dans la zone verte et redressez le verre en douceur. La tireuse professionnelle élargit la zone.');
    if ((Q.catastrophe || 0) >= 2) tips.push('Des pintes ont débordé : relâchez dès que la mousse atteint le trait doré.');
    if (r.lost > 3) tips.push('Beaucoup de clients refoulés : ajoutez des tables ou des tabourets.');
    if (r.angry > 2) tips.push('Des clients sont partis fâchés : servez plus vite, ou embauchez quand ce sera possible.');
    if (r.avgSat && r.avgSat < 55) tips.push('Satisfaction basse : attente, tables sales, prix ou décor ? La déco et le confort aident beaucoup.');
    if (r.profit < 0) tips.push('Journée déficitaire : surveillez vos achats et vos prix.');
    if (!tips.length) tips.push('Belle soirée ! Investissez pour attirer une clientèle plus exigeante (et plus généreuse).');
    const extra = h('div', { class: 'rextra' },
      r.newRegulars.length ? h('div', { class: 'rnew', html: `${iconHTML('regular', 22)} Nouveaux habitués : <b>${r.newRegulars.map((x) => x.name).join(', ')}</b>` }) : null,
      h('div', { class: 'rtips' }, ...tips.map((t) => h('p', { text: t }))),
    );
    const body = h('div', { class: 'report' }, h('div', { class: 'report-cols' }, ledger, stats), service, extra);
    return this.frame(`Fermeture — ${r.weekday} (jour ${r.day})`, 'clock', body, {
      noClose: true, cls: 'wide report-modal',
      foot: h('button', { class: 'btn primary big', onClick: () => { this.close(); g.nextDay(); } }, 'Journée suivante'),
      sub: r.event ? `Événement : ${r.event}` : '',
    });
  }

  // =========================================================== level up
  p_levelup({ level }) {
    const g = this.game;
    const L = level.level;
    const unlocks = [];
    for (const b of BEERS.filter((x) => x.level === L)) unlocks.push([itemIconHTML(g.products.get(b.id), 26), b.name]);
    for (const s of SOFTS.filter((x) => x.level === L)) unlocks.push([itemIconHTML(g.products.get(s.id), 26), s.name]);
    for (const c of CATALOG.filter((x) => x.level === L)) unlocks.push([iconHTML('hammer', 26), c.name]);
    for (const u of UPGRADES) for (const t of u.tiers) if (t.level === L && u.tiers.indexOf(t) === u.tiers.findIndex((x) => x.level === L)) { unlocks.push([iconHTML(u.icon, 26), u.name + (t.label ? ' (' + t.label + ')' : '')]); break; }
    for (const e of EVENTS.filter((x) => x.level === L)) unlocks.push([iconHTML(e.icon, 26), 'Événement : ' + e.name]);
    for (const r of STAFF_ROLES.filter((x) => x.level === L)) unlocks.push([iconHTML('users', 26), 'Recrutement : ' + r.name]);
    for (const t of CUSTOMER_TYPES.filter((x) => x.level === L)) unlocks.push([iconHTML('people', 26), 'Nouveaux clients : ' + t.plural]);
    const list = h('div', { class: 'unlocks' }, ...unlocks.slice(0, 18).map(([ic, n]) => h('div', { class: 'unlock', html: `${ic}<span>${n}</span>` })));
    return this.frame(`Niveau ${L} : ${level.name} !`, 'trophy', h('div', { class: 'levelup' }, h('p', { class: 'lead', text: 'Votre bar prend du galon. Nouveautés débloquées :' }), list), { cls: 'levelup-modal', noClose: true, foot: h('button', { class: 'btn primary', onClick: () => this.close() }, 'Génial !') });
  }

  // =========================================================== settings
  p_settings() {
    const g = this.game;
    const s = g.state.settings;
    const slider = (label, key) => h('label', { class: 'set-row' }, h('span', { text: label }), h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(s[key]), id: 'set-' + key, onInput: (e) => { s[key] = +e.target.value; g.audio?.applySettings(); g.save.writeSettings(s); } }));
    const q = h('div', { class: 'set-row' }, h('span', { text: 'Graphismes' }), h('div', { class: 'seg' }, ...['low', 'medium', 'high'].map((k) => h('button', { class: 'tab' + (s.quality === k ? ' on' : ''), onClick: () => { s.quality = k; g.world.setQuality(k); g.save.writeSettings(s); this.render(); } }, { low: 'Rapide', medium: 'Moyen', high: 'Joli' }[k]))));
    const assist = s.assist || 0;
    const mg = h('div', { class: 'set-row' }, h('span', { text: 'Mini-jeux de service' }), h('div', { class: 'seg' }, ...[0, 1, 2].map((k) => h('button', { class: 'tab' + (assist === k ? ' on' : ''), title: ['Le vrai défi', 'Zones de réussite bien plus larges', 'Le patron sert seul, qualité « bien », sans combo'][k], onClick: () => { s.assist = k; g.save.writeSettings(s); this.render(); } }, ['Normal', 'Assisté', 'Automatique'][k]))));
    const help = h('div', { class: 'help' },
      h('h3', { text: 'Commandes' }),
      h('p', { html: '<b>Clic</b> : agir (client, tireuse, frigo, table…). Les actions s’enchaînent dans l’ordre.<br><b>Glisser</b> : déplacer la caméra · <b>Clic droit + glisser</b> : tourner · <b>Molette</b> : zoom<br><b>ZQSD / flèches</b> : déplacer · <b>A/E</b> : tourner · <b>Espace</b> ou <b>P</b> : pause · <b>1 2 3</b> : vitesse · <b>Échap / clic droit</b> : annuler les actions' }),
      h('h3', { text: 'Mini-jeux' }),
      h('p', { html: '<b>Pinte</b> : maintenir <b>Espace</b>/clic pour verser, garder le DÉBIT dans le vert, redresser le verre avec <b>↑</b> (ou en glissant vers le haut), stop au trait doré.<br><b>Saucisson / bouteille / café</b> : <b>Espace</b> ou clic au bon moment · <b>Planche</b> : touches <b>1-5</b> ou clic.' }),
    );
    const reset = h('button', { class: 'btn danger', onClick: () => {
      if (!this._confirmReset) { this._confirmReset = true; return this.render(); }
      g.save.clear();
      location.reload();
    } }, this._confirmReset ? 'Vraiment ? Tout sera perdu' : 'Recommencer une nouvelle partie');
    return this.frame('Réglages', 'gear', h('div', { class: 'settings' }, slider('Musique', 'music'), slider('Effets sonores', 'sfx'), q, mg, help, h('div', { class: 'set-row' }, h('button', { class: 'btn', onClick: () => { g.save.write(); g.toast('Partie sauvegardée', 'good'); } }, 'Sauvegarder'), reset)));
  }
}

function stat(icon, value, label, cls = '') {
  return h('div', { class: 'stat ' + cls }, h('span', { html: iconHTML(icon, 24) }), h('b', { text: value }), h('small', { text: label }));
}

function statBars(s) {
  const bar = (label, v) => h('div', { class: 'sbar' }, h('small', { text: label }), h('div', { class: 'gauge' }, h('i', { style: { width: v + '%' } })), h('b', { text: String(v) }));
  return h('div', { class: 'sbars' }, bar('Vitesse', s.speed), bar('Service', s.service), h('div', { class: 'stier', text: staffTier(s) }));
}

/** what an employee brings, in plain words (automation tiers) */
function staffTier(s) {
  if (s.role === 'barman') {
    const skill = s.service * 0.75 + s.speed * 0.25 + 8;
    const perfect = Math.round(Math.max(0.02, Math.min(1, (skill - 45) / 70)) * 100);
    if (s.service >= 85) return `Barman expert : 4 commandes à la fois · ~${perfect} % de pintes parfaites`;
    if (s.service >= 72) return `Barman expérimenté : ~${perfect} % de pintes parfaites`;
    return `Barman correct : qualité moyenne (~${perfect} % parfaites)`;
  }
  return s.speed >= 70 ? 'Bon serveur : rapide en salle' : 'Serveur débutant : un peu lent';
}

/** tiny 2D portrait drawn from a character look */
export function avatar(look, size = 48) {
  const c = document.createElement('canvas');
  const dpr = 2;
  c.width = c.height = size * dpr;
  c.className = 'avatar';
  c.style.width = c.style.height = size + 'px';
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const css = (n) => '#' + (n ?? 0x888888).toString(16).padStart(6, '0');
  const s = size;
  g.fillStyle = '#3b2316';
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = css(look.topStyle === 'apron' ? look.apron ?? look.top : look.top);
  g.beginPath();
  g.ellipse(s / 2, s * 1.02, s * 0.42, s * 0.34, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = css(look.skin);
  g.beginPath();
  g.arc(s / 2, s * 0.45, s * 0.26, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = css(look.hair);
  if (look.hairStyle !== 'bald') {
    g.beginPath();
    g.arc(s / 2, s * 0.42, s * 0.27, Math.PI, Math.PI * 2);
    g.fill();
    if (look.hairStyle === 'long') g.fillRect(s * 0.23, s * 0.42, s * 0.1, s * 0.3), g.fillRect(s * 0.67, s * 0.42, s * 0.1, s * 0.3);
  }
  if (look.hat) {
    g.fillStyle = css(look.hatColor);
    g.beginPath();
    g.ellipse(s / 2, s * 0.25, s * 0.28, s * 0.12, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#fff';
  for (const dx of [-0.09, 0.09]) {
    g.beginPath();
    g.ellipse(s / 2 + dx * s, s * 0.47, s * 0.055, s * 0.07, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#1b1210';
  for (const dx of [-0.09, 0.09]) {
    g.beginPath();
    g.arc(s / 2 + dx * s, s * 0.48, s * 0.03, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#6a1f1a';
  g.lineWidth = s * 0.03;
  g.beginPath();
  g.arc(s / 2, s * 0.55, s * 0.07, 0.2, Math.PI - 0.2);
  g.stroke();
  if (look.mustache || look.beard) {
    g.fillStyle = css(look.hair);
    g.fillRect(s * 0.42, s * 0.56, s * 0.16, s * 0.035);
  }
  g.restore();
  return c;
}
