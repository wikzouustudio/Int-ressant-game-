// Les héros de Rumble Pop : données de gameplay + modèles 3D cartoon construits en code.
import * as THREE from 'three';
import { GEO, capsule, torus, rbox, lathe, rockGeo, smileGeo, std, mesh, makeEye, SHINE } from './toon.js';

const PI = Math.PI;

// ---------------------------------------------------------------------------
// Squelette d'animation commun
// ---------------------------------------------------------------------------
export class Rig {
  constructor() {
    this.root = new THREE.Group();
    this.body = new THREE.Group(); // porte tout, sert aux sauts / rebonds
    this.root.add(this.body);
    this.hips = new THREE.Group();
    this.head = new THREE.Group();
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    this.body.add(this.hips, this.legL, this.legR);
    this.hips.add(this.head, this.armL, this.armR);
    this.eyes = [];
    this.mats = [];
    this.fx = {}; // pièces animées propres au héros
    this.t = Math.random() * 10;
    this.phase = 0;
    this.moveBlend = 0;
    this.blinkT = 1 + Math.random() * 3;
    this.recoil = 0;
    this.squash = 0;
    this.hop = 0;
    this.flashT = 0;
    this.flashDur = 0.1;
    this.flashColor = new THREE.Color();
    this.mode = 'idle'; // idle | game | pose
    this.base = { hipsY: 0.44, armLz: 0.3, armRz: -0.3, aimX: -1.3, idleArmX: -0.75, waddle: 0.06 };
    this.onUpdate = null;
    this.pose = null;
    this.wink = false;
  }

  M(color, o) {
    const m = std(color, o);
    m.userData.e0 = m.emissive.clone();
    this.mats.push(m);
    return m;
  }

  flash(hex = 0xffffff, dur = 0.12) {
    this.flashT = dur;
    this.flashDur = dur;
    this.flashColor.set(hex);
  }

  update(dt, st = {}) {
    this.t += dt;
    const b = this.base;
    const target = st.move || 0;
    this.moveBlend += (target - this.moveBlend) * Math.min(1, dt * 12);
    const m = this.moveBlend;
    if (m > 0.04) this.phase += dt * (7 + 6 * m);
    const s = Math.sin(this.phase);
    const breathe = Math.sin(this.t * 2.6);

    this.legL.rotation.set(s * 0.85 * m, 0, 0);
    this.legR.rotation.set(-s * 0.85 * m, 0, 0);

    this.squash *= Math.exp(-dt * 10);
    const sq = this.squash;
    this.hop = Math.max(0, this.hop - dt * 3.2);
    const hopY = Math.sin(this.hop * PI) * 0.35;
    this.body.position.y = hopY;
    this.hips.position.set(0, b.hipsY + Math.abs(Math.cos(this.phase)) * 0.07 * m + breathe * 0.012 * (1 - m), 0);
    this.hips.rotation.set(0.14 * m, 0, Math.sin(this.phase) * b.waddle * m);
    this.hips.scale.set(1 + sq * 0.6, 1 - sq + breathe * 0.012 * (1 - m), 1 + sq * 0.6);
    this.head.rotation.set(-0.06 * m, Math.sin(this.t * 0.7) * 0.08 * (1 - m), Math.sin(this.t * 1.3) * 0.05 * (1 - m));

    this.recoil *= Math.exp(-dt * 11);
    this.armL.rotation.set(-s * 0.8 * m + Math.sin(this.t * 2.6 + 1) * 0.05, 0, b.armLz);
    const aim = this.mode === 'game' ? b.aimX : b.idleArmX + Math.sin(this.t * 2.6) * 0.05;
    this.armR.rotation.set(aim + this.recoil * 0.7 + (this.mode === 'game' ? 0 : s * 0.3 * m), 0, b.armRz);

    this.blinkT -= dt;
    let eyeS = 1;
    if (this.blinkT < 0) {
      eyeS = 0.12;
      if (this.blinkT < -0.12) this.blinkT = 1.8 + Math.random() * 3.5;
    }
    for (const e of this.eyes) e.group.scale.y = eyeS;

    if (this.onUpdate) this.onUpdate(this, dt, m);
    if (this.mode === 'pose' && this.pose) this.pose(this, this.t);

    if (this.flashT > 0 || this._flashing) {
      this.flashT = Math.max(0, this.flashT - dt);
      const k = this.flashT / this.flashDur;
      for (const mat of this.mats) mat.emissive.copy(mat.userData.e0).lerp(this.flashColor, k * 0.85);
      this._flashing = this.flashT > 0;
    }
  }
}

