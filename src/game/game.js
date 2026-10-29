import * as THREE from 'three';
import {
  CELL, GRID, PAD, PAD_Y, MAX_LEVEL, SAVE_KEY, BUSINESSES, BIZ, WORKERS, UPGRADES,
  FIRST_NAMES, ROBOT_NAMES, levelMult, slotsFor, buildCost, upgradeCost, hireCost, promoteCost, money,
} from './config.js';
import { buildBusiness, buildHQ, buildSign, buildForSale, easeOutBack } from '../models/buildings.js';
import { createCharacter, animateCharacter, randomLook } from '../models/character.js';
import { MeshBuilder, disposeObject } from '../models/builder.js';
import { Effects } from './fx.js';
import { Sound } from './audio.js';
import { ROADS_Z, ROADS_X } from '../world/environment.js';

const TIER = Object.fromEntries(WORKERS.map((w, i) => [w.id, { ...w, index: i }]));
const WALK_Y = 0.23;
const HQ_ROAD_Z = CELL / 2;
const HQ_DEPOSIT_Z = 5.4;
const DAY_LENGTH = 420; // seconds for a full day/night cycle
const SPOT_X = [0, 1.05, -1.05, 2.1, -2.1, 3.15, -3.15, -4.2].map((x) => x - 0.3);
const _v = new THREE.Vector3();

const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

// ===========================================================================
class Plot {
  constructor(game, i, j) {
    this.game = game;
    this.i = i; this.j = j;
    this.key = `${i},${j}`;
    this.center = new THREE.Vector3(i * CELL, 0, j * CELL);
    this.group = new THREE.Group();
    this.group.position.copy(this.center);

    const b = new MeshBuilder();
    b.box(PAD, PAD_Y - 0.02, PAD, '#c4bcad', {});
    this.group.add(b.build());
    const g = new MeshBuilder();
    g.box(PAD - 0.7, 0.04, PAD - 0.7, '#5fa83a', { y: PAD_Y - 0.03 });
    for (let k = 0; k < 7; k++) {
      g.sphere(0.12, ['#ffffff', '#ffd43b', '#ff8fab'][k % 3], { x: Math.sin(k * 7.3 + i) * 5, y: PAD_Y + 0.02, z: Math.cos(k * 3.1 + j) * 5, sy: 0.5 }, 6, 4);
    }
    this.grass = g.build();
    this.group.add(this.grass);
    const c = new MeshBuilder();
    c.box(PAD - 0.7, 0.04, PAD - 0.7, '#d9d3c7', { y: PAD_Y - 0.03 });
    this.concrete = c.build();
    this.group.add(this.concrete);

    this.forSale = buildForSale();
    this.forSale.position.set(4.3, PAD_Y, 4.6);
    this.forSale.rotation.y = -0.35;
    this.group.add(this.forSale);

    const h = new MeshBuilder();
    h.box(2.2, 0.55, 0.55, '#5effa8', { y: -0.275, mat: 'neon' });
    h.box(0.55, 2.2, 0.55, '#5effa8', { y: -1.1, mat: 'neon' });
    this.holo = h.build({ castShadow: false });
    this.holo.position.set(0, 3, 0);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 2.6, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 0.9), transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    );
    ring.position.y = PAD_Y + 0.05 - 3;
    this.holo.add(ring);
    this.holoRing = ring;
    this.group.add(this.holo);

    this.hit = new THREE.Mesh(
      new THREE.BoxGeometry(PAD, 7, PAD).translate(0, 3.5, 0),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hit.userData = { type: 'plot', plot: this };
    this.group.add(this.hit);
    this.building = null;
    this.setOccupied(false);
    game.scene.add(this.group);
  }

  setOccupied(on) {
    this.grass.visible = !on;
    this.concrete.visible = on;
    this.forSale.visible = !on;
    this.holo.visible = !on;
  }

  update(t, showHolo) {
    if (this.building) return;
    this.holo.visible = showHolo;
    if (showHolo) {
      this.holo.rotation.y = t * 1.2 + this.i;
      this.holo.position.y = 3 + Math.sin(t * 2 + this.j) * 0.25;
      this.holoRing.position.y = PAD_Y + 0.05 - this.holo.position.y;
      this.holoRing.rotation.y = -this.holo.rotation.y;
    }
  }
}

