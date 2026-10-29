import * as THREE from 'three';
import { MeshBuilder, rng } from './builder.js';
import { makeShadowProxy } from './buildings.js';
import { PAL, shade, awning, pot, bench } from './kit.js';
import { CELL, GRID, DECOR, PAD, PAD_Y } from '../game/config.js';

// Decorative (non-playable) city blocks around the district: apartments with shops,
// townhouse rows, office towers, small shops and parks. Blocks are merged per spatial
// chunk (a few draw calls each, frustum-culled per chunk) with a low-poly shadow proxy.

const WALLS = ['#f2d6b3', '#e8c4a0', '#cfe1f2', '#f6e3a8', '#d9ead3', '#f3c9c0', '#e3d5f0', '#efe9df', '#c9dbe6'];
const ACCENTS = ['#e0573f', '#4b8fd8', '#3bb3a8', '#f2a541', '#8b5cf6', '#e86aa1'];
const ROOFS = ['#d86a4a', '#8a94a3', '#6b7584', '#b4513a'];

function windowRow(b, w, y, z, n, lit, frame, ry = 0, x0 = 0) {
  b.group({ x: x0, z, ry }, () => {
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + (k + 0.5) * (w / n);
      b.box(1.0, 1.2, 0.12, frame, { x, y: y - 0.1, sharp: true });
      b.box(0.8, 1.0, 0.16, lit(k), { x, y, mat: 'lit', sharp: true });
    }
  });
}

const litColor = (r) => () => (r() > 0.45 ? (r() > 0.5 ? '#ffe3a3' : '#d6ecff') : '#3e5874');

