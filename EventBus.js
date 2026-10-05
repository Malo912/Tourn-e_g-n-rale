// Tiny publish/subscribe bus used to decouple simulation, UI and audio.
export class EventBus {
  constructor() {
    this.map = new Map();
  }
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn) {
    this.map.get(evt)?.delete(fn);
  }
  emit(evt, payload) {
    const set = this.map.get(evt);
    if (set) for (const fn of [...set]) fn(payload);
    const any = this.map.get('*');
    if (any) for (const fn of [...any]) fn(evt, payload);
  }
}
