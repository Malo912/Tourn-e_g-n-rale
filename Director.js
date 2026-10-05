// The "director": customer arrival curve, rush waves, random incidents, regular visits, weather, trends and fixtures.
import { CONFIG } from '../data/config.js';
import { WEATHERS, RUSHES, RUSH_ANNOUNCE } from '../data/events.js';
import { TEAMS } from '../data/names.js';
import { line } from '../data/lines.js';

const CURVE = [
  [18 * 60, 0.5], [19 * 60, 0.9], [20 * 60, 1.4], [21 * 60, 1.75], [22 * 60, 1.5], [23 * 60, 1.05], [24 * 60, 0.7], [25 * 60, 0.0],
];
const DAY_FACTOR = [0.82, 0.88, 0.95, 1.0, 1.2, 1.28, 0.9]; // Mon..Sun

function curveAt(m) {
  if (m <= CURVE[0][0]) return CURVE[0][1];
  for (let i = 1; i < CURVE.length; i++) {
    if (m <= CURVE[i][0]) {
      const [a, va] = CURVE[i - 1], [b, vb] = CURVE[i];
      return va + ((vb - va) * (m - a)) / (b - a);
    }
  }
  return 0;
}

export class Director {
  constructor(game) {
    this.game = game;
    this.acc = 0;
    this.waves = [];
    this.scheduled = [];
  }

  // ------------------------------------------------ morning planning
  planDay() {
    const g = this.game;
    const st = g.state;
    const rng = g.rng;
    const cal = (st.calendar ||= { fixtures: {}, trend: null, weather: 'doux' });
    // weather
    const w = rng.weighted([{ id: 'doux', w: 50 }, { id: 'chaud', w: 18 }, { id: 'pluie', w: 20 }, { id: 'froid', w: 12 }]);
    cal.weather = st.day === 1 ? 'doux' : w.id;
    // trend
    if (cal.trend) {
      cal.trend.days--;
      if (cal.trend.days <= 0) cal.trend = null;
    }
    if (!cal.trend && st.day > 2 && rng.chance(0.4)) {
      const cands = g.data.beers.filter((b) => b.level <= g.level() + 1);
      const b = rng.pick(cands);
      cal.trend = { pid: b.id, days: 3 };
      cal.trendNew = true;
    } else cal.trendNew = false;
    // fixtures for the next 7 days
    for (let d = st.day; d < st.day + 7; d++) {
      if (cal.fixtures[d] !== undefined) continue;
      const wd = g.weekday(d);
      let fx = null;
      if (wd === 2 && rng.chance(0.8)) fx = { name: 'Coupe d’Europe', importance: 1 };
      if ((wd === 5 || wd === 6) && rng.chance(0.65)) fx = { name: 'Championnat', importance: 1 };
      if (wd === 6 && d % 14 === 0) fx = { name: 'FINALE de la Coupe', importance: 2 };
      if (fx) {
        const t = rng.shuffle([...TEAMS]);
        fx.teams = [t[0], t[1]];
      }
      cal.fixtures[d] = fx;
    }
    for (const k of Object.keys(cal.fixtures)) if (+k < st.day - 1) delete cal.fixtures[k];
  }

  weather() {
    const id = this.game.state.calendar?.weather || 'doux';
    return WEATHERS.find((w) => w.id === id) || WEATHERS[0];
  }