const BLOCKS = {
  apartment(b, r) {
    const wall = WALLS[(r() * WALLS.length) | 0];
    const acc = ACCENTS[(r() * ACCENTS.length) | 0];
    const floors = 3 + ((r() * 4) | 0);
    const W = 10.5, D = 8.5, fh = 2.3, H = 2.8 + floors * fh;
    const lit = litColor(r);
    b.box(W + 0.3, 0.3, D + 0.3, '#cfc5b4', { z: -1, r: 0.1 });
    b.box(W, 2.8, D, '#efe9df', { y: 0.3, z: -1, r: 0.12 });
    b.box(W, floors * fh, D, wall, { y: 3.1, z: -1, r: 0.15 });
    for (let f = 0; f < floors; f++) {
      const y = 3.6 + f * fh;
      windowRow(b, W - 1.5, y, -1 + D / 2 + 0.02, 4, lit, PAL.white);
      b.group({ x: W / 2 + 0.02 }, () => windowRow(b, D - 1.5, y, -1, 3, lit, PAL.white, Math.PI / 2));
      b.group({ x: -W / 2 - 0.02 }, () => windowRow(b, D - 1.5, y, -1, 3, lit, PAL.white, -Math.PI / 2));
      b.box(W + 0.1, 0.14, D + 0.1, shade(wall, 0.85), { y: 3.1 + f * fh, z: -1, r: 0.06 });
      if (f % 2 === 1) b.box(3, 0.16, 1.0, PAL.white, { x: -2.2, y: y - 0.35, z: -1 + D / 2 + 0.5, r: 0.05 });
    }
    // ground floor shop
    b.box(W - 2, 1.9, 0.12, '#bfe3ff', { y: 0.6, z: -1 + D / 2 + 0.03, mat: 'lit', sharp: true });
    b.box(1.2, 2.2, 0.14, PAL.woodD, { x: W / 2 - 1.4, y: 0.3, z: -1 + D / 2 + 0.05, sharp: true });
    awning(b, { y: 2.85, z: -1 + D / 2 + 0.05, w: W - 1.2, depth: 1.1, colors: ['#ffffff', acc] });
    // roof
    b.box(W + 0.3, 0.35, D + 0.3, '#d6d0c6', { y: H + 0.3, z: -1, r: 0.12 });
    b.box(W - 0.6, 0.06, D - 0.6, '#a9a39a', { y: H + 0.62, z: -1, sharp: true });
    b.box(1.6, 0.9, 1.0, '#f1f3f5', { x: -2.5, y: H + 0.65, z: -2.5, sharp: true });
    if (r() > 0.4) {
      b.cyl(1.0, 1.0, 1.8, '#8a6b4a', { x: 2.6, y: H + 1.1, z: -2.6 }, 10);
      b.cone(1.1, 0.7, '#5f6875', { x: 2.6, y: H + 2.9, z: -2.6 }, 10);
      for (const [x, z] of [[1.9, -1.9], [3.3, -1.9], [1.9, -3.3], [3.3, -3.3]]) b.box(0.12, 0.8, 0.12, PAL.dark, { x, y: H + 0.65, z, sharp: true });
    }
  },

  townhouses(b, r) {
    const n = 3;
    const w = 11 / n;
    for (let k = 0; k < n; k++) {
      const x = -5.5 + (k + 0.5) * w;
      const wall = WALLS[(r() * WALLS.length) | 0];
      const floors = 2 + ((r() * 2) | 0);
      const H = 0.3 + floors * 2.4;
      b.box(w - 0.15, H, 7, wall, { x, z: -1.5, r: 0.12 });
      b.prism(w + 0.2, 2.2, 7.6, ROOFS[(r() * ROOFS.length) | 0], { x, y: H, z: -1.5 });
      b.box(0.9, 1.9, 0.14, ACCENTS[(r() * ACCENTS.length) | 0], { x: x - 0.7, y: 0.3, z: 2.02, r: 0.04 });
      b.box(1.1, 0.2, 0.5, '#cfc5b4', { x: x - 0.7, y: 0, z: 2.3, r: 0.05 });
      for (let f = 0; f < floors; f++) {
        b.box(1.0, 1.2, 0.12, PAL.white, { x: x + 0.7, y: 0.75 + f * 2.4, z: 2.0, sharp: true });
        b.box(0.8, 1.0, 0.16, litColor(r)(), { x: x + 0.7, y: 0.85 + f * 2.4, z: 2.0, mat: 'lit', sharp: true });
        if (f > 0) {
          b.box(1.0, 1.2, 0.12, PAL.white, { x: x - 0.7, y: 0.75 + f * 2.4, z: 2.0, sharp: true });
          b.box(0.8, 1.0, 0.16, litColor(r)(), { x: x - 0.7, y: 0.85 + f * 2.4, z: 2.0, mat: 'lit', sharp: true });
        }
      }
      b.box(0.7, 1.6, 0.7, '#b4513a', { x: x + 0.9, y: H + 0.8, z: -3, r: 0.08 });
    }
    for (let k = 0; k < 3; k++) b.blob(0.6, PAL.green, { x: -4.5 + k * 4.5, y: 0.5, z: 3.8 }, 1);
  },

  tower(b, r, cbd) {
    const floors = cbd ? 12 + ((r() * 11) | 0) : 7 + ((r() * 7) | 0);
    const fh = 1.8;
    const lit = litColor(r);
    b.box(9.4, 0.4, 9.4, '#cfd4da', { z: -1, r: 0.15 });
    b.box(8.4, 2.6, 8.4, '#9cc9f0', { y: 0.4, z: -1, mat: 'glass', r: 0.2 });
    let y = 3;
    for (let f = 0; f < floors; f++) {
      b.box(8.6, 0.28, 8.6, PAL.white, { y, z: -1, r: 0.1 });
      b.box(8.2, fh - 0.25, 8.2, '#6fa3d8', { y: y + 0.25, z: -1, mat: 'glass', r: 0.18 });
      for (const [ry, ox, oz] of [[0, 0, 4.12], [Math.PI / 2, 4.12, 0], [-Math.PI / 2, -4.12, 0]]) {
        b.group({ x: ox, y: y + 0.55, z: -1 + oz, ry }, () => {
          for (let k = 0; k < 4; k++) if (r() > 0.4) b.box(1.5, fh - 0.75, 0.05, lit(k), { x: -2.9 + k * 1.95, mat: 'lit', sharp: true });
        });
      }
      y += fh;
    }
    b.box(8.8, 0.45, 8.8, '#d6d0c6', { y, z: -1, r: 0.15 });
    b.box(8.0, 0.06, 8.0, '#a9a39a', { y: y + 0.45, z: -1, sharp: true });
    b.box(0.12, 3, 0.12, '#adb5bd', { x: 2.5, y: y + 0.45, z: -2, sharp: true });
    b.sphere(0.16, '#ff2d2d', { x: 2.5, y: y + 3.5, z: -2, mat: 'neon' }, 6, 4);
  },

  shop(b, r) {
    const wall = WALLS[(r() * WALLS.length) | 0];
    const acc = ACCENTS[(r() * ACCENTS.length) | 0];
    const H = 3.8 + (r() > 0.5 ? 2.4 : 0);
    b.box(11, H, 7.5, wall, { z: -1.6, r: 0.15 });
    b.box(9.6, 2.0, 0.12, '#bfe3ff', { y: 0.4, z: 2.17, mat: 'lit', sharp: true });
    b.box(11.1, 0.8, 0.4, acc, { y: 2.9, z: 2.15, r: 0.15 });
    b.box(7, 0.35, 0.1, '#ffffff', { y: 3.1, z: 2.38, mat: 'neon', sharp: true });
    awning(b, { y: 2.85, z: 2.2, w: 10.4, depth: 1.2, colors: ['#ffffff', acc] });
    if (H > 4) windowRow(b, 9, 4.6, 2.14, 4, litColor(r), PAL.white);
    b.box(11.3, 0.3, 7.8, '#d6d0c6', { y: H, z: -1.6, r: 0.1 });
    b.box(10.4, 0.06, 7.0, '#a9a39a', { y: H + 0.3, z: -1.6, sharp: true });
    pot(b, { x: -5, y: 0, z: 3.6, flower: '#ff6b9a' });
    pot(b, { x: 5, y: 0, z: 3.6 });
    bench(b, { x: 0, y: 0, z: 4.2 });
  },

  park(b, r) {
    b.box(PAD - 0.6, 0.06, PAD - 0.6, '#6dbb4c', { y: PAD_Y - 0.03, sharp: true });
    b.box(1.6, 0.07, PAD - 0.6, '#d9cbb3', { y: PAD_Y - 0.02, sharp: true });
    b.box(PAD - 0.6, 0.07, 1.6, '#d9cbb3', { y: PAD_Y - 0.02, sharp: true });
    b.cyl(2.2, 2.4, 0.6, '#c9c3b8', { y: PAD_Y }, 20);
    b.cyl(1.9, 1.9, 0.1, '#5cc8f0', { y: PAD_Y + 0.52, mat: 'soft' }, 20);
    b.cyl(0.25, 0.35, 1.4, '#c9c3b8', { y: PAD_Y + 0.5 }, 10);
    b.sphere(0.5, '#9be7ff', { y: PAD_Y + 2.0, sy: 0.6, mat: 'glass' }, 10, 6);
    for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4], [-4.5, 0.5], [4.5, -0.5]]) {
      const s = 0.8 + r() * 0.5;
      b.cyl(0.25, 0.35, 1.8 * s, '#7a5233', { x, y: PAD_Y, z }, 6);
      b.blob(1.5 * s, ['#3f8f3a', '#5cb84a', '#4ca346'][(r() * 3) | 0], { x, y: PAD_Y + 2.6 * s, z }, 1);
    }
    bench(b, { x: 0, y: PAD_Y, z: -3.2 });
    bench(b, { x: 0, y: PAD_Y, z: 3.2, ry: Math.PI });
  },
};