// Base humanoïde (jambes, torse, bras, tête + visage) partagée par Miso et Volta.
function humanBase(R, c) {
  const mSkin = R.M(c.skin);
  const mTop = R.M(c.top);
  const mPants = R.M(c.pants, { r: 0.6 });
  const mShoe = R.M(c.shoe);
  const mSole = R.M(c.sole ?? 0xffffff, { r: 0.3 });
  const mHand = c.hand ? R.M(c.hand) : mSkin;
  const mSleeve = c.sleeve ? R.M(c.sleeve) : mTop;
  const mInk = R.M(0x3a0e22, { r: 0.5 });
  const eyeMats = { white: R.M(0xffffff, { r: 0.2 }), pupil: R.M(0x1b1236, { r: 0.15 }) };

  for (const [leg, sx] of [[R.legL, 1], [R.legR, -1]]) {
    leg.position.set(0.14 * sx, 0.44, 0);
    mesh(capsule(0.105, 0.16), mPants, { p: [0, -0.17, 0], parent: leg });
    mesh(GEO.sph, mShoe, { p: [0, -0.355, 0.05], s: [0.15, 0.11, 0.21], parent: leg });
    mesh(GEO.sph, mSole, { p: [0, -0.4, 0.05], s: [0.16, 0.05, 0.22], parent: leg });
  }
  R.base.hipsY = 0.44;
  mesh(GEO.sph, mPants, { p: [0, 0.0, 0], s: [0.3, 0.16, 0.26], parent: R.hips });
  const torso = mesh(GEO.sph, mTop, { p: [0, 0.2, 0], s: [0.34, 0.33, 0.29], parent: R.hips });

  R.armL.position.set(0.31, 0.33, 0);
  R.armR.position.set(-0.31, 0.33, 0);
  const hands = [];
  for (const arm of [R.armL, R.armR]) {
    mesh(capsule(0.085, 0.2), mSleeve, { p: [0, -0.15, 0], parent: arm });
    hands.push(mesh(GEO.sph, mHand, { p: [0, -0.36, 0], s: c.handSize ?? 0.11, parent: arm }));
  }

  R.head.position.y = 0.46;
  const H = new THREE.Group();
  H.position.y = 0.36;
  R.head.add(H);
  mesh(GEO.sph, mSkin, { s: [0.44, 0.41, 0.4], parent: H });
  for (const sx of [1, -1]) mesh(GEO.sph, mSkin, { p: [0.42 * sx, -0.02, 0], s: [0.07, 0.1, 0.07], parent: H });

  const es = c.eyeSize ?? 0.125;
  for (const sx of [1, -1]) {
    R.eyes.push(makeEye(H, 0.155 * sx, 0.02, 0.35, es, eyeMats, { lookX: -0.012 * sx }));
  }
  if (c.brow !== undefined) {
    const mBrow = R.M(c.brow);
    for (const sx of [1, -1]) {
      R.fx['brow' + (sx > 0 ? 'L' : 'R')] = mesh(capsule(0.024, 0.1), mBrow, {
        p: [0.155 * sx, 0.175, 0.355], r: [0, 0, PI / 2 + 0.28 * sx], parent: H,
      });
    }
  }
  mesh(GEO.sph, R.M(c.nose ?? c.skin), { p: [0, -0.075, 0.392], s: [0.034, 0.026, 0.03], parent: H, outline: false });
  const mouth = new THREE.Group();
  mouth.position.set(c.mouthX ?? 0, -0.17, 0.36);
  mouth.rotation.set(-0.35, 0, c.mouthTilt ?? 0);
  H.add(mouth);
  mesh(smileGeo(c.mouthW ?? 0.1, c.mouthH ?? 0.075), mInk, { parent: mouth, outline: false });
  mesh(rbox(0.12, 0.028, 0.02, 0.008), R.M(0xffffff, { r: 0.2 }), { p: [0, 0.012, 0.016], s: [(c.mouthW ?? 0.1) * 8, 1, 1], parent: mouth, outline: false });
  mesh(GEO.sph, R.M(0xff6b81), { p: [0, -0.035, 0.012], s: [0.045, 0.022, 0.01], parent: mouth, outline: false });
  if (c.blush) {
    const mB = R.M(c.blush, { r: 0.8 });
    for (const sx of [1, -1]) mesh(GEO.sph, mB, { p: [0.255 * sx, -0.09, 0.3], r: [0, 0.65 * sx, 0], s: [0.07, 0.042, 0.02], parent: H, outline: false });
  }
  return { H, torso, hands, mSkin, mTop, mInk };
}