// ===========================================================================
class Building {
  constructor(game, plot, typeId, level = 1) {
    this.game = game;
    this.plot = plot;
    this.typeId = typeId;
    this.level = level;
    this.workers = [];
    this.root = new THREE.Group();
    this.root.position.copy(plot.center).setY(PAD_Y);
    game.scene.add(this.root);
    this.emitTimer = Math.random();
    this.anim = null;
    this.routeLength = this.computeRouteLength();
    this.rebuild(false);
    plot.building = this;
    plot.setOccupied(true);
  }

  get biz() { return BIZ[this.typeId]; }
  get slots() { return slotsFor(this.level); }

  rebuild(animate) {
    if (this.model) {
      this.root.remove(this.model.group);
      disposeObject(this.model.group);
    }
    this.model = buildBusiness(this.typeId, this.level);
    this.root.add(this.model.group);
    this.workStyle = this.model.workStyle;
    if (this.sign) { this.root.remove(this.sign); disposeObject(this.sign); }
    this.sign = buildSign(this.biz.name, `Niveau ${this.level}`, this.biz.color, this.biz.icon);
    this.sign.position.set(5.15, 0, 5.4);
    this.sign.rotation.y = -0.45;
    this.sign.scale.setScalar(0.78);
    this.root.add(this.sign);
    if (animate) this.anim = { t: 0, dur: 0.9 };
  }

  spotPos(slot) {
    return new THREE.Vector3(this.plot.center.x + SPOT_X[slot], WALK_Y, this.plot.center.z + 6.0);
  }

  computeRouteLength() {
    const { i, j } = this.plot;
    const cx = i * CELL, cz = j * CELL;
    let len = CELL / 2 - 6;
    if (j !== 0) {
      const xr = i === 0 ? CELL / 2 : cx - Math.sign(i) * CELL / 2;
      len += Math.abs(xr - cx) + Math.abs(cz + CELL / 2 - HQ_ROAD_Z) + Math.abs(xr);
    } else {
      len += Math.abs(cx);
    }
    return len + (HQ_ROAD_Z - HQ_DEPOSIT_Z);
  }

  makePath(slot, toHQ) {
    const { i, j } = this.plot;
    const cx = i * CELL, cz = j * CELL;
    const jx = (Math.random() - 0.5) * 2.6;
    const jz = (Math.random() - 0.5) * 2.6;
    const spot = this.spotPos(slot);
    const zr = cz + CELL / 2 + jz;
    const pts = [new THREE.Vector3(spot.x, WALK_Y, zr)];
    if (j !== 0) {
      const xr = (i === 0 ? CELL / 2 : cx - Math.sign(i) * CELL / 2) + jx;
      pts.push(new THREE.Vector3(xr, WALK_Y, zr), new THREE.Vector3(xr, WALK_Y, HQ_ROAD_Z + jz));
    }
    const hx = (Math.random() - 0.5) * 6.5;
    pts.push(new THREE.Vector3(hx, WALK_Y, HQ_ROAD_Z + jz), new THREE.Vector3(hx, WALK_Y, HQ_DEPOSIT_Z));
    if (toHQ) return pts;
    pts.reverse();
    pts.push(spot);
    return pts;
  }

  tripIncome(tier) {
    return this.biz.income * levelMult(this.level) * tier.mult * this.game.incomeMult;
  }

  estimatedRate() {
    let r = 0;
    for (const w of this.workers) {
      const t = w.tier;
      const cycle = w.workTime() + (2 * this.routeLength) / (t.speed * this.game.speedMult) + 0.7;
      r += this.tripIncome(t) / cycle;
    }
    return r;
  }

  toWorld(v) { return this.root.localToWorld(v); }

  update(dt, t) {
    if (this.anim) {
      this.anim.t += dt;
      const k = Math.min(1, this.anim.t / this.anim.dur);
      const s = easeOutBack(k);
      this.model.group.scale.set(1 + (1 - k) * 0.15, Math.max(0.01, s), 1 + (1 - k) * 0.15);
      if (k >= 1) { this.model.group.scale.set(1, 1, 1); this.anim = null; }
    }
    for (const fn of this.model.animated) fn(t, dt, this.game.fx, (v) => this.toWorld(v));
    if (this.model.emitters.length) {
      this.emitTimer -= dt;
      if (this.emitTimer <= 0) {
        this.emitTimer = 0.35;
        const dark = this.typeId === 'factory';
        for (const e of this.model.emitters) {
          this.game.fx.puff(this.toWorld(e.clone()), {
            color: dark ? '#b8bcc2' : '#eef0f2', size: dark ? 1.1 : 0.7, life: 3.2, up: 1.6, spread: 0.3, radial: 0.8, grow: 2.2,
          });
        }
      }
    }
  }

