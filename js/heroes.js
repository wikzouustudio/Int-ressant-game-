// Hero roster: stats, abilities and procedurally sculpted toon models with procedural animation.
import * as THREE from 'three';
import { Kit, geo } from './toon.js';

const PI = Math.PI;

export const HEROES = [
  {
    id: 'rex', name: 'REX', title: 'Le Cogneur', role: 'Tank', color: '#ff7a2f', color2: '#ffb347',
    desc: 'Une montagne de muscles qui adore le contact. Plus il est près, plus ça fait mal.',
    hp: 5800, speed: 3.2,
    attack: { type: 'spread', name: 'Chevrotine', desc: 'Tire 5 plombs en éventail. Dévastateur à bout portant.', dmg: 360, count: 5, spread: 0.52, range: 5.4, speed: 17, reload: 1.5, radius: 0.17, charge: 0.04 },
    super: { type: 'charge', name: 'Bulldozer', desc: 'Fonce droit devant, renverse les ennemis et pulvérise les murs.', dmg: 1500, range: 6.5 },
    ai: { prefer: 2.6, aggro: 0.9 },
  },
  {
    id: 'nova', name: 'NOVA', title: 'La Sniper', role: 'Tireuse', color: '#a65bff', color2: '#d4a8ff',
    desc: 'Un oeil de lynx et un fusil stellaire. Elle punit tous ceux qui restent à découvert.',
    hp: 3200, speed: 3.15,
    attack: { type: 'single', name: 'Tir Stellaire', desc: 'Un tir rapide et précis à très longue portée.', dmg: 1250, range: 10, speed: 25, reload: 1.6, radius: 0.2, charge: 0.25 },
    super: { type: 'beam', name: 'Rayon Nova', desc: 'Un rayon géant qui traverse ennemis et murs.', dmg: 2600, range: 14, speed: 34 },
    ai: { prefer: 7.5, aggro: 0.4 },
  },
  {
    id: 'pip', name: 'PIP', title: 'Le Bricoleur', role: 'Artilleur', color: '#2fd0c0', color2: '#8ff7e9',
    desc: 'Petit robot, grosses bombes. Ses explosifs passent par-dessus les murs.',
    hp: 3000, speed: 3.2,
    attack: { type: 'lob', name: 'Bombe Tic-Tac', desc: 'Lance une bombe par-dessus les obstacles. Dégâts de zone.', dmg: 1150, range: 7.4, aoe: 1.3, flight: 0.62, reload: 1.85, charge: 0.22 },
    super: { type: 'megabomb', name: 'Méga Boum', desc: 'Une bombe énorme qui rase les murs et tout ce qui bouge.', dmg: 2500, range: 8, aoe: 2.5, flight: 0.85 },
    ai: { prefer: 6, aggro: 0.5 },
  },
  {
    id: 'kumo', name: 'KUMO', title: 'Le Ninja', role: 'Assassin', color: '#3d63ff', color2: '#ff3b4f',
    desc: 'Un chat ninja silencieux. Il surgit des buissons et tranche avant qu\'on le voie.',
    hp: 4300, speed: 3.75,
    attack: { type: 'melee', name: 'Lame Lunaire', desc: 'Un coup de sabre en arc de cercle devant lui.', dmg: 1200, range: 2.2, arc: 1.9, reload: 0.95, charge: 0.28 },
    super: { type: 'leap', name: 'Saut de l\'Ombre', desc: 'Bondit par-dessus les obstacles et frappe à l\'atterrissage.', dmg: 1900, range: 7, aoe: 1.9 },
    ai: { prefer: 0.8, aggro: 1 },
  },
  {
    id: 'mira', name: 'MIRA', title: 'La Druide', role: 'Soutien', color: '#ff6fb5', color2: '#59e0b4',
    desc: 'Elle fait pousser des fleurs magiques qui soignent ses amis et piquent ses ennemis.',
    hp: 3600, speed: 3.3,
    attack: { type: 'orb', name: 'Graine Éclat', desc: 'Une graine magique qui traverse les ennemis et soigne les alliés touchés.', dmg: 960, heal: 380, range: 8, speed: 13, reload: 1.3, radius: 0.28, charge: 0.22 },
    super: { type: 'bloom', name: 'Jardin Sacré', desc: 'Crée un jardin qui soigne les alliés et blesse les ennemis.', heal: 450, dmg: 260, range: 7, aoe: 2.7, duration: 5 },
    ai: { prefer: 5.5, aggro: 0.5 },
  },
  {
    id: 'bolt', name: 'BOLT', title: 'Le Mécano', role: 'Mitrailleur', color: '#ffc21f', color2: '#5a7bb5',
    desc: 'Un robot de combat blindé. Sa mitrailleuse ne s\'arrête jamais de tourner.',
    hp: 4800, speed: 3.0,
    attack: { type: 'burst', name: 'Mini-Gun', desc: 'Une rafale de 6 balles à moyenne portée.', dmg: 300, count: 6, interval: 0.065, spread: 0.13, range: 7.4, speed: 20, reload: 1.45, radius: 0.13, charge: 0.035 },
    super: { type: 'barrage', name: 'Pluie de Roquettes', desc: 'Déchaîne 10 roquettes explosives sur une large zone.', dmg: 650, count: 10, range: 9, aoe: 1.15, spread: 0.7 },
    ai: { prefer: 5, aggro: 0.7 },
  },
];

export const HERO_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h]));

export function heroStats(hero, level) {
  const m = 1 + (level - 1) * 0.06;
  return { hp: Math.round(hero.hp * m), dmgMul: m };
}

