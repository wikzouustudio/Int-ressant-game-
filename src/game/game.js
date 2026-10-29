import * as THREE from 'three';
import {
  CELL, GRID, PAD, PAD_Y, PLAY_HALF, STARTER_LOTS, landPrice, demolishCost, demolishTime, MAX_LEVEL, SAVE_KEY, BUSINESSES, BIZ, WORKERS, UPGRADES, LAW, CANTON, ZONES,
  ROBOT_UPKEEP, FIRST_NAMES, ROBOT_NAMES, DAYS, levelMult, slotsFor, buildCost, upgradeCost, hireCost,
  trainingCost, buildTime, money,
} from './config.js';
import { buildBusiness, buildHQ, buildSign, buildForSale, easeOutBack, setBuildingLodScale, buildRuin } from '../models/buildings.js';
import { buildConstructionSite, buildExcavator, buildRubble, bucketTip } from '../models/machines.js';
import { createCharacter, animateCharacter, randomLook } from '../models/character.js';
import { MeshBuilder, disposeObject } from '../models/builder.js';
import { Effects } from './fx.js';
import { Sound } from './audio.js';
import { CrowdRenderer } from './crowd.js';
import { Citizens } from './citizens.js';
import { PLAY_ROADS } from '../world/environment.js';
import { icon } from '../ui/icons.js';

const TIER = Object.fromEntries(WORKERS.map((w, i) => [w.id, { ...w, index: i }]));
const WALK_Y = 0.23;
const HQ_ROAD_Z = CELL / 2;
const HQ_DEPOSIT_Z = 5.4;
const LANE_Z = 5.6;        // local z of the walkway lane in front of a building
const EDGE_X = PLAY_HALF + CELL / 2; // where commuters enter / leave the district
const SPEED_OPEN = 3;      // game minutes per real second while the city works
const SPEED_CLOSED = 30;   // nights & week-ends fly by
const _v = new THREE.Vector3();
const SPOT_X = [0, 1.05, -1.05, 2.1, -2.1, 3.15, -3.15, -4.2].map((x) => x - 0.3);

const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
const emptyLedger = () => ({ sales: 0, tva: 0, wages: 0, charges: { avs: 0, ac: 0, lpp: 0, laa: 0, af: 0 }, robots: 0, fees: 0 });
const chargesTotal = (c) => c.avs + c.ac + c.lpp + c.laa + c.af;
export const zoneOf = (i, j) => (Math.abs(i) === GRID || j === -GRID ? 'ZI' : 'ZM');