  dispose() {
    this.game.scene.remove(this.root);
    disposeObject(this.root);
  }
}

// ===========================================================================
class Worker {
  constructor(game, building, data, slot) {
    this.game = game;
    this.building = building;
    this.data = data;
    this.slot = slot;
    this.state = 'working';
    this.timer = Math.random() * 1.5;
    this.path = null;
    this.seg = 0;
    this.phase = Math.random() * 10;
    this.walkPhase = 0;
    this.boost = 0;
    this.carry = 0;
    this.yaw = Math.PI;
    this.buildChar();
    this.char.root.position.copy(building.spotPos(slot));
  }

  get tier() { return TIER[this.data.tier]; }

  buildChar() {
    const look = randomLook(this.data.seed, this.data.tier, this.building.biz.color);
    const c = createCharacter(look);
    c.hit.userData = { type: 'worker', worker: this };
    if (this.char) {
      c.root.position.copy(this.char.root.position);
      c.bag.visible = this.char.bag.visible;
      this.game.scene.remove(this.char.root);
      disposeObject(this.char.root);
    }
    c.root.traverse((o) => { if (o.isMesh) o.castShadow = o.material.visible !== false && o.name !== 'neon'; });
    this.char = c;
    this.game.scene.add(c.root);
  }

  workTime() {
    return this.building.biz.workTime * this.tier.workMul * this.game.workMult;
  }

  statusLabel() {
    return { working: 'Travaille', toHQ: 'Livre l\'argent', deposit: 'Dépose', toWork: 'Retourne au travail' }[this.state];
  }

  followPath(dt, speed) {
    let remaining = speed * dt;
    const pos = this.char.root.position;
    while (remaining > 0 && this.seg < this.path.length) {
      const target = this.path[this.seg];
      const dx = target.x - pos.x, dz = target.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1e-4 || d <= remaining) {
        pos.x = target.x; pos.z = target.z;
        remaining -= d;
        this.seg++;
      } else {
        pos.x += (dx / d) * remaining;
        pos.z += (dz / d) * remaining;
        this.yaw = Math.atan2(dx, dz);
        remaining = 0;
      }
    }
    return this.seg >= this.path.length;
  }

  update(dt, t) {
    const g = this.game;
    const c = this.char;
    if (this.boost > 0) this.boost -= dt;
    const bmul = this.boost > 0 ? 2 : 1;
    switch (this.state) {
      case 'working': {
        this.timer += dt * bmul;
        this.yaw = Math.PI;
        animateCharacter(c, 'work', t * bmul + this.phase, 0, this.building.workStyle);
        if (this.timer >= this.workTime()) {
          this.carry = this.building.tripIncome(this.tier);
          c.bag.visible = true;
          this.path = this.building.makePath(this.slot, true);
          this.seg = 0;
          this.state = 'toHQ';
        }
        break;
      }
      case 'toHQ':
      case 'toWork': {
        const speed = this.tier.speed * g.speedMult * bmul;
        this.walkPhase += dt * speed * 2.0;
        animateCharacter(c, this.state === 'toHQ' ? 'carry' : 'walk', t, this.walkPhase);
        if (this.followPath(dt, speed)) {
          if (this.state === 'toHQ') {
            this.state = 'deposit';
            this.timer = 0;
            c.bag.visible = false;
            g.deposit(this);
          } else {
            this.state = 'working';
            this.timer = 0;
          }
        }
        break;
      }
      case 'deposit': {
        this.timer += dt;
        this.yaw = Math.PI;
        animateCharacter(c, 'cheer', t + this.phase, 0);
        if (this.timer > 0.65) {
          this.path = this.building.makePath(this.slot, false);
          this.seg = 0;
          this.state = 'toWork';
        }
        break;
      }
    }
    c.root.rotation.y = lerpAngle(c.root.rotation.y, this.yaw, Math.min(1, dt * 12));
  }

  dispose() {
    this.game.scene.remove(this.char.root);
    disposeObject(this.char.root);
  }
}