export const BOT_NAMES = [
  'Zigzag', 'Tornade', 'Mousse', 'KiwiKing', 'Pépito', 'Lulu_99', 'Noxx', 'Biscotte', 'Crocus', 'Turbo',
  'Moumou', 'Flashy', 'Pistache', 'Raptor', 'Choco', 'Yuzu', 'Bulle', 'Kraken', 'Nougat', 'Pixel',
  'Sushi', 'Ouragan', 'Praline', 'Volt', 'Grizzly', 'Mango', 'Loupiot', 'Fennec', 'Tchoupi', 'Zébulon',
];

// ---------------------------------------------------------------- model building

function rigBase() {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  return { root, rig, eyes: [], extras: {} };
}

function face(k, P, o = {}) {
  const eyeMat = o.eyeMat || k.t('#1b0f33', { rim: 0.6 });
  const shine = k.g('#ffffff');
  const ex = o.ex ?? 0.125;
  const ey = o.ey ?? 0.33;
  const ez = o.ez ?? 0.305;
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(s * ex, ey, ez);
    g.rotation.y = s * 0.39;
    P.head.add(g);
    k.mk(geo.sphere(0.07, 18, 14), eyeMat, g, [0, 0, 0], { scale: o.eyeScale || [0.92, 1.32, 0.58], outline: false, shadow: false });
    if (o.slit) k.mk(geo.box(0.022, 0.1, 0.02, 0.008, 1), k.t('#1b0f33'), g, [0, 0, 0.034], { outline: false, shadow: false });
    k.mk(geo.sphere(0.021, 8, 6), shine, g, [-s * 0.016, 0.03, 0.035], { outline: false, shadow: false });
    P.eyes.push(g);
  }
  if (o.brow) {
    const bm = k.t(o.browColor || '#2a1a14');
    for (const s of [-1, 1]) {
      k.mk(geo.capsule(0.026, 0.08, 4, 8), bm, P.head, [s * 0.125, ey + 0.115, ez - 0.015], {
        rot: [0, s * 0.35, PI / 2 + s * (o.browTilt ?? 0)], outline: false, shadow: false,
      });
    }
  }
  if (o.mouth !== false) {
    const mm = k.t('#5a1a2a');
    if (o.grin) {
      k.mk(geo.sphere(0.07, 14, 10), mm, P.head, [0, ey - 0.15, ez + 0.02], { scale: [1.2, 0.5, 0.4], outline: false, shadow: false });
      k.mk(geo.box(0.12, 0.03, 0.03, 0.01, 1), k.t('#ffffff'), P.head, [0, ey - 0.13, ez + 0.045], { outline: false, shadow: false });
    } else {
      k.mk(geo.torus(0.05, 0.014, PI, 6, 14), mm, P.head, [0, ey - 0.12, ez + 0.01], { rot: [-0.3, 0, PI], outline: false, shadow: false });
    }
  }
  if (o.blush) {
    const bl = k.t(o.blush);
    for (const s of [-1, 1]) {
      k.mk(geo.sphere(0.05, 10, 8), bl, P.head, [s * 0.215, ey - 0.09, ez - 0.07], { scale: [1, 0.55, 0.4], rot: [0, s * 0.6, 0], outline: false, shadow: false });
    }
  }
}

function humanoid(k, o) {
  const P = rigBase();
  const skin = k.t(o.skin);
  const top = k.t(o.top);
  const bottom = k.t(o.bottom);
  const shoe = k.t(o.shoe);
  P.skinMat = skin;
  const bodyW = o.bodyW ?? 1;
  const hips = new THREE.Group();
  hips.position.y = 0.4;
  P.rig.add(hips);
  P.hips = hips;
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(0.13 * s * Math.max(1, bodyW * 0.9), 0, 0);
    hips.add(leg);
    k.mk(geo.capsule(0.09, 0.14, 4, 12), bottom, leg, [0, -0.15, 0]);
    k.mk(geo.sphere(0.115, 16, 12), shoe, leg, [0, -0.31, 0.04], { scale: [0.95, 0.62, 1.35] });
    P[s < 0 ? 'legR' : 'legL'] = leg;
  }
  const torso = new THREE.Group();
  hips.add(torso);
  P.torso = torso;
  P.torsoMesh = k.mk(geo.sphere(0.27, 24, 18), top, torso, [0, 0.2, 0], { scale: [bodyW, 1, 0.82 * Math.max(1, bodyW * 0.85)] });
  const chest = new THREE.Group();
  chest.position.y = 0.32;
  torso.add(chest);
  P.chest = chest;
  const armR = o.armR ?? 0.075;
  const handR = o.handR ?? 0.085;
  const sx = 0.27 * bodyW + 0.05;
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.rotation.order = 'YXZ';
    arm.position.set(s * sx, 0.05, 0);
    chest.add(arm);
    k.mk(geo.capsule(armR, 0.13, 4, 12), o.sleeve ? k.t(o.sleeve) : skin, arm, [0, -0.12, 0]);
    const hand = new THREE.Group();
    hand.position.y = -0.265;
    arm.add(hand);
    k.mk(geo.sphere(handR, 14, 10), o.glove ? k.t(o.glove) : skin, hand, [0, 0, 0]);
    P[s < 0 ? 'armR' : 'armL'] = arm;
    P[s < 0 ? 'handR' : 'handL'] = hand;
  }
  const head = new THREE.Group();
  head.position.y = 0.2;
  chest.add(head);
  P.head = head;
  P.headMesh = k.mk(geo.sphere(o.headR ?? 0.36, 28, 22), skin, head, [0, 0.3, 0]);
  return P;
}

// Weapon frame attached to a hand: +z = along the arm (forward when the arm is raised), +y = up.
function handFrame(hand) {
  const g = new THREE.Group();
  g.rotation.x = PI / 2;
  hand.add(g);
  return g;
}

