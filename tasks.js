// Task factories: everything a worker can do. Each task: dest, check, duration, begin, done (-> follow-up tasks).
import { CONFIG, LAYOUT } from '../data/config.js';
import { makeServing } from './Customers.js';

const L = LAYOUT;

export function createTasks(game) {
  const g = game;
  const P = () => g.products;
  const reserveSpot = () => ({ x: (L.reserveDoor.x0 + L.reserveDoor.x1) / 2, z: 0.75, face: Math.PI });
  const handsFull = (w) => w.freeHands <= 0;

  const T = {};

  // ------------------------------------------------ customers
  T.takeOrder = (group) => ({
    kind: 'takeOrder', target: group, icon: 'notepad', claim: 'g' + group.id,
    label: 'Prendre la commande',
    dest: (w) => group.spots[0].workerSpot(w.pos),
    check: (w) => (group.state === 'wantOrder' || (group.state === 'ordering' && group.orderingBy === w) ? null : group.state === 'leaving' ? 'Ils sont partis…' : 'Commande déjà prise'),
    silentFail: () => true,
    duration: (w) => CONFIG.takeOrderTime * w.workMult,
    anim: 'write',
    begin: (w) => {
      group.state = 'ordering';
      group.orderingBy = w;
    },
    cancel: () => {
      if (group.state === 'ordering') group.state = 'wantOrder';
    },
    done: (w) => {
      group.orderingBy = null;
      const t = group.makeOrder(w);
      if (t) g.bus.emit('orderTaken', { group, ticket: t, worker: w });
    },
    markerPos: () => group.anchor,
  });

  T.serve = (group) => ({
    kind: 'serve', target: group, icon: 'tray', label: 'Servir',
    dest: (w) => group.spots[0].workerSpot(w.pos),
    check: (w, pre) => {
      if (group.state === 'leaving') return 'Ils sont partis…';
      if (pre) return null;
      const pend = group.pendingItems();
      if (!pend.length) return 'Ils ont déjà tout';
      if (!w.hands.some((h) => pend.some((p) => p.pid === h.pid))) return w.hands.length ? 'Ce n’est pas leur commande' : 'Vous n’avez rien à leur servir';
      return null;
    },
    duration: (w) => CONFIG.serveTime * w.workMult,
    anim: 'take',
    done: (w) => {
      let n = 0;
      // employees with low service may drop the tray
      if (!w.isOwner && w.hands.length && Math.random() < Math.max(0, (62 - w.stats.service) / 700)) {
        g.world.effects.burst('glass', [w.pos.x, 1.0, w.pos.z]);
        g.world.effects.burst('splash', [w.pos.x, 0.9, w.pos.z]);
        g.bus.emit('drop', { worker: w });
        g.toast(`${w.name} a fait tomber le plateau !`, 'bad');
        g.bar.addPuddle(w.pos.x, w.pos.z);
        w.hands = [];
        w.refreshHands();
        group.sat -= 4;
        return;
      }
      for (const h of [...w.hands]) {
        if (group.deliver(h.pid, w, h.q)) {
          w.takeFromHands(h.pid, h.q);
          n++;
        }
      }
      if (n) g.bus.emit('served', { group, n, worker: w });
    },
    markerPos: () => group.anchor,
  });

  T.collect = (group) => ({
    kind: 'collect', target: group, icon: 'euro', claim: 'g' + group.id, label: 'Encaisser',
    dest: (w) => group.spots[0].workerSpot(w.pos),
    check: (w) => (group.state === 'wantBill' || (group.state === 'paying' && group.payingBy === w) ? null : group.state === 'leaving' ? 'Ils sont partis…' : 'Pas encore'),
    silentFail: () => true,
    duration: (w) => CONFIG.collectTime * w.workMult,
    anim: 'take',
    begin: (w) => {
      group.state = 'paying';
      group.payingBy = w;
    },
    cancel: () => {
      if (group.state === 'paying') group.state = 'wantBill';
    },
    done: (w) => {
      group.pay(w);
    },
    markerPos: () => group.anchor,
  });

  T.clear = (spot) => ({
    kind: 'clear', target: spot, icon: 'sponge', claim: 's' + spot.id, label: 'Débarrasser',
    dest: (w) => spot.workerSpot(w.pos),
    check: (w) => {
      if (!spot.isDirty) return 'C’est déjà propre';
      if (w.carrying) return 'Les mains sont prises';
      return null;
    },
    silentFail: (r) => r === 'C’est déjà propre',
    duration: (w) => (CONFIG.clearTime + (spot.dirty.glasses + spot.dirty.plates) * 0.06) * w.workMult,
    anim: 'wipe',
    begin: (w) => w.view.hold('R', null),
    done: (w) => {
      const d = spot.cleanUp();
      w.dirty.glasses += d.glasses;
      w.dirty.bottles += d.bottles;
      w.dirty.plates += d.plates;
      if (d.cash > 0) g.earn(d.cash, 0, null, spot);
      g.world.effects.sparkle([spot.center.x, spot.topY + 0.1, spot.center.z]);
      g.bus.emit('cleared', { spot });
      w.refreshHands();
      if (w.isOwner && w.dirtyCount && !w.hasQueued('drop')) w.queue.push(T.drop());
      w.refreshMarkers();
    },
    markerPos: () => [spot.center.x, spot.topY + 0.9, spot.center.z],
  });

  T.drop = () => ({
    kind: 'drop', icon: 'wash', label: 'Déposer la vaisselle',
    dest: () => g.dishwasher.access(),
    check: (w) => (w.dirtyCount > 0 ? null : 'Rien à déposer'),
    silentFail: () => true,
    duration: (w) => CONFIG.dropDirtyTime * w.workMult,
    anim: 'take',
    done: (w) => {
      g.dishwasher.add(w.dirty.glasses);
      g.glasses.dirty = Math.max(0, g.glasses.dirty - w.dirty.glasses);
      w.dirty = { glasses: 0, bottles: 0, plates: 0 };
      w.refreshHands();
      g.bus.emit('dropDishes', {});
    },
    markerPos: () => [L.dishwasher.x, 1.6, 1.5],
  });

  // ------------------------------------------------ production
  const needDropFirst = (w) => (w.dirtyCount > 0 ? { before: [T.drop()] } : null);

  /** how many glasses to fill at once on a multi-tap (only as many as still needed) */
  const pourCount = (w, tap) => {
    const multi = g.upValue('multiTap', 1);
    if (multi <= 1) return 1;
    const pid = tap.st.beerId;
    const pending = g.orders.pendingList().filter((x) => x.item.pid === pid).length;
    const cov = g.coverage()[pid] || 0; // includes this task
    const needed = Math.max(1, pending - (cov - 1));
    return Math.max(1, Math.min(multi, needed, w.freeHands, g.glasses.clean, tap.level));
  };

  T.pour = (tap) => ({
    kind: 'pour', target: tap, icon: 'beer', label: 'Tirer une pinte',
    get pid() {
      return tap.st.beerId;
    },
    pre: (w) => {
      if (w.carrying) return null;
      if (!tap.broken && tap.beer && tap.level <= 0 && g.inventory.kegs(tap.st.beerId) > 0 && !w.hands.length && !w.dirtyCount) return { replace: T.changeKeg(tap) };
      return needDropFirst(w);
    },
    check: (w) => {
      if (tap.broken) return `${tap.label()} est en panne ! Cliquez dessus pour la réparer`;
      if (!tap.beer) return 'Aucune bière branchée sur cette tireuse';
      if (w.carrying) return 'Les mains sont prises';
      if (tap.level <= 0) return g.inventory.kegs(tap.st.beerId) > 0 ? 'Fût vide : libérez vos mains pour le changer' : `Plus de ${tap.beer.short} ! Commandez un fût en express`;
      if (handsFull(w)) return 'Les mains sont pleines';
      if (g.glasses.clean <= 0) return 'Plus de verres propres ! Débarrassez et lavez';
      return null;
    },
    duration: (w) => CONFIG.pourTime * (w.isOwner ? 1 : 1.15) * w.workMult,
    anim: 'pour',
    dest: () => tap.access(),
    minigame: (w) => ({ kind: 'pour', opts: { product: tap.beer, count: w._pourCount || 1, mods: g.pourMods(), rush: g.rushActive(), pressure: g.pressure(), resultKey: 'draft' } }),
    begin: (w) => {
      const n = pourCount(w, tap);
      w._pourCount = n;
      g.glasses.clean -= n;
      tap.view.pullTarget = 1;
      const glass = makeServing(tap.beer);
      glass.setLevel(0.05);
      w.view.hold('L', glass);
      w._pourGlass = glass;
      w._pourT = 0;
      g.bus.emit('pourStart', { tap, mini: w.isOwner });
      const dur = CONFIG.pourTime * w.workMult;
      w._pourUpd = (dt) => {
        const mg = w.isOwner ? g.minigames.active?.game : null;
        if (mg && mg.total !== undefined) {
          glass.setLevel(Math.max(0.05, Math.min(1, mg.total)));
          tap.view.pullTarget = mg.q;
        } else {
          w._pourT += dt;
          glass.setLevel(Math.min(1, 0.05 + w._pourT / dur));
        }
      };
      g.world.updaters.add(w._pourUpd);
    },
    cancel: (w) => {
      tap.view.pullTarget = 0;
      g.glasses.clean += w._pourCount || 1;
      if (w._pourUpd) g.world.updaters.delete(w._pourUpd);
      w.refreshHands();
    },
    done: (w, res) => {
      const n = w._pourCount || 1;
      tap.view.pullTarget = 0;
      if (w._pourUpd) g.world.updaters.delete(w._pourUpd);
      const q = res?.quality || 'good';
      const wasted = res?.wasted > 0.15 ? 1 : 0;
      tap.level = Math.max(0, tap.level - n - wasted);
      g.registerQuality(q, w, 'draft', n);
      if (q === 'catastrophe') {
        // beer all over the counter: glasses go to the sink, a puddle to mop, a soaked barman
        g.dishwasher.add(n);
        const nz = tap.view.nozzleWorld();
        g.world.effects.burst('foam', nz, 26);
        g.world.effects.burst('splash', [tap.x, 1.1, 2.1], 18);
        g.bar.addPuddle(tap.x, 2.45, tap.beer.liquid);
        w.view.setAction('shrug');
        w.view.mood = 'sad';
        setTimeout(() => {
          if (w.view.action === 'shrug') w.view.setAction(null);
          w.view.mood = 'neutral';
        }, 1400);
        g.bus.emit('pourFail', { tap });
        w.refreshHands();
      } else {
        for (let i = 0; i < n; i++) w.pickUp(tap.st.beerId, q);
        g.state.stats.pints = (g.state.stats.pints || 0) + n;
        if (g.night) g.night.pints += n;
        if (q === 'perfect') g.world.effects.sparkle(tap.view.nozzleWorld(), 0xffe08a, 7);
      }
      if (tap.level <= 0) g.bus.emit('kegEmpty', { tap });
      g.bus.emit('pourDone', { tap, quality: q });
    },
    markerPos: () => [tap.x, L.counter.top + 0.9, 1.62],
  });

  T.changeKeg = (tap) => {
    const beerId = tap.st.beerId;
    const fetch = {
      kind: 'fetchKeg', target: tap, icon: 'keg', label: 'Chercher un fût',
      dest: reserveSpot,
      pre: needDropFirst,
      check: (w) => {
        if (w.hands.length || w.carrying) return 'Mains pleines : servez d’abord ce que vous portez';
        if (g.inventory.kegs(beerId) <= 0) return `Plus de fût de ${P().get(beerId).short} en réserve`;
        return null;
      },
      duration: (w) => CONFIG.reserveTime * w.workMult,
      anim: 'take',
      begin: () => g.world.room.openDoor('reserve', CONFIG.reserveTime + 0.4),
      done: (w) => {
        g.inventory.takeKeg(beerId);
        w.carrying = { kind: 'keg', beerId };
        w.refreshHands();
        return [swap];
      },
      markerPos: () => [reserveSpot().x, 2.4, 0.3],
    };
    const swap = {
      kind: 'swapKeg', target: tap, icon: 'keg', label: 'Changer le fût',
      dest: () => tap.access(),
      check: (w) => (w.carrying?.kind === 'keg' ? null : 'Pas de fût en main'),
      duration: (w) => CONFIG.kegSwapTime * w.workMult,
      anim: 'keg',
      done: (w) => {
        if (tap.st.beerId !== w.carrying.beerId) {
          // tap was reassigned meanwhile: put the keg back in stock
          g.inventory.addPacks(w.carrying.beerId, 1);
        } else {
          tap.level = P().get(beerId).kegSize;
          g.bus.emit('kegChanged', { tap });
        }
        w.carrying = null;
        w.refreshHands();
        g.world.effects.burst('foam', tap.view.nozzleWorld(), 6);
      },
      cancel: (w) => {
        if (w.carrying?.kind === 'keg') {
          g.inventory.addPacks(w.carrying.beerId, 1);
          w.carrying = null;
          w.refreshHands();
        }
      },
      markerPos: () => [tap.x, L.counter.top + 0.9, 1.62],
    };
    return [fetch];
  };

  /** choose which product to take from a station for pending orders */
  T.smartPick = (candidates) => {
    const covered = g.coverage();
    for (const { item } of g.orders.pendingList()) {
      if (!candidates.includes(item.pid)) continue;
      if ((covered[item.pid] || 0) > 0) {
        covered[item.pid]--;
        continue;
      }
      return item.pid;
    }
    return null;
  };

  T.fridgeTake = (pid) => ({
    kind: 'fridgeTake', target: g.fridge, icon: 'bottle', label: 'Prendre au frigo',
    pid,
    pre: (w) => {
      if (!w.carrying && g.fridge.count(pid) <= 0 && g.inventory.bottles(pid) > 0 && !w.hands.length && !w.dirtyCount) return { replace: T.fridgeFill() };
      return needDropFirst(w);
    },
    dest: () => g.fridge.access(),
    check: (w) => {
      if (w.carrying) return 'Les mains sont prises';
      if (g.fridge.count(pid) <= 0) return g.inventory.bottles(pid) > 0 ? 'Frigo vide : libérez vos mains pour le remplir' : `Rupture de ${P().get(pid).short} !`;
      if (handsFull(w)) return 'Les mains sont pleines';
      return null;
    },
    duration: (w) => CONFIG.bottleTime * w.workMult,
    anim: 'take',
    minigame: () => {
      const p = P().get(pid);
      const fill = p.category === 'soft' && !p.bottle?.round;
      return { kind: fill ? 'fill' : 'cap', opts: { product: p, mods: g.serviceMods(fill ? 'fill' : 'cap'), rush: g.rushActive(), pressure: g.pressure(), resultKey: fill ? 'soft' : 'bottle' } };
    },
    done: (w, res) => {
      const q = res?.quality || 'good';
      g.fridge.take(pid);
      w.pickUp(pid, q);
      g.registerQuality(q, w, 'bottle', 1);
      g.bus.emit('bottle', { pid, quality: q });
    },
    markerPos: () => [L.fridge.x, 2.3, 0.4],
  });

  T.fridgeFill = () => {
    const fetch = {
      kind: 'fetchCrate', icon: 'crate', label: 'Chercher des caisses',
      dest: reserveSpot,
      pre: needDropFirst,
      check: (w) => {
        if (w.hands.length || w.carrying) return 'Mains pleines : servez d’abord ce que vous portez';
        const need = g.fridge.products.some((p) => g.fridge.count(p) < g.fridge.slotFor(p) && g.inventory.bottles(p) > 0);
        return need ? null : 'Rien à remettre au frais';
      },
      duration: (w) => CONFIG.reserveTime * w.workMult,
      anim: 'take',
      begin: () => g.world.room.openDoor('reserve', CONFIG.reserveTime + 0.4),
      done: (w) => {
        const items = {};
        for (const p of g.fridge.products) {
          const need = g.fridge.slotFor(p) - g.fridge.count(p);
          if (need > 0) items[p] = g.inventory.takeBottles(p, need);
        }
        w.carrying = { kind: 'crate', items };
        w.refreshHands();
        return [fill];
      },
      markerPos: () => [reserveSpot().x, 2.4, 0.3],
    };
    const fill = {
      kind: 'fillFridge', icon: 'fridge', label: 'Remplir le frigo',
      dest: () => g.fridge.access(),
      check: (w) => (w.carrying?.kind === 'crate' ? null : 'Pas de caisse en main'),
      duration: (w) => CONFIG.fridgeFillTime * w.workMult,
      anim: 'carryBoth',
      done: (w) => {
        for (const [p, n] of Object.entries(w.carrying.items)) g.state.fridge.stock[p] = (g.state.fridge.stock[p] || 0) + n;
        w.carrying = null;
        w.refreshHands();
        g.fridge.refresh();
        g.bus.emit('fridgeFilled', {});
      },
      cancel: (w) => {
        if (w.carrying?.kind === 'crate') {
          for (const [p, n] of Object.entries(w.carrying.items)) g.state.reserve.bottles[p] = (g.state.reserve.bottles[p] || 0) + n;
          w.carrying = null;
          w.refreshHands();
        }
      },
      markerPos: () => [L.fridge.x, 2.3, 0.4],
    };
    return [fetch];
  };

  T.food = (station, pid) => ({
    kind: 'food', target: station, icon: 'food', label: 'Préparer',
    pid,
    pre: needDropFirst,
    dest: () => station.access(),
    check: (w) => {
      if (w.carrying) return 'Les mains sont prises';
      if (g.inventory.portions(pid) <= 0) return `Rupture de ${P().get(pid).short} !`;
      if (handsFull(w)) return 'Les mains sont pleines';
      return null;
    },
    duration: (w) => P().get(pid).prepTime * w.workMult,
    anim: station.kind === 'board' ? 'wipe' : 'take',
    minigame: () => {
      const p = P().get(pid);
      const kind = { saucisson: 'cut', planche: 'plank', croque: 'timing', cafe: 'timing' }[pid];
      if (!kind) return null;
      return { kind, opts: { product: p, mods: g.serviceMods(kind), rush: g.rushActive(), pressure: g.pressure(), resultKey: pid } };
    },
    begin: (w) => {
      if (station.kind === 'board' && !w.isOwner) g.bus.emit('chop', {});
    },
    done: (w, res) => {
      const q = res?.quality || 'good';
      g.inventory.takePortion(pid);
      station.refresh();
      w.pickUp(pid, q);
      if (['saucisson', 'planche', 'croque', 'cafe'].includes(pid)) g.registerQuality(q, w, pid, 1);
    },
    markerPos: () => [station.x, 1.9, 0.4],
  });

  // ------------------------------------------------ incidents
  T.fix = (tap) => ({
    kind: 'fix', target: tap, icon: 'wrench', claim: 'fix' + tap.index, label: 'Réparer',
    pre: needDropFirst,
    dest: () => tap.access(),
    check: (w) => (tap.broken ? null : 'Elle remarche déjà'),
    silentFail: () => true,
    duration: (w) => CONFIG.fixTime * w.workMult,
    anim: 'hammer',
    begin: (w) => w.holdTool('wrench'),
    done: (w) => {
      tap.broken = false;
      w.refreshHands();
      g.world.effects.sparkle(tap.view.nozzleWorld(), 0xbfe8ff, 8);
      g.bus.emit('tapFixed', { tap });
    },
    cancel: (w) => w.refreshHands(),
    markerPos: () => [tap.x, L.counter.top + 0.9, 1.62],
  });

  T.mop = (puddle) => ({
    kind: 'mop', target: puddle, icon: 'mop', claim: 'p' + puddle.x.toFixed(2) + puddle.z.toFixed(2), label: 'Éponger',
    dest: () => ({ x: puddle.x, z: puddle.z + 0.4 }),
    check: (w) => (g.bar.puddles.includes(puddle) ? null : 'Déjà épongé'),
    silentFail: () => true,
    duration: (w) => CONFIG.mopTime * w.workMult,
    anim: 'mop',
    begin: (w) => w.holdTool('mop'),
    done: (w) => {
      g.bar.removePuddle(puddle);
      w.refreshHands();
      g.world.effects.sparkle([puddle.x, 0.2, puddle.z], 0xcfefff, 5);
    },
    cancel: (w) => w.refreshHands(),
    markerPos: () => [puddle.x, 0.9, puddle.z],
  });

  return T;
}
