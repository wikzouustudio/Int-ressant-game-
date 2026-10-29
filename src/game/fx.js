import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Pooled visual effects: coins, smoke/dust/sparkle puffs (GPU-instanced) and floating
// HTML labels. Nothing is allocated per particle at runtime: particle records, colours
// and DOM nodes are recycled, and the instanced meshes only draw the live instances.

const MAX_COINS = 220;
const MAX_PUFFS = 320;
const MAX_FLOATS = 48;
const MAX_DEBRIS = 260;
const _v = new THREE.Vector3();
const _d = new THREE.Object3D();
const colorCache = new Map();
const colorOf = (hex) => {
  let c = colorCache.get(hex);
  if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c); }
  return c;
};

function makePool(n, make) {
  const items = new Array(n);
  for (let i = 0; i < n; i++) items[i] = make();
  return { items, n: 0 };
}

export class Effects {
  constructor(scene, camera, layer) {
    this.scene = scene;
    this.camera = camera;
    this.layer = layer;
    this.density = 1; // particle density multiplier (quality tier)

    // ---- Coins ----
    const coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 14);
    const coinMat = new THREE.MeshStandardMaterial({ color: '#ffc83d', metalness: 1, roughness: 0.25, emissive: '#5a3a00', emissiveIntensity: 0.4 });
    this.coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, MAX_COINS);
    this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coinMesh.frustumCulled = false;
    this.coinMesh.count = 0;
    scene.add(this.coinMesh);
    this.coinPool = makePool(MAX_COINS, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), wx: 0, wy: 0, life: 0, max: 1, ground: 0 }));

    // ---- Puffs (smoke / dust / sparkle) ----
    const puffGeo = new THREE.IcosahedronGeometry(0.5, 0);
    puffGeo.computeVertexNormals();
    const puffMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true });
    this.puffMesh = new THREE.InstancedMesh(puffGeo, puffMat, MAX_PUFFS);
    this.puffMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.puffMesh.frustumCulled = false;
    this.puffMesh.setColorAt(0, new THREE.Color());
    this.puffMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.puffMesh.count = 0;
    scene.add(this.puffMesh);
    this.puffPool = makePool(MAX_PUFFS, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), size: 1, life: 0, max: 1, rot: 0, col: null, grow: 1 }));

    // ---- Debris chunks (demolition / construction): rounded rubble with physics ----
    const debGeo = new RoundedBoxGeometry(1, 1, 1, 1, 0.16);
    const debMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
    this.debMesh = new THREE.InstancedMesh(debGeo, debMat, MAX_DEBRIS);
    this.debMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debMesh.frustumCulled = false;
    this.debMesh.castShadow = true;
    this.debMesh.setColorAt(0, new THREE.Color());
    this.debMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.debMesh.count = 0;
    scene.add(this.debMesh);
    this.debPool = makePool(MAX_DEBRIS, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), life: 0, max: 2, ground: 0, col: null }));

    // ---- Floating labels (recycled DOM nodes) ----
    this.floatPool = makePool(MAX_FLOATS, () => {
      const el = document.createElement('div');
      el.className = 'float-text';
      el.style.display = 'none';
      layer.appendChild(el);
      return { el, p: new THREE.Vector3(), life: 0, max: 1.6 };
    });
  }

  get activeParticles() { return this.puffPool.n + this.coinPool.n + this.debPool.n; }

  /** Chunks of material bursting from `pos` toward `dir` (Vector3, roughly normalised). */
  debris(pos, color, n = 8, dir = null, power = 1, ground = 0.25) {
    n = Math.max(2, Math.round(n * this.density));
    const pool = this.debPool;
    const col = colorOf(color);
    for (let i = 0; i < n; i++) {
      const d = pool.n < MAX_DEBRIS ? pool.items[pool.n++] : pool.items[(Math.random() * MAX_DEBRIS) | 0];
      d.p.set(pos.x + (Math.random() - 0.5) * 0.8, pos.y + (Math.random() - 0.5) * 0.8, pos.z + (Math.random() - 0.5) * 0.8);
      const a = Math.random() * Math.PI * 2;
      const sp = (1.5 + Math.random() * 3) * power;
      d.v.set(Math.cos(a) * sp, 2 + Math.random() * 4 * power, Math.sin(a) * sp);
      if (dir) d.v.addScaledVector(dir, 3 * power);
      d.r.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      d.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      const k = 0.18 + Math.random() * 0.45;
      d.s.set(k * (0.7 + Math.random() * 0.6), k * (0.5 + Math.random() * 0.6), k * (0.7 + Math.random() * 0.6));
      d.life = 0;
      d.max = 2.2 + Math.random() * 1.2;
      d.ground = ground + d.s.y / 2;
      d.col = col;
    }
  }

  clearAll() {
    this.puffPool.n = 0;
    this.coinPool.n = 0;
    for (let i = 0; i < this.floatPool.n; i++) this.floatPool.items[i].el.style.display = 'none';
    this.floatPool.n = 0;
  }

  coinBurst(pos, n = 6, power = 1) {
    n = Math.max(1, Math.round(n * this.density));
    const pool = this.coinPool;
    for (let i = 0; i < n; i++) {
      const c = pool.n < MAX_COINS ? pool.items[pool.n++] : pool.items[(Math.random() * MAX_COINS) | 0];
      const a = Math.random() * Math.PI * 2;
      const s = (1.5 + Math.random() * 2.5) * power;
      c.p.copy(pos);
      c.v.set(Math.cos(a) * s, 6 + Math.random() * 5 * power, Math.sin(a) * s);
      c.r.set(Math.random() * 3, Math.random() * 3, 0);
      c.wx = Math.random() * 12;
      c.wy = Math.random() * 12;
      c.life = 0;
      c.max = 1.1 + Math.random() * 0.5;
      c.ground = pos.y - 0.6;
    }
  }

  /** opts: { color, size, life, up, spread, count, grow, radial } */
  puff(pos, opts = {}) {
    let count = opts.count || 1;
    if (this.density < 1) {
      if (count === 1) { if (Math.random() > this.density) return; } else count = Math.max(1, Math.round(count * this.density));
    }
    const col = colorOf(opts.color || '#e9ecef');
    const pool = this.puffPool;
    const sp = opts.spread ?? 0.3;
    const rad = opts.radial ?? 0.4;
    const up = opts.up ?? 1.4;
    for (let i = 0; i < count; i++) {
      const p = pool.n < MAX_PUFFS ? pool.items[pool.n++] : pool.items[(Math.random() * MAX_PUFFS) | 0];
      p.p.set(pos.x + (Math.random() - 0.5) * sp, pos.y + (Math.random() - 0.5) * sp * 0.3, pos.z + (Math.random() - 0.5) * sp);
      p.v.set((Math.random() - 0.5) * rad, up * (0.7 + Math.random() * 0.6), (Math.random() - 0.5) * rad);
      p.size = (opts.size || 1) * (0.7 + Math.random() * 0.6);
      p.life = 0;
      p.max = (opts.life || 2.5) * (0.8 + Math.random() * 0.4);
      p.rot = Math.random() * 6;
      p.col = col;
      p.grow = opts.grow ?? 1.8;
    }
  }

  dust(pos, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      _v.set(pos.x + Math.cos(a) * 5, pos.y + 0.3, pos.z + Math.sin(a) * 5);
      this.puff(_v, { color: '#d9cbb3', size: 1.6, life: 1.3, up: 1.2, spread: 1.5, radial: 3, grow: 1.4 });
    }
  }

  sparkle(pos, color = '#ffe066', n = 12) {
    this.puff(pos, { color, size: 0.35, life: 0.9, up: 4, spread: 1.2, radial: 5, grow: -0.9, count: n });
  }

  float(pos, html, cls = '') {
    const pool = this.floatPool;
    let f;
    if (pool.n < MAX_FLOATS) f = pool.items[pool.n++];
    else { // recycle the oldest label
      f = pool.items[0];
      pool.items.copyWithin(0, 1, MAX_FLOATS);
      pool.items[MAX_FLOATS - 1] = f;
    }
    f.el.className = 'float-text ' + cls;
    f.el.innerHTML = html;
    f.el.style.display = '';
    f.el.style.opacity = 0;
    f.p.copy(pos);
    f.life = 0;
  }

  update(dt) {
    // coins
    const cp = this.coinPool;
    for (let k = cp.n - 1; k >= 0; k--) {
      const c = cp.items[k];
      c.life += dt;
      if (c.life >= c.max) { // swap-remove keeps the pool dense
        cp.items[k] = cp.items[cp.n - 1];
        cp.items[cp.n - 1] = c;
        cp.n--;
        continue;
      }
      c.v.y -= 22 * dt;
      c.p.addScaledVector(c.v, dt);
      if (c.p.y < c.ground) { c.p.y = c.ground; c.v.y *= -0.35; c.v.x *= 0.6; c.v.z *= 0.6; }
      c.r.x += c.wx * dt; c.r.y += c.wy * dt;
    }
    for (let i = 0; i < cp.n; i++) {
      const c = cp.items[i];
      _d.position.copy(c.p);
      _d.rotation.copy(c.r);
      _d.scale.setScalar(Math.min(1, (c.max - c.life) * 4));
      _d.updateMatrix();
      this.coinMesh.setMatrixAt(i, _d.matrix);
    }
    this.coinMesh.count = cp.n;
    this.coinMesh.visible = cp.n > 0;
    if (cp.n) this.coinMesh.instanceMatrix.needsUpdate = true;

    // puffs
    const pp = this.puffPool;
    const drag = 1 - dt * 0.6;
    for (let k = pp.n - 1; k >= 0; k--) {
      const p = pp.items[k];
      p.life += dt;
      if (p.life >= p.max) {
        pp.items[k] = pp.items[pp.n - 1];
        pp.items[pp.n - 1] = p;
        pp.n--;
        continue;
      }
      p.p.addScaledVector(p.v, dt);
      p.v.multiplyScalar(drag);
    }
    for (let i = 0; i < pp.n; i++) {
      const p = pp.items[i];
      const t = p.life / p.max;
      const s = p.size * Math.max(0.01, (1 + p.grow * t) * Math.sin(Math.min(1, t * 6) * Math.PI * 0.5) * (1 - t * t * t));
      _d.position.copy(p.p);
      _d.rotation.set(p.rot + t, p.rot * 0.5 + t, 0);
      _d.scale.setScalar(s);
      _d.updateMatrix();
      this.puffMesh.setMatrixAt(i, _d.matrix);
      this.puffMesh.setColorAt(i, p.col);
    }
    this.puffMesh.count = pp.n;
    this.puffMesh.visible = pp.n > 0;
    if (pp.n) {
      this.puffMesh.instanceMatrix.needsUpdate = true;
      this.puffMesh.instanceColor.needsUpdate = true;
    }

    // debris (gravity, bounce, ground friction, shrink at end of life)
    const dp = this.debPool;
    for (let k = dp.n - 1; k >= 0; k--) {
      const d = dp.items[k];
      d.life += dt;
      if (d.life >= d.max) {
        dp.items[k] = dp.items[dp.n - 1];
        dp.items[dp.n - 1] = d;
        dp.n--;
        continue;
      }
      d.v.y -= 20 * dt;
      d.p.addScaledVector(d.v, dt);
      if (d.p.y < d.ground) {
        d.p.y = d.ground;
        d.v.y *= -0.3;
        d.v.x *= 0.55; d.v.z *= 0.55;
        d.w.multiplyScalar(0.6);
      }
      d.r.x += d.w.x * dt; d.r.y += d.w.y * dt; d.r.z += d.w.z * dt;
    }
    for (let i = 0; i < dp.n; i++) {
      const d = dp.items[i];
      const fade = Math.min(1, (d.max - d.life) * 2.5);
      _d.position.copy(d.p);
      _d.rotation.copy(d.r);
      _d.scale.copy(d.s).multiplyScalar(fade);
      _d.updateMatrix();
      this.debMesh.setMatrixAt(i, _d.matrix);
      this.debMesh.setColorAt(i, d.col);
    }
    this.debMesh.count = dp.n;
    this.debMesh.visible = dp.n > 0;
    if (dp.n) {
      this.debMesh.instanceMatrix.needsUpdate = true;
      this.debMesh.instanceColor.needsUpdate = true;
    }

    // floating labels
    const fp = this.floatPool;
    const w = window.innerWidth, h = window.innerHeight;
    for (let k = fp.n - 1; k >= 0; k--) {
      const f = fp.items[k];
      f.life += dt;
      if (f.life >= f.max) {
        f.el.style.display = 'none';
        fp.items.splice(k, 1);
        fp.items.push(f);
        fp.n--;
        continue;
      }
      _v.copy(f.p);
      _v.y += f.life * 2.2;
      _v.project(this.camera);
      if (_v.z > 1) { f.el.style.opacity = 0; continue; }
      const x = (_v.x * 0.5 + 0.5) * w;
      const y = (-_v.y * 0.5 + 0.5) * h;
      const t = f.life / f.max;
      const sc = t < 0.15 ? 0.6 + (t / 0.15) * 0.5 : 1.1 - Math.min(0.1, t - 0.15);
      f.el.style.transform = `translate(-50%,-50%) translate(${x | 0}px,${y | 0}px) scale(${sc.toFixed(3)})`;
      f.el.style.opacity = t > 0.7 ? (1 - t) / 0.3 : 1;
    }
  }
}
