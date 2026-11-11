// Fiche héros façon "concept art" : fond uni, éclairage studio, vue de trois quarts, pose dynamique.
import * as THREE from 'three';
import { HEROES, buildHero } from './heroes.js';
import { setOutline } from './toon.js';

export class Showcase {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(27, 1, 0.1, 60);
    this.rot = -0.55;
    this.auto = false;
    this.dragging = false;
    this.active = false;

    // Éclairage studio : clé chaude, débouchage froid, deux contre-jours
    const hemi = new THREE.HemisphereLight(0xffffff, 0x9a7a9a, 0.75);
    const key = new THREE.DirectionalLight(0xfff0dd, 3.1);
    key.position.set(-3, 5.5, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -2.2, right: 2.2, top: 3, bottom: -1, near: 1, far: 16 });
    key.shadow.bias = -0.0015;
    key.shadow.radius = 4;
    const fill = new THREE.DirectionalLight(0xc4d8ff, 1.0);
    fill.position.set(4, 1.5, 3);
    const rimR = new THREE.DirectionalLight(0xffffff, 3.2);
    rimR.position.set(3.2, 3, -4);
    const rimL = new THREE.DirectionalLight(0xfff0d0, 2.2);
    rimL.position.set(-3.6, 2.2, -3);
    this.scene.add(hemi, key, fill, rimR, rimL);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.2 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.45)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.005;
    this.scene.add(blob);

    const el = app.canvas;
    el.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      this.dragging = true;
      this.dragX = e.clientX;
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.rot += (e.clientX - this.dragX) * 0.012;
      this.dragX = e.clientX;
    });
    window.addEventListener('pointerup', () => { this.dragging = false; });
  }

  setHero(id) {
    if (this.rig) this.scene.remove(this.rig.root);
    this.heroId = id;
    this.rig = buildHero(id);
    this.rig.mode = 'pose';
    this.rig.root.traverse((o) => { if (o.isMesh && !o.userData.outline) o.castShadow = true; });
    this.scene.add(this.rig.root);
    this.scene.background = new THREE.Color(HEROES[id].bg);
    this.rot = -0.55;
    this.rig.update(0.016);
  }

  update(dt) {
    if (this.auto && !this.dragging) this.rot += dt * 0.7;
    if (this.rig) {
      this.rig.root.rotation.y = this.rot;
      this.rig.update(dt, { move: 0 });
    }
  }

  frame(w, h, sheet = false) {
    const asp = w / h;
    this.camera.aspect = asp;
    const wide = asp > 1.15;
    const tall = HEROES[this.heroId]?.id === 'volta' ? 1.12 : 1;
    if (sheet) {
      this.camera.position.set(0, 1.2, 7.1 * tall);
      this.camera.lookAt(0, 1.0, 0);
      this.camera.setViewOffset(w, h, -w * 0.13, 0, w, h);
    } else if (wide) {
      this.camera.position.set(0, 1.2, 6.2 * tall);
      this.camera.lookAt(0, 1.0, 0);
      this.camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
    } else {
      this.camera.position.set(0, 1.25, (asp < 0.75 ? 9.8 : 7.4) * tall);
      this.camera.lookAt(0, 1.0, 0);
      this.camera.setViewOffset(w, h, 0, h * 0.17, w, h);
    }
    this.camera.updateProjectionMatrix();
  }

  resize(w, h) { this.w = w; this.h = h; this.frame(w, h); }

  render(renderer) {
    setOutline(3, renderer);
    renderer.render(this.scene, this.camera);
  }

  // Planche concept art 1920×1080 (rendu 3D + textes), renvoie un dataURL PNG.
  makeSheet(id) {
    const r = this.app.renderer;
    const W = 1920, H = 1080;
    const prevPR = r.getPixelRatio();
    const prevId = this.heroId, prevRot = this.rot;
    if (id !== this.heroId) this.setHero(id);
    this.rot = -0.55;
    this.rig.root.rotation.y = this.rot;
    this.rig.update(0.016);
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    this.frame(W, H, true);
    this.render(r);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.drawImage(r.domElement, 0, 0, W, H);
    drawSheetText(g, HEROES[id], W, H);
    const url = cv.toDataURL('image/png');
    r.setPixelRatio(prevPR);
    this.app.resize();
    if (prevId && prevId !== id) this.setHero(prevId);
    this.rot = prevRot;
    return url;
  }
}

