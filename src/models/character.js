import * as THREE from 'three';
import { MeshBuilder, rng } from './builder.js';

const SKIN = ['#f6d3b8', '#eabf9b', '#d39a6a', '#a96d45', '#7a4a2c', '#f1c27d', '#5b3920'];
const HAIR = ['#2b1d14', '#4a2f1b', '#8b5a2b', '#e0b85a', '#b8461f', '#141414', '#9a9a9a', '#6b3fa0'];
const PANTS = ['#2d3a4f', '#3b3b46', '#5a4636', '#1f2937', '#4b5563'];
const HAIRSTYLES = ['short', 'long', 'bun', 'spiky', 'bald', 'short'];

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

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

/**
 * Builds a stylised, chunky character (~2.6 units tall) with pivoted limbs.
 * Returns { root, body, armL, armR, legL, legR, bag, hit }.
 */
export function createCharacter(look) {
  const robot = look.tier === 'robot';
  const root = new THREE.Group();
  const pivot = new THREE.Group(); // bobbing / leaning
  root.add(pivot);

  const skin = look.skin;
  const metal = look.robotPaint;
  const sleeve = look.tier === 'expert' ? '#1f2937' : look.shirt;
  const torsoColor = look.tier === 'expert' ? '#1f2937' : look.shirt;

  // ---------- body ----------
  const b = new MeshBuilder();
  if (robot) {
    b.rbox(0.9, 0.86, 0.6, 0.18, metal, { y: 0.95, mat: 'metal' });
    b.cyl(0.32, 0.32, 0.05, '#1f2937', { y: 1.4, z: 0.29, rx: Math.PI / 2 });
    b.sphere(0.16, look.eye, { y: 1.42, z: 0.31, sz: 0.4, mat: 'neon' });
    b.cyl(0.14, 0.14, 0.2, '#6b7280', { y: 1.78, mat: 'metal' });
    b.rbox(0.84, 0.72, 0.74, 0.2, metal, { y: 1.92, mat: 'metal' });
    b.rbox(0.7, 0.24, 0.1, 0.05, '#0b1220', { y: 2.2, z: 0.35 });
    b.box(0.5, 0.08, 0.05, look.eye, { y: 2.28, z: 0.41, mat: 'neon' });
    b.cyl(0.03, 0.03, 0.45, '#9ca3af', { y: 2.62, mat: 'metal' });
    b.sphere(0.09, '#ff3b3b', { y: 3.1, mat: 'neon' });
    b.cyl(0.12, 0.12, 0.12, '#6b7280', { x: 0.46, y: 2.2, rz: Math.PI / 2, mat: 'metal' });
    b.cyl(0.12, 0.12, 0.12, '#6b7280', { x: -0.34, y: 2.2, rz: Math.PI / 2, mat: 'metal' });
  } else {
    b.rbox(0.86, 0.84, 0.54, 0.16, torsoColor, { y: 0.95 });
    b.box(0.88, 0.1, 0.56, '#2a2a2a', { y: 0.95 });
    b.box(0.14, 0.08, 0.04, '#d4af37', { y: 0.96, z: 0.28, mat: 'gold' });
    b.cyl(0.15, 0.17, 0.2, skin, { y: 1.74 });
    // head
    b.sphere(0.46, skin, { y: 2.22 }, 20, 16);
    b.sphere(0.09, skin, { x: -0.45, y: 2.2, sx: 0.5 });
    b.sphere(0.09, skin, { x: 0.45, y: 2.2, sx: 0.5 });
    // face
    b.sphere(0.065, '#1b1b1b', { x: -0.16, y: 2.27, z: 0.41, sz: 0.5 }, 10, 8);
    b.sphere(0.065, '#1b1b1b', { x: 0.16, y: 2.27, z: 0.41, sz: 0.5 }, 10, 8);
    b.sphere(0.022, '#ffffff', { x: -0.14, y: 2.3, z: 0.445 }, 6, 4);
    b.sphere(0.022, '#ffffff', { x: 0.18, y: 2.3, z: 0.445 }, 6, 4);
    b.box(0.1, 0.035, 0.03, '#1b1b1b', { x: -0.16, y: 2.4, z: 0.42 });
    b.box(0.1, 0.035, 0.03, '#1b1b1b', { x: 0.16, y: 2.4, z: 0.42 });
    b.sphere(0.07, shade(skin, 0.88), { y: 2.16, z: 0.45, sz: 0.7 }, 8, 6);
    b.box(0.16, 0.035, 0.03, '#8a3b3b', { y: 2.03, z: 0.43 });
    b.sphere(0.075, '#ff9b9b', { x: -0.27, y: 2.12, z: 0.36, sz: 0.35 }, 8, 6);
    b.sphere(0.075, '#ff9b9b', { x: 0.27, y: 2.12, z: 0.36, sz: 0.35 }, 8, 6);

    // hair
    const hs = look.hairStyle;
    if (hs !== 'bald' && look.tier !== 'intern') {
      b.sphere(0.49, look.hair, { y: 2.24, z: -0.03, rx: -0.45 }, 20, 12, Math.PI * 0.52);
      if (hs === 'long') b.rbox(0.86, 0.75, 0.3, 0.12, look.hair, { y: 1.72, z: -0.26 });
      if (hs === 'bun') b.sphere(0.2, look.hair, { y: 2.74, z: -0.22 });
      if (hs === 'spiky') {
        for (let i = 0; i < 5; i++) {
          b.cone(0.12, 0.3, look.hair, { x: -0.28 + i * 0.14, y: 2.58, z: -0.05, rx: -0.4 }, 5);
        }
      }
    } else if (hs === 'long' && look.tier === 'intern') {
      b.rbox(0.82, 0.6, 0.28, 0.12, look.hair, { y: 1.8, z: -0.27 });
    }

    if (look.tier === 'intern') {
      // company cap
      b.sphere(0.5, shade(look.shirt, 0.8), { y: 2.26, rx: -0.25 }, 20, 10, Math.PI * 0.48);
      b.box(0.62, 0.05, 0.42, shade(look.shirt, 0.7), { y: 2.42, z: 0.42, rx: -0.12 });
      b.sphere(0.06, '#ffffff', { y: 2.75, z: -0.04 }, 8, 6);
    }
    if (look.tier === 'employee') {
      b.box(0.44, 0.12, 0.06, '#ffffff', { y: 1.66, z: 0.25 });
      b.box(0.12, 0.5, 0.05, look.tie, { y: 1.16, z: 0.28 });
      b.box(0.18, 0.12, 0.05, look.tie, { y: 1.62, z: 0.28 });
      b.box(0.18, 0.06, 0.03, '#ffffff', { x: 0.24, y: 1.5, z: 0.27 });
    }
    if (look.tier === 'expert') {
      b.box(0.3, 0.62, 0.04, '#f8fafc', { y: 1.15, z: 0.26 });
      b.box(0.1, 0.48, 0.05, look.tie, { y: 1.2, z: 0.285 });
      // glasses
      b.torus(0.11, 0.02, '#111827', { x: -0.16, y: 2.27, z: 0.44 }, Math.PI * 2, 6, 16);
      b.torus(0.11, 0.02, '#111827', { x: 0.16, y: 2.27, z: 0.44 }, Math.PI * 2, 6, 16);
      b.box(0.1, 0.02, 0.02, '#111827', { y: 2.29, z: 0.45 });
      b.box(0.12, 0.08, 0.02, '#d4af37', { x: -0.26, y: 1.55, z: 0.275, mat: 'gold' });
    }
  }
  const body = b.build();
  pivot.add(body);

  // ---------- arms ----------
  const makeArm = (side) => {
    const a = new MeshBuilder();
    if (robot) {
      a.sphere(0.16, '#6b7280', { y: -0.02, mat: 'metal' }, 10, 8);
      a.cyl(0.1, 0.1, 0.62, metal, { y: -0.68, mat: 'metal' }, 10);
      a.sphere(0.15, '#374151', { y: -0.72, mat: 'metal' }, 10, 8);
    } else {
      a.rbox(0.26, 0.6, 0.28, 0.1, sleeve, { y: -0.6 });
      if (look.tier === 'expert') a.box(0.24, 0.06, 0.26, '#f8fafc', { y: -0.62 });
      a.sphere(0.14, skin, { y: -0.72 }, 12, 10);
    }
    const g = new THREE.Group();
    g.add(a.build());
    g.position.set(side * 0.55, 1.7, 0);
    return g;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);
  pivot.add(armL, armR);

  // ---------- legs ----------
  const makeLeg = (side) => {
    const l = new MeshBuilder();
    if (robot) {
      l.cyl(0.13, 0.13, 0.72, '#6b7280', { y: -0.8, mat: 'metal' }, 10);
      l.rbox(0.36, 0.22, 0.5, 0.08, metal, { y: -1.0, z: 0.06, mat: 'metal' });
    } else {
      l.rbox(0.33, 0.8, 0.35, 0.1, look.pants, { y: -0.82 });
      l.rbox(0.36, 0.2, 0.52, 0.08, look.tier === 'expert' ? '#111111' : '#f5f5f5', { y: -1.0, z: 0.07 });
      l.box(0.37, 0.05, 0.53, '#3a3a3a', { y: -1.0, z: 0.07 });
    }
    const g = new THREE.Group();
    g.add(l.build());
    g.position.set(side * 0.21, 1.0, 0);
    return g;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);
  pivot.add(legL, legR);

  // ---------- money bag (carried in right hand) ----------
  const bagB = new MeshBuilder();
  bagB.sphere(0.34, '#c8a165', { y: -0.98, z: 0.12, sy: 0.92 }, 14, 10);
  bagB.cyl(0.1, 0.16, 0.16, '#a07a45', { y: -0.72, z: 0.12 }, 10);
  bagB.torus(0.11, 0.035, '#6b4f2a', { y: -0.67, z: 0.12, rx: Math.PI / 2 }, Math.PI * 2, 6, 12);
  bagB.box(0.16, 0.2, 0.04, '#2f855a', { y: -1.08, z: 0.44 });
  bagB.cyl(0.11, 0.11, 0.04, '#f5c542', { x: 0.08, y: -0.62, z: 0.1, rz: 0.4, mat: 'gold' }, 12);
  const bag = bagB.build();
  bag.visible = false;
  armR.add(bag);

  // Invisible hit volume for picking
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 3, 1.5).translate(0, 1.5, 0),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.material.userData.owned = true;
  root.add(hit);

  return { root, pivot, body, armL, armR, legL, legR, bag, hit };
}