BLOCKS.market = function market(b, r) {
  b.box(PAD - 0.6, 0.05, PAD - 0.6, '#d9cbb3', { y: 0.0, sharp: true });
  const cols = ['#e0573f', '#4b8fd8', '#f2a541', '#3bb3a8', '#e86aa1', '#5fb35a'];
  for (let k = 0; k < 6; k++) {
    const x = -3.6 + (k % 3) * 3.6, z = k < 3 ? -2.4 : 2.4;
    b.group({ x, z, ry: (r() - 0.5) * 0.3 }, () => {
      b.box(2.4, 0.9, 1.4, '#c98a4b', { r: 0.06 });
      for (const sx of [-1.1, 1.1]) b.box(0.1, 2.3, 0.1, '#5c4033', { x: sx, z: 0.6, sharp: true });
      b.box(2.8, 0.12, 1.9, cols[k], { y: 2.3, z: 0.1, rx: 0.15, r: 0.04 });
      for (let q = 0; q < 6; q++) b.sphere(0.16, ['#ffe135', '#e63946', '#7cbf3f', '#ff922b'][(q + k) % 4], { x: -0.9 + q * 0.36, y: 1.0, z: 0.1 + (q % 2) * 0.25 }, 6, 4);
    });
  }
  bench(b, { x: 0, y: 0, z: 0, ry: r() * 0.5 });
};

