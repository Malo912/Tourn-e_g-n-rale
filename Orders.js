// Order tickets shown in the HUD.
let TICKET_ID = 1;

export class Ticket {
  constructor(mgr, group, items) {
    this.id = TICKET_ID++;
    this.mgr = mgr;
    this.group = group;
    this.items = items;
    this.open = true;
    this.created = mgr.game.clock;
    this.round = group.round;
  }
  get label() {
    const s = this.group.spots[0];
    return s ? s.label : '?';
  }
  pending() {
    return this.items.filter((i) => !i.done && !i.cancelled);
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.mgr.remove(this);
  }
}

export class OrderManager {
  constructor(game) {
    this.game = game;
    this.tickets = [];
  }
  create(group, items) {
    const t = new Ticket(this, group, items);
    this.tickets.push(t);
    this.game.bus.emit('ticket', { ticket: t });
    return t;
  }
  remove(t) {
    this.tickets = this.tickets.filter((x) => x !== t);
    this.game.bus.emit('ticketClosed', { ticket: t });
  }
  /** all pending product ids (oldest first) */
  pendingList() {
    const out = [];
    for (const t of this.tickets) for (const it of t.pending()) out.push({ ticket: t, item: it });
    return out;
  }
  clear() {
    this.tickets = [];
  }
}
