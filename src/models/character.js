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
// Blocky "voxel" characters (Minecraft-like proportions, 1 px ≈ 0.085 u) with softly
// rounded edges: 8×8 head, 8×12×4 torso, 4×12×4 arms and legs.
const DARK = '#1b1d24';

function hair(b, hs) {
  if (hs === 'bald') return;
  b.rbox(0.78, 0.17, 0.78, 0.06, '#000', o({ y: 2.62 }, HAIR_S));
  b.rbox(0.78, hs === 'long' ? 1.0 : 0.56, 0.15, 0.05, '#000', o({ y: hs === 'long' ? 1.68 : 2.14, z: -0.33 }, HAIR_S));
  for (const x of [-0.355, 0.355]) b.rbox(0.09, 0.34, 0.66, 0.04, '#000', o({ x, y: 2.36, z: -0.05 }, HAIR_S));
  b.rbox(0.78, 0.12, 0.1, 0.04, '#000', o({ y: 2.56, z: 0.34 }, HAIR_S));
  if (hs === 'bun') b.rbox(0.32, 0.3, 0.3, 0.1, '#000', o({ y: 2.76, z: -0.2 }, HAIR_S));
  if (hs === 'spiky') {
    for (let i = 0; i < 4; i++) b.rbox(0.18, 0.2, 0.18, 0.05, '#000', o({ x: -0.27 + i * 0.18, y: 2.74, z: -0.05 + (i % 2) * 0.12, rz: (i - 1.5) * 0.15 }, HAIR_S));
  }
}

function face(b, tier) {
  for (const s of [-1, 1]) {
    b.box(0.17, 0.11, 0.03, '#ffffff', { x: s * 0.17, y: 2.3, z: 0.36, sharp: true });
    b.box(0.08, 0.11, 0.04, DARK, { x: s * 0.13, y: 2.3, z: 0.365, sharp: true });
    b.box(0.17, 0.04, 0.03, '#3a2a22', { x: s * 0.17, y: 2.46, z: 0.36, sharp: true });
  }
  b.box(0.12, 0.1, 0.05, '#000', o({ y: 2.18, z: 0.36, k: 0.86, sharp: true }, SKIN_S));
  b.box(0.24, 0.05, 0.03, '#8a3b3b', { y: 2.08, z: 0.36, sharp: true });
  if (tier === 'expert') {
    for (const s of [-1, 1]) {
      b.box(0.24, 0.035, 0.03, '#111827', { x: s * 0.17, y: 2.41, z: 0.385, sharp: true });
      b.box(0.24, 0.035, 0.03, '#111827', { x: s * 0.17, y: 2.27, z: 0.385, sharp: true });
      b.box(0.035, 0.17, 0.03, '#111827', { x: s * 0.29, y: 2.27, z: 0.385, sharp: true });
    }
    b.box(0.1, 0.03, 0.03, '#111827', { y: 2.37, z: 0.385, sharp: true });
  }
}

