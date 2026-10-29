import * as THREE from 'three';
import { MeshBuilder } from './builder.js';
import { PAL, crate } from './kit.js';

// Animated construction machinery: excavator (demolition), bulldozer, tower crane,
// concrete mixer truck and the whole construction site sequence.

const YELLOW = '#ffc93c';
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

function pivot(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function mesh(build) {
  const b = new MeshBuilder();
  build(b);
  return b.build();
}

function tracks(b, len = 3.0, gap = 0.95) {
  for (const z of [-gap, gap]) {
    b.box(len, 0.72, 0.9, '#2e3440', { z, r: 0.32 });
    for (const x of [-len / 2 + 0.45, 0, len / 2 - 0.45]) b.cyl(0.26, 0.26, 0.96, '#5f6875', { x, y: 0.36, z: z - 0.48, rx: Math.PI / 2, mat: 'metal' }, 10);
    for (let x = -len / 2 + 0.2; x < len / 2; x += 0.3) b.box(0.08, 0.06, 0.92, '#1f2329', { x, y: 0.7, z, sharp: true });
  }
}

/** Excavator with a rotating cab and an articulated boom / stick / bucket. */
export function buildExcavator() {
  const group = new THREE.Group();
  group.add(mesh((b) => tracks(b)));
  const cab = pivot(group, 0, 0.72, 0);
  cab.add(mesh((b) => {
    b.box(2.6, 1.0, 2.3, YELLOW, { y: 0, r: 0.25 });
    b.box(1.3, 1.35, 1.25, YELLOW, { x: -0.55, y: 1.0, z: 0.45, r: 0.2 });
    b.box(1.05, 0.85, 0.06, '#bfe3ff', { x: -0.55, y: 1.3, z: 1.09, mat: 'glass', sharp: true });
    b.box(0.06, 0.85, 1.0, '#bfe3ff', { x: -1.21, y: 1.3, z: 0.45, mat: 'glass', sharp: true });
    b.box(1.0, 0.75, 2.1, '#3a3f4b', { x: 0.75, y: 1.0, r: 0.2 });
    b.cyl(0.09, 0.09, 0.8, PAL.dark, { x: 0.9, y: 1.7, z: -0.6, mat: 'metal' }, 8);
    b.box(0.5, 0.1, 0.5, '#ff922b', { x: 0.2, y: 1.0, z: -0.6, mat: 'lit', sharp: true });
  }));
  // boom (pivot at the cab front) → stick → bucket; arm points toward +Z
  const boom = pivot(cab, -0.1, 1.0, 1.0);
  boom.add(mesh((b) => {
    b.box(0.5, 0.5, 3.3, YELLOW, { y: -0.25, z: 1.6, r: 0.18 });
    b.cyl(0.11, 0.11, 2.4, '#adb5bd', { y: 0.2, z: 0.4, rx: Math.PI / 2 - 0.35, mat: 'metal' }, 8);
  }));
  const stick = pivot(boom, 0, 0, 3.2);
  stick.add(mesh((b) => {
    b.box(0.42, 0.42, 2.4, YELLOW, { y: -0.21, z: 1.15, r: 0.15 });
  }));
  const bucket = pivot(stick, 0, 0, 2.3);
  bucket.add(mesh((b) => {
    b.box(1.0, 0.7, 0.55, '#5f6875', { y: -0.6, z: 0.1, r: 0.15, mat: 'metal' });
    for (let k = 0; k < 4; k++) b.cone(0.07, 0.25, '#adb5bd', { x: -0.36 + k * 0.24, y: -0.6, z: 0.42, rx: Math.PI / 2, mat: 'metal' }, 6);
  }));
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group, cab, boom, stick, bucket };
}

/** World position of the bucket teeth (impact point). */
export function bucketTip(exc, out) {
  return exc.bucket.localToWorld(out.set(0, -0.6, 0.45));
}