function puffs(k, parent, mat, list) {
  for (const p of list) k.mk(geo.sphere(p[3], 16, 12), mat, parent, [p[0], p[1], p[2]], p[4] ? { scale: p[4] } : {});
}

const BUILDERS = {
  rex(k) {
    const P = humanoid(k, { skin: '#eaa47a', top: '#ff7a2f', bottom: '#4a3326', shoe: '#2b2236', bodyW: 1.32, armR: 0.095, handR: 0.105, headR: 0.35, glove: '#3a2b2b' });
    const steel = k.t('#8d97ab');
    k.mk(geo.torus(0.27, 0.05, PI * 2, 8, 30), k.t('#3a2a20'), P.torso, [0, 0.07, 0], { rot: [PI / 2, 0, 0], scale: [1.33, 1.07, 1] });
    k.mk(geo.box(0.13, 0.1, 0.05, 0.02, 2), k.t('#ffcc33', { rim: 0.6 }), P.torso, [0, 0.07, 0.29], { outline: false });
    for (const s of [-1, 1]) k.mk(geo.sphere(0.15, 16, 12), steel, P.chest, [s * 0.36, 0.06, 0], { scale: [1.05, 0.72, 1.05] });
    // jaw
    k.mk(geo.sphere(0.2, 20, 14), P.skinMat, P.head, [0, 0.15, 0.08], { scale: [1.3, 0.72, 1.0] });
    face(k, P, { ey: 0.36, ez: 0.29, brow: true, browTilt: 0.42, browColor: '#3a2318', eyeScale: [1, 1.25, 0.6] });
    // bandana + knot
    const red = k.t('#e0303f');
    k.mk(geo.torus(0.335, 0.055, PI * 2, 8, 32), red, P.head, [0, 0.47, -0.02], { rot: [PI / 2 + 0.18, 0, 0] });
    k.mk(geo.sphere(0.07, 10, 8), red, P.head, [0, 0.42, -0.36]);
    k.mk(geo.box(0.08, 0.04, 0.22, 0.015, 2), red, P.head, [0.05, 0.36, -0.44], { rot: [0.9, 0.3, 0] });
    k.mk(geo.box(0.08, 0.04, 0.2, 0.015, 2), red, P.head, [-0.06, 0.34, -0.42], { rot: [1.1, -0.4, 0] });
    // mohawk
    const hair = k.t('#2d1c14');
    for (let i = 0; i < 4; i++) k.mk(geo.cone(0.075, 0.22, 10), hair, P.head, [0, 0.66 - i * 0.025, 0.12 - i * 0.12], { rot: [-0.5 - i * 0.25, 0, 0] });
    // shotgun on chest
    const gun = new THREE.Group();
    gun.position.set(-0.1, -0.03, 0.26);
    P.chest.add(gun);
    const metal = k.t('#3a4050');
    for (const s of [-1, 1]) k.mk(geo.cyl(0.055, 0.055, 0.6, 14), metal, gun, [s * 0.055, 0.03, 0.26], { rot: [PI / 2, 0, 0] });
    k.mk(geo.box(0.2, 0.08, 0.06, 0.02, 2), k.t('#ffcc33'), gun, [0, 0.03, 0.48], { outline: false });
    k.mk(geo.box(0.19, 0.15, 0.34, 0.04, 2), k.t('#8a4f2a'), gun, [0, -0.02, -0.06]);
    k.mk(geo.box(0.16, 0.13, 0.22, 0.04, 2), k.t('#6b3a1e'), gun, [0, -0.08, -0.27], { rot: [0.35, 0, 0] });
    P.gun = gun;
    P.muzzle = new THREE.Vector3(-0.1, 0.0, 0.85);
    P.style = 'twoHand';
    return P;
  },

  nova(k) {
    const P = humanoid(k, { skin: '#ffd6bf', top: '#7b3fe4', bottom: '#4b2a9c', shoe: '#f2ecff', bodyW: 0.92, headR: 0.36, glove: '#f2ecff' });
    face(k, P, { brow: true, browTilt: -0.1, browColor: '#2a1f6e', blush: '#ff9fb0' });
    const hairM = k.t('#2f2482');
    puffs(k, P.head, hairM, [
      [0, 0.56, -0.02, 0.27], [0, 0.48, -0.17, 0.28], [0.17, 0.5, -0.1, 0.22], [-0.17, 0.5, -0.1, 0.22],
      [0.25, 0.36, -0.12, 0.17], [-0.25, 0.36, -0.12, 0.17], [0, 0.3, -0.24, 0.26],
      [0.13, 0.55, 0.2, 0.13, [1.1, 0.8, 0.9]], [-0.06, 0.6, 0.22, 0.12, [1.1, 0.8, 0.9]],
    ]);
    const tail = new THREE.Group();
    tail.position.set(0, 0.56, -0.32);
    P.head.add(tail);
    puffs(k, tail, hairM, [[0, 0, -0.04, 0.12], [0, -0.13, -0.15, 0.115], [0, -0.29, -0.2, 0.1], [0, -0.44, -0.2, 0.085]]);
    k.mk(geo.sphere(0.06, 10, 8), k.t('#59f3ff', { rim: 0.5 }), tail, [0, 0.05, 0.02]);
    P.extras.tail = tail;
    // goggles
    const band = k.t('#b58cff');
    k.mk(geo.torus(0.35, 0.03, PI * 2, 6, 32), band, P.head, [0, 0.47, 0.01], { rot: [PI / 2 - 0.12, 0, 0], outline: false });
    for (const s of [-1, 1]) {
      const lens = k.mk(geo.cyl(0.075, 0.075, 0.06, 18), band, P.head, [s * 0.11, 0.52, 0.29], { rot: [PI / 2 - 0.5, 0, 0] });
      k.mk(geo.cyl(0.055, 0.055, 0.02, 18), k.g('#6ff6ff'), lens, [0, 0.03, 0], { outline: false, shadow: false });
    }
    k.mk(geo.torus(0.16, 0.04, PI * 2, 6, 22), k.t('#f2ecff'), P.chest, [0, 0.13, 0], { rot: [PI / 2, 0, 0] });
    for (const s of [-1, 1]) k.mk(geo.sphere(0.1, 12, 10), band, P.chest, [s * 0.29, 0.07, 0], { scale: [1, 0.7, 1] });
    k.mk(geo.box(0.36, 0.06, 0.3, 0.025, 2), k.t('#3a1e7a'), P.torso, [0, 0.06, 0.02], { scale: [1, 1, 1.25], outline: false });
    // rifle
    const gun = new THREE.Group();
    gun.position.set(-0.11, -0.03, 0.24);
    P.chest.add(gun);
    const purple = k.t('#5b2bc4');
    const white = k.t('#f2ecff');
    k.mk(geo.box(0.11, 0.14, 0.52, 0.03, 2), purple, gun, [0, 0, 0.1]);
    k.mk(geo.cyl(0.035, 0.035, 0.55, 12), k.t('#2a2a40'), gun, [0, 0.01, 0.62], { rot: [PI / 2, 0, 0] });
    k.mk(geo.cyl(0.05, 0.05, 0.06, 12), white, gun, [0, 0.01, 0.88], { rot: [PI / 2, 0, 0] });
    k.mk(geo.cyl(0.045, 0.045, 0.26, 14), white, gun, [0, 0.12, 0.12], { rot: [PI / 2, 0, 0] });
    k.mk(geo.cyl(0.035, 0.035, 0.02, 14), k.g('#6ff6ff'), gun, [0, 0.12, 0.255], { rot: [PI / 2, 0, 0], outline: false, shadow: false });
    k.mk(geo.box(0.12, 0.04, 0.4, 0.015, 1), k.g('#6ff6ff'), gun, [0, -0.04, 0.12], { outline: false, shadow: false });
    k.mk(geo.box(0.1, 0.16, 0.22, 0.04, 2), white, gun, [0, -0.04, -0.22], { rot: [0.2, 0, 0] });
    P.gun = gun;
    P.muzzle = new THREE.Vector3(-0.11, 0.0, 1.15);
    P.style = 'twoHand';
    return P;
  },

  pip(k) {
    const P = rigBase();
    const yellow = k.t('#ffc933');
    const teal = k.t('#2fd0c0');
    const grey = k.t('#8a93a6');
    const dark = k.t('#3b4252');
    const hips = new THREE.Group();
    hips.position.y = 0.34;
    P.rig.add(hips);
    P.hips = hips;
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(0.14 * s, 0, 0);
      hips.add(leg);
      k.mk(geo.capsule(0.07, 0.08, 4, 10), grey, leg, [0, -0.12, 0]);
      k.mk(geo.box(0.17, 0.1, 0.24, 0.04, 2), dark, leg, [0, -0.27, 0.03]);
      P[s < 0 ? 'legR' : 'legL'] = leg;
    }
    const torso = new THREE.Group();
    hips.add(torso);
    P.torso = torso;
    k.mk(geo.box(0.52, 0.42, 0.42, 0.12, 3), yellow, torso, [0, 0.2, 0]);
    k.mk(geo.box(0.28, 0.18, 0.04, 0.03, 2), teal, torso, [0, 0.22, 0.21], { outline: false });
    k.mk(geo.sphere(0.04, 10, 8), k.g('#ff4d6d'), torso, [0.07, 0.24, 0.235], { outline: false, shadow: false });
    k.mk(geo.sphere(0.04, 10, 8), k.g('#7dfcff'), torso, [-0.07, 0.24, 0.235], { outline: false, shadow: false });
    const chest = new THREE.Group();
    chest.position.y = 0.32;
    torso.add(chest);
    P.chest = chest;
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.rotation.order = 'YXZ';
      arm.position.set(s * 0.31, 0.02, 0);
      chest.add(arm);
      k.mk(geo.capsule(0.055, 0.12, 4, 10), grey, arm, [0, -0.11, 0]);
      const hand = new THREE.Group();
      hand.position.y = -0.25;
      arm.add(hand);
      k.mk(geo.sphere(0.085, 12, 10), k.t('#ff8a3d'), hand, [0, 0, 0]);
      P[s < 0 ? 'armR' : 'armL'] = arm;
      P[s < 0 ? 'handR' : 'handL'] = hand;
    }
    const head = new THREE.Group();
    head.position.y = 0.12;
    chest.add(head);
    P.head = head;
    k.mk(geo.box(0.64, 0.5, 0.52, 0.16, 4), teal, head, [0, 0.27, 0]);
    k.mk(geo.box(0.5, 0.33, 0.06, 0.07, 3), k.t('#16243f', { rim: 0.2 }), head, [0, 0.27, 0.25], { outline: false });
    const eyeG = k.g('#7dfcff');
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(s * 0.11, 0.3, 0.285);
      head.add(g);
      k.mk(geo.capsule(0.045, 0.05, 4, 10), eyeG, g, [0, 0, 0], { outline: false, shadow: false, scale: [1, 1, 0.4] });
      P.eyes.push(g);
    }
    k.mk(geo.torus(0.05, 0.014, PI, 6, 12), eyeG, head, [0, 0.19, 0.285], { rot: [0, 0, PI], outline: false, shadow: false });
    for (const s of [-1, 1]) k.mk(geo.cyl(0.08, 0.08, 0.06, 16), grey, head, [s * 0.33, 0.27, 0], { rot: [0, 0, PI / 2] });
    k.mk(geo.cyl(0.015, 0.015, 0.24, 6), grey, head, [0.15, 0.62, -0.05], { outline: false });
    P.extras.bulb = k.mk(geo.sphere(0.055, 12, 10), k.g('#ff4d6d'), head, [0.15, 0.76, -0.05]);
    // backpack with spare bombs
    k.mk(geo.box(0.36, 0.34, 0.2, 0.06, 2), k.t('#8a5a3c'), chest, [0, -0.08, -0.29]);
    const bombM = k.t('#2b2b3a', { rim: 0.5 });
    k.mk(geo.sphere(0.09, 12, 10), bombM, chest, [0.1, 0.12, -0.3]);
    k.mk(geo.sphere(0.08, 12, 10), bombM, chest, [-0.1, 0.12, -0.3]);
    // held bomb
    const bomb = new THREE.Group();
    bomb.position.set(0, -0.1, 0);
    P.handR.add(bomb);
    k.mk(geo.sphere(0.12, 16, 12), bombM, bomb, [0, 0, 0]);
    k.mk(geo.cyl(0.02, 0.02, 0.08, 6), k.t('#c9a46a'), bomb, [0, 0.13, 0], { outline: false });
    k.mk(geo.sphere(0.035, 8, 6), k.g('#ffd23f'), bomb, [0, 0.18, 0], { outline: false, shadow: false });
    P.extras.bomb = bomb;
    P.muzzle = new THREE.Vector3(-0.3, 0.9, 0.1);
    P.style = 'thrower';
    return P;
  },

  kumo(k) {
    const fur = '#3347b8';
    const P = humanoid(k, { skin: fur, top: '#1f2440', bottom: '#1f2440', shoe: '#11131f', bodyW: 0.95, headR: 0.36, sleeve: '#1f2440', glove: '#11131f' });
    // light muzzle, nose and whiskers
    k.mk(geo.sphere(0.19, 18, 14), k.t('#dfe5ff'), P.head, [0, 0.19, 0.21], { scale: [1.3, 0.78, 0.85] });
    k.mk(geo.sphere(0.04, 10, 8), k.t('#ff8fb1', { rim: 0.6 }), P.head, [0, 0.25, 0.375], { scale: [1.2, 0.8, 0.8], outline: false });
    const wh = k.t('#11131f');
    for (const s of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        k.mk(geo.cyl(0.006, 0.006, 0.2, 4), wh, P.head, [s * 0.25, 0.2 - i * 0.05, 0.27], { rot: [0, s * 0.5, PI / 2 + s * (i ? -0.12 : 0.08)], outline: false, shadow: false });
      }
    }
    face(k, P, { ey: 0.36, ez: 0.3, eyeMat: k.g('#ffe24a'), slit: true, mouth: false, brow: true, browTilt: 0.35, browColor: '#11131f', eyeScale: [0.95, 1.05, 0.55] });
    k.mk(geo.torus(0.035, 0.01, PI, 6, 10), k.t('#11131f'), P.head, [-0.033, 0.19, 0.37], { rot: [0, 0, PI], outline: false, shadow: false });
    k.mk(geo.torus(0.035, 0.01, PI, 6, 10), k.t('#11131f'), P.head, [0.033, 0.19, 0.37], { rot: [0, 0, PI], outline: false, shadow: false });
    // ears
    for (const s of [-1, 1]) {
      const ear = k.mk(geo.cone(0.12, 0.24, 12), k.t(fur), P.head, [s * 0.2, 0.62, -0.02], { rot: [0, 0, -s * 0.38] });
      k.mk(geo.cone(0.065, 0.15, 10), k.t('#ff8fb1'), ear, [0, -0.02, 0.045], { outline: false });
    }
    const red = k.t('#ff3b4f');
    k.mk(geo.torus(0.345, 0.038, PI * 2, 6, 32), red, P.head, [0, 0.45, 0], { rot: [PI / 2 + 0.1, 0, 0] });
    // scarf
    k.mk(geo.torus(0.17, 0.075, PI * 2, 8, 24), red, P.chest, [0, 0.14, 0], { rot: [PI / 2, 0, 0] });
    const scarf = new THREE.Group();
    scarf.position.set(0.05, 0.14, -0.18);
    P.chest.add(scarf);
    k.mk(geo.box(0.11, 0.035, 0.36, 0.015, 2), red, scarf, [0, 0, -0.17]);
    k.mk(geo.box(0.1, 0.035, 0.28, 0.015, 2), red, scarf, [-0.1, -0.03, -0.12], { rot: [0, -0.4, 0] });
    P.extras.scarf = scarf;
    // tail
    const tail = new THREE.Group();
    tail.position.set(0, 0.12, -0.2);
    P.torso.add(tail);
    const furM = k.t(fur);
    puffs(k, tail, furM, [[0, 0, -0.05, 0.075], [0, 0.07, -0.16, 0.07], [0, 0.19, -0.23, 0.065], [0, 0.32, -0.24, 0.062]]);
    k.mk(geo.sphere(0.065, 10, 8), k.t('#cdd6ff'), tail, [0, 0.43, -0.21]);
    P.extras.tail = tail;
    // belt
    k.mk(geo.torus(0.25, 0.04, PI * 2, 6, 28), red, P.torso, [0, 0.08, 0], { rot: [PI / 2, 0, 0], scale: [0.98, 0.84, 1] });
    // katana in right hand
    const kat = handFrame(P.handR);
    k.mk(geo.cyl(0.03, 0.03, 0.2, 8), k.t('#2a1a3a'), kat, [0, 0, -0.02], { rot: [PI / 2, 0, 0] });
    k.mk(geo.cyl(0.075, 0.075, 0.025, 16), k.t('#ffcc33'), kat, [0, 0, 0.09], { rot: [PI / 2, 0, 0] });
    k.mk(geo.box(0.025, 0.075, 0.72, 0.01, 1), k.t('#e8eeff', { rim: 0.6 }), kat, [0, 0, 0.47]);
    k.mk(geo.box(0.012, 0.02, 0.68, 0.005, 1), k.g('#7fd8ff'), kat, [0, 0.042, 0.47], { outline: false, shadow: false });
    P.weapon = kat;
    P.muzzle = new THREE.Vector3(0, 0.75, 0.6);
    P.style = 'melee';
    return P;
  },

  mira(k) {
    const P = humanoid(k, { skin: '#ffe2cc', top: '#ff6fb5', bottom: '#fff0f7', shoe: '#7a3cc8', bodyW: 0.86, headR: 0.36, sleeve: '#ff6fb5' });
    face(k, P, { blush: '#ff9fb0', ey: 0.32 });
    // dress
    k.mk(geo.cone(0.36, 0.42, 24), k.t('#ff6fb5'), P.torso, [0, 0.03, 0], {});
    k.mk(geo.torus(0.29, 0.035, PI * 2, 6, 28), k.t('#ffffff'), P.torso, [0, -0.16, 0], { rot: [PI / 2, 0, 0], outline: false });
    const hairM = k.t('#59e0b4');
    puffs(k, P.head, hairM, [
      [0, 0.58, -0.03, 0.25], [0, 0.48, -0.19, 0.27], [0.19, 0.52, -0.08, 0.2], [-0.19, 0.52, -0.08, 0.2],
      [0.27, 0.34, -0.1, 0.17], [-0.27, 0.34, -0.1, 0.17], [0, 0.3, -0.25, 0.25],
      [0.11, 0.58, 0.21, 0.13, [1.2, 0.75, 0.9]], [-0.12, 0.57, 0.21, 0.13, [1.2, 0.75, 0.9]],
      [0.4, 0.24, -0.07, 0.14], [-0.4, 0.24, -0.07, 0.14],
    ]);
    // flower crown
    const petal = [k.t('#ffffff'), k.t('#ffd23f'), k.t('#ff9fe0')];
    for (let i = 0; i < 6; i++) {
      const a = -PI * 0.15 + (i / 5) * PI * 1.3 - PI * 0.5;
      const x = Math.cos(a) * 0.3;
      const z = -Math.sin(a) * 0.3;
      const f = k.mk(geo.sphere(0.065, 10, 8), petal[i % 3], P.head, [x, 0.66 - Math.abs(x) * 0.18, z * 0.8 + 0.04], {});
      k.mk(geo.sphere(0.03, 8, 6), petal[(i + 1) % 3], f, [0, 0.03, 0.03], { outline: false, shadow: false });
    }
    // wings
    const wingM = k.t('#b6f7ff', { rim: 0.6, transparent: true, opacity: 0.8 });
    const wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(s * 0.1, 0.06, -0.2);
      P.chest.add(w);
      k.mk(geo.sphere(0.2, 14, 10), wingM, w, [s * 0.16, 0.08, -0.04], { scale: [1, 0.55, 0.12], rot: [0, 0, s * 0.5], outline: false });
      k.mk(geo.sphere(0.14, 14, 10), wingM, w, [s * 0.12, -0.1, -0.03], { scale: [1, 0.5, 0.12], rot: [0, 0, -s * 0.6], outline: false });
      wings.push(w);
    }
    P.extras.wings = wings;
    // staff
    const st = handFrame(P.handR);
    k.mk(geo.cyl(0.03, 0.035, 1.6, 8), k.t('#8a5a3c'), st, [0, 0, -0.42], { rot: [PI / 2, 0, 0] });
    k.mk(geo.torus(0.09, 0.028, PI * 1.5, 6, 14), k.t('#5fbf4a'), st, [0, 0, -1.16], { rot: [0, PI / 2, 0] });
    k.mk(geo.sphere(0.07, 10, 8), k.t('#5fbf4a'), st, [0.07, 0, -1.08], { scale: [1.4, 0.5, 0.8] });
    const crystal = k.mk(geo.octa(0.12), k.g('#ff8fe0'), st, [0, 0, -1.32], { scale: [0.8, 0.8, 1.35] });
    P.extras.crystal = crystal;
    P.weapon = st;
    P.muzzle = new THREE.Vector3(-0.2, 1.1, 0.3);
    P.style = 'staff';
    return P;
  },

  bolt(k) {
    const P = rigBase();
    const blue = k.t('#5a7bb5');
    const darkB = k.t('#36476b');
    const yellow = k.t('#ffc21f');
    const metal = k.t('#2c3142');
    const hips = new THREE.Group();
    hips.position.y = 0.42;
    P.rig.add(hips);
    P.hips = hips;
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(0.17 * s, 0, 0);
      hips.add(leg);
      k.mk(geo.capsule(0.11, 0.1, 4, 12), darkB, leg, [0, -0.14, 0]);
      k.mk(geo.box(0.24, 0.13, 0.32, 0.05, 2), yellow, leg, [0, -0.32, 0.04]);
      P[s < 0 ? 'legR' : 'legL'] = leg;
    }
    const torso = new THREE.Group();
    hips.add(torso);
    P.torso = torso;
    k.mk(geo.sphere(0.34, 24, 18), blue, torso, [0, 0.24, 0], { scale: [1.15, 1, 0.95] });
    k.mk(geo.box(0.36, 0.22, 0.1, 0.05, 2), yellow, torso, [0, 0.18, 0.27], { rot: [-0.15, 0, 0] });
    for (let i = 0; i < 3; i++) k.mk(geo.box(0.05, 0.16, 0.02, 0.01, 1), metal, torso, [-0.1 + i * 0.1, 0.18, 0.325], { rot: [-0.15, 0, 0.5], outline: false });
    const chest = new THREE.Group();
    chest.position.y = 0.36;
    torso.add(chest);
    P.chest = chest;
    // head
    const head = new THREE.Group();
    head.position.y = 0.14;
    chest.add(head);
    P.head = head;
    k.mk(geo.box(0.44, 0.34, 0.4, 0.12, 3), blue, head, [0, 0.18, 0.03]);
    k.mk(geo.box(0.36, 0.12, 0.06, 0.04, 2), metal, head, [0, 0.2, 0.22], { outline: false });
    const visor = k.g('#ff4d4d');
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(s * 0.08, 0.2, 0.25);
      head.add(g);
      k.mk(geo.box(0.1, 0.05, 0.02, 0.015, 1), visor, g, [0, 0, 0], { outline: false, shadow: false });
      P.eyes.push(g);
    }
    for (const s of [-1, 1]) k.mk(geo.cyl(0.02, 0.02, 0.18, 6), metal, head, [s * 0.17, 0.4, -0.05], { rot: [0, 0, s * 0.3], outline: false });
    // exhaust pipes
    for (const s of [-1, 1]) k.mk(geo.cyl(0.05, 0.06, 0.3, 10), metal, chest, [s * 0.14, 0.05, -0.33], { rot: [-0.4, 0, 0] });
    // left arm (normal claw)
    const armL = new THREE.Group();
    armL.rotation.order = 'YXZ';
    armL.position.set(0.42, 0.02, 0);
    chest.add(armL);
    k.mk(geo.sphere(0.15, 16, 12), yellow, armL, [0, 0.02, 0]);
    k.mk(geo.capsule(0.08, 0.14, 4, 10), darkB, armL, [0, -0.15, 0]);
    const handL = new THREE.Group();
    handL.position.y = -0.3;
    armL.add(handL);
    k.mk(geo.sphere(0.11, 14, 10), k.t('#8a93a6'), handL, [0, 0, 0]);
    P.armL = armL;
    P.handL = handL;
    // rocket pod on left shoulder
    const pod = new THREE.Group();
    pod.position.set(0.3, 0.28, -0.04);
    chest.add(pod);
    k.mk(geo.box(0.28, 0.22, 0.3, 0.05, 2), yellow, pod, [0, 0, 0]);
    for (let i = 0; i < 4; i++) k.mk(geo.cyl(0.04, 0.04, 0.04, 10), metal, pod, [(i % 2 ? 0.06 : -0.06), (i < 2 ? 0.05 : -0.05), 0.15], { rot: [PI / 2, 0, 0], outline: false });
    P.extras.pod = pod;
    // right arm = minigun
    const armR = new THREE.Group();
    armR.rotation.order = 'YXZ';
    armR.position.set(-0.42, 0.02, 0);
    chest.add(armR);
    k.mk(geo.sphere(0.16, 16, 12), yellow, armR, [0, 0.02, 0]);
    k.mk(geo.capsule(0.08, 0.1, 4, 10), darkB, armR, [0, -0.12, 0]);
    const handR = new THREE.Group();
    handR.position.y = -0.24;
    armR.add(handR);
    P.armR = armR;
    P.handR = handR;
    const gf = handFrame(handR);
    k.mk(geo.cyl(0.14, 0.15, 0.3, 18), metal, gf, [0, 0, 0.05], { rot: [PI / 2, 0, 0] });
    k.mk(geo.torus(0.14, 0.03, PI * 2, 6, 20), yellow, gf, [0, 0, 0.2], { outline: false });
    const spin = new THREE.Group();
    spin.position.z = 0.2;
    gf.add(spin);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      k.mk(geo.cyl(0.028, 0.028, 0.42, 8), k.t('#5d6478'), spin, [Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0.2], { rot: [PI / 2, 0, 0], outline: false });
    }
    k.mk(geo.torus(0.085, 0.025, PI * 2, 6, 18), metal, spin, [0, 0, 0.38], { outline: false });
    P.extras.spin = spin;
    P.muzzle = new THREE.Vector3(-0.42, 0.72, 0.95);
    P.style = 'minigun';
    return P;
  },
};