// ===========================================================================
export class Game {
  constructor(engine, env, fxLayer) {
    this.engine = engine;
    this.scene = engine.scene;
    this.camera = engine.camera;
    this.env = env;
    this.fx = new Effects(this.scene, this.camera, fxLayer);
    this.sound = new Sound();
    this.listeners = {};

    this.cash = 40;
    this.totalEarned = 0;
    this.upgrades = new Set();
    this.tod = 0.3;
    this.time = 0;
    this.stats = { deposits: 0, clicks: 0, golden: 0, playTime: 0, best: 0 };
    this.tutorial = 0;
    this.milestone = 0;
    this.rush = 0;
    this.nextRush = 150 + Math.random() * 120;
    this.nextGolden = 40;
    this.golden = null;

    this.plots = new Map();
    this.buildings = new Map();
    this.workers = [];
    this.pickables = [];
    this.selected = null;
    this.hovered = null;
    this.frame = 0;
    this.rateCache = 0;

    this.createHQ();
    for (let i = -GRID; i <= GRID; i++) {
      for (let j = -GRID; j <= GRID; j++) {
        if (i === 0 && j === 0) continue;
        const p = new Plot(this, i, j);
        this.plots.set(p.key, p);
      }
    }
    this.createFrames();
    this.createGolden();
    this.bindInput();
  }