export function buildBulldozer() {
  const group = new THREE.Group();
  group.add(mesh((b) => {
    tracks(b, 2.6, 0.8);
    b.box(2.0, 0.9, 1.9, YELLOW, { y: 0.7, r: 0.22 });
    b.box(1.0, 1.0, 1.1, YELLOW, { x: -0.3, y: 1.6, r: 0.18 });
    b.box(0.06, 0.7, 0.9, '#bfe3ff', { x: 0.21, y: 1.75, mat: 'glass', sharp: true });
    b.box(0.25, 1.0, 2.6, '#5f6875', { x: 1.7, y: 0.05, r: 0.08, mat: 'metal' });
    b.box(0.6, 0.12, 0.12, '#5f6875', { x: 1.3, y: 0.6, z: 0.7, sharp: true });
    b.box(0.6, 0.12, 0.12, '#5f6875', { x: 1.3, y: 0.6, z: -0.7, sharp: true });
    b.cyl(0.08, 0.08, 0.7, PAL.dark, { x: -0.8, y: 1.6, z: 0.5, mat: 'metal' }, 8);
  }));
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

export function buildMixer() {
  const group = new THREE.Group();
  group.add(mesh((b) => {
    b.box(4.6, 0.45, 1.8, '#3a3f4b', { y: 0.55, r: 0.12 });
    for (const x of [-1.6, -0.6, 1.6]) for (const z of [-0.85, 0.85]) b.cyl(0.45, 0.45, 0.32, '#22262d', { x, y: 0.45, z: z - Math.sign(z) * 0.16, rx: Math.PI / 2 }, 14);
    b.box(1.4, 1.5, 1.9, '#e0573f', { x: 1.6, y: 0.95, r: 0.25 });
    b.box(0.06, 0.7, 1.5, '#bfe3ff', { x: 2.32, y: 1.6, mat: 'glass', sharp: true });
    b.box(0.6, 0.25, 0.25, '#adb5bd', { x: -2.4, y: 1.0, rz: -0.6, mat: 'metal', sharp: true });
  }));
  const drum = pivot(group, -0.7, 2.0, 0);
  drum.rotation.z = 0.25;
  drum.add(mesh((b) => {
    b.cyl(0.95, 0.6, 2.8, '#f1f3f5', { x: -1.4, rz: -Math.PI / 2, mat: 'soft' }, 16);
    for (let k = 0; k < 3; k++) b.torus(0.82 - k * 0.08, 0.06, '#e0573f', { x: -0.9 + k * 0.7, ry: Math.PI / 2 }, Math.PI * 2, 6, 18);
  }));
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group, drum };
}

/** Rubble mound left after demolition. */
export function buildRubble(color) {
  const b = new MeshBuilder();
  const tint = (k) => '#' + new THREE.Color(color).multiplyScalar(k).getHexString();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 1 + (i % 3) * 1.3;
    b.blob(1.0 + (i % 4) * 0.35, tint(0.7 + (i % 3) * 0.12), { x: Math.cos(a) * r, y: 0.2, z: -1 + Math.sin(a) * r * 0.8, sy: 0.55 }, 1);
  }
  for (let i = 0; i < 6; i++) b.box(2 + (i % 2), 0.15, 0.25, '#9c7a52', { x: -2 + i * 0.8, y: 0.9, z: -1 + (i % 3) - 1, ry: i * 1.1, rz: 0.3 });
  const g = b.build();
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------------------
// Construction site sequence
// ---------------------------------------------------------------------------
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let enqueteTex = null;
function enqueteBoard() {
  if (!enqueteTex) {
    enqueteTex = canvasTexture(256, 192, (g) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 192);
      g.fillStyle = '#e03131'; g.fillRect(0, 0, 256, 50);
      g.fillStyle = '#ffffff'; g.fillRect(16, 12, 26, 26);
      g.fillStyle = '#e03131'; g.fillRect(26, 15, 6, 20); g.fillRect(19, 22, 20, 6);
      g.fillStyle = '#ffffff'; g.font = '900 22px Outfit, Arial'; g.textBaseline = 'middle';
      g.fillText('AVIS OFFICIEL', 56, 26);
      g.fillStyle = '#1e2433'; g.font = '800 26px Outfit, Arial'; g.textAlign = 'center';
      g.fillText('MISE À', 128, 84); g.fillText("L'ENQUÊTE", 128, 114); g.fillText('PUBLIQUE', 128, 144);
      g.font = '600 15px Outfit, Arial'; g.fillStyle = '#5b6475';
      g.fillText('Demande de permis de construire', 128, 174);
    });
  }
  const board = mesh((b) => {
    b.box(0.12, 1.4, 0.12, '#5b6475', { x: -0.8, mat: 'metal' });
    b.box(0.12, 1.4, 0.12, '#5b6475', { x: 0.8, mat: 'metal' });
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.42), new THREE.MeshStandardMaterial({ map: enqueteTex, roughness: 0.7 }));
  plate.position.set(0, 1.7, 0.08);
  board.add(plate);
  return board;
}

