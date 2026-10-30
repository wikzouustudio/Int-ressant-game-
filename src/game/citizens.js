import { createCharacter, animateCharacter, randomLook } from '../models/character.js';
import { disposeObject } from '../models/builder.js';
import { zoneAt } from '../world/citymap.js';
import { WALK } from './walkgraph.js';

// Ambient pedestrians wandering the whole city along the street grid. They reuse the
// instanced crowd renderer; their number follows the quality tier and the time of day.

const SHIRTS = ['#e0573f', '#4b8fd8', '#3bb3a8', '#f2a541', '#8b5cf6', '#e86aa1', '#5fb35a', '#f8f9fa', '#2e3440', '#ffd35c'];
const WALK_Y = 0.23;
let nextSeed = 1;

// Passers-by random-walk the walking network (sidewalks of every street, footpaths)
// near the camera. They reuse the instanced crowd renderer.
const PED = WALK;

class Stroller {
  constructor(scene, focus) {
    const seed = (nextSeed++ * 2654435761) >>> 0;
    this.look = randomLook(seed, 'citizen', SHIRTS[seed % SHIRTS.length]);
    this.char = createCharacter(this.look);
    this.char.root.remove(this.char.hit); // not clickable
    scene.add(this.char.root);
    this.scene = scene;
    this.speed = 2.1 + Math.random() * 1.2;
    this.phase = Math.random() * 10;
    this.walk = 0;
    this.wait = Math.random() * 2;
    this.mode = Math.random() < 0.5 ? 'phone' : 'idle';
    this.uid = seed;
    this.fade = 0;
    this.char.root.scale.setScalar(0.01);
    this.leaving = false;
    this.sideSign = Math.random() < 0.5 ? -1 : 1;
    this.lateral = (Math.random() - 0.5) * 1.6;
    let e = null;
    for (let k = 0; k < 10 && !e; k++) {
      const c = PED.edges[(Math.random() * PED.edges.length) | 0];
      const p = c.pts[(c.pts.length / 2) | 0];
      if (Math.hypot(p[0] - focus.x, p[1] - focus.z) < 200) e = c;
    }
    e = e || PED.edges[(Math.random() * PED.edges.length) | 0];
    this.setEdge(e, Math.random() < 0.5 ? e.a : e.b, (Math.random() * (e.pts.length - 1)) | 0);
    const [x, z] = this.path[this.k];
    this.char.root.position.set(x, this.y(x, z), z);
  }

  y(x, z) { return this.edge.off ? WALK_Y : zoneAt(x, z) === 'ped' ? 0.06 : 0.07; }

  dispose() {
    this.scene.remove(this.char.root);
    disposeObject(this.char.root);
  }

  setEdge(e, from, k = 0) {
    this.edge = e;
    this.path = from === e.a ? e.pts : [...e.pts].reverse();
    this.end = from === e.a ? e.b : e.a;
    this.k = k;
  }

  pickNext() {
    const node = this.end;
    const opts = node.edges.filter((x) => x !== this.edge);
    const e = opts.length ? opts[(Math.random() * opts.length) | 0] : this.edge;
    this.setEdge(e, node);
    this.target = null;
  }

  update(dt, t, frame) {
    const c = this.char;
    const root = c.root;
    if (this.leaving) this.fade = Math.max(0, this.fade - dt * 3);
    else if (this.fade < 1) this.fade = Math.min(1, this.fade + dt * 3);
    root.scale.setScalar(Math.max(0.01, this.fade));
    let mode = 'walk';
    if (this.wait > 0) {
      this.wait -= dt;
      mode = this.mode;
    } else {
      if (this.k >= this.path.length - 1) {
        if (Math.random() < 0.15) { this.wait = 2 + Math.random() * 5; this.mode = Math.random() < 0.5 ? 'phone' : 'idle'; }
        this.pickNext();
      }
      const a = this.path[this.k], b = this.path[Math.min(this.k + 1, this.path.length - 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1];
      const l = Math.hypot(dx, dz) || 1;
      const lat = this.edge.off ? (this.path === this.edge.pts ? 1 : -1) * this.sideSign * (this.edge.off + this.lateral * 0.25) : this.lateral;
      const tx = b[0] - (dz / l) * lat, tz = b[1] + (dx / l) * lat;
      const p = root.position;
      dx = tx - p.x; dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      const step = this.speed * 0.8 * dt;
      if (d <= step || d > 30) { p.x = tx; p.z = tz; this.k++; }
      else {
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        const yaw = Math.atan2(dx, dz);
        let diff = yaw - root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        root.rotation.y += diff * Math.min(1, dt * 6);
      }
      p.y = this.y(p.x, p.z);
      this.walk += dt * this.speed * 1.8;
    }
    if (c.offscreen || (c.lod && (frame + this.uid) % 2)) return;
    animateCharacter(c, mode, t + this.phase, this.walk);
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
    if (this.alive < target) {
      // 55 % of the walkers stroll in the old town and the parks, the rest in the district
      if (PED.edges.length) { this.list.push(new Stroller(g.scene, g.engine.controls.target)); this.alive++; }
    }
    else if (this.alive > target) {
      const c = this.list.find((x) => !x.leaving && x.char.offscreen) || this.list.find((x) => !x.leaving);
      if (c) { c.leaving = true; this.alive--; }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      c.update(dt, t, g.frame);
      if (!c.leaving && g.frame % 60 === (c.uid % 60)) {
        const f = g.engine.controls.target, p = c.char.root.position;
        if (Math.hypot(p.x - f.x, p.z - f.z) > 260) { c.leaving = true; this.alive--; }
      }
      if (c.leaving && c.fade <= 0) { c.dispose(); this.list.splice(i, 1); }
    }
  }
}
