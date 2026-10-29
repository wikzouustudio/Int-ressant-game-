import * as THREE from 'three';

const MAX_COINS = 220;
const MAX_PUFFS = 320;
const _v = new THREE.Vector3();
const _d = new THREE.Object3D();

export class Effects {
  constructor(scene, camera, layer) {
    this.scene = scene;
    this.camera = camera;
    this.layer = layer;

    // ---- Coins ----
    const coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 14);
    const coinMat = new THREE.MeshStandardMaterial({ color: '#ffc83d', metalness: 1, roughness: 0.25, emissive: '#5a3a00', emissiveIntensity: 0.4 });
    this.coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, MAX_COINS);
    this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coinMesh.frustumCulled = false;
    this.coinMesh.castShadow = true;
    this.coins = [];
    scene.add(this.coinMesh);

    // ---- Puffs (smoke / dust / sparkle) ----
    const puffGeo = new THREE.IcosahedronGeometry(0.5, 0);
    puffGeo.computeVertexNormals();
    const puffMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true });
    this.puffMesh = new THREE.InstancedMesh(puffGeo, puffMat, MAX_PUFFS);
    this.puffMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.puffMesh.frustumCulled = false;
    this.puffMesh.setColorAt(0, new THREE.Color());
    this.puffs = [];
    scene.add(this.puffMesh);

    this.floats = [];
    this.clear();
  }

  clear() {
    _d.scale.setScalar(0);
    _d.updateMatrix();
    for (let i = 0; i < MAX_COINS; i++) this.coinMesh.setMatrixAt(i, _d.matrix);
    for (let i = 0; i < MAX_PUFFS; i++) this.puffMesh.setMatrixAt(i, _d.matrix);
  }

  coinBurst(pos, n = 6, power = 1) {
    for (let i = 0; i < n; i++) {
      if (this.coins.length >= MAX_COINS) this.coins.shift();
      const a = Math.random() * Math.PI * 2;
      const s = (1.5 + Math.random() * 2.5) * power;
      this.coins.push({
        p: pos.clone(),
        v: new THREE.Vector3(Math.cos(a) * s, 6 + Math.random() * 5 * power, Math.sin(a) * s),
        r: new THREE.Euler(Math.random() * 3, Math.random() * 3, 0),
        w: new THREE.Vector3(Math.random() * 12, Math.random() * 12, 0),
        life: 0,
        max: 1.1 + Math.random() * 0.5,
        ground: pos.y - 0.6,
      });
    }
  }

  /** opts: { color, size, life, up, spread, count, grow } */
  puff(pos, opts = {}) {
    const count = opts.count || 1;
    const col = new THREE.Color(opts.color || '#e9ecef');
    for (let i = 0; i < count; i++) {
      if (this.puffs.length >= MAX_PUFFS) this.puffs.shift();
      const sp = opts.spread ?? 0.3;
      this.puffs.push({
        p: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * sp, (Math.random() - 0.5) * sp * 0.3, (Math.random() - 0.5) * sp)),
        v: new THREE.Vector3((Math.random() - 0.5) * (opts.radial ?? 0.4), (opts.up ?? 1.4) * (0.7 + Math.random() * 0.6), (Math.random() - 0.5) * (opts.radial ?? 0.4)),
        size: (opts.size || 1) * (0.7 + Math.random() * 0.6),
        life: 0,
        max: (opts.life || 2.5) * (0.8 + Math.random() * 0.4),
        rot: Math.random() * 6,
        col,
        grow: opts.grow ?? 1.8,
      });
    }
  }

  dust(pos, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.puff(pos.clone().add(new THREE.Vector3(Math.cos(a) * 5, 0.3, Math.sin(a) * 5)), {
        color: '#d9cbb3', size: 1.6, life: 1.3, up: 1.2, spread: 1.5, radial: 3, grow: 1.4,
      });
    }
  }

  sparkle(pos, color = '#ffe066', n = 12) {
    for (let i = 0; i < n; i++) {
      this.puff(pos, { color, size: 0.35, life: 0.9, up: 4, spread: 1.2, radial: 5, grow: -0.9 });
    }
  }

  float(pos, text, cls = '') {
    if (this.floats.length > 70) {
      const old = this.floats.shift();
      old.el.remove();
    }
    const el = document.createElement('div');
    el.className = 'float-text ' + cls;
    el.innerHTML = text;
    this.layer.appendChild(el);
    this.floats.push({ el, p: pos.clone(), life: 0, max: 1.6 });
  }

  update(dt) {
    // coins
    let i = 0;
    for (let k = this.coins.length - 1; k >= 0; k--) {
      const c = this.coins[k];
      c.life += dt;
      if (c.life >= c.max) { this.coins.splice(k, 1); continue; }
      c.v.y -= 22 * dt;
      c.p.addScaledVector(c.v, dt);
      if (c.p.y < c.ground) { c.p.y = c.ground; c.v.y *= -0.35; c.v.x *= 0.6; c.v.z *= 0.6; }
      c.r.x += c.w.x * dt; c.r.y += c.w.y * dt;
    }
    for (const c of this.coins) {
      const s = Math.min(1, (c.max - c.life) * 4);
      _d.position.copy(c.p);
      _d.rotation.copy(c.r);
      _d.scale.setScalar(s);
      _d.updateMatrix();
      this.coinMesh.setMatrixAt(i++, _d.matrix);
    }
    _d.scale.setScalar(0); _d.updateMatrix();
    for (; i < (this.coinMesh.userData.lastCount || 0); i++) this.coinMesh.setMatrixAt(i, _d.matrix);
    this.coinMesh.userData.lastCount = this.coins.length;
    this.coinMesh.instanceMatrix.needsUpdate = true;

    // puffs
    i = 0;
    for (let k = this.puffs.length - 1; k >= 0; k--) {
      const p = this.puffs[k];
      p.life += dt;
      if (p.life >= p.max) { this.puffs.splice(k, 1); continue; }
      p.p.addScaledVector(p.v, dt);
      p.v.multiplyScalar(1 - dt * 0.6);
    }
    for (const p of this.puffs) {
      const t = p.life / p.max;
      const s = p.size * Math.max(0.01, (1 + p.grow * t) * Math.sin(Math.min(1, t * 6) * Math.PI * 0.5) * (1 - Math.pow(t, 3)));
      _d.position.copy(p.p);
      _d.rotation.set(p.rot + t, p.rot * 0.5 + t, 0);
      _d.scale.setScalar(s);
      _d.updateMatrix();
      this.puffMesh.setMatrixAt(i, _d.matrix);
      this.puffMesh.setColorAt(i, p.col);
      i++;
    }
    _d.scale.setScalar(0); _d.updateMatrix();
    for (; i < (this.puffMesh.userData.lastCount || 0); i++) this.puffMesh.setMatrixAt(i, _d.matrix);
    this.puffMesh.userData.lastCount = this.puffs.length;
    this.puffMesh.instanceMatrix.needsUpdate = true;
    if (this.puffMesh.instanceColor) this.puffMesh.instanceColor.needsUpdate = true;

    // floating texts
    const w = window.innerWidth, h = window.innerHeight;
    for (let k = this.floats.length - 1; k >= 0; k--) {
      const f = this.floats[k];
      f.life += dt;
      if (f.life >= f.max) { f.el.remove(); this.floats.splice(k, 1); continue; }
      _v.copy(f.p);
      _v.y += f.life * 2.2;
      _v.project(this.camera);
      if (_v.z > 1) { f.el.style.opacity = 0; continue; }
      const x = (_v.x * 0.5 + 0.5) * w;
      const y = (-_v.y * 0.5 + 0.5) * h;
      const t = f.life / f.max;
      const sc = t < 0.15 ? 0.6 + t / 0.15 * 0.5 : 1.1 - Math.min(0.1, (t - 0.15));
      f.el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) scale(${sc})`;
      f.el.style.opacity = t > 0.7 ? (1 - t) / 0.3 : 1;
    }
  }
}