// ---------------------------------------------------------------------------
// MISO — le chef ramen explosif (nouveau héros vedette)
// ---------------------------------------------------------------------------
function buildMiso() {
  const R = new Rig();
  const C = { red: 0xff4a3d, cream: 0xfff1d6, yolk: 0xffc53a, teal: 0x1fc4b4, hair: 0x2a1b3d, iron: 0x3b3657, wood: 0xc98b4f };
  const { H, hands } = humanBase(R, {
    skin: 0xf2b27c, nose: 0xe39563, top: C.cream, pants: 0x2b2a55, shoe: C.red, sleeve: C.cream,
    brow: C.hair, blush: 0xff8c8c, mouthW: 0.11, mouthH: 0.085,
  });
  const mRed = R.M(C.red), mCream = R.M(C.cream), mYolk = R.M(C.yolk), mTeal = R.M(C.teal);
  const mHair = R.M(C.hair, { r: 0.55 }), mWood = R.M(C.wood, { r: 0.6 });
  const mIron = R.M(C.iron, { r: 0.28, m: 0.45 });
  const mWhite = R.M(0xfffaf2, { r: 0.18 });
  const mGlow = R.M(0xff8a2a, { e: 0xff5a00, ei: 1.4, r: 0.4 });

  // Tenue : ceinture, tablier, boutons, foulard
  mesh(torus(0.3, 0.065), mTeal, { p: [0, 0.05, 0], r: [PI / 2, 0, 0], s: [1, 0.86, 1], parent: R.hips });
  mesh(rbox(0.36, 0.25, 0.05, 0.03), mTeal, { p: [0, -0.06, 0.24], r: [-0.25, 0, 0], parent: R.hips });
  mesh(GEO.sph, mCream, { p: [0, -0.05, 0.275], r: [-0.25, 0, 0], s: [0.075, 0.05, 0.025], parent: R.hips });
  for (const sx of [1, -1]) for (const y of [0.27, 0.16]) {
    mesh(GEO.sph, mYolk, { p: [0.085 * sx, y, 0.272], s: 0.028, parent: R.hips, outline: false });
  }
  mesh(torus(0.16, 0.065), mRed, { p: [0, 0.43, 0.02], r: [PI / 2 - 0.25, 0, 0], parent: R.hips });
  mesh(GEO.sph, mRed, { p: [0.1, 0.34, 0.22], r: [0.2, 0, 0.5], s: [0.06, 0.11, 0.04], parent: R.hips });
  // Manchettes rouges
  for (const arm of [R.armL, R.armR]) mesh(torus(0.085, 0.032), mRed, { p: [0, -0.27, 0], r: [PI / 2, 0, 0], parent: arm });

  // Sac à dos : bonbonne de gaz
  const pack = new THREE.Group();
  pack.position.set(0, 0.26, -0.3);
  pack.rotation.x = -0.12;
  R.hips.add(pack);
  mesh(GEO.cyl, mYolk, { s: [0.13, 0.42, 0.13], parent: pack });
  mesh(GEO.sph, mYolk, { p: [0, 0.21, 0], s: [0.13, 0.06, 0.13], parent: pack });
  mesh(torus(0.135, 0.025), mTeal, { r: [PI / 2, 0, 0], parent: pack });
  mesh(GEO.cyl, mIron, { p: [0, 0.28, 0], s: [0.045, 0.08, 0.045], parent: pack });
  mesh(GEO.cyl, mRed, { p: [0, 0.32, 0], s: [0.07, 0.025, 0.07], parent: pack });

  // Cheveux + bandeau
  mesh(GEO.sph, mHair, { p: [0, 0.07, -0.04], s: [0.455, 0.37, 0.41], parent: H });
  for (const [x, rz] of [[-0.13, -0.35], [0, 0], [0.13, 0.35]]) {
    mesh(GEO.cone, mHair, { p: [x, 0.13, 0.33], r: [PI + 0.55, 0, rz], s: [0.07, 0.15, 0.06], parent: H });
  }
  mesh(torus(0.39, 0.062), mRed, { p: [0, 0.265, -0.04], r: [PI / 2 + 0.06, 0, 0], s: [1, 0.9, 1], parent: H });
  mesh(GEO.cyl, mYolk, { p: [0, 0.27, 0.365], r: [PI / 2 - 0.35, 0, 0], s: [0.065, 0.02, 0.065], parent: H });
  mesh(GEO.sph, mRed, { p: [0, 0.26, -0.43], s: 0.075, parent: H });
  R.fx.tails = [];
  for (const sx of [1, -1]) {
    const tail = new THREE.Group();
    tail.position.set(0.04 * sx, 0.25, -0.45);
    H.add(tail);
    mesh(capsule(0.045, 0.2), mRed, { p: [0, -0.13, 0], s: [1, 1, 0.45], parent: tail });
    tail.userData.sx = sx;
    R.fx.tails.push(tail);
  }

  // Chapeau-bol de ramen : la silhouette signature
  const bowl = new THREE.Group();
  bowl.position.set(0.04, 0.37, -0.03);
  bowl.rotation.set(-0.16, 0, -0.2);
  H.add(bowl);
  R.fx.bowl = bowl;
  mesh(lathe('bowl', [[0, 0], [0.12, 0], [0.13, 0.025], [0.2, 0.05], [0.29, 0.13], [0.335, 0.22], [0.325, 0.245], [0.3, 0.232], [0.26, 0.145], [0.17, 0.085], [0, 0.075]]), mWhite, { parent: bowl });
  mesh(torus(0.318, 0.02), mRed, { p: [0, 0.185, 0], r: [PI / 2, 0, 0], parent: bowl, outline: false });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    mesh(GEO.sph, mTeal, { p: [Math.sin(a) * 0.255, 0.105, Math.cos(a) * 0.255], s: 0.028, parent: bowl, outline: false });
  }
  mesh(GEO.cyl, R.M(0xf3a43c, { r: 0.15 }), { p: [0, 0.205, 0], s: [0.29, 0.02, 0.29], parent: bowl, outline: false });
  const mNoodle = R.M(0xffe08a, { r: 0.35 });
  for (const [x, z, ry] of [[-0.09, 0.06, 0.3], [0.02, -0.02, -0.6], [0.1, -0.1, 1.2], [-0.05, -0.12, 2.1]]) {
    mesh(torus(0.075, 0.018, PI), mNoodle, { p: [x, 0.215, z], r: [0, ry, 0], parent: bowl });
  }
  const naruto = mesh(GEO.cyl, mWhite, { p: [0.13, 0.235, 0.07], r: [0.15, 0, -0.2], s: [0.075, 0.025, 0.075], parent: bowl });
  mesh(torus(0.38, 0.11), R.M(0xff6f91), { p: [0, 0.6, 0], r: [PI / 2, 0, 0], parent: naruto, outline: false });
  mesh(GEO.sph, mWhite, { p: [-0.12, 0.225, -0.05], s: [0.085, 0.04, 0.07], parent: bowl });
  mesh(GEO.sph, R.M(0xff9d1c, { r: 0.25 }), { p: [-0.12, 0.25, -0.05], s: [0.045, 0.025, 0.04], parent: bowl, outline: false });
  mesh(rbox(0.16, 0.22, 0.014, 0.006), R.M(0x1f3a2c, { r: 0.7 }), { p: [-0.03, 0.31, -0.17], r: [-0.35, 0.25, 0.05], parent: bowl });
  const mOnion = R.M(0x5bd16a);
  for (const [x, z] of [[0.05, 0.12], [-0.02, 0.15], [0.15, -0.05], [-0.18, 0.08]]) {
    mesh(GEO.cyl, mOnion, { p: [x, 0.222, z], s: [0.024, 0.012, 0.024], parent: bowl, outline: false });
  }
  for (const [x, z, rx, rz] of [[0.07, -0.02, 0.2, -0.42], [0.12, 0.03, -0.12, -0.62]]) {
    const st = mesh(GEO.cyl, mWood, { p: [x, 0.43, z], r: [rx, 0, rz], s: [0.017, 0.6, 0.017], parent: bowl });
    mesh(GEO.cyl, mRed, { p: [0, 0.44, 0], s: [1.2, 0.12, 1.2], parent: st, outline: false });
  }

  // Wok-Canon dans la main droite (avant = +z dans le groupe W)
  const W = new THREE.Group();
  W.position.set(0, -0.38, 0.02);
  W.rotation.x = PI / 2;
  R.armR.add(W);
  const wok = new THREE.Group();
  wok.position.z = 0.06;
  wok.rotation.x = PI / 2;
  W.add(wok);
  mesh(lathe('wok', [[0, 0], [0.1, 0.005], [0.22, 0.04], [0.31, 0.11], [0.35, 0.17], [0.345, 0.19], [0.3, 0.168], [0.2, 0.102], [0.09, 0.068], [0, 0.062]]), mIron, { parent: wok });
  mesh(GEO.cyl, mGlow, { p: [0, 0.1, 0], s: [0.255, 0.012, 0.255], parent: wok, outline: false });
  mesh(GEO.cyl, mIron, { p: [0, 0.2, 0], s: [0.075, 0.3, 0.075], parent: wok });
  mesh(torus(0.08, 0.03), mGlow, { p: [0, 0.35, 0], r: [PI / 2, 0, 0], parent: wok });
  mesh(torus(0.065, 0.022), mYolk, { p: [0, 0.24, 0], r: [PI / 2, 0, 0], parent: wok, outline: false });
  const handle = mesh(GEO.cyl, mWood, { p: [-0.47, 0.15, 0], r: [0, 0, PI / 2 + 0.25], s: [0.04, 0.28, 0.04], parent: wok });
  mesh(GEO.sph, mRed, { p: [0, 0.55, 0], s: [1.3, 0.18, 1.3], parent: handle });
  R.fx.wok = W;
  hands[1].scale.setScalar(0.12);

  R.base.aimX = -1.35;
  R.base.idleArmX = -0.5;
  R.onUpdate = (r, dt, m) => {
    for (const tail of r.fx.tails) {
      tail.rotation.x = 0.45 + Math.sin(r.t * 7 + tail.userData.sx) * (0.12 + 0.25 * m) + 0.4 * m;
      tail.rotation.z = 0.25 * tail.userData.sx;
    }
    r.fx.bowl.rotation.z = -0.2 + Math.sin(r.t * 3) * 0.03;
  };
  R.pose = poseMiso;
  return R;
}

