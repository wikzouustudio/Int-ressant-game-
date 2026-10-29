import { createCharacter, animateCharacter, randomLook } from '../models/character.js';
import { disposeObject } from '../models/builder.js';
import { ROADS } from '../world/environment.js';

// Ambient pedestrians wandering the whole city along the street grid. They reuse the
// instanced crowd renderer; their number follows the quality tier and the time of day.

const SHIRTS = ['#e0573f', '#4b8fd8', '#3bb3a8', '#f2a541', '#8b5cf6', '#e86aa1', '#5fb35a', '#f8f9fa', '#2e3440', '#ffd35c'];
const WALK_Y = 0.23;
const N = ROADS.length;
let nextSeed = 1;

class Citizen {
  constructor(scene) {
    const seed = (nextSeed++ * 2654435761) >>> 0;
    this.look = randomLook(seed, 'citizen', SHIRTS[seed % SHIRTS.length]);
    this.char = createCharacter(this.look);
    this.char.root.remove(this.char.hit); // not clickable
    scene.add(this.char.root);
    this.scene = scene;
    this.ix = (Math.random() * N) | 0;
    this.iz = (Math.random() * N) | 0;
    this.dir = [0, 0];
    this.side = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.5);
    this.speed = 2.1 + Math.random() * 1.2;
    this.phase = Math.random() * 10;
    this.walk = 0;
    this.wait = Math.random() * 2;
    this.mode = Math.random() < 0.5 ? 'phone' : 'idle';
    this.uid = seed;
    const p = this.node(this.ix, this.iz);
    this.char.root.position.set(p.x, WALK_Y, p.z);
    this.target = null;
    this.fade = 0;
    this.char.root.scale.setScalar(0.01);
    this.leaving = false;
  }

  node(ix, iz) {
    // walk on the sidewalk side, offset perpendicular to the current direction
    const ox = this.dir[1] ? this.side : 0;
    const oz = this.dir[0] ? -this.side : 0;
    return { x: ROADS[ix] + ox, z: ROADS[iz] + oz };
  }

  pickNext() {
    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => {
      const x = this.ix + dx, z = this.iz + dz;
      if (x < 0 || z < 0 || x >= N || z >= N) return false;
      return !(dx === -this.dir[0] && dz === -this.dir[1]); // no U-turn
    });
    const [dx, dz] = options[(Math.random() * options.length) | 0] || [-this.dir[0], -this.dir[1]];
    this.dir = [dx, dz];
    this.ix += dx;
    this.iz += dz;
    this.target = this.node(this.ix, this.iz);
  }

  update(dt, t, frame) {
    const c = this.char;
    const root = c.root;
    // spawn / despawn with a quick scale pop instead of popping in
    if (this.leaving) this.fade = Math.max(0, this.fade - dt * 3);
    else if (this.fade < 1) this.fade = Math.min(1, this.fade + dt * 3);
    root.scale.setScalar(Math.max(0.01, this.fade));
    let mode = 'walk';
    if (this.wait > 0) {
      this.wait -= dt;
      mode = this.mode;
      if (this.wait <= 0) this.pickNext();
    } else {
      if (!this.target) this.pickNext();
      const p = root.position;
      const dx = this.target.x - p.x, dz = this.target.z - p.z;
      const d = Math.hypot(dx, dz);
      const step = this.speed * dt;
      if (d <= step) {
        p.x = this.target.x; p.z = this.target.z;
        if (Math.random() < 0.12) { this.wait = 2 + Math.random() * 4; this.mode = Math.random() < 0.5 ? 'phone' : 'idle'; } else this.pickNext();
      } else {
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        const yaw = Math.atan2(dx, dz);
        let diff = yaw - root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        root.rotation.y += diff * Math.min(1, dt * 8);
      }
      this.walk += dt * this.speed * 2.2;
    }
    if (c.offscreen || (c.lod && (frame + this.uid) % 2)) return;
    animateCharacter(c, mode, t + this.phase, this.walk);
  }

  dispose() {
    this.scene.remove(this.char.root);
    disposeObject(this.char.root);
  }
}

export class Citizens {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.max = 60;
    this.alive = 0;
  }

  setMax(n) { this.max = n; }

  update(dt, t) {
    const g = this.game;
    const h = g.hour;
    const busy = h < 6 || h >= 23 ? 0.15 : h < 8 || h >= 20 ? 0.55 : 1;
    const target = Math.round(this.max * busy * (g.weekday === 6 ? 0.7 : 1));
    // grow / shrink gradually (at most one per frame) to avoid spikes
    if (this.alive < target) { this.list.push(new Citizen(g.scene)); this.alive++; }
    else if (this.alive > target) {
      const c = this.list.find((x) => !x.leaving && x.char.offscreen) || this.list.find((x) => !x.leaving);
      if (c) { c.leaving = true; this.alive--; }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      c.update(dt, t, g.frame);
      if (c.leaving && c.fade <= 0) { c.dispose(); this.list.splice(i, 1); }
    }
  }
}
