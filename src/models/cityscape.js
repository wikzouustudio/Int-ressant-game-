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
      b.box(W + 0.1, 0.12, D + 0.1, shade(wall, 0.85), { y: 3.1 + f * fh, z: -1, sharp: true });
      if (f % 2 === 1) b.box(3, 0.16, 1.0, PAL.white, { x: -2.2, y: y - 0.35, z: -1 + D / 2 + 0.5, r: 0.05 });
    }
    // ground floor shop
    b.box(W - 2, 1.9, 0.12, '#bfe3ff', { y: 0.6, z: -1 + D / 2 + 0.03, mat: 'lit', sharp: true });
    b.box(1.2, 2.2, 0.14, PAL.woodD, { x: W / 2 - 1.4, y: 0.3, z: -1 + D / 2 + 0.05, sharp: true });
    awning(b, { y: 2.85, z: -1 + D / 2 + 0.05, w: W - 1.2, depth: 1.1, colors: ['#ffffff', acc] });
    // roof
    b.box(W + 0.3, 0.35, D + 0.3, PAL.white, { y: H + 0.3, z: -1, r: 0.12 });
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

  tower(b, r) {
    const floors = 7 + ((r() * 7) | 0);
    const fh = 1.8;
    const lit = litColor(r);
    b.box(9.4, 0.4, 9.4, '#cfd4da', { z: -1, r: 0.15 });
    b.box(8.4, 2.6, 8.4, '#9cc9f0', { y: 0.4, z: -1, mat: 'glass', r: 0.2 });
    let y = 3;
    for (let f = 0; f < floors; f++) {
      b.box(8.6, 0.25, 8.6, PAL.white, { y, z: -1, sharp: true });
      b.box(8.2, fh - 0.25, 8.2, '#6fa3d8', { y: y + 0.25, z: -1, mat: 'glass', sharp: true });
      for (const [ry, ox, oz] of [[0, 0, 4.12], [Math.PI / 2, 4.12, 0], [-Math.PI / 2, -4.12, 0]]) {
        b.group({ x: ox, y: y + 0.55, z: -1 + oz, ry }, () => {
          for (let k = 0; k < 4; k++) if (r() > 0.4) b.box(1.5, fh - 0.75, 0.05, lit(k), { x: -2.9 + k * 1.95, mat: 'lit', sharp: true });
        });
      }
      y += fh;
    }
    b.box(8.8, 0.45, 8.8, PAL.white, { y, z: -1, r: 0.15 });
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
    b.box(11.3, 0.3, 7.8, PAL.white, { y: H, z: -1.6, r: 0.1 });
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

const KINDS = ['apartment', 'apartment', 'townhouses', 'tower', 'shop', 'park', 'apartment', 'shop'];

function drawBlock(b, i, j, kind, seed) {
  const r = rng(seed);
  const ry = [0, Math.PI / 2, Math.PI, -Math.PI / 2][(Math.abs(i * 7 + j * 3)) % 4];
  b.group({ x: i * CELL, z: j * CELL }, () => {
    b.box(PAD, PAD_Y - 0.02, PAD, '#c4bcad', { sharp: true });
    if (kind !== 'park') b.box(PAD - 0.7, 0.04, PAD - 0.7, '#d9d3c7', { y: PAD_Y - 0.03, sharp: true });
    b.group({ y: PAD_Y, ry: kind === 'park' ? 0 : ry }, () => BLOCKS[kind](b, r));
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
      chunks.get(key).push([i, j, KINDS[seed % KINDS.length], seed]);
    }
  }
  let blocks = 0;
  for (const cells of chunks.values()) {
    const hi = new MeshBuilder({ lod: 1 });
    const lo = new MeshBuilder({ lod: 2 });
    for (const [i, j, kind, seed] of cells) {
      drawBlock(hi, i, j, kind, seed);
      drawBlock(lo, i, j, kind, seed);
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