function poseMiso(r, t) {
  r.body.position.y = 0;
  r.legL.rotation.set(-0.45, 0, 0.12);
  r.legR.rotation.set(0.3, 0, -0.12);
  r.hips.rotation.set(0.1, 0.28, -0.07);
  r.armL.rotation.set(-2.75 + Math.sin(t * 2) * 0.05, 0, 0.45);
  r.armR.rotation.set(-1.45, 0, -0.1);
  r.head.rotation.set(0.05, -0.22, 0.13);
  r.eyes[0].group.scale.y = 0.14; // clin d'œil
  r.eyes[1].group.scale.y = 1;
  if (r.fx.browL) r.fx.browL.rotation.z = PI / 2 + 0.05;
}

// ---------------------------------------------------------------------------
// VOLTA — tireuse d'élite électrique
// ---------------------------------------------------------------------------
function buildVolta() {
  const R = new Rig();
  const C = { violet: 0x7b4dff, yellow: 0xffe23d, cyan: 0x3ff2ff, blue: 0x2e7bff, iron: 0x34304a };
  const { H } = humanBase(R, {
    skin: 0x8d5a3b, nose: 0x7a4a2f, top: C.violet, pants: 0x3b2a7a, shoe: C.yellow, hand: 0xf4f4ff,
    handSize: 0.125, brow: 0x1a2a6e, blush: 0xc0606a, mouthW: 0.085, mouthH: 0.06, mouthX: 0.03, mouthTilt: 0.18,
  });
  const mYellow = R.M(C.yellow), mBlue = R.M(C.blue, { r: 0.4 }), mCyanHair = R.M(0x41d9ff, { r: 0.4 });
  const mIron = R.M(C.iron, { r: 0.3, m: 0.4 });
  const mGlow = R.M(C.cyan, { e: 0x18d8ff, ei: 1.6 });
  const mWhite = R.M(0xffffff, { r: 0.3 });

  // Éclair sur la poitrine + col + ceinture
  mesh(rbox(0.07, 0.15, 0.03, 0.01), mYellow, { p: [0.03, 0.26, 0.275], r: [-0.1, 0, 0.55], parent: R.hips });
  mesh(rbox(0.07, 0.15, 0.03, 0.01), mYellow, { p: [-0.02, 0.15, 0.285], r: [-0.25, 0, 0.55], parent: R.hips });
  mesh(torus(0.16, 0.05), mWhite, { p: [0, 0.43, 0.01], r: [PI / 2 - 0.2, 0, 0], parent: R.hips });
  mesh(torus(0.3, 0.05), mYellow, { p: [0, 0.05, 0], r: [PI / 2, 0, 0], s: [1, 0.86, 1], parent: R.hips });
  mesh(rbox(0.1, 0.08, 0.04, 0.015), mIron, { p: [0, 0.05, 0.255], parent: R.hips });
  for (const arm of [R.armL, R.armR]) mesh(torus(0.09, 0.035), mYellow, { p: [0, -0.26, 0], r: [PI / 2, 0, 0], parent: arm });

  // Batterie dorsale + antennes Tesla
  mesh(rbox(0.38, 0.42, 0.2, 0.06), mIron, { p: [0, 0.25, -0.33], parent: R.hips });
  mesh(rbox(0.4, 0.08, 0.22, 0.03), mYellow, { p: [0, 0.4, -0.33], parent: R.hips });
  mesh(rbox(0.12, 0.04, 0.03, 0.01), mGlow, { p: [0, 0.22, -0.44], parent: R.hips, outline: false });
  // Antennes asymétriques : une grande bobine Tesla à gauche, une courte à droite
  R.fx.orbs = [];
  for (const [sx, len, tilt, orb] of [[1, 1.35, 0.38, 0.1], [-1, 0.5, 0.5, 0.065]]) {
    const ant = new THREE.Group();
    ant.position.set(0.14 * sx, 0.38, -0.37);
    ant.rotation.z = -tilt * sx;
    R.hips.add(ant);
    mesh(GEO.cyl, mIron, { p: [0, len / 2, 0], s: [0.026, len, 0.026], parent: ant });
    const coils = len > 1 ? 3 : 1;
    for (let k = 0; k < coils; k++) mesh(torus(0.06, 0.018), mGlow, { p: [0, len * (0.45 + k * 0.16), 0], r: [PI / 2, 0, 0], parent: ant, outline: false });
    const o = mesh(GEO.sph, mGlow, { p: [0, len + 0.05, 0], s: orb, parent: ant });
    o.userData.s = orb;
    R.fx.orbs.push(o);
  }

  // Cheveux : crête en éclairs
  mesh(GEO.sph, mBlue, { p: [0, 0.09, -0.05], s: [0.455, 0.36, 0.42], parent: H });
  const spikes = [[-0.7, 0.33], [-0.25, 0.42], [0.2, 0.46], [0.65, 0.4], [1.1, 0.32], [1.5, 0.24]];
  spikes.forEach(([a, len], i) => {
    const d = 0.36;
    mesh(GEO.cone, i % 2 ? mCyanHair : mBlue, {
      p: [0, Math.cos(a) * d + 0.06, -Math.sin(a) * d - 0.02],
      r: [-a - 0.35, 0, (i % 2 ? 0.18 : -0.18)],
      s: [0.14, len * 1.25, 0.12], parent: H,
    });
  });
  for (const sx of [1, -1]) mesh(GEO.cone, mBlue, { p: [0.4 * sx, 0.12, -0.1], r: [0, 0, -1.2 * sx], s: [0.08, 0.2, 0.07], parent: H });

  // Lunettes de protection sur le front
  mesh(torus(0.43, 0.03), mIron, { p: [0, 0.2, -0.01], r: [PI / 2 + 0.06, 0, 0], s: [1, 0.93, 1], parent: H, outline: false });
  for (const sx of [1, -1]) {
    const g = mesh(GEO.cyl, mIron, { p: [0.135 * sx, 0.185, 0.355], r: [PI / 2 - 0.42, 0, -0.25 * sx], order: 'YXZ', s: [0.088, 0.06, 0.088], parent: H });
    mesh(GEO.cyl, mGlow, { p: [0, 0.52, 0], s: [0.78, 0.1, 0.78], parent: g, outline: false });
  }
  for (const sx of [1, -1]) mesh(GEO.ico, mYellow, { p: [0.43 * sx, -0.12, 0.02], s: 0.04, parent: H, outline: false });

  // Rail-Canon
  const W = new THREE.Group();
  W.position.set(0, -0.38, 0.02);
  W.rotation.x = PI / 2;
  R.armR.add(W);
  mesh(rbox(0.15, 0.17, 0.32, 0.04), R.M(C.violet), { p: [0, 0.03, 0.02], parent: W });
  mesh(GEO.cyl, mIron, { p: [0, 0.03, 0.42], r: [PI / 2, 0, 0], s: [0.06, 0.78, 0.06], parent: W });
  for (const z of [0.3, 0.48, 0.66]) mesh(torus(0.09, 0.024), mGlow, { p: [0, 0.03, z], parent: W });
  mesh(GEO.sph, mGlow, { p: [0, 0.03, 0.83], s: 0.07, parent: W });
  mesh(rbox(0.05, 0.14, 0.06, 0.02), mYellow, { p: [0, -0.08, -0.05], parent: W });
  R.fx.gun = W;

  R.base.aimX = -1.4;
  R.base.idleArmX = -0.55;
  R.onUpdate = (r) => {
    const k = 0.75 + Math.sin(r.t * 8) * 0.25;
    for (const o of r.fx.orbs) o.scale.setScalar(o.userData.s * (0.8 + 0.3 * k));
  };
  R.pose = (r, t) => {
    r.body.position.y = 0;
    r.legL.rotation.set(-0.3, 0, 0.18);
    r.legR.rotation.set(0.2, 0, -0.05);
    r.hips.rotation.set(0.04, -0.3, 0.06);
    r.armR.rotation.set(-2.5, 0, -0.35);
    r.armL.rotation.set(-0.3, 0, 1.0 + Math.sin(t * 2) * 0.04);
    r.head.rotation.set(-0.05, 0.25, -0.1);
  };
  return R;
}

