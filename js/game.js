// Partie 3c3 : unités, tirs, supers, zones, modes de jeu, caméra et HUD.
import * as THREE from 'three';
import { HEROES, HERO_ORDER, buildHero } from './heroes.js';
import { Arena } from './arena.js';
import { Brain } from './ai.js';
import { FX } from './fx.js';
import { sfx, startMusic } from './audio.js';
import { GEO, outlineGeometry, outlineMaterial, rockGeo, capsule, setOutline } from './toon.js';

const PI = Math.PI;
const TEAM_HEX = [0x3db6ff, 0xff4057];
const TEAM_CSS = ['#3db6ff', '#ff4057'];
const PLAYER_HEX = 0x7dff4f;
const UNIT_R = 0.42;
const BAR_Y = { miso: 2.3, volta: 2.15, bouldo: 2.05, pluma: 1.8 };
const BOT_NAMES = ['Kiko', 'Zébulon', 'Momo', 'Lulu_GG', 'Patate', 'Taco', 'Nina', 'Brioche', 'Sushi', 'Rocco', 'Pepito', 'Yuzu', 'Choco', 'Mimi', 'Gaspard', 'Tofu', 'Rox', 'Bibi', 'Noisette', 'Kawa'];
const HIT_COL = { dumpling: [0xfff1d6, 0xff8a2a], bolt: [0x3ff2ff, 0xffffff], pebble: [0x9aa2c8, 0x6c7398], seed: [0xc6ff5a, 0xff6f91], orb: [0x3ff2ff, 0xffe23d] };

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpAngle = (a, b, t) => { let d = ((b - a + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI; return a + d * t; };
const rot = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];

// --- Ressources partagées des projectiles ---
let PM = null;
function projMats() {
  if (PM) return PM;
  const s = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, ...o });
  PM = {
    dough: s(0xfff1d6), pot: s(0xff4a3d), lid: s(0x3b3657, { metalness: 0.4, roughness: 0.3 }),
    rock: s(0x9aa2c8, { flatShading: true, roughness: 0.8 }), seed: s(0xc6ff5a), pink: s(0xff6f91), leaf: s(0x4cc95a),
    cyan: new THREE.MeshBasicMaterial({ color: 0x9ffcff }), glow: new THREE.MeshBasicMaterial({ color: 0x3ff2ff, transparent: true, opacity: 0.45, depthWrite: false }),
    white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    broth: new THREE.MeshBasicMaterial({ color: 0xffa630, transparent: true, opacity: 0.55, depthWrite: false }),
    heal: new THREE.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.4, depthWrite: false }),
  };
  return PM;
}
const withOutline = (m) => { m.add(new THREE.Mesh(outlineGeometry(m.geometry), outlineMaterial)); return m; };
function projMesh(kind) {
  const M = projMats();
  const g = new THREE.Group();
  const add = (geo, mat, s, p = [0, 0, 0], ol = true) => {
    const m = new THREE.Mesh(geo, mat);
    if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(...s);
    m.position.set(...p);
    if (ol) withOutline(m);
    g.add(m);
    return m;
  };
  if (kind === 'dumpling') {
    add(GEO.sph, M.dough, [0.2, 0.14, 0.2]);
    add(GEO.cone, M.dough, [0.07, 0.1, 0.07], [0, 0.13, 0]);
  } else if (kind === 'bolt') {
    add(capsule(0.08, 0.55), M.cyan, 1, [0, 0, 0], false).rotation.x = PI / 2;
    add(capsule(0.17, 0.6), M.glow, 1, [0, 0, -0.05], false).rotation.x = PI / 2;
  } else if (kind === 'pebble') {
    add(rockGeo(9), M.rock, 0.15);
  } else if (kind === 'seed') {
    add(GEO.sph, M.seed, [0.11, 0.11, 0.16]);
    add(GEO.sph, M.pink, 0.05, [0, 0.06, -0.06], false);
  } else if (kind === 'pot') {
    add(GEO.cyl, M.pot, [0.26, 0.26, 0.26]);
    add(GEO.cyl, M.lid, [0.28, 0.05, 0.28], [0, 0.15, 0]);
    add(GEO.sph, M.lid, 0.06, [0, 0.2, 0]);
  } else if (kind === 'orb') {
    add(GEO.sph, M.cyan, 0.38, [0, 0, 0], false);
    add(GEO.sph, M.glow, 0.62, [0, 0, 0], false);
    const r1 = add(new THREE.TorusGeometry(0.55, 0.04, 6, 32), M.white, 1, [0, 0, 0], false);
    r1.rotation.x = PI / 2;
    g.userData.ring = r1;
  } else if (kind === 'flower') {
    add(GEO.sph, M.pink, 0.2);
    for (let i = 0; i < 4; i++) add(GEO.sph, M.leaf, [0.08, 0.04, 0.16], [Math.sin(i * PI / 2) * 0.18, 0, Math.cos(i * PI / 2) * 0.18], false).rotation.y = i * PI / 2;
  }
  return g;
}

