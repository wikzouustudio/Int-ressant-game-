// Particules instanciées + ondes de choc.
import * as THREE from 'three';

export class FX {
  constructor(scene, max = 700) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.p = [];
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const c = new THREE.Color();
    for (let i = 0; i < max; i++) {
      this.p.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0, g: 0, drag: 0 });
      this.mesh.setMatrixAt(i, zero);
      this.mesh.setColorAt(i, c.set(0xffffff));
    }
    this.next = 0;
    scene.add(this.mesh);
    this.m4 = new THREE.Matrix4();
    this.col = new THREE.Color();
    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.8, 1, 40);
    this.scene = scene;
  }

  spawn(x, y, z, vx, vy, vz, size, life, color, g = 0, drag = 1.5) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    const p = this.p[i];
    Object.assign(p, { x, y, z, vx, vy, vz, s: size, life, max: life, g, drag });
    this.mesh.setColorAt(i, this.col.set(color));
    this.mesh.instanceColor.needsUpdate = true;
  }

  burst(x, y, z, color, n = 12, speed = 4, size = 0.12, life = 0.5, o = {}) {
    const cols = Array.isArray(color) ? color : [color];
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const up = o.up ?? 0.6;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, z, Math.cos(a) * v, (Math.random() * up + (o.lift ?? 0.2)) * v, Math.sin(a) * v,
        size * (0.6 + Math.random() * 0.7), life * (0.6 + Math.random() * 0.6), cols[k % cols.length], o.g ?? -9, o.drag ?? 2);
    }
  }

  puff(x, y, z, color = 0xffffff, n = 6, size = 0.25) {
    for (let k = 0; k < n; k++) {
      this.spawn(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 1.2, 1 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2,
        size * (0.7 + Math.random() * 0.6), 0.6 + Math.random() * 0.4, color, 0, 2.5);
    }
  }

  ring(x, z, radius, color = 0xffffff, dur = 0.45) {
    let r = this.rings.find((o) => o.t >= o.dur);
    if (!r) {
      const mesh = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2;
      this.scene.add(mesh);
      r = { mesh, t: 0, dur };
      this.rings.push(r);
    }
    r.mesh.material.color.set(color);
    r.mesh.position.set(x, 0.08, z);
    r.radius = radius;
    r.t = 0;
    r.dur = dur;
    r.mesh.visible = true;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        this.m4.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m4);
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vz *= d; p.vy = p.vy * d + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.4; }
      const k = Math.pow(p.life / p.max, 0.6);
      const s = p.s * k;
      this.m4.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
      this.mesh.setMatrixAt(i, this.m4);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const r of this.rings) {
      if (r.t >= r.dur) { r.mesh.visible = false; continue; }
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      const s = r.radius * (0.3 + 0.7 * (1 - Math.pow(1 - k, 3)));
      r.mesh.scale.set(s, s, s);
      r.mesh.material.opacity = 0.9 * (1 - k);
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
    for (const r of this.rings) this.scene.remove(r.mesh);
  }
}