export function buildHeroModel(id) {
  const k = new Kit();
  const P = BUILDERS[id](k);
  P.kit = k;
  P.id = id;
  P.st = { t: Math.random() * 10, phase: 0, move: 0, atk: 0, sup: 0, squash: 0, blink: 2 + Math.random() * 3, air: 0, spin: 0, spinV: 0, hurt: 0, pose: 0 };
  return P;
}

// Hit flash / tint. amount 0..1
export function setFlash(P, amount, color = 0xffffff) {
  for (const m of P.kit.mats) {
    if (m.userData.glow) continue;
    m.emissive.setHex(color);
    m.emissiveIntensity = amount;
  }
}

export function setOpacity(P, op) {
  const transparent = op < 0.999;
  for (const m of P.kit.mats) {
    if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.opacity;
    const want = m.userData.baseOpacity * op;
    if (m.opacity !== want || m.transparent !== (transparent || m.userData.baseOpacity < 1)) {
      m.opacity = want;
      const t = transparent || m.userData.baseOpacity < 1;
      if (m.transparent !== t) {
        m.transparent = t;
        m.needsUpdate = true;
      }
    }
  }
  for (const o of P.kit.outlines) o.visible = !transparent;
}

const lerp = (a, b, t) => a + (b - a) * t;

// Procedural animation. st.move: 0..1, st.atk: attack timer (1 -> 0), st.sup: super timer (1 -> 0)
export function animateHero(P, dt, opt = {}) {
  const st = P.st;
  st.t += dt;
  const mv = st.move;
  st.phase += dt * (4 + mv * 9) * (mv > 0.05 ? 1 : 0);
  const sw = Math.sin(st.phase);
  const idle = Math.sin(st.t * 2.4);
  // legs
  P.legL.rotation.x = sw * 0.8 * mv;
  P.legR.rotation.x = -sw * 0.8 * mv;
  // body bob + lean
  P.rig.position.y = Math.abs(Math.cos(st.phase)) * 0.07 * mv + idle * 0.012 * (1 - mv) + st.air;
  P.rig.rotation.x = 0.13 * mv;
  P.torso.rotation.y = sw * 0.12 * mv;
  P.head.rotation.y = -sw * 0.08 * mv;
  P.head.rotation.z = Math.sin(st.t * 1.3) * 0.03 * (1 - mv);
  P.head.position.y = (P.head.userData.y0 ??= P.head.position.y) + idle * 0.008;
  // squash & stretch
  st.squash = lerp(st.squash, 0, 1 - Math.exp(-dt * 10));
  const sq = st.squash;
  const bs = P.baseScale || 1;
  P.rig.scale.set(bs * (1 + sq * 0.5), bs * (1 - sq), bs * (1 + sq * 0.5));
  // blink
  st.blink -= dt;
  let eyeY = 1;
  if (st.blink < 0.12) eyeY = 0.15;
  if (st.blink < 0) st.blink = 2.5 + Math.random() * 3.5;
  for (const e of P.eyes) e.scale.y = eyeY;

  const atk = st.atk;
  const armSwing = sw * 0.7 * mv;
  st.atk = Math.max(0, st.atk - dt * (opt.atkSpeed || 3.2));
  st.sup = Math.max(0, st.sup - dt * 1.6);

  switch (P.style) {
    case 'twoHand': {
      const kick = atk * atk;
      P.armR.rotation.set(-1.32 + kick * 0.35 + Math.sin(st.t * 2.4) * 0.02, 0.5, 0);
      P.armL.rotation.set(-1.25 + kick * 0.3, -0.85, 0);
      P.gun.position.z = (P.gun.userData.z0 ??= P.gun.position.z) - kick * 0.12;
      P.gun.rotation.x = -kick * 0.25;
      break;
    }
    case 'minigun': {
      st.spinV = lerp(st.spinV, atk > 0 ? 40 : 2, 1 - Math.exp(-dt * 6));
      P.extras.spin.rotation.z += st.spinV * dt;
      const kick = atk > 0 ? Math.sin(st.t * 60) * 0.04 : 0;
      P.armR.rotation.set(-PI / 2 + kick, 0.12, 0);
      P.armL.rotation.set(-armSwing * 0.8 - 0.1, 0, 0.15);
      P.extras.pod.position.z = -0.04 - st.sup * 0.1;
      P.extras.pod.rotation.x = -st.sup * 0.5;
      break;
    }
    case 'melee': {
      const run = mv;
      if (atk > 0) {
        const p = 1 - atk;
        const sweep = p < 0.45 ? lerp(-1.6, 1.5, p / 0.45) : 1.5 - (p - 0.45) * 1.2;
        P.armR.rotation.set(-1.45, sweep, 0);
        P.torso.rotation.y = sweep * 0.35;
      } else {
        P.armR.rotation.set(lerp(-0.7, 1.0, run) + armSwing * 0.3, lerp(0.3, 0.2, run), 0);
      }
      P.armL.rotation.set(lerp(0.15, 1.0, run) - armSwing * 0.3, 0, lerp(0.1, 0.2, run));
      if (P.extras.tail) P.extras.tail.rotation.y = Math.sin(st.t * 3) * 0.3;
      if (P.extras.tail) P.extras.tail.rotation.x = -0.2 + Math.sin(st.t * 2.2) * 0.15;
      if (P.extras.scarf) P.extras.scarf.rotation.x = 0.25 + mv * 0.5 + Math.sin(st.t * 12) * 0.12 * (0.3 + mv);
      break;
    }
    case 'staff': {
      const thrust = atk > 0 ? Math.sin((1 - atk) * PI) : 0;
      P.armR.rotation.set(-0.3 - thrust * 1.1 + armSwing * 0.15, 0.1, -0.32);
      P.armL.rotation.set(-armSwing, 0, 0.2 + st.sup * 1.5);
      P.extras.crystal.rotation.z += dt * 2;
      P.extras.crystal.scale.setScalar(1 + Math.sin(st.t * 4) * 0.08 + thrust * 0.4);
      for (let i = 0; i < 2; i++) {
        const w = P.extras.wings[i];
        w.rotation.y = (i ? -1 : 1) * (0.3 + Math.sin(st.t * (8 + mv * 8)) * 0.35);
      }
      break;
    }
    case 'thrower': {
      let r = -0.4 + armSwing * 0.3;
      if (atk > 0) {
        const p = 1 - atk;
        r = p < 0.25 ? lerp(-0.4, 1.1, p / 0.25) : lerp(1.1, -2.6, Math.min(1, (p - 0.25) / 0.3));
      }
      P.armR.rotation.set(r, 0.1, -0.1);
      P.armL.rotation.set(-armSwing, 0, 0.15);
      P.extras.bomb.visible = atk <= 0 || atk > 0.62;
      P.extras.bulb.visible = Math.sin(st.t * 6) > -0.3;
      break;
    }
  }
  if (st.sup > 0 && P.style !== 'minigun') {
    P.rig.rotation.y = 0;
  }
}