  // ------------------------------------------------ night
  startNight() {
    const g = this.game;
    const rng = g.rng;
    this.acc = 0;
    this.waves = [];
    this.scheduled = [];
    this.goalTimes = [];
    this.breakCd = g.state.day === 1 ? 140 : 60;
    // chaos moments (rushes): none on the very first night, then one or two per night
    this.rushes = [];
    const day = g.state.day;
    const fx = g.state.calendar?.fixtures?.[day];
    const matchNight = g.eventActive('match') || (fx && g.bar.hasTag('tv'));
    if (matchNight) this.rushes.push(this._rush('match', 20 * 60 + 45));
    if (day >= 2) {
      const n = day === 2 ? 1 : 1 + (rng.chance(0.3 + g.state.rep / 250) ? 1 : 0) - (matchNight ? 1 : 0);
      const pool = RUSHES.filter((r) => !r.special && (r.level || 1) <= g.level());
      for (let i = 0; i < n; i++) {
        for (let tries = 0; tries < 12; tries++) {
          const at = day === 2 ? rng.range(20 * 60 + 20, 21 * 60 + 20) : rng.range(19 * 60 + 40, 23 * 60 + 20);
          if (this.rushes.every((r) => Math.abs(r.at - at) > 120)) {
            this.rushes.push(this._rush(rng.pick(pool).id, at));
            break;
          }
        }
      }
      this.rushes.sort((a, b) => a.at - b.at);
    }
    // regulars
    const wd = g.weekday();
    for (const r of g.state.regulars) {
      const comes = r.day === wd ? rng.chance(0.9) : rng.chance(0.12 + r.loyalty * 0.03);
      if (comes) this.scheduled.push({ at: (r.hour || 20 * 60) + rng.range(-40, 40), kind: 'regular', regular: r });
    }
    // critic
    if (g.level() >= 2 && rng.chance(0.18)) this.scheduled.push({ at: rng.range(19 * 60 + 30, 22 * 60), kind: 'critic' });
    // goals during matches
    if (g.eventActive('match')) {
      const n = rng.int(2, 6);
      for (let i = 0; i < n; i++) this.goalTimes.push(rng.range(20 * 60 + 50, 22 * 60 + 50));
      this.goalTimes.sort((a, b) => a - b);
    }
  }

  _rush(id, at) {
    const g = this.game;
    const def = RUSHES.find((r) => r.id === id);
    // the chaos scales with what the bar can handle (staff, level, reputation)
    let k = 0.42 + g.state.staff.length * 0.14 + (g.level() - 1) * 0.08 + g.state.rep / 160;
    if (g.state.day <= 3) k = Math.min(k, 0.5);
    k = Math.max(0.4, Math.min(1, k));
    const len = def.dur * (0.75 + 0.25 * k);
    return { def, at, end: at + len, phase: 'pending', stats: null, k, mult: 1 + (def.mult - 1) * k, burst: Math.max(1, Math.round(def.burst * k)) };
  }

  startRush(r) {
    const g = this.game;
    const n = g.night;
    r.phase = 'live';
    r.stats = { served: 0, groups: new Set(), revenue: 0, tips0: n.tips, rep0: g.state.rep, perfect: 0, failed: 0, lost0: n.lost, angry0: n.angry };
    g.rush = r;
    g.bus.emit('rushStart', { rush: r });
    const type = g.data.customerTypes.find((t) => t.id === r.def.type) || g.data.customerTypes[0];
    const k = r.burst;
    for (let i = 0; i < k; i++) setTimeout(() => g.phase === 'service' && g.rush === r && this.spawnRandom(type), 400 + i * 1300);
  }

  endRush(silent) {
    const g = this.game;
    const r = g.rush;
    if (!r) return;
    g.rush = null;
    if (r.phase !== 'live') {
      r.phase = 'done';
      return;
    }
    r.phase = 'done';
    const n = g.night;
    const s = r.stats;
    const summary = {
      title: r.def.go, icon: r.def.icon,
      customers: s.groups.size, served: s.served, revenue: s.revenue, tips: Math.max(0, n.tips - s.tips0),
      perfect: s.perfect, failed: s.failed, lost: n.lost - s.lost0 + n.angry - s.angry0, angry: n.angry - s.angry0, rep: g.state.rep - s.rep0,
    };
    // grade: how well the chaos was handled (a full room turning people away at the door is not a failure)
    const bad = summary.failed + summary.angry * 1.5 + (summary.lost - summary.angry) * 0.08;
    summary.grade = bad <= 1 && summary.served >= 6 ? 3 : bad <= 4 ? 2 : 1;
    const xp = Math.round(15 + summary.served * 1.5 + summary.perfect * 2) * summary.grade;
    g.state.xp += xp;
    n.xp = (n.xp || 0) + xp;
    summary.xp = xp;
    (n.rushes ||= []).push(summary);
    if (!silent) g.bus.emit('rushEnd', { rush: r, summary });
  }