BLOCKS.parking = function parking(b, r) {
  b.box(PAD - 0.6, 0.05, PAD - 0.6, '#6b7280', { sharp: true });
  for (let k = 0; k < 6; k++) b.box(0.12, 0.02, 3.2, '#f8f9fa', { x: -4.5 + k * 1.8, y: 0.05, z: -3, sharp: true });
  for (let k = 0; k < 6; k++) b.box(0.12, 0.02, 3.2, '#f8f9fa', { x: -4.5 + k * 1.8, y: 0.05, z: 3, sharp: true });
  const cols = ['#e0573f', '#4b8fd8', '#f2c14e', '#f8f9fa', '#2e3440', '#3bb3a8', '#8b5cf6'];
  for (let k = 0; k < 10; k++) {
    if (r() < 0.3) continue;
    const x = -3.6 + (k % 5) * 1.8, z = k < 5 ? -3 : 3;
    b.group({ x, z, ry: Math.PI / 2 + (r() - 0.5) * 0.1 }, () => {
      const col = cols[(r() * cols.length) | 0];
      b.rbox(3.0, 0.75, 1.5, 0.32, col, { y: 0.25, mat: 'soft' });
      b.rbox(1.7, 0.66, 1.35, 0.3, '#bfe3ff', { x: -0.15, y: 0.88, mat: 'glass' });
    });
  }
  for (const [x, z] of [[-5.2, 0], [5.2, 0]]) b.blob(0.9, '#4ca346', { x, y: 0.7, z }, 1);
};

BLOCKS.sports = function sports(b, r) {
  b.box(PAD - 1.2, 0.05, PAD - 2.4, '#4caf50', { sharp: true });
  for (let k = 0; k < 6; k++) b.box((PAD - 1.2) / 6, 0.052, PAD - 2.4, k % 2 ? '#43a047' : '#4caf50', { x: -(PAD - 1.2) / 2 + (k + 0.5) * ((PAD - 1.2) / 6), sharp: true });
  b.box(PAD - 1.4, 0.06, 0.1, '#ffffff', { z: (PAD - 2.6) / 2, sharp: true });
  b.box(PAD - 1.4, 0.06, 0.1, '#ffffff', { z: -(PAD - 2.6) / 2, sharp: true });
  b.box(0.1, 0.06, PAD - 2.6, '#ffffff', { sharp: true });
  b.torus(1.2, 0.05, '#ffffff', { y: 0.06, rx: Math.PI / 2 }, Math.PI * 2, 4, 24);
  for (const x of [-5.6, 5.6]) {
    b.box(0.1, 1.4, 0.1, '#ffffff', { x, z: -1.1, sharp: true });
    b.box(0.1, 1.4, 0.1, '#ffffff', { x, z: 1.1, sharp: true });
    b.box(0.1, 0.1, 2.3, '#ffffff', { x, y: 1.35, sharp: true });
  }
  b.sphere(0.25, '#ffffff', { x: (r() - 0.5) * 4, y: 0.3, z: (r() - 0.5) * 3 }, 8, 6);
};

BLOCKS.warehouse = function warehouse(b, r) {
  const wall = ['#c9c3b8', '#b8c4cc', '#d6c9b0', '#a9b4bf'][(r() * 4) | 0];
  b.box(11.4, 5.5, 9, wall, { z: -1.4, r: 0.15 });
  for (let x = -5.2; x <= 5.2; x += 0.6) b.box(0.05, 5.2, 0.04, shade(wall, 0.85), { x, y: 0.2, z: 3.11, sharp: true });
  for (let k = 0; k < 3; k++) b.prism(11.4, 1.4, 3, '#8a94a3', { y: 5.5, z: -4.4 + k * 3 });
  for (let k = 0; k < 3; k++) b.box(11, 0.9, 0.06, '#cfe8ff', { y: 5.6, z: -3.4 + k * 3, mat: 'lit', sharp: true });
  for (const x of [-3.4, 0, 3.4]) {
    b.box(2.8, 3.0, 0.12, '#5d6b7a', { x, y: 0, z: 3.12, r: 0.04 });
    b.box(3.0, 0.9, 1.4, '#6b7280', { x, y: 0, z: 3.8, r: 0.06 });
  }
  b.box(4, 0.6, 0.3, '#e0573f', { x: -3, y: 4.4, z: 3.15, r: 0.1 });
  if (r() < 0.6) {
    b.group({ x: 3.2, z: 5.6, ry: Math.PI / 2 }, () => {
      b.rbox(5.4, 2.4, 2.2, 0.15, '#f1f3f5', { x: -0.8, y: 0.6 });
      b.rbox(1.6, 2.0, 2.1, 0.3, '#4b8fd8', { x: 2.6, y: 0.6 });
      for (const x of [-2.6, -1.2, 2.6]) for (const z of [-0.95, 0.95]) b.cyl(0.42, 0.42, 0.3, '#22262d', { x, y: 0.42, z: z - Math.sign(z) * 0.15, rx: Math.PI / 2 }, 10);
    });
  }
};

