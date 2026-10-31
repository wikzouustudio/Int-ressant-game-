// Match simulation: brawlers, bot AI, projectiles, supers, objectives, camera and HUD drawing.
import * as THREE from 'three';
import { HEROES, BOT_NAMES, buildHeroModel, animateHero, setFlash, setOpacity } from './heroes.js';
import { buildArena, SPAWNS, tileX, tileZ, colOf, rowOf, W, H } from './maps.js';
import { Particles, Debris, Rings } from './fx.js';
import { sfx } from './audio.js';
import { toon } from './toon.js';

const RADIUS = 0.38;
const TEAM_COL = ['#2f8bff', '#ff3d5a'];
const MATCH_TIME = 150;
const RESPAWN = 4;
const ZONE_R = 2.6;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const angLerp = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fanGeometry(arc, seg = 28) {
  const p = [];
  for (let i = 0; i < seg; i++) {
    const a0 = -arc / 2 + (arc * i) / seg;
    const a1 = -arc / 2 + (arc * (i + 1)) / seg;
    p.push(0, 0, 0, Math.sin(a1), 0, Math.cos(a1), Math.sin(a0), 0, Math.cos(a0));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return g;
}
function rectGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 1, 0.5, 0, 0, -0.5, 0, 0, -0.5, 0, 1, 0.5, 0, 1], 3));
  return g;
}

