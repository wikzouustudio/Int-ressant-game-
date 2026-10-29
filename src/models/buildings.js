import * as THREE from 'three';
import { MeshBuilder, rng } from './builder.js';

const WOOD = '#9c6b3f';
const WOOD_D = '#6f4627';
const WHITE = '#f3f1ea';
const DARK = '#2b2f36';

// ---------------------------------------------------------------------------
// Reusable props
// ---------------------------------------------------------------------------
function car(b, o, color = '#e63946') {
  b.group(o, () => {
    b.rbox(3.6, 0.85, 1.75, 0.3, color, { y: 0.35, mat: 'soft' });
    b.rbox(2.0, 0.75, 1.55, 0.3, '#9fd3ff', { x: -0.2, y: 1.05, mat: 'glass' });
    b.rbox(1.9, 0.1, 1.6, 0.04, color, { x: -0.2, y: 1.75, mat: 'soft' });
    for (const [x, z] of [[1.15, 0.85], [-1.15, 0.85], [1.15, -0.85], [-1.15, -0.85]]) {
      b.cyl(0.42, 0.42, 0.3, '#1a1a1a', { x, y: 0.42, z: z - Math.sign(z) * 0.15, rx: Math.PI / 2 }, 14);
      b.cyl(0.2, 0.2, 0.32, '#c0c0c0', { x, y: 0.42, z: z - Math.sign(z) * 0.16, rx: Math.PI / 2, mat: 'metal' }, 10);
    }
    b.box(0.06, 0.2, 0.4, '#fff7cc', { x: 1.8, y: 0.75, z: 0.5, mat: 'lit' });
    b.box(0.06, 0.2, 0.4, '#fff7cc', { x: 1.8, y: 0.75, z: -0.5, mat: 'lit' });
    b.box(0.06, 0.18, 0.35, '#ff3030', { x: -1.8, y: 0.75, z: 0.55, mat: 'lit' });
    b.box(0.06, 0.18, 0.35, '#ff3030', { x: -1.8, y: 0.75, z: -0.55, mat: 'lit' });
  });
}

function crate(b, o, fill) {
  b.group(o, () => {
    b.box(1, 0.7, 0.8, WOOD, {});
    b.box(1.04, 0.1, 0.84, WOOD_D, { y: 0.6 });
    b.box(1.04, 0.1, 0.84, WOOD_D, { y: 0.05 });
    if (fill) {
      for (let i = 0; i < 6; i++) {
        b.sphere(0.2, fill, { x: -0.3 + (i % 3) * 0.3, y: 0.75, z: i < 3 ? -0.17 : 0.17 }, 8, 6);
      }
    }
  });
}

function planter(b, o, flower = '#ff6b9a') {
  b.group(o, () => {
    b.box(1.6, 0.6, 0.7, '#b9ad98', {});
    b.box(1.45, 0.1, 0.55, '#5b3a1e', { y: 0.55 });
    b.ico(0.45, '#3f8f3a', { x: -0.4, y: 0.85 });
    b.ico(0.5, '#4ca346', { x: 0.35, y: 0.9 });
    b.sphere(0.12, flower, { x: -0.2, y: 1.2, z: 0.15 }, 6, 4);
    b.sphere(0.12, flower, { x: 0.55, y: 1.25, z: 0.1 }, 6, 4);
    b.sphere(0.12, '#ffe066', { x: 0.1, y: 1.3, z: -0.1 }, 6, 4);
  });
}

function bush(b, o, color = '#4c9a43') {
  b.group(o, () => {
    b.ico(0.7, color, { y: 0.55 });
    b.ico(0.5, color, { x: 0.5, y: 0.45, z: 0.2 });
  });
}

function striped(b, count, width, depth, colors, o) {
  b.group(o, () => {
    for (let i = 0; i < count; i++) {
      b.box(width / count + 0.005, 0.12, depth, colors[i % colors.length], {
        x: -width / 2 + (i + 0.5) * (width / count), mat: 'soft',
      });
    }
  });
}

function windowLit(b, w, h, o, frame = WHITE, light = '#ffd890') {
  b.group(o, () => {
    b.box(w + 0.24, h + 0.24, 0.12, frame, { y: -0.12 });
    b.box(w, h, 0.16, light, { mat: 'lit' });
    b.box(0.06, h, 0.2, frame, {});
    b.box(w, 0.06, 0.2, frame, { y: h / 2 - 0.03 });
  });
}