function bodyGeo(b, tier, hs) {
  if (tier === 'robot') {
    b.rbox(0.72, 1.0, 0.4, 0.08, '#000', o({ y: 1.02, mat: 'metal' }, SHIRT_S));
    b.rbox(0.46, 0.4, 0.06, 0.04, '#1f2937', { y: 1.42, z: 0.19 });
    b.box(0.3, 0.1, 0.04, '#000', o({ y: 1.58, z: 0.22, mat: 'neon', sharp: true }, ACCENT_S));
    b.box(0.08, 0.08, 0.04, '#ff3b3b', { x: -0.12, y: 1.46, z: 0.22, mat: 'neon', sharp: true });
    b.box(0.08, 0.08, 0.04, '#3bff7a', { x: 0.04, y: 1.46, z: 0.22, mat: 'neon', sharp: true });
    b.rbox(0.76, 0.72, 0.72, 0.1, '#000', o({ y: 2.04, mat: 'metal' }, SHIRT_S));
    b.rbox(0.62, 0.24, 0.06, 0.05, '#0b1220', { y: 2.26, z: 0.35 });
    b.box(0.46, 0.08, 0.04, '#000', o({ y: 2.34, z: 0.385, mat: 'neon', sharp: true }, ACCENT_S));
    b.box(0.05, 0.36, 0.05, '#9ca3af', { y: 2.76, mat: 'metal', sharp: true });
    b.rbox(0.14, 0.14, 0.14, 0.05, '#ff3b3b', { y: 3.1, mat: 'neon' });
    for (const s of [-1, 1]) b.rbox(0.08, 0.2, 0.2, 0.03, '#6b7280', { x: s * 0.41, y: 2.3, mat: 'metal' });
    return;
  }
  const torso = tier === 'expert' ? { c: '#1f2937', s: {} } : { c: '#000', s: SHIRT_S };
  b.rbox(0.7, 1.0, 0.38, 0.07, torso.c, o({ y: 1.02 }, torso.s));
  b.rbox(0.72, 0.09, 0.4, 0.03, '#2a2a2a', { y: 1.04 });
  b.box(0.12, 0.07, 0.03, '#d4af37', { y: 1.05, z: 0.2, mat: 'gold', sharp: true });
  b.rbox(0.74, 0.72, 0.72, 0.1, '#000', o({ y: 2.04 }, SKIN_S));
  face(b, tier);
  if (tier === 'apprentice') {
    if (hs === 'long') b.rbox(0.78, 0.9, 0.15, 0.05, '#000', o({ y: 1.78, z: -0.33 }, HAIR_S));
    b.rbox(0.8, 0.22, 0.8, 0.07, '#000', o({ y: 2.62, k: 0.8 }, SHIRT_S));
    b.rbox(0.62, 0.07, 0.32, 0.03, '#000', o({ y: 2.62, z: 0.5, k: 0.65 }, SHIRT_S));
    b.rbox(0.2, 0.12, 0.04, 0.02, '#ffffff', { y: 2.68, z: 0.405 });
  } else if (tier === 'builder') {
    // hard hat + hi-vis stripes on the (orange) vest
    b.rbox(0.82, 0.24, 0.82, 0.12, '#ffd43b', { y: 2.62 });
    b.rbox(0.92, 0.06, 0.92, 0.03, '#f2b705', { y: 2.6 });
    b.rbox(0.3, 0.12, 0.06, 0.03, '#f2b705', { y: 2.84, z: 0 });
    for (const y of [1.35, 1.7]) b.box(0.72, 0.07, 0.4, '#e9ecef', { y, sharp: true });
  } else {
    hair(b, hs);
  }
  if (tier === 'employee') {
    b.box(0.36, 0.1, 0.05, '#ffffff', { y: 1.92, z: 0.19, sharp: true });
    b.box(0.12, 0.56, 0.04, '#000', o({ y: 1.34, z: 0.205, sharp: true }, ACCENT_S));
    b.box(0.17, 0.1, 0.05, '#000', o({ y: 1.86, z: 0.205, sharp: true }, ACCENT_S));
    b.box(0.14, 0.05, 0.03, '#ffffff', { x: 0.2, y: 1.7, z: 0.2, sharp: true });
  }
  if (tier === 'expert') {
    b.box(0.26, 0.9, 0.04, '#f8fafc', { y: 1.12, z: 0.19, sharp: true });
    b.box(0.1, 0.6, 0.05, '#000', o({ y: 1.3, z: 0.205, sharp: true }, ACCENT_S));
    b.box(0.12, 0.08, 0.03, '#d4af37', { x: -0.22, y: 1.78, z: 0.2, mat: 'gold', sharp: true });
  }
}

function armGeo(b, tier) {
  if (tier === 'robot') {
    b.rbox(0.3, 1.0, 0.3, 0.06, '#000', o({ y: -1.0, mat: 'metal' }, SHIRT_S));
    b.box(0.32, 0.08, 0.32, '#374151', { y: -0.55, mat: 'metal', sharp: true });
    return;
  }
  if (tier === 'expert') b.rbox(0.34, 0.62, 0.34, 0.06, '#1f2937', { y: -0.62 });
  else b.rbox(0.34, 0.44, 0.34, 0.06, '#000', o({ y: -0.44 }, SHIRT_S));
  if (tier === 'expert') b.box(0.33, 0.08, 0.33, '#f8fafc', { y: -0.66, sharp: true });
  b.rbox(0.32, tier === 'expert' ? 0.4 : 0.58, 0.32, 0.06, '#000', o({ y: -1.0 }, SKIN_S));
}

function legGeo(b, tier) {
  if (tier === 'robot') {
    b.rbox(0.32, 0.8, 0.32, 0.06, '#6b7280', { y: -0.82, mat: 'metal' });
    b.rbox(0.36, 0.22, 0.44, 0.06, '#000', o({ y: -1.02, z: 0.04, mat: 'metal' }, SHIRT_S));
    return;
  }
  b.rbox(0.34, 0.84, 0.36, 0.06, '#000', o({ y: -0.84 }, PANTS_S));
  b.rbox(0.36, 0.2, 0.42, 0.06, tier === 'expert' ? '#111111' : '#f5f5f5', { y: -1.02, z: 0.03 });
  b.box(0.37, 0.05, 0.43, '#3a3a3a', { y: -1.02, z: 0.03, sharp: true });
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
  const armL = node(-0.53, 2.0);
  const armR = node(0.53, 2.0);
  const legL = node(-0.175, 1.02);
  const legR = node(0.175, 1.02);
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