class Brawler {
  constructor(match, hero, team, isPlayer, name, level, slot) {
    this.m = match;
    this.hero = hero;
    this.team = team;
    this.isPlayer = isPlayer;
    this.name = name;
    this.level = level;
    this.slot = slot;
    const mul = 1 + (level - 1) * 0.06;
    this.maxHp = Math.round(hero.hp * mul);
    this.dmgMul = mul;
    this.hp = this.maxHp;
    this.P = buildHeroModel(hero.id);
    this.P.baseScale = 1.32;
    this.root = this.P.root;
    this.x = 0; this.z = 0; this.vx = 0; this.vz = 0;
    this.face = team === 0 ? Math.PI : 0;
    this.faceLock = 0;
    this.ammo = 3;
    this.atkCd = 0;
    this.superCharge = 0;
    this.alive = true;
    this.respawnT = 0;
    this.shield = 0;
    this.lastHurt = -10;
    this.lastAttack = -10;
    this.regenTick = 0;
    this.reveal = 0;
    this.inBush = false;
    this.hiddenFromPlayer = false;
    this.fade = 1;
    this.kb = null;
    this.dash = null;
    this.leap = null;
    this.deathT = 0;
    this.spawnT = 0;
    this.flash = 0;
    this.kills = 0; this.deaths = 0; this.damage = 0; this.healed = 0; this.zoneTime = 0;
    this.rustle = 0;
    this.ai = { retarget: 0, target: null, path: null, pathT: 0, goalKey: -1, strafe: 1, strafeT: 0, fireT: rand(0.6, 1.4), roam: null, roamT: 0, stuckT: 0, lx: 0, lz: 0, unstuck: 0, ux: 0, uz: 0, superT: 0 };

    // ground ring & extras
    const ringCol = isPlayer ? '#4dff8f' : TEAM_COL[team];
    this.ring = new THREE.Mesh(match.G.teamRing, new THREE.MeshBasicMaterial({ color: ringCol, transparent: true, opacity: 0.9, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.ring.renderOrder = 1;
    this.root.add(this.ring);
    if (isPlayer) {
      const arrow = new THREE.Mesh(match.G.arrow, this.ring.material);
      arrow.rotation.x = -Math.PI / 2;
      arrow.position.set(0, 0.03, 0.72);
      this.root.add(arrow);
    }
    this.aura = new THREE.Mesh(match.G.aura, new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.aura.rotation.x = -Math.PI / 2;
    this.aura.position.y = 0.04;
    this.root.add(this.aura);
    this.bubble = new THREE.Mesh(match.G.bubble, new THREE.MeshBasicMaterial({ color: '#8ff7ff', transparent: true, opacity: 0.25, depthWrite: false }));
    this.bubble.position.y = 0.95;
    this.bubble.scale.setScalar(1.2);
    this.bubble.visible = false;
    this.root.add(this.bubble);
    match.scene.add(this.root);
  }
  get hpFrac() {
    return this.hp / this.maxHp;
  }
}

export class Match {
  constructor(o) {
    this.o = o;
    this.ui = o.ui;
    this.input = o.input;
    this.mode = o.mode;
    this.mapDef = o.map;
    this.scene = new THREE.Scene();
    this.arena = buildArena(o.map);
    const th = this.arena.theme;
    this.scene.background = new THREE.Color(th.sky);
    this.scene.fog = new THREE.Fog(th.sky, 30, 62);
    this.scene.add(this.arena.group);

    const hemi = new THREE.HemisphereLight(th.hemiSky, th.hemiGround, 1.55);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(th.sun, 2.5);
    sun.castShadow = true;
    const sm = o.lowSpec ? 1024 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    const sc = sun.shadow.camera;
    sc.left = -17; sc.right = 17; sc.top = 17; sc.bottom = -17; sc.near = 1; sc.far = 60;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 160);
    this.camTarget = new THREE.Vector3(0, 0, 12);
    this.camDist = 19.5;
    this.shake = 0;

    this.fxAdd = new Particles(900, true);
    this.fxPuff = new Particles(600, false);
    this.debris = new Debris(160);
    this.rings = new Rings(this.scene);
    this.scene.add(this.fxAdd.points, this.fxPuff.points, this.debris.mesh);

    // shared geometry/materials
    const G = (this.G = {
      teamRing: new THREE.RingGeometry(0.44, 0.56, 40),
      aura: new THREE.RingGeometry(0.3, 0.75, 40),
      arrow: (() => {
        const s = new THREE.Shape();
        s.moveTo(0, 0.16); s.lineTo(0.13, -0.04); s.lineTo(-0.13, -0.04); s.lineTo(0, 0.16);
        const g = new THREE.ShapeGeometry(s);
        return g;
      })(),
      bubble: new THREE.SphereGeometry(0.85, 24, 16),
      pellet: new THREE.SphereGeometry(0.12, 10, 8),
      bolt: new THREE.CapsuleGeometry(0.09, 0.55, 4, 8).rotateX(Math.PI / 2),
      beam: new THREE.CapsuleGeometry(0.3, 1.6, 6, 12).rotateX(Math.PI / 2),
      orb: new THREE.IcosahedronGeometry(0.22, 1),
      tracer: new THREE.CapsuleGeometry(0.065, 0.36, 3, 6).rotateX(Math.PI / 2),
      rocket: new THREE.CapsuleGeometry(0.1, 0.32, 4, 8).rotateX(Math.PI / 2),
      bomb: new THREE.SphereGeometry(0.2, 14, 10),
      mega: new THREE.SphereGeometry(0.42, 18, 12),
      seed: new THREE.IcosahedronGeometry(0.24, 1),
      shadow: new THREE.CircleGeometry(0.3, 20),
      target: new THREE.RingGeometry(0.85, 1, 40),
      slash: new THREE.TorusGeometry(1.25, 0.09, 4, 26, 1.9),
      rect: rectGeometry(),
      circle: new THREE.CircleGeometry(1, 40),
      dot: new THREE.SphereGeometry(0.07, 8, 6),
      petal: new THREE.SphereGeometry(0.28, 10, 8),
    });
    this.Mt = {
      pellet: new THREE.MeshBasicMaterial({ color: '#ffe0a0' }),
      star: new THREE.MeshBasicMaterial({ color: '#f3e4ff' }),
      beam: new THREE.MeshBasicMaterial({ color: '#f4e6ff' }),
      orb: new THREE.MeshBasicMaterial({ color: '#d8ffe9' }),
      tracer: new THREE.MeshBasicMaterial({ color: '#fff6c4' }),
      rocket: toon('#ff5a4a'),
      bomb: toon('#2b2b3a', { rim: 0.6 }),
      seed: toon('#5fe08a', { rim: 0.5 }),
      shadow: new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false }),
      slash: new THREE.MeshBasicMaterial({ color: '#bfe9ff', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    };

    this.brawlers = [];
    this.shots = [];
    this.zones = [];
    this.timers = [];
    this.transients = [];
    this.texts = [];
    this.score = [0, 0];
    this.zoneProg = [0, 0];
    this.zoneCtrl = -1;
    this.t = 0;
    this.timeLeft = MATCH_TIME;
    this.overtime = false;
    this.state = 'intro';
    this.timeScale = 1;
    this.slowmo = 0;
    this.result = null;
    this.endT = 0;
    this.lastSuperReady = false;

    this.buildAim(o.heroId);
    this.spawnTeams(o.heroId, o.level, o.playerName || 'Toi');
    if (this.mode.id === 'zone') this.buildZone();
    this.snapCamera(true);
  }

  // ------------------------------------------------------------------ setup
  spawnTeams(heroId, level, playerName) {
    const ids = HEROES.map((h) => h.id);
    const names = shuffle(BOT_NAMES.slice());
    const others = shuffle(ids.filter((i) => i !== heroId));
    const blue = [heroId, others[0], others[1]];
    const red = shuffle(ids.slice()).slice(0, 3);
    const mk = (id, team, slot, isPlayer) => {
      const hero = HEROES.find((h) => h.id === id);
      const lv = isPlayer ? level : clamp(level + Math.round(rand(-1, 1)), 1, 7);
      const b = new Brawler(this, hero, team, isPlayer, isPlayer ? playerName : names.pop(), lv, slot);
      this.placeAtSpawn(b);
      this.brawlers.push(b);
      return b;
    };
    this.player = mk(blue[0], 0, 0, true);
    mk(blue[1], 0, 1, false);
    mk(blue[2], 0, 2, false);
    red.forEach((id, i) => mk(id, 1, i, false));
    this.teams = [this.brawlers.filter((b) => b.team === 0), this.brawlers.filter((b) => b.team === 1)];
  }

  placeAtSpawn(b) {
    const [c, r] = SPAWNS[b.team][b.slot];
    b.x = tileX(c);
    b.z = tileZ(r);
    b.face = b.team === 0 ? Math.PI : 0;
    b.root.rotation.y = b.face;
    b.root.position.set(b.x, 0, b.z);
  }

  buildZone() {
    const g = new THREE.CircleGeometry(ZONE_R, 64);
    this.zoneUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#ffffff') } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.zoneUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `
        uniform float uTime; uniform vec3 uColor; varying vec2 vP;
        void main(){
          float r = length(vP) / ${ZONE_R.toFixed(2)};
          float a = atan(vP.y, vP.x);
          float dash = step(0.5, fract(a * 6.0 / 3.14159 + uTime * 0.25));
          float border = smoothstep(0.88, 0.9, r) * (1.0 - smoothstep(0.98, 1.0, r));
          float fill = (1.0 - smoothstep(0.86, 0.9, r)) * (0.16 + 0.06 * sin(uTime * 3.0 + r * 9.0));
          float alpha = border * mix(0.45, 0.95, dash) + fill;
          gl_FragColor = vec4(uColor, alpha);
          #include <colorspace_fragment>
        }`,
    });
    this.zoneMesh = new THREE.Mesh(g, m);
    this.zoneMesh.rotation.x = -Math.PI / 2;
    this.zoneMesh.position.y = 0.025;
    this.zoneMesh.renderOrder = 1;
    this.scene.add(this.zoneMesh);
  }

  buildAim(heroId) {
    const hero = HEROES.find((h) => h.id === heroId);
    const mat = (c, op) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
    const mk = (geo, kind) => {
      const m = new THREE.Mesh(geo, mat(kind === 'super' ? '#ffd23f' : '#ffffff', kind === 'super' ? 0.42 : 0.34));
      m.position.y = 0.04;
      m.renderOrder = 3;
      m.visible = false;
      this.scene.add(m);
      return m;
    };
    const fanFor = (spec) => fanGeometry(spec.type === 'melee' ? spec.arc : (spec.spread || 0.5) + 0.12);
    const a = {};
    for (const kind of ['attack', 'super']) {
      const spec = kind === 'attack' ? hero.attack : hero.super;
      a[kind] = {
        rect: mk(this.G.rect, kind),
        fan: mk(fanFor(spec), kind),
        circle: mk(this.G.circle, kind),
        ring: mk(this.G.target, kind),
        dots: Array.from({ length: 9 }, () => mk(this.G.dot, kind)),
      };
    }
    this.aimViz = a;
  }

  // ------------------------------------------------------------------ helpers
  rayClear(x0, z0, x1, z1, blocks = 'shot') {
    const dx = x1 - x0, dz = z1 - z0;
    const d = Math.hypot(dx, dz);
    const n = Math.ceil(d / 0.2);
    const f = blocks === 'shot' ? this.arena.blocksShot : this.arena.blocksMove;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (f(colOf(x0 + dx * t), rowOf(z0 + dz * t))) return false;
    }
    return true;
  }
  walkClear(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0;
    const d = Math.hypot(dx, dz) || 1;
    const px = (-dz / d) * 0.32, pz = (dx / d) * 0.32;
    return this.rayClear(x0 + px, z0 + pz, x1 + px, z1 + pz, 'move') && this.rayClear(x0 - px, z0 - pz, x1 - px, z1 - pz, 'move');
  }
  clipLength(x, z, dx, dz, max) {
    for (let s = 0.1; s < max; s += 0.1) {
      if (this.arena.blocksShot(colOf(x + dx * s), rowOf(z + dz * s))) return s;
    }
    return max;
  }
  collide(b) {
    const r = RADIUS;
    const c0 = colOf(b.x - r), c1 = colOf(b.x + r), r0 = rowOf(b.z - r), r1 = rowOf(b.z + r);
    for (let rr = r0; rr <= r1; rr++) {
      for (let cc = c0; cc <= c1; cc++) {
        if (!this.arena.blocksMove(cc, rr)) continue;
        const tx = tileX(cc), tz = tileZ(rr);
        const nx = clamp(b.x, tx - 0.5, tx + 0.5), nz = clamp(b.z, tz - 0.5, tz + 0.5);
        const ddx = b.x - nx, ddz = b.z - nz;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 < r * r) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            b.x += (ddx / d) * (r - d);
            b.z += (ddz / d) * (r - d);
          } else {
            const px = b.x - tx, pz = b.z - tz;
            if (Math.abs(px) > Math.abs(pz)) b.x = tx + Math.sign(px || 1) * (0.5 + r);
            else b.z = tz + Math.sign(pz || 1) * (0.5 + r);
          }
        }
      }
    }
  }
  move(b, dx, dz) {
    b.x += dx;
    this.collide(b);
    b.z += dz;
    this.collide(b);
  }
  nearestWalkable(x, z) {
    let c = clamp(colOf(x), 0, W - 1), r = clamp(rowOf(z), 0, H - 1);
    if (!this.arena.blocksMove(c, r)) return { x, z };
    for (let rad = 1; rad < 6; rad++) {
      let best = null, bd = 1e9;
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          const cc = c + dc, rr = r + dr;
          if (this.arena.blocksMove(cc, rr)) continue;
          const d = Math.hypot(tileX(cc) - x, tileZ(rr) - z);
          if (d < bd) { bd = d; best = { x: tileX(cc), z: tileZ(rr) }; }
        }
      }
      if (best) return best;
    }
    return { x, z };
  }
  enemiesOf(b) {
    return this.teams[1 - b.team];
  }
  visibleTo(e, team) {
    if (e.team === team) return true;
    if (!e.alive) return false;
    if (!e.inBush || e.reveal > 0) return true;
    for (const o of this.teams[team]) {
      if (o.alive && Math.hypot(o.x - e.x, o.z - e.z) < 2.6) return true;
    }
    return false;
  }
  nearCam(x, z, r = 15) {
    return Math.hypot(x - this.camTarget.x, z - this.camTarget.z) < r;
  }
  schedule(delay, fn) {
    this.timers.push({ t: delay, fn });
  }

  // ------------------------------------------------------------------ pathfinding (A* on tiles)
  findPath(sx, sz, gx, gz) {
    const sc = clamp(colOf(sx), 0, W - 1), sr = clamp(rowOf(sz), 0, H - 1);
    const g = this.nearestWalkable(gx, gz);
    const gc = clamp(colOf(g.x), 0, W - 1), gr = clamp(rowOf(g.z), 0, H - 1);
    const N = W * H;
    const gs = new Float32Array(N).fill(1e9);
    const from = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const open = [];
    const s = sr * W + sc, goal = gr * W + gc;
    gs[s] = 0;
    open.push([Math.hypot(gc - sc, gr - sr), s]);
    const bm = this.arena.blocksMove;
    let iter = 0;
    while (open.length && iter++ < 900) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const cur = open[bi][1];
      open[bi] = open[open.length - 1];
      open.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === goal) break;
      const cc = cur % W, cr = (cur / W) | 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const nc = cc + dc, nr = cr + dr;
          if (bm(nc, nr)) continue;
          if (dc && dr && (bm(cc + dc, cr) || bm(cc, cr + dr))) continue;
          const ni = nr * W + nc;
          if (closed[ni]) continue;
          const ng = gs[cur] + (dc && dr ? 1.414 : 1);
          if (ng < gs[ni]) {
            gs[ni] = ng;
            from[ni] = cur;
            open.push([ng + Math.hypot(gc - nc, gr - nr), ni]);
          }
        }
      }
    }
    if (from[goal] === -1 && goal !== s) return null;
    const path = [];
    let cur = goal;
    while (cur !== -1 && cur !== s) {
      path.push({ x: tileX(cur % W), z: tileZ((cur / W) | 0) });
      cur = from[cur];
    }
    path.reverse();
    return path;
  }

  // ------------------------------------------------------------------ combat
  muzzle(b, ang, fwd = 0.55, y = 0.78) {
    return { x: b.x + Math.sin(ang) * fwd, y, z: b.z + Math.cos(ang) * fwd };
  }

  tryAttack(b, dx, dz, mag) {
    if (!b.alive || b.ammo < 1 || b.atkCd > 0 || b.dash || b.leap || b.kb) {
      if (b.isPlayer && b.ammo < 1) sfx('empty');
      return false;
    }
    const a = b.hero.attack;
    const ang = Math.atan2(dx, dz);
    b.ammo -= 1;
    b.atkCd = a.type === 'burst' ? a.count * a.interval + 0.18 : a.type === 'melee' ? 0.32 : 0.38;
    b.lastAttack = this.t;
    b.reveal = 1.1;
    b.face = ang;
    b.faceLock = 0.5;
    b.P.st.atk = 1;
    b.P.st.squash = 0.08;
    const audible = b.isPlayer || this.nearCam(b.x, b.z, 11);
    if (audible) sfx('shoot_' + b.hero.id);
    const dm = b.dmgMul;
    const mz = this.muzzle(b, ang);
    switch (a.type) {
      case 'spread':
        for (let i = 0; i < a.count; i++) {
          const an = ang + (i / (a.count - 1) - 0.5) * a.spread + rand(-0.03, 0.03);
          this.spawnBullet(b, an, { speed: a.speed * rand(0.95, 1.05), range: a.range, dmg: a.dmg * dm, radius: a.radius, style: 'pellet', charge: a.charge });
        }
        this.flashAt(mz.x, mz.y, mz.z, '#ffb347', 1.1);
        if (b.isPlayer) this.shake = Math.max(this.shake, 0.12);
        break;
      case 'single':
        this.spawnBullet(b, ang, { speed: a.speed, range: a.range, dmg: a.dmg * dm, radius: a.radius, style: 'star', charge: a.charge });
        this.flashAt(mz.x, mz.y, mz.z, '#c88dff', 0.9);
        break;
      case 'burst':
        for (let i = 0; i < a.count; i++) {
          this.schedule(i * a.interval, () => {
            if (!b.alive) return;
            const an = ang + rand(-a.spread, a.spread);
            const m2 = this.muzzle(b, an, 0.75);
            this.spawnBullet(b, an, { speed: a.speed, range: a.range, dmg: a.dmg * dm, radius: a.radius, style: 'tracer', charge: a.charge, from: m2 });
            this.flashAt(m2.x, m2.y, m2.z, '#ffd23f', 0.55);
            if (i > 0 && audible) sfx('shoot_bolt');
          });
        }
        break;
      case 'lob': {
        const dist = clamp(mag * a.range, 1.2, a.range);
        this.spawnLob(b, b.x + dx * dist, b.z + dz * dist, { dmg: a.dmg * dm, aoe: a.aoe, flight: a.flight * (0.6 + 0.4 * dist / a.range), style: 'bomb', charge: a.charge });
        break;
      }
      case 'melee':
        this.doMelee(b, ang, a.range, a.arc, a.dmg * dm, a.charge);
        break;
      case 'orb':
        this.spawnBullet(b, ang, { speed: a.speed, range: a.range, dmg: a.dmg * dm, radius: a.radius, style: 'orb', pierce: true, heal: a.heal * dm, charge: a.charge });
        this.flashAt(mz.x, 0.9, mz.z, '#7dffb8', 0.8);
        break;
    }
    return true;
  }

  trySuper(b, dx, dz, mag) {
    if (!b.alive || b.superCharge < 1 || b.dash || b.leap || b.kb) return false;
    const s = b.hero.super;
    const ang = Math.atan2(dx, dz);
    b.superCharge = 0;
    b.reveal = 1.4;
    b.face = ang;
    b.faceLock = 0.6;
    b.lastAttack = this.t;
    b.P.st.sup = 1;
    b.P.st.atk = 1;
    b.P.st.squash = 0.15;
    if (b.isPlayer || this.nearCam(b.x, b.z, 12)) sfx('super');
    const dm = b.dmgMul;
    this.rings.emit(b.x, b.z, 0.3, 1.6, '#ffd23f', 0.35);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      this.fxAdd.emit(b.x, 0.6, b.z, Math.cos(a) * 4, rand(1, 3), Math.sin(a) * 4, 0.35, 0.35, 0.05, '#ffd23f', 0, 3);
    }
    switch (s.type) {
      case 'charge':
        b.dash = { dx, dz, t: s.range / 15, speed: 15, hit: new Set(), dmg: s.dmg * dm };
        if (b.isPlayer || this.nearCam(b.x, b.z)) sfx('dash');
        break;
      case 'beam': {
        this.spawnBullet(b, ang, { speed: s.speed, range: s.range, dmg: s.dmg * dm, radius: 0.45, style: 'beam', pierce: true, wallPass: true, superShot: true });
        const mz = this.muzzle(b, ang, 0.9);
        this.flashAt(mz.x, mz.y, mz.z, '#c88dff', 2);
        if (b.isPlayer) this.shake = Math.max(this.shake, 0.25);
        break;
      }
      case 'megabomb': {
        const dist = clamp(mag * s.range, 1.5, s.range);
        this.spawnLob(b, b.x + dx * dist, b.z + dz * dist, { dmg: s.dmg * dm, aoe: s.aoe, flight: s.flight, style: 'mega', breakWalls: true, superShot: true });
        break;
      }
      case 'leap': {
        const dist = clamp(mag * s.range, 1.5, s.range);
        const t = this.nearestWalkable(clamp(b.x + dx * dist, -W / 2 + 0.6, W / 2 - 0.6), clamp(b.z + dz * dist, -H / 2 + 0.6, H / 2 - 0.6));
        b.leap = { sx: b.x, sz: b.z, tx: t.x, tz: t.z, t: 0, T: 0.55, dmg: s.dmg * dm, aoe: s.aoe };
        if (b.isPlayer || this.nearCam(b.x, b.z)) sfx('whoosh');
        break;
      }
      case 'bloom': {
        const dist = clamp(mag * s.range, 0.5, s.range);
        this.spawnLob(b, b.x + dx * dist, b.z + dz * dist, { dmg: 0, aoe: s.aoe, flight: 0.6, style: 'seed', superShot: true, bloom: { heal: s.heal * dm, dmg: s.dmg * dm, r: s.aoe, dur: s.duration } });
        break;
      }
      case 'barrage':
        for (let i = 0; i < s.count; i++) {
          this.schedule(i * 0.07, () => {
            if (!b.alive) return;
            const an = ang + rand(-s.spread / 2, s.spread / 2);
            const mz = { x: b.x + Math.sin(ang) * 0.1 + Math.cos(ang) * 0.3, y: 1.2, z: b.z + Math.cos(ang) * 0.1 - Math.sin(ang) * 0.3 };
            this.spawnBullet(b, an, { speed: 13, range: s.range * rand(0.55, 1), dmg: s.dmg * dm, radius: 0.18, style: 'rocket', explode: s.aoe, superShot: true, from: mz });
            this.flashAt(mz.x, mz.y, mz.z, '#ff8a3d', 0.6);
            if (b.isPlayer || this.nearCam(b.x, b.z)) sfx('shoot_pip');
          });
        }
        break;
    }
    return true;
  }

  flashAt(x, y, z, color, size) {
    this.fxAdd.emit(x, y, z, 0, 0, 0, 0.09, size, size * 0.3, color);
    this.fxAdd.emit(x, y, z, 0, 0, 0, 0.06, size * 0.6, 0.1, '#ffffff');
    for (let i = 0; i < 3; i++) this.fxAdd.emit(x, y, z, rand(-2, 2), rand(0, 2), rand(-2, 2), 0.18, 0.18, 0.02, color, 0, 4);
  }

  spawnBullet(b, ang, o) {
    const dx = Math.sin(ang), dz = Math.cos(ang);
    const from = o.from || this.muzzle(b, ang, 0.5);
    const geo = { pellet: this.G.pellet, star: this.G.bolt, beam: this.G.beam, orb: this.G.orb, tracer: this.G.tracer, rocket: this.G.rocket }[o.style];
    const mat = { pellet: this.Mt.pellet, star: this.Mt.star, beam: this.Mt.beam, orb: this.Mt.orb, tracer: this.Mt.tracer, rocket: this.Mt.rocket }[o.style];
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(from.x, from.y, from.z);
    mesh.rotation.y = ang;
    this.scene.add(mesh);
    this.shots.push({ kind: 'bullet', owner: b, team: b.team, x: from.x, z: from.z, y: from.y, dx, dz, traveled: 0, hit: new Set(), healed: new Set(), mesh, ...o });
  }

  spawnLob(b, tx, tz, o) {
    tx = clamp(tx, -W / 2 + 0.3, W / 2 - 0.3);
    tz = clamp(tz, -H / 2 + 0.3, H / 2 - 0.3);
    const geo = { bomb: this.G.bomb, mega: this.G.mega, seed: this.G.seed }[o.style];
    const mat = { bomb: this.Mt.bomb, mega: this.Mt.bomb, seed: this.Mt.seed }[o.style];
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    this.scene.add(mesh);
    const shadow = new THREE.Mesh(this.G.shadow, this.Mt.shadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    this.scene.add(shadow);
    const marker = new THREE.Mesh(this.G.target, new THREE.MeshBasicMaterial({ color: TEAM_COL[b.team], transparent: true, opacity: 0.7, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(tx, 0.04, tz);
    marker.scale.setScalar(o.aoe);
    marker.renderOrder = 2;
    this.scene.add(marker);
    const sx = b.x + Math.sin(b.face) * 0.2, sz = b.z + Math.cos(b.face) * 0.2;
    const dist = Math.hypot(tx - sx, tz - sz);
    this.shots.push({ kind: 'lob', owner: b, team: b.team, sx, sz, tx, tz, t: 0, T: o.flight, h: 1.6 + dist * 0.22, mesh, shadow, marker, ...o });
  }

  doMelee(b, ang, range, arc, dmg, charge) {
    for (const e of this.enemiesOf(b)) {
      if (!e.alive) continue;
      const dx = e.x - b.x, dz = e.z - b.z;
      const d = Math.hypot(dx, dz);
      if (d > range + RADIUS * 0.7) continue;
      let da = Math.atan2(dx, dz) - ang;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > arc / 2 + 0.2 && d > 0.7) continue;
      if (!this.rayClear(b.x, b.z, e.x, e.z)) continue;
      this.damage(e, dmg, b, { charge });
      this.hitFx(e.x, 0.8, e.z, '#bfe9ff', Math.sin(ang), Math.cos(ang));
    }
    // slash visual
    const g = new THREE.Group();
    g.position.set(b.x, 0.75, b.z);
    g.rotation.y = ang - Math.PI / 2 - 1.9 / 2;
    const m = new THREE.Mesh(this.G.slash, this.Mt.slash.clone());
    m.rotation.x = -Math.PI / 2;
    m.scale.setScalar(range / 1.25 * 0.85);
    g.add(m);
    this.scene.add(g);
    this.transients.push({
      obj: g, life: 0.2, max: 0.2,
      upd: (p) => {
        m.material.opacity = 0.95 * (1 - p);
        g.rotation.y += 0.04;
        m.scale.setScalar((range / 1.25) * (0.75 + p * 0.35));
      },
    });
    for (let i = 0; i < 8; i++) {
      const a = ang + rand(-arc / 2, arc / 2);
      const r = rand(0.6, range);
      this.fxAdd.emit(b.x + Math.sin(a) * r, 0.75, b.z + Math.cos(a) * r, Math.sin(a) * 2, rand(0, 1.5), Math.cos(a) * 2, 0.25, 0.22, 0.02, '#9fe4ff', 0, 3);
    }
  }

  hitFx(x, y, z, color, dx = 0, dz = 0) {
    for (let i = 0; i < 6; i++) {
      this.fxAdd.emit(x, y, z, rand(-3, 3) + dx * 2, rand(0.5, 3.5), rand(-3, 3) + dz * 2, 0.25, 0.25, 0.02, color, 6, 3);
    }
    this.fxAdd.emit(x, y, z, 0, 0, 0, 0.1, 0.9, 0.2, '#ffffff');
  }

  boom(x, z, r, color, big = false) {
    const n = big ? 26 : 14;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(1.5, 4.5) * r;
      this.fxAdd.emit(x, 0.4, z, Math.cos(a) * sp, rand(1, 4), Math.sin(a) * sp, rand(0.25, 0.45), rand(0.6, 1.0) * r, 0.05, i % 3 ? color : '#fff1b0', 0, 4);
    }
    for (let i = 0; i < (big ? 14 : 8); i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(0.5, 2) * r;
      this.fxPuff.emit(x + Math.cos(a) * 0.3, 0.35, z + Math.sin(a) * 0.3, Math.cos(a) * sp, rand(0.6, 1.8), Math.sin(a) * sp, rand(0.5, 0.9), rand(0.35, 0.55) * r, rand(0.8, 1.1) * r, '#f4ead8', -0.6, 2.2);
    }
    this.rings.emit(x, z, 0.2, r * 1.05, '#ffffff', 0.32, 0.06, 0.95);
    if (big) this.rings.emit(x, z, 0.2, r * 1.5, color, 0.5, 0.05, 0.6);
    const dist = Math.hypot(x - this.player.x, z - this.player.z);
    if (dist < 9) {
      this.shake = Math.max(this.shake, (big ? 0.45 : 0.18) * (1 - dist / 9));
      sfx(big ? 'bigExplode' : 'explode');
    }
  }

  breakTile(c, r) {
    const info = this.arena.destroy(c, r);
    if (!info) return false;
    const x = tileX(c), z = tileZ(r);
    for (let i = 0; i < 9; i++) {
      this.debris.emit(x + rand(-0.3, 0.3), rand(0.3, 0.9), z + rand(-0.3, 0.3), rand(-4, 4), rand(3, 7), rand(-4, 4), rand(0.14, 0.3), i % 3 ? info.color : info.top, rand(1, 1.6));
    }
    for (let i = 0; i < 6; i++) this.fxPuff.emit(x + rand(-0.4, 0.4), 0.4, z + rand(-0.4, 0.4), rand(-1, 1), rand(0.5, 1.5), rand(-1, 1), 0.7, 0.5, 1.1, '#efe3cf', -0.4, 2);
    if (this.nearCam(x, z, 12)) sfx('wall');
    return true;
  }

  damage(e, amount, src, opt = {}) {
    if (!e.alive || this.state === 'ended') return;
    if (e.shield > 0) {
      this.addText(e.x, 2.0, e.z, 'BLOQUÉ', '#8ff7ff', 0.8);
      return;
    }
    amount = Math.round(amount);
    e.hp -= amount;
    e.lastHurt = this.t;
    e.flash = 1;
    e.P.st.squash = 0.12;
    e.reveal = Math.max(e.reveal, 0.6);
    if (src) {
      src.damage += amount;
      if (!opt.superShot && opt.charge) {
        const before = src.superCharge;
        src.superCharge = Math.min(1, src.superCharge + opt.charge);
        if (src.isPlayer && before < 1 && src.superCharge >= 1) sfx('superReady');
      }
    }
    const big = src && src.isPlayer;
    const col = e.isPlayer ? '#ff6b7d' : opt.superShot ? '#ffd23f' : '#ffffff';
    this.addText(e.x + rand(-0.3, 0.3), 2.3, e.z, String(amount), col, big || e.isPlayer ? 1.15 : 0.8);
    if (e.isPlayer) {
      sfx('hurt');
      this.shake = Math.max(this.shake, 0.15);
    } else if (src && src.isPlayer) {
      sfx('hit');
    }
    if (e.hp <= 0) this.kill(e, src);
  }

  heal(e, amount, src, quiet = false) {
    if (!e.alive || e.hp >= e.maxHp) return;
    amount = Math.min(Math.round(amount), e.maxHp - e.hp);
    if (amount <= 0) return;
    e.hp += amount;
    if (src) src.healed += amount;
    if (!quiet) this.addText(e.x + rand(-0.3, 0.3), 2.3, e.z, '+' + amount, '#5dff8f', e.isPlayer ? 1 : 0.75);
    for (let i = 0; i < 4; i++) this.fxAdd.emit(e.x + rand(-0.4, 0.4), rand(0.3, 1.2), e.z + rand(-0.4, 0.4), 0, rand(1, 2), 0, 0.5, 0.22, 0.05, '#5dff8f');
  }

  kill(e, src) {
    e.alive = false;
    e.hp = 0;
    e.deaths++;
    e.deathT = 0.45;
    e.respawnT = RESPAWN;
    e.dash = e.leap = e.kb = null;
    e.P.st.air = 0;
    if (src) src.kills++;
    const col = e.hero.color;
    for (let i = 0; i < 22; i++) {
      const a = rand(0, Math.PI * 2);
      this.fxAdd.emit(e.x, 0.9, e.z, Math.cos(a) * rand(2, 6), rand(2, 7), Math.sin(a) * rand(2, 6), rand(0.4, 0.7), rand(0.25, 0.45), 0.02, i % 2 ? col : '#ffffff', 9, 1.5);
    }
    for (let i = 0; i < 10; i++) this.debris.emit(e.x, 0.8, e.z, rand(-4, 4), rand(4, 8), rand(-4, 4), rand(0.1, 0.2), i % 2 ? col : TEAM_COL[e.team], 1.4);
    for (let i = 0; i < 8; i++) this.fxPuff.emit(e.x + rand(-0.3, 0.3), 0.5, e.z + rand(-0.3, 0.3), rand(-1.5, 1.5), rand(0.5, 2), rand(-1.5, 1.5), 0.8, 0.5, 1.2, '#ffffff', -0.3, 2);
    this.rings.emit(e.x, e.z, 0.3, 2.2, TEAM_COL[e.team], 0.5);
    if (this.mode.id === 'ko' && src) {
      this.score[src.team]++;
      this.ui.score(this.score[0], this.score[1]);
    }
    this.ui.feed(src, e);
    if (src && src.isPlayer) {
      sfx('ko');
      this.slowmo = 0.22;
      this.shake = Math.max(this.shake, 0.3);
      this.ui.banner('K.O. !', 'ko');
    } else if (e.isPlayer) {
      sfx('dead');
      this.shake = 0.4;
    } else if (this.nearCam(e.x, e.z, 12)) {
      sfx('ko');
    }
    if (this.mode.id === 'ko' && this.overtime && src) this.finish(src.team === 0 ? 'win' : 'lose');
  }

  respawn(b) {
    b.alive = true;
    b.hp = b.maxHp;
    b.ammo = 3;
    b.shield = 2;
    b.spawnT = 0.4;
    b.flash = 0;
    this.placeAtSpawn(b);
    b.root.visible = true;
    b.root.scale.setScalar(0.01);
    this.rings.emit(b.x, b.z, 0.2, 1.4, TEAM_COL[b.team], 0.5);
    for (let i = 0; i < 12; i++) this.fxAdd.emit(b.x + rand(-0.5, 0.5), rand(0, 0.4), b.z + rand(-0.5, 0.5), 0, rand(2, 4), 0, 0.6, 0.25, 0.05, TEAM_COL[b.team]);
    if (b.isPlayer) sfx('respawn');
  }

  addText(x, y, z, text, color, size = 1) {
    this.texts.push({ x, y, z, text, color, size, life: 0.85, max: 0.85, vx: rand(-0.3, 0.3) });
  }

  // ------------------------------------------------------------------ update
  start() {
    this.state = 'play';
    this.ui.score(0, 0);
  }

  finish(result) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.result = result;
    this.endT = 0;
    this.slowmo = 1.2;
    for (const s of this.shots) this.removeShot(s);
    this.shots.length = 0;
    this.aimHide();
    if (this.ui.end) this.ui.end(result);
  }

  update(rawDt) {
    let dt = Math.min(rawDt, 0.05);
    if (this.slowmo > 0) {
      this.slowmo -= rawDt;
      dt *= 0.3;
    }
    this.t += dt;
    const playing = this.state === 'play';

    if (playing) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.onTimeUp();
      }
    }
    if (this.state === 'ended') {
      this.endT += rawDt;
      if (this.endT > 2.2 && !this.reported) {
        this.reported = true;
        this.o.onEnd(this.summary());
      }
    }

    // scheduled actions
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) {
        this.timers.splice(i, 1);
        if (this.state !== 'ended') tm.fn();
      }
    }

    for (const b of this.brawlers) this.updateBrawler(b, dt, playing);
    this.input.consume();
    this.separate();
    if (playing) this.updateObjective(dt);
    this.updateShots(dt);
    this.updateZones(dt);
    for (let i = this.transients.length - 1; i >= 0; i--) {
      const tr = this.transients[i];
      tr.life -= dt;
      tr.upd(1 - Math.max(0, tr.life / tr.max));
      if (tr.life <= 0) {
        this.scene.remove(tr.obj);
        tr.obj.traverse((o) => o.material && o.material !== this.Mt.slash && o.material.dispose && o.material.dispose());
        this.transients.splice(i, 1);
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const tx = this.texts[i];
      tx.life -= rawDt;
      if (tx.life <= 0) this.texts.splice(i, 1);
    }
    this.fxAdd.update(dt);
    this.fxPuff.update(dt);
    this.debris.update(dt);
    this.rings.update(dt);
    this.arena.update(this.t);
    this.updateBushUniforms(dt);
    if (this.zoneUniforms) this.zoneUniforms.uTime.value = this.t;
    this.updateCamera(rawDt);
    this.updatePlayerAim();
    this.pushUi();
  }

  onTimeUp() {
    if (this.mode.id === 'ko') {
      if (this.score[0] === this.score[1]) {
        if (!this.overtime) {
          this.overtime = true;
          this.ui.banner('MORT SUBITE !', 'warn');
        }
        this.timeLeft = 0;
        return;
      }
      this.finish(this.score[0] > this.score[1] ? 'win' : 'lose');
    } else {
      const a = this.zoneProg[0], b = this.zoneProg[1];
      this.finish(Math.abs(a - b) < 0.5 ? 'draw' : a > b ? 'win' : 'lose');
    }
  }

  updateObjective(dt) {
    if (this.mode.id === 'ko') {
      if (this.score[0] >= this.mode.goal) this.finish('win');
      else if (this.score[1] >= this.mode.goal) this.finish('lose');
      return;
    }
    const n = [0, 0];
    for (const b of this.brawlers) {
      if (b.alive && Math.hypot(b.x, b.z) < ZONE_R) {
        n[b.team]++;
        b.zoneTime += dt;
      }
    }
    let ctrl = -1;
    if (n[0] > 0 && n[1] === 0) ctrl = 0;
    else if (n[1] > 0 && n[0] === 0) ctrl = 1;
    else if (n[0] > 0 && n[1] > 0) ctrl = 2;
    if (ctrl === 0 || ctrl === 1) {
      this.zoneProg[ctrl] = Math.min(100, this.zoneProg[ctrl] + dt * (2.4 + 0.6 * (n[ctrl] - 1)));
    }
    if (ctrl !== this.zoneCtrl) {
      this.zoneCtrl = ctrl;
      const c = ctrl === 0 ? TEAM_COL[0] : ctrl === 1 ? TEAM_COL[1] : ctrl === 2 ? '#ffd23f' : '#ffffff';
      this.zoneUniforms.uColor.value.set(c);
    }
    if (this.zoneProg[0] >= 100) this.finish('win');
    else if (this.zoneProg[1] >= 100) this.finish('lose');
  }

  updateBrawler(b, dt, playing) {
    const P = b.P;
    b.reveal = Math.max(0, b.reveal - dt);
    b.shield = Math.max(0, b.shield - dt);
    b.atkCd = Math.max(0, b.atkCd - dt);
    b.faceLock = Math.max(0, b.faceLock - dt);

    if (!b.alive) {
      if (b.deathT > 0) {
        b.deathT -= dt;
        const k = Math.max(0, b.deathT / 0.45);
        b.root.scale.setScalar(k < 0.75 ? k / 0.75 : 1 + (1 - k) * 0.8);
        b.root.rotation.y += dt * 16;
        b.root.position.y = (1 - k) * 0.8;
        if (b.deathT <= 0) b.root.visible = false;
      }
      if (playing || this.state === 'intro') {
        b.respawnT -= dt;
        if (b.respawnT <= 0) this.respawn(b);
      }
      return;
    }
    if (b.spawnT > 0) {
      b.spawnT -= dt;
      const p = 1 - Math.max(0, b.spawnT / 0.4);
      const s = p < 1 ? 1 + Math.sin(p * Math.PI) * 0.25 - (1 - p) * 0.9 * (1 - p) : 1;
      b.root.scale.setScalar(Math.max(0.01, p >= 1 ? 1 : s));
      b.root.position.y = 0;
    }

    // reload & regen & passive super
    const reload = b.hero.attack.reload;
    if (b.ammo < 3) b.ammo = Math.min(3, b.ammo + dt / reload);
    if (playing) b.superCharge = Math.min(1, b.superCharge + dt * 0.006);
    if (this.t - b.lastHurt > 3 && this.t - b.lastAttack > 3 && b.hp < b.maxHp) {
      b.regenTick -= dt;
      if (b.regenTick <= 0) {
        b.regenTick = 1;
        this.heal(b, b.maxHp * 0.13, null, !b.isPlayer && !this.nearCam(b.x, b.z, 10));
      }
    } else b.regenTick = 1;

    const ox = b.x, oz = b.z;
    let mvx = 0, mvz = 0;

    if (b.leap) {
      const L = b.leap;
      L.t += dt;
      const p = Math.min(1, L.t / L.T);
      b.x = lerp(L.sx, L.tx, p);
      b.z = lerp(L.sz, L.tz, p);
      P.st.air = Math.sin(p * Math.PI) * 1.9;
      b.face = Math.atan2(L.tx - L.sx, L.tz - L.sz);
      if (Math.random() < 0.6) this.fxAdd.emit(b.x, 0.8 + P.st.air, b.z, 0, 0, 0, 0.3, 0.45, 0.05, '#5a7bff');
      if (p >= 1) {
        b.leap = null;
        P.st.air = 0;
        P.st.squash = 0.3;
        this.collide(b);
        for (const e of this.enemiesOf(b)) {
          if (e.alive && Math.hypot(e.x - b.x, e.z - b.z) < L.aoe + RADIUS * 0.5) {
            this.damage(e, L.dmg, b, { superShot: true });
            this.knock(e, e.x - b.x, e.z - b.z, 4);
          }
        }
        this.boom(b.x, b.z, L.aoe, '#7f9bff', false);
        this.doMeleeVisual(b);
      }
    } else if (b.dash) {
      const d = b.dash;
      const step = d.speed * dt;
      const ahx = b.x + d.dx * (step + RADIUS + 0.05), ahz = b.z + d.dz * (step + RADIUS + 0.05);
      const c = colOf(ahx), r = rowOf(ahz);
      const ch = this.arena.cell(c, r);
      if (ch === '#' || ch === 'X') {
        this.breakTile(c, r);
        this.shake = Math.max(this.shake, b.isPlayer ? 0.2 : 0);
      }
      this.move(b, d.dx * step, d.dz * step);
      for (const e of this.enemiesOf(b)) {
        if (!e.alive || d.hit.has(e)) continue;
        if (Math.hypot(e.x - b.x, e.z - b.z) < RADIUS * 2 + 0.35) {
          d.hit.add(e);
          this.damage(e, d.dmg, b, { superShot: true });
          this.knock(e, d.dx, d.dz, 5.5);
          this.hitFx(e.x, 0.8, e.z, '#ffb347', d.dx, d.dz);
          this.shake = Math.max(this.shake, 0.25);
        }
      }
      this.fxPuff.emit(b.x - d.dx * 0.4, 0.2, b.z - d.dz * 0.4, rand(-0.5, 0.5), rand(0.3, 1), rand(-0.5, 0.5), 0.5, 0.3, 0.7, '#f4ead8', -0.4, 2);
      this.fxAdd.emit(b.x, 0.7, b.z, 0, 0, 0, 0.15, 0.7, 0.1, '#ff9a3d');
      d.t -= dt;
      b.face = Math.atan2(d.dx, d.dz);
      if (d.t <= 0) {
        b.dash = null;
        P.st.squash = 0.2;
      }
    } else if (b.kb) {
      const k = b.kb;
      this.move(b, k.vx * dt, k.vz * dt);
      k.vx *= Math.exp(-dt * 6);
      k.vz *= Math.exp(-dt * 6);
      k.t -= dt;
      if (k.t <= 0) b.kb = null;
    } else if (playing) {
      if (b.isPlayer) {
        const mv = this.input.move;
        mvx = mv.x;
        mvz = mv.z;
        this.handlePlayerActions(b);
      } else {
        const v = this.updateAI(b, dt);
        mvx = v.x;
        mvz = v.z;
      }
      const ml = Math.hypot(mvx, mvz);
      if (ml > 1) { mvx /= ml; mvz /= ml; }
      const sp = b.hero.speed;
      this.move(b, mvx * sp * dt, mvz * sp * dt);
    }

    // velocity estimate
    b.vx = lerp(b.vx, (b.x - ox) / Math.max(dt, 1e-4), 0.3);
    b.vz = lerp(b.vz, (b.z - oz) / Math.max(dt, 1e-4), 0.3);
    const speed = Math.hypot(b.x - ox, b.z - oz) / Math.max(dt, 1e-4);
    if (b.faceLock <= 0 && !b.dash && !b.leap && speed > 0.4 && !b.kb) b.face = Math.atan2(b.x - ox, b.z - oz);
    b.root.rotation.y = angLerp(b.root.rotation.y, b.face, 1 - Math.exp(-dt * 16));
    b.root.position.set(b.x, 0, b.z);
    P.st.move = lerp(P.st.move, clamp(speed / b.hero.speed, 0, 1.2), 1 - Math.exp(-dt * 12));

    // bush
    const inBush = this.arena.isBush(colOf(b.x), rowOf(b.z));
    if (inBush && !b.inBush && speed > 0.5) b.rustle = 1;
    b.inBush = inBush;
    b.rustle = Math.max(inBush ? Math.min(1, speed / 3) * 0.8 : 0, b.rustle - dt * 2);

    // flash
    b.flash = Math.max(0, b.flash - dt * 6);
    setFlash(P, b.shield > 0 ? 0.25 + Math.sin(this.t * 20) * 0.1 : b.flash * 0.9, b.shield > 0 ? 0x66ddff : 0xffffff);
    b.bubble.visible = b.shield > 0;
    if (b.bubble.visible) b.bubble.material.opacity = 0.15 + Math.sin(this.t * 8) * 0.06;

    // super aura
    const ready = b.superCharge >= 1;
    b.aura.material.opacity = ready ? 0.55 + Math.sin(this.t * 6) * 0.25 : 0;
    if (ready) b.aura.scale.setScalar(1 + Math.sin(this.t * 6) * 0.08);

    animateHero(P, dt, { atkSpeed: b.hero.attack.type === 'melee' ? 4.5 : 3.2 });
  }

  doMeleeVisual(b) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.fxAdd.emit(b.x + Math.cos(a) * 0.5, 0.5, b.z + Math.sin(a) * 0.5, Math.cos(a) * 5, 0.5, Math.sin(a) * 5, 0.25, 0.3, 0.02, '#bfe9ff', 0, 3);
    }
  }

  knock(e, dx, dz, power) {
    if (!e.alive || e.shield > 0) return;
    const l = Math.hypot(dx, dz) || 1;
    e.kb = { vx: (dx / l) * power * 2.2, vz: (dz / l) * power * 2.2, t: 0.28 };
    e.dash = null;
  }

  separate() {
    const bs = this.brawlers;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      if (!a.alive || a.leap) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j];
        if (!b.alive || b.leap) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = RADIUS * 1.7;
        if (d < min && d > 1e-4) {
          const push = (min - d) * 0.5;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          b.x += (dx / d) * push; b.z += (dz / d) * push;
          this.collide(a);
          this.collide(b);
        }
      }
    }
  }

  // ------------------------------------------------------------------ player
  handlePlayerActions(b) {
    const evs = this.input.consume();
    for (const ev of evs) {
      const isSuper = ev.type === 'super';
      const spec = isSuper ? b.hero.super : b.hero.attack;
      let dx, dz, mag;
      if (ev.auto) {
        const r = this.autoAim(b, spec);
        dx = r.dx; dz = r.dz; mag = r.mag;
      } else if (ev.world) {
        const vx = ev.world.x - b.x, vz = ev.world.z - b.z;
        const l = Math.hypot(vx, vz) || 1;
        dx = vx / l; dz = vz / l;
        mag = clamp(l / (spec.range || 6), 0, 1);
      } else {
        dx = ev.dx; dz = ev.dz; mag = ev.mag;
      }
      if (isSuper) this.trySuper(b, dx, dz, mag);
      else this.tryAttack(b, dx, dz, mag);
    }
  }

  autoAim(b, spec) {
    let best = null, bd = 1e9;
    const range = (spec.range || 6) * 1.05;
    for (const e of this.enemiesOf(b)) {
      if (!e.alive || !this.visibleTo(e, b.team)) continue;
      const d = Math.hypot(e.x - b.x, e.z - b.z);
      if (d < range && d < bd) { bd = d; best = e; }
    }
    if (!best) return { dx: Math.sin(b.face), dz: Math.cos(b.face), mag: 0.75 };
    const sp = spec.speed || 14;
    const t = bd / sp;
    const px = best.x + best.vx * t * 0.6, pz = best.z + best.vz * t * 0.6;
    const vx = px - b.x, vz = pz - b.z;
    const l = Math.hypot(vx, vz) || 1;
    return { dx: vx / l, dz: vz / l, mag: clamp(l / (spec.range || 6), 0, 1) };
  }

  aimHide() {
    for (const k of ['attack', 'super']) {
      const a = this.aimViz[k];
      a.rect.visible = a.fan.visible = a.circle.visible = a.ring.visible = false;
      for (const d of a.dots) d.visible = false;
    }
  }

  updatePlayerAim() {
    this.aimHide();
    const b = this.player;
    const aim = this.input.aim;
    if (!aim || !aim.active || !b.alive || this.state !== 'play') return;
    const isSuper = aim.kind === 'super';
    if (isSuper && b.superCharge < 1) return;
    const spec = isSuper ? b.hero.super : b.hero.attack;
    let dx = aim.dx, dz = aim.dz, mag = aim.mag;
    if (aim.world) {
      const vx = aim.world.x - b.x, vz = aim.world.z - b.z;
      const l = Math.hypot(vx, vz) || 1;
      dx = vx / l; dz = vz / l; mag = clamp(l / (spec.range || 6), 0, 1);
    }
    const V = this.aimViz[aim.kind];
    const ang = Math.atan2(dx, dz);
    const t = spec.type;
    const op = aim.faint ? 0.5 : 1;
    const setOp = (m) => { m.material.opacity = (isSuper ? 0.42 : 0.34) * op; };
    if (t === 'spread' || t === 'melee' || t === 'barrage') {
      V.fan.visible = true;
      setOp(V.fan);
      V.fan.position.set(b.x, 0.04, b.z);
      V.fan.rotation.y = ang;
      V.fan.scale.set(spec.range, 1, spec.range);
    } else if (t === 'single' || t === 'orb' || t === 'beam' || t === 'charge') {
      V.rect.visible = true;
      setOp(V.rect);
      const w = t === 'beam' ? 0.95 : t === 'charge' ? 1.0 : t === 'orb' ? 0.6 : 0.45;
      let len = spec.range;
      if (t === 'single' || t === 'orb') len = this.clipLength(b.x, b.z, dx, dz, spec.range);
      V.rect.position.set(b.x, 0.04, b.z);
      V.rect.rotation.y = ang;
      V.rect.scale.set(w, 1, len);
    } else {
      const minD = t === 'bloom' ? 0.5 : 1.2;
      const dist = clamp(mag * spec.range, minD, spec.range);
      const tx = b.x + dx * dist, tz = b.z + dz * dist;
      const r = spec.aoe || 1;
      V.circle.visible = V.ring.visible = true;
      V.circle.material.opacity = (isSuper ? 0.22 : 0.18) * op;
      setOp(V.ring);
      V.circle.rotation.x = V.ring.rotation.x = -Math.PI / 2;
      V.circle.position.set(tx, 0.045, tz);
      V.ring.position.set(tx, 0.05, tz);
      V.circle.scale.setScalar(r);
      V.ring.scale.setScalar(r);
      const h = t === 'leap' ? 2.4 : 1.6 + dist * 0.22;
      V.dots.forEach((d, i) => {
        const p = (i + 1) / (V.dots.length + 1);
        d.visible = true;
        setOp(d);
        d.position.set(lerp(b.x, tx, p), 0.8 + 4 * h * p * (1 - p) * 0.8 - p * 0.6, lerp(b.z, tz, p));
      });
    }
  }

  // ------------------------------------------------------------------ AI
  pickTarget(b) {
    let best = null, bs = 1e9;
    for (const e of this.enemiesOf(b)) {
      if (!e.alive || !this.visibleTo(e, b.team)) continue;
      const d = Math.hypot(e.x - b.x, e.z - b.z);
      if (d > 9.5) continue;
      let s = d - (1 - e.hpFrac) * 3 - (e === b.ai.target ? 1.5 : 0);
      if (e.shield > 0) s += 4;
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }

  roamPoint(b) {
    const dir = b.team === 0 ? -1 : 1;
    for (let tries = 0; tries < 20; tries++) {
      const x = rand(-W / 2 + 1.5, W / 2 - 1.5);
      const z = rand(-4, 6) * dir + rand(-2, 2);
      const c = colOf(x), r = rowOf(z);
      if (!this.arena.blocksMove(c, r)) return { x: tileX(c), z: tileZ(r) };
    }
    return { x: 0, z: 0 };
  }

  followPath(b, gx, gz, dt) {
    const ai = b.ai;
    const gc = clamp(colOf(gx), 0, W - 1), gr = clamp(rowOf(gz), 0, H - 1);
    const key = gr * W + gc;
    ai.pathT -= dt;
    if (!ai.path || ai.goalKey !== key || ai.pathT <= 0) {
      ai.path = this.findPath(b.x, b.z, gx, gz);
      ai.goalKey = key;
      ai.pathT = 0.6 + rand(0, 0.3);
    }
    const path = ai.path;
    if (!path || !path.length) {
      const dx = gx - b.x, dz = gz - b.z;
      const l = Math.hypot(dx, dz);
      return l > 0.2 ? { x: dx / l, z: dz / l } : { x: 0, z: 0 };
    }
    while (path.length > 1 && (Math.hypot(path[0].x - b.x, path[0].z - b.z) < 0.4 || this.walkClear(b.x, b.z, path[1].x, path[1].z))) path.shift();
    const p = path[0];
    const dx = p.x - b.x, dz = p.z - b.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.15) {
      path.shift();
      return { x: 0, z: 0 };
    }
    return { x: dx / l, z: dz / l };
  }

  updateAI(b, dt) {
    const ai = b.ai;
    const hero = b.hero;
    ai.retarget -= dt;
    if (ai.retarget <= 0) {
      ai.retarget = rand(0.25, 0.45);
      ai.target = this.pickTarget(b);
    }
    const tgt = ai.target && ai.target.alive && this.visibleTo(ai.target, b.team) ? ai.target : null;
    let dir = { x: 0, z: 0 };
    const a = hero.attack;
    const range = a.range;
    const homeX = tileX(SPAWNS[b.team][b.slot][0]), homeZ = tileZ(SPAWNS[b.team][b.slot][1]);

    // unstuck behaviour
    if (ai.unstuck > 0) {
      ai.unstuck -= dt;
      return { x: ai.ux, z: ai.uz };
    }

    if (tgt) {
      const dx = tgt.x - b.x, dz = tgt.z - b.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const los = a.type === 'lob' ? true : this.rayClear(b.x, b.z, tgt.x, tgt.z);
      const prefer = hero.ai.prefer;
      const retreat = b.hpFrac < 0.4 && tgt.hpFrac > 0.3 && !(hero.id === 'kumo' && b.hpFrac > 0.25);
      if (retreat) {
        dir = this.followPath(b, homeX, homeZ, dt);
      } else if (!los || d > range * 0.92) {
        dir = this.followPath(b, tgt.x, tgt.z, dt);
      } else {
        let radial = 0;
        if (d < prefer - 0.7) radial = -1;
        else if (d > prefer + 0.7) radial = 1;
        ai.strafeT -= dt;
        if (ai.strafeT <= 0) {
          ai.strafeT = rand(0.5, 1.4);
          ai.strafe = Math.random() < 0.5 ? -1 : 1;
        }
        const nx = dx / d, nz = dz / d;
        dir = { x: nx * radial + -nz * ai.strafe * 0.75, z: nz * radial + nx * ai.strafe * 0.75 };
        if (hero.id === 'kumo') dir = { x: nx, z: nz };
      }
      // attack
      ai.fireT -= dt;
      const inRange = a.type === 'melee' ? d <= range + 0.2 : d <= range + 0.25;
      if (ai.fireT <= 0 && b.ammo >= 1 && b.atkCd <= 0 && inRange && los) {
        ai.fireT = rand(0.5, 1.05) + (b.ammo < 2 ? 0.7 : 0);
        const sp = a.speed || 12;
        const lead = a.type === 'lob' ? a.flight : d / sp;
        const px = tgt.x + tgt.vx * lead * rand(0.4, 1), pz = tgt.z + tgt.vz * lead * rand(0.4, 1);
        let vx = px - b.x, vz = pz - b.z;
        const l = Math.hypot(vx, vz) || 1;
        const err = rand(-0.17, 0.17) * (d > 5 ? 1.2 : 1);
        const an = Math.atan2(vx, vz) + err;
        this.tryAttack(b, Math.sin(an), Math.cos(an), clamp(l / range, 0, 1));
      }
      // super
      if (b.superCharge >= 1) this.aiSuper(b, tgt, d, los);
    } else {
      // objective
      if (b.hpFrac < 0.45) {
        const hx = lerp(homeX, 0, 0.45), hz = lerp(homeZ, 0, 0.45);
        dir = Math.hypot(hx - b.x, hz - b.z) > 1 ? this.followPath(b, hx, hz, dt) : { x: 0, z: 0 };
      } else if (this.mode.id === 'zone') {
        const ang = b.slot * 2.1 + b.team * 1.0;
        const zx = Math.cos(ang) * 1.2, zz = Math.sin(ang) * 1.2;
        dir = Math.hypot(zx - b.x, zz - b.z) > 0.6 ? this.followPath(b, zx, zz, dt) : { x: 0, z: 0 };
      } else {
        ai.roamT -= dt;
        if (!ai.roam || ai.roamT <= 0 || Math.hypot(ai.roam.x - b.x, ai.roam.z - b.z) < 0.8) {
          ai.roam = this.roamPoint(b);
          ai.roamT = rand(4, 8);
        }
        dir = this.followPath(b, ai.roam.x, ai.roam.z, dt);
      }
      // support: heal allies with super
      if (b.superCharge >= 1 && hero.super.type === 'bloom') this.aiSuper(b, null, 0, true);
    }

    // stuck detection
    ai.stuckT += dt;
    if (ai.stuckT > 0.8) {
      const moved = Math.hypot(b.x - ai.lx, b.z - ai.lz);
      if (moved < 0.25 && Math.hypot(dir.x, dir.z) > 0.5) {
        const an = rand(0, Math.PI * 2);
        ai.ux = Math.cos(an);
        ai.uz = Math.sin(an);
        ai.unstuck = 0.45;
        ai.path = null;
      }
      ai.stuckT = 0;
      ai.lx = b.x;
      ai.lz = b.z;
    }
    return dir;
  }

  aiSuper(b, tgt, d, los) {
    const s = b.hero.super;
    const ai = b.ai;
    ai.superT -= 1 / 60;
    const aimAt = (x, z) => {
      const vx = x - b.x, vz = z - b.z;
      const l = Math.hypot(vx, vz) || 1;
      this.trySuper(b, vx / l, vz / l, clamp(l / s.range, 0, 1));
    };
    switch (s.type) {
      case 'charge':
        if (tgt && d < 5 && los) aimAt(tgt.x, tgt.z);
        break;
      case 'beam':
        if (tgt && d < s.range * 0.9) aimAt(tgt.x + tgt.vx * 0.2, tgt.z + tgt.vz * 0.2);
        break;
      case 'megabomb':
      case 'barrage':
        if (tgt && d < s.range * 0.85) aimAt(tgt.x, tgt.z);
        break;
      case 'leap':
        if (tgt && d < s.range && (tgt.hpFrac < 0.7 || d > 3)) aimAt(tgt.x, tgt.z);
        break;
      case 'bloom': {
        let best = null, worst = 0.6;
        for (const al of this.teams[b.team]) {
          if (!al.alive) continue;
          const dd = Math.hypot(al.x - b.x, al.z - b.z);
          if (dd < s.range && al.hpFrac < worst) { worst = al.hpFrac; best = al; }
        }
        if (best) aimAt(best.x, best.z);
        else if (tgt && d < s.range * 0.8) aimAt(tgt.x, tgt.z);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ projectiles
  removeShot(s) {
    this.scene.remove(s.mesh);
    if (s.shadow) this.scene.remove(s.shadow);
    if (s.marker) {
      this.scene.remove(s.marker);
      s.marker.material.dispose();
    }
  }

  updateShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      const done = s.kind === 'bullet' ? this.stepBullet(s, dt) : this.stepLob(s, dt);
      if (done) {
        this.removeShot(s);
        this.shots.splice(i, 1);
      }
    }
  }

  trailColor(s) {
    return { pellet: '#ff9a3d', star: '#b46bff', beam: '#c88dff', orb: '#ff8fd0', tracer: '#ffc21f', rocket: '#ff7a3d' }[s.style];
  }

  stepBullet(s, dt) {
    const total = s.speed * dt;
    const n = Math.max(1, Math.ceil(total / 0.2));
    const st = total / n;
    for (let k = 0; k < n; k++) {
      s.x += s.dx * st;
      s.z += s.dz * st;
      s.traveled += st;
      if (!s.wallPass && this.arena.blocksShot(colOf(s.x), rowOf(s.z))) {
        if (s.explode) this.explodeAt(s, s.x - s.dx * 0.2, s.z - s.dz * 0.2);
        else {
          for (let i = 0; i < 5; i++) this.fxAdd.emit(s.x - s.dx * 0.15, s.y, s.z - s.dz * 0.15, -s.dx * rand(1, 3) + rand(-1.5, 1.5), rand(0.5, 2.5), -s.dz * rand(1, 3) + rand(-1.5, 1.5), 0.2, 0.2, 0.02, this.trailColor(s), 5, 3);
          this.fxPuff.emit(s.x - s.dx * 0.2, s.y, s.z - s.dz * 0.2, 0, 0.5, 0, 0.35, 0.2, 0.45, '#f4ead8', 0, 2);
        }
        return true;
      }
      for (const e of this.brawlers) {
        if (!e.alive) continue;
        const rr = RADIUS + s.radius;
        const ddx = e.x - s.x, ddz = e.z - s.z;
        if (ddx * ddx + ddz * ddz > rr * rr) continue;
        if (e.team !== s.team) {
          if (s.hit.has(e)) continue;
          s.hit.add(e);
          if (s.explode) {
            this.explodeAt(s, s.x, s.z);
            return true;
          }
          this.damage(e, s.dmg, s.owner, { charge: s.charge, superShot: s.superShot });
          this.hitFx(s.x, s.y, s.z, this.trailColor(s), s.dx, s.dz);
          if (s.style === 'beam') this.knock(e, s.dx, s.dz, 2.5);
          if (!s.pierce) return true;
        } else if (s.heal && e !== s.owner && !s.healed.has(e)) {
          s.healed.add(e);
          this.heal(e, s.heal, s.owner);
        }
      }
      if (s.traveled >= s.range) {
        if (s.explode) {
          this.explodeAt(s, s.x, s.z);
          return true;
        }
        this.fxAdd.emit(s.x, s.y, s.z, 0, 0, 0, 0.12, s.radius * 3, 0.02, this.trailColor(s));
        return true;
      }
    }
    s.mesh.position.set(s.x, s.y, s.z);
    const remaining = s.range - s.traveled;
    const fade = remaining < 0.6 ? Math.max(0.3, remaining / 0.6) : 1;
    if (s.style === 'beam') {
      s.mesh.scale.set(1 + Math.sin(this.t * 40) * 0.1, 1, 1);
      for (let i = 0; i < 3; i++) this.fxAdd.emit(s.x + rand(-0.3, 0.3), s.y + rand(-0.2, 0.2), s.z + rand(-0.3, 0.3), rand(-1, 1), rand(-1, 1), rand(-1, 1), 0.35, 0.7, 0.05, i ? '#b46bff' : '#ffffff', 0, 2);
    } else {
      s.mesh.scale.setScalar(fade);
    }
    if (s.style === 'orb') s.mesh.rotation.x += dt * 10;
    const tc = this.trailColor(s);
    this.fxAdd.emit(s.x, s.y, s.z, 0, 0, 0, 0.16, s.radius * 3.4, s.radius * 0.6, tc);
    if (s.style === 'rocket') this.fxPuff.emit(s.x - s.dx * 0.3, s.y, s.z - s.dz * 0.3, rand(-0.3, 0.3), rand(0.2, 0.6), rand(-0.3, 0.3), 0.45, 0.15, 0.45, '#e8e2da', 0, 2);
    return false;
  }

  explodeAt(s, x, z) {
    for (const e of this.enemiesOf(s.owner)) {
      if (e.alive && Math.hypot(e.x - x, e.z - z) < s.explode + RADIUS * 0.6) {
        this.damage(e, s.dmg, s.owner, { charge: s.charge, superShot: s.superShot });
      }
    }
    this.boom(x, z, s.explode, '#ff8a3d', false);
  }

  stepLob(s, dt) {
    s.t += dt;
    const p = Math.min(1, s.t / s.T);
    const x = lerp(s.sx, s.tx, p), z = lerp(s.sz, s.tz, p);
    const y = lerp(0.95, 0.2, p) + 4 * s.h * p * (1 - p);
    s.mesh.position.set(x, y, z);
    s.mesh.rotation.x += dt * 8;
    s.mesh.rotation.z += dt * 5;
    s.shadow.position.set(x, 0.03, z);
    s.shadow.scale.setScalar(0.6 + p * 0.6);
    s.marker.material.opacity = 0.35 + 0.35 * Math.sin(this.t * 18);
    if (s.style !== 'seed' && Math.random() < 0.7) this.fxAdd.emit(x, y + 0.2, z, 0, 0.5, 0, 0.2, 0.25, 0.02, '#ffd23f');
    if (s.style === 'seed') this.fxAdd.emit(x, y, z, 0, 0, 0, 0.3, 0.4, 0.05, '#7dffb8');
    if (p < 1) return false;
    if (s.bloom) {
      this.createBloom(s.owner, s.tx, s.tz, s.bloom);
      return true;
    }
    for (const e of this.enemiesOf(s.owner)) {
      if (e.alive && Math.hypot(e.x - s.tx, e.z - s.tz) < s.aoe + RADIUS * 0.6) {
        this.damage(e, s.dmg, s.owner, { charge: s.charge, superShot: s.superShot });
      }
    }
    if (s.breakWalls) {
      const c0 = colOf(s.tx), r0 = rowOf(s.tz);
      const rr = Math.ceil(s.aoe);
      for (let dr = -rr; dr <= rr; dr++) {
        for (let dc = -rr; dc <= rr; dc++) {
          if (Math.hypot(tileX(c0 + dc) - s.tx, tileZ(r0 + dr) - s.tz) <= s.aoe + 0.2) this.breakTile(c0 + dc, r0 + dr);
        }
      }
    }
    this.boom(s.tx, s.tz, s.aoe, s.style === 'mega' ? '#ff6a3d' : '#ffb03d', s.style === 'mega');
    return true;
  }

  createBloom(owner, x, z, o) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const disc = new THREE.Mesh(this.G.circle, new THREE.MeshBasicMaterial({ color: owner.team === 0 ? '#5dff8f' : '#ff7ab8', transparent: true, opacity: 0.25, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.04;
    disc.scale.setScalar(o.r);
    g.add(disc);
    const ring = new THREE.Mesh(this.G.target, new THREE.MeshBasicMaterial({ color: '#7dffb8', transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    ring.scale.setScalar(o.r);
    g.add(ring);
    const petals = new THREE.Group();
    const pm = toon('#ff8fd0', { rim: 0.5 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const pt = new THREE.Mesh(this.G.petal, pm);
      pt.scale.set(1, 0.25, 0.55);
      pt.position.set(Math.cos(a) * 0.38, 0.12, Math.sin(a) * 0.38);
      pt.rotation.y = -a;
      pt.castShadow = true;
      petals.add(pt);
    }
    const core = new THREE.Mesh(this.G.orb, toon('#ffd23f', { rim: 0.6 }));
    core.position.y = 0.2;
    petals.add(core);
    g.add(petals);
    this.scene.add(g);
    this.zones.push({ owner, team: owner.team, x, z, r: o.r, t: o.dur, dur: o.dur, tick: 0, heal: o.heal, dmg: o.dmg, g, petals, disc, ring, pm });
    this.rings.emit(x, z, 0.3, o.r, '#7dffb8', 0.45);
    if (this.nearCam(x, z)) sfx('heal');
  }

  updateZones(dt) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const zn = this.zones[i];
      zn.t -= dt;
      zn.tick -= dt;
      const life = zn.t / zn.dur;
      const grow = Math.min(1, (zn.dur - zn.t) / 0.3);
      zn.petals.scale.setScalar(grow * (1 + Math.sin(this.t * 4) * 0.05));
      zn.petals.rotation.y += dt * 0.8;
      zn.ring.material.opacity = 0.9 * Math.min(1, life * 4);
      zn.disc.material.opacity = 0.25 * Math.min(1, life * 4);
      if (Math.random() < 0.5) {
        const a = rand(0, Math.PI * 2), r = rand(0, zn.r);
        this.fxAdd.emit(zn.x + Math.cos(a) * r, 0.1, zn.z + Math.sin(a) * r, 0, rand(0.8, 1.6), 0, 0.8, 0.22, 0.05, Math.random() < 0.5 ? '#7dffb8' : '#ff8fd0');
      }
      if (zn.tick <= 0) {
        zn.tick = 0.5;
        for (const b of this.brawlers) {
          if (!b.alive || Math.hypot(b.x - zn.x, b.z - zn.z) > zn.r + RADIUS * 0.5) continue;
          if (b.team === zn.team) this.heal(b, zn.heal * 0.5, zn.owner);
          else this.damage(b, zn.dmg * 0.5, zn.owner, { superShot: true });
        }
      }
      if (zn.t <= 0) {
        this.scene.remove(zn.g);
        zn.disc.material.dispose();
        zn.ring.material.dispose();
        zn.pm.dispose();
        this.zones.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------------ visuals & camera
  updateBushUniforms() {
    const mv = this.arena.bushMovers;
    if (mv) {
      for (let i = 0; i < 6; i++) {
        const b = this.brawlers[i];
        if (b && b.alive) mv[i].set(b.x, b.z, b.rustle);
        else mv[i].set(999, 999, 0);
      }
      const p = this.player;
      if (p.alive && p.inBush) this.arena.bushFocus.value.set(p.x, p.z);
      else this.arena.bushFocus.value.set(999, 999);
    }
    // visibility of characters for the local player
    for (const b of this.brawlers) {
      if (!b.alive) continue;
      if (b.team === 1) {
        const vis = this.visibleTo(b, 0);
        b.root.visible = vis || b.deathT > 0;
        b.hiddenFromPlayer = !vis;
        if (vis && b.inBush && b.fade !== 1) {
          b.fade = 1;
          setOpacity(b.P, 1);
        }
      } else {
        const want = b.inBush ? 0.55 : 1;
        if (want !== b.fade) {
          b.fade = want;
          setOpacity(b.P, want);
        }
      }
    }
  }

  setSize(w, h) {
    this.vw = w;
    this.vh = h;
    this.camera.aspect = w / h;
    const aspect = w / h;
    const half = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.camDist = Math.max(18.2, 12 / (2 * half * aspect));
    this.camera.updateProjectionMatrix();
    const scale = h / (2 * half);
    this.fxAdd.uniforms.uScale.value = scale;
    this.fxPuff.uniforms.uScale.value = scale;
  }

  snapCamera(intro = false) {
    const p = this.player;
    this.camTarget.set(p.x * 0.3, 0, p.z - 1.2);
    this.introT = intro ? 0 : 1;
    this.placeCamera(0);
  }

  placeCamera(shake) {
    const d = this.camDist;
    const k = this.introT < 1 ? 1 - Math.pow(1 - this.introT, 3) : 1;
    const ang = lerp(0.62, 1.0, k);
    const dist = lerp(d * 1.25, d, k);
    const tz = this.camTarget.z + lerp(-9, 0, k);
    this.camera.position.set(
      this.camTarget.x + (Math.random() - 0.5) * shake,
      Math.sin(ang) * dist + (Math.random() - 0.5) * shake,
      tz + Math.cos(ang) * dist
    );
    this.camera.lookAt(this.camTarget.x, 0, tz);
    this.sun.position.set(this.camTarget.x - 7, 16, tz + 9);
    this.sun.target.position.set(this.camTarget.x, 0, tz);
  }

  updateCamera(dt) {
    const p = this.player;
    if (this.introT < 1) this.introT = Math.min(1, this.introT + dt / 2.6);
    const aspect = this.camera.aspect;
    const visW = 2 * this.camDist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect;
    const maxX = Math.max(1.5, W / 2 + 1 - visW / 2);
    const tx = clamp(p.x, -maxX, maxX);
    const tz = clamp(p.z - 1.3, -H / 2 + 2, H / 2 - 3.5);
    const k = 1 - Math.exp(-dt * 5);
    this.camTarget.x = lerp(this.camTarget.x, tx, k);
    this.camTarget.z = lerp(this.camTarget.z, tz, k);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.placeCamera(this.shake * 0.9);
  }

  pushUi() {
    const p = this.player;
    this.ui.frame({
      time: this.timeLeft,
      overtime: this.overtime,
      ammo: p.ammo,
      superCharge: p.superCharge,
      alive: p.alive,
      respawn: p.alive ? 0 : p.respawnT,
      zone: this.mode.id === 'zone' ? this.zoneProg : null,
      zoneCtrl: this.zoneCtrl,
    });
  }

  render(renderer) {
    renderer.render(this.scene, this.camera);
  }

  // ------------------------------------------------------------------ HUD overlay (2D canvas)
  drawHud(ctx, w, h, dpr) {
    ctx.clearRect(0, 0, w * dpr, h * dpr);
    ctx.save();
    ctx.scale(dpr, dpr);
    const v = new THREE.Vector3();
    const cam = this.camera;
    const order = this.brawlers.slice().sort((a, b) => a.z - b.z);
    for (const b of order) {
      if (!b.alive || (b.team === 1 && b.hiddenFromPlayer)) continue;
      v.set(b.x, 2.55 + b.P.st.air * 1.3, b.z).project(cam);
      if (v.z > 1) continue;
      const sx = (v.x + 1) * 0.5 * w;
      const sy = (1 - v.y) * 0.5 * h;
      if (sx < -80 || sx > w + 80 || sy < -60 || sy > h + 60) continue;
      const bw = b.isPlayer ? 76 : 64;
      const bh = 13;
      const x0 = sx - bw / 2;
      const y0 = sy - bh / 2;
      ctx.globalAlpha = b.fade < 1 ? 0.75 : 1;
      // name
      ctx.font = `${b.isPlayer ? 15 : 13}px "Lilita One", "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#1b0f33';
      ctx.lineJoin = 'round';
      const nameCol = b.isPlayer ? '#ffffff' : b.team === 0 ? '#9cd0ff' : '#ffb0bb';
      ctx.strokeText(b.name, sx, y0 - 5);
      ctx.fillStyle = nameCol;
      ctx.fillText(b.name, sx, y0 - 5);
      // bar
      roundRect(ctx, x0 - 2, y0 - 2, bw + 4, bh + 4, 6);
      ctx.fillStyle = '#1b0f33';
      ctx.fill();
      const frac = clamp(b.hp / b.maxHp, 0, 1);
      const fill = b.isPlayer ? '#4dff8f' : b.team === 0 ? '#36a3ff' : '#ff3d5a';
      if (frac > 0) {
        roundRect(ctx, x0, y0, Math.max(6, bw * frac), bh, 4);
        ctx.fillStyle = fill;
        ctx.fill();
        roundRect(ctx, x0, y0, Math.max(6, bw * frac), bh * 0.45, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fill();
      }
      ctx.font = '12px "Lilita One", "Arial Black", sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeText(String(Math.ceil(b.hp)), sx, y0 + bh - 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(Math.ceil(b.hp)), sx, y0 + bh - 2);
      if (b.isPlayer) {
        const segW = (bw - 4) / 3;
        for (let i = 0; i < 3; i++) {
          const sxx = x0 + i * (segW + 2);
          roundRect(ctx, sxx, y0 + bh + 4, segW, 6, 3);
          ctx.fillStyle = '#1b0f33';
          ctx.fill();
          const f = clamp(b.ammo - i, 0, 1);
          if (f > 0) {
            roundRect(ctx, sxx + 1, y0 + bh + 5, (segW - 2) * f, 4, 2);
            ctx.fillStyle = f >= 1 ? '#ffa31a' : '#b8742a';
            ctx.fill();
          }
        }
      }
      if (b.superCharge >= 1 && !b.isPlayer) {
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(x0 - 8, y0 + bh / 2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1b0f33';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // floating numbers
    for (const t of this.texts) {
      const p = 1 - t.life / t.max;
      v.set(t.x + t.vx * p, t.y + p * 0.9, t.z).project(cam);
      if (v.z > 1) continue;
      const sx = (v.x + 1) * 0.5 * w;
      const sy = (1 - v.y) * 0.5 * h;
      const pop = p < 0.15 ? 0.6 + (p / 0.15) * 0.6 : 1.2 - Math.min(0.2, (p - 0.15) * 0.6);
      const size = Math.round(18 * t.size * pop);
      ctx.globalAlpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      ctx.font = `${size}px "Lilita One", "Arial Black", sans-serif`;
      ctx.lineWidth = Math.max(3, size * 0.22);
      ctx.strokeStyle = '#1b0f33';
      ctx.strokeText(t.text, sx, sy);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, sx, sy);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  summary() {
    const score = (b) => b.kills * 1000 + b.damage + b.healed * 0.8 + b.zoneTime * 150;
    let mvp = this.brawlers[0];
    for (const b of this.brawlers) if (score(b) > score(mvp)) mvp = b;
    return {
      result: this.result,
      mode: this.mode,
      map: this.mapDef,
      score: this.score.slice(),
      zone: this.zoneProg.map((v) => Math.round(v)),
      players: this.brawlers.map((b) => ({ name: b.name, hero: b.hero, team: b.team, isPlayer: b.isPlayer, kills: b.kills, deaths: b.deaths, damage: b.damage, healed: b.healed, mvp: b === mvp })),
      playerMvp: mvp.isPlayer,
    };
  }

  dispose() {
    this.rings.clear();
    this.scene.traverse((o) => {
      if (o.isMesh || o.isPoints || o.isInstancedMesh) {
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m.map) m.map.dispose();
            m.dispose();
          }
        }
      }
    });
    this.arena.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const k of Object.keys(this.G)) this.G[k].dispose();
    this.fxAdd.geo.dispose();
    this.fxPuff.geo.dispose();
    this.debris.mesh.geometry.dispose();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