const INK = '#1b1236';
const DISPLAY = '"Luckiest Guy", "Arial Rounded MT Bold", sans-serif';
const BODY = '"Baloo 2", "Trebuchet MS", sans-serif';

function outlined(g, text, x, y, fill, stroke, lw) {
  g.lineJoin = 'round';
  g.lineWidth = lw;
  g.strokeStyle = stroke;
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y);
      y += lh;
      line = w;
    } else line = test;
  }
  if (line) g.fillText(line, x, y);
  return y + lh;
}

function chip(g, text, x, y, bg, fg) {
  g.font = `700 26px ${BODY}`;
  const w = g.measureText(text).width + 36;
  g.fillStyle = INK;
  g.beginPath(); g.roundRect(x, y + 4, w, 44, 22); g.fill();
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(x, y, w, 44, 22); g.fill();
  g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  g.fillStyle = fg;
  g.fillText(text, x + 18, y + 31);
  return x + w + 14;
}

function drawSheetText(g, h, W, H) {
  const x = 110;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  // Bandeau
  g.font = `400 34px ${DISPLAY}`;
  const eb = h.isNew ? 'NOUVEAU HÉROS' : 'FICHE HÉROS';
  const ew = g.measureText(eb).width + 40;
  g.fillStyle = INK;
  g.save();
  g.translate(x, 120);
  g.rotate(-0.03);
  g.beginPath(); g.roundRect(0, 6, ew, 54, 10); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.roundRect(0, 0, ew, 54, 10); g.fill();
  g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
  g.fillStyle = h.color;
  g.fillText(eb, 20, 42);
  g.restore();

  g.font = `400 176px ${DISPLAY}`;
  g.fillStyle = INK;
  g.fillText(h.name, x + 4, 352);
  outlined(g, h.name, x, 342, '#ffffff', INK, 14);
  g.font = `800 46px ${BODY}`;
  g.fillStyle = INK;
  g.fillText(h.title, x + 4, 410);

  let cx = chip(g, h.rarity.toUpperCase(), x, 440, '#ffd23f', INK);
  cx = chip(g, h.role.toUpperCase(), cx, 440, h.color, '#ffffff');

  g.font = `600 27px ${BODY}`;
  g.fillStyle = INK;
  let y = wrap(g, h.bio, x, 545, 640, 38);

  const blocks = [['ATTAQUE', h.attack], ['SUPER', h.super], ['TRAIT', h.trait]];
  y += 18;
  for (const [lab, a] of blocks) {
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.roundRect(x - 16, y - 34, 672, 92, 16); g.fill();
    g.font = `400 24px ${DISPLAY}`;
    g.fillStyle = h.color;
    g.fillText(lab, x, y);
    g.font = `800 28px ${BODY}`;
    g.fillStyle = INK;
    g.fillText(a.name, x + 150, y);
    g.font = `600 22px ${BODY}`;
    wrap(g, a.desc, x, y + 32, 640, 26);
    y += 108;
  }

  // Palette en colonne, à droite du personnage
  const px = W - 125;
  g.textAlign = 'center';
  g.font = `400 24px ${DISPLAY}`;
  g.fillStyle = INK;
  g.fillText('PALETTE', px, 200);
  h.palette.forEach(([name, hex], i) => {
    const sy = 262 + i * 128;
    g.fillStyle = INK;
    g.beginPath(); g.arc(px, sy + 4, 38, 0, Math.PI * 2); g.fill();
    g.fillStyle = hex;
    g.beginPath(); g.arc(px, sy, 34, 0, Math.PI * 2); g.fill();
    g.font = `700 19px ${BODY}`;
    g.fillStyle = INK;
    g.fillText(name, px, sy + 64);
  });
  g.textAlign = 'right';
  g.font = `400 24px ${DISPLAY}`;
  g.fillStyle = 'rgba(27,18,54,0.55)';
  g.fillText('RUMBLE POP · CONCEPT ART', W - 60, H - 48);
  g.textAlign = 'left';
}