export class Game {
  constructor(app, opts) {
    this.app = app;
    this.mode = opts.mode;
    this.heroId = opts.hero;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2f6b4a);
    this.scene.fog = new THREE.Fog(0x2f6b4a, 30, 60);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 120);

    const hemi = new THREE.HemisphereLight(0xdff0ff, 0x6a4f7a, 1.7);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    sun.position.set(-7, 16, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 20, bottom: -20, near: 1, far: 50 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0015;
    const rim = new THREE.DirectionalLight(0xc8b4ff, 0.9);
    rim.position.set(5, 8, -12);
    this.scene.add(hemi, sun, rim);

    this.arena = new Arena();
    this.arena.build(this.scene);
    if (this.mode === 'zone') this.zoneMesh = this.arena.buildZone(this.scene);
    this.fx = new FX(this.scene);

    this.units = [];
    this.projectiles = [];
    this.areas = [];
    this.timers = [];
    this.texts = [];
    this.score = [0, 0];
    this.zoneP = [0, 0];
    this.zoneState = -1;
    this.duration = this.mode === 'ko' ? 120 : 150;
    this.timeLeft = this.duration;
    this.target = this.mode === 'ko' ? 10 : 100;
    this.state = 'intro';
    this.introT = 3.4;
    this.lastCount = 4;
    this.t = 0;
    this.shake = 0;
    this.slow = 1;
    this.paused = false;
    this.endT = 0;
    this.camPos = null;
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.mouseW = null;
    this.nextId = 1;
    this.lastBeep = 99;

    // Équipes
    const names = shuffle([...BOT_NAMES]);
    const mates = shuffle(HERO_ORDER.filter((h) => h !== opts.hero));
    const blue = [mates[0], opts.hero, mates[1]];
    const red = shuffle([...HERO_ORDER]).slice(0, 3);
    blue.forEach((h, i) => this.addUnit(h, 0, i, i === 1 ? opts.playerName : names.pop(), i === 1));
    red.forEach((h, i) => this.addUnit(h, 1, i, names.pop(), false));
    this.player = this.units.find((u) => u.isPlayer);
    this.buildIndicators();

    this.ui = app.ui;
    this.ui.modeName.textContent = this.mode === 'ko' ? 'K.O. EXPRESS' : 'ZONE CHAUDE';
    this.ui.goal.textContent = this.mode === 'ko' ? `Premiers à ${this.target} K.O.` : 'Tenez la zone centrale';
    this.ui.zoneBars.hidden = this.mode !== 'zone';
    this.ui.scores.hidden = this.mode !== 'ko';
    this.ui.killfeed.innerHTML = '';
    this.ui.respawn.hidden = true;
    this.ui.superLabel.textContent = HEROES[opts.hero].super.name;
    this.ui.atkLabel.textContent = HEROES[opts.hero].attack.name;
    startMusic('game');
  }

  addUnit(heroId, team, idx, name, isPlayer) {
    const def = HEROES[heroId];
    const rig = buildHero(heroId);
    rig.mode = 'game';
    rig.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    const obj = new THREE.Group();
    obj.add(rig.root);
    const ringCol = isPlayer ? PLAYER_HEX : TEAM_HEX[team];
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    blob.rotation.x = -PI / 2;
    blob.position.y = 0.02;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, isPlayer ? 0.68 : 0.62, 40), new THREE.MeshBasicMaterial({ color: ringCol, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -PI / 2;
    ring.position.y = 0.03;
    const ground = new THREE.Group();
    ground.add(blob, ring);
    if (isPlayer) {
      const arrow = new THREE.Mesh(new THREE.CircleGeometry(0.17, 3), ring.material);
      arrow.rotation.x = -PI / 2;
      arrow.rotation.z = PI / 2;
      arrow.position.set(0, 0.03, 0.86);
      const arrowPivot = new THREE.Group();
      arrowPivot.add(arrow);
      ground.add(arrowPivot);
      ground.userData.arrow = arrowPivot;
    }
    obj.add(ground);
    const shield = new THREE.Mesh(GEO.sph, new THREE.MeshBasicMaterial({ color: 0x9ff2ff, transparent: true, opacity: 0.22, depthWrite: false }));
    shield.scale.setScalar(1.0);
    shield.position.y = 0.9;
    shield.visible = false;
    obj.add(shield);
    const stars = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(GEO.ico, new THREE.MeshBasicMaterial({ color: 0xffe23d }));
      s.scale.setScalar(0.09);
      s.position.set(Math.cos(i * 2.1) * 0.35, 0, Math.sin(i * 2.1) * 0.35);
      stars.add(s);
    }
    stars.position.y = BAR_Y[heroId] - 0.2;
    stars.visible = false;
    obj.add(stars);
    this.scene.add(obj);

    const sp = this.arena.spawns[team][idx];
    const u = {
      id: this.nextId++, def, heroId, team, name, isPlayer, rig, obj, ground, ring, shield, stars,
      x: sp.x, z: sp.z, y: 0, vx: 0, vz: 0, face: team === 0 ? PI : 0, faceTarget: team === 0 ? PI : 0, faceLock: 0,
      hp: def.hp, maxHp: def.hp, ammo: 3, superCharge: 0, alive: true, respawnT: 0, lastCombat: -10,
      invuln: 0, stun: 0, reveal: 0, kb: { x: 0, z: 0, t: 0 }, jump: null, attackCD: 0, inBush: false, move: 0,
      kills: 0, deaths: 0, dmg: 0, heal: 0, spawnIdx: idx, brain: null, superWasReady: false,
    };
    if (!isPlayer) u.brain = new Brain(u, this);
    this.units.push(u);
    return u;
  }

  // --- Indicateurs de visée au sol ---
  buildIndicators() {
    const h = this.heroId;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });
    const smat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.42, depthWrite: false });
    const rect = (len, w, m) => {
      const g = new THREE.PlaneGeometry(w, len);
      g.rotateX(-PI / 2);
      g.translate(0, 0.06, len / 2 + 0.3);
      return new THREE.Mesh(g, m);
    };
    const wedge = (len, ang, m) => {
      const g = new THREE.CircleGeometry(len, 24, -PI / 2 - ang / 2, ang);
      g.rotateX(-PI / 2);
      g.translate(0, 0.06, 0);
      return new THREE.Mesh(g, m);
    };
    const circle = (r, m) => {
      const g = new THREE.RingGeometry(r * 0.12, r, 40);
      g.rotateX(-PI / 2);
      g.translate(0, 0.07, 0);
      return new THREE.Mesh(g, m);
    };
    const atk = { miso: () => wedge(7, 0.5, mat), volta: () => rect(9.7, 0.45, mat), bouldo: () => wedge(4.3, 0.6, mat), pluma: () => rect(7.7, 0.4, mat) }[h]();
    this.indAtk = new THREE.Group();
    this.indAtk.add(atk);
    this.indSup = new THREE.Group();
    this.indSupTarget = null;
    if (h === 'volta') this.indSup.add(rect(10.2, 1.3, smat));
    else {
      this.indSupTarget = circle({ miso: 2.1, bouldo: 2.5, pluma: 2.6 }[h], smat);
      this.indSupLine = rect(1, 0.12, smat);
      this.indSup.add(this.indSupLine);
      this.scene.add(this.indSupTarget);
    }
    this.indAtk.visible = this.indSup.visible = false;
    if (this.indSupTarget) this.indSupTarget.visible = false;
    this.scene.add(this.indAtk, this.indSup);
  }

  // --- Boucle ---
  update(rdt) {
    if (this.paused) { this.app.input.consume().forEach((e) => { if (e.type === 'pause') this.app.togglePause(); }); return; }
    if (this.state === 'end') {
      this.endT += rdt;
      this.slow = Math.min(1, 0.25 + this.endT * 0.4);
    }
    const dt = rdt * this.slow;
    this.t += dt;
    this.stepState(rdt);

    const intents = new Map();
    intents.set(this.player, this.playerIntent(dt));
    for (const u of this.units) if (u.brain) intents.set(u, u.brain.think(dt));
    for (const u of this.units) this.stepUnit(u, intents.get(u), dt);
    this.separate();
    this.stepProjectiles(dt);
    this.stepAreas(dt);
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }
    this.fx.update(dt);
    this.arena.update(dt);
    this.syncVisuals(dt);
    this.updateCamera(rdt);
    this.updateIndicators();
    this.updateHud();
  }

  stepState(rdt) {
    if (this.state === 'intro') {
      this.introT -= rdt;
      const n = Math.ceil(this.introT - 0.6);
      if (n >= 1 && n <= 3 && n !== this.lastCount) { this.lastCount = n; this.banner(String(n), 'count'); sfx('beep'); }
      if (this.introT <= 0.6 && this.lastCount !== 0) { this.lastCount = 0; this.banner('GO !', 'go'); sfx('go'); }
      if (this.introT <= 0) this.state = 'play';
      return;
    }
    if (this.state !== 'play') {
      if (this.state === 'end' && this.endT > 2.8 && !this.reported) {
        this.reported = true;
        this.app.onGameEnd(this.result());
      }
      return;
    }
    this.timeLeft -= rdt;
    if (this.timeLeft <= 10 && Math.ceil(this.timeLeft) !== this.lastBeep && this.timeLeft > 0) {
      this.lastBeep = Math.ceil(this.timeLeft);
      sfx('beep', 0.5);
    }
    if (this.mode === 'zone') {
      const z = this.arena.zone;
      const n = [0, 0];
      for (const u of this.units) if (u.alive && !u.jump && Math.hypot(u.x - z.x, u.z - z.z) < z.r) n[u.team]++;
      this.zoneState = n[0] && n[1] ? 2 : n[0] ? 0 : n[1] ? 1 : -1;
      if (this.zoneState === 0 || this.zoneState === 1) {
        const t = this.zoneState;
        this.zoneP[t] = Math.min(100, this.zoneP[t] + rdt * (2.2 + 0.8 * (n[t] - 1)));
        if (this.zoneP[t] >= 100) return this.end(t);
      }
    } else {
      if (this.score[0] >= this.target) return this.end(0);
      if (this.score[1] >= this.target) return this.end(1);
    }
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      const a = this.mode === 'ko' ? this.score : this.zoneP.map(Math.floor);
      this.end(a[0] > a[1] ? 0 : a[1] > a[0] ? 1 : -1);
    }
  }

  end(winner) {
    if (this.state === 'end') return;
    this.state = 'end';
    this.winner = winner;
    this.endT = 0;
    this.slow = 0.25;
    const txt = winner === 0 ? 'VICTOIRE !' : winner === 1 ? 'DÉFAITE' : 'ÉGALITÉ';
    this.banner(txt, winner === 0 ? 'win' : winner === 1 ? 'lose' : 'draw', 99);
    sfx(winner === 0 ? 'win' : 'lose');
    this.app.input.reset();
  }

  result() {
    const blue = this.units.filter((u) => u.team === 0);
    const score = (u) => u.kills * 900 + u.dmg + u.heal * 0.8 - u.deaths * 200;
    const pool = this.winner === 1 ? this.units.filter((u) => u.team === 1) : blue;
    const mvp = pool.reduce((a, b) => (score(b) > score(a) ? b : a));
    return {
      winner: this.winner, mode: this.mode, hero: this.heroId,
      score: this.mode === 'ko' ? this.score.slice() : this.zoneP.map(Math.floor),
      units: this.units.map((u) => ({ name: u.name, heroId: u.heroId, team: u.team, kills: u.kills, deaths: u.deaths, dmg: Math.round(u.dmg), heal: Math.round(u.heal), isPlayer: u.isPlayer, mvp: u === mvp })),
      player: { kills: this.player.kills, deaths: this.player.deaths, dmg: Math.round(this.player.dmg) },
    };
  }

  banner(text, cls, dur = 0.9) {
    const b = this.ui.banner;
    b.textContent = text;
    b.className = 'banner show ' + cls;
    clearTimeout(this._bt);
    if (dur < 50) this._bt = setTimeout(() => { b.className = 'banner'; }, dur * 1000);
  }

  // --- Joueur ---
  playerIntent() {
    const inp = this.app.input, p = this.player;
    const out = { mx: 0, mz: 0, attack: null, superA: null };
    const events = inp.consume();
    for (const e of events) if (e.type === 'pause') this.app.togglePause();
    if (this.state !== 'play' || !p.alive) return out;
    const mv = inp.move();
    out.mx = mv.x;
    out.mz = mv.y;
    this.mouseW = null;
    if (!inp.isTouch && inp.mouse.active) {
      this.ray.setFromCamera({ x: inp.mouse.nx, y: inp.mouse.ny }, this.camera);
      const hit = new THREE.Vector3();
      if (this.ray.ray.intersectPlane(this.plane, hit)) this.mouseW = { x: hit.x, z: hit.z };
    }
    const facing = () => ({ dx: Math.sin(p.face), dz: Math.cos(p.face) });
    const mouseDir = () => {
      if (!this.mouseW) return facing();
      const dx = this.mouseW.x - p.x, dz = this.mouseW.z - p.z, l = Math.hypot(dx, dz) || 1;
      return { dx: dx / l, dz: dz / l };
    };
    if (!inp.isTouch && inp.mouse.left) out.attack = mouseDir();
    for (const e of events) {
      if (e.type === 'attack') {
        out.attack = e.auto ? (this.autoAim(p, p.def.attack.range * 1.1) || facing()) : { dx: e.dx, dz: e.dy };
      } else if (e.type === 'super') {
        if (p.superCharge < 1) { sfx('click', 0.5); continue; }
        const range = p.def.super.range;
        if (e.mouse) {
          const d = mouseDir();
          const dist = this.mouseW ? Math.min(range, Math.hypot(this.mouseW.x - p.x, this.mouseW.z - p.z)) : range * 0.7;
          out.superA = { tx: p.x + d.dx * dist, tz: p.z + d.dz * dist };
        } else if (e.auto) {
          if (p.heroId === 'pluma') {
            let best = p, bf = p.hp / p.maxHp;
            for (const a of this.units) if (a.team === 0 && a.alive && a.hp / a.maxHp < bf && Math.hypot(a.x - p.x, a.z - p.z) < range) { best = a; bf = a.hp / a.maxHp; }
            out.superA = { tx: best.x, tz: best.z };
          } else {
            const t = this.nearestEnemy(p, range * 1.05);
            const f = facing();
            out.superA = t ? { tx: t.x, tz: t.z } : { tx: p.x + f.dx * range * 0.7, tz: p.z + f.dz * range * 0.7 };
          }
        } else {
          const dist = range * Math.max(0.3, e.mag);
          out.superA = { tx: p.x + e.dx * dist, tz: p.z + e.dy * dist };
        }
      }
    }
    return out;
  }

  nearestEnemy(u, range) {
    let best = null, bd = range;
    for (const e of this.units) {
      if (e.team === u.team || !e.alive || !this.visibleTo(e, u.team)) continue;
      const d = Math.hypot(e.x - u.x, e.z - u.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  autoAim(u, range) {
    const t = this.nearestEnemy(u, range);
    if (!t) return null;
    const d = Math.hypot(t.x - u.x, t.z - u.z);
    const tt = d / u.def.attack.speed;
    const px = t.x + t.vx * tt * 0.6, pz = t.z + t.vz * tt * 0.6;
    const dx = px - u.x, dz = pz - u.z, l = Math.hypot(dx, dz) || 1;
    return { dx: dx / l, dz: dz / l };
  }

  visibleTo(u, team) {
    if (u.team === team) return true;
    if (!u.alive) return false;
    if (!u.inBush || u.reveal > 0) return true;
    for (const o of this.units) {
      if (o.team === team && o.alive && (o.x - u.x) ** 2 + (o.z - u.z) ** 2 < 2.4 * 2.4) return true;
    }
    return false;
  }

  // --- Unités ---
  stepUnit(u, it, dt) {
    if (!u.alive) {
      u.respawnT -= dt;
      if (u.respawnT <= 0 && this.state === 'play') this.respawn(u);
      return;
    }
    u.invuln = Math.max(0, u.invuln - dt);
    u.stun = Math.max(0, u.stun - dt);
    u.reveal = Math.max(0, u.reveal - dt);
    u.attackCD = Math.max(0, u.attackCD - dt);
    u.faceLock = Math.max(0, u.faceLock - dt);
    u.ammo = Math.min(3, u.ammo + dt / u.def.reload);
    if (this.t - u.lastCombat > 3 && u.hp < u.maxHp && this.state === 'play') {
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.13 * dt);
      if (Math.random() < dt * 4) this.fx.spawn(u.x + (Math.random() - 0.5) * 0.6, 0.4, u.z + (Math.random() - 0.5) * 0.6, 0, 1.6, 0, 0.07, 0.6, 0x7dff9a, 0, 0.5);
    }
    if (u.superCharge >= 1 && !u.superWasReady) {
      u.superWasReady = true;
      if (u.isPlayer) { sfx('superReady'); this.fx.ring(u.x, u.z, 1.4, 0xffd23f, 0.5); }
    }
    if (u.jump) { this.stepJump(u, dt); return; }

    let mx = it.mx, mz = it.mz;
    if (u.stun > 0 || this.state !== 'play') mx = mz = 0;
    const sp = u.def.speed;
    let kx = 0, kz = 0;
    if (u.kb.t > 0) { u.kb.t -= dt; kx = u.kb.x; kz = u.kb.z; }
    const ox = u.x, oz = u.z;
    u.x += (mx * sp + kx) * dt;
    u.z += (mz * sp + kz) * dt;
    this.arena.resolveCircle(u, UNIT_R);
    u.vx = dt > 0 ? (u.x - ox) / dt : 0;
    u.vz = dt > 0 ? (u.z - oz) / dt : 0;
    u.move = Math.min(1, Math.hypot(mx, mz));
    if (u.faceLock <= 0 && u.move > 0.1) u.faceTarget = Math.atan2(mx, mz);
    u.face = lerpAngle(u.face, u.faceTarget, 1 - Math.exp(-dt * 16));
    u.inBush = this.arena.inBush(u.x, u.z);

    if (this.state === 'play' && u.stun <= 0) {
      if (it.superA && u.superCharge >= 1) this.doSuper(u, it.superA.tx, it.superA.tz);
      else if (it.attack && u.ammo >= 1 && u.attackCD <= 0) this.doAttack(u, it.attack.dx, it.attack.dz);
    }
  }

  separate() {
    const us = this.units;
    for (let i = 0; i < us.length; i++) {
      const a = us[i];
      if (!a.alive || a.jump) continue;
      for (let j = i + 1; j < us.length; j++) {
        const b = us[j];
        if (!b.alive || b.jump) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
        if (d2 < 0.72 && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (0.85 - d) * 0.5;
          a.x -= dx / d * push; a.z -= dz / d * push;
          b.x += dx / d * push; b.z += dz / d * push;
          this.arena.resolveCircle(a, UNIT_R);
          this.arena.resolveCircle(b, UNIT_R);
        }
      }
    }
  }

  vol(u) {
    const p = this.player;
    const d = Math.hypot(u.x - p.x, u.z - p.z);
    return u.isPlayer ? 1 : clamp(1 - d / 16, 0, 0.8);
  }

  later(t, fn) { this.timers.push({ t, fn }); }

  doAttack(u, dx, dz) {
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    u.ammo -= 1;
    u.attackCD = 0.3;
    u.lastCombat = this.t;
    u.reveal = 1.0;
    u.face = u.faceTarget = Math.atan2(dx, dz);
    u.faceLock = 0.45;
    u.rig.recoil = 1;
    const v = this.vol(u);
    switch (u.heroId) {
      case 'miso':
        for (const a of [-0.2, 0, 0.2]) this.shoot(u, rot(dx, dz, a), { kind: 'dumpling', speed: 11, range: 7, dmg: 400, rad: 0.3, bounce: 1 });
        this.fx.puff(u.x + dx * 0.8, 1.0, u.z + dz * 0.8, 0xffffff, 3, 0.18);
        sfx('pop', v);
        break;
      case 'volta':
        this.shoot(u, [dx, dz], { kind: 'bolt', speed: 22, range: 10, dmg: 1050, rad: 0.3 });
        this.fx.burst(u.x + dx * 0.9, 0.9, u.z + dz * 0.9, [0x3ff2ff, 0xffffff], 6, 3, 0.07, 0.25);
        sfx('zap', v);
        break;
      case 'bouldo':
        for (let i = -2; i <= 2; i++) this.shoot(u, rot(dx, dz, i * 0.13 + (Math.random() - 0.5) * 0.05), { kind: 'pebble', speed: 14 + Math.random() * 2, range: 4.3, dmg: 320, rad: 0.3 });
        sfx('thud', v);
        break;
      case 'pluma': {
        const o = { kind: 'seed', speed: 16, range: 8, dmg: 400, rad: 0.28 };
        this.shoot(u, [dx, dz], o);
        this.later(0.14, () => { if (u.alive) { u.rig.recoil = 1; this.shoot(u, [dx, dz], o); sfx('twang', this.vol(u) * 0.7); } });
        sfx('twang', v);
        break;
      }
    }
  }

  doSuper(u, tx, tz) {
    u.superCharge = 0;
    u.superWasReady = false;
    u.lastCombat = this.t;
    u.reveal = 1.2;
    u.rig.recoil = 1;
    const v = this.vol(u);
    sfx('super', v);
    let dx = tx - u.x, dz = tz - u.z;
    const d = Math.hypot(dx, dz);
    const nx = d > 0.01 ? dx / d : Math.sin(u.face), nz = d > 0.01 ? dz / d : Math.cos(u.face);
    if (d > 0.3) { u.face = u.faceTarget = Math.atan2(nx, nz); u.faceLock = 0.5; }
    switch (u.heroId) {
      case 'miso': {
        const dd = clamp(d, 1.2, 7.5);
        this.lob(u, u.x + nx * dd, u.z + nz * dd, 'pot', 0.8, 3.4, (x, z) => {
          this.explode(u, x, z, 2.1, 900, [0xff8a2a, 0xffc53a, 0xfff1d6]);
          this.addArea({ x, z, r: 2.1, dur: 3, tick: 0.5, dmg: 240, team: u.team, owner: u, kind: 'broth' });
        });
        break;
      }
      case 'volta':
        this.shoot(u, [nx, nz], { kind: 'orb', speed: 12, range: 10.5, dmg: 1300, rad: 0.7, pierce: true, stun: 1.1, isSuper: true });
        break;
      case 'bouldo': {
        const dd = clamp(d, 1, 6.5);
        const p = this.arena.nearestWalkable(u.x + nx * dd, u.z + nz * dd);
        u.jump = { sx: u.x, sz: u.z, tx: p.x, tz: p.z, t: 0, dur: 0.75 };
        u.rig.squash = 0.3;
        sfx('jump', v);
        break;
      }
      case 'pluma': {
        const dd = clamp(d, 0, 7.5);
        const p = this.arena.nearestWalkable(u.x + nx * dd, u.z + nz * dd);
        this.lob(u, p.x, p.z, 'flower', 0.6, 2.4, (x, z) => {
          sfx('heal', this.vol(u));
          this.fx.burst(x, 0.5, z, [0x7dff9a, 0xff6f91, 0xffd23f], 22, 4, 0.12, 0.7, { g: -3 });
          this.fx.ring(x, z, 2.6, 0x7dff9a, 0.6);
          for (const a of this.units) if (a.team === u.team && a.alive && Math.hypot(a.x - x, a.z - z) < 2.6 + UNIT_R) this.healUnit(a, 600, u);
          this.addArea({ x, z, r: 2.6, dur: 4, tick: 0.5, heal: 260, team: u.team, owner: u, kind: 'heal' });
        });
        break;
      }
    }
  }

  stepJump(u, dt) {
    const j = u.jump;
    j.t += dt;
    const k = Math.min(1, j.t / j.dur);
    u.x = j.sx + (j.tx - j.sx) * k;
    u.z = j.sz + (j.tz - j.sz) * k;
    u.y = Math.sin(k * PI) * 3.2;
    u.move = 0;
    if (k >= 1) {
      u.y = 0;
      u.jump = null;
      u.rig.squash = 0.35;
      this.explode(u, u.x, u.z, 2.5, 1200, [0x9aa2c8, 0x6fcf5a, 0xff8a3d], (t) => {
        const dx = t.x - u.x, dz = t.z - u.z, l = Math.hypot(dx, dz) || 1;
        t.kb = { x: dx / l * 10, z: dz / l * 10, t: 0.22 };
      });
    }
  }

  shoot(u, dir, o) {
    const [dx, dz] = dir;
    const mesh = projMesh(o.kind);
    const p = {
      ...o, owner: u, team: u.team, x: u.x + dx * 0.5, z: u.z + dz * 0.5, y: o.kind === 'pebble' ? 0.7 : 0.9,
      dx, dz, trav: 0, hit: new Set(), mesh, bounce: o.bounce || 0,
    };
    mesh.position.set(p.x, p.y, p.z);
    mesh.rotation.y = Math.atan2(dx, dz);
    this.scene.add(mesh);
    this.projectiles.push(p);
    return p;
  }

  lob(u, tx, tz, kind, dur, h, onLand) {
    const mesh = projMesh(kind);
    const p = { kind, owner: u, team: u.team, x: u.x, z: u.z, y: 1, mesh, lob: { sx: u.x, sz: u.z, tx, tz, t: 0, dur, h }, onLand };
    this.scene.add(mesh);
    this.projectiles.push(p);
  }

  stepProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      let alive = true;
      if (p.lob) {
        const L = p.lob;
        L.t += dt;
        const k = Math.min(1, L.t / L.dur);
        p.x = L.sx + (L.tx - L.sx) * k;
        p.z = L.sz + (L.tz - L.sz) * k;
        p.y = 1 * (1 - k) + Math.sin(k * PI) * L.h + 0.15;
        p.mesh.rotation.x += dt * 7;
        p.mesh.rotation.z += dt * 3;
        if (Math.random() < 0.5) this.fx.spawn(p.x, p.y, p.z, 0, 0.5, 0, 0.1, 0.4, p.kind === 'pot' ? 0xffffff : 0x9dffb4, 0, 1);
        if (k >= 1) { p.onLand(p.x, p.z); alive = false; }
      } else {
        const dist = p.speed * dt;
        const n = Math.max(1, Math.ceil(dist / 0.25));
        const sd = dist / n;
        for (let s = 0; s < n && alive; s++) {
          const nx = p.x + p.dx * sd, nz = p.z + p.dz * sd;
          if (this.arena.solidShotAt(nx, nz)) {
            if (p.bounce > 0) {
              p.bounce--;
              const hx = this.arena.solidShotAt(nx, p.z), hz = this.arena.solidShotAt(p.x, nz);
              if (hx) p.dx = -p.dx;
              if (hz) p.dz = -p.dz;
              if (!hx && !hz) { p.dx = -p.dx; p.dz = -p.dz; }
              p.mesh.rotation.y = Math.atan2(p.dx, p.dz);
              this.fx.burst(p.x, p.y, p.z, 0xfff1d6, 5, 3, 0.08, 0.3);
              sfx('bounce', this.vol(p.owner) * 0.6);
              continue;
            }
            this.fx.burst(p.x, p.y, p.z, HIT_COL[p.kind] || 0xffffff, 6, 3, 0.08, 0.3);
            alive = false;
            break;
          }
          p.x = nx; p.z = nz; p.trav += sd;
          for (const u of this.units) {
            if (u.team === p.team || !u.alive || (u.jump && u.y > 1)) continue;
            if (p.hit.has(u.id)) continue;
            const ddx = u.x - p.x, ddz = u.z - p.z;
            if (ddx * ddx + ddz * ddz < (p.rad + UNIT_R) ** 2) {
              this.damage(u, p.dmg, p.owner, { isSuper: p.isSuper });
              if (p.stun && u.alive) u.stun = p.stun;
              this.fx.burst(p.x, p.y, p.z, HIT_COL[p.kind] || 0xffffff, 7, 3.5, 0.09, 0.35);
              p.hit.add(u.id);
              if (!p.pierce) { alive = false; break; }
            }
          }
          if (alive && p.trav >= p.range) {
            this.fx.puff(p.x, p.y, p.z, 0xffffff, 2, 0.12);
            alive = false;
          }
        }
        if (alive) {
          if (p.kind === 'bolt' || p.kind === 'orb') this.fx.spawn(p.x, p.y, p.z, 0, 0, 0, p.kind === 'orb' ? 0.3 : 0.12, 0.25, 0x3ff2ff, 0, 0);
          if (p.kind === 'dumpling') p.mesh.rotation.z += dt * 10;
          if (p.kind === 'pebble') { p.mesh.rotation.x += dt * 12; p.y = Math.max(0.35, p.y - dt * 0.6); }
          if (p.kind === 'orb' && p.mesh.userData.ring) p.mesh.userData.ring.rotation.z += dt * 8;
        }
      }
      if (!alive) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      } else p.mesh.position.set(p.x, p.y, p.z);
    }
  }

  explode(owner, x, z, r, dmg, colors, onHit) {
    this.fx.burst(x, 0.4, z, colors, 30, 7, 0.16, 0.7, { up: 1, lift: 0.4 });
    this.fx.puff(x, 0.3, z, 0xffffff, 8, 0.4);
    this.fx.ring(x, z, r, 0xffffff, 0.45);
    sfx('boom', this.vol(owner));
    const pd = Math.hypot(this.player.x - x, this.player.z - z);
    if (pd < 8) this.shake = Math.max(this.shake, 0.35 * (1 - pd / 8));
    for (const u of this.units) {
      if (u.team === owner.team || !u.alive) continue;
      if (Math.hypot(u.x - x, u.z - z) < r + UNIT_R) {
        this.damage(u, dmg, owner, { isSuper: true });
        if (onHit && u.alive) onHit(u);
      }
    }
  }

  addArea(a) {
    const M = projMats();
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(a.r, 40), a.kind === 'broth' ? M.broth.clone() : M.heal.clone());
    mesh.rotation.x = -PI / 2;
    mesh.position.set(a.x, 0.05, a.z);
    this.scene.add(mesh);
    this.areas.push({ ...a, t: 0, tickT: 0.25, mesh });
  }

  stepAreas(dt) {
    for (let i = this.areas.length - 1; i >= 0; i--) {
      const a = this.areas[i];
      a.t += dt;
      a.tickT -= dt;
      if (a.tickT <= 0) {
        a.tickT += a.tick;
        for (const u of this.units) {
          if (!u.alive || Math.hypot(u.x - a.x, u.z - a.z) > a.r + UNIT_R * 0.5) continue;
          if (a.dmg && u.team !== a.team) this.damage(u, a.dmg, a.owner, { isSuper: true, small: true });
          if (a.heal && u.team === a.team && u.hp < u.maxHp) this.healUnit(u, a.heal, a.owner);
        }
      }
      if (Math.random() < dt * 14) {
        const an = Math.random() * PI * 2, rr = Math.sqrt(Math.random()) * a.r;
        this.fx.spawn(a.x + Math.cos(an) * rr, 0.1, a.z + Math.sin(an) * rr, 0, 1.2, 0, 0.1, 0.5, a.kind === 'broth' ? 0xffd27a : 0xb5ffc8, 0, 0.5);
      }
      const k = a.t / a.dur;
      a.mesh.material.opacity = (a.kind === 'broth' ? 0.55 : 0.4) * Math.min(1, (1 - k) * 4) * (0.85 + Math.sin(a.t * 6) * 0.15);
      if (a.t >= a.dur) {
        this.scene.remove(a.mesh);
        a.mesh.geometry.dispose();
        a.mesh.material.dispose();
        this.areas.splice(i, 1);
      }
    }
  }

  damage(t, amount, src, o = {}) {
    if (!t.alive || this.state === 'end') return;
    if (t.invuln > 0) { this.floatText(t, 'BLOQUÉ', '#9ff2ff', 0.8); return; }
    amount = Math.round(amount);
    t.hp -= amount;
    t.lastCombat = this.t;
    t.rig.flash(0xffffff, 0.12);
    t.rig.squash = 0.1;
    if (src && src.team !== t.team) {
      src.dmg += amount;
      src.lastCombat = this.t;
      if (!o.isSuper) src.superCharge = Math.min(1, src.superCharge + amount / src.def.superCost);
    }
    const involved = t.isPlayer || (src && src.isPlayer);
    this.floatText(t, String(amount), t.isPlayer ? '#ff5a6e' : src && src.isPlayer ? '#ffffff' : '#ffe0b0', involved ? (o.small ? 0.9 : 1.1) : 0.75);
    if (involved) sfx(t.isPlayer ? 'hurt' : 'hit', 0.8);
    if (t.isPlayer) this.shake = Math.max(this.shake, 0.12);
    if (t.hp <= 0) this.kill(t, src);
  }

  healUnit(t, amount, src) {
    if (!t.alive) return;
    const h = Math.min(t.maxHp - t.hp, amount);
    if (h <= 0) return;
    t.hp += h;
    if (src) {
      src.heal += h;
      if (src !== t) src.superCharge = Math.min(1, src.superCharge + h / src.def.superCost * 0.4);
    }
    this.floatText(t, '+' + Math.round(h), '#7dff9a', 0.9);
  }

  kill(t, src) {
    t.alive = false;
    t.hp = 0;
    t.deaths++;
    t.respawnT = 4;
    t.jump = null;
    t.y = 0;
    t.obj.visible = false;
    this.fx.burst(t.x, 0.9, t.z, [TEAM_HEX[t.team], 0xffffff, 0xffe23d], 26, 6, 0.15, 0.8, { up: 1.2 });
    this.fx.puff(t.x, 0.6, t.z, 0xffffff, 8, 0.4);
    this.fx.ring(t.x, t.z, 1.8, TEAM_HEX[t.team], 0.5);
    sfx('ko', t.isPlayer || (src && src.isPlayer) ? 1 : this.vol(t));
    if (src && src.team !== t.team) {
      src.kills++;
      if (this.mode === 'ko') this.score[src.team]++;
    }
    this.addFeed(src, t);
    if (t.isPlayer) this.shake = 0.3;
  }

  respawn(u) {
    const sp = this.arena.spawns[u.team][u.spawnIdx];
    Object.assign(u, { x: sp.x, z: sp.z, y: 0, hp: u.maxHp, ammo: 3, alive: true, invuln: 2.5, stun: 0, jump: null, lastCombat: this.t, face: u.team === 0 ? PI : 0, faceTarget: u.team === 0 ? PI : 0 });
    u.kb.t = 0;
    u.obj.visible = true;
    u.rig.hop = 1;
    this.fx.burst(u.x, 0.4, u.z, [TEAM_HEX[u.team], 0xffffff], 16, 4, 0.12, 0.6);
    if (u.brain) { u.brain.path = []; u.brain.target = null; }
  }

  addFeed(src, t) {
    const el = document.createElement('div');
    el.className = 'feed-item';
    const name = (u) => `<b style="color:${u.isPlayer ? '#9dff6a' : TEAM_CSS[u.team]}">${u.name.replace(/[<>&]/g, '')}</b>`;
    el.innerHTML = src && src.team !== t.team ? `${name(src)}<span class="ko">K.O.</span>${name(t)}` : `${name(t)}<span class="ko">K.O.</span>`;
    this.ui.killfeed.prepend(el);
    while (this.ui.killfeed.children.length > 4) this.ui.killfeed.lastChild.remove();
    setTimeout(() => el.classList.add('out'), 3800);
    setTimeout(() => el.remove(), 4300);
  }

  floatText(u, txt, col, size = 1) {
    this.texts.push({ x: u.x + (Math.random() - 0.5) * 0.5, y: BAR_Y[u.heroId] + 0.1 + u.y, z: u.z, txt, col, size, t: 0, life: 0.9 });
    if (this.texts.length > 40) this.texts.shift();
  }

  // --- Visuels ---
  syncVisuals(dt) {
    for (const u of this.units) {
      if (!u.alive) continue;
      u.obj.position.set(u.x, 0, u.z);
      u.rig.root.position.y = u.y;
      u.rig.root.rotation.y = u.face;
      u.rig.update(dt, { move: u.move });
      if (u.ground.userData.arrow) u.ground.userData.arrow.rotation.y = u.face;
      u.ground.scale.setScalar(u.jump ? 1 - Math.sin(Math.min(1, u.jump.t / u.jump.dur) * PI) * 0.4 : 1);
      u.shield.visible = u.invuln > 0;
      if (u.shield.visible) u.shield.material.opacity = 0.18 + Math.sin(this.t * 12) * 0.06;
      u.stars.visible = u.stun > 0;
      if (u.stars.visible) u.stars.rotation.y += dt * 6;
      if (u.team !== 0) u.obj.visible = this.visibleTo(u, 0);
      else u.ring.material.opacity = u.inBush ? 0.45 + Math.sin(this.t * 5) * 0.15 : 0.9;
      if (u.isPlayer && u.superCharge >= 1) u.ring.material.color.setHex(Math.sin(this.t * 8) > 0 ? 0xffe23d : PLAYER_HEX);
      else if (u.isPlayer) u.ring.material.color.setHex(PLAYER_HEX);
    }
    if (this.zoneMesh) {
      const col = [0x3db6ff, 0xff4057, 0xffd23f][this.zoneState] ?? 0xffffff;
      this.zoneMesh.ring.material.color.setHex(col);
      this.zoneMesh.disc.material.color.setHex(col);
      this.zoneMesh.disc.material.opacity = 0.14 + Math.sin(this.t * 4) * 0.05;
      this.zoneMesh.ring.rotation.z += dt * 0.5;
    }
  }

  updateCamera(dt) {
    const p = this.player;
    const asp = this.app.w / this.app.h;
    const f = asp < 0.8 ? 1.5 : asp < 1.3 ? 1.18 : 1;
    const tx = clamp(p.x, -4.2, 4.2), tz = clamp(p.z, -12.5, 13.5);
    const want = new THREE.Vector3(tx, 15 * f, tz + 9.6 * f);
    if (!this.camPos) this.camPos = want.clone();
    this.camPos.lerp(want, 1 - Math.exp(-dt * 6));
    this.shake = Math.max(0, this.shake - dt * 1.2);
    const s = this.shake * this.shake * 2;
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * s, this.camPos.y + (Math.random() - 0.5) * s, this.camPos.z);
    this.camera.lookAt(this.camPos.x, 0, this.camPos.z - 9.6 * f - 0.8);
  }

  updateIndicators() {
    const p = this.player, inp = this.app.input;
    const live = this.state === 'play' && p.alive && !p.jump;
    let a = null, s = null, sMag = 1;
    if (live) {
      if (inp.isTouch) {
        if (inp.atk.id !== null && inp.atk.mag >= 0.25) a = { dx: inp.atk.dx, dz: inp.atk.dy };
        if (inp.sup.id !== null && inp.sup.mag >= 0.25 && p.superCharge >= 1) { s = { dx: inp.sup.dx, dz: inp.sup.dy }; sMag = Math.max(0.3, inp.sup.mag); }
      } else if (this.mouseW) {
        const dx = this.mouseW.x - p.x, dz = this.mouseW.z - p.z, l = Math.hypot(dx, dz) || 1;
        if (inp.mouse.right && p.superCharge >= 1) { s = { dx: dx / l, dz: dz / l }; sMag = Math.min(1, l / p.def.super.range); }
        else a = { dx: dx / l, dz: dz / l };
      }
    }
    this.indAtk.visible = !!a && !s;
    if (a) { this.indAtk.position.set(p.x, 0, p.z); this.indAtk.rotation.y = Math.atan2(a.dx, a.dz); }
    this.indSup.visible = !!s;
    if (this.indSupTarget) this.indSupTarget.visible = !!s;
    if (s) {
      this.indSup.position.set(p.x, 0, p.z);
      this.indSup.rotation.y = Math.atan2(s.dx, s.dz);
      if (this.indSupTarget) {
        const dist = p.def.super.range * sMag;
        const t = { x: p.x + s.dx * dist, z: p.z + s.dz * dist };
        this.indSupTarget.position.set(t.x, 0, t.z);
        this.indSupLine.scale.set(1, 1, Math.max(0.01, dist - 0.3));
      }
    }
  }

  updateHud() {
    const ui = this.ui, p = this.player;
    const tl = Math.max(0, Math.ceil(this.timeLeft));
    const ts = `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`;
    if (ui.timer.textContent !== ts) ui.timer.textContent = ts;
    ui.timer.classList.toggle('urgent', this.timeLeft <= 10 && this.state === 'play');
    if (this.mode === 'ko') {
      ui.scoreBlue.textContent = this.score[0];
      ui.scoreRed.textContent = this.score[1];
    } else {
      ui.zoneBlue.style.width = this.zoneP[0] + '%';
      ui.zoneRed.style.width = this.zoneP[1] + '%';
      ui.zoneBlueN.textContent = Math.floor(this.zoneP[0]) + '%';
      ui.zoneRedN.textContent = Math.floor(this.zoneP[1]) + '%';
      ui.zoneStatus.textContent = ['ZONE BLEUE', 'ZONE ROUGE', 'ZONE DISPUTÉE !'][this.zoneState] ?? 'ZONE LIBRE';
      ui.zoneStatus.dataset.state = this.zoneState;
    }
    const ch = Math.round(p.superCharge * 100);
    ui.superBtn.style.setProperty('--charge', ch + '%');
    ui.superBtn.classList.toggle('ready', p.superCharge >= 1);
    ui.superChip.style.setProperty('--charge', ch + '%');
    ui.superChip.classList.toggle('ready', p.superCharge >= 1);
    ui.respawn.hidden = p.alive || this.state !== 'play';
    if (!p.alive) ui.respawnN.textContent = Math.max(1, Math.ceil(p.respawnT));
  }

  drawOverlay(dt) {
    const ctx = this.app.octx, W = this.app.w, H = this.app.h;
    ctx.setTransform(this.app.dpr, 0, 0, this.app.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sc = clamp(Math.min(W, H) / 640, 0.75, 1.25);
    const v = new THREE.Vector3();
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const u of this.units) {
      if (!u.alive || !u.obj.visible) continue;
      v.set(u.x, BAR_Y[u.heroId] + u.y, u.z).project(this.camera);
      if (v.z > 1) continue;
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const bw = 66 * sc, bh = 12 * sc;
      const col = u.isPlayer ? '#7dff4f' : TEAM_CSS[u.team];
      ctx.font = `800 ${12.5 * sc}px "Baloo 2", "Trebuchet MS", sans-serif`;
      ctx.lineWidth = 3.5 * sc;
      ctx.strokeStyle = '#1b1236';
      ctx.strokeText(u.name, x, y - bh - 4 * sc);
      ctx.fillStyle = u.isPlayer ? '#d9ffc4' : u.team === 0 ? '#d6f0ff' : '#ffd6dc';
      ctx.fillText(u.name, x, y - bh - 4 * sc);
      rr(ctx, x - bw / 2 - 2, y - bh, bw + 4, bh + 4, 5 * sc, '#1b1236');
      const f = clamp(u.hp / u.maxHp, 0, 1);
      rr(ctx, x - bw / 2, y - bh + 2, bw, bh, 4 * sc, 'rgba(255,255,255,0.15)');
      if (f > 0) rr(ctx, x - bw / 2, y - bh + 2, bw * f, bh, 4 * sc, col);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x - bw / 2 + 3, y - bh + 3, Math.max(0, bw * f - 6), bh * 0.28);
      ctx.font = `800 ${9.5 * sc}px "Baloo 2", "Trebuchet MS", sans-serif`;
      ctx.lineWidth = 2.6 * sc;
      ctx.strokeText(Math.ceil(u.hp), x, y + 1 - bh * 0.05 + 2 * sc);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(Math.ceil(u.hp), x, y + 1 - bh * 0.05 + 2 * sc);
      if (u.isPlayer) {
        const sw = (bw - 4) / 3;
        for (let i = 0; i < 3; i++) {
          const fill = clamp(u.ammo - i, 0, 1);
          const sx = x - bw / 2 + i * (sw + 2) + 1;
          rr(ctx, sx - 1, y + 5 * sc, sw + 2, 7 * sc, 3, '#1b1236');
          if (fill > 0) rr(ctx, sx, y + 6 * sc, sw * fill, 5 * sc, 2, fill >= 1 ? '#ff9b2f' : '#b86a20');
        }
        if (u.superCharge >= 1) {
          ctx.beginPath();
          ctx.arc(x - bw / 2 - 12 * sc, y - bh / 2 + 2, 8 * sc, 0, PI * 2);
          ctx.fillStyle = '#ffd23f';
          ctx.fill();
          ctx.lineWidth = 2.5 * sc;
          ctx.stroke();
        }
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      if (t.t >= t.life) { this.texts.splice(i, 1); continue; }
      v.set(t.x, t.y, t.z).project(this.camera);
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H - t.t * 55 * sc;
      const pop = t.t < 0.12 ? 0.6 + t.t / 0.12 * 0.6 : 1.2 - Math.min(0.2, (t.t - 0.12) * 0.6);
      ctx.globalAlpha = Math.min(1, (t.life - t.t) / 0.3);
      ctx.font = `800 ${17 * sc * t.size * pop}px "Luckiest Guy", "Baloo 2", sans-serif`;
      ctx.lineWidth = 4 * sc;
      ctx.strokeStyle = '#1b1236';
      ctx.strokeText(t.txt, x, y);
      ctx.fillStyle = t.col;
      ctx.fillText(t.txt, x, y);
      ctx.globalAlpha = 1;
    }
  }

  render(renderer) {
    setOutline(2.1, renderer);
    renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 46 : 36;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m === outlineMaterial) continue;
        if (m.map) m.map.dispose();
        m.dispose();
      }
    });
    PM = null;
  }
}

function rr(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), h, Math.min(r, h / 2, Math.max(0, w) / 2));
  ctx.fillStyle = fill;
  ctx.fill();
}
