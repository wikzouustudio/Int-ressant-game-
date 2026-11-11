// Cerveau des bots : ciblage, déplacements par A*, esquive latérale, visée anticipée.
const rand = (a, b) => a + Math.random() * (b - a);

export class Brain {
  constructor(unit, game) {
    this.u = unit;
    this.g = game;
    this.skill = rand(0.45, 0.8);
    this.target = null;
    this.retargetT = 0;
    this.path = [];
    this.repathT = 0;
    this.goalKey = '';
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeT = 0;
    this.shootT = rand(0.3, 0.8);
    this.reactT = 0.5;
    this.retreating = false;
    this.roam = null;
    this.roamT = 0;
    this.stuckT = 0;
    this.lastPos = { x: unit.x, z: unit.z };
    this.jitter = { x: rand(-1.4, 1.4), z: rand(-1.4, 1.4) };
  }

  pickTarget() {
    const u = this.u, g = this.g;
    let best = null, bs = Infinity;
    for (const e of g.units) {
      if (e.team === u.team || !e.alive || !g.visibleTo(e, u.team)) continue;
      const d = Math.hypot(e.x - u.x, e.z - u.z);
      if (d > 13) continue;
      const s = d + (e.hp / e.maxHp) * 2.5 + (e === this.target ? -1.5 : 0);
      if (s < bs) { bs = s; best = e; }
    }
    if (best !== this.target) this.reactT = rand(0.2, 0.55) * (1.3 - this.skill);
    this.target = best;
  }

  think(dt) {
    const u = this.u, g = this.g, def = u.def;
    const out = { mx: 0, mz: 0, attack: null, superA: null };
    if (g.state !== 'play' || !u.alive || u.jump) return out;

    this.retargetT -= dt;
    this.shootT -= dt;
    this.reactT -= dt;
    if (this.retargetT <= 0 || (this.target && (!this.target.alive || !g.visibleTo(this.target, u.team)))) {
      this.retargetT = 0.35;
      this.pickTarget();
    }
    const T = this.target;
    const hpF = u.hp / u.maxHp;
    if (hpF < 0.32) this.retreating = true;
    else if (hpF > 0.8) this.retreating = false;

    let goal = null;
    let direct = null;

    if (T) {
      const dx = T.x - u.x, dz = T.z - u.z;
      const d = Math.hypot(dx, dz) || 0.001;
      const nx = dx / d, nz = dz / d;
      const los = g.arena.los(u.x, u.z, T.x, T.z);
      const pref = def.ai.pref;

      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeDir *= -1; this.strafeT = rand(0.5, 1.4); }

      if (this.retreating && d < 8) {
        direct = { x: -nx + -nz * this.strafeDir * 0.6, z: -nz + nx * this.strafeDir * 0.6 };
      } else if (d > pref + 1.5 || !los) {
        goal = { x: T.x, z: T.z };
      } else {
        const away = d < pref - 1.2 ? -1 : d > pref + 0.5 ? 0.6 : 0;
        direct = { x: nx * away - nz * this.strafeDir, z: nz * away + nx * this.strafeDir };
      }

      // Tir avec anticipation
      const range = def.attack.range;
      if (d <= range * 0.95 && los && u.ammo >= 1 && this.shootT <= 0 && this.reactT <= 0) {
        const tt = d / def.attack.speed;
        const px = T.x + T.vx * tt * 0.8, pz = T.z + T.vz * tt * 0.8;
        const a = Math.atan2(px - u.x, pz - u.z) + (Math.random() - 0.5) * 0.4 * (1 - this.skill);
        out.attack = { dx: Math.sin(a), dz: Math.cos(a) };
        this.shootT = u.ammo > 2.2 ? rand(0.25, 0.5) : rand(0.5, 1.1);
      }

      // Super
      if (u.superCharge >= 1 && this.reactT <= 0) {
        if (u.heroId === 'miso' && d <= 7.4) {
          const tt = 0.75;
          out.superA = { tx: T.x + T.vx * tt * 0.7, tz: T.z + T.vz * tt * 0.7 };
        } else if (u.heroId === 'volta' && d <= 10 && los) {
          out.superA = { tx: T.x, tz: T.z };
        } else if (u.heroId === 'bouldo' && d <= 6.2) {
          out.superA = { tx: T.x, tz: T.z };
        }
      }
    }

