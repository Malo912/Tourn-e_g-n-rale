// Persistence in the browser (localStorage), always wrapped in try/catch.
const KEY = 'tournee-generale-save-v1';

export class Save {
  constructor(game) {
    this.game = game;
  }
  write() {
    const st = this.game.state;
    if (!st) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(st));
      return true;
    } catch (e) {
      return false;
    }
  }
  read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const st = JSON.parse(raw);
      if (!st || st.version !== 1) return null;
      return st;
    } catch (e) {
      return null;
    }
  }
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {
      /* ignore */
    }
  }
  /** settings stored separately so they survive a new game */
  readSettings() {
    try {
      return JSON.parse(localStorage.getItem(KEY + ':settings') || 'null');
    } catch (e) {
      return null;
    }
  }
  writeSettings(s) {
    try {
      localStorage.setItem(KEY + ':settings', JSON.stringify(s));
    } catch (e) {
      /* ignore */
    }
  }
}
