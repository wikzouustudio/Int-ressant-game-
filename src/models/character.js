import * as THREE from 'three';
import { MeshBuilder, rng } from './builder.js';

const SKIN = ['#f6d3b8', '#eabf9b', '#d39a6a', '#a96d45', '#7a4a2c', '#f1c27d', '#5b3920'];
const HAIR = ['#2b1d14', '#4a2f1b', '#8b5a2b', '#e0b85a', '#b8461f', '#141414', '#9a9a9a', '#6b3fa0'];
const PANTS = ['#2d3a4f', '#3b3b46', '#5a4636', '#1f2937', '#4b5563'];
const HAIRSTYLES = ['short', 'long', 'bun', 'spiky', 'bald', 'short'];

// Colour slots resolved per instance in the crowd shader (see game/crowd.js)
const SKIN_S = { slot: 1 };
const HAIR_S = { slot: 2 };
const SHIRT_S = { slot: 3 };
const PANTS_S = { slot: 4 };
const ACCENT_S = { slot: 5 };

export function randomLook(seed, tierId, bizColor) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  return {
    tier: tierId,
    skin: pick(SKIN),
    hair: pick(HAIR),
    hairStyle: pick(HAIRSTYLES),
    pants: pick(PANTS),
    shirt: bizColor,
    tie: pick(['#d62828', '#1d4ed8', '#7c3aed', '#047857', '#b45309']),
    robotPaint: pick(['#cfd8e3', '#f0b429', '#e5e7eb', '#9fb3c8', '#ffb4a2']),
    eye: pick(['#00e5ff', '#76ff03', '#ff4081', '#ffd600']),
  };
}

/** Per-instance colours (linear RGB): skin, hair, shirt, pants, accent. */
export function lookColors(look) {
  const robot = look.tier === 'robot';
  const list = [look.skin, look.hair, robot ? look.robotPaint : look.shirt, look.pants, robot ? look.eye : look.tie];
  const out = new Float32Array(15);
  const c = new THREE.Color();
  list.forEach((hex, i) => { c.set(hex); out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b; });
  return out;
}

const o = (base, extra) => ({ ...extra, ...base });