// ===========================================================================
class Plot {
  constructor(game, i, j) {
    this.game = game;
    this.i = i; this.j = j;
    this.key = `${i},${j}`;
    this.zone = zoneOf(i, j);
    this.center = new THREE.Vector3(i * CELL, 0, j * CELL);
    this.group = new THREE.Group();
    this.group.position.copy(this.center);
    const industrial = this.zone === 'ZI';

    const b = new MeshBuilder();
    b.box(PAD, PAD_Y - 0.02, PAD, industrial ? '#aaa397' : '#c4bcad', {});
    this.group.add(b.build({ castShadow: false }));
    const g = new MeshBuilder();
    g.box(PAD - 0.7, 0.04, PAD - 0.7, industrial ? '#8f9f4c' : '#5fa83a', { y: PAD_Y - 0.03 });
    for (let k = 0; k < 7; k++) {
      g.sphere(0.12, ['#ffffff', '#ffd43b', '#ff8fab'][k % 3], { x: Math.sin(k * 7.3 + i) * 5, y: PAD_Y + 0.02, z: Math.cos(k * 3.1 + j) * 5, sy: 0.5 }, 6, 4);
    }
    // wild vacant lot: grass tufts, bushes and the odd young tree
    const wr = (k) => Math.abs(Math.sin((i * 12.9898 + j * 78.233 + k) * 43758.5453)) % 1;
    for (let k = 0; k < 9; k++) {
      const x = (wr(k) - 0.5) * 11, z = (wr(k + 20) - 0.5) * 11;
      if (wr(k + 40) < 0.65) g.cone(0.18, 0.45, k % 2 ? '#6fae3d' : '#8cc152', { x, y: PAD_Y, z }, 5);
      else g.blob(0.35 + wr(k + 60) * 0.35, k % 2 ? '#4ca346' : '#5cb84a', { x, y: PAD_Y + 0.25, z, sy: 0.75 }, 1);
    }
    if (wr(99) < 0.5) {
      const tx = wr(98) < 0.5 ? -4.6 : 4.6, tz = wr(97) < 0.5 ? -4.4 : -1;
      g.cyl(0.12, 0.17, 1.4, '#7a5233', { x: tx, y: PAD_Y, z: tz }, 6);
      g.blob(0.9, '#5cb84a', { x: tx, y: PAD_Y + 2.0, z: tz }, 1);
    }
    this.grass = g.build({ castShadow: false });
    this.group.add(this.grass);
    const c = new MeshBuilder();
    c.box(PAD - 0.7, 0.04, PAD - 0.7, industrial ? '#c9c6bf' : '#d9d3c7', { y: PAD_Y - 0.03 });
    this.concrete = c.build({ castShadow: false });
    this.group.add(this.concrete);

    this.forSale = buildForSale(this.zone);
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
    this.holo.add(ring);
    this.holoRing = ring;
    this.group.add(this.holo);

    this.hit = new THREE.Mesh(
      new THREE.BoxGeometry(PAD, 1, PAD).translate(0, 0.5, 0),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hit.userData = { type: 'plot', plot: this };
    this.group.add(this.hit);
    this.building = null;
    this.owned = false;
    this.ruin = null;
    this.demolish = null;
    // Most lots start with an abandoned building; a few (and the starter lots) are vacant.
    const vacant = STARTER_LOTS.includes(this.key) || ((i * 31 + j * 17 + 40) % 5 === 0);
    if (!vacant) this.addRuin();
    this.setOccupied(false);
    game.scene.add(this.group);
  }

  get price() { return landPrice(this.i, this.j, !!this.ruin); }

  addRuin() {
    this.ruin = buildRuin((this.i + 20) * 101 + (this.j + 20) * 7);
    this.ruin.position.y = PAD_Y;
    this.group.add(this.ruin);
    this.ruinPick = this.ruin.getObjectByName('shadow-proxy');
    this.ruinPick.userData = { type: 'plot', plot: this };
  }

  removeRuin() {
    if (!this.ruin) return;
    this.group.remove(this.ruin);
    disposeObject(this.ruin);
    this.ruin = null;
  }

  setOccupied(on) {
    const lot = !on && !this.ruin;
    this.grass.visible = lot;
    this.concrete.visible = !lot;
    this.forSale.visible = !on && !this.owned;
    this.holo.visible = false;
  }

  update(t, dt, showHolo) {
    if (this.demolish) this.updateDemolition(t, dt);
    if (this.building || this.ruin) { this.holo.visible = false; return; }
    this.holo.visible = showHolo;
    if (showHolo) {
      this.holo.rotation.y = t * 1.2 + this.i;
      this.holo.position.y = 3 + Math.sin(t * 2 + this.j) * 0.25;
      this.holoRing.position.y = PAD_Y + 0.05 - this.holo.position.y;
      this.holoRing.rotation.y = -this.holo.rotation.y;
    }
  }
}

const ease = (x) => x * x * (3 - 2 * x);
const _dir = new THREE.Vector3(0, 0.25, -1);

Plot.prototype.startDemolition = function startDemolition() {
  const exc = buildExcavator();
  exc.group.position.set(2.6, PAD_Y, 12);
  exc.group.rotation.y = Math.PI; // arm points toward the building (-Z)
  this.group.add(exc.group);
  const rubble = buildRubble(this.ruin.userData.wall || '#b8ab98');
  rubble.position.y = PAD_Y;
  rubble.scale.setScalar(0.01);
  rubble.visible = false;
  this.group.add(rubble);
  this.demolish = { t: 0, total: demolishTime(this.i, this.j), exc, rubble, cyc: 0, lastStrike: -1, damage: 0, puff: 0 };
};

/** One excavator blow: debris flies off the facade, dust, a thud and a small shake. */
Plot.prototype.impact = function impact(strong = 1) {
  const d = this.demolish;
  const g = this.game;
  bucketTip(d.exc, _v);
  const wall = this.ruin?.userData.wall || '#b8ab98';
  g.fx.debris(_v, wall, 9 * strong, _dir, 1.1 * strong, PAD_Y);
  g.fx.debris(_v, '#8a6a46', 3, _dir, 0.9, PAD_Y);
  g.fx.puff(_v, { color: '#cbbfa9', size: 1.1, life: 1.2, up: 1.4, spread: 1.6, radial: 3.5, count: 6, grow: 1.1 });
  g.engine.controls.cam.shake(0.22 * strong);
  g.sound.thud();
  d.damage++;
};

/** Each click on a ruin being demolished lands an extra blow (speeds the job up). */
Plot.prototype.smash = function smash() {
  const d = this.demolish;
  if (!d || d.t < 1.6 || !this.ruin) return;
  d.t = Math.min(d.total * 0.84, d.t + 0.6);
  this.impact(1.3);
};

Plot.prototype.updateDemolition = function updateDemolition(t, dt) {
  const d = this.demolish;
  const { exc } = d;
  d.t += dt;
  const k = Math.min(1, d.t / d.total);
  const lerp = THREE.MathUtils.lerp;

  if (d.t < 1.6) {
    // drive in from the street, arm folded
    const m = ease(d.t / 1.6);
    exc.group.position.z = lerp(12, 5.6, m);
    exc.boom.rotation.x = -0.55; exc.stick.rotation.x = 1.3; exc.bucket.rotation.x = 0.9;
    d.puff -= dt;
    if (d.puff <= 0) {
      d.puff = 0.12;
      this.game.fx.puff(_v.set(this.center.x + 2.6 + (Math.random() - 0.5) * 2, 0.4, this.center.z + exc.group.position.z + 1.6), { color: '#d9c7a1', size: 0.6, life: 0.9, up: 0.8, spread: 0.8, radial: 1.5 });
    }
    return;
  }

  if (k < 0.86) {
    // strike cycle: raise, slam into the facade, recover
    d.cyc += dt;
    const P = 1.15;
    const s = (d.cyc % P) / P;
    const n = Math.floor(d.cyc / P);
    if (s < 0.5) {
      const m = ease(s / 0.5);
      exc.boom.rotation.x = lerp(0.05, -0.8, m); exc.stick.rotation.x = lerp(1.0, 0.35, m); exc.bucket.rotation.x = lerp(0.8, 0.1, m);
    } else if (s < 0.6) {
      const m = (s - 0.5) / 0.1;
      exc.boom.rotation.x = lerp(-0.8, 0.3, m * m); exc.stick.rotation.x = lerp(0.35, 1.25, m * m); exc.bucket.rotation.x = lerp(0.1, 1.3, m);
    } else {
      const m = ease((s - 0.6) / 0.4);
      exc.boom.rotation.x = lerp(0.3, 0.05, m); exc.stick.rotation.x = lerp(1.25, 1.0, m); exc.bucket.rotation.x = lerp(1.3, 0.8, m);
    }
    exc.cab.rotation.y = Math.sin(n * 2.1) * 0.35;
    if (s >= 0.58 && d.lastStrike !== n) { d.lastStrike = n; this.impact(); }
  } else {
    // scoop the rubble away
    const s = (t % 1.4) / 1.4;
    exc.cab.rotation.y = Math.sin(t * 1.4) * 0.6;
    exc.boom.rotation.x = lerp(-0.2, 0.25, Math.sin(s * Math.PI));
    exc.stick.rotation.x = lerp(0.6, 1.4, s);
    exc.bucket.rotation.x = lerp(1.4, 0.2, s);
    d.puff -= dt;
    if (d.puff <= 0) {
      d.puff = 0.3;
      bucketTip(exc, _v);
      this.game.fx.debris(_v, this.ruin?.userData.wall || d.rubble.userData.wall || '#b8ab98', 3, null, 0.5, PAD_Y);
    }
  }

  // the building crumbles in steps as it takes blows, then turns into a rubble mound
  if (this.ruin) {
    const target = Math.max(0.1, 1 - Math.min(1, k / 0.84) * 0.9);
    this.ruin.scale.y += (target - this.ruin.scale.y) * Math.min(1, dt * 6);
    this.ruin.rotation.z = Math.sin(d.damage * 1.7) * 0.025 * (1 - k);
    this.ruin.rotation.x = Math.cos(d.damage * 2.3) * 0.02 * (1 - k);
    if (k > 0.78) { d.rubble.visible = true; d.rubble.scale.setScalar(Math.min(1, (k - 0.78) / 0.07)); }
    if (k > 0.86) { d.rubble.userData.wall = this.ruin.userData.wall; this.group.remove(this.ruin); disposeObject(this.ruin); this.ruin = null; this.game.fx.dust(_v.copy(this.center).setY(0.3), 18); }
  } else if (k > 0.86) {
    d.rubble.scale.setScalar(Math.max(0.01, 1 - (k - 0.86) / 0.14));
  }
  if (k >= 1) this.game.finishDemolition(this);
};

// ===========================================================================
class Building {
  constructor(game, plot, typeId, level = 1, construction = 0) {
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
    this.toWorldFn = (v) => this.toWorld(v);
    this.routeLength = this.computeRouteLength();
    this.construction = null;
    plot.building = this;
    plot.owned = true;
    plot.removeRuin();
    plot.setOccupied(true);
    if (construction > 0) this.startConstruction(construction);
    else this.rebuild(false);
  }

  get biz() { return BIZ[this.typeId]; }
  get slots() { return slotsFor(this.level); }
  get open() { return !this.construction; }

  startConstruction(remaining) {
    const total = buildTime(this.biz);
    const site = buildConstructionSite(this.biz.color);
    this.construction = { total, t: total - remaining, site, crew: [] };
    this.root.add(site.group);
    // construction crew (hard hats), drawn by the instanced crowd renderer
    site.crewSpots.forEach(([x, y, z, yaw, anim], k) => {
      const look = randomLook((this.plot.i + 9) * 977 + (this.plot.j + 9) * 61 + k * 13, 'builder', '#ff922b');
      const char = createCharacter(look);
      char.root.remove(char.hit);
      char.root.rotation.y = yaw;
      this.game.scene.add(char.root);
      const m = { char, x, y, z, anim, phase: k * 1.7, uid: k };
      this.construction.crew.push(m);
      this.game.crew.push(m);
    });
    this.siteCtx = { fx: this.game.fx, toWorld: this.toWorldFn, shake: (a) => this.game.engine.controls.cam.shake(a) };
    this.makeSign();
  }

  removeCrew() {
    if (!this.construction) return;
    for (const m of this.construction.crew) {
      this.game.scene.remove(m.char.root);
      disposeObject(m.char.root);
      this.game.crew.splice(this.game.crew.indexOf(m), 1);
    }
    this.construction.crew.length = 0;
  }

  makeSign() {
    if (this.sign) { this.root.remove(this.sign); disposeObject(this.sign); }
    const sub = this.construction ? 'En construction' : `Niveau ${this.level}`;
    this.sign = buildSign(this.biz.name, sub, this.biz.color, this.typeId);
    this.sign.position.set(5.15, 0, 5.4);
    this.sign.rotation.y = -0.45;
    this.sign.scale.setScalar(0.78);
    this.root.add(this.sign);
  }