// ---------------------------------------------------------------------------
// BOULDO — le golem de pierre champion de catch
// ---------------------------------------------------------------------------
function buildBouldo() {
  const R = new Rig();
  const mRock = R.M(0x8a92b8, { r: 0.75, flat: true });
  const mRockD = R.M(0x6c7398, { r: 0.8, flat: true });
  const mMoss = R.M(0x6fcf5a, { r: 0.7 });
  const mMagma = R.M(0xff8a3d, { e: 0xff4d00, ei: 1.5 });
  const mGold = R.M(0xffcf3a, { r: 0.25, m: 0.6 });
  const mLeather = R.M(0x7a3f2a, { r: 0.6 });
  const mRed = R.M(0xff4057);
  const eyeMats = { white: R.M(0xffffff, { r: 0.2 }), pupil: R.M(0x1b1236, { r: 0.15 }) };

  for (const [leg, sx] of [[R.legL, 1], [R.legR, -1]]) {
    leg.position.set(0.24 * sx, 0.38, 0);
    mesh(rockGeo(2), mRockD, { p: [0, -0.15, 0], s: [0.18, 0.2, 0.18], parent: leg });
    mesh(rockGeo(3), mRock, { p: [0, -0.3, 0.06], s: [0.21, 0.12, 0.26], parent: leg });
  }
  R.base.hipsY = 0.4;
  R.base.waddle = 0.1;
  mesh(rockGeo(1, 0.09), mRock, { p: [0, 0.42, 0], s: [0.62, 0.52, 0.5], parent: R.hips });
  mesh(GEO.sph, mRockD, { p: [0, 0.1, 0], s: [0.5, 0.2, 0.42], parent: R.hips });
  mesh(torus(0.53, 0.075), mLeather, { p: [0, 0.14, 0], r: [PI / 2, 0, 0], s: [1, 0.86, 1], parent: R.hips });
  const buckle = mesh(rbox(0.26, 0.18, 0.06, 0.03), mGold, { p: [0, 0.14, 0.45], r: [-0.1, 0, 0], parent: R.hips });
  mesh(GEO.ico, mRed, { p: [0, 0, 0.035], s: [0.05, 0.05, 0.02], parent: buckle, outline: false });
  for (const [x, y, rz] of [[0.18, 0.5, 0.6], [-0.2, 0.42, -0.4], [0.05, 0.62, 1.4]]) {
    mesh(capsule(0.018, 0.12), mMagma, { p: [x, y, 0.47 - Math.abs(x) * 0.3], r: [-0.3, 0, rz], parent: R.hips, outline: false });
  }
  for (const [x, z, s] of [[0.32, -0.05, 0.2], [-0.3, 0.05, 0.17], [0.05, -0.2, 0.22]]) {
    mesh(GEO.sph, mMoss, { p: [x, 0.86, z], s: [s, s * 0.5, s * 0.9], parent: R.hips });
  }

  R.head.position.set(0, 0.74, 0.14);
  const H = new THREE.Group();
  H.position.y = 0.14;
  R.head.add(H);
  mesh(rockGeo(4, 0.08), R.M(0x9ba3c8, { r: 0.75, flat: true }), { s: [0.34, 0.3, 0.3], parent: H });
  for (const sx of [1, -1]) R.eyes.push(makeEye(H, 0.12 * sx, 0.0, 0.25, 0.105, eyeMats, { lookX: -0.01 * sx }));
  R.fx.brow = mesh(rbox(0.42, 0.07, 0.12, 0.03), mRockD, { p: [0, 0.12, 0.22], r: [-0.25, 0, 0], parent: H });
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.15, 0.25);
  mouth.rotation.set(-0.3, 0, 0);
  H.add(mouth);
  mesh(smileGeo(0.1, 0.06), R.M(0x3a0e22), { parent: mouth, outline: false });
  for (const x of [-0.05, 0.05]) mesh(rbox(0.035, 0.03, 0.02, 0.006), R.M(0xffffff), { p: [x, 0.008, 0.016], parent: mouth, outline: false });
  mesh(GEO.sph, mMoss, { p: [0, 0.26, -0.03], s: [0.2, 0.08, 0.18], parent: H });
  const flower = new THREE.Group();
  flower.position.set(0.08, 0.34, 0.0);
  H.add(flower);
  R.fx.flower = flower;
  mesh(GEO.cyl, mMoss, { p: [0, -0.04, 0], s: [0.012, 0.08, 0.012], parent: flower, outline: false });
  const mPetal = R.M(0xff8fc6);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    mesh(GEO.sph, mPetal, { p: [Math.cos(a) * 0.045, 0.02, Math.sin(a) * 0.045], s: [0.035, 0.015, 0.035], parent: flower, outline: false });
  }
  mesh(GEO.sph, R.M(0xffd23f), { p: [0, 0.03, 0], s: 0.025, parent: flower, outline: false });

  R.armL.position.set(0.6, 0.6, 0);
  R.armR.position.set(-0.6, 0.6, 0);
  for (const [arm, sx] of [[R.armL, 1], [R.armR, -1]]) {
    mesh(rockGeo(5), mRock, { s: 0.22, parent: arm });
    mesh(GEO.sph, mMoss, { p: [0.03 * sx, 0.15, 0], s: [0.13, 0.06, 0.12], parent: arm });
    mesh(rockGeo(6), mRockD, { p: [0, -0.25, 0], s: [0.15, 0.2, 0.15], parent: arm });
    mesh(rockGeo(7), mRock, { p: [0, -0.5, 0.02], s: sx < 0 ? 0.28 : 0.22, parent: arm });
  }
  mesh(torus(0.15, 0.05), mRed, { p: [0, -0.36, 0], r: [PI / 2, 0, 0], parent: R.armR });
  R.base.armLz = 0.25;
  R.base.armRz = -0.25;
  R.base.aimX = -0.7;
  R.base.idleArmX = -0.3;
  R.onUpdate = (r) => { r.fx.flower.rotation.z = Math.sin(r.t * 3) * 0.2; };
  R.pose = (r, t) => {
    r.body.position.y = 0;
    r.legL.rotation.set(-0.25, 0, 0.2);
    r.legR.rotation.set(0.2, 0, -0.2);
    r.hips.rotation.set(0.18, 0.2, 0);
    r.armL.rotation.set(-1.55, 0, 0.55);
    r.armR.rotation.set(-1.95 + Math.sin(t * 3) * 0.06, 0, -0.35);
    r.head.rotation.set(0.1, -0.1, 0.05);
  };
  R.root.scale.setScalar(1.08);
  return R;
}