  arrivalRate() {
    const g = this.game;
    const st = g.state;
    const m = g.clock;
    const ev = g.eventEffects();
    // demand is driven by reputation; a bigger bar attracts a bit more (word of mouth)
    const tables = g.bar.spots.filter((s) => s.kind === 'table').length;
    const capacity = tables + g.bar.counterSpots().length / 1.6;
    const capK = 0.8 + 0.2 * Math.min(2, capacity / 4.25);
    let r = (1.05 + st.rep * 0.05) * capK * curveAt(m);
    r *= DAY_FACTOR[g.weekday()];
    r *= this.weather().arrival;
    r *= ev.arrival || 1;
    // an event's busy window does not stack with a live rush
    if (ev.window && m >= ev.window[0] && m <= ev.window[1] && !g.rushActive()) r *= ev.window[2];
    if (g.up('sign')) r *= 1.12;
    if (st.day <= 4) r *= [0.72, 0.78, 0.86, 0.94][st.day - 1];
    const rush = g.rushActive() ? g.rush : null;
    if (rush) r *= rush.mult;
    // people see the crowd at the door and go elsewhere (rush crowds are more stubborn)
    const queued = g.customers.groups.filter((x) => x.state === 'queue').length;
    if (queued >= (rush ? 6 : 4)) r *= 0.1;
    else if (queued >= (rush ? 3 : 2)) r *= rush ? 0.55 : 0.35;
    return r; // groups per in-game hour
  }

  pickType() {
    const g = this.game;
    const sc = g.bar.scores();
    const ev = g.eventEffects();
    const foods = g.menu().foods.length;
    const rushType = g.rushActive() ? g.rush.def.type : null;
    const types = g.data.customerTypes.filter((t) => t.id === rushType || (t.level <= g.level() && t.minRep <= g.state.rep && (!t.needsFood || foods >= t.needsFood)));
    return g.rng.weighted(types, (t) => {
      let w = t.weight;
      if (sc.attracts[t.id]) w *= sc.attracts[t.id];
      if (ev.types?.[t.id]) w *= ev.types[t.id];
      if (t.id === 'sportif' && g.bar.hasTag('tv')) w *= 1.3;
      if (g.rushActive() && g.rush.def.type === t.id) w *= 4;
      return w;
    });
  }

  spawnRandom(forceType) {
    const g = this.game;
    const type = forceType || this.pickType();
    if (!type) return;
    const maxCap = Math.max(1, ...g.bar.spots.filter((s) => s.kind === 'table').map((s) => s.seats.length), Math.min(2, g.bar.counterSpots().length));
    let size = g.rng.int(type.group[0], type.group[1]);
    size = Math.max(1, Math.min(size, maxCap));
    const grp = g.customers.spawnGroup(type, size);
    // rush crowds know the place is packed: a bit more patient
    if (grp && g.rushActive()) grp.rushCrowd = true;
  }