  rebuild(animate) {
    if (this.model) {
      this.root.remove(this.model.group);
      disposeObject(this.model.group);
    }
    this.model = buildBusiness(this.typeId, this.level, this.game.lodScale);
    this.root.add(this.model.group);
    this.pickMesh = this.model.group.getObjectByName('shadow-proxy');
    this.pickMesh.userData = { type: 'plot', plot: this.plot };
    this.makeSign();
    if (animate) this.anim = { t: 0, dur: 0.9 };
  }

  // --- positions (world space; buildings are never rotated) ---
  local(x, z) { return { x: this.plot.center.x + x, z: this.plot.center.z + z }; }
  lane(x) { return { x, z: this.plot.center.z + LANE_Z }; }
  spotPos(slot) { return { x: this.plot.center.x + SPOT_X[slot], z: this.plot.center.z + 6.0 }; }
  doorOut() { const d = this.model.door; return this.local(d.out[0], d.out[1]); }
  doorIn() { const d = this.model.door; return this.local(d.in[0], d.in[1]); }
  station(name, slot) {
    const [x, z, yaw] = this.model.spots[name];
    const off = ((slot % 4) - 1.5) * 0.8;
    const p = this.local(x + Math.cos(yaw) * off, z - Math.sin(yaw) * off);
    return { ...p, yaw };
  }
  roadZ() { return this.plot.center.z + CELL / 2; }

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

  /** Spot → HQ deposit (toHQ) or HQ → spot (back). */
  makePath(slot, toHQ) {
    const { i, j } = this.plot;
    const cx = i * CELL, cz = j * CELL;
    const jx = (Math.random() - 0.5) * 2.6;
    const jz = (Math.random() - 0.5) * 2.6;
    const spot = this.spotPos(slot);
    const zr = cz + CELL / 2 + jz;
    const pts = [{ x: spot.x, z: zr }];
    if (j !== 0) {
      const xr = (i === 0 ? CELL / 2 : cx - Math.sign(i) * CELL / 2) + jx;
      pts.push({ x: xr, z: zr }, { x: xr, z: HQ_ROAD_Z + jz });
    }
    const hx = (Math.random() - 0.5) * 6.5;
    pts.push({ x: hx, z: HQ_ROAD_Z + jz }, { x: hx, z: HQ_DEPOSIT_Z });
    if (toHQ) return pts;
    pts.reverse();
    pts.push(spot);
    return pts;
  }

  tripIncome(tier) {
    return this.biz.income * levelMult(this.level) * tier.mult * this.game.incomeMult;
  }

  estimatedRate(liveOnly = false) {
    let r = 0;
    for (const w of this.workers) {
      if (liveOnly && !w.active) continue;
      const t = w.tier;
      const cycle = w.workTime() + (2 * this.routeLength + 10) / (t.speed * this.game.speedMult) + 0.7;
      r += this.tripIncome(t) / cycle;
    }
    return r;
  }

  toWorld(v) { return this.root.localToWorld(v); }