// ---------------------------------------------------------------------------
// PLUMA — oiselle soigneuse au lance-pierre
// ---------------------------------------------------------------------------
function buildPluma() {
  const R = new Rig();
  const mMint = R.M(0x5ee0a0, { r: 0.55 });
  const mMintD = R.M(0x34b97c, { r: 0.55 });
  const mCream = R.M(0xfff1d6, { r: 0.6 });
  const mPink = R.M(0xff6f91);
  const mYellow = R.M(0xffd23f);
  const mBeak = R.M(0xff9a3c, { r: 0.35 });
  const mWood = R.M(0xc98b4f, { r: 0.6 });
  const mLeather = R.M(0x9a5a34, { r: 0.6 });
  const eyeMats = { white: R.M(0xffffff, { r: 0.2 }), pupil: R.M(0x1b1236, { r: 0.15 }) };

  for (const [leg, sx] of [[R.legL, 1], [R.legR, -1]]) {
    leg.position.set(0.15 * sx, 0.3, 0);
    mesh(capsule(0.042, 0.18), mBeak, { p: [0, -0.14, 0], parent: leg });
    for (const a of [-0.45, 0, 0.45]) mesh(GEO.sph, mBeak, { p: [Math.sin(a) * 0.06, -0.275, Math.cos(a) * 0.06 + 0.02], r: [0, a, 0], s: [0.035, 0.03, 0.08], parent: leg });
  }
  R.base.hipsY = 0.3;
  R.base.waddle = 0.16;
  mesh(GEO.sph, mMint, { p: [0, 0.47, 0], s: [0.52, 0.5, 0.48], parent: R.hips });
  mesh(GEO.sph, mCream, { p: [0, 0.32, 0.3], s: [0.34, 0.3, 0.2], parent: R.hips });
  // Sacoche + bandoulière
  mesh(torus(0.5, 0.03), mLeather, { p: [0, 0.45, 0], r: [PI / 2 + 0.1, 0.75, 0], s: [1.04, 0.98, 1], parent: R.hips, outline: false });
  const bag = mesh(rbox(0.2, 0.17, 0.11, 0.04), mLeather, { p: [-0.4, 0.2, 0.2], r: [0, -0.7, 0.1], parent: R.hips });
  mesh(rbox(0.21, 0.08, 0.12, 0.03), mPink, { p: [0, 0.06, 0.005], parent: bag });
  for (const tz of [[-0.1, 0], [0.12, 0.6]]) {
    const tf = new THREE.Group();
    tf.position.set(tz[0], 0.45, -0.42);
    tf.rotation.set(-0.9, 0, tz[1] - 0.3);
    R.hips.add(tf);
    mesh(capsule(0.05, 0.2), tz[1] ? mPink : mYellow, { p: [0, 0.15, 0], s: [1, 1, 0.45], parent: tf });
  }

  R.head.position.y = 0.47;
  const H = R.head;
  for (const sx of [1, -1]) R.eyes.push(makeEye(H, 0.17 * sx, 0.13, 0.41, 0.145, eyeMats, { lookX: -0.012 * sx }));
  for (const sx of [1, -1]) mesh(capsule(0.012, 0.06), R.M(0x1b1236), { p: [0.285 * sx, 0.28, 0.33], r: [0, 0, -0.9 * sx], parent: H, outline: false });
  mesh(GEO.cone, mBeak, { p: [0, -0.01, 0.53], r: [PI / 2, 0, 0], s: [0.1, 0.18, 0.07], parent: H });
  mesh(GEO.cone, R.M(0xe0742a), { p: [0, -0.07, 0.49], r: [PI / 2 + 0.35, 0, 0], s: [0.07, 0.1, 0.04], parent: H });
  const mBlush = R.M(0xff8fa3, { r: 0.8 });
  for (const sx of [1, -1]) mesh(GEO.sph, mBlush, { p: [0.3 * sx, -0.02, 0.36], r: [0, 0.7 * sx, 0], s: [0.075, 0.045, 0.02], parent: H, outline: false });
  R.fx.crest = [];
  [[-0.45, mPink, 0.22], [0, mYellow, 0.3], [0.45, mPink, 0.22]].forEach(([rz, mt, len]) => {
    const f = new THREE.Group();
    f.position.set(0, 0.46, 0.0);
    f.rotation.set(-0.3, 0, rz);
    H.add(f);
    mesh(capsule(0.06, len), mt, { p: [0, len * 0.6, 0], s: [1, 1, 0.45], parent: f });
    f.userData.rz = rz;
    R.fx.crest.push(f);
  });

  R.armL.position.set(0.48, 0.5, 0);
  R.armR.position.set(-0.48, 0.5, 0);
  for (const [arm, sx] of [[R.armL, 1], [R.armR, -1]]) {
    mesh(GEO.sph, mMintD, { p: [0.04 * sx, -0.14, 0], r: [0, 0, 0.25 * sx], s: [0.1, 0.22, 0.15], parent: arm });
    mesh(GEO.sph, mYellow, { p: [0.08 * sx, -0.32, 0], r: [0, 0, 0.35 * sx], s: [0.06, 0.08, 0.1], parent: arm, outline: false });
  }
  // Lance-pierre
  const W = new THREE.Group();
  W.position.set(0, -0.3, 0.03);
  W.rotation.x = PI / 2;
  R.armR.add(W);
  mesh(GEO.cyl, mWood, { p: [0, 0, 0.08], r: [PI / 2, 0, 0], s: [0.03, 0.2, 0.03], parent: W });
  for (const sx of [1, -1]) mesh(GEO.cyl, mWood, { p: [0.06 * sx, 0, 0.22], r: [PI / 2, 0, -0.55 * sx], s: [0.026, 0.15, 0.026], parent: W });
  mesh(torus(0.1, 0.014, PI), mPink, { p: [0, 0, 0.27], r: [PI / 2, 0, PI], parent: W });
  R.base.armLz = 0.3;
  R.base.armRz = -0.3;
  R.base.aimX = -1.25;
  R.base.idleArmX = -0.6;
  R.onUpdate = (r, dt, m) => {
    r.fx.crest.forEach((f, i) => { f.rotation.z = f.userData.rz + Math.sin(r.t * 5 + i) * (0.06 + 0.12 * m); });
    r.armL.rotation.z = r.base.armLz + Math.abs(Math.sin(r.t * 14)) * 0.5 * m;
  };
  R.pose = (r, t) => {
    r.body.position.y = 0.06 + Math.abs(Math.sin(t * 3)) * 0.05;
    r.legL.rotation.set(-0.7, 0, 0.1);
    r.legR.rotation.set(0.15, 0, -0.05);
    r.hips.rotation.set(0.0, 0.3, 0.1);
    r.armL.rotation.set(-0.4, 0, 1.6 + Math.sin(t * 6) * 0.2);
    r.armR.rotation.set(-1.9, 0, -0.2);
    r.head.rotation.set(0, -0.15, -0.12);
  };
  R.root.scale.setScalar(1.05);
  return R;
}