// ---------------------------------------------------------------------------
// Geometry templates (shared by every NPC of the same kind)
// ---------------------------------------------------------------------------
function bodyGeo(b, tier, hs) {
  if (tier === 'robot') {
    b.rbox(0.9, 0.86, 0.6, 0.18, '#000', o({ y: 0.95, mat: 'metal' }, SHIRT_S));
    b.cyl(0.32, 0.32, 0.05, '#1f2937', { y: 1.4, z: 0.29, rx: Math.PI / 2 });
    b.sphere(0.16, '#000', o({ y: 1.42, z: 0.31, sz: 0.4, mat: 'neon' }, ACCENT_S));
    b.cyl(0.14, 0.14, 0.2, '#6b7280', { y: 1.78, mat: 'metal' });
    b.rbox(0.84, 0.72, 0.74, 0.2, '#000', o({ y: 1.92, mat: 'metal' }, SHIRT_S));
    b.rbox(0.7, 0.24, 0.1, 0.05, '#0b1220', { y: 2.2, z: 0.35 });
    b.box(0.5, 0.08, 0.05, '#000', o({ y: 2.28, z: 0.41, mat: 'neon' }, ACCENT_S));
    b.cyl(0.03, 0.03, 0.45, '#9ca3af', { y: 2.62, mat: 'metal' });
    b.sphere(0.09, '#ff3b3b', { y: 3.1, mat: 'neon' });
    b.cyl(0.12, 0.12, 0.12, '#6b7280', { x: 0.46, y: 2.2, rz: Math.PI / 2, mat: 'metal' });
    b.cyl(0.12, 0.12, 0.12, '#6b7280', { x: -0.34, y: 2.2, rz: Math.PI / 2, mat: 'metal' });
    return;
  }
  const torso = tier === 'expert' ? { c: '#1f2937', s: {} } : { c: '#000', s: SHIRT_S };
  b.rbox(0.86, 0.84, 0.54, 0.16, torso.c, o({ y: 0.95 }, torso.s));
  b.box(0.88, 0.1, 0.56, '#2a2a2a', { y: 0.95 });
  b.box(0.14, 0.08, 0.04, '#d4af37', { y: 0.96, z: 0.28, mat: 'gold' });
  b.cyl(0.15, 0.17, 0.2, '#000', o({ y: 1.74 }, SKIN_S));
  // head
  b.sphere(0.46, '#000', o({ y: 2.22 }, SKIN_S), 20, 16);
  b.sphere(0.09, '#000', o({ x: -0.45, y: 2.2, sx: 0.5 }, SKIN_S));
  b.sphere(0.09, '#000', o({ x: 0.45, y: 2.2, sx: 0.5 }, SKIN_S));
  // face
  b.sphere(0.065, '#1b1b1b', { x: -0.16, y: 2.27, z: 0.41, sz: 0.5 }, 10, 8);
  b.sphere(0.065, '#1b1b1b', { x: 0.16, y: 2.27, z: 0.41, sz: 0.5 }, 10, 8);
  b.sphere(0.022, '#ffffff', { x: -0.14, y: 2.3, z: 0.445 }, 6, 4);
  b.sphere(0.022, '#ffffff', { x: 0.18, y: 2.3, z: 0.445 }, 6, 4);
  b.box(0.1, 0.035, 0.03, '#1b1b1b', { x: -0.16, y: 2.4, z: 0.42 });
  b.box(0.1, 0.035, 0.03, '#1b1b1b', { x: 0.16, y: 2.4, z: 0.42 });
  b.sphere(0.07, '#000', o({ y: 2.16, z: 0.45, sz: 0.7, k: 0.88 }, SKIN_S), 8, 6);
  b.box(0.16, 0.035, 0.03, '#8a3b3b', { y: 2.03, z: 0.43 });
  b.sphere(0.075, '#ff9b9b', { x: -0.27, y: 2.12, z: 0.36, sz: 0.35 }, 8, 6);
  b.sphere(0.075, '#ff9b9b', { x: 0.27, y: 2.12, z: 0.36, sz: 0.35 }, 8, 6);
  // hair
  if (hs !== 'bald' && tier !== 'apprentice') {
    b.sphere(0.49, '#000', o({ y: 2.24, z: -0.03, rx: -0.45 }, HAIR_S), 20, 12, Math.PI * 0.52);
    if (hs === 'long') b.rbox(0.86, 0.75, 0.3, 0.12, '#000', o({ y: 1.72, z: -0.26 }, HAIR_S));
    if (hs === 'bun') b.sphere(0.2, '#000', o({ y: 2.74, z: -0.22 }, HAIR_S));
    if (hs === 'spiky') {
      for (let i = 0; i < 5; i++) b.cone(0.12, 0.3, '#000', o({ x: -0.28 + i * 0.14, y: 2.58, z: -0.05, rx: -0.4 }, HAIR_S), 5);
    }
  } else if (hs === 'long' && tier === 'apprentice') {
    b.rbox(0.82, 0.6, 0.28, 0.12, '#000', o({ y: 1.8, z: -0.27 }, HAIR_S));
  }
  if (tier === 'apprentice') {
    b.sphere(0.5, '#000', o({ y: 2.26, rx: -0.25, k: 0.8 }, SHIRT_S), 20, 10, Math.PI * 0.48);
    b.box(0.62, 0.05, 0.42, '#000', o({ y: 2.42, z: 0.42, rx: -0.12, k: 0.7 }, SHIRT_S));
    b.sphere(0.06, '#ffffff', { y: 2.75, z: -0.04 }, 8, 6);
  }
  if (tier === 'employee') {
    b.box(0.44, 0.12, 0.06, '#ffffff', { y: 1.66, z: 0.25 });
    b.box(0.12, 0.5, 0.05, '#000', o({ y: 1.16, z: 0.28 }, ACCENT_S));
    b.box(0.18, 0.12, 0.05, '#000', o({ y: 1.62, z: 0.28 }, ACCENT_S));
    b.box(0.18, 0.06, 0.03, '#ffffff', { x: 0.24, y: 1.5, z: 0.27 });
  }
  if (tier === 'expert') {
    b.box(0.3, 0.62, 0.04, '#f8fafc', { y: 1.15, z: 0.26 });
    b.box(0.1, 0.48, 0.05, '#000', o({ y: 1.2, z: 0.285 }, ACCENT_S));
    b.torus(0.11, 0.02, '#111827', { x: -0.16, y: 2.27, z: 0.44 }, Math.PI * 2, 6, 16);
    b.torus(0.11, 0.02, '#111827', { x: 0.16, y: 2.27, z: 0.44 }, Math.PI * 2, 6, 16);
    b.box(0.1, 0.02, 0.02, '#111827', { y: 2.29, z: 0.45 });
    b.box(0.12, 0.08, 0.02, '#d4af37', { x: -0.26, y: 1.55, z: 0.275, mat: 'gold' });
  }
}