// ---------------------------------------------------------------------------
// Businesses — each faces +Z, footprint ~x[-5.6,5.6] z[-5.8,4.8], y=0 = pad top.
// Return { group, emitters, animated }.
// ---------------------------------------------------------------------------
const MODELS = {
  lemonade(b, level, ctx) {
    b.box(10, 0.3, 7, '#c8955c', { z: -0.8 });
    for (let i = 0; i < 10; i++) b.box(0.04, 0.31, 7, '#a77a48', { x: -4.5 + i, z: -0.8 });
    // kiosk body
    b.box(5.4, 3.4, 3, '#fff1b8', { y: 0.3, z: -1.7 });
    b.box(5.6, 0.25, 3.2, '#e3c55a', { y: 3.7, z: -1.7 });
    // counter with stripes
    b.box(5.4, 1.6, 1.6, WHITE, { y: 0.3, z: 0.6 });
    for (let i = 0; i < 6; i++) b.box(0.45, 1.6, 0.05, '#ffcc00', { x: -2.25 + i * 0.9, y: 0.3, z: 1.42 });
    b.box(5.8, 0.15, 2.0, '#8b5a2b', { y: 1.9, z: 0.6 });
    for (const x of [-2.6, 2.6]) b.cyl(0.09, 0.09, 2.6, WHITE, { x, y: 2.05, z: 1.4 }, 8);
    striped(b, 8, 6.4, 2.8, ['#ffffff', '#ffcc00'], { y: 4.55, z: 0.5, rx: 0.32 });
    b.box(6.4, 0.35, 0.08, '#ffcc00', { y: 4.1, z: 1.88 });
    // giant lemon
    b.sphere(1.0, '#ffe135', { y: 5.4, z: -1.6, sx: 1.3 }, 18, 14);
    b.sphere(0.28, '#ffe135', { x: 1.3, y: 5.4, z: -1.6, sx: 0.9 }, 10, 8);
    b.sphere(0.35, '#4caf50', { x: -0.4, y: 6.35, z: -1.6, sx: 1.6, sy: 0.4, rz: 0.4 }, 10, 6);
    // juice jars
    for (let i = 0; i < 3; i++) {
      b.cyl(0.25, 0.25, 0.7, '#fff59d', { x: -1.5 + i * 1.5, y: 2.05, z: 0.5, mat: 'glass' }, 12);
      b.cyl(0.2, 0.2, 0.45, '#ffeb3b', { x: -1.5 + i * 1.5, y: 2.07, z: 0.5, mat: 'neon' }, 10);
    }
    // crates
    crate(b, { x: 3.9, y: 0.3, z: 1.4 }, '#ffe135');
    crate(b, { x: 3.9, y: 0.3, z: 0.2, ry: 0.2 }, '#ffe135');
    crate(b, { x: 3.9, y: 1.0, z: 0.8, ry: -0.1 }, '#9ccc65');
    // parasol + table
    const parasol = (x, z, col) => {
      b.cyl(0.6, 0.6, 0.08, WHITE, { x, y: 1.25, z }, 14);
      b.cyl(0.07, 0.07, 1.0, '#888', { x, y: 0.3, z, mat: 'metal' }, 6);
      b.cyl(0.05, 0.05, 2.8, '#ddd', { x, y: 0.3, z, mat: 'metal' }, 6);
      b.cone(1.6, 0.7, col, { x, y: 3.0, z, mat: 'soft' }, 10);
      for (const a of [0, 2.1, 4.2]) b.box(0.35, 0.7, 0.35, '#e0c9a6', { x: x + Math.cos(a) * 1.0, y: 0.3, z: z + Math.sin(a) * 1.0 });
    };
    parasol(-3.8, 1.2, '#ff6b6b');
    if (level >= 3) parasol(-3.8, -2.6, '#4dabf7');
    if (level >= 5) {
      b.cyl(0.18, 0.25, 1.6, WOOD_D, { x: 3.9, y: 0.3, z: -3.0 }, 8);
      b.ico(1.1, '#3f9d3a', { x: 3.9, y: 2.4, z: -3.0 }, 1);
      for (let i = 0; i < 5; i++) b.sphere(0.16, '#ffe135', { x: 3.9 + Math.cos(i) * 0.9, y: 2.3 + Math.sin(i * 3) * 0.4, z: -3 + Math.sin(i) * 0.9 }, 6, 4);
    }
    if (level >= 7) b.torus(1.6, 0.08, '#fff176', { y: 5.4, z: -1.6, mat: 'neon' }, Math.PI * 2, 6, 32);
    ctx.workStyle = 1;
  },

  bakery(b, level, ctx) {
    const floors = level >= 6 ? 3 : 2;
    const H = floors * 2.6;
    b.box(9.2, 0.6, 7.2, '#8c5a3c', { z: -1.8 });
    b.box(9, H, 7, '#f2d6b3', { y: 0.6, z: -1.8 });
    b.box(9.1, 2.6, 7.1, '#b5543c', { y: 0.6, z: -1.8 });
    for (let f = 1; f < floors; f++) b.box(9.2, 0.18, 7.2, WHITE, { y: 0.6 + f * 2.6, z: -1.8 });
    // shop front
    windowLit(b, 2.6, 1.6, { x: -2.6, y: 1.2, z: 1.66 }, '#5b3a29', '#ffc57a');
    windowLit(b, 2.6, 1.6, { x: 2.6, y: 1.2, z: 1.66 }, '#5b3a29', '#ffc57a');
    b.box(1.5, 2.3, 0.14, '#6b3e26', { y: 0.6, z: 1.68 });
    b.box(1.1, 0.9, 0.16, '#ffd59a', { y: 1.8, z: 1.7, mat: 'lit' });
    for (let i = 0; i < 4; i++) b.sphere(0.18, '#d9893b', { x: -3.3 + i * 0.45, y: 1.45, z: 1.5, sx: 1.4 }, 8, 6);
    for (let i = 0; i < 4; i++) b.sphere(0.18, '#e9b26a', { x: 1.9 + i * 0.45, y: 1.45, z: 1.5, sx: 1.4 }, 8, 6);
    striped(b, 10, 9.4, 1.8, ['#c0392b', '#fdf6ec'], { y: 3.15, z: 2.2, rx: 0.4 });
    // upper windows with shutters
    for (let f = 1; f < floors; f++) {
      for (const x of [-3, 0, 3]) {
        windowLit(b, 1.1, 1.3, { x, y: 1.3 + f * 2.6, z: 1.66 });
        b.box(0.4, 1.4, 0.08, '#2f7d5b', { x: x - 0.85, y: 1.25 + f * 2.6, z: 1.72 });
        b.box(0.4, 1.4, 0.08, '#2f7d5b', { x: x + 0.85, y: 1.25 + f * 2.6, z: 1.72 });
        if (level >= 4) {
          b.box(1.3, 0.3, 0.4, '#8c5a3c', { x, y: 0.95 + f * 2.6, z: 1.85 });
          b.sphere(0.13, '#ff6b9a', { x: x - 0.35, y: 1.3 + f * 2.6, z: 1.9 }, 6, 4);
          b.sphere(0.13, '#ffe066', { x: x + 0.3, y: 1.3 + f * 2.6, z: 1.9 }, 6, 4);
        }
      }
    }
    // roof
    b.prism(9.8, 2.8, 7.8, '#a8443a', { y: 0.6 + H, z: -1.8 });
    b.box(9.9, 0.2, 7.9, '#7c2f28', { y: 0.5 + H, z: -1.8 });
    b.box(0.9, 2.6, 0.9, '#8c4a3a', { x: 2.8, y: 0.6 + H, z: -3.4 });
    b.box(1.1, 0.25, 1.1, '#5d3027', { x: 2.8, y: 3.2 + H, z: -3.4 });
    ctx.emitters.push(new THREE.Vector3(2.8, 3.6 + H, -3.4));
    if (level >= 6) windowLit(b, 1.0, 1.0, { x: -2, y: 1.6 + H, z: 0.6 });
    // croissant sign
    b.cyl(1.0, 1.0, 0.15, '#5b3a29', { y: 4.0, z: 2.6, rx: Math.PI / 2 }, 20);
    b.torus(0.48, 0.2, '#e8a54b', { y: 4.0, z: 2.75 }, Math.PI * 1.1, 8, 14);
    // terrace
    if (level >= 2) {
      for (const x of [-4.4, 4.4]) {
        b.cyl(0.55, 0.55, 0.06, WHITE, { x, y: 1.0, z: 3.4 }, 12);
        b.cyl(0.05, 0.05, 0.75, '#333', { x, y: 0.25, z: 3.4, mat: 'metal' }, 6);
        b.box(0.45, 0.6, 0.45, '#2f7d5b', { x: x - 0.8, y: 0, z: 3.4 });
      }
    }
    ctx.workStyle = 0;
  },

  garage(b, level, ctx) {
    b.box(11.2, 4.4, 7.8, '#d9dde3', { z: -2 });
    b.box(11.5, 0.3, 8.1, '#3d424a', { y: 4.4, z: -2 });
    b.box(11.25, 0.55, 7.85, '#e63946', { y: 3.3, z: -2 });
    // bay 1: open with car, bay 2: closed door
    b.box(4, 3.0, 0.2, '#1d2026', { x: -2.6, y: 0, z: 1.85 });
    car(b, { x: -2.6, y: 0, z: 1.0, ry: Math.PI / 2 + 0.05, s: 0.95 }, '#ffd43b');
    b.box(3.8, 3.0, 0.14, '#9aa3ad', { x: 2.6, y: 0, z: 1.92, mat: 'metal' });
    for (let i = 0; i < 7; i++) b.box(3.8, 0.05, 0.18, '#6c757d', { x: 2.6, y: 0.3 + i * 0.4, z: 1.92 });
    for (const x of [-4.7, -0.5, 0.5, 4.7]) b.box(0.3, 3.3, 0.3, '#3d424a', { x, z: 1.95 });
    b.box(11.2, 0.3, 0.3, '#3d424a', { y: 3.0, z: 1.95 });
    // roof sign
    b.box(6.5, 1.5, 0.3, '#1d3557', { y: 4.9, z: 0.9 });
    b.box(5.8, 0.14, 0.1, '#ff4d4d', { y: 5.35, z: 1.1, mat: 'neon' });
    b.box(5.8, 0.14, 0.1, '#ff4d4d', { y: 5.85, z: 1.1, mat: 'neon' });
    b.cyl(0.35, 0.35, 0.1, '#ffffff', { y: 5.6, z: 1.1, rx: Math.PI / 2, mat: 'neon' }, 14);
    for (const x of [-2.5, 2.5]) b.box(0.2, 0.6, 0.2, '#3d424a', { x, y: 4.5, z: 0.9 });
    // tyres & barrels
    for (let i = 0; i < 3; i++) b.torus(0.5, 0.22, '#1b1b1b', { x: 5.0, y: 0.22 + i * 0.42, z: 3.6, rx: Math.PI / 2 }, Math.PI * 2, 8, 16);
    b.cyl(0.45, 0.45, 1.2, '#1d3557', { x: -5.0, z: 3.4, mat: 'soft' }, 12);
    b.cyl(0.45, 0.45, 1.2, '#e63946', { x: -4.0, z: 3.7, mat: 'soft' }, 12);
    b.box(1.3, 0.9, 0.6, '#c92a2a', { x: 3.5, z: 3.6 });
    if (level >= 3) car(b, { x: 4.3, y: 0, z: -5.0, ry: 0, s: 0.9 }, '#4dabf7');
    if (level >= 5) {
      b.box(0.9, 2.2, 0.7, '#e63946', { x: -5.2, z: 1.0 + 1.0 });
      b.box(0.6, 0.6, 0.06, '#c3fae8', { x: -5.2, y: 1.3, z: 2.37, mat: 'neon' });
    }
    if (level >= 7) {
      b.cyl(0.1, 0.1, 2.2, '#adb5bd', { x: 4, y: 4.4, z: -4, mat: 'metal' }, 8);
      b.sphere(0.9, '#e9ecef', { x: 4, y: 6.6, z: -4, rx: -0.9, mat: 'metal' }, 16, 8, Math.PI * 0.35);
    }
    ctx.workStyle = 0;
  },

  office(b, level, ctx) {
    const floors = 3 + level;
    const fh = 1.7;
    const r = rng(level * 77 + 3);
    b.box(9, 0.4, 9, '#cfd4da', { z: -1.3 });
    // lobby
    b.box(8, fh * 1.3, 8, '#7fb3e6', { y: 0.4, z: -1.3, mat: 'glass' });
    b.box(4, 0.25, 2.4, '#e9ecef', { y: 2.7, z: 3.4 });
    for (const x of [-1.8, 1.8]) b.cyl(0.1, 0.1, 2.3, '#adb5bd', { x, y: 0.4, z: 4.4, mat: 'metal' }, 8);
    b.box(2.2, 2.0, 0.1, '#bde0fe', { y: 0.4, z: 2.75, mat: 'lit' });
    let y = 0.4 + fh * 1.3;
    for (let f = 0; f < floors; f++) {
      const inset = f > floors - 3 ? 0.4 : 0;
      b.box(8.4 - inset, 0.22, 8.4 - inset, '#eef1f4', { y, z: -1.3 });
      b.box(8 - inset, fh - 0.22, 8 - inset, '#5b8fc7', { y: y + 0.22, z: -1.3, mat: 'glass' });
      // lit window strips on the 3 visible faces
      const half = (8 - inset) / 2;
      for (let k = 0; k < 5; k++) {
        const on = r() > 0.35;
        const col = on ? (r() > 0.5 ? '#fff1c1' : '#d0ecff') : '#33506e';
        const off = -half + 0.8 + k * ((2 * half - 1.6) / 4);
        b.box(1.1, fh - 0.7, 0.04, col, { x: off, y: y + 0.45, z: -1.3 + half + 0.02, mat: on ? 'lit' : 'glass' });
        b.box(0.04, fh - 0.7, 1.1, col, { x: half + 0.02, y: y + 0.45, z: -1.3 + off, mat: on ? 'lit' : 'glass' });
        b.box(0.04, fh - 0.7, 1.1, col, { x: -half - 0.02, y: y + 0.45, z: -1.3 + off, mat: on ? 'lit' : 'glass' });
      }
      y += fh;
    }
    // corner pillars
    for (const [x, z] of [[-4.1, 2.8], [4.1, 2.8], [-4.1, -5.4], [4.1, -5.4]]) {
      b.box(0.3, y - 0.4, 0.3, '#e9ecef', { x, y: 0.4, z });
    }
    b.box(8.6, 0.4, 8.6, '#dee2e6', { y, z: -1.3 });
    y += 0.4;
    // roof equipment
    b.box(1.6, 0.9, 1.2, '#adb5bd', { x: -2.4, y, z: -3, mat: 'metal' });
    b.box(1.2, 0.7, 1.2, '#ced4da', { x: -2.4, y, z: -0.8, mat: 'metal' });
    if (level >= 4) {
      b.cyl(2.2, 2.2, 0.15, '#495057', { x: 1.6, y, z: -1.3 }, 24);
      b.torus(1.9, 0.06, '#ffd43b', { x: 1.6, y: y + 0.17, z: -1.3, rx: Math.PI / 2 }, Math.PI * 2, 4, 32);
      b.box(0.25, 0.04, 1.3, '#ffffff', { x: 1.25, y: y + 0.15, z: -1.3 });
      b.box(0.25, 0.04, 1.3, '#ffffff', { x: 1.95, y: y + 0.15, z: -1.3 });
      b.box(0.5, 0.04, 0.25, '#ffffff', { x: 1.6, y: y + 0.15, z: -1.3 });
    }
    b.cyl(0.06, 0.1, 3.5, '#adb5bd', { x: -3.4, y, z: -4.6, mat: 'metal' }, 6);
    b.sphere(0.15, '#ff2d2d', { x: -3.4, y: y + 3.55, z: -4.6, mat: 'neon' }, 8, 6);
    // logo
    b.box(3, 1.2, 0.2, '#ffffff', { y: y - 1.9, z: 2.95 + 0.0, mat: 'soft' });
    b.octa(0.45, '#4cc9f0', { x: -0.9, y: y - 1.3, z: 3.1, mat: 'neon' });
    b.box(1.4, 0.2, 0.1, '#4361ee', { x: 0.35, y: y - 1.15, z: 3.08, mat: 'neon' });
    b.box(1.0, 0.2, 0.1, '#4361ee', { x: 0.15, y: y - 1.55, z: 3.08, mat: 'neon' });
    planter(b, { x: -3.5, y: 0.4, z: 4.0 });
    planter(b, { x: 3.5, y: 0.4, z: 4.0 }, '#9775fa');
    ctx.workStyle = 1;
    ctx.height = y + 3.5;
  },

  factory(b, level, ctx) {
    // main hall
    b.box(7.8, 5, 8.4, '#b5543c', { x: -1.8, z: -1.6 });
    b.box(7.9, 0.5, 8.5, '#8f3d2b', { x: -1.8, y: 0, z: -1.6 });
    for (let i = 0; i < 4; i++) {
      b.prism(7.8, 1.6, 2.1, '#8d99ae', { x: -1.8, y: 5, z: -4.75 + i * 2.1, sz: 1 });
      b.box(7.6, 1.1, 0.06, '#bde0fe', { x: -1.8, y: 5.1, z: -3.75 + i * 2.1, mat: 'lit' });
    }
    // windows row
    for (let i = 0; i < 4; i++) b.box(1.1, 1.1, 0.1, '#ffcf70', { x: -4.6 + i * 1.9, y: 3.3, z: 2.62, mat: 'lit' });
    // loading door + hazard stripes
    b.box(3.2, 2.8, 0.12, '#4a4e69', { x: -1.8, y: 0, z: 2.64, mat: 'metal' });
    for (let i = 0; i < 8; i++) b.box(0.4, 0.3, 0.1, i % 2 ? '#111' : '#ffd43b', { x: -3.2 + i * 0.4, y: 2.85, z: 2.66 });
    // chimneys
    const chimney = (x, z, h) => {
      b.cyl(0.55, 0.75, h, '#c1440e', { x, z }, 14);
      for (let k = 1; k < 4; k++) b.cyl(0.6 - k * 0.02, 0.62 - k * 0.02, 0.5, '#f8f9fa', { x, y: h - k * 1.6, z }, 14);
      b.cyl(0.65, 0.65, 0.3, '#3d3d3d', { x, y: h, z }, 14);
      ctx.emitters.push(new THREE.Vector3(x, h + 0.6, z));
    };
    chimney(-4.2, -4.6, 9.5);
    chimney(-2.2, -4.8, 8);
    if (level >= 4) chimney(-0.2, -4.6, 10.5);
    // silos
    for (const z of [-3.6, -0.6]) {
      b.cyl(1.2, 1.2, 5.6, '#ced4da', { x: 4.2, z, mat: 'metal' }, 18);
      b.sphere(1.2, '#e9ecef', { x: 4.2, y: 5.6, z, mat: 'metal' }, 18, 8, Math.PI / 2);
      for (let k = 0; k < 3; k++) b.torus(1.22, 0.05, '#868e96', { x: 4.2, y: 1.2 + k * 1.6, z, rx: Math.PI / 2, mat: 'metal' }, Math.PI * 2, 4, 24);
    }
    b.cyl(0.2, 0.2, 2.2, '#868e96', { x: 3.1, y: 4.2, z: -2.1, rz: Math.PI / 2, mat: 'metal' }, 8);
    b.cyl(0.2, 0.2, 3, '#868e96', { x: 4.2, y: 4.6, z: -3.6 + 0.0, rx: Math.PI / 2, mat: 'metal' }, 8);
    // pallets
    for (let i = 0; i < (level >= 3 ? 3 : 2); i++) {
      b.box(1.2, 0.15, 1.2, WOOD, { x: 3.6 + (i % 2) * 1.4, z: 2.2 + Math.floor(i / 2) * -1.4 });
      b.box(1.0, 0.9, 1.0, '#c9a46a', { x: 3.6 + (i % 2) * 1.4, y: 0.15, z: 2.2 + Math.floor(i / 2) * -1.4 });
      b.box(1.02, 0.12, 1.02, '#8d6e46', { x: 3.6 + (i % 2) * 1.4, y: 0.6, z: 2.2 + Math.floor(i / 2) * -1.4 });
    }
    if (level >= 6) {
      b.cyl(1.6, 1.6, 3, '#4dabf7', { x: 4.2, y: 0, z: -5.4 + 0.2, mat: 'metal' }, 18);
    }
    ctx.workStyle = 0;
  },

  lab(b, level, ctx) {
    b.rbox(10.4, 3.6, 7.4, 0.4, '#f1f5f9', { z: -2.0, mat: 'soft' });
    b.box(10.5, 0.4, 7.5, '#2ec4b6', { y: 2.6, z: -2.0 });
    b.box(9.4, 1.8, 0.1, '#7dd3fc', { y: 0.5, z: 1.72, mat: 'glass' });
    for (let i = 0; i < 6; i++) b.box(1.2, 1.2, 0.05, i % 2 ? '#a5f3fc' : '#e0f2fe', { x: -3.9 + i * 1.56, y: 0.75, z: 1.78, mat: 'lit' });
    b.box(1.6, 2.2, 0.15, '#0f766e', { y: 0, z: 1.75 });
    // dome
    b.cyl(3.3, 3.4, 0.6, '#e2e8f0', { x: -1.5, y: 3.6, z: -2.3, mat: 'soft' }, 28);
    b.sphere(3.1, '#9be7ff', { x: -1.5, y: 4.2, z: -2.3, mat: 'glass' }, 28, 14, Math.PI / 2);
    b.sphere(1.0, '#3cf2e0', { x: -1.5, y: 5.0, z: -2.3, mat: 'neon' }, 16, 12);
    const ring = new MeshBuilder();
    ring.torus(1.7, 0.07, '#7cfff0', { rx: Math.PI / 2, mat: 'neon' }, Math.PI * 2, 6, 40);
    ring.torus(1.4, 0.05, '#c084fc', { mat: 'neon' }, Math.PI * 2, 6, 40);
    const ringMesh = ring.build({ castShadow: false });
    ringMesh.position.set(-1.5, 5.0, -2.3);
    ctx.extra.push(ringMesh);
    ctx.animated.push((t) => { ringMesh.rotation.y = t * 0.9; ringMesh.rotation.x = Math.sin(t * 0.7) * 0.6; });
    // satellite dish
    b.cyl(0.15, 0.25, 1.6, '#cbd5e1', { x: 3.6, y: 3.6, z: -4, mat: 'metal' }, 8);
    b.sphere(1.5, '#f8fafc', { x: 3.6, y: 6.0, z: -4, rx: -2.3, mat: 'soft' }, 18, 8, Math.PI * 0.32);
    b.cyl(0.04, 0.04, 1.0, '#94a3b8', { x: 3.6, y: 5.4, z: -4, rx: 0.85, mat: 'metal' }, 6);
    // glowing tanks
    const tanks = level >= 3 ? 3 : 2;
    for (let i = 0; i < tanks; i++) {
      const x = 4.9, z = 2.6 - i * 1.3;
      b.cyl(0.5, 0.5, 0.2, '#64748b', { x, z, mat: 'metal' }, 12);
      b.cyl(0.44, 0.44, 1.7, i % 2 ? '#a3ff12' : '#38bdf8', { x, y: 0.2, z, mat: 'neon' }, 12);
      b.cyl(0.5, 0.5, 0.2, '#64748b', { x, y: 1.9, z, mat: 'metal' }, 12);
    }
    if (level >= 5) {
      b.cyl(1.4, 1.5, 0.5, '#e2e8f0', { x: 3.4, y: 3.6, z: -0.6, mat: 'soft' }, 20);
      b.sphere(1.3, '#d8b4fe', { x: 3.4, y: 4.1, z: -0.6, mat: 'glass' }, 20, 10, Math.PI / 2);
    }
    if (level >= 7) {
      b.cyl(0.12, 0.35, 3.6, '#94a3b8', { x: -4.8, y: 0, z: 3.4, mat: 'metal' }, 10);
      for (let k = 0; k < 4; k++) b.torus(0.4 - k * 0.05, 0.08, '#b87333', { x: -4.8, y: 1.0 + k * 0.6, z: 3.4, rx: Math.PI / 2, mat: 'metal' }, Math.PI * 2, 6, 14);
      b.sphere(0.45, '#e0aaff', { x: -4.8, y: 3.9, z: 3.4, mat: 'neon' }, 14, 10);
    }
    ctx.workStyle = 1;
  },

  mine(b, level, ctx) {
    const r = rng(42);
    b.ico(5.0, '#8a8f98', { x: 0, y: 1.6, z: -2.6, sy: 0.95, sx: 1.1 }, 1);
    b.ico(3.4, '#767b84', { x: -3.6, y: 0.8, z: -1.4 }, 1);
    b.ico(3.0, '#9aa0a8', { x: 3.6, y: 0.7, z: -1.0, ry: 0.5 }, 1);
    b.ico(2.2, '#6c7079', { x: 1.6, y: 5.0, z: -3.6 }, 0);
    b.ico(1.6, '#f8fafc', { x: 0.3, y: 6.3, z: -3.2, sy: 0.6 }, 0);
    // entrance
    b.box(2.6, 2.8, 2.0, '#0b0b0f', { y: 0, z: 1.2 });
    b.box(0.35, 3.2, 0.35, WOOD, { x: -1.45, z: 2.3 });
    b.box(0.35, 3.2, 0.35, WOOD, { x: 1.45, z: 2.3 });
    b.box(3.6, 0.4, 0.45, WOOD_D, { y: 3.0, z: 2.3 });
    b.box(3.4, 0.6, 0.12, '#3b2a1a', { y: 3.5, z: 2.45 });
    b.sphere(0.2, '#ffcf70', { x: 1.45, y: 2.7, z: 2.65, mat: 'lit' }, 8, 6);
    // rails
    for (const x of [-0.5, 0.5]) b.box(0.1, 0.1, 4.2, '#9ca3af', { x, y: 0.12, z: 3.6, mat: 'metal' });
    for (let i = 0; i < 6; i++) b.box(1.5, 0.1, 0.25, WOOD_D, { y: 0.02, z: 1.8 + i * 0.7 });
    // minecart
    b.group({ x: 0, y: 0.2, z: 3.4 }, () => {
      b.box(1.5, 0.9, 1.6, '#4b5563', { y: 0.3, mat: 'metal' });
      b.box(1.6, 0.12, 1.7, '#374151', { y: 1.2, mat: 'metal' });
      for (const [x, z] of [[-0.6, 0.55], [0.6, 0.55], [-0.6, -0.55], [0.6, -0.55]]) {
        b.cyl(0.22, 0.22, 0.12, '#1f2937', { x, y: 0.22, z, rz: Math.PI / 2 }, 10);
      }
      for (let i = 0; i < 5; i++) b.octa(0.26, ['#67e8f9', '#f0abfc', '#a78bfa'][i % 3], { x: -0.4 + (i % 3) * 0.4, y: 1.35, z: i < 3 ? -0.25 : 0.3, sy: 1.4, mat: 'neon' });
    });
    // crystals growing on the mountain
    const n = 5 + level * 2;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI - Math.PI;
      const rad = 3 + r() * 2.2;
      const x = Math.cos(a) * rad * 1.1;
      const z = -2.6 + Math.sin(a) * rad * 0.7;
      const y = 1.2 + r() * 3.5 * (1 - Math.abs(x) / 7);
      const col = ['#67e8f9', '#f0abfc', '#a78bfa', '#5eead4'][Math.floor(r() * 4)];
      b.octa(0.35 + r() * 0.4, col, { x, y, z, sy: 2 + r(), rx: r() - 0.5, rz: r() - 0.5, mat: 'neon' });
    }
    // pick axes & barrel
    b.cyl(0.45, 0.45, 1.0, '#7c4a2a', { x: -3.6, z: 3.4 }, 10);
    b.box(0.08, 1.6, 0.08, WOOD, { x: -2.7, z: 3.4, rz: 0.3 });
    b.box(0.9, 0.12, 0.12, '#9ca3af', { x: -2.95, y: 1.5, z: 3.4, rz: 0.3, mat: 'metal' });
    if (level >= 4) {
      b.box(2.6, 2.2, 2.2, '#a16207', { x: 4.2, y: 0, z: 3.0 });
      b.prism(2.8, 1.0, 2.4, '#713f12', { x: 4.2, y: 2.2, z: 3.0 });
      b.box(1.0, 0.8, 0.1, '#ffcf70', { x: 4.2, y: 1.0, z: 4.12, mat: 'lit' });
    }
    ctx.workStyle = 0;
  },

  spaceport(b, level, ctx) {
    // launch pad
    b.cyl(4.6, 4.9, 0.5, '#5b616b', { x: -1.2, z: -1.6 }, 32);
    b.torus(4.1, 0.12, '#ffd43b', { x: -1.2, y: 0.52, z: -1.6, rx: Math.PI / 2 }, Math.PI * 2, 4, 40);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      b.box(0.3, 0.12, 0.3, '#4dabf7', { x: -1.2 + Math.cos(a) * 4.5, y: 0.5, z: -1.6 + Math.sin(a) * 4.5, mat: 'neon' });
    }
    // gantry tower
    const gx = 2.6, gz = -1.6, gh = 11;
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
      b.box(0.18, gh, 0.18, '#e03131', { x: gx + dx, y: 0.5, z: gz + dz });
    }
    for (let k = 0; k < 9; k++) {
      b.box(1.4, 0.12, 0.12, '#f8f9fa', { x: gx, y: 1.5 + k * 1.2, z: gz + 0.6 });
      b.box(1.4, 0.12, 0.12, '#f8f9fa', { x: gx, y: 1.5 + k * 1.2, z: gz - 0.6 });
      b.box(0.12, 0.12, 1.4, '#f8f9fa', { x: gx - 0.6, y: 1.5 + k * 1.2, z: gz });
    }
    b.box(1.8, 0.2, 0.3, '#e03131', { x: gx - 1.4, y: 8.5, z: gz });
    b.sphere(0.18, '#ff2d2d', { x: gx, y: gh + 0.7, z: gz, mat: 'neon' }, 8, 6);
    // control building
    b.rbox(4.4, 2.6, 3.2, 0.3, '#f1f3f5', { x: 3.4, z: 2.6, mat: 'soft' });
    b.box(4.0, 0.9, 0.06, '#74c0fc', { x: 3.4, y: 1.3, z: 4.22, mat: 'lit' });
    b.cyl(0.08, 0.08, 1, '#adb5bd', { x: 4.6, y: 2.6, z: 2.4, mat: 'metal' }, 6);
    b.sphere(0.8, '#e9ecef', { x: 4.6, y: 3.7, z: 2.4, rx: -2.4, mat: 'metal' }, 14, 6, Math.PI * 0.35);
    // fuel spheres
    b.sphere(1.2, '#dee2e6', { x: -4.7, y: 1.5, z: 3.0, mat: 'metal' }, 16, 12);
    b.cyl(0.15, 0.15, 1.0, '#868e96', { x: -4.7, y: 0, z: 3.0, mat: 'metal' }, 8);
    if (level >= 4) {
      b.sphere(1.0, '#dee2e6', { x: -2.4, y: 1.3, z: 3.6, mat: 'metal' }, 16, 12);
      b.cyl(0.13, 0.13, 0.9, '#868e96', { x: -2.4, y: 0, z: 3.6, mat: 'metal' }, 8);
    }

    // animated rocket
    const rb = new MeshBuilder();
    rb.cyl(0.95, 0.95, 6.5, '#f8f9fa', { y: 0.9, mat: 'soft' }, 24);
    for (const y of [2.0, 5.2]) rb.cyl(0.97, 0.97, 0.45, '#1c7ed6', { y, mat: 'soft' }, 24);
    rb.cone(0.95, 2.4, '#e03131', { y: 7.4, mat: 'soft' }, 24);
    rb.cyl(0.25, 0.7, 0.9, '#495057', { y: 0, mat: 'metal' }, 16);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      rb.box(0.12, 1.8, 1.0, '#e03131', { x: Math.cos(a) * 1.0, y: 0.9, z: Math.sin(a) * 1.0, ry: -a, mat: 'soft' });
    }
    rb.cyl(0.32, 0.32, 0.08, '#a5d8ff', { y: 4.4, z: 0.93, rx: Math.PI / 2, mat: 'lit' }, 16);
    rb.cyl(0.32, 0.32, 0.08, '#a5d8ff', { y: 3.4, z: 0.93, rx: Math.PI / 2, mat: 'lit' }, 16);
    const rocket = rb.build();
    const fb = new MeshBuilder();
    fb.cone(0.6, 2.2, '#ffd43b', { rx: Math.PI, mat: 'neon' }, 12);
    fb.cone(0.35, 1.4, '#ffffff', { rx: Math.PI, mat: 'neon' }, 10);
    const flame = fb.build({ castShadow: false });
    flame.visible = false;
    rocket.add(flame);
    rocket.position.set(-1.2, 0.5, -1.6);
    ctx.extra.push(rocket);
    let phase = 'idle';
    let timer = 15 + Math.random() * 20;
    ctx.animated.push((t, dt, fx, toWorld) => {
      timer -= dt;
      if (phase === 'idle') {
        rocket.position.y = 0.5;
        if (timer <= 0) { phase = 'ignite'; timer = 1.6; flame.visible = true; }
      } else if (phase === 'ignite') {
        rocket.position.x = -1.2 + (Math.random() - 0.5) * 0.06;
        flame.scale.set(1, 0.5 + Math.random() * 0.5, 1);
        if (fx && Math.random() < 0.6) fx.puff(toWorld(new THREE.Vector3(-1.2 + (Math.random() - 0.5) * 4, 0.8, -1.6 + (Math.random() - 0.5) * 4)), { color: '#e9ecef', size: 1.4, life: 2.2, up: 0.6, spread: 2.5 });
        if (timer <= 0) { phase = 'launch'; timer = 7; }
      } else if (phase === 'launch') {
        const k = 7 - timer;
        rocket.position.x = -1.2;
        rocket.position.y = 0.5 + k * k * 2.2;
        flame.scale.set(1.2, 1 + Math.random() * 0.6, 1.2);
        if (fx && Math.random() < 0.7) fx.puff(toWorld(new THREE.Vector3(-1.2, rocket.position.y - 1, -1.6)), { color: '#f1f3f5', size: 1.1, life: 2.5, up: -0.5, spread: 0.6 });
        if (timer <= 0) { phase = 'gone'; timer = 6; rocket.visible = false; flame.visible = false; }
      } else if (phase === 'gone') {
        if (timer <= 0) {
          phase = 'return'; timer = 1.2; rocket.visible = true; rocket.position.y = 0.5; rocket.scale.setScalar(0.01);
        }
      } else if (phase === 'return') {
        const k = 1 - timer / 1.2;
        rocket.scale.setScalar(Math.max(0.01, easeOutBack(Math.min(1, k))));
        if (timer <= 0) { phase = 'idle'; timer = 35 + Math.random() * 25; rocket.scale.setScalar(1); }
      }
    });
    ctx.workStyle = 1;
  },
};

