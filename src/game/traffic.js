import * as THREE from 'three';
import { getRoadGraph, ROAD_TYPES } from '../world/citymap.js';

// Car traffic on the whole road network (right-hand driving, like in Switzerland).
// Cars follow the graph built from the city plan: they keep a gap to the car ahead in
// their lane, wait at junctions that are busy with crossing traffic, and pick a new
// street at every junction. Traffic is kept dense around the camera: cars spawn near
// the view and are recycled when they drive far away. Drawn by the crowd renderer.

const PAINT = ['#e0573f', '#4b8fd8', '#f2c14e', '#f8f9fa', '#2e3440', '#3bb3a8', '#8b5cf6', '#e86aa1', '#9aa4b1'];
const Y = 0.08;
const _c = new THREE.Color();

const G = getRoadGraph();
const typeOf = (e) => ROAD_TYPES[e.line.type];
// junction radius: how far from the node cars stop / leave
for (const n of G.nodes) {
  let r = 0;
  for (const e of n.edges) r = Math.max(r, typeOf(e).c + 1.2);
  n.r = n.edges.length > 2 ? r : 0.5;
  n.active = new Map();
}
for (const e of G.edges) {
  const cum = [0];
  for (let i = 1; i < e.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(e.pts[i][0] - e.pts[i - 1][0], e.pts[i][1] - e.pts[i - 1][1]));
  e.cum = cum;
  e.lanes = {}; // `${dir}:${k}` → cars sorted by progress
  e.speed = e.line.type === 'hwy' ? 17 : e.line.type === 'sec' ? 7 : 10;
}

/** Position, heading on an edge at arc length s (from its start `a`), shifted by `off` to the right. */
function sample(e, s, off, dir, out) {
  const d = dir > 0 ? s : e.len - s;
  const cum = e.cum;
  let k = 1;
  while (k < cum.length - 1 && cum[k] < d) k++;
  const a = e.pts[k - 1], b = e.pts[k];
  const t = Math.min(1, Math.max(0, (d - cum[k - 1]) / (cum[k] - cum[k - 1] || 1)));
  let tx = b[0] - a[0], tz = b[1] - a[1];
  const l = Math.hypot(tx, tz) || 1;
  tx = (tx / l) * dir; tz = (tz / l) * dir;
  out.x = a[0] + (b[0] - a[0]) * t - tz * off;
  out.z = a[1] + (b[1] - a[1]) * t + tx * off;
  out.tx = tx; out.tz = tz;
  return out;
}

let nextId = 1;
function makeCar(scene) {
  const root = new THREE.Group();
  root.scale.setScalar(0.01);
  scene.add(root);
  const colors = new Float32Array(15);
  _c.set(PAINT[(Math.random() * PAINT.length) | 0]);
  colors[6] = _c.r; colors[7] = _c.g; colors[8] = _c.b; // "shirt" slot = body paint
  return { root, parts: [[root, 'car']], colors, lod: 0, offscreen: false, id: nextId++ };
}

const _p = { x: 0, z: 0, tx: 0, tz: 0 };
const _q = { x: 0, z: 0, tx: 0, tz: 0 };

export class Traffic {
  constructor(game) {
    this.game = game;
    this.cars = [];  // render items for the crowd renderer
    this.list = [];
    this.max = 24;
    this.focus = new THREE.Vector3();
  }

  setMax(n) { this.max = n; }

  laneOf(car) {
    const key = car.dir + ':' + car.lane;
    return car.edge.lanes[key] || (car.edge.lanes[key] = []);
  }

  spawn() {
    // pick an edge near the focus point
    const f = this.focus;
    for (let tries = 0; tries < 8; tries++) {
      const e = G.edges[(Math.random() * G.edges.length) | 0];
      const s = Math.random() * e.len;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const lanes = typeOf(e).lanes;
      const lane = (Math.random() * lanes.length) | 0;
      sample(e, s, lanes[lane], dir, _p);
      const d = Math.hypot(_p.x - f.x, _p.z - f.z);
      if (d > 230 || d < 15) continue;
      const startNode = dir > 0 ? e.a : e.b, endNode = dir > 0 ? e.b : e.a;
      if (s < startNode.r + 2 || s > e.len - endNode.r - 6) continue;
      const car = { ch: makeCar(this.game.scene), edge: e, dir, lane, s, speed: 4, conn: null, fade: 0, leaving: false };
      const list = this.laneOf(car);
      if (list.some((c) => Math.abs(c.s - s) < 10)) { this.game.scene.remove(car.ch.root); continue; }
      list.push(car);
      this.list.push(car);
      this.cars.push(car.ch);
      return;
    }
  }

  remove(car) {
    if (!car.conn) { const l = this.laneOf(car); l.splice(l.indexOf(car), 1); }
    else car.conn.node.active.delete(car);
    this.list.splice(this.list.indexOf(car), 1);
    this.cars.splice(this.cars.indexOf(car.ch), 1);
    this.game.scene.remove(car.ch.root);
  }

