import * as THREE from 'three';

// Cartoon "diorama" building kit. Every helper draws into a MeshBuilder `b`.
// Wall-mounted parts are placed with their back against a wall facing +Z at (x, y, z)
// where y is the bottom of the part. Use `ry` to put them on other faces.

export function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

export const PAL = {
  white: '#fbf7ef',
  plaster: '#eee6d8',
  wood: '#e3934f',
  woodD: '#b86b31',
  woodL: '#f2b679',
  blue: '#4b8fd8',
  blueD: '#376fb0',
  teal: '#3bb3a8',
  red: '#e0573f',
  roof: '#8a94a3',
  roofD: '#6b7584',
  tile: '#d86a4a',
  tileD: '#b4513a',
  metal: '#9aa4b1',
  metalD: '#5f6875',
  dark: '#2e3440',
  green: '#5fb35a',
  greenD: '#3f8f45',
  glass: '#bfe3ff',
  lit: '#ffd98f',
};

const rot = (o) => ({ x: o.x || 0, y: o.y || 0, z: o.z || 0, ry: o.ry || 0 });

/** Wall with plank grooves on its front and side faces. dir: 'v' (vertical) | 'h' (horizontal). */
export function plankBox(b, w, h, d, color, o = {}) {
  const groove = shade(color, 0.8);
  const step = o.step || 0.45;
  b.group(rot(o), () => {
    b.box(w, h, d, color, { r: o.r ?? 0.14, mat: o.mat });
    if ((o.dir || 'v') === 'v') {
      for (let x = -w / 2 + step; x < w / 2 - 0.1; x += step) {
        b.box(0.05, h - 0.2, 0.04, groove, { x, y: 0.1, z: d / 2, sharp: true });
      }
      for (let z = -d / 2 + step; z < d / 2 - 0.1; z += step) {
        b.box(0.04, h - 0.2, 0.05, groove, { x: w / 2, y: 0.1, z, sharp: true });
        b.box(0.04, h - 0.2, 0.05, groove, { x: -w / 2, y: 0.1, z, sharp: true });
      }
    } else {
      for (let y = step; y < h - 0.1; y += step) {
        b.box(w - 0.2, 0.05, 0.04, groove, { y, z: d / 2, sharp: true });
        b.box(0.04, 0.05, d - 0.2, groove, { x: w / 2, y, sharp: true });
        b.box(0.04, 0.05, d - 0.2, groove, { x: -w / 2, y, sharp: true });
      }
    }
  });
}

/** Window with chunky frame, mullions, sill and optional shutters / flower box. */
export function win(b, o) {
  const { w = 1.1, h = 1.3 } = o;
  const frame = o.frame || PAL.white;
  b.group(rot(o), () => {
    b.box(w, h, 0.06, o.glass || PAL.lit, { mat: o.dark ? 'glass' : 'lit', sharp: true });
    b.box(w + 0.34, 0.17, 0.18, frame, { y: -0.17, r: 0.06 });
    b.box(w + 0.34, 0.17, 0.18, frame, { y: h, r: 0.06 });
    b.box(0.17, h + 0.34, 0.18, frame, { x: -(w / 2 + 0.085), y: -0.17, r: 0.06 });
    b.box(0.17, h + 0.34, 0.18, frame, { x: w / 2 + 0.085, y: -0.17, r: 0.06 });
    if (o.cross !== false) {
      b.box(0.08, h, 0.08, frame, { z: 0.02, sharp: true });
      b.box(w, 0.08, 0.08, frame, { y: h * 0.55, z: 0.02, sharp: true });
    }
    b.box(w + 0.55, 0.14, 0.38, o.sill || PAL.white, { y: -0.3, z: 0.12, r: 0.06 });
    if (o.shutters) {
      for (const sx of [-1, 1]) {
        const x = sx * (w / 2 + 0.16 + w * 0.27);
        b.box(w * 0.52, h + 0.2, 0.09, o.shutters, { x, y: -0.1, z: 0.02, r: 0.05 });
        for (let k = 1; k < 6; k++) b.box(w * 0.42, 0.04, 0.03, shade(o.shutters, 0.78), { x, y: -0.1 + (k * (h + 0.2)) / 6, z: 0.08, sharp: true });
      }
    }
    if (o.box) {
      b.box(w + 0.3, 0.32, 0.42, PAL.woodD, { y: -0.62, z: 0.2, r: 0.07 });
      for (let k = 0; k < 4; k++) {
        b.blob(0.17, k % 2 ? PAL.green : PAL.greenD, { x: -w / 2 + 0.15 + (k * w) / 3.4, y: -0.25, z: 0.22 }, 1);
        b.sphere(0.07, o.box, { x: -w / 2 + 0.3 + (k * w) / 3.4, y: -0.12, z: 0.36 }, 6, 4);
      }
    }
    if (o.ac) ac(b, { x: 0, y: -1.25, z: 0.05, s: 0.8 });
  });
}