    if (u.heroId === 'pluma' && u.superCharge >= 1) {
      let best = null, bf = 0.6;
      for (const a of g.units) {
        if (a.team !== u.team || !a.alive) continue;
        const f = a.hp / a.maxHp;
        if (f < bf && Math.hypot(a.x - u.x, a.z - u.z) < 7.2) { bf = f; best = a; }
      }
      if (best) out.superA = { tx: best.x, tz: best.z };
    }

    // Objectifs quand aucune cible
    if (!T || (g.mode === 'zone' && !this.retreating && (!T || Math.hypot(T.x - u.x, T.z - u.z) > 6.5))) {
      if (g.mode === 'zone') {
        goal = { x: g.arena.zone.x + this.jitter.x, z: g.arena.zone.z + this.jitter.z };
        direct = null;
      } else if (!T) {
        this.roamT -= dt;
        if (!this.roam || this.roamT <= 0 || Math.hypot(this.roam.x - u.x, this.roam.z - u.z) < 1) {
          const side = u.team === 0 ? -1 : 1;
          this.roam = g.arena.nearestWalkable(rand(-8, 8), rand(-5, 9) * side * (Math.random() < 0.7 ? 1 : -0.3));
          this.roamT = rand(3, 6);
        }
        goal = this.roam;
      }
    }
    if (this.retreating && !direct) {
      const sp = g.arena.spawns[u.team][1];
      goal = { x: sp.x, z: sp.z };
    }

    let mv = direct;
    if (goal) mv = this.follow(goal, dt);
    if (mv) {
      const l = Math.hypot(mv.x, mv.z);
      if (l > 0.05) { out.mx = mv.x / l; out.mz = mv.z / l; }
    }

    // Évite les flaques de bouillon ennemies
    for (const a of g.areas) {
      if (a.dmg && a.team !== u.team && Math.hypot(a.x - u.x, a.z - u.z) < a.r + 0.6) {
        const dx = u.x - a.x, dz = u.z - a.z, l = Math.hypot(dx, dz) || 1;
        out.mx = dx / l; out.mz = dz / l;
      }
    }

    // Anti-blocage
    const moved = Math.hypot(u.x - this.lastPos.x, u.z - this.lastPos.z);
    if ((out.mx || out.mz) && moved < dt * 0.6) this.stuckT += dt;
    else this.stuckT = Math.max(0, this.stuckT - dt);
    if (this.stuckT > 0.6) {
      this.repathT = 0;
      this.strafeDir *= -1;
      const a = Math.random() * Math.PI * 2;
      out.mx = Math.cos(a); out.mz = Math.sin(a);
      if (this.stuckT > 1) this.stuckT = 0;
    }
    this.lastPos.x = u.x; this.lastPos.z = u.z;
    return out;
  }

  follow(goal, dt) {
    const u = this.u, g = this.g;
    this.repathT -= dt;
    const key = `${Math.round(goal.x)},${Math.round(goal.z)}`;
    if (this.repathT <= 0 || key !== this.goalKey) {
      this.path = g.arena.path(u.x, u.z, goal.x, goal.z);
      this.repathT = rand(0.5, 0.9);
      this.goalKey = key;
    }
    while (this.path.length && Math.hypot(this.path[0].x - u.x, this.path[0].z - u.z) < 0.35) this.path.shift();
    const p = this.path[0] || goal;
    const dx = p.x - u.x, dz = p.z - u.z;
    if (Math.hypot(dx, dz) < 0.25) return null;
    return { x: dx, z: dz };
  }
}