function armGeo(b, tier) {
  if (tier === 'robot') {
    b.sphere(0.16, '#6b7280', { y: -0.02, mat: 'metal' }, 10, 8);
    b.cyl(0.1, 0.1, 0.62, '#000', o({ y: -0.68, mat: 'metal' }, SHIRT_S), 10);
    b.sphere(0.15, '#374151', { y: -0.72, mat: 'metal' }, 10, 8);
    return;
  }
  if (tier === 'expert') b.rbox(0.26, 0.6, 0.28, 0.1, '#1f2937', { y: -0.6 });
  else b.rbox(0.26, 0.6, 0.28, 0.1, '#000', o({ y: -0.6 }, SHIRT_S));
  if (tier === 'expert') b.box(0.24, 0.06, 0.26, '#f8fafc', { y: -0.62 });
  b.sphere(0.14, '#000', o({ y: -0.72 }, SKIN_S), 12, 10);
}

function legGeo(b, tier) {
  if (tier === 'robot') {
    b.cyl(0.13, 0.13, 0.72, '#6b7280', { y: -0.8, mat: 'metal' }, 10);
    b.rbox(0.36, 0.22, 0.5, 0.08, '#000', o({ y: -1.0, z: 0.06, mat: 'metal' }, SHIRT_S));
    return;
  }
  b.rbox(0.33, 0.8, 0.35, 0.1, '#000', o({ y: -0.82 }, PANTS_S));
  b.rbox(0.36, 0.2, 0.52, 0.08, tier === 'expert' ? '#111111' : '#f5f5f5', { y: -1.0, z: 0.07 });
  b.box(0.37, 0.05, 0.53, '#3a3a3a', { y: -1.0, z: 0.07 });
}

const PROPS = {
  bag(b) {
    b.sphere(0.34, '#c8a165', { y: -0.98, z: 0.12, sy: 0.92 }, 14, 10);
    b.cyl(0.1, 0.16, 0.16, '#a07a45', { y: -0.72, z: 0.12 }, 10);
    b.torus(0.11, 0.035, '#6b4f2a', { y: -0.67, z: 0.12, rx: Math.PI / 2 }, Math.PI * 2, 6, 12);
    b.box(0.16, 0.2, 0.04, '#2f855a', { y: -1.08, z: 0.44 });
    b.cyl(0.11, 0.11, 0.04, '#f5c542', { x: 0.08, y: -0.62, z: 0.1, rz: 0.4, mat: 'gold' }, 12);
  },
  cup(b) {
    b.cyl(0.11, 0.09, 0.22, '#ffffff', { y: -0.86, z: 0.12, mat: 'soft' }, 10);
    b.cyl(0.095, 0.095, 0.02, '#6b3f1f', { y: -0.65, z: 0.12 }, 10);
  },
  phone(b) {
    b.rbox(0.1, 0.32, 0.04, 0.02, '#111827', { y: -0.9, z: 0.1, mat: 'soft' });
    b.box(0.08, 0.26, 0.01, '#60a5fa', { y: -0.87, z: 0.125, mat: 'neon' });
  },
  cloth(b) {
    b.box(0.3, 0.04, 0.24, '#60a5fa', { y: -0.84, z: 0.08 });
  },
};

const templates = new Map();
/**
 * Shared geometry for a character part.
 * key: 'body:<tier>:<hair>' | 'arm:<tier>' | 'leg:<tier>' | 'bag' | 'cup' | 'phone' | 'cloth'
 * lod: 0 (near) or 2 (far)
 */