/** Porthole window. y = center. */
export function roundWin(b, o) {
  const r = o.r || 0.6;
  const frame = o.frame || PAL.white;
  b.group(rot(o), () => {
    b.torus(r, 0.14, frame, { y: o.y0 || 0, z: 0.08 }, Math.PI * 2, 10, 28);
    b.cyl(r, r, 0.1, o.glass || PAL.lit, { y: o.y0 || 0, z: 0.0, rx: Math.PI / 2, mat: 'lit' }, 24);
    b.box(0.07, r * 2, 0.06, frame, { y: (o.y0 || 0) - r, z: 0.1, sharp: true });
    b.box(r * 2, 0.07, 0.06, frame, { y: (o.y0 || 0) - 0.035, z: 0.1, sharp: true });
  });
}

/** Panelled door with frame, glass, knob and front steps. */
export function door(b, o) {
  const { w = 1.3, h = 2.3 } = o;
  const color = o.color || PAL.wood;
  const frame = o.frame || PAL.white;
  b.group(rot(o), () => {
    b.box(w + 0.36, h + 0.2, 0.16, frame, { x: 0, y: 0, z: -0.02, r: 0.07 });
    b.box(w, h, 0.14, color, { z: 0.05, r: 0.06 });
    b.box(w * 0.7, h * 0.28, 0.06, o.glass ? PAL.lit : shade(color, 1.12), { y: h * 0.62, z: 0.13, mat: o.glass ? 'lit' : undefined, r: 0.03 });
    b.box(w * 0.32, h * 0.38, 0.06, shade(color, 1.12), { x: -w * 0.2, y: h * 0.12, z: 0.13, r: 0.03 });
    b.box(w * 0.32, h * 0.38, 0.06, shade(color, 1.12), { x: w * 0.2, y: h * 0.12, z: 0.13, r: 0.03 });
    b.sphere(0.07, '#f2c14e', { x: w * 0.36, y: h * 0.48, z: 0.17, mat: 'gold' }, 8, 6);
    if (o.steps) stairs(b, { y: -o.steps * 0.18, z: 0.35, w: w + 0.6, steps: o.steps, color: o.stepColor || PAL.woodL });
    if (o.lamp) b.sphere(0.14, PAL.lit, { x: w / 2 + 0.35, y: h * 0.85, z: 0.22, mat: 'lit' }, 10, 8);
  });
}

/** Steps going down toward +Z from y=0 (top) — y given is the ground level. */
export function stairs(b, o) {
  const n = o.steps || 3;
  const w = o.w || 1.6;
  const c = o.color || PAL.woodL;
  b.group(rot(o), () => {
    for (let i = 0; i < n; i++) {
      b.box(w, 0.2 * (n - i), 0.42, i % 2 ? shade(c, 0.94) : c, { z: i * 0.4, r: 0.06 });
    }
  });
}