BLOCKS.containers = function containers(b, r) {
  b.box(PAD - 0.6, 0.05, PAD - 0.6, '#8d939b', { sharp: true });
  const cols = ['#e0573f', '#4b8fd8', '#f2a541', '#3bb3a8', '#8b5cf6', '#5fb35a', '#c9c3b8'];
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 2; k++) {
      const h = 1 + ((r() * 3) | 0);
      for (let lvl = 0; lvl < h; lvl++) {
        const c = cols[(r() * cols.length) | 0];
        b.box(5.2, 1.25, 2.1, c, { x: -2.8 + k * 5.6, y: lvl * 1.28, z: -4 + row * 2.6, r: 0.06 });
        for (let q = 0; q < 8; q++) b.box(0.05, 1.1, 2.12, shade(c, 0.78), { x: -5.1 + k * 5.6 + q * 0.6 + 0.3, y: lvl * 1.28 + 0.08, z: -4 + row * 2.6, sharp: true });
      }
    }
  }
  // gantry crane
  for (const x of [-5.8, 5.8]) b.box(0.4, 7.5, 0.4, '#ffc93c', { x, z: 3.6, r: 0.1 });
  b.box(12.2, 0.6, 0.6, '#ffc93c', { y: 7.5, z: 3.6, r: 0.12 });
  b.box(1.2, 0.8, 1.0, '#495057', { x: (r() - 0.5) * 8, y: 6.7, z: 3.6, r: 0.1 });
};

BLOCKS.plaza = function plaza(b, r) {
  b.box(PAD - 0.6, 0.06, PAD - 0.6, '#e3dccd', { sharp: true });
  for (let k = 0; k < 6; k++) b.box(PAD - 0.6, 0.065, 0.05, '#cfc6b5', { z: -5 + k * 2, sharp: true });
  b.cyl(2.6, 2.8, 0.55, '#d6d0c6', {}, 28);
  b.cyl(2.3, 2.3, 0.08, '#5cc8f0', { y: 0.48, mat: 'soft' }, 28);
  b.box(0.9, 3.5, 0.9, '#9aa4b1', { y: 0.5, r: 0.2, mat: 'metal' });
  b.sphere(0.6, '#f2c14e', { y: 4.5, mat: 'gold' }, 14, 10);
  for (const [x, z] of [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]]) {
    b.box(2.2, 0.08, 2.2, '#c9c3b8', { x, z, sharp: true });
    b.box(1.9, 0.1, 1.9, '#7cbc4f', { x, z, sharp: true });
    b.cyl(0.16, 0.22, 1.8, '#7a5233', { x, z }, 6);
    b.blob(1.2, '#4ca346', { x, y: 2.6, z }, 1);
  }
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) bench(b, { x: Math.sin(a) * 3.9, z: Math.cos(a) * 3.9, ry: a + Math.PI });
};

const DISTRICTS = {
  cbd: ['tower', 'tower', 'plaza', 'tower', 'tower', 'shop', 'tower'],
  residential: ['townhouses', 'apartment', 'townhouses', 'park', 'apartment', 'sports', 'townhouses', 'market', 'apartment'],
  industrial: ['warehouse', 'containers', 'warehouse', 'parking', 'warehouse', 'containers'],
};
/** North = business district, south = residential, east / west = industrial. */
export function districtOf(i, j) {
  if (j <= -(GRID + 1)) return 'cbd';
  if (j >= GRID + 1) return 'residential';
  return 'industrial';
}
const OPEN = ['park', 'market', 'parking', 'sports', 'containers', 'plaza'];

