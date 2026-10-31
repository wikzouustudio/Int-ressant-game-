// Particles (GPU points), debris chunks, shockwave rings and floating numbers.
import * as THREE from 'three';
import { toon } from './toon.js';

export class Particles {
  constructor(max, additive) {
    this.max = max;
    this.i = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.uniforms = { uScale: { value: 400 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `
        attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        uniform float uScale; varying vec3 vC; varying float vA;
        void main(){
          vC = aColor; vA = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: additive ? `
        varying vec3 vC; varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vC * a * vA * 1.4, 1.0);
          #include <colorspace_fragment>
        }` : `
        varying vec3 vC; varying float vA;
        void main(){
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          if (d > 0.5) discard;
          float edge = smoothstep(0.5, 0.42, d);
          float shade = 1.0 - smoothstep(0.0, 0.5, length(p + vec2(0.14, 0.14))) * 0.0 + (p.y > 0.08 ? -0.12 : 0.06);
          gl_FragColor = vec4(vC * shade, edge * vA);
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
    this.geo = g;
    this.tc = new THREE.Color();
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, color, grav = 0, drag = 0) {
    const i = this.i;
    this.i = (this.i + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.s0[i] = s0; this.s1[i] = s1;
    this.grav[i] = grav; this.drag[i] = drag;
    this.tc.set(color);
    this.col[i * 3] = this.tc.r; this.col[i * 3 + 1] = this.tc.g; this.col[i * 3 + 2] = this.tc.b;
    this.size[i] = s0;
    this.alpha[i] = 1;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        if (this.size[i] !== 0) this.size[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] = Math.max(0.03, this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt);
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s1[i] + (this.s0[i] - this.s1[i]) * k;
      this.alpha[i] = Math.min(1, k * 2.5);
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = true;
    a.aColor.needsUpdate = true;
    a.aSize.needsUpdate = true;
    a.aAlpha.needsUpdate = true;
  }
}

export class Debris {
  constructor(max = 140) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), toon('#ffffff', { rim: 0.2 }), max);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.items = [];
    this.i = 0;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const c = new THREE.Color('#ffffff');
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, zero);
      this.mesh.setColorAt(i, c);
      this.items.push({ life: 0 });
    }
  }
  emit(x, y, z, vx, vy, vz, size, color, life = 1.2) {
    const i = this.i;
    this.i = (this.i + 1) % this.max;
    Object.assign(this.items[i], { x, y, z, vx, vy, vz, size, life, maxLife: life, rx: Math.random() * 6, ry: Math.random() * 6, wx: (Math.random() - 0.5) * 14, wy: (Math.random() - 0.5) * 14 });
    this.mesh.setColorAt(i, new THREE.Color(color));
    this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      const p = this.items[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt;
      p.vy -= 22 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.size * 0.5) {
        p.y = p.size * 0.5;
        p.vy *= -0.35;
        p.vx *= 0.6; p.vz *= 0.6;
        p.wx *= 0.6; p.wy *= 0.6;
      }
      p.rx += p.wx * dt; p.ry += p.wy * dt;
      const k = Math.min(1, p.life / (p.maxLife * 0.35));
      const s = p.life > 0 ? p.size * k : 0;
      this.q.setFromEuler(this.e.set(p.rx, p.ry, 0));
      this.m.compose(this.v.set(p.x, p.y, p.z), this.q, this.s.set(s, s, s));
      this.mesh.setMatrixAt(i, this.m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Rings {
  constructor(scene) {
    this.scene = scene;
    this.geo = new THREE.RingGeometry(0.82, 1, 48);
    this.list = [];
  }
  emit(x, z, r0, r1, color, life = 0.4, y = 0.05, opacity = 0.9) {
    const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 4;
    this.scene.add(m);
    this.list.push({ m, r0, r1, life, maxLife: life, opacity });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const r = this.list[i];
      r.life -= dt;
      const p = 1 - Math.max(0, r.life / r.maxLife);
      const e = 1 - Math.pow(1 - p, 3);
      const s = r.r0 + (r.r1 - r.r0) * e;
      r.m.scale.set(s, s, s);
      r.m.material.opacity = r.opacity * (1 - p);
      if (r.life <= 0) {
        this.scene.remove(r.m);
        r.m.material.dispose();
        this.list.splice(i, 1);
      }
    }
  }
  clear() {
    for (const r of this.list) {
      this.scene.remove(r.m);
      r.m.material.dispose();
    }
    this.list.length = 0;
  }
}