/** Striped awning with scalloped edge. y = top attachment height. */
export function awning(b, o) {
  const { w = 2.4, depth = 1.1 } = o;
  const colors = o.colors || ['#ffffff', '#4b8fd8'];
  const n = Math.max(3, Math.round(w / 0.34));
  const sw = w / n;
  const tilt = 0.42;
  b.group(rot(o), () => {
    b.group({ y: 0, z: 0, rx: tilt }, () => {
      for (let i = 0; i < n; i++) {
        b.box(sw + 0.005, 0.07, depth, colors[i % colors.length], { x: -w / 2 + (i + 0.5) * sw, z: depth / 2 - 0.05, mat: 'soft', sharp: true });
      }
      for (let i = 0; i < n; i++) {
        b.cyl(sw / 2, sw / 2, 0.07, colors[i % colors.length], { x: -w / 2 + (i + 0.5) * sw, y: 0.035, z: depth - 0.06, rz: 0, rx: Math.PI / 2, mat: 'soft' }, 10);
      }
    });
    b.box(w + 0.1, 0.12, 0.12, shade(colors[1], 0.85), { y: -0.06, z: 0.02, r: 0.05 });
  });
}

/** Balcony: slab + railing with balusters. Anchored on a wall at (x,y,z), sticking out by d. */
export function balcony(b, o) {
  const { w = 2.4, d = 1.1 } = o;
  const c = o.color || PAL.woodL;
  const rail = o.rail || c;
  b.group(rot(o), () => {
    b.box(w, 0.18, d, c, { z: d / 2, r: 0.06 });
    for (let k = 0; k < 2; k++) b.box(0.16, 0.4, 0.5, shade(c, 0.8), { x: (k ? 1 : -1) * (w / 2 - 0.3), y: -0.4, z: 0.25, r: 0.05 });
    const hh = 0.85;
    b.box(w, 0.1, 0.12, rail, { y: hh, z: d - 0.05, r: 0.04 });
    b.box(0.12, 0.1, d, rail, { x: -w / 2 + 0.06, y: hh, z: d / 2, r: 0.04 });
    b.box(0.12, 0.1, d, rail, { x: w / 2 - 0.06, y: hh, z: d / 2, r: 0.04 });
    for (let x = -w / 2 + 0.08; x <= w / 2 - 0.07; x += 0.26) b.box(0.07, hh, 0.07, rail, { x, y: 0.15, z: d - 0.06, sharp: true });
    for (let z = 0.2; z < d - 0.1; z += 0.26) {
      b.box(0.07, hh, 0.07, rail, { x: -w / 2 + 0.06, y: 0.15, z, sharp: true });
      b.box(0.07, hh, 0.07, rail, { x: w / 2 - 0.06, y: 0.15, z, sharp: true });
    }
    if (o.plants) {
      b.cyl(0.2, 0.16, 0.35, PAL.tile, { x: -w / 2 + 0.4, y: 0.18, z: d - 0.4 }, 10);
      b.blob(0.3, PAL.green, { x: -w / 2 + 0.4, y: 0.7, z: d - 0.4 }, 1);
    }
  });
}

/** Rooftop pergola. y = roof top. */
export function pergola(b, o) {
  const { w = 3, d = 2.4, h = 1.9 } = o;
  const c = o.color || PAL.metalD;
  b.group(rot(o), () => {
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) b.box(0.16, h, 0.16, c, { x, z, r: 0.05 });
    b.box(w + 0.3, 0.16, 0.18, c, { y: h, z: -d / 2, r: 0.05 });
    b.box(w + 0.3, 0.16, 0.18, c, { y: h, z: d / 2, r: 0.05 });
    for (let x = -w / 2; x <= w / 2 + 0.01; x += 0.4) b.box(0.1, 0.1, d + 0.5, o.slats || '#d8dde3', { x, y: h + 0.15, r: 0.03 });
  });
}

export function ac(b, o) {
  const s = o.s || 1;
  b.group({ ...rot(o), s }, () => {
    b.box(1.2, 0.8, 0.5, '#f1f3f5', { r: 0.08 });
    b.cyl(0.28, 0.28, 0.05, '#5f6875', { x: 0.22, y: 0.4, z: 0.25, rx: Math.PI / 2 }, 16);
    b.cyl(0.08, 0.08, 0.07, '#adb5bd', { x: 0.22, y: 0.4, z: 0.27, rx: Math.PI / 2 }, 8);
    for (let k = 0; k < 4; k++) b.box(0.3, 0.04, 0.04, '#ced4da', { x: -0.33, y: 0.18 + k * 0.14, z: 0.25, sharp: true });
    b.box(0.08, 0.08, 0.5, '#adb5bd', { x: -0.45, y: -0.12, z: 0.0, sharp: true });
    b.box(0.08, 0.08, 0.5, '#adb5bd', { x: 0.45, y: -0.12, z: 0.0, sharp: true });
  });
}