const MAST = new THREE.Vector3(-5.2, 0, -5.2);
const PILE = new THREE.Vector3(-3.6, 0, 3.4);
const CORE = new THREE.Vector3(0, 0, -1);
const FLOORS = 6;
const FLOOR_H = 1.25;

const ease = (x) => x * x * (3 - 2 * x);

export function buildConstructionSite(color) {
  const root = new THREE.Group();

  // --- phase 1: gabarits (profile poles) + leveling bulldozer ---
  const gabarits = mesh((b) => {
    const h = 7;
    for (const [x, z] of [[-5, -5], [5, -5], [5, 3], [-5, 3]]) {
      b.box(0.14, h, 0.14, '#f1f3f5', { x, z });
      for (let k = 0; k < 4; k++) b.box(0.15, 0.35, 0.15, '#e03131', { x, y: h - 0.35 - k * 0.7, z });
    }
    b.box(10, 0.06, 0.06, '#e03131', { y: h - 0.2, z: -5, sharp: true });
    b.box(10, 0.06, 0.06, '#e03131', { y: h - 0.2, z: 3, sharp: true });
    b.box(0.06, 0.06, 8, '#e03131', { x: -5, y: h - 0.2, z: -1, sharp: true });
    b.box(0.06, 0.06, 8, '#e03131', { x: 5, y: h - 0.2, z: -1, sharp: true });
  });
  const board = enqueteBoard();
  board.position.set(-3.6, 0, 5.2);
  board.rotation.y = 0.3;
  root.add(gabarits, board);
  const dozer = buildBulldozer();
  root.add(dozer);

  // --- phase 2: site, foundation, rising floors, scaffolding ---
  const site = mesh((b) => {
    for (let i = 0; i < 12; i++) b.box(0.95, 1.1, 0.06, i % 2 ? '#ff922b' : '#f8f9fa', { x: -5.5 + i + 0.5, z: 5.2 });
    for (const x of [-6, 6]) b.box(0.06, 1.1, 11, '#f8f9fa', { x, z: -0.3, sharp: true });
    b.box(10, 0.4, 8, '#9aa0a6', { z: -1, r: 0.1 });
    b.box(3.2, 2.4, 2.2, '#f2f2f2', { x: 3.6, z: 3.2, r: 0.12 });
    b.box(3.3, 0.2, 2.3, '#495057', { x: 3.6, y: 2.4, z: 3.2, r: 0.06 });
    b.box(0.9, 0.6, 0.05, '#a5d8ff', { x: 3.0, y: 1.3, z: 4.31, mat: 'lit', sharp: true });
    for (let i = 0; i < 3; i++) crate(b, { x: PILE.x - 0.6 + (i % 2) * 1.1, y: 0, z: PILE.z - 0.4 + (i > 1 ? 0.9 : 0), s: 0.9, color: '#c9a46a' });
    b.cone(0.9, 0.9, '#d9c7a1', { x: -1.6, z: 3.8 }, 12);
    for (let k = 0; k < 4; k++) b.cyl(0.12, 0.12, 2.4, '#9aa4b1', { x: -4.6 + k * 0.28, y: 0.12, z: 2.0, rz: Math.PI / 2, mat: 'metal' }, 6);
  });
  root.add(site);
  const floors = [];
  for (let f = 0; f < FLOORS; f++) {
    const fl = mesh((b) => {
      b.box(8.4, FLOOR_H - 0.15, 6.4, f % 2 ? '#c5c9ce' : '#cdd1d6', { y: 0, r: 0.06 });
      b.box(8.6, 0.15, 6.6, f === FLOORS - 1 ? color : '#aeb4bb', { y: FLOOR_H - 0.15, r: 0.04 });
      for (let k = 0; k < 4; k++) b.box(1.2, 0.7, 0.05, '#3e5874', { x: -2.9 + k * 1.95, y: 0.25, z: 3.2, sharp: true });
    });
    fl.position.set(CORE.x, 0.4 + f * FLOOR_H, CORE.z);
    fl.visible = false;
    root.add(fl);
    floors.push(fl);
  }
  const scaffold = mesh((b) => {
    for (let l = 0; l < FLOORS; l++) {
      const y = l * FLOOR_H + 0.4;
      for (const [x, z] of [[-4.6, -4.6], [4.6, -4.6], [4.6, 2.6], [-4.6, 2.6], [0, 2.6]]) b.cyl(0.05, 0.05, FLOOR_H, '#adb5bd', { x, y, z, mat: 'metal' }, 6);
      b.box(9.4, 0.08, 0.8, '#c08a4a', { y: y + FLOOR_H - 0.05, z: 3.0, sharp: true });
      b.box(9.4, 0.05, 0.05, '#ff922b', { y: y + FLOOR_H + 0.75, z: 3.35, sharp: true });
      b.box(0.05, FLOOR_H * 1.1, 0.05, '#adb5bd', { x: -2.3, y, z: 3.35, rz: 0.6, sharp: true });
    }
  });
  scaffold.visible = false;
  root.add(scaffold);

  // tower crane: mast, slewing jib, trolley, cable, hook and load
  const crane = new THREE.Group();
  crane.position.copy(MAST);
  crane.add(mesh((b) => {
    b.box(0.7, 15, 0.7, YELLOW, { mat: 'metal' });
    for (let y = 1; y < 15; y += 1.2) b.box(0.74, 0.08, 0.74, '#e0a800', { y, sharp: true });
    b.box(1.8, 0.4, 1.8, '#495057', { y: -0.1, r: 0.1 });
  }));
  const slew = pivot(crane, 0, 15.2, 0);
  slew.add(mesh((b) => {
    b.box(16, 0.5, 0.5, YELLOW, { x: 4.5, mat: 'metal', r: 0.08 });
    b.box(2.4, 1.3, 1.1, '#495057', { x: -3.6, y: -1.0, r: 0.12 });
    b.box(1.3, 1.1, 1.1, '#e9ecef', { x: 0.4, y: -1.1, r: 0.15 });
    b.box(0.08, 2.4, 0.08, '#e0a800', { y: 0.5, sharp: true });
    b.box(0.06, 0.06, 10, '#adb5bd', { x: 4.5, y: 2.6, rz: 0, ry: Math.PI / 2, sharp: true });
  }));
  const trolley = pivot(slew, 6, -0.2, 0);
  trolley.add(mesh((b) => b.box(0.7, 0.3, 0.7, '#495057', { r: 0.08 })));
  const cable = mesh((b) => b.box(0.04, 1, 0.04, '#212529', { y: -1, sharp: true }));
  trolley.add(cable);
  const hook = pivot(trolley, 0, -4, 0);
  hook.add(mesh((b) => {
    b.box(0.55, 0.4, 0.55, '#ffd43b', { r: 0.1 });
    b.torus(0.18, 0.05, '#495057', { y: -0.3, mat: 'metal' }, Math.PI * 1.5, 6, 10);
  }));
  const load = mesh((b) => {
    b.box(1.2, 0.14, 1.2, '#9c6b3f', { y: -1.2 });
    for (let k = 0; k < 4; k++) b.box(0.5, 0.25, 0.5, '#c8553d', { x: (k % 2) * 0.55 - 0.27, y: -1.06, z: (k > 1 ? 0.55 : 0) - 0.27 });
    for (const s of [-1, 1]) b.box(0.03, 0.9, 0.03, '#212529', { x: s * 0.5, y: -1.1, rz: s * 0.4, sharp: true });
  });
  hook.add(load);
  root.add(crane);

  const mixer = buildMixer();
  mixer.group.position.set(5.0, 0, 7.6);
  mixer.group.rotation.y = Math.PI / 2;
  root.add(mixer.group);

  root.traverse((o) => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });

  const angleTo = (p) => Math.atan2(-(p.z - MAST.z), p.x - MAST.x);
  const reach = (p) => Math.hypot(p.x - MAST.x, p.z - MAST.z);
  const pileA = angleTo(PILE), pileR = reach(PILE);
  const coreA = angleTo(CORE), coreR = reach(CORE);
  let lastCycle = -1;
  let sparkT = 0;
  let dustT = 0;

  /** ctx: { fx, toWorld(v), shake(a) } */
  const update = (progress, t, dt, ctx) => {
    const p1 = progress < 0.3;
    gabarits.visible = board.visible = p1;
    dozer.visible = progress < 0.32;
    site.visible = crane.visible = scaffold.visible = !p1;
    mixer.group.visible = progress > 0.26 && progress < 0.62;

    if (p1) {
      // poles rise, then the bulldozer levels the lot
      gabarits.scale.y = ease(Math.min(1, progress / 0.06));
      const k = progress / 0.3;
      dozer.position.set(Math.sin(k * Math.PI * 3) * 3.2, 0, -1.2 + Math.cos(k * Math.PI * 1.5) * 1.5);
      dozer.rotation.y = Math.cos(k * Math.PI * 3) > 0 ? 0 : Math.PI;
      dustT -= dt;
      if (ctx.fx && dustT <= 0) {
        dustT = 0.18;
        ctx.fx.puff(ctx.toWorld(_v.set(dozer.position.x - Math.cos(dozer.rotation.y) * 1.4, 0.3, dozer.position.z)), { color: '#d9c7a1', size: 0.7, life: 1.0, up: 0.8, spread: 0.8, radial: 1.5, grow: 1 });
      }
      return;
    }
    const k2 = (progress - 0.3) / 0.7;

    // concrete mixer pouring the foundation
    if (mixer.group.visible) {
      mixer.drum.rotation.x += dt * 4;
      if (ctx.fx && Math.random() < 0.5) {
        ctx.fx.puff(ctx.toWorld(_v.set(2.6, 1.0, 5.4)), { color: '#8d939b', size: 0.35, life: 0.8, up: -1.5, spread: 0.3, radial: 0.6, grow: 0.5 });
      }
    }

    // floors appear one by one, scaffolding follows
    const built = Math.min(FLOORS, Math.floor(k2 * (FLOORS + 0.6)));
    floors.forEach((f, i) => {
      const was = f.visible;
      f.visible = i < built;
      if (f.visible && !was && ctx.fx) {
        ctx.fx.puff(ctx.toWorld(_v.set(0, 0.6 + i * FLOOR_H, -1)), { color: '#e9ecef', size: 1.1, life: 1.0, up: 0.8, spread: 6, radial: 3, count: 8, grow: 1.2 });
        ctx.shake?.(0.15);
      }
    });
    scaffold.scale.y = Math.max(0.05, (built + 0.6) / FLOORS);
    const top = 0.4 + built * FLOOR_H;

    // crane cycle: slew to pile, lower, hook a pallet, lift, slew to the building, lower, drop
    const P = 3.4;
    const cycle = Math.floor(t / P);
    const c = (t % P) / P;
    let a, r, depth;
    if (c < 0.2) { a = THREE.MathUtils.lerp(coreA, pileA, ease(c / 0.2)); r = THREE.MathUtils.lerp(coreR, pileR, ease(c / 0.2)); depth = 4; load.visible = false; }
    else if (c < 0.35) { a = pileA; r = pileR; depth = THREE.MathUtils.lerp(4, 13.6, ease((c - 0.2) / 0.15)); load.visible = c > 0.32; }
    else if (c < 0.5) { a = pileA; r = pileR; depth = THREE.MathUtils.lerp(13.6, 4, ease((c - 0.35) / 0.15)); load.visible = true; }
    else if (c < 0.72) { a = THREE.MathUtils.lerp(pileA, coreA, ease((c - 0.5) / 0.22)); r = THREE.MathUtils.lerp(pileR, coreR, ease((c - 0.5) / 0.22)); depth = 4; load.visible = true; }
    else if (c < 0.88) { a = coreA; r = coreR; depth = THREE.MathUtils.lerp(4, Math.max(2.5, 15.2 - top - 0.2), ease((c - 0.72) / 0.16)); load.visible = true; }
    else { a = coreA; r = coreR; depth = THREE.MathUtils.lerp(Math.max(2.5, 15.2 - top - 0.2), 4, ease((c - 0.88) / 0.12)); load.visible = false; }
    slew.rotation.y = a;
    trolley.position.x = r;
    hook.position.y = -depth;
    hook.rotation.z = Math.sin(t * 2.3) * 0.04;
    cable.scale.y = depth;
    if (c >= 0.88 && lastCycle !== cycle && ctx.fx) {
      lastCycle = cycle;
      hook.getWorldPosition(_w);
      ctx.fx.puff(_w.setY(_w.y - 1.2), { color: '#e9ecef', size: 0.6, life: 0.7, up: 0.5, spread: 1, radial: 2, count: 5 });
    }

    // welding sparks on the top floor
    sparkT -= dt;
    if (ctx.fx && sparkT <= 0 && built > 0) {
      sparkT = 0.25 + Math.random() * 0.4;
      ctx.fx.sparkle(ctx.toWorld(_v.set(-3.6 + Math.random() * 7.2, top, 2.1)), Math.random() < 0.5 ? '#fff3b0' : '#ffd43b', 5);
    }
  };
  update(0, 0, 0, {});
  return { group: root, update, crewSpots: [[-3.0, 0, 4.0, Math.PI, 'hammer'], [3.4, 0, 6.2, -Math.PI / 2, 'inspect'], [1.6, 'scaffold', 3.0, Math.PI, 'hammer'], [-2.6, 0, 2.6, Math.PI, 'push']] };
}