  /** Choose the next edge at `node`, coming from edge `from`. */
  route(car, node) {
    const opts = node.edges.filter((e) => e !== car.edge);
    if (!opts.length) return car.edge; // dead end: turn around
    let tot = 0;
    const w = opts.map((e) => { const x = (typeOf(e).main ? 2 : 1) * (e.line === car.edge.line ? 1.6 : 1); tot += x; return x; });
    let r = Math.random() * tot;
    for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r <= 0) return opts[i]; }
    return opts[0];
  }

  update(dt) {
    const g = this.game;
    this.focus.copy(g.engine.controls.target);
    const alive = this.list.filter((c) => !c.leaving).length;
    if (alive < this.max) this.spawn();
    else if (alive > this.max + 2) { const c = this.list.find((x) => !x.leaving); if (c) c.leaving = true; }

    // car following on every lane
    for (const e of G.edges) {
      for (const key in e.lanes) {
        const list = e.lanes[key];
        if (list.length > 1) list.sort((a, b) => a.s - b.s);
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const car = this.list[i];
      const root = car.ch.root;
      if (car.leaving) car.fade = Math.max(0, car.fade - dt * 2.5);
      else if (car.fade < 1) car.fade = Math.min(1, car.fade + dt * 2.5);
      root.scale.setScalar(Math.max(0.01, car.fade));
      if (car.leaving && car.fade <= 0) { this.remove(car); continue; }

      if (car.conn) { this.drive(car, dt); continue; }
      const e = car.edge;
      const lanes = typeOf(e).lanes;
      const list = this.laneOf(car);
      const idx = list.indexOf(car);
      const ahead = list[idx + 1];
      const endNode = car.dir > 0 ? e.b : e.a;
      const stopAt = e.len - endNode.r;
      let target = e.speed * (car.lane ? 1.1 : 1);
      if (ahead) {
        const gap = ahead.s - car.s;
        if (gap < 12) target = Math.min(target, Math.max(0, (gap - 6) * 1.6));
      }
      const toStop = stopAt - car.s;
      if (toStop < 14) target = Math.min(target, Math.max(2.5, toStop * 0.9));
      if (toStop <= 0.4) {
        // try to enter the junction
        if (!car.next) car.next = this.route(car, endNode);
        if (this.enter(car, endNode)) { this.drive(car, dt); continue; }
        target = 0;
        car.s = Math.min(car.s, stopAt);
      }
      car.speed += (target - car.speed) * Math.min(1, dt * (target < car.speed ? 5 : 1.4));
      car.s = Math.min(car.s + car.speed * dt, stopAt);
      sample(e, car.s, lanes[car.lane], car.dir, _p);
      root.position.set(_p.x, Y, _p.z);
      root.rotation.y = Math.atan2(_p.tx, _p.tz);
      // recycle cars that wandered far from the view
      if (!car.leaving && (Math.hypot(_p.x - this.focus.x, _p.z - this.focus.z) > 300)) car.leaving = true;
    }
  }

  /** Reserve the junction (one traffic stream at a time) and build the turning curve. */
  enter(car, node) {
    const inKey = car.edge.id * 2 + (car.dir > 0 ? 1 : 0);
    if (node.edges.length > 2) for (const k of node.active.values()) if (k !== inKey) return false;
    const next = car.next;
    const dir = next === car.edge ? -car.dir : next.a === node ? 1 : -1;
    const lanes = typeOf(next).lanes;
    const lane = Math.min(car.lane, lanes.length - 1);
    const start = (dir > 0 ? next.a : next.b) === node ? node.r : node.r;
    // room on the next lane?
    const key = dir + ':' + lane;
    const nl = next.lanes[key] || (next.lanes[key] = []);
    const tail = nl.reduce((m, c) => Math.min(m, c.s), Infinity);
    if (tail < start + 7) return false;
    sample(car.edge, car.s, typeOf(car.edge).lanes[car.lane], car.dir, _p);
    sample(next, start, lanes[lane], dir, _q);
    const d = Math.hypot(_q.x - _p.x, _q.z - _p.z);
    const k = Math.max(1.5, d * 0.45);
    car.conn = {
      node, inKey, next, dir, lane, start, t: 0,
      p0: [_p.x, _p.z], p1: [_p.x + _p.tx * k, _p.z + _p.tz * k], p2: [_q.x - _q.tx * k, _q.z - _q.tz * k], p3: [_q.x, _q.z],
      len: Math.max(1, d * 1.15),
    };
    node.active.set(car, inKey);
    const l = this.laneOf(car);
    l.splice(l.indexOf(car), 1);
    return true;
  }

  drive(car, dt) {
    const c = car.conn;
    car.speed += (Math.min(7, typeOf(c.next).main ? 8 : 6) - car.speed) * Math.min(1, dt * 1.5);
    c.t = Math.min(1, c.t + (car.speed * dt) / c.len);
    const t = c.t, u = 1 - t;
    const b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
    const x = b0 * c.p0[0] + b1 * c.p1[0] + b2 * c.p2[0] + b3 * c.p3[0];
    const z = b0 * c.p0[1] + b1 * c.p1[1] + b2 * c.p2[1] + b3 * c.p3[1];
    const dx = 3 * u * u * (c.p1[0] - c.p0[0]) + 6 * u * t * (c.p2[0] - c.p1[0]) + 3 * t * t * (c.p3[0] - c.p2[0]);
    const dz = 3 * u * u * (c.p1[1] - c.p0[1]) + 6 * u * t * (c.p2[1] - c.p1[1]) + 3 * t * t * (c.p3[1] - c.p2[1]);
    const root = car.ch.root;
    root.position.set(x, Y, z);
    if (dx * dx + dz * dz > 1e-6) root.rotation.y = Math.atan2(dx, dz);
    if (t >= 1) {
      c.node.active.delete(car);
      car.edge = c.next; car.dir = c.dir; car.lane = c.lane; car.s = c.start;
      car.conn = null; car.next = null;
      this.laneOf(car).push(car);
    }
  }
}