  update(dt) {
    const g = this.game;
    if (g.phase !== 'service') return;
    const m = g.clock;
    // arrivals (Poisson)
    if (m < CONFIG.lastEntry) {
      const perSec = (this.arrivalRate() / 60) * CONFIG.minutesPerSecond;
      if (g.rng.chance(perSec * dt)) this.spawnRandom();
      // guarantee a first customer quickly on night 1
      if (g.state.day === 1 && !this.firstDone && m > 18 * 60 + 8) {
        this.firstDone = true;
        if (!g.customers.groups.length) this.spawnRandom(g.data.customerTypes.find((t) => t.id === 'habitue'));
      }
    }
    // rushes: announce -> live -> summary
    for (const r of this.rushes || []) {
      if (r.phase === 'pending' && m >= r.at - RUSH_ANNOUNCE && !g.rush) {
        r.phase = 'announce';
        g.rush = r;
        g.bus.emit('rushAnnounce', { rush: r });
      } else if (r.phase === 'announce' && m >= r.at) this.startRush(r);
      else if (r.phase === 'live' && (m >= r.end || m >= CONFIG.lastEntry)) this.endRush();
    }
    // scheduled visits
    for (const s of this.scheduled) {
      if (s.done || m < s.at) continue;
      s.done = true;
      if (s.kind === 'regular') {
        const type = g.data.customerTypes.find((t) => t.id === s.regular.type) || g.data.customerTypes[1];
        const grp = g.customers.spawnGroup(type, 1, { regular: s.regular });
        g.bus.emit('regularArrives', { regular: s.regular, group: grp });
      } else if (s.kind === 'critic') {
        const type = g.data.customerTypes.find((t) => t.id === 'exigeant');
        g.customers.spawnGroup(type, 1, { critic: true });
        g.bus.emit('critic', {});
      }
    }
    // match goals
    while (this.goalTimes?.length && m >= this.goalTimes[0]) {
      this.goalTimes.shift();
      g.bus.emit('goal', {});
      for (const grp of g.customers.groups) {
        if (grp.type.id !== 'sportif' && grp.type.id !== 'amis') continue;
        for (const mm of grp.members) if (mm.mode === 'seated') {
          mm.view.setAction('cheer');
          setTimeout(() => mm.view.action === 'cheer' && mm.view.setAction(mm.drink ? 'drink' : null), 2500);
        }
        grp.members[0]?.say(line('match'), 'party');
        if (g.rng.chance(0.5)) grp.roundsLeft++;
        grp.sat = Math.min(100, grp.sat + 4);
      }
    }
    // incidents
    this.breakCd -= dt;
    if (this.breakCd <= 0 && !g.taps.some((t) => t.broken)) {
      const occ = Math.min(1, g.customers.customerCount() / Math.max(1, g.bar.seatCount()));
      const p = (0.003 + 0.012 * occ) * (g.up('cooling') ? 0.35 : 1);
      if (g.rng.chance(p * dt)) {
        const cands = g.taps.filter((t) => t.beer);
        if (cands.length) {
          const tap = g.rng.pick(cands);
          tap.broken = true;
          this.breakCd = 70;
          g.bus.emit('tapBroken', { tap });
        }
      }
    }
    // spills
    const ev = g.eventEffects();
    for (const grp of g.customers.groups) {
      if (grp.state !== 'round') continue;
      for (const mm of grp.members) {
        if (!mm.drink || mm.drink.t < 2) continue;
        const p = g.products.get(mm.drink.pid);
        if (p.category !== 'draft') continue;
        const chance = 0.0009 * (ev.spills || 1) * (1 + mm.view.drunk * 2);
        if (g.rng.chance(chance * dt)) this.spill(grp, mm, p);
      }
    }
  }

  spill(grp, mm, p) {
    const g = this.game;
    mm.view.hold('R', null);
    mm.drink = null;
    grp.dirtyGlasses++;
    mm.say(line('spill'), 'grumpy');
    mm.view.setAction('shrug');
    setTimeout(() => mm.view.action === 'shrug' && mm.view.setAction(null), 1200);
    const ang = mm.view.facing;
    const x = mm.pos.x + Math.sin(ang) * 0.5, z = mm.pos.z + Math.cos(ang) * 0.5;
    g.world.effects.burst('splash', [x, 0.8, z]);
    g.bar.addPuddle(x, z, p.liquid);
    // they want a replacement (free)
    if (grp.ticket) {
      grp.ticket.items.push({ pid: p.id, member: mm, price: 0, free: true, done: false, cancelled: false });
    } else {
      grp.ticket = g.orders.create(grp, [{ pid: p.id, member: mm, price: 0, free: true, done: false, cancelled: false }]);
    }
    grp.setPatience(CONFIG.patienceServe);
    grp.sat -= 3;
    g.bus.emit('spill', { group: grp });
  }
}