export function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function buildBusiness(typeId, level) {
  const b = new MeshBuilder();
  const ctx = { emitters: [], animated: [], extra: [], workStyle: 0, height: 8 };
  MODELS[typeId](b, level, ctx);
  const group = b.build();
  for (const e of ctx.extra) group.add(e);
  return { group, emitters: ctx.emitters, animated: ctx.animated, workStyle: ctx.workStyle, height: ctx.height };
}

// ---------------------------------------------------------------------------
// Headquarters (bank)
// ---------------------------------------------------------------------------
export function buildHQ() {
  const b = new MeshBuilder();
  const stone = '#efe6d2';
  const stoneD = '#d9ccb0';
  // plinth & steps
  b.box(11.6, 0.6, 9.2, stoneD, { z: -2.0 });
  for (let i = 0; i < 3; i++) b.box(6 - i * 0.2, 0.2 * (i + 1), 0.8, stoneD, { z: 3.3 - i * 0.6 });
  // main block
  b.box(10.4, 5.6, 6, stone, { y: 0.6, z: -3.4 });
  for (let i = 0; i < 4; i++) {
    windowLit(b, 1.0, 2.0, { x: 5.22, y: 2.2, z: -5.6 + i * 1.5, ry: Math.PI / 2 }, '#c9b88f', '#ffd98a');
    windowLit(b, 1.0, 2.0, { x: -5.22, y: 2.2, z: -5.6 + i * 1.5, ry: -Math.PI / 2 }, '#c9b88f', '#ffd98a');
  }
  // portico
  b.box(10.6, 0.25, 3.2, stoneD, { y: 0.6, z: 0.8 });
  for (let i = 0; i < 6; i++) {
    const x = -4.25 + i * 1.7;
    b.cyl(0.36, 0.4, 0.35, stoneD, { x, y: 0.85, z: 1.6 }, 16);
    b.cyl(0.32, 0.36, 4.0, '#f7f1e3', { x, y: 1.2, z: 1.6 }, 16);
    b.box(0.9, 0.3, 0.9, stoneD, { x, y: 5.2, z: 1.6 });
  }
  b.box(10.8, 0.8, 3.6, stone, { y: 5.5, z: 0.6 });
  b.box(10.9, 0.15, 3.7, '#c9a227', { y: 5.95, z: 0.6, mat: 'gold' });
  b.prism(3.6, 2.0, 10.8, stone, { y: 6.3, z: 0.6, ry: Math.PI / 2 });
  b.prism(3.7, 0.3, 11.0, stoneD, { y: 6.2, z: 0.6, ry: Math.PI / 2, sy: 1 });
  // golden emblem on pediment
  b.cyl(0.55, 0.55, 0.1, '#f5c542', { y: 7.0, z: 2.45, rx: Math.PI / 2, mat: 'gold' }, 20);
  // door
  b.box(2.2, 3.6, 0.15, '#5b3a1a', { y: 0.85, z: -0.38 });
  b.box(0.08, 3.6, 0.2, '#c9a227', { y: 0.85, z: -0.35, mat: 'gold' });
  b.box(2.2, 0.9, 0.16, '#ffe1a0', { y: 4.5, z: -0.38, mat: 'lit' });
  windowLit(b, 1.0, 2.0, { x: -3.0, y: 2.0, z: -0.38 }, '#c9b88f', '#ffd98a');
  windowLit(b, 1.0, 2.0, { x: 3.0, y: 2.0, z: -0.38 }, '#c9b88f', '#ffd98a');
  // roof + dome
  b.box(10.6, 0.4, 6.2, stoneD, { y: 6.2, z: -3.4 });
  b.cyl(2.4, 2.5, 1.1, stone, { y: 6.6, z: -3.4 }, 28);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.box(0.25, 0.7, 0.1, '#ffd98a', { x: Math.cos(a) * 2.42, y: 6.8, z: -3.4 + Math.sin(a) * 2.42, ry: -a + Math.PI / 2, mat: 'lit' });
  }
  b.sphere(2.3, '#d4a72c', { y: 7.7, z: -3.4, mat: 'gold' }, 28, 14, Math.PI / 2);
  b.cyl(0.08, 0.12, 1.3, '#d4a72c', { y: 9.9, z: -3.4, mat: 'gold' }, 8);
  // flags
  for (const x of [-5.6, 5.6]) {
    b.cyl(0.08, 0.1, 7.5, '#dee2e6', { x, y: 0, z: 5.2, mat: 'metal' }, 8);
    b.sphere(0.15, '#d4a72c', { x, y: 7.55, z: 5.2, mat: 'gold' }, 8, 6);
    b.box(0.05, 1.3, 2.1, x < 0 ? '#1d3557' : '#d4a72c', { x, y: 6.0, z: 4.1, mat: x < 0 ? 'soft' : 'gold' });
  }
  planter(b, { x: -4.4, y: 0, z: 4.0, ry: 0 });
  planter(b, { x: 4.4, y: 0, z: 4.0, ry: 0 }, '#ffd43b');
  // lamps on plaza
  for (const x of [-3.4, 3.4]) {
    b.cyl(0.07, 0.1, 2.8, '#2b2f36', { x, y: 0, z: 5.8, mat: 'metal' }, 8);
    b.sphere(0.28, '#fff1c1', { x, y: 3.0, z: 5.8, mat: 'lit' }, 10, 8);
  }
  const group = b.build();

  // Big spinning gold coin with a "$"
  const tex = makeCoinTexture();
  const gold = new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 1, roughness: 0.25 });
  const face = new THREE.MeshStandardMaterial({ map: tex, metalness: 1, roughness: 0.28 });
  gold.userData.owned = true; face.userData.owned = true;
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.3, 36), [gold, face, face]);
  coin.rotation.x = Math.PI / 2;
  coin.castShadow = true;
  const coinPivot = new THREE.Group();
  coinPivot.add(coin);
  coinPivot.position.set(0, 12.6, -3.4);
  group.add(coinPivot);
  return { group, coin: coinPivot };
}

function makeCoinTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 110, 20, 128, 128, 128);
  grd.addColorStop(0, '#ffe08a');
  grd.addColorStop(1, '#c8901e');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#a8740f';
  g.lineWidth = 14;
  g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#9a6a0c';
  g.font = 'bold 160px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('$', 128, 138);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------------------
// Signboard with canvas text (standing at the front-left corner of a pad)
// ---------------------------------------------------------------------------
export function buildSign(title, subtitle, color, icon = '') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 192;
  const g = c.getContext('2d');
  roundRect(g, 6, 6, 500, 180, 28);
  g.fillStyle = '#10151f';
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = color;
  g.stroke();
  g.fillStyle = color;
  roundRect(g, 22, 22, 130, 148, 20);
  g.fill();
  g.font = '86px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(icon, 87, 100);
  g.textAlign = 'left';
  g.fillStyle = '#ffffff';
  let size = 46;
  g.font = `800 ${size}px Outfit, Arial, sans-serif`;
  while (g.measureText(title).width > 330 && size > 26) { size -= 2; g.font = `800 ${size}px Outfit, Arial, sans-serif`; }
  g.fillText(title, 172, 76);
  g.fillStyle = color;
  g.font = '700 34px Outfit, Arial, sans-serif';
  g.fillText(subtitle, 172, 132);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const grp = new THREE.Group();
  const b = new MeshBuilder();
  b.box(0.16, 2.0, 0.16, '#3a3f47', { x: -1.5, mat: 'metal' });
  b.box(0.16, 2.0, 0.16, '#3a3f47', { x: 1.5, mat: 'metal' });
  b.box(3.6, 1.45, 0.12, '#1b2230', { y: 1.65 });
  grp.add(b.build());
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(0.9, 0.9, 0.9) });
  mat.userData.owned = true;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.45, 1.3), mat);
  plane.position.set(0, 2.375, 0.07);
  grp.add(plane);
  return grp;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ---------------------------------------------------------------------------
// Empty plot decoration ("For sale")
// ---------------------------------------------------------------------------
let forSaleTex = null;
export function buildForSale() {
  if (!forSaleTex) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#fff8e7';
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#e03131';
    g.lineWidth = 10;
    g.strokeRect(5, 5, 246, 118);
    g.fillStyle = '#e03131';
    g.font = '900 50px Outfit, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('À VENDRE', 128, 64);
    forSaleTex = new THREE.CanvasTexture(c);
    forSaleTex.colorSpace = THREE.SRGBColorSpace;
  }
  const grp = new THREE.Group();
  const b = new MeshBuilder();
  b.box(0.15, 1.6, 0.15, WOOD_D, {});
  b.box(2.2, 1.15, 0.08, WOOD, { y: 1.1, z: -0.06 });
  grp.add(b.build());
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), new THREE.MeshStandardMaterial({ map: forSaleTex, roughness: 0.8 }));
  plane.position.set(0, 1.675, 0.0);
  plane.castShadow = true;
  grp.add(plane);
  return grp;
}

export { bush };