/** Drain/exhaust pipe running up a wall then bending over the roof. */
export function pipe(b, o) {
  const r = o.r || 0.13;
  const c = o.color || PAL.metal;
  b.group(rot(o), () => {
    b.cyl(r, r, o.h, c, { z: 0.2, mat: 'metal' }, 12);
    for (let y = 0.6; y < o.h - 0.3; y += 1.3) b.box(0.4, 0.08, 0.22, PAL.metalD, { y, z: 0.1, sharp: true });
    b.cyl(r * 1.25, r * 1.25, 0.25, shade(c, 0.9), { y: o.h - 0.25, z: 0.2, mat: 'metal' }, 12);
    if (o.cap) b.cyl(r * 1.8, r * 1.4, 0.2, PAL.metalD, { y: o.h, z: 0.2, mat: 'metal' }, 12);
  });
}

export function barrel(b, o) {
  const r = o.r || 0.42, h = o.h || 1.0;
  const c = o.color || '#b8743c';
  b.group(rot(o), () => {
    b.cyl(r * 0.92, r * 0.92, h * 0.18, c, {}, 16);
    b.cyl(r, r, h * 0.64, c, { y: h * 0.18 }, 16);
    b.cyl(r * 0.92, r * 0.92, h * 0.18, c, { y: h * 0.82 }, 16);
    for (const y of [0.16, 0.5, 0.84]) b.torus(r * (y === 0.5 ? 1.0 : 0.93), 0.035, '#5f6875', { y: h * y, rx: Math.PI / 2, mat: 'metal' }, Math.PI * 2, 6, 20);
    b.cyl(r * 0.85, r * 0.85, 0.02, shade(c, 0.8), { y: h }, 16);
  });
}

export function crate(b, o) {
  const s = o.s || 1;
  const c = o.color || PAL.woodL;
  b.group({ ...rot(o), s }, () => {
    b.box(1, 0.75, 0.8, c, { r: 0.06 });
    for (const y of [0.04, 0.62]) b.box(1.03, 0.1, 0.83, shade(c, 0.82), { y, r: 0.03 });
    b.box(0.08, 0.6, 0.04, shade(c, 0.82), { x: -0.25, y: 0.1, z: 0.41, rz: 0.75, sharp: true });
    if (o.fill) for (let i = 0; i < 6; i++) b.sphere(0.19, o.fill, { x: -0.3 + (i % 3) * 0.3, y: 0.82, z: i < 3 ? -0.16 : 0.16 }, 8, 6);
  });
}

export function bin(b, o) {
  const c = o.color || '#e8613f';
  b.group(rot(o), () => {
    b.box(0.85, 1.05, 0.85, c, { y: 0.12, r: 0.12 });
    b.box(0.95, 0.14, 0.95, shade(c, 0.85), { y: 1.15, r: 0.06 });
    b.box(0.4, 0.08, 0.12, shade(c, 0.7), { y: 1.28, r: 0.03 });
    b.cyl(0.13, 0.13, 0.08, '#2e3440', { x: -0.32, y: 0.13, z: -0.38, rz: Math.PI / 2 }, 10);
    b.cyl(0.13, 0.13, 0.08, '#2e3440', { x: 0.32, y: 0.13, z: -0.38, rz: Math.PI / 2 }, 10);
  });
}

/** Roll-up metal shutter (garage / storage door). */
export function rollDoor(b, o) {
  const { w = 2.4, h = 2.6 } = o;
  const c = o.color || PAL.blue;
  b.group(rot(o), () => {
    b.box(w + 0.3, h + 0.35, 0.18, PAL.white, { z: -0.04, r: 0.07 });
    b.box(w + 0.2, 0.42, 0.34, shade(c, 0.85), { y: h - 0.05, z: 0.05, r: 0.1 });
    for (let y = 0; y < h - 0.2; y += 0.26) b.box(w, 0.22, 0.1, y % 0.52 < 0.26 ? c : shade(c, 0.93), { y, z: 0.06, r: 0.04 });
    b.box(0.4, 0.08, 0.1, PAL.metalD, { y: 0.25, z: 0.14, sharp: true });
  });
}

