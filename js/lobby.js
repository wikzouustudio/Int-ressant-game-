// Scène 3D du lobby : héros sur son socle, lanternes du marché de nuit, confettis.
import * as THREE from 'three';
import { buildHero } from './heroes.js';
import { GEO, outlineGeometry, outlineMaterial, setOutline } from './toon.js';

export class Lobby {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    this.camera.position.set(0, 1.95, 7.7);
    this.camera.lookAt(0, 1.5, 0);
    this.t = 0;
    this.rot = 0.35;
    this.rotVel = 0;
    this.dragging = false;
    this.offsetX = 0;

    const hemi = new THREE.HemisphereLight(0xffe9ff, 0x4a2a7a, 1.1);
    const key = new THREE.DirectionalLight(0xfff0e0, 2.9);
    key.position.set(-3, 5, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: 1, far: 15 });
    key.shadow.bias = -0.002;
    const rim = new THREE.DirectionalLight(0xff9ad6, 2.6);
    rim.position.set(3, 3, -4);
    const rim2 = new THREE.DirectionalLight(0x8fe9ff, 1.6);
    rim2.position.set(-3.5, 2.5, -3);
    this.scene.add(hemi, key, rim, rim2);

    // Socle à deux étages
    const ped = new THREE.Group();
    const mk = (geo, color, s, y, ol = true) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
      m.scale.set(...s);
      m.position.y = y;
      m.receiveShadow = true;
      if (ol) m.add(new THREE.Mesh(outlineGeometry(geo), outlineMaterial));
      ped.add(m);
      return m;
    };
    mk(GEO.cyl, 0x3a2a8a, [1.55, 0.22, 1.55], 0.11);
    mk(GEO.cyl, 0x19e3c8, [1.15, 0.2, 1.15], 0.32);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.05, 8, 64), new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffa000, emissiveIntensity: 0.5 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.42;
    ped.add(ring);
    this.lights = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const b = new THREE.Mesh(GEO.sph, new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
      b.scale.setScalar(0.045);
      b.position.set(Math.cos(a) * 1.56, 0.12, Math.sin(a) * 1.56);
      ped.add(b);
      this.lights.push(b);
    }
    this.scene.add(ped);
    this.pedTop = 0.42;

    // Guirlande de lanternes
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const x = -6 + i * 0.6;
      pts.push(new THREE.Vector3(x, 3.4 - Math.cos((x / 6) * Math.PI * 0.5) * 0.9, -3.2));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const string = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.015, 5, false), new THREE.MeshBasicMaterial({ color: 0x1b1236 }));
    this.scene.add(string);
    this.lanterns = [];
    const cols = [[0xff4a3d, 0xff2a00], [0xffc53a, 0xff8a00], [0xff6fae, 0xff2a7a], [0x19e3c8, 0x00a890]];
    for (let i = 0; i < 9; i++) {
      const p = curve.getPoint(0.06 + i * 0.11);
      const g = new THREE.Group();
      g.position.copy(p);
      const [c, e] = cols[i % cols.length];
      const body = new THREE.Mesh(GEO.sph, new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 0.9, roughness: 0.5 }));
      body.scale.set(0.26, 0.32, 0.26);
      body.position.y = -0.38;
      body.add(new THREE.Mesh(outlineGeometry(GEO.sph), outlineMaterial));
      const capM = new THREE.MeshStandardMaterial({ color: 0x2a1b3d });
      for (const y of [-0.08, -0.68]) {
        const cap = new THREE.Mesh(GEO.cyl, capM);
        cap.scale.set(0.12, 0.05, 0.12);
        cap.position.y = y;
        g.add(cap);
      }
      g.add(body);
      this.scene.add(g);
      this.lanterns.push(g);
    }

    // Confettis flottants
    this.confetti = [];
    const ccols = [0xffd23f, 0x19e3c8, 0xff4f9a, 0xff7a1a, 0xffffff];
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.05), new THREE.MeshBasicMaterial({ color: ccols[i % ccols.length], side: THREE.DoubleSide }));
      m.position.set((Math.random() - 0.5) * 9, Math.random() * 4, -1.5 - Math.random() * 3);
      m.userData.v = 0.15 + Math.random() * 0.25;
      m.userData.s = Math.random() * 6;
      this.scene.add(m);
      this.confetti.push(m);
    }

    const el = app.canvas;
    el.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      this.dragging = true;
      this.dragX = e.clientX;
      this.downX = e.clientX;
      this.downT = performance.now();
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.dragX;
      this.dragX = e.clientX;
      this.rot += dx * 0.012;
      this.rotVel = dx * 0.6;
    });
    window.addEventListener('pointerup', (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (Math.abs(e.clientX - this.downX) < 6 && performance.now() - this.downT < 300) this.poke();
    });
  }

  setHero(id) {
    if (this.heroId === id && this.rig) return;
    if (this.rig) this.scene.remove(this.rig.root);
    this.heroId = id;
    this.rig = buildHero(id);
    this.rig.mode = 'idle';
    this.rig.root.traverse((o) => { if (o.isMesh && !o.userData.outline) o.castShadow = true; });
    this.rig.root.position.y = this.pedTop;
    this.rig.hop = 1;
    this.scene.add(this.rig.root);
  }

  poke() {
    if (!this.rig) return;
    this.rig.hop = 1;
    this.rig.squash = 0.25;
    this.poseT = 1.4;
    this.app.sfx('select');
  }

  update(dt) {
    this.t += dt;
    if (!this.dragging) {
      this.rotVel *= Math.exp(-dt * 4);
      this.rot += this.rotVel * dt;
      this.rot += (0.35 + Math.sin(this.t * 0.4) * 0.25 - this.rot) * dt * 0.6;
    }
    if (this.rig) {
      this.rig.root.rotation.y = this.rot;
      this.poseT = Math.max(0, (this.poseT || 0) - dt);
      this.rig.mode = this.poseT > 0 ? 'pose' : 'idle';
      this.rig.update(dt, { move: 0 });
    }
    this.lanterns.forEach((l, i) => { l.rotation.z = Math.sin(this.t * 1.2 + i) * 0.07; });
    this.lights.forEach((b, i) => { b.material.color.setHex(Math.sin(this.t * 4 + i * 0.8) > 0.3 ? 0xfff3b0 : 0xff8ad1); });
    for (const c of this.confetti) {
      c.position.y += c.userData.v * dt;
      c.rotation.x += dt * 2;
      c.rotation.y += dt * 1.3;
      c.position.x += Math.sin(this.t + c.userData.s) * dt * 0.2;
      if (c.position.y > 4.5) c.position.y = -0.5;
    }
  }

  resize(w, h) {
    const asp = w / h;
    this.camera.aspect = asp;
    this.camera.fov = asp < 0.8 ? 44 : asp < 1.3 ? 36 : 30;
    if (asp < 0.8) this.camera.setViewOffset(w, h, 0, -h * 0.02, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  render(renderer) {
    setOutline(2.6, renderer);
    renderer.setClearColor(0x000000, 0);
    renderer.render(this.scene, this.camera);
  }
}