// ---------------------------------------------------------------------------
// Données de gameplay
// ---------------------------------------------------------------------------
export const HERO_ORDER = ['miso', 'volta', 'bouldo', 'pluma'];

export const HEROES = {
  miso: {
    id: 'miso', name: 'MISO', title: 'Le Chef Explosif', role: 'Lanceur', rarity: 'Épique', isNew: true,
    color: '#ff4a3d', bg: '#ffb35c', hp: 3600, speed: 3.35, reload: 1.55, superCost: 3000,
    stats: { pv: 3600, degats: 3, portee: 3, vitesse: 2 },
    bio: "Apprenti cuisinier du Marché de Minuit, Miso a transformé le wok de son grand-père en canon à raviolis brûlants. Il ne recule jamais devant un défi… sauf devant un bol vide.",
    attack: { name: 'Wok-Canon', desc: 'Tire 3 raviolis brûlants en éventail. Chaque ravioli rebondit une fois sur les murs.', range: 7, speed: 11 },
    super: { name: 'Marmite Bouillante', desc: 'Lance une marmite par-dessus les murs : explosion, puis une flaque de bouillon qui brûle les ennemis.', range: 7.5 },
    trait: { name: 'Recette secrète', desc: 'Les raviolis rebondissent sur les murs.' },
    palette: [['Tomate', '#ff4a3d'], ['Crème', '#fff1d6'], ['Jaune d\'œuf', '#ffc53a'], ['Menthe', '#1fc4b4'], ['Encre', '#2a1b3d']],
    ai: { pref: 5.2, lob: false },
    build: buildMiso,
  },
  volta: {
    id: 'volta', name: 'VOLTA', title: 'Haute Tension', role: 'Tireuse d\'élite', rarity: 'Super rare',
    color: '#7b4dff', bg: '#9fe8ff', hp: 2800, speed: 3.4, reload: 1.9, superCost: 3300,
    stats: { pv: 2800, degats: 4, portee: 5, vitesse: 3 },
    bio: "Mécanicienne de génie, Volta recharge sa batterie dorsale en courant sous l'orage. Elle vise juste, parle vite et ne tient jamais en place.",
    attack: { name: 'Rail-Canon', desc: 'Un éclair très longue portée qui inflige de gros dégâts.', range: 10, speed: 22 },
    super: { name: 'Orbe d\'Orage', desc: 'Une sphère électrique qui traverse les ennemis et les étourdit.', range: 10.5 },
    trait: { name: 'Survoltée', desc: 'Son super étourdit tous les ennemis touchés.' },
    palette: [['Violet', '#7b4dff'], ['Éclair', '#ffe23d'], ['Cyan', '#3ff2ff'], ['Bleu', '#2e7bff']],
    ai: { pref: 7.5, lob: false },
    build: buildVolta,
  },
  bouldo: {
    id: 'bouldo', name: 'BOULDO', title: 'Champion de Pierre', role: 'Tank', rarity: 'Rare',
    color: '#8a92b8', bg: '#c6f08a', hp: 6200, speed: 3.3, reload: 1.35, superCost: 3200,
    stats: { pv: 6200, degats: 4, portee: 1, vitesse: 2 },
    bio: "Ce golem au grand cœur garde le marché depuis des siècles. Il a gagné sa ceinture en soulevant une fontaine… avec la fontaine encore allumée.",
    attack: { name: 'Pluie de Cailloux', desc: 'Projette 5 cailloux en cône à courte portée.', range: 4.3, speed: 15 },
    super: { name: 'Saut Sismique', desc: 'Bondit par-dessus les murs et écrase la zone d\'arrivée en repoussant les ennemis.', range: 6.5 },
    trait: { name: 'Peau de roche', desc: 'Énormément de points de vie.' },
    palette: [['Ardoise', '#8a92b8'], ['Mousse', '#6fcf5a'], ['Magma', '#ff8a3d'], ['Or', '#ffcf3a']],
    ai: { pref: 1.6, lob: false },
    build: buildBouldo,
  },
  pluma: {
    id: 'pluma', name: 'PLUMA', title: 'Graine de Héros', role: 'Soutien', rarity: 'Rare',
    color: '#5ee0a0', bg: '#ffc1d6', hp: 3000, speed: 3.5, reload: 1.15, superCost: 2600,
    stats: { pv: 3000, degats: 2, portee: 4, vitesse: 4 },
    bio: "Pluma a quitté son nid pour devenir exploratrice. Son lance-pierre envoie des graines rapides, et ses fleurs magiques soignent toute l'équipe.",
    attack: { name: 'Double Graine', desc: 'Deux graines tirées coup sur coup à moyenne portée.', range: 8, speed: 16 },
    super: { name: 'Fleur Guérisseuse', desc: 'Fait éclore une fleur qui soigne les alliés dans la zone pendant 4 s.', range: 7.5 },
    trait: { name: 'Plumage léger', desc: 'Se déplace plus vite que les autres héros.' },
    palette: [['Menthe', '#5ee0a0'], ['Corail', '#ff6f91'], ['Tournesol', '#ffd23f'], ['Bec', '#ff9a3c']],
    ai: { pref: 6, lob: false },
    build: buildPluma,
  },
};

export function buildHero(id) {
  const rig = HEROES[id].build();
  rig.heroId = id;
  return rig;
}

export { SHINE };