/** Gable roof with rows of round tiles. Ridge along X. y = eaves height. */
export function tileRoof(b, o) {
  const { w = 8, d = 6, h = 2.4 } = o;
  const c = o.color || PAL.tile;
  const half = d / 2 + 0.4;
  const len = Math.hypot(half, h);
  const ang = Math.atan2(h, half);
  b.group(rot(o), () => {
    b.prism(w - 0.1, h - 0.1, d - 0.1, o.gable || PAL.white, {});
    for (const side of [1, -1]) {
      b.group({ z: side * half / 2, y: h / 2, rx: side * ang }, () => {
        b.box(w + 0.5, 0.16, len + 0.15, shade(c, 0.85), { y: -0.08, z: 0, r: 0.06 });
        const rows = Math.max(3, Math.round(len / 0.42));
        for (let k = 0; k < rows; k++) {
          const z = -len / 2 + (k + 0.5) * (len / rows);
          b.cyl(0.17, 0.17, w + 0.5, k % 2 ? c : shade(c, 0.93), { x: -(w + 0.5) / 2, y: 0.08, z, rz: -Math.PI / 2 }, 10);
        }
      });
    }
    b.cyl(0.22, 0.22, w + 0.7, shade(c, 0.8), { x: -(w + 0.7) / 2, y: h - 0.05, rz: -Math.PI / 2 }, 12);
  });
}

/** Flat roof with soft parapet. y = top of walls. */
export function flatRoof(b, o) {
  const { w, d } = o;
  const c = o.color || PAL.roof;
  b.group(rot(o), () => {
    b.box(w + 0.35, 0.3, d + 0.35, o.edge || PAL.white, { r: 0.12 });
    b.box(w - 0.2, 0.12, d - 0.2, c, { y: 0.22, r: 0.05 });
  });
}

/** Corrugated metal roof (half-pipes) sloping toward +Z. y = top at the back. */
export function tinRoof(b, o) {
  const { w = 4, d = 3 } = o;
  const c = o.color || PAL.roof;
  b.group({ ...rot(o), rx: 0.18 }, () => {
    b.box(w + 0.3, 0.1, d + 0.3, shade(c, 0.8), { z: d / 2, r: 0.04 });
    for (let x = -w / 2; x <= w / 2 + 0.01; x += 0.26) b.cyl(0.11, 0.11, d + 0.3, c, { x, y: 0.1, z: 0, rx: Math.PI / 2, mat: 'metal' }, 8);
  });
}

export function chimney(b, o) {
  const { w = 0.9, h = 2.4 } = o;
  const c = o.color || '#c56b4f';
  b.group(rot(o), () => {
    b.box(w, h, w, c, { r: 0.1 });
    for (let y = 0.4; y < h - 0.3; y += 0.45) b.box(w + 0.02, 0.05, w + 0.02, shade(c, 0.85), { y, sharp: true });
    b.box(w + 0.3, 0.25, w + 0.3, '#5c4033', { y: h, r: 0.08 });
    b.box(w * 0.55, 0.06, w * 0.55, '#1f2328', { y: h + 0.24, sharp: true });
  });
}

/** Curved street lamp (y = ground). Faces +Z. */
export function lamp(b, o) {
  b.group(rot(o), () => {
    b.cyl(0.18, 0.24, 0.3, PAL.dark, {}, 12);
    b.cyl(0.07, 0.09, 3.6, PAL.dark, { y: 0.3, mat: 'metal' }, 10);
    b.torus(0.45, 0.07, PAL.dark, { y: 3.9, z: 0.45, ry: Math.PI / 2, mat: 'metal' }, Math.PI / 2, 8, 12);
    b.box(0.6, 0.18, 0.45, PAL.dark, { y: 4.15, z: 0.95, r: 0.06 });
    b.box(0.46, 0.08, 0.32, PAL.lit, { y: 4.08, z: 0.95, mat: 'lit', sharp: true });
  });
}