  update(dt, t) {
    if (this.construction) {
      const c = this.construction;
      c.t += dt;
      const k = c.t / c.total;
      c.site.update(k, t, dt, this.siteCtx);
      for (const m of c.crew) {
        const show = k >= 0.3 ? (m.y !== 'scaffold' || k > 0.45) : m.anim === 'inspect';
        const root = m.char.root;
        root.visible = show;
        if (!show) continue;
        const y = m.y === 'scaffold' ? PAD_Y + 0.4 + 1.25 - 0.02 : PAD_Y + 0.02;
        if (k < 0.3) root.position.set(this.root.position.x - 3.2, y, this.root.position.z + 5.0);
        else root.position.set(this.root.position.x + m.x, y, this.root.position.z + m.z);
        if (!m.char.offscreen) animateCharacter(m.char, m.anim, t + m.phase, 0);
      }
      if (c.t >= c.total) this.game.finishConstruction(this);
      return;
    }
    if (this.anim) {
      this.anim.t += dt;
      const k = Math.min(1, this.anim.t / this.anim.dur);
      const s = easeOutBack(k);
      this.model.group.scale.set(1 + (1 - k) * 0.15, Math.max(0.01, s), 1 + (1 - k) * 0.15);
      if (k >= 1) { this.model.group.scale.set(1, 1, 1); this.anim = null; }
    }
    for (const fn of this.model.animated) fn(t, dt, this.game.fx, this.toWorldFn);
    if (this.model.emitters.length && this.workers.some((w) => w.active)) {
      this.emitTimer -= dt;
      if (this.emitTimer <= 0) {
        this.emitTimer = 0.35;
        const dark = this.typeId === 'factory';
        for (const e of this.model.emitters) {
          this.game.fx.puff(this.toWorld(_v.copy(e)), {
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
    this.uid = ++Worker.nextId;
    data.days ??= 0;
    this.slot = slot;
    this.state = 'home';
    this.timer = 0;
    this.path = null;
    this.seg = 0;
    this.phase = Math.random() * 10;
    this.walkPhase = 0;
    this.boost = 0;
    this.carry = 0;
    this.yaw = Math.PI;
    this.taskIndex = 0;
    this.inside = false;
    this.paused = false;
    this.side = building.plot.center.x === 0 ? (data.seed % 2 ? 1 : -1) : Math.sign(building.plot.center.x);
    this.buildChar();
    this.setVisible(false);
  }

  get tier() { return TIER[this.data.tier]; }
  get human() { return this.tier.human; }
  get task() { return this.building.biz.tasks[this.taskIndex]; }
  /** On site (counts for live income / time speed). */
  get active() { return this.state !== 'home'; }

  buildChar() {
    const look = randomLook(this.data.seed, this.data.tier, this.building.biz.color);
    const c = createCharacter(look);
    c.hit.userData = { type: 'worker', worker: this };
    if (this.char) {
      c.root.position.copy(this.char.root.position);
      c.root.rotation.y = this.char.root.rotation.y;
      c.bag.visible = this.char.bag.visible;
      c.root.visible = this.char.root.visible;
      this.game.scene.remove(this.char.root);
      disposeObject(this.char.root);
    }
    this.char = c;
    this.game.scene.add(c.root);
  }

  setVisible(v) { this.char.root.visible = v; }
  setPos(p) { this.char.root.position.set(p.x, WALK_Y, p.z); }

  workTime() {
    return this.building.biz.workTime * this.tier.workMul * this.game.workMult;
  }

  taskDuration(k) {
    const tasks = this.building.biz.tasks;
    const sum = tasks.reduce((a, t) => a + t.w, 0);
    return this.workTime() * (tasks[k].w / sum);
  }

  statusLabel() {
    const g = this.game;
    switch (this.state) {
      case 'home': {
        if (!this.human) return 'En maintenance';
        const shift = g.shiftFor(this, g.weekday);
        if (shift?.school) return 'À l\'école professionnelle';
        if (g.weekday === 6) return 'Repos dominical (LTr art. 18)';
        if (g.weekday === 5) return 'Congé (week-end)';
        return g.hour < 12 ? 'À la maison' : 'Rentré·e (fin de journée)';
      }
      case 'commuteIn': return 'En route pour le travail';
      case 'commuteOut': return 'Rentre à la maison';
      case 'move': return `${this.task.label} (en chemin)`;
      case 'task': return this.paused ? 'Pause de midi (LTr art. 15)' : this.task.label;
      case 'toHQ': return 'Apporte la recette au Siège';
      case 'deposit': return 'Dépose la recette';
      case 'toWork': return 'Retourne au travail';
      default: return '';
    }
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
        if (target.hide) { this.inside = true; this.setVisible(false); }
      } else {
        pos.x += (dx / d) * remaining;
        pos.z += (dz / d) * remaining;
        this.yaw = Math.atan2(dx, dz);
        remaining = 0;
      }
    }
    return this.seg >= this.path.length;
  }

  /** Leave the building (if inside) — returns the point to continue from. */
  exitPoints(pts) {
    const b = this.building;
    if (this.inside) {
      this.inside = false;
      this.setPos(b.doorIn());
      this.setVisible(true);
      const out = b.doorOut();
      pts.push(out);
      return out;
    }
    const p = this.char.root.position;
    return { x: p.x, z: p.z };
  }

  planTask(k) {
    const b = this.building;
    this.taskIndex = k;
    const task = this.task;
    const pts = [];
    if (task.at === 'in' && b.model.door) {
      if (!this.inside) {
        const p = this.char.root.position;
        const out = b.doorOut(), inn = b.doorIn();
        pts.push(b.lane(p.x), b.lane(out.x), out, { ...inn, hide: true });
      }
      this.taskYaw = Math.PI;
    } else {
      const from = this.exitPoints(pts);
      const st = b.station(task.at === 'in' ? Object.keys(b.model.spots)[0] : task.at, this.slot);
      pts.push(b.lane(from.x), b.lane(st.x), st);
      this.taskYaw = st.yaw;
    }
    this.path = pts;
    this.seg = 0;
    this.state = 'move';
    this.timer = 0;
  }

  goDeliver() {
    const b = this.building;
    this.carry = b.tripIncome(this.tier);
    this.char.bag.visible = true;
    const pts = [];
    const from = this.exitPoints(pts);
    const spot = b.spotPos(this.slot);
    pts.push(b.lane(from.x), b.lane(spot.x), spot, ...b.makePath(this.slot, true));
    this.path = pts;
    this.seg = 0;
    this.state = 'toHQ';
  }

  goHome(fromHQ = false) {
    const b = this.building;
    const pts = [];
    if (fromHQ) {
      const p = this.char.root.position;
      const z = HQ_ROAD_Z + (Math.random() - 0.5) * 2.4;
      pts.push({ x: p.x, z }, { x: this.side * EDGE_X, z });
    } else {
      const from = this.exitPoints(pts);
      const spot = b.spotPos(this.slot);
      const zr = b.roadZ() + (Math.random() - 0.5) * 2.4;
      pts.push(b.lane(from.x), b.lane(spot.x), spot, { x: spot.x, z: zr }, { x: this.side * EDGE_X, z: zr });
    }
    this.char.bag.visible = false;
    this.path = pts;
    this.seg = 0;
    this.state = 'commuteOut';
  }

  commuteIn() {
    const b = this.building;
    const spot = b.spotPos(this.slot);
    const zr = b.roadZ() + (Math.random() - 0.5) * 2.4;
    this.setPos({ x: this.side * EDGE_X, z: zr });
    this.setVisible(true);
    this.inside = false;
    this.path = [{ x: spot.x, z: zr }, spot];
    this.seg = 0;
    this.state = 'commuteIn';
  }

  /** Start working right here (hired mid-shift / game loaded during work hours). */
  startOnSite() {
    this.setPos(this.building.spotPos(this.slot));
    this.setVisible(true);
    this.inside = false;
    this.planTask(0);
  }

  /** Pose only what can be seen: hidden or off-screen NPCs skip skeletal animation,
   *  far ones animate every other frame (movement itself is always simulated). */
  anim(mode, t, phase) {
    const c = this.char;
    if (!c.root.visible || c.offscreen) return;
    if (c.lod && (this.game.frame + this.uid) % 2) return;
    animateCharacter(c, mode, t, phase);
  }

  update(dt, t) {
    const g = this.game;
    const c = this.char;
    if (this.boost > 0) this.boost -= dt;
    const bmul = this.boost > 0 ? 2 : 1;
    const onShift = g.onShift(this);
    this.paused = this.human && g.inPause(this);

    if (this.human && !onShift && (this.state === 'move' || this.state === 'task')) this.goHome();

    switch (this.state) {
      case 'home':
        if (g.shouldCommute(this)) this.commuteIn();
        return;
      case 'task': {
        if (this.paused) {
          this.anim('coffee', t + this.phase, 0);
          break;
        }
        this.timer += dt * bmul;
        this.yaw = this.taskYaw;
        this.anim(this.task.anim, t * bmul + this.phase, 0);
        if (this.timer >= this.taskDuration(this.taskIndex)) {
          const next = this.taskIndex + 1;
          if (next < this.building.biz.tasks.length) this.planTask(next);
          else this.goDeliver();
        }
        break;
      }
      case 'deposit': {
        this.timer += dt;
        this.yaw = Math.PI;
        this.anim('cheer', t + this.phase, 0);
        if (this.timer > 0.65) {
          if (this.human && !onShift) this.goHome(true);
          else {
            this.path = this.building.makePath(this.slot, false);
            this.seg = 0;
            this.state = 'toWork';
          }
        }
        break;
      }
      default: {
        // walking states: move, toHQ, toWork, commuteIn, commuteOut
        const speed = this.tier.speed * g.speedMult * bmul;
        this.walkPhase += dt * speed * 2.0;
        this.anim(this.state === 'toHQ' ? 'carry' : 'walk', t, this.walkPhase);
        if (this.followPath(dt, speed)) {
          const s = this.state;
          if (s === 'move') { this.state = 'task'; this.timer = 0; }
          else if (s === 'toHQ') {
            this.state = 'deposit';
            this.timer = 0;
            c.bag.visible = false;
            g.deposit(this);
          } else if (s === 'toWork' || s === 'commuteIn') {
            if (this.human && !onShift) this.goHome();
            else this.planTask(0);
          } else if (s === 'commuteOut') {
            this.state = 'home';
            this.setVisible(false);
          }
        }
      }
    }
    c.root.rotation.y = lerpAngle(c.root.rotation.y, this.yaw, Math.min(1, dt * 12));
  }

  dispose() {
    this.game.scene.remove(this.char.root);
    disposeObject(this.char.root);
  }
}
Worker.nextId = 0;

// ===========================================================================
export class Game {
  constructor(engine, env, fxLayer) {
    this.engine = engine;
    this.scene = engine.scene;
    this.camera = engine.camera;
    this.env = env;
    this.fx = new Effects(this.scene, this.camera, fxLayer);
    this.sound = new Sound();
    this.crowd = new CrowdRenderer(this.scene);
    this.citizens = new Citizens(this);
    this.crew = [];
    this.lodScale = 1;
    this.activeCount = 0;
    this.humansOnSite = false;
    this.pickList = [];
    this.listeners = {};

    this.canton = null;
    this.cash = 60;
    this.totalEarned = 0;
    this.upgrades = new Set();
    this.clock = 7 * 60 + 30; // game minutes since Monday 00:00 of week 1
    this.clockSpeed = SPEED_OPEN;
    this.time = 0;
    this.stats = { deposits: 0, clicks: 0, golden: 0, playTime: 0, wagesPaid: 0, taxesPaid: 0, tvaPaid: 0 };
    this.tutorial = 0;
    this.milestone = 0;
    this.tvaRegistered = false;
    this.week = emptyLedger();
    this.lastWeek = null;
    this.pending = { wages: 0, charges: 0 };
    this.rush = 0;
    this.nextRush = 150 + Math.random() * 120;
    this.nextGolden = 40;
    this.golden = null;

    this.plots = new Map();
    this.buildings = new Map();
    this.workers = [];
    this.selected = null;
    this.frame = 0;
    this.rateCache = 0;
    this.liveRateCache = 0;
    this.cheapestCache = Infinity;

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
  toast(text, iconName = 'info', kind = '') { this.emit('toast', { text, icon: iconName, kind }); }

  // ---------------- calendar ----------------
  get day() { return Math.floor(this.clock / 1440); }
  get weekday() { return this.day % 7; }
  get hour() { return (this.clock % 1440) / 60; }
  get weekNo() { return Math.floor(this.day / 7) + 1; }
  get tod() { return this.hour / 24; }
  get cantonData() { return CANTON[this.canton] || CANTON.ZG; }

  /** Legal working schedule of a worker for a given weekday (LTr / LFPr / OLT 2). */
  shiftFor(w, wd) {
    if (!w.human) return { start: 0, end: 24, pause: false };
    if (wd === 6) return w.building.biz.sunday ? { start: 6, end: 11, pause: false, sunday: true } : null;
    if (wd === 5) return null;
    if (w.data.tier === 'apprentice' && wd === LAW.schoolDay) return { school: true, start: LAW.shiftStart, end: LAW.shiftEnd, pause: true };
    return { start: LAW.shiftStart, end: LAW.shiftEnd, pause: true };
  }
  onShift(w) {
    const s = this.shiftFor(w, this.weekday);
    if (!s || s.school) return false;
    const h = this.hour;
    return h >= s.start - 1 && h < s.end;
  }
  inPause(w) {
    const s = this.shiftFor(w, this.weekday);
    const h = this.hour;
    return !!(s && s.pause && h >= LAW.pauseStart && h < LAW.pauseEnd);
  }
  shouldCommute(w) {
    if (!w.human) return true;
    const s = this.shiftFor(w, this.weekday);
    if (!s || s.school) return false;
    const offset = ((w.data.seed % 40) + 5) / 60;
    const h = this.hour;
    return h >= s.start - 1 + offset && h < s.end - 0.5;
  }
  /** Paid working time (pauses are not working time, art. 15 LTr; school days are paid). */
  isPaidNow(w) {
    if (!w.human) return false;
    const s = this.shiftFor(w, this.weekday);
    if (!s) return false;
    const h = this.hour;
    if (h < s.start || h >= s.end) return false;
    return !(s.pause && h >= LAW.pauseStart && h < LAW.pauseEnd);
  }
  weeklyHours(w) {
    let total = 0;
    for (let d = 0; d < 7; d++) {
      const s = this.shiftFor(w, d);
      if (s) total += s.end - s.start - (s.pause ? LAW.pauseEnd - LAW.pauseStart : 0);
    }
    return total;
  }

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
  get rate() { return this.liveRateCache * (this.rush > 0 ? 2 : 1); }
  get nominalRate() { return this.rateCache; }
  get clickValue() { return Math.max(1, Math.round(1 + this.rateCache * 0.12)); }
  get isOpen() { return this.workers.some((w) => w.active && w.human) || this.workers.some((w) => !w.human); }

  computeRate() {
    let r = 0, live = 0;
    for (const b of this.buildings.values()) {
      r += b.estimatedRate();
      live += b.estimatedRate(true);
    }
    this.rateCache = r;
    this.liveRateCache = live;
    return r;
  }

  // ---------------- Swiss payroll & taxes ----------------
  wage(w) {
    if (!w.human) return 0;
    const c = this.cantonData;
    let h = w.building.biz.income * w.tier.wageMul * c.wageIdx;
    if (c.minWage && w.data.tier !== 'apprentice') h = Math.max(h, c.minWage);
    return h;
  }
  chargeRates(w) {
    const apprentice = w.data.tier === 'apprentice';
    return {
      avs: LAW.avs,
      ac: LAW.ac,
      lpp: apprentice ? 0 : LAW.lpp, // salaire sous le seuil d'entrée LPP
      laa: w.building.biz.laa,
      af: this.cantonData.af,
    };
  }
  employerCostRate(w) {
    const r = this.chargeRates(w);
    return 1 + r.avs + r.ac + r.lpp + r.laa + r.af;
  }
  /** Indemnité de délai de congé (CO art. 335b / 335c). */
  severance(w) {
    if (!w.human) return 0;
    const days = w.data.days < LAW.trialDays ? LAW.noticeTrialDays : LAW.noticeDays;
    return this.wage(w) * 8.5 * days * this.employerCostRate(w);
  }
  tvaRate(biz) { return biz.tva === 'reduit' ? LAW.tvaReduit : LAW.tvaNormal; }

  accruePayroll(minutes) {
    if (minutes <= 0) return;
    for (const w of this.workers) {
      if (!this.isPaidNow(w)) continue;
      const gross = (this.wage(w) * minutes) / 60;
      const r = this.chargeRates(w);
      this.week.wages += gross;
      this.pending.wages += gross;
      let ch = 0;
      for (const k of Object.keys(r)) {
        this.week.charges[k] += gross * r[k];
        ch += gross * r[k];
      }
      this.pending.charges += ch;
    }
  }

  payPayroll() {
    const total = this.pending.wages + this.pending.charges;
    if (total < 0.01) return;
    this.cash -= total;
    this.stats.wagesPaid += total;
    this.toast(`Salaires du jour versés : ${money(this.pending.wages)} + charges sociales ${money(this.pending.charges)}`, 'contract');
    this.pending = { wages: 0, charges: 0 };
    this.emit('change');
  }

  settleWeek() {
    const w = this.week;
    const cantonTax = this.cantonData.tax;
    const profit = w.sales - w.wages - chargesTotal(w.charges) - w.robots - w.fees;
    const tax = Math.max(0, profit) * cantonTax;
    this.cash -= w.tva + tax;
    this.stats.taxesPaid += tax;
    this.stats.tvaPaid += w.tva;
    this.lastWeek = { ...w, charges: { ...w.charges }, profit, tax, weekNo: this.weekNo - 1, canton: this.canton };
    this.week = emptyLedger();
    this.toast(`Décompte de la semaine ${this.lastWeek.weekNo} : TVA ${money(w.tva)} · impôt ${money(tax)}`, 'receipt', 'gold');
    this.emit('settlement', this.lastWeek);
    this.emit('change');
  }

  onNewDay(prevWeekday) {
    // count worked days (probation / apprenticeship progress)
    for (const w of this.workers) {
      if (!w.human) continue;
      const s = this.shiftFor(w, prevWeekday);
      if (!s) continue;
      w.data.days++;
      if (w.data.tier === 'apprentice' && !w.data.cfc && w.data.days >= LAW.cfcDays) {
        w.data.cfc = true;
        this.toast(`${w.data.name} a obtenu son CFC ! Tu peux l'engager comme employé·e.`, 'expert', 'gold');
        this.emit('change');
      }
    }
    if (this.weekday === 0) this.settleWeek();
  }

  updateClock(dt) {
    const hour = this.hour;
    const wd = this.weekday;
    const humansOnSite = this.humansOnSite;
    const officeHours = wd < 5 && hour >= 7 && hour < 18;
    const target = humansOnSite || officeHours || this.rush > 0 ? SPEED_OPEN : SPEED_CLOSED;
    this.clockSpeed += (target - this.clockSpeed) * Math.min(1, dt * 3);
    const minutes = dt * this.clockSpeed;
    const prevDay = this.day;
    const prevHour = hour;
    this.accruePayroll(minutes);
    this.clock += minutes;
    if (prevHour < 18 && this.hour >= 18) this.payPayroll();
    if (prevHour < 11.1 && this.hour >= 11.1 && wd === 6) this.payPayroll();
    if (this.day !== prevDay) this.onNewDay(wd);
  }

  // ---------------- economy helpers ----------------
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
  permitFee(typeId) { return this.buildPrice(typeId) * LAW.permitRate; }
  upgradePrice(b) { return upgradeCost(b.biz, b.level); }
  hirePrice(b, tierId) { return hireCost(b.biz, TIER[tierId], b.workers.length); }
  promotion(w) {
    if (w.data.tier === 'apprentice') {
      return { to: TIER.employee, cost: 0, ok: !!w.data.cfc, reason: w.data.cfc ? '' : `CFC dans ${Math.max(0, LAW.cfcDays - w.data.days)} j` };
    }
    if (w.data.tier === 'employee') {
      const ok = w.building.level >= TIER.expert.unlock;
      return { to: TIER.expert, cost: trainingCost(w.building.biz, w.tier, TIER.expert), ok, reason: ok ? '' : `Niv. ${TIER.expert.unlock}` };
    }
    return null;
  }
  cheapestBuild() {
    let m = Infinity;
    for (const b of BUSINESSES) if (this.isUnlocked(BIZ[b.id])) m = Math.min(m, this.buildPrice(b.id) + this.permitFee(b.id));
    return m;
  }

  spend(amount, fee = false) {
    if (this.cash + 1e-9 < amount) {
      this.sound.error();
      this.toast(this.cash < 0 ? 'Compte à découvert : rembourse d\'abord tes dettes' : 'Pas assez d\'argent', 'warning', 'error');
      return false;
    }
    this.cash -= amount;
    if (fee) this.week.fees += amount;
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
      if (!plot.owned || plot.ruin || !this.isUnlocked(biz) || !biz.zones.includes(plot.zone)) return false;
      const price = this.buildPrice(typeId), fee = this.permitFee(typeId);
      if (!this.spend(price + fee)) return false;
      this.week.fees += fee;
    }
    const b = new Building(this, plot, typeId, 1, free ? 0 : buildTime(biz));
    this.buildings.set(plot.key, b);
    if (!free) {
      this.fx.dust(b.root.position.clone(), 16);
      this.sound.build();
      this.toast(`Permis de construire déposé : ${biz.name} (mise à l'enquête publique)`, 'crane', 'success');
      if (this.tutorial === 0) this.setTutorial(1);
      this.select(b);
    }
    this.computeRate();
    this.emit('change');
    return b;
  }

  /** Droits de mutation (impôt cantonal sur les transferts immobiliers), ≈3 %. */
  transferTax(plot) { return plot.price * 0.03; }

  buyPlot(plot) {
    if (plot.owned || plot.building) return false;
    const price = plot.price, tax = this.transferTax(plot);
    if (!this.spend(price + tax)) return false;
    this.week.fees += tax;
    plot.owned = true;
    plot.setOccupied(false);
    this.sound.buy();
    this.fx.sparkle(_v.set(plot.center.x, 3, plot.center.z), '#5effa8', 16);
    this.toast(plot.ruin
      ? `Bâtiment abandonné acheté (inscription au registre foncier). Démolis-le pour construire !`
      : `Terrain acheté (registre foncier, droits de mutation ${money(tax)})`, 'contract', 'success');
    this.emit('change');
    return true;
  }

  demolitionPrice(plot) { return demolishCost(plot.price) * (1 + LAW.demolishPermit); }

  startDemolition(plot) {
    if (!plot.owned || !plot.ruin || plot.demolish) return false;
    const cost = this.demolitionPrice(plot);
    if (!this.spend(cost, true)) return false;
    plot.startDemolition();
    this.sound.build();
    this.toast('Permis de démolir accordé : la pelleteuse arrive ! Clique sur le bâtiment pour aider à le casser.', 'crane', 'success');
    this.emit('change');
    return true;
  }

  finishDemolition(plot) {
    const d = plot.demolish;
    plot.group.remove(d.exc.group, d.rubble);
    disposeObject(d.exc.group);
    disposeObject(d.rubble);
    plot.demolish = null;
    plot.removeRuin();
    plot.setOccupied(false);
    this.fx.dust(_v.set(plot.center.x, 0.3, plot.center.z), 22);
    this.sound.buy();
    this.toast('Démolition terminée, déchets triés (OLED). Le terrain est prêt à bâtir.', 'check', 'success');
    this.emit('change');
  }

  finishConstruction(b) {
    b.removeCrew();
    b.root.remove(b.construction.site.group);
    disposeObject(b.construction.site.group);
    b.construction = null;
    b.rebuild(true);
    this.fx.dust(b.root.position.clone(), 22);
    this.fx.sparkle(b.root.position.clone().add(new THREE.Vector3(0, 4, 0)), b.biz.color, 24);
    this.sound.buy();
    this.toast(`${b.biz.name} ouvre ses portes !`, b.typeId, 'success');
    if (this.tutorial === 1) this.setTutorial(2);
    this.emit('change');
  }

  upgrade(b) {
    if (b.level >= MAX_LEVEL || !b.open) return;
    if (!this.spend(this.upgradePrice(b))) return;
    b.level++;
    b.rebuild(true);
    this.fx.sparkle(b.root.position.clone().add(new THREE.Vector3(0, 5, 0)), '#ffe066', 24);
    this.fx.dust(b.root.position.clone(), 14);
    this.sound.buy();
    this.toast(`${b.biz.name} → niveau ${b.level}`, 'up', 'success');
    this.computeRate();
    this.emit('change');
  }

  hire(b, tierId, free = false, data = null) {
    if (b.workers.length >= b.slots || (!free && !b.open)) return null;
    const tier = TIER[tierId];
    if (!free) {
      if (b.level < tier.unlock) return null;
      if (!this.spend(this.hirePrice(b, tierId), true)) return null;
    }
    const d = data || {
      tier: tierId,
      seed: (Math.random() * 1e9) | 0,
      name: this.randomName(tierId),
      days: 0,
    };
    const w = new Worker(this, b, d, b.workers.length);
    b.workers.push(w);
    this.workers.push(w);
    if (!free) {
      if (this.onShift(w) || !w.human) {
        w.startOnSite();
        this.fx.puff(w.char.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), { color: '#ffffff', size: 0.8, life: 0.8, up: 1, spread: 1.4, radial: 3, count: 12 });
      }
      const p = b.spotPos(w.slot);
      this.fx.float(new THREE.Vector3(p.x, 3.4, p.z), `${icon('contract')} Contrat signé : ${d.name}`, 'float-info');
      if (w.human && !this.onShift(w)) this.toast(`${d.name} commencera au prochain horaire légal (lun–ven, 8h–17h)`, 'calendar');
      this.sound.buy();
      if (this.tutorial === 2) this.setTutorial(3);
    }
    this.computeRate();
    this.emit('change');
    return w;
  }

  promote(w) {
    const pr = this.promotion(w);
    if (!pr || !pr.ok) return;
    if (pr.cost > 0 && !this.spend(pr.cost, true)) return;
    w.data.tier = pr.to.id;
    w.buildChar();
    const p = w.char.root.position.clone();
    this.fx.sparkle(p.clone().add(new THREE.Vector3(0, 2, 0)), pr.to.color, 18);
    this.fx.float(p.add(new THREE.Vector3(0, 3.2, 0)), `${icon('up')} ${pr.to.short} !`, 'float-info');
    this.sound.buy();
    this.computeRate();
    this.emit('change');
  }

  fire(w) {
    const b = w.building;
    const cost = this.severance(w);
    if (cost > 0) {
      if (!this.spend(cost, true)) return;
    } else if (!w.human) {
      const refund = this.hirePrice(b, w.data.tier) * 0.2;
      this.cash += refund;
    }
    w.dispose();
    b.workers.splice(b.workers.indexOf(w), 1);
    this.workers.splice(this.workers.indexOf(w), 1);
    b.workers.forEach((x, i) => { x.slot = i; });
    this.toast(w.human ? `Contrat de ${w.data.name} résilié (délai de congé payé : ${money(cost)})` : `${w.data.name} revendu`, 'userMinus');
    this.sound.click();
    this.computeRate();
    this.emit('change');
  }

  buyUpgrade(id) {
    const u = UPGRADES.find((x) => x.id === id);
    if (!u || this.upgrades.has(id)) return;
    if (!this.spend(u.cost)) return;
    this.upgrades.add(id);
    this.sound.buy();
    this.toast(`${u.name} : ${u.desc}`, u.icon, 'success');
    this.computeRate();
    this.emit('change');
  }

  chooseCanton(id) {
    this.canton = id;
    this.toast(`Siège inscrit dans le canton de ${CANTON[id].name}`, 'shield', 'success');
    this.emit('change');
    this.save();
  }

  clickHQ(point) {
    const v = this.clickValue;
    this.earn(v);
    this.recordSale(v, 'normal');
    this.stats.clicks++;
    const p = point || new THREE.Vector3(0, 6, -2);
    this.fx.coinBurst(p, 4, 0.7);
    this.fx.float(p.clone().add(new THREE.Vector3(0, 1, 0)), `${icon('coin')} +${money(v)}`, 'float-click');
    this.sound.coin();
    this.hqBounce = 0.25;
  }

  motivate(w) {
    w.boost = 6;
    const p = w.char.root.position.clone().add(new THREE.Vector3(0, 3.4, 0));
    this.fx.float(p, `${icon('bolt')} Motivé·e !`, 'float-boost');
    this.fx.sparkle(w.char.root.position.clone().add(new THREE.Vector3(0, 1.5, 0)), '#74c0fc', 10);
    this.sound.whoosh();
  }

  recordSale(amount, tvaType) {
    if (this.tvaRegistered) {
      const r = tvaType === 'reduit' ? LAW.tvaReduit : LAW.tvaNormal;
      const tva = (amount * r) / (1 + r);
      this.week.tva += tva;
      this.week.sales += amount - tva;
    } else {
      this.week.sales += amount;
    }
    if (!this.tvaRegistered && this.totalEarned >= LAW.tvaSeuil) {
      this.tvaRegistered = true;
      this.cash -= LAW.rcFee;
      this.week.fees += LAW.rcFee;
      this.toast(`CA > ${money(LAW.tvaSeuil)} : assujetti à la TVA et inscrit au registre du commerce (${money(LAW.rcFee)})`, 'scale', 'gold');
    }
  }

  deposit(w) {
    const gross = w.carry * (this.rush > 0 ? 2 : 1);
    this.earn(gross);
    this.recordSale(gross, w.building.biz.tva);
    let net = gross;
    if (!w.human) {
      const upkeep = gross * ROBOT_UPKEEP;
      this.cash -= upkeep;
      this.week.robots += upkeep;
      net -= upkeep;
    }
    this.stats.deposits++;
    const p = w.char.root.position.clone().add(new THREE.Vector3(0, 2.2, -0.6));
    this.fx.coinBurst(p, this.workers.length > 40 ? 2 : 5, 0.8);
    this.fx.float(p.clone().add(new THREE.Vector3(0, 1.2, 0)), `${icon('coin')} +${money(net)}`, this.rush > 0 ? 'float-rush' : 'float-money');
    this.sound.coin();
    this.hqBounce = 0.15;
    if (this.tutorial === 3) this.setTutorial(4);
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
    const padMesh = pad.build({ castShadow: false });
    this.scene.add(padMesh, group);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(12, 14, 13).translate(0, 7, -0.5), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData = { type: 'hq' };
    group.add(hit);
    this.hqHit = hit;
    this.hqPick = group.getObjectByName('shadow-proxy');
    if (this.hqPick) this.hqPick.userData = { type: 'hq' };
    this.hqSign = buildSign('SIÈGE', 'Empire SA', '#f2c14e', 'bank');
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
    const useX = Math.random() < 0.5;
    const pos = useX
      ? new THREE.Vector3(PLAY_ROADS[(Math.random() * PLAY_ROADS.length) | 0], 0.2, (Math.random() - 0.5) * PLAY_HALF * 1.6)
      : new THREE.Vector3((Math.random() - 0.5) * PLAY_HALF * 1.6, 0.2, PLAY_ROADS[(Math.random() * PLAY_ROADS.length) | 0]);
    this.golden = { life: 20, pos };
    this.goldenObj.root.position.copy(pos);
    this.goldenObj.root.visible = true;
    this.toast('Une valise dorée est apparue dans les rues ! Clique dessus !', 'briefcase', 'gold');
  }

  collectGolden() {
    if (!this.golden) return;
    const reward = Math.max(60, this.rateCache * 50 + Math.max(0, this.cash) * 0.05) * this.goldenMult;
    this.earn(reward);
    this.recordSale(reward, 'normal');
    this.stats.golden++;
    const p = this.golden.pos.clone().add(new THREE.Vector3(0, 2, 0));
    this.fx.coinBurst(p, 30, 1.4);
    this.fx.sparkle(p, '#ffe066', 30);
    this.fx.float(p.clone().add(new THREE.Vector3(0, 2, 0)), `${icon('briefcase')} +${money(reward)}`, 'float-gold');
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
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(9, 9);
    const cam = this.engine.controls.cam;
    cam.onTap = (ndc, type) => {
      this.mouse.copy(ndc);
      this.pointerType = type;
      this.handleClick();
    };
  }

  /** Nearest object under the pointer, raycast against real (low-poly) shapes. */
  pick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const objs = this.pickList;
    objs.length = 0;
    objs.push(this.hqPick || this.hqHit);
    for (const p of this.plots.values()) {
      const b = p.building;
      if (b && b.open && b.pickMesh) objs.push(b.pickMesh);
      else if (!b && p.ruin && p.ruinPick && !p.demolish) objs.push(p.ruinPick);
      else {
        p.hit.scale.y = b || p.demolish ? 9 : 0.8;
        p.hit.updateMatrixWorld();
        objs.push(p.hit);
      }
    }
    for (const w of this.workers) if (w.char.root.visible && !w.char.offscreen) objs.push(w.char.hit);
    if (this.golden) objs.push(this.goldenObj.hit);
    const hits = this.raycaster.intersectObjects(objs, false);
    const h = hits.find((x) => x.object.userData?.type);
    return h ? { ...h.object.userData, point: h.point } : null;
  }

  handleClick() {
    if (!this.canton) return;
    const hit = this.pick();
    if (!hit) { this.select(null); return; }
    this.sound.click();
    if (hit.type === 'golden') this.collectGolden();
    else if (hit.type === 'worker') { this.motivate(hit.worker); this.select(hit.worker.building); }
    else if (hit.type === 'hq') { this.clickHQ(hit.point); this.select({ hq: true, center: new THREE.Vector3() }); }
    else if (hit.type === 'plot') {
      const p = hit.plot;
      if (p.demolish) p.smash();
      this.select(p.building || p);
    }
  }

  updateHover() {
    const cam = this.engine.controls.cam;
    this.pointerType = cam.pointerType;
    if (this.engine.mobile || this.pointerType === 'touch' || cam.gesture) { this.hoverFrame.visible = false; this.emit('hover', null); return; }
    this.mouse.copy(cam.hover);
    const hit = this.pick();
    let cursor = 'default';
    this.hoverFrame.visible = false;
    let tip = null;
    if (hit) {
      cursor = 'pointer';
      if (hit.type === 'plot') {
        const pl = hit.plot;
        this.hoverFrame.position.set(pl.center.x, 0, pl.center.z);
        this.hoverFrame.visible = this.selected !== pl && this.selected !== pl.building;
        tip = pl.building
          ? `${icon(pl.building.typeId)} ${pl.building.biz.name} · ${pl.building.open ? 'Niv. ' + pl.building.level : 'en construction'}`
          : pl.demolish ? `${icon('crane')} Démolition — clique pour casser !`
            : pl.ruin ? `${icon('warning')} ${pl.owned ? 'Ton bâtiment abandonné · à démolir' : 'Bâtiment abandonné à vendre · ' + money(pl.price)}`
              : pl.owned ? `${icon('crane')} Ton terrain · prêt à bâtir` : `${icon('pin')} Terrain à vendre · ${money(pl.price)}`;
      } else if (hit.type === 'worker') {
        const w = hit.worker;
        tip = `${icon(w.tier.icon)} ${w.data.name} (${w.tier.short}) — ${w.statusLabel()} · clic : motiver`;
      } else if (hit.type === 'hq') {
        tip = `${icon('bank')} Siège — clique pour encaisser +${money(this.clickValue)}`;
      } else if (hit.type === 'golden') {
        tip = `${icon('briefcase')} Valise dorée !`;
      }
    }
    this.engine.renderer.domElement.style.cursor = cursor;
    this.emit('hover', tip);
  }

  // ---------------- main update ----------------
  update(dt) {
    if (!this.canton) return;
    this.time += dt;
    this.stats.playTime += dt;
    this.frame++;
    const t = this.time;
    if (this.frame % 10 === 0) {
      let n = 0, humans = false;
      for (const w of this.workers) if (w.active) { n++; if (w.human) humans = true; }
      this.activeCount = n;
      this.humansOnSite = humans;
    }
    this.updateClock(dt);

    for (const b of this.buildings.values()) b.update(dt, t);
    for (const w of this.workers) w.update(dt, t);
    this.citizens.update(dt, t);
    const canBuild = this.cash >= this.cheapestCache;
    for (const p of this.plots.values()) {
      const holo = p.owned ? canBuild && !p.ruin : (!p.ruin && this.isFrontier(p) && this.cash >= p.price);
      p.update(t, dt, holo);
    }

    this.hqCoin.rotation.y += dt * 1.6;
    this.hqCoin.position.y = 12.6 + Math.sin(t * 1.5) * 0.3;
    if (this.hqBounce > 0) {
      this.hqBounce = Math.max(0, this.hqBounce - dt);
      const k = this.hqBounce / 0.25;
      this.hq.scale.set(1 + k * 0.03, 1 - k * 0.04, 1 + k * 0.03);
    } else {
      this.hq.scale.set(1, 1, 1);
    }
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

    // rush hour (only when shops are staffed)
    if (this.rush > 0) {
      this.rush -= dt;
      if (this.rush <= 0) this.emit('rush', false);
    } else if (this.activeCount >= 3) {
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

  /** Called right before rendering, after the camera moved. */
  renderPrep() {
    this.crowd.update(this.camera, this.workers, this.citizens.list, this.crew);
  }

  setLodScale(scale) {
    this.lodScale = scale;
    for (const b of this.buildings.values()) if (b.model?.lod) setBuildingLodScale(b.model.lod, scale);
  }

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

  checkMilestones() {
    const steps = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12];
    while (this.milestone < steps.length && this.totalEarned >= steps[this.milestone]) {
      this.toast(`Cap franchi : ${money(steps[this.milestone])} de chiffre d'affaires cumulé !`, 'trophy', 'gold');
      this.milestone++;
    }
  }

  /** Put every worker where they should be at the current time (after load). */
  placeWorkersForTime() {
    for (const w of this.workers) {
      if (!w.human || this.shouldCommute(w)) {
        w.startOnSite();
        if (Math.random() < 0.5) {
          // spread them along their delivery loop so the city looks alive
          w.state = Math.random() < 0.5 ? 'toHQ' : 'toWork';
          w.path = w.building.makePath(w.slot, w.state === 'toHQ');
          const start = Math.floor(Math.random() * (w.path.length - 1));
          w.seg = start + 1;
          w.setPos(w.path[start]);
          w.char.bag.visible = w.state === 'toHQ';
          w.carry = w.building.tripIncome(w.tier);
        }
      }
    }
  }

  // ---------------- persistence ----------------
  serialize() {
    return {
      v: 2,
      canton: this.canton,
      cash: this.cash,
      totalEarned: this.totalEarned,
      upgrades: [...this.upgrades],
      clock: this.clock,
      stats: this.stats,
      tutorial: this.tutorial,
      milestone: this.milestone,
      tvaRegistered: this.tvaRegistered,
      week: this.week,
      lastWeek: this.lastWeek,
      pending: this.pending,
      savedAt: Date.now(),
      owned: [...this.plots.values()].filter((p) => p.owned).map((p) => p.key),
      cleared: [...this.plots.values()].filter((p) => !p.ruin).map((p) => p.key),
      demolishing: Object.fromEntries([...this.plots.values()].filter((p) => p.demolish).map((p) => [p.key, p.demolish.t])),
      buildings: [...this.buildings.values()].map((b) => ({
        key: b.plot.key,
        type: b.typeId,
        level: b.level,
        construction: b.construction ? b.construction.total - b.construction.t : 0,
        workers: b.workers.map((w) => ({ ...w.data })),
      })),
    };
  }

  save() {
    if (!this.canton) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())); } catch (e) { /* storage unavailable */ }
  }