  // ---------------- events ----------------
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, data) { (this.listeners[ev] || []).forEach((fn) => fn(data)); }

  // ---------------- multipliers ----------------
  get incomeMult() {
    let m = 1;
    for (const u of UPGRADES) if (u.income && this.upgrades.has(u.id)) m *= u.income;
    return m;
  }
  get speedMult() {
    let m = 1;
    for (const u of UPGRADES) if (u.speed && this.upgrades.has(u.id)) m *= u.speed;
    return m;
  }
  get workMult() {
    let m = 1;
    for (const u of UPGRADES) if (u.work && this.upgrades.has(u.id)) m *= u.work;
    return m;
  }
  get goldenMult() { return this.upgrades.has('golden') ? 3 : 1; }
  get rate() { return this.rateCache * (this.rush > 0 ? 2 : 1); }
  get clickValue() { return Math.max(1, Math.round(1 + this.rateCache * 0.12)); }

  computeRate() {
    let r = 0;
    for (const b of this.buildings.values()) r += b.estimatedRate();
    this.rateCache = r;
    return r;
  }

  countType(typeId) {
    let n = 0;
    for (const b of this.buildings.values()) if (b.typeId === typeId) n++;
    return n;
  }
  isUnlocked(biz) {
    if (biz.index === 0) return true;
    return this.countType(BUSINESSES[biz.index - 1].id) > 0;
  }
  buildPrice(typeId) { return buildCost(BIZ[typeId], this.countType(typeId)); }
  upgradePrice(b) { return upgradeCost(b.biz, b.level); }
  hirePrice(b, tierId) { return hireCost(b.biz, TIER[tierId], b.workers.length); }
  promotePrice(w) {
    const next = WORKERS[w.tier.index + 1];
    return next ? promoteCost(w.building.biz, w.tier, next) : Infinity;
  }
  /** Empty plots next to the HQ or to an owned building are highlighted. */
  isFrontier(p) {
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const i = p.i + di, j = p.j + dj;
        if (i === 0 && j === 0) return true;
        if (this.buildings.has(`${i},${j}`)) return true;
      }
    }
    return false;
  }

  cheapestBuild() {
    let m = Infinity;
    for (const b of BUSINESSES) if (this.isUnlocked(BIZ[b.id])) m = Math.min(m, this.buildPrice(b.id));
    return m;
  }

  spend(amount) {
    if (this.cash + 1e-9 < amount) { this.sound.error(); this.emit('toast', { text: 'Pas assez d\'argent 💸', kind: 'error' }); return false; }
    this.cash -= amount;
    return true;
  }

  earn(amount) {
    this.cash += amount;
    this.totalEarned += amount;
  }

  // ---------------- actions ----------------
  build(plot, typeId, free = false) {
    if (plot.building) return false;
    const biz = BIZ[typeId];
    if (!free) {
      if (!this.isUnlocked(biz)) return false;
      if (!this.spend(this.buildPrice(typeId))) return false;
    }
    const b = new Building(this, plot, typeId, 1);
    this.buildings.set(plot.key, b);
    if (!free) {
      b.rebuild(true);
      this.fx.dust(b.root.position.clone(), 22);
      this.fx.sparkle(b.root.position.clone().add(new THREE.Vector3(0, 4, 0)), biz.color, 20);
      this.sound.build();
      this.emit('toast', { text: `${biz.icon} ${biz.name} construit !`, kind: 'success' });
      if (this.tutorial === 0) this.setTutorial(1);
      this.select(b);
    }
    this.computeRate();
    this.emit('change');
    return b;
  }

  upgrade(b) {
    if (b.level >= MAX_LEVEL) return;
    if (!this.spend(this.upgradePrice(b))) return;
    b.level++;
    b.rebuild(true);
    this.fx.sparkle(b.root.position.clone().add(new THREE.Vector3(0, 5, 0)), '#ffe066', 24);
    this.fx.dust(b.root.position.clone(), 14);
    this.sound.buy();
    this.emit('toast', { text: `${b.biz.icon} ${b.biz.name} → niveau ${b.level}`, kind: 'success' });
    if (this.tutorial === 3) this.setTutorial(4);
    this.computeRate();
    this.emit('change');
  }

  hire(b, tierId, free = false, data = null) {
    if (b.workers.length >= b.slots) return null;
    const tier = TIER[tierId];
    if (!free) {
      if (b.level < tier.unlock) return null;
      if (!this.spend(this.hirePrice(b, tierId))) return null;
    }
    const d = data || {
      tier: tierId,
      seed: (Math.random() * 1e9) | 0,
      name: this.randomName(tierId),
    };
    const w = new Worker(this, b, d, b.workers.length);
    b.workers.push(w);
    this.workers.push(w);
    if (!free) {
      this.fx.puff(w.char.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), { color: '#ffffff', size: 0.8, life: 0.8, up: 1, spread: 1.4, radial: 3, count: 12 });
      this.fx.float(w.char.root.position.clone().add(new THREE.Vector3(0, 3.2, 0)), `${tier.icon} ${d.name} embauché !`, 'float-info');
      this.sound.buy();
      if (this.tutorial === 1) this.setTutorial(2);
    }
    this.computeRate();
    this.emit('change');
    return w;
  }

  promote(w) {
    const next = WORKERS[w.tier.index + 1];
    if (!next || w.building.level < next.unlock) return;
    if (!this.spend(this.promotePrice(w))) return;
    w.data.tier = next.id;
    if (next.id === 'robot') w.data.name = ROBOT_NAMES[(Math.random() * ROBOT_NAMES.length) | 0];
    w.buildChar();
    this.fx.sparkle(w.char.root.position.clone().add(new THREE.Vector3(0, 2, 0)), next.color, 18);
    this.fx.float(w.char.root.position.clone().add(new THREE.Vector3(0, 3.2, 0)), `⬆ ${next.name} !`, 'float-info');
    this.sound.buy();
    this.computeRate();
    this.emit('change');
  }

  buyUpgrade(id) {
    const u = UPGRADES.find((x) => x.id === id);
    if (!u || this.upgrades.has(id)) return;
    if (!this.spend(u.cost)) return;
    this.upgrades.add(id);
    this.sound.buy();
    this.emit('toast', { text: `${u.icon} ${u.name} débloqué : ${u.desc}`, kind: 'success' });
    this.computeRate();
    this.emit('change');
  }

  clickHQ(point) {
    const v = this.clickValue;
    this.earn(v);
    this.stats.clicks++;
    const p = point || new THREE.Vector3(0, 6, -2);
    this.fx.coinBurst(p, 4, 0.7);
    this.fx.float(p.clone().add(new THREE.Vector3(0, 1, 0)), '+' + money(v), 'float-click');
    this.sound.coin();
    this.hqBounce = 0.25;
  }

  motivate(w) {
    w.boost = 6;
    this.fx.float(w.char.root.position.clone().add(new THREE.Vector3(0, 3.4, 0)), '⚡ Motivé !', 'float-boost');
    this.fx.sparkle(w.char.root.position.clone().add(new THREE.Vector3(0, 1.5, 0)), '#74c0fc', 10);
    this.sound.whoosh();
  }

  deposit(w) {
    const amount = w.carry * (this.rush > 0 ? 2 : 1);
    this.earn(amount);
    this.stats.deposits++;
    const p = w.char.root.position.clone().add(new THREE.Vector3(0, 2.2, -0.6));
    this.fx.coinBurst(p, this.workers.length > 40 ? 2 : 5, 0.8);
    this.fx.float(p.clone().add(new THREE.Vector3(0, 1.2, 0)), '+' + money(amount), this.rush > 0 ? 'float-rush' : 'float-money');
    this.sound.coin();
    this.hqBounce = 0.15;
    if (this.tutorial === 2) this.setTutorial(3);
  }

  setTutorial(step) {
    this.tutorial = step;
    this.emit('tutorial', step);
  }

  randomName(tierId) {
    if (tierId === 'robot') return ROBOT_NAMES[(Math.random() * ROBOT_NAMES.length) | 0];
    return FIRST_NAMES[(Math.random() * FIRST_NAMES.length) | 0];
  }

  // ---------------- scene objects ----------------
  createHQ() {
    const { group, coin } = buildHQ();
    group.position.set(0, PAD_Y, 0);
    this.hq = group;
    this.hqCoin = coin;
    this.hqBounce = 0;
    const pad = new MeshBuilder();
    pad.box(PAD, PAD_Y - 0.02, PAD, '#c4bcad', {});
    pad.box(PAD - 0.7, 0.04, PAD - 0.7, '#e8e1d2', { y: PAD_Y - 0.03 });
    for (let k = 0; k < 6; k++) pad.box(PAD - 0.7, 0.045, 0.06, '#cfc6b5', { y: PAD_Y - 0.03, z: 1 + k * 1.0 });
    const padMesh = pad.build();
    this.scene.add(padMesh, group);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(12, 14, 13).translate(0, 7, -0.5), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData = { type: 'hq' };
    group.add(hit);
    this.hqSign = buildSign('SIÈGE', 'Empire Inc.', '#f2c14e', '🏦');
    this.hqSign.position.set(-5.2, 0, 5.6);
    this.hqSign.rotation.y = 0.35;
    this.hqSign.scale.setScalar(0.7);
    group.add(this.hqSign);
  }

  createFrames() {
    const mk = (color) => {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, toneMapped: false });
      const L = PAD + 0.5, T = 0.22;
      for (const [x, z, w, d] of [[0, L / 2, L + T, T], [0, -L / 2, L + T, T], [L / 2, 0, T, L], [-L / 2, 0, T, L]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), mat);
        m.position.set(x, PAD_Y + 0.05, z);
        g.add(m);
      }
      g.visible = false;
      g.userData.mat = mat;
      this.scene.add(g);
      return g;
    };
    this.selFrame = mk(new THREE.Color(0.3, 1.6, 2.2));
    this.hoverFrame = mk(new THREE.Color(1.4, 1.4, 1.4));
  }

  createGolden() {
    const b = new MeshBuilder();
    b.rbox(1.6, 1.1, 0.55, 0.12, '#f5c542', { y: -0.55, mat: 'gold' });
    b.box(1.64, 0.12, 0.58, '#b8860b', { y: -0.1, mat: 'gold' });
    b.torus(0.32, 0.07, '#b8860b', { y: 0.62, mat: 'gold' }, Math.PI, 6, 12);
    b.box(0.25, 0.2, 0.6, '#fff3b0', { y: 0.05, mat: 'neon' });
    const g = b.build();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.4, 30, 16, 1, true).translate(0, 15, 0),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.9, 0.3), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    const root = new THREE.Group();
    const spin = new THREE.Group();
    spin.add(g);
    root.add(spin, beam);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 3).translate(0, 1.5, 0), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData = { type: 'golden' };
    root.add(hit);
    root.visible = false;
    this.scene.add(root);
    this.goldenObj = { root, spin, beam, hit };
  }

  spawnGolden() {
    const z = ROADS_Z[(Math.random() * ROADS_Z.length) | 0];
    const x = (Math.random() - 0.5) * 80;
    const useX = Math.random() < 0.5;
    const pos = useX
      ? new THREE.Vector3(ROADS_X[(Math.random() * ROADS_X.length) | 0], 0.2, (Math.random() - 0.5) * 80)
      : new THREE.Vector3(x, 0.2, z);
    this.golden = { life: 20, pos };
    this.goldenObj.root.position.copy(pos);
    this.goldenObj.root.visible = true;
    this.emit('toast', { text: '💼 Une valise dorée est apparue ! Clique dessus !', kind: 'gold' });
  }

  collectGolden() {
    if (!this.golden) return;
    const reward = Math.max(60, this.rate * 50 + this.cash * 0.05) * this.goldenMult;
    this.earn(reward);
    this.stats.golden++;
    const p = this.golden.pos.clone().add(new THREE.Vector3(0, 2, 0));
    this.fx.coinBurst(p, 30, 1.4);
    this.fx.sparkle(p, '#ffe066', 30);
    this.fx.float(p.clone().add(new THREE.Vector3(0, 2, 0)), '💼 +' + money(reward), 'float-gold');
    this.sound.golden();
    this.golden = null;
    this.goldenObj.root.visible = false;
    this.nextGolden = (this.upgrades.has('golden') ? 35 : 60) + Math.random() * 50;
  }

  // ---------------- selection & input ----------------
  select(target) {
    this.selected = target;
    if (target) {
      const center = target.plot ? target.plot.center : target.center || new THREE.Vector3();
      this.selFrame.position.set(center.x, 0, center.z);
      this.selFrame.visible = true;
    } else {
      this.selFrame.visible = false;
    }
    this.emit('select', target);
  }

  bindInput() {
    const el = this.engine.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(9, 9);
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    el.addEventListener('pointermove', (e) => {
      this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      this.pointerType = e.pointerType;
    });
    el.addEventListener('pointerleave', () => this.mouse.set(9, 9));
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 7 || e.button !== 0) return;
      this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      this.handleClick();
    });
  }

  pick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const objs = [this.hq];
    for (const p of this.plots.values()) objs.push(p.hit);
    for (const w of this.workers) objs.push(w.char.hit);
    if (this.golden) objs.push(this.goldenObj.hit);
    const hits = this.raycaster.intersectObjects(objs, true);
    const typed = hits.filter((h) => h.object.userData?.type);
    // small things first
    const special = typed.find((h) => h.object.userData.type === 'golden') || typed.find((h) => h.object.userData.type === 'worker');
    if (special) return { ...special.object.userData, point: special.point };
    if (typed.length) return { ...typed[0].object.userData, point: typed[0].point };
    return null;
  }

  handleClick() {
    const hit = this.pick();
    if (!hit) { this.select(null); return; }
    this.sound.click();
    if (hit.type === 'golden') this.collectGolden();
    else if (hit.type === 'worker') { this.motivate(hit.worker); this.select(hit.worker.building); }
    else if (hit.type === 'hq') { this.clickHQ(hit.point); this.select({ hq: true, center: new THREE.Vector3() }); }
    else if (hit.type === 'plot') {
      const p = hit.plot;
      this.select(p.building || p);
    }
  }

  updateHover() {
    if (this.engine.mobile || this.pointerType === 'touch') { this.hoverFrame.visible = false; return; }
    const hit = this.pick();
    let cursor = 'default';
    this.hoverFrame.visible = false;
    let tip = null;
    if (hit) {
      cursor = 'pointer';
      if (hit.type === 'plot') {
        this.hoverFrame.position.set(hit.plot.center.x, 0, hit.plot.center.z);
        this.hoverFrame.visible = this.selected !== hit.plot && this.selected !== hit.plot.building;
        tip = hit.plot.building
          ? `${hit.plot.building.biz.icon} ${hit.plot.building.biz.name} · Niv. ${hit.plot.building.level}`
          : '🏗️ Parcelle à vendre — clique pour construire';
      } else if (hit.type === 'worker') {
        const w = hit.worker;
        tip = `${w.tier.icon} ${w.data.name} (${w.tier.name}) — ${w.statusLabel()} · clic = motiver ⚡`;
      } else if (hit.type === 'hq') {
        tip = `🏦 Siège — clique pour gagner +${money(this.clickValue)}`;
      } else if (hit.type === 'golden') {
        tip = '💼 Valise dorée !';
      }
    }
    this.engine.renderer.domElement.style.cursor = cursor;
    this.emit('hover', tip);
  }

  // ---------------- main update ----------------
  update(dt) {
    this.time += dt;
    this.stats.playTime += dt;
    this.frame++;
    const t = this.time;
    this.tod = (this.tod + dt / DAY_LENGTH) % 1;

    for (const b of this.buildings.values()) b.update(dt, t);
    for (const w of this.workers) w.update(dt, t);
    const holo = this.cash >= this.cheapestCache;
    for (const p of this.plots.values()) p.update(t, holo && this.isFrontier(p));

    // HQ coin + bounce
    this.hqCoin.rotation.y += dt * 1.6;
    this.hqCoin.position.y = 12.6 + Math.sin(t * 1.5) * 0.3;
    if (this.hqBounce > 0) {
      this.hqBounce = Math.max(0, this.hqBounce - dt);
      const k = this.hqBounce / 0.25;
      this.hq.scale.set(1 + k * 0.03, 1 - k * 0.04, 1 + k * 0.03);
    } else {
      this.hq.scale.set(1, 1, 1);
    }

    // frames pulse
    this.selFrame.userData.mat.opacity = 0.65 + Math.sin(t * 5) * 0.3;

    // golden briefcase
    if (this.golden) {
      this.golden.life -= dt;
      const o = this.goldenObj;
      o.spin.rotation.y += dt * 2.5;
      o.spin.position.y = 1.8 + Math.sin(t * 3) * 0.35;
      o.beam.material.opacity = 0.14 + Math.sin(t * 6) * 0.05;
      if (this.frame % 6 === 0) this.fx.sparkle(this.golden.pos.clone().add(new THREE.Vector3(0, 1.8, 0)), '#ffe066', 1);
      if (this.golden.life <= 0) {
        this.golden = null;
        o.root.visible = false;
        this.nextGolden = 60 + Math.random() * 60;
      }
    } else if (this.buildings.size > 0) {
      this.nextGolden -= dt;
      if (this.nextGolden <= 0) this.spawnGolden();
    }

    // rush hour
    if (this.rush > 0) {
      this.rush -= dt;
      if (this.rush <= 0) this.emit('rush', false);
    } else if (this.workers.length >= 3) {
      this.nextRush -= dt;
      if (this.nextRush <= 0) {
        this.rush = 25;
        this.nextRush = 180 + Math.random() * 160;
        this.emit('rush', true);
        this.sound.golden();
      }
    }

    if (this.frame % 30 === 0) {
      this.computeRate();
      this.cheapestCache = this.cheapestBuild();
      this.checkMilestones();
    }
    if (this.frame % 4 === 0) this.updateHover();
  }

  checkMilestones() {
    const steps = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12];
    while (this.milestone < steps.length && this.totalEarned >= steps[this.milestone]) {
      this.emit('toast', { text: `🏆 Cap franchi : ${money(steps[this.milestone])} gagnés au total !`, kind: 'gold' });
      this.milestone++;
    }
  }

  // ---------------- persistence ----------------
  serialize() {
    return {
      v: 1,
      cash: this.cash,
      totalEarned: this.totalEarned,
      upgrades: [...this.upgrades],
      tod: this.tod,
      stats: this.stats,
      tutorial: this.tutorial,
      milestone: this.milestone,
      savedAt: Date.now(),
      buildings: [...this.buildings.values()].map((b) => ({
        key: b.plot.key, type: b.typeId, level: b.level, workers: b.workers.map((w) => ({ ...w.data })),
      })),
    };
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())); } catch (e) { /* storage unavailable */ }
  }

  load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { data = null; }
    if (!data || data.v !== 1) { this.cheapestCache = this.cheapestBuild(); return null; }
    this.cash = data.cash;
    this.totalEarned = data.totalEarned;
    this.upgrades = new Set(data.upgrades);
    this.tod = data.tod ?? 0.3;
    this.stats = { ...this.stats, ...data.stats };
    this.tutorial = data.tutorial ?? 4;
    this.milestone = data.milestone ?? 0;
    for (const bd of data.buildings) {
      const plot = this.plots.get(bd.key);
      if (!plot || !BIZ[bd.type]) continue;
      const b = this.build(plot, bd.type, true);
      b.level = bd.level;
      b.rebuild(false);
      for (const wd of bd.workers) this.hire(b, wd.tier, true, wd);
      // spread workers along their loop so the city looks alive at once
      for (const w of b.workers) {
        if (Math.random() < 0.55) {
          w.state = Math.random() < 0.5 ? 'toHQ' : 'toWork';
          w.path = b.makePath(w.slot, w.state === 'toHQ');
          const start = Math.floor(Math.random() * (w.path.length - 1));
          w.seg = start + 1;
          w.char.root.position.copy(w.path[start]);
          w.char.bag.visible = w.state === 'toHQ';
          w.carry = b.tripIncome(w.tier);
        }
      }
    }
    const rate = this.computeRate();
    this.cheapestCache = this.cheapestBuild();
    const elapsed = Math.max(0, (Date.now() - (data.savedAt || Date.now())) / 1000);
    let offline = 0;
    if (elapsed > 30 && rate > 0) {
      offline = rate * Math.min(elapsed, 4 * 3600) * 0.5;
      this.earn(offline);
    }
    this.emit('change');
    return { offline, elapsed };
  }

  reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    this.resetting = true;
    location.reload();
  }
}

export { TIER };