function corners(b, r) {
  // a few bushes / small trees in random pad corners: breaks the strict grid
  for (const [cx, cz] of [[-5.3, -5.3], [5.3, -5.3], [-5.3, 5.3], [5.3, 5.3]]) {
    if (r() < 0.45) continue;
    // every tree or bush gets its own little lawn with a curb
    b.box(2.2, 0.08, 2.2, '#c9c3b8', { x: cx, y: PAD_Y - 0.02, z: cz, sharp: true });
    b.box(1.9, 0.1, 1.9, '#7cbc4f', { x: cx, y: PAD_Y - 0.02, z: cz, sharp: true });
    if (r() < 0.5) b.blob(0.5 + r() * 0.5, ['#4ca346', '#3f8f3a', '#6aa84f'][(r() * 3) | 0], { x: cx + (r() - 0.5), y: PAD_Y + 0.35, z: cz + (r() - 0.5), sy: 0.8 }, 1);
    else {
      b.cyl(0.14, 0.2, 1.6, '#7a5233', { x: cx, y: PAD_Y, z: cz }, 6);
      b.blob(1.0 + r() * 0.4, ['#4ca346', '#5cb84a'][(r() * 2) | 0], { x: cx, y: PAD_Y + 2.3, z: cz }, 1);
    }
  }
}

function drawBlock(b, i, j, kind, seed, cbd) {
  const r = rng(seed);
  const ry = [0, Math.PI / 2, Math.PI, -Math.PI / 2][(Math.abs(i * 7 + j * 3)) % 4];
  const open = OPEN.includes(kind);
  b.group({ x: i * CELL, z: j * CELL }, () => {
    b.box(PAD, PAD_Y - 0.02, PAD, '#c4bcad', { sharp: true });
    if (kind !== 'park') b.box(PAD - 0.7, 0.04, PAD - 0.7, r() < 0.3 && !open ? '#9fc36a' : '#d9d3c7', { y: PAD_Y - 0.03, sharp: true });
    // buildings sit slightly off-centre and off-axis, like a real city
    const jitter = open ? { x: 0, z: 0, t: 0 } : { x: (r() - 0.5) * 1.1, z: (r() - 0.5) * 0.9, t: (r() - 0.5) * 0.14 };
    b.group({ y: kind === 'park' ? 0 : PAD_Y, x: jitter.x, z: jitter.z, ry: kind === 'park' ? 0 : ry + jitter.t, sy: open ? 1 : 0.9 + r() * 0.25 }, () => BLOCKS[kind](b, r, cbd));
    if (!open) corners(b, r);
  });
}

export function buildCityscape() {
  const group = new THREE.Group();
  const chunks = new Map();
  const N = GRID + DECOR;
  for (let i = -N; i <= N; i++) {
    for (let j = -N; j <= N; j++) {
      if (Math.max(Math.abs(i), Math.abs(j)) <= GRID) continue;
      const key = `${Math.floor((i + N) / 4)},${Math.floor((j + N) / 4)}`;
      if (!chunks.has(key)) chunks.set(key, []);
      const seed = (i + 50) * 977 + (j + 50) * 131;
      const dist = districtOf(i, j);
      const kinds = DISTRICTS[dist];
      chunks.get(key).push([i, j, kinds[seed % kinds.length], seed, dist === 'cbd']);
    }
  }
  let blocks = 0;
  for (const cells of chunks.values()) {
    const hi = new MeshBuilder({ lod: 1 });
    const lo = new MeshBuilder({ lod: 2 });
    for (const [i, j, kind, seed, cbd] of cells) {
      drawBlock(hi, i, j, kind, seed, cbd);
      drawBlock(lo, i, j, kind, seed, cbd);
      blocks++;
    }
    const g = hi.build();
    g.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.geometry.computeBoundingSphere(); } });
    const low = lo.build();
    const proxy = makeShadowProxy(low);
    proxy.geometry.computeBoundingSphere();
    low.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
    group.add(g, proxy);
  }
  return { group, blocks, chunks: chunks.size };
}
