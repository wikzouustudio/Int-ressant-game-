import * as THREE from 'three';
import { ROADS } from '../world/environment.js';
import { CITY_HALF, isMainRoad } from './config.js';

// Car traffic on the main roads (right-hand driving, like in Switzerland). Cars keep a
// safe gap to the car ahead and take turns at boulevard intersections, which are
// reserved by one car at a time. Drawn by the instanced crowd renderer.

const PAINT = ['#e0573f', '#4b8fd8', '#f2c14e', '#f8f9fa', '#2e3440', '#3bb3a8', '#8b5cf6', '#e86aa1', '#9aa4b1'];
const MAIN = ROADS.filter(isMainRoad);
const LANE = 1.0;
const WRAP = CITY_HALF + 6;
const BOX = 3.2;          // half-size of an intersection box
const Y = 0.06;
const _c = new THREE.Color();

// lanes: axis 'x' (horizontal street z = v) or 'z' (vertical street x = v), dir ±1
const LANES = [];
for (const v of MAIN) {
  LANES.push({ axis: 'x', dir: 1, off: v + LANE, cars: [] });
  LANES.push({ axis: 'x', dir: -1, off: v - LANE, cars: [] });
  LANES.push({ axis: 'z', dir: 1, off: v - LANE, cars: [] });
  LANES.push({ axis: 'z', dir: -1, off: v + LANE, cars: [] });
}

let nextId = 1;
function makeCar(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const colors = new Float32Array(15);
  _c.set(PAINT[(Math.random() * PAINT.length) | 0]);
  colors[6] = _c.r; colors[7] = _c.g; colors[8] = _c.b; // "shirt" slot = body paint
  return { root, parts: [[root, 'car']], colors, lod: 0, offscreen: false, id: nextId++ };
}

export class Traffic {
  constructor(game) {
    this.game = game;
    this.cars = [];      // render items for the crowd renderer
    this.max = 24;
    this.reserved = new Map();
  }

  setMax(n) { this.max = n; }

  spawn() {
    const lane = LANES[(Math.random() * LANES.length) | 0];
    const s = (Math.random() * 2 - 1) * CITY_HALF;
    if (lane.cars.some((c) => Math.abs(c.s - s) < 9)) return;
    const ch = makeCar(this.game.scene);
    const car = { ch, lane, s, speed: 0, max: 7 + Math.random() * 4, holding: null };
    lane.cars.push(car);
    this.cars.push(ch);
  }

  remove(car) {
    car.lane.cars.splice(car.lane.cars.indexOf(car), 1);
    this.cars.splice(this.cars.indexOf(car.ch), 1);
    this.game.scene.remove(car.ch.root);
    for (const [k, v] of this.reserved) if (v === car) this.reserved.delete(k);
  }

  update(dt) {
    const total = LANES.reduce((n, l) => n + l.cars.length, 0);
    if (total < this.max) this.spawn();
    else if (total > this.max + 2) { const l = LANES.find((x) => x.cars.length); if (l) this.remove(l.cars[0]); }

    for (const lane of LANES) {
      const d = lane.dir;
      lane.cars.sort((a, b) => (a.s - b.s) * d);
      for (let i = lane.cars.length - 1; i >= 0; i--) {
        const car = lane.cars[i];
        const ahead = lane.cars[i + 1];
        let target = car.max;
        if (ahead) {
          const gap = (ahead.s - car.s) * d;
          if (gap < 10) target = Math.min(target, Math.max(0, (gap - 5.5) * 1.5));
        }
        // intersections with crossing boulevards: reserve the box or wait at the stop line
        for (const x of MAIN) {
          const dist = (x - car.s) * d;
          const id = lane.axis === 'x' ? `${x}|${Math.round(lane.off - LANE * d)}` : `${Math.round(lane.off + LANE * d)}|${x}`;
          if (dist > -BOX && dist < BOX + 6) {
            const owner = this.reserved.get(id);
            if (dist > BOX && owner && owner !== car) target = Math.min(target, Math.max(0, (dist - BOX - 1) * 2));
            else if (dist <= BOX + 1.5 && (!owner || owner === car)) { this.reserved.set(id, car); car.holding = id; }
          } else if (car.holding === id) {
            this.reserved.delete(id);
            car.holding = null;
          }
        }
        car.speed += (target - car.speed) * Math.min(1, dt * (target < car.speed ? 6 : 1.5));
        car.s += car.speed * d * dt;
        if (car.s * d > WRAP) {
          car.s = -WRAP * d;
          for (const [k, v] of this.reserved) if (v === car) this.reserved.delete(k);
          car.holding = null;
        }
        const r = car.ch.root;
        if (lane.axis === 'x') { r.position.set(car.s, Y, lane.off); r.rotation.y = d > 0 ? Math.PI / 2 : -Math.PI / 2; }
        else { r.position.set(lane.off, Y, car.s); r.rotation.y = d > 0 ? 0 : Math.PI; }
      }
    }
  }
}