export function partGeometry(key, lod) {
  const id = key + '|' + lod;
  if (templates.has(id)) return templates.get(id);
  const b = new MeshBuilder({ lod, extra: true });
  const [part, tier, hair] = key.split(':');
  if (part === 'body') bodyGeo(b, tier, hair);
  else if (part === 'arm') armGeo(b, tier);
  else if (part === 'leg') legGeo(b, tier);
  else PROPS[part](b);
  const g = b.buildGeometry();
  if (g) g.userData.shared = true;
  templates.set(id, g);
  return g;
}

// ---------------------------------------------------------------------------
// Rig: lightweight Object3D skeleton animated on the CPU, drawn by the crowd renderer
// ---------------------------------------------------------------------------
export function createCharacter(look) {
  const root = new THREE.Group();
  const pivot = new THREE.Group(); // bobbing / leaning
  root.add(pivot);
  const node = (x, y, parent = pivot) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    parent.add(g);
    return g;
  };
  const armL = node(-0.55, 1.7);
  const armR = node(0.55, 1.7);
  const legL = node(-0.21, 1.0);
  const legR = node(0.21, 1.0);
  const bag = node(0, 0, armR);
  const cup = node(0, 0, armL);
  const phone = node(0, 0, armR);
  const cloth = node(0, 0, armR);
  bag.visible = cup.visible = phone.visible = cloth.visible = false;

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 3, 1.5).translate(0, 1.5, 0),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.material.userData.owned = true;
  root.add(hit);

  const t = look.tier;
  const parts = [
    [pivot, `body:${t}:${t === 'robot' ? '-' : look.hairStyle}`],
    [armL, `arm:${t}`], [armR, `arm:${t}`], [legL, `leg:${t}`], [legR, `leg:${t}`],
    [bag, 'bag'], [cup, 'cup'], [phone, 'phone'], [cloth, 'cloth'],
  ];
  return { root, pivot, armL, armR, legL, legR, bag, cup, phone, cloth, hit, parts, colors: lookColors(look), lod: 0, animSkip: 0 };
}

const still = (c) => {
  c.legL.rotation.x *= 0.7;
  c.legR.rotation.x *= 0.7;
  c.pivot.rotation.z = 0;
};

/**
 * Pose a character.
 * mode: walk | carry | hammer | type | serve | inspect | push | wipe | phone | coffee | cheer | idle
 */