export function bush(b, o) {
  b.group(rot(o), () => {
    b.blob(0.6 * (o.s || 1), o.color || PAL.green, { y: 0.45 * (o.s || 1) }, 1);
    b.blob(0.42 * (o.s || 1), shade(o.color || PAL.green, 1.12), { x: 0.45 * (o.s || 1), y: 0.36 * (o.s || 1), z: 0.15 }, 1);
  });
}

export function pot(b, o) {
  b.group(rot(o), () => {
    b.cyl(0.32, 0.24, 0.5, o.color || PAL.tile, {}, 12);
    b.torus(0.3, 0.05, shade(o.color || PAL.tile, 0.85), { y: 0.5, rx: Math.PI / 2 }, Math.PI * 2, 6, 16);
    b.blob(0.42, PAL.green, { y: 0.85 }, 1);
    if (o.flower) for (let k = 0; k < 3; k++) b.sphere(0.09, o.flower, { x: Math.cos(k * 2.1) * 0.28, y: 1.05, z: Math.sin(k * 2.1) * 0.28 + 0.1 }, 6, 4);
  });
}

export function bench(b, o) {
  b.group(rot(o), () => {
    for (const x of [-0.7, 0.7]) b.box(0.12, 0.45, 0.5, PAL.dark, { x, r: 0.04 });
    for (let k = 0; k < 3; k++) b.box(1.8, 0.08, 0.16, PAL.woodL, { y: 0.45, z: -0.18 + k * 0.18, r: 0.03 });
    for (let k = 0; k < 2; k++) b.box(1.8, 0.14, 0.06, PAL.woodL, { y: 0.65 + k * 0.2, z: -0.3, r: 0.03 });
  });
}

/** A-frame chalkboard sign. */
export function chalkboard(b, o) {
  b.group(rot(o), () => {
    b.box(0.8, 1.1, 0.08, PAL.woodD, { z: 0.15, rx: -0.2, r: 0.03 });
    b.box(0.64, 0.86, 0.04, '#2f3b35', { y: 0.13, z: 0.2, rx: -0.2, sharp: true });
    b.box(0.8, 1.1, 0.08, PAL.woodD, { z: -0.15, rx: 0.2, r: 0.03 });
    b.box(0.4, 0.04, 0.03, '#f8f9fa', { y: 0.75, z: 0.28, rx: -0.2, sharp: true });
    b.box(0.3, 0.04, 0.03, '#f8f9fa', { y: 0.55, z: 0.25, rx: -0.2, sharp: true });
  });
}

/** Little round table with two chairs. */
export function cafeTable(b, o) {
  b.group(rot(o), () => {
    b.cyl(0.55, 0.55, 0.08, PAL.white, { y: 0.95 }, 16);
    b.cyl(0.05, 0.05, 0.95, PAL.dark, { mat: 'metal' }, 6);
    b.cyl(0.3, 0.3, 0.05, PAL.dark, {}, 10);
    for (const x of [-0.85, 0.85]) {
      b.box(0.5, 0.08, 0.5, o.chair || PAL.teal, { x, y: 0.55, r: 0.04 });
      b.box(0.08, 0.55, 0.08, PAL.dark, { x, sharp: true });
      b.box(0.08, 0.6, 0.5, o.chair || PAL.teal, { x: x + Math.sign(x) * 0.22, y: 0.6, r: 0.03 });
    }
  });
}

/** String of light bulbs between two points (lit at night). */
export function stringLights(b, a, c, n = 8, sag = 0.5) {
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = a[0] + (c[0] - a[0]) * t;
    const y = a[1] + (c[1] - a[1]) * t - Math.sin(t * Math.PI) * sag;
    const z = a[2] + (c[2] - a[2]) * t;
    b.sphere(0.08, ['#ffd98f', '#ff9ec7', '#9be7ff', '#c3f584'][i % 4], { x, y, z, mat: 'lit' }, 6, 4);
  }
}