  load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { data = null; }
    if (!data || data.v !== 2) { this.cheapestCache = this.cheapestBuild(); return null; }
    this.canton = data.canton;
    this.cash = data.cash;
    this.totalEarned = data.totalEarned;
    this.upgrades = new Set(data.upgrades);
    this.clock = data.clock ?? this.clock;
    this.stats = { ...this.stats, ...data.stats };
    this.tutorial = data.tutorial ?? 5;
    this.milestone = data.milestone ?? 0;
    this.tvaRegistered = !!data.tvaRegistered;
    this.week = data.week || emptyLedger();
    this.lastWeek = data.lastWeek || null;
    this.pending = data.pending || { wages: 0, charges: 0 };
    if (data.cleared) {
      for (const p of this.plots.values()) if (data.cleared.includes(p.key)) p.removeRuin();
    }
    for (const key of data.owned || []) {
      const p = this.plots.get(key);
      if (p) { p.owned = true; p.setOccupied(false); }
    }
    for (const [key, t] of Object.entries(data.demolishing || {})) {
      const p = this.plots.get(key);
      if (p && p.ruin) { p.startDemolition(); p.demolish.t = t; }
    }
    for (const bd of data.buildings) {
      const plot = this.plots.get(bd.key);
      if (!plot || !BIZ[bd.type]) continue;
      const b = new Building(this, plot, bd.type, bd.level, bd.construction || 0);
      this.buildings.set(plot.key, b);
      for (const wd of bd.workers) this.hire(b, wd.tier, true, wd);
    }
    this.placeWorkersForTime();
    const rate = this.computeRate();
    this.cheapestCache = this.cheapestBuild();
    // Offline: humans only work ~30% of the week (LTr), robots ~100%; net of wages & taxes.
    const elapsed = Math.max(0, (Date.now() - (data.savedAt || Date.now())) / 1000);
    let offline = 0;
    if (elapsed > 30 && rate > 0) {
      let human = 0, robot = 0;
      for (const b of this.buildings.values()) {
        for (const w of b.workers) {
          const cycle = w.workTime() + (2 * b.routeLength + 10) / (w.tier.speed * this.speedMult) + 0.7;
          const r = b.tripIncome(w.tier) / cycle;
          if (w.human) human += r * 0.3 * 0.6; else robot += r * (1 - ROBOT_UPKEEP);
        }
      }
      offline = (human + robot) * (1 - this.cantonData.tax) * Math.min(elapsed, 4 * 3600) * 0.5;
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

export { TIER, DAYS };