export function animateCharacter(c, mode, t, phase) {
  const s = Math.sin(phase);
  let bob = 0;
  c.cup.visible = mode === 'coffee';
  c.phone.visible = mode === 'phone';
  c.cloth.visible = mode === 'wipe';
  c.armL.rotation.y = 0;
  c.armR.rotation.y = 0;
  switch (mode) {
    case 'walk':
    case 'carry':
      c.legL.rotation.x = s * 0.75;
      c.legR.rotation.x = -s * 0.75;
      c.armL.rotation.x = -s * 0.65;
      c.armR.rotation.x = mode === 'carry' ? -0.45 + s * 0.12 : s * 0.65;
      c.armL.rotation.z = -0.06;
      c.armR.rotation.z = 0.06;
      bob = Math.abs(Math.cos(phase)) * 0.12;
      c.pivot.rotation.x = 0.08;
      c.pivot.rotation.z = s * 0.03;
      break;
    case 'hammer':
      still(c);
      c.armR.rotation.x = -1.5 + Math.sin(t * 11) * 0.55;
      c.armL.rotation.x = -0.9 + Math.sin(t * 11 + 1.5) * 0.2;
      c.armL.rotation.z = -0.1;
      c.armR.rotation.z = 0.1;
      c.pivot.rotation.x = 0.12 + Math.sin(t * 5.5) * 0.03;
      bob = Math.abs(Math.sin(t * 5.5)) * 0.04;
      break;
    case 'type':
      still(c);
      c.armR.rotation.x = -1.1 + Math.sin(t * 16) * 0.15;
      c.armL.rotation.x = -1.1 + Math.sin(t * 16 + 2) * 0.15;
      c.armL.rotation.z = -0.1;
      c.armR.rotation.z = 0.1;
      c.pivot.rotation.x = 0.1;
      break;
    case 'serve': {
      still(c);
      const k = (Math.sin(t * 2.2) + 1) / 2; // hand out goods, take money
      c.armR.rotation.x = -1.35 - k * 0.25;
      c.armL.rotation.x = -0.4 - (1 - k) * 0.9;
      c.armL.rotation.z = -0.15;
      c.armR.rotation.z = 0.05;
      c.pivot.rotation.x = 0.06 + k * 0.06;
      bob = Math.sin(t * 4.4) * 0.02;
      break;
    }
    case 'inspect':
      still(c);
      c.armR.rotation.x = -2.0;
      c.armR.rotation.z = -0.55;
      c.armL.rotation.x = -0.5 + Math.sin(t * 1.5) * 0.15;
      c.armL.rotation.z = -0.5;
      c.pivot.rotation.x = 0.2 + Math.sin(t * 1.2) * 0.08;
      c.pivot.rotation.z = Math.sin(t * 0.8) * 0.06;
      break;
    case 'push':
      c.legL.rotation.x = Math.sin(t * 6) * 0.35 - 0.2;
      c.legR.rotation.x = -Math.sin(t * 6) * 0.35 + 0.3;
      c.armL.rotation.x = -1.25 + Math.sin(t * 6) * 0.1;
      c.armR.rotation.x = -1.25 + Math.sin(t * 6) * 0.1;
      c.armL.rotation.z = 0.05;
      c.armR.rotation.z = -0.05;
      c.pivot.rotation.x = 0.35;
      c.pivot.rotation.z = 0;
      bob = Math.abs(Math.sin(t * 6)) * 0.05;
      break;
    case 'wipe':
      still(c);
      c.armR.rotation.x = -1.2;
      c.armR.rotation.y = Math.sin(t * 7) * 0.6;
      c.armR.rotation.z = 0.2 + Math.sin(t * 7) * 0.2;
      c.armL.rotation.x = -0.3;
      c.armL.rotation.z = -0.15;
      c.pivot.rotation.x = 0.28;
      break;
    case 'phone':
      still(c);
      c.armR.rotation.x = -2.5;
      c.armR.rotation.z = -0.9;
      c.armL.rotation.x = -0.2 + Math.sin(t * 2.5) * 0.4;
      c.armL.rotation.z = -0.4 - Math.max(0, Math.sin(t * 2.5)) * 0.4;
      c.pivot.rotation.x = 0;
      c.pivot.rotation.z = Math.sin(t * 0.9) * 0.05;
      bob = Math.sin(t * 2) * 0.02;
      break;
    case 'coffee': {
      still(c);
      const sip = Math.max(0, Math.sin(t * 0.9)) ** 3;
      c.armL.rotation.x = -1.2 - sip * 1.1;
      c.armL.rotation.z = 0.25 + sip * 0.35;
      c.armR.rotation.x = 0.05;
      c.armR.rotation.z = 0.12;
      c.pivot.rotation.x = -sip * 0.08;
      bob = Math.sin(t * 2.4) * 0.02;
      break;
    }
    case 'cheer':
      c.armL.rotation.x = -2.8;
      c.armR.rotation.x = -2.8;
      c.armL.rotation.z = -0.35 + Math.sin(t * 18) * 0.15;
      c.armR.rotation.z = 0.35 - Math.sin(t * 18) * 0.15;
      c.legL.rotation.x = 0;
      c.legR.rotation.x = 0;
      c.pivot.rotation.x = -0.05;
      c.pivot.rotation.z = 0;
      bob = Math.abs(Math.sin(t * 12)) * 0.35;
      break;
    default:
      still(c);
      c.armL.rotation.x = Math.sin(t * 2) * 0.05;
      c.armR.rotation.x = -Math.sin(t * 2) * 0.05;
      c.armL.rotation.z = -0.08;
      c.armR.rotation.z = 0.08;
      c.pivot.rotation.x = 0;
      bob = Math.sin(t * 2.4) * 0.02;
  }
  c.pivot.position.y = bob;
}