/**
 * Pose a character. mode: 'walk' | 'work' | 'idle' | 'cheer' | 'carry'
 */
export function animateCharacter(c, mode, t, phase, workStyle = 0) {
  const s = Math.sin(phase);
  let bob = 0;
  if (mode === 'walk' || mode === 'carry') {
    c.legL.rotation.x = s * 0.75;
    c.legR.rotation.x = -s * 0.75;
    c.armL.rotation.x = -s * 0.65;
    c.armR.rotation.x = mode === 'carry' ? -0.45 + s * 0.12 : s * 0.65;
    c.armL.rotation.z = -0.06;
    c.armR.rotation.z = 0.06;
    bob = Math.abs(Math.cos(phase)) * 0.12;
    c.pivot.rotation.x = 0.08;
    c.pivot.rotation.z = s * 0.03;
  } else if (mode === 'work') {
    c.legL.rotation.x = 0;
    c.legR.rotation.x = 0;
    c.pivot.rotation.z = 0;
    if (workStyle === 0) {
      // hammering / mixing
      c.armR.rotation.x = -1.5 + Math.sin(t * 11) * 0.55;
      c.armL.rotation.x = -0.9 + Math.sin(t * 11 + 1.5) * 0.2;
    } else {
      // typing / handling
      c.armR.rotation.x = -1.1 + Math.sin(t * 16) * 0.15;
      c.armL.rotation.x = -1.1 + Math.sin(t * 16 + 2) * 0.15;
    }
    c.armL.rotation.z = -0.1;
    c.armR.rotation.z = 0.1;
    c.pivot.rotation.x = 0.12 + Math.sin(t * 5.5) * 0.03;
    bob = Math.abs(Math.sin(t * 5.5)) * 0.04;
  } else if (mode === 'cheer') {
    c.armL.rotation.x = -2.8;
    c.armR.rotation.x = -2.8;
    c.armL.rotation.z = -0.35 + Math.sin(t * 18) * 0.15;
    c.armR.rotation.z = 0.35 - Math.sin(t * 18) * 0.15;
    c.legL.rotation.x = 0;
    c.legR.rotation.x = 0;
    c.pivot.rotation.x = -0.05;
    bob = Math.abs(Math.sin(t * 12)) * 0.35;
  } else {
    c.legL.rotation.x *= 0.8;
    c.legR.rotation.x *= 0.8;
    c.armL.rotation.x = Math.sin(t * 2) * 0.05;
    c.armR.rotation.x = -Math.sin(t * 2) * 0.05;
    c.armL.rotation.z = -0.08;
    c.armR.rotation.z = 0.08;
    c.pivot.rotation.x = 0;
    bob = Math.sin(t * 2.4) * 0.02;
  }
  c.pivot.position.y = bob;
}
