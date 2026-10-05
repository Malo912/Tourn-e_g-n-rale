// Ambient life outside: pedestrians strolling on the sidewalk (purely cosmetic).
import { CharacterView, randomLook } from '../world/models/character.js';
import { makePhone } from '../world/models/props.js';

export class Ambient {
  constructor(game) {
    this.game = game;
    this.walkers = [];
    this.timer = 3;
  }

  update(dt) {
    const g = this.game;
    if (!g.state) return;
    this.timer -= dt;
    const { w, d } = g.roomSize();
    const busy = g.phase === 'service' ? 1 : 0.5;
    if (this.timer <= 0 && this.walkers.length < 4) {
      this.timer = (6 + Math.random() * 12) / busy;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const look = randomLook(g.rng, {});
      const v = new CharacterView(look);
      const z = d + 2.75 + Math.random() * 0.5;
      const x = dir > 0 ? -6 : w + 6;
      v.root.position = [x, 0, z];
      v.facing = v.targetFacing = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (Math.random() < 0.3) {
        v.hold('R', makePhone());
        v.setAction('phone');
      }
      g.world.dynamic.add(v.root);
      this.walkers.push({ v, x, z, dir, speed: 0.9 + Math.random() * 0.5, end: dir > 0 ? w + 6 : -6 });
    }
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const p = this.walkers[i];
      p.x += p.dir * p.speed * dt;
      p.v.root.position[0] = p.x;
      p.v.speed = p.speed / 1.35;
      p.v.update(dt, true);
      if ((p.dir > 0 && p.x > p.end) || (p.dir < 0 && p.x < p.end)) {
        p.v.root.removeFromParent();
        this.walkers.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.walkers) p.v.root.removeFromParent();
    this.walkers = [];
  }
}
