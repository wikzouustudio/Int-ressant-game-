import * as THREE from 'three';
import { MeshBuilder, rng } from './builder.js';
import { makeShadowProxy } from './buildings.js';
import { PAL, shade, awning, pot, bench, cafeTable } from './kit.js';
import { LOTS, FIELDS } from '../world/citymap.js';
import { HOUSES } from './houses.js';

// Building models for the districts around the playable city. Kept deliberately lean
// (window bands instead of single windows on tall buildings) because there are a few
// hundred of them; they are merged per spatial chunk with a near / far level of detail.

const WALLS = ['#f2d6b3', '#e8c4a0', '#cfe1f2', '#f6e3a8', '#d9ead3', '#f3c9c0', '#e3d5f0', '#efe9df', '#c9dbe6'];
const ACC = ['#e0573f', '#4b8fd8', '#3bb3a8', '#f2a541', '#8b5cf6', '#e86aa1'];
const ROOF = ['#d86a4a', '#b4513a', '#8a94a3', '#6b7584', '#a0522d'];
const pick = (r, a) => a[(r() * a.length) | 0];
const litC = (r) => (r() > 0.45 ? (r() > 0.5 ? '#ffe3a3' : '#d6ecff') : '#3e5874');

/** Window band wrapping a whole floor: 1 box instead of a dozen windows. */
function band(b, w, d, y, h, color) {
  b.box(w + 0.08, h, d + 0.08, color, { y, mat: 'lit', sharp: true });
}
function windows(b, w, y, z, n, r, ry = 0, x0 = 0) {
  b.group({ x: x0, z, ry }, () => {
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + (k + 0.5) * (w / n);
      b.box(0.9, 1.1, 0.1, PAL.white, { x, y: y - 0.08, sharp: true });
      b.box(0.7, 0.92, 0.14, litC(r), { x, y, mat: 'lit', sharp: true });
    }
  });
}
function lawnPad(b, w, d, color = '#7cbc4f') {
  b.box(w, 0.1, d, color, { sharp: true });
}
function hedge(b, w, d, gapW = 2.4) {
  const h = 0.9, t = 0.6, g = '#3f8f45';
  b.box(t, h, d, g, { x: -w / 2 + t / 2, r: 0.25 });
  b.box(t, h, d, g, { x: w / 2 - t / 2, r: 0.25 });
  b.box(w, h, t, g, { z: -d / 2 + t / 2, r: 0.25 });
  const side = (w - gapW) / 2;
  b.box(side, h, t, g, { x: -w / 2 + side / 2, z: d / 2 - t / 2, r: 0.25 });
  b.box(side, h, t, g, { x: w / 2 - side / 2, z: d / 2 - t / 2, r: 0.25 });
}
function car(b, x, z, ry, color) {
  b.group({ x, z, ry }, () => {
    b.rbox(3.2, 0.78, 1.55, 0.34, color, { y: 0.28, mat: 'soft' });
    b.rbox(1.8, 0.68, 1.4, 0.3, '#bfe3ff', { x: -0.2, y: 0.92, mat: 'glass' });
  });
}
const CAR_COLS = ['#e0573f', '#4b8fd8', '#f2c14e', '#f8f9fa', '#2e3440', '#3bb3a8', '#8b5cf6'];

// Each model draws a lot of size (w × d) centred at the origin, street side towards +z.
const MODELS = {
  // ---------------- old town (pedestrian zone) ----------------
  oldtown(b, r, w, d) {
    const wall = pick(r, WALLS), acc = pick(r, ACC);
    const floors = 3 + ((r() * 2) | 0);
    const fh = 2.6, H = 0.4 + floors * fh;
    b.box(w - 0.2, H, d - 0.4, wall, { r: 0.14 });
    // arcade ground floor (Lauben)
    b.box(w - 0.1, 0.35, d - 0.3, shade(wall, 0.86), { y: 2.9, r: 0.08 });
    for (let k = 0; k < 3; k++) {
      const x = -w / 2 + (k + 0.5) * (w / 3);
      b.box(w / 3 - 1.0, 2.3, 0.14, '#bfe3ff', { x, y: 0.35, z: d / 2 - 0.15, mat: 'lit', sharp: true });
    }
    awning(b, { y: 2.6, z: d / 2 - 0.1, w: w - 0.8, depth: 1.0, colors: ['#ffffff', acc] });
    for (let f = 1; f < floors; f++) windows(b, w - 1.4, 0.95 + f * fh, d / 2 - 0.15, Math.max(2, Math.round(w / 2.6)), r);
    // steep tiled roof, gable to the street, with a dormer
    b.prism(d - 0.2, 3.4, w + 0.4, pick(r, ROOF), { y: H, ry: Math.PI / 2 });
    if (r() < 0.6) b.box(1.3, 1.2, 1.4, wall, { y: H + 0.6, z: d / 4, r: 0.1 });
    b.box(0.6, 1.4, 0.6, '#b4513a', { x: w / 4, y: H + 1.2, z: -d / 4, r: 0.08 });
    if (r() < 0.5) pot(b, { x: w / 2 - 0.6, z: d / 2 + 0.6, flower: pick(r, ['#ff6b9a', '#ffd43b', '#b197fc']) });
  },
  cafe(b, r, w, d) {
    const wall = pick(r, ['#fbf7ef', '#f6e3a8', '#f3c9c0']);
    b.box(w - 0.4, 3.8, d - 3.2, wall, { z: -1.4, r: 0.15 });
    b.box(w - 1.6, 2.2, 0.14, '#bfe3ff', { y: 0.4, z: -1.4 + (d - 3.2) / 2, mat: 'lit', sharp: true });
    b.prism(w, 2.0, d - 2.6, PAL.tile, { y: 3.8, z: -1.4 });
    awning(b, { y: 3.0, z: -1.4 + (d - 3.2) / 2, w: w - 0.8, depth: 1.6, colors: ['#ffffff', pick(r, ACC)] });
    for (let k = 0; k < 2; k++) cafeTable(b, { x: -2.2 + k * 4.4, z: d / 2 - 1.2, chair: pick(r, ACC) });
  },
  fountain(b) {
    b.cyl(5.5, 5.8, 0.6, '#d6d0c6', {}, 28);
    b.cyl(5.0, 5.0, 0.1, '#5cc8f0', { y: 0.52, mat: 'soft' }, 28);
    b.cyl(0.5, 0.7, 2.6, '#c9c3b8', { y: 0.5 }, 12);
    b.cyl(1.6, 1.2, 0.4, '#d6d0c6', { y: 3.0 }, 16);
    b.cyl(0.25, 0.3, 1.6, '#c9c3b8', { y: 3.3 }, 10);
    b.sphere(0.5, '#e0573f', { y: 5.2, mat: 'soft' }, 12, 8);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      bench(b, { x: Math.sin(a) * 8.6, z: Math.cos(a) * 8.6, ry: a + Math.PI });
      if (k % 2) {
        b.box(1.6, 0.6, 1.6, '#c9c3b8', { x: Math.sin(a + 0.4) * 10.5, z: Math.cos(a + 0.4) * 10.5, r: 0.12 });
        b.blob(1.0, '#4ca346', { x: Math.sin(a + 0.4) * 10.5, y: 1.2, z: Math.cos(a + 0.4) * 10.5 }, 1);
      }
    }
  },
  church(b) {
    const wall = '#f1ece2';
    b.box(12, 9, 18, wall, { z: -2, r: 0.2 });
    b.prism(18.4, 5.5, 12.6, '#8a94a3', { y: 9, z: -2, ry: Math.PI / 2 });
    for (let k = 0; k < 4; k++) {
      for (const x of [-6.05, 6.05]) b.box(0.14, 4.4, 1.6, '#9cc9f0', { x, y: 2.6, z: -8 + k * 4.2, mat: 'lit', sharp: true });
    }
    // clock tower over the entrance
    b.box(5.2, 20, 5.2, wall, { z: 8.2, r: 0.2 });
    b.box(5.5, 0.4, 5.5, '#d6d0c6', { y: 14, z: 8.2, r: 0.1 });
    for (const [ry, ox, oz] of [[0, 0, 2.62], [Math.PI / 2, 2.62, 0], [-Math.PI / 2, -2.62, 0], [Math.PI, 0, -2.62]]) {
      b.cyl(1.3, 1.3, 0.14, '#fbf7ef', { x: ox, y: 16.5, z: 8.2 + oz, rx: Math.PI / 2, ry }, 20);
      b.box(0.12, 1.0, 0.1, PAL.dark, { x: ox, y: 16.5, z: 8.2 + oz * 1.03, ry, sharp: true });
      b.box(1.1, 2.4, 0.2, '#3e5874', { x: ox, y: 11, z: 8.2 + oz, ry, r: 0.06 });
    }
    b.cone(4.0, 9, '#3f8f6a', { y: 20, z: 8.2 }, 4);
    b.sphere(0.4, '#f2c14e', { y: 29.3, z: 8.2, mat: 'gold' }, 10, 8);
    b.box(2.4, 3.4, 0.3, PAL.woodD, { y: 0, z: 10.85, r: 0.1 });
  },
  // ---------------- business district ----------------
  tower(b, r, w) {
    const floors = 10 + ((r() * 14) | 0);
    const fh = 2.2;
    const glass = pick(r, ['#6fa3d8', '#7fb6c9', '#8aa9d6', '#5f8fbf', '#9fb7c9']);
    const frame = pick(r, ['#f1f3f5', '#d6dbe0', '#2e3440', '#c9b79c']);
    const s = w - 3;
    b.box(w, 0.4, w, '#d6d0c6', { r: 0.12 });
    b.box(s, 3.4, s, '#9cc9f0', { y: 0.4, mat: 'glass', r: 0.25 });
    let y = 3.8, cur = s;
    for (let f = 0; f < floors; f++) {
      if (f === Math.floor(floors * 0.7) && r() < 0.6) cur -= 1.6; // setback
      b.box(cur, fh, cur, frame, { y, r: 0.2 });
      band(b, cur - 0.2, cur - 0.2, y + 0.45, fh - 0.75, f % 3 === 0 ? glass : litC(r) === '#3e5874' ? glass : '#d6ecff');
      y += fh;
    }
    b.box(cur + 0.3, 0.5, cur + 0.3, frame, { y, r: 0.15 });
    b.box(cur * 0.4, 1.8, cur * 0.4, '#adb5bd', { y: y + 0.5, r: 0.1 });
    if (r() < 0.5) {
      b.cyl(0.08, 0.08, 6, '#adb5bd', { y: y + 2.3 }, 6);
      b.sphere(0.18, '#ff2d2d', { y: y + 8.4, mat: 'neon' }, 6, 4);
    }
  },
  office(b, r, w, d) {
    const floors = 5 + ((r() * 6) | 0);
    const fh = 2.2;
    const wall = pick(r, ['#efe9df', '#d6dbe0', '#e8dcc8', '#cfd8e3']);
    b.box(w, 0.35, d, '#d6d0c6', { r: 0.1 });
    b.box(w - 2, 3.2, d - 2, '#9cc9f0', { y: 0.35, mat: 'glass', r: 0.2 });
    let y = 3.55;
    for (let f = 0; f < floors; f++) {
      b.box(w - 1, fh, d - 1, wall, { y, r: 0.15 });
      band(b, w - 1.2, d - 1.2, y + 0.5, fh - 0.9, litC(r) === '#3e5874' ? '#7fa8cf' : '#ffe9b8');
      y += fh;
    }
    b.box(w - 0.6, 0.4, d - 0.6, '#c9c3b8', { y, r: 0.12 });
    b.box(3, 1.2, 2, '#f1f3f5', { x: w / 4, y: y + 0.4, r: 0.1 });
    b.box(w * 0.5, 0.9, 0.3, pick(r, ACC), { y: 2.5, z: d / 2 - 0.9, r: 0.1 });
  },
  plaza(b, r, w, d) {
    b.box(w, 0.12, d, '#e3dccd', { sharp: true });
    b.box(1.2, 4.5, 1.2, '#9aa4b1', { mat: 'metal', r: 0.3, ry: 0.6 });
    b.ico(1.1, pick(r, ACC), { y: 5.4, mat: 'soft' }, 1);
    for (const [x, z] of [[-w / 2 + 2, -d / 2 + 2], [w / 2 - 2, -d / 2 + 2], [-w / 2 + 2, d / 2 - 2], [w / 2 - 2, d / 2 - 2]]) {
      b.box(2, 0.5, 2, '#c9c3b8', { x, z, r: 0.1 });
      b.blob(1.1, '#4ca346', { x, y: 1.3, z }, 1);
    }
    bench(b, { z: d / 2 - 2.5, ry: Math.PI });
  },
  station(b, r, w, d) {
    b.box(w, 0.6, d, '#c9c3b8', { r: 0.1 });
    b.box(w * 0.5, 8, d - 3, '#efe2c9', { y: 0.6, z: -1, r: 0.2 });
    windows(b, w * 0.5 - 2, 2.4, -1 + (d - 3) / 2, 6, r);
    windows(b, w * 0.5 - 2, 5.4, -1 + (d - 3) / 2, 6, r);
    b.box(w * 0.5 + 0.6, 0.6, d - 2.4, '#b4513a', { y: 8.6, z: -1, r: 0.15 });
    b.box(4.6, 11, 4.6, '#efe2c9', { x: w * 0.25 + 1.5, z: -1, r: 0.2 });
    b.cyl(1.3, 1.3, 0.14, '#fbf7ef', { x: w * 0.25 + 1.5, y: 9, z: 1.35, rx: Math.PI / 2 }, 20);
    b.box(0.1, 1.0, 0.1, PAL.dark, { x: w * 0.25 + 1.5, y: 8.6, z: 1.45, sharp: true });
    b.box(6, 1, 0.3, '#e0573f', { x: -4, y: 6.4, z: -1 + (d - 3) / 2 + 0.2, r: 0.1 });
    b.box(4.4, 0.6, 0.12, '#ffffff', { x: -4, y: 6.6, z: -1 + (d - 3) / 2 + 0.4, mat: 'neon', sharp: true });
    // platform canopy towards the tracks (−z)
    b.box(w, 0.25, 4, '#8a94a3', { y: 4, z: -d / 2 + 1.2, r: 0.08 });
    for (let x = -w / 2 + 2; x < w / 2; x += 6) b.box(0.25, 3.4, 0.25, PAL.dark, { x, y: 0.6, z: -d / 2 + 1.2, sharp: true, mat: 'metal' });
  },
  // ---------------- shopping ----------------
  shoprow(b, r, w, d) {
    const acc = pick(r, ACC);
    const wall = pick(r, ['#fbf7ef', '#efe9df', '#e3d5f0', '#d9ead3']);
    b.box(w, 4.6, d - 2, wall, { z: -1, r: 0.15 });
    const n = Math.max(2, Math.round(w / 6));
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + (k + 0.5) * (w / n);
      b.box(w / n - 1.0, 2.6, 0.14, '#bfe3ff', { x, y: 0.3, z: d / 2 - 2 + 0.05, mat: 'lit', sharp: true });
      b.box(w / n - 0.6, 0.8, 0.3, k % 2 ? acc : pick(r, ACC), { x, y: 3.3, z: d / 2 - 2 + 0.1, r: 0.12 });
    }
    b.box(w + 0.2, 0.35, d - 1.8, '#d6d0c6', { y: 4.6, z: -1, r: 0.1 });
    b.box(w, 0.25, 2.2, '#c9c3b8', { y: 3.2, z: d / 2 - 0.9, r: 0.06 });
    for (let x = -w / 2 + 1; x <= w / 2 - 1; x += 5) b.box(0.18, 3.2, 0.18, PAL.dark, { x, z: d / 2 - 0.1, sharp: true, mat: 'metal' });
  },
  bigbox(b, r, w, d) {
    const col = pick(r, ['#4b8fd8', '#e0573f', '#f2a541', '#3bb3a8', '#5f6875']);
    const D = 15;
    b.box(w, 0.06, d, '#5f6670', { sharp: true });
    b.box(w, 7.5, D, '#e9ecef', { z: -d / 2 + D / 2, r: 0.2 });
    b.box(w + 0.1, 1.6, D + 0.1, col, { y: 5.6, z: -d / 2 + D / 2, r: 0.1 });
    b.box(w * 0.4, 1.0, 0.2, '#ffffff', { y: 5.9, z: -d / 2 + D + 0.1, mat: 'neon', sharp: true });
    b.box(7, 3.2, 0.2, '#9cc9f0', { y: 0, z: -d / 2 + D + 0.05, mat: 'glass', sharp: true });
    b.box(9, 0.3, 3, col, { y: 3.4, z: -d / 2 + D + 1.4, r: 0.1 });
    // car park in front
    const pz0 = -d / 2 + D + 3.5;
    for (let x = -w / 2 + 2; x < w / 2 - 1; x += 2.8) {
      b.box(0.12, 0.02, 4.4, '#f8f9fa', { x, y: 0.06, z: pz0 + 3, sharp: true });
      b.box(0.12, 0.02, 4.4, '#f8f9fa', { x, y: 0.06, z: pz0 + 11, sharp: true });
      if (r() < 0.55) car(b, x + 1.4, pz0 + 3, Math.PI / 2 * (r() < 0.5 ? 1 : -1), pick(r, CAR_COLS));
      if (r() < 0.4) car(b, x + 1.4, pz0 + 11, Math.PI / 2 * (r() < 0.5 ? 1 : -1), pick(r, CAR_COLS));
    }
  },
  gas(b, r, w, d) {
    b.box(w, 0.08, d, '#8d939b', { sharp: true });
    b.box(9, 0.6, 7, '#f8f9fa', { y: 5, z: 1, r: 0.15 });
    b.box(9.1, 0.3, 7.1, '#e0573f', { y: 5.1, z: 1, r: 0.1 });
    for (const x of [-2.5, 2.5]) {
      b.box(0.4, 5, 0.4, '#f1f3f5', { x, z: 1, r: 0.1 });
      b.box(1.0, 1.6, 0.6, '#e0573f', { x, z: 2.4, r: 0.12 });
    }
    b.box(8, 3.4, 4.5, '#f8f9fa', { z: -d / 2 + 2.6, r: 0.15 });
    b.box(6, 2, 0.12, '#bfe3ff', { y: 0.4, z: -d / 2 + 4.9, mat: 'lit', sharp: true });
    b.box(1.2, 6, 0.3, '#e0573f', { x: w / 2 - 1, z: d / 2 - 1, r: 0.1 });
    b.box(1.0, 1.6, 0.34, '#ffffff', { x: w / 2 - 1, y: 4, z: d / 2 - 1, mat: 'neon', sharp: true });
  },
  mall(b, r, w, d) {
    b.box(w, 0.1, d, '#d9d3c7', { sharp: true });
    b.box(w - 2, 9, d - 8, '#eef1f4', { z: -3, r: 0.3 });
    band(b, w - 2.2, d - 8.2, 1.0, 2.6, '#bfe3ff');
    band(b, w - 2.2, d - 8.2, 5.2, 2.0, '#d6ecff');
    // glass atrium and entrance
    b.box(12, 12, 10, '#9cc9f0', { z: d / 2 - 9, mat: 'glass', r: 0.4 });
    b.sphere(6, '#bfe3ff', { y: 12, z: d / 2 - 9, sy: 0.45, mat: 'glass' }, 20, 8, Math.PI / 2);
    b.box(16, 1.6, 0.4, '#8b5cf6', { y: 9.4, z: d / 2 - 3.8, r: 0.15 });
    b.box(12, 0.9, 0.2, '#ffffff', { y: 9.8, z: d / 2 - 3.5, mat: 'neon', sharp: true });
    for (const x of [-w / 2 + 5, w / 2 - 5]) {
      b.box(6, 2, 4, '#c9c3b8', { x, y: 9, z: -6, r: 0.1 });
      b.box(5, 0.4, 3.5, '#5f6875', { x, y: 11, z: -6, r: 0.1, mat: 'metal' });
    }
    for (let k = 0; k < 6; k++) {
      b.box(1.8, 0.6, 1.8, '#c9c3b8', { x: -w / 2 + 4 + k * ((w - 8) / 5), z: d / 2 - 1.5, r: 0.1 });
      b.blob(1.0, '#4ca346', { x: -w / 2 + 4 + k * ((w - 8) / 5), y: 1.3, z: d / 2 - 1.5 }, 1);
    }
  },
  parking(b, r, w, d) {
    b.box(w, 0.08, d, '#5f6670', { sharp: true });
    for (let row = 0; row < 4; row++) {
      const z = -d / 2 + 4 + row * ((d - 8) / 3);
      for (let x = -w / 2 + 2; x < w / 2 - 1; x += 2.8) {
        b.box(0.12, 0.02, 4.2, '#f8f9fa', { x, y: 0.08, z, sharp: true });
        if (r() < 0.6) car(b, x + 1.4, z, Math.PI / 2 * (row % 2 ? 1 : -1), pick(r, CAR_COLS));
      }
    }
    for (const x of [-w / 2 + 0.8, w / 2 - 0.8]) for (let z = -d / 2 + 3; z < d / 2; z += 6) b.blob(0.9, '#4ca346', { x, y: 0.8, z }, 1);
  },
  // ---------------- industry ----------------
  warehouse(b, r, w, d) {
    const wall = pick(r, ['#c9c3b8', '#b8c4cc', '#d6c9b0', '#a9b4bf', '#c2cbb8']);
    b.box(w + 2, 0.08, d + 2, '#9aa1a8', { sharp: true });
    b.box(w, 7, d, wall, { r: 0.2 });
    const n = Math.max(2, Math.round(w / 8));
    for (let k = 0; k < n; k++) b.prism(d, 1.6, w / n, '#8a94a3', { x: -w / 2 + (k + 0.5) * (w / n), y: 7, ry: Math.PI / 2, sharp: true });
    for (let k = 0; k < n; k++) b.box(w / n - 1.2, 2.8, 0.14, '#5d6b7a', { x: -w / 2 + (k + 0.5) * (w / n), z: d / 2, r: 0.05 });
    b.box(w * 0.3, 0.9, 0.3, pick(r, ACC), { x: -w / 4, y: 5.2, z: d / 2 + 0.1, r: 0.1 });
    if (r() < 0.6) b.group({ x: w / 4, z: d / 2 + 4, ry: Math.PI / 2 }, () => {
      b.rbox(6, 2.6, 2.3, 0.15, '#f1f3f5', { x: -0.8, y: 0.7 });
      b.rbox(1.8, 2.2, 2.2, 0.3, pick(r, ACC), { x: 3, y: 0.7 });
    });
  },
  factory(b, r, w, d) {
    const wall = pick(r, ['#c98a4b', '#b8c4cc', '#d6c9b0', '#bfa58a']);
    b.box(w + 2, 0.08, d + 2, '#9aa1a8', { sharp: true });
    b.box(w * 0.65, 9, d, wall, { x: -w * 0.175, r: 0.2 });
    for (let k = 0; k < 4; k++) b.prism(d * 0.25, 2.2, w * 0.65, '#6b7584', { x: -w * 0.175, y: 9, z: -d * 0.375 + k * d * 0.25, sharp: true });
    band(b, w * 0.65 - 0.2, d - 0.2, 5.5, 1.4, '#ffe3a3');
    b.box(w * 0.3, 5, d * 0.6, shade(wall, 0.9), { x: w * 0.33, z: -d * 0.15, r: 0.2 });
    const cx = w * 0.33, cz = d * 0.25;
    b.cyl(1.1, 1.5, 18, '#c9c3b8', { x: cx, z: cz }, 14);
    for (let k = 0; k < 3; k++) b.cyl(1.25, 1.25, 0.6, k % 2 ? '#e0573f' : '#f8f9fa', { x: cx, y: 13 + k * 1.6, z: cz }, 14);
    b.cyl(1.6, 1.6, 0.8, '#5f6875', { x: w * 0.33 - 3, y: 5, z: -d * 0.2 }, 12);
    for (const px of [-w * 0.4, -w * 0.1]) b.cyl(0.25, 0.25, d * 0.9, '#9aa4b1', { x: px, y: 9.5, rx: Math.PI / 2, mat: 'metal' }, 8);
  },
  silo(b, r, w, d) {
    b.box(w, 0.08, d, '#9aa1a8', { sharp: true });
    const col = pick(r, ['#f1f3f5', '#d6dbe0', '#c9b79c']);
    for (const [x, z] of [[-3, -2.5], [3, -2.5], [0, 2.8]]) {
      b.cyl(2.6, 2.6, 13, col, { x, z }, 18);
      b.cone(2.7, 1.6, '#9aa4b1', { x, y: 13, z }, 18);
      for (let k = 1; k < 5; k++) b.torus(2.62, 0.08, shade(col, 0.85), { x, y: k * 2.6, z, rx: Math.PI / 2 }, Math.PI * 2, 4, 24);
    }
    b.box(1.2, 16, 1.2, '#5f6875', { x: 0, z: -0.2, mat: 'metal', sharp: true });
    b.box(7, 0.6, 0.8, '#5f6875', { y: 15, z: -0.2, mat: 'metal', sharp: true });
  },
  yard(b, r, w, d) {
    b.box(w, 0.08, d, '#8d939b', { sharp: true });
    const cols = ['#e0573f', '#4b8fd8', '#f2a541', '#3bb3a8', '#8b5cf6', '#5fb35a', '#c9c3b8'];
    for (let row = 0; row < 4; row++) for (let k = 0; k < 3; k++) {
      const h = 1 + ((r() * 3) | 0);
      for (let lvl = 0; lvl < h; lvl++) b.box(6, 2.4, 2.4, pick(r, cols), { x: -w / 2 + 4 + k * 6.8, y: lvl * 2.45, z: -d / 2 + 2.5 + row * 3.4, r: 0.08 });
    }
    for (const x of [-w / 2 + 0.5, w / 2 - 0.5]) b.box(0.5, 10, 0.5, '#ffc93c', { x, z: d / 2 - 1.5, r: 0.1 });
    b.box(w, 0.8, 0.8, '#ffc93c', { y: 10, z: d / 2 - 1.5, r: 0.12 });
  },
  plant(b, r, w, d) {
    b.box(w, 0.08, d, '#9aa1a8', { sharp: true });
    for (const x of [-9, 6]) {
      b.cyl(5.5, 7.2, 22, '#e3e6ea', { x, z: -2 }, 24);
      b.torus(5.55, 0.25, '#c9ced6', { x, y: 22, z: -2, rx: Math.PI / 2 }, Math.PI * 2, 4, 28);
    }
    b.box(10, 8, 7, '#c9c3b8', { x: 4, z: 7, r: 0.2 });
    band(b, 9.8, 6.8, 4, 1.4, '#ffe3a3');
    for (let k = 0; k < 3; k++) b.box(0.3, 12, 0.3, '#5f6875', { x: 13 + k * 0.01, z: -8 + k * 6, mat: 'metal', sharp: true });
  },
  // ---------------- housing ----------------
  chalet(b, r, w, d) {
    const wall = pick(r, ['#fbf7ef', '#f2e6d0', '#f6e3a8', '#e8dccb']);
    const wood = pick(r, ['#b86b31', '#9c5b2b', '#c27a3c']);
    lawnPad(b, w, d);
    hedge(b, w, d);
    b.box(1.4, 0.06, d / 2, '#d9cbb3', { y: 0.1, z: d / 4, sharp: true });
    const hw = Math.min(8.5, w - 2.5);
    b.group({ z: -1.2 }, () => {
      b.box(hw, 3, 6.5, wall, { r: 0.15 });
      b.box(hw, 2.6, 6.5, wood, { y: 3, r: 0.12 });
      b.prism(7.6, 2.4, hw + 1.6, '#8a5a3c', { y: 5.6, ry: Math.PI / 2 });
      b.box(hw + 0.4, 0.2, 1.1, wood, { y: 3.0, z: 3.7, r: 0.05 });
      for (let x = -hw / 2 + 0.4; x <= hw / 2 - 0.3; x += 0.7) b.box(0.1, 0.8, 0.1, wood, { x, y: 3.2, z: 4.15, sharp: true });
      windows(b, hw - 2, 1.2, 3.27, 2, r);
      windows(b, hw - 2, 4.0, 3.27, 3, r);
      b.box(1.0, 2.1, 0.14, '#7a4a28', { x: hw / 2 - 1.2, z: 3.27, r: 0.05 });
      for (const x of [-hw / 2 + 1, hw / 2 - 2.4]) b.box(1.0, 0.3, 0.3, '#e0573f', { x, y: 3.4, z: 4.25, r: 0.08 });
    });
    if (r() < 0.45) {
      b.box(3.6, 0.14, 2.4, '#d6d0c6', { x: w / 2 - 2.6, y: 0.08, z: -d / 2 + 2.2, r: 0.05 });
      b.box(3.0, 0.1, 1.8, '#5cc8f0', { x: w / 2 - 2.6, y: 0.12, z: -d / 2 + 2.2, mat: 'soft', sharp: true });
    } else car(b, -w / 2 + 2.2, d / 2 - 2.8, 0, pick(r, CAR_COLS));
  },
  villa(b, r, w, d) {
    lawnPad(b, w, d);
    hedge(b, w, d);
    b.box(1.6, 0.06, d / 2, '#e3dccd', { y: 0.1, z: d / 4, sharp: true });
    b.group({ z: -1.6 }, () => {
      b.box(9, 3.2, 7, '#fbf7ef', { x: -1, r: 0.2 });
      b.box(6, 3.0, 5.5, '#e9ecef', { x: 1.5, y: 3.2, z: -0.6, r: 0.2 });
      band(b, 8.8, 6.8, 0.6, 2.0, '#9cc9f0');
      band(b, 5.8, 5.3, 3.8, 1.8, '#9cc9f0');
      b.box(9.4, 0.25, 7.4, '#d6d0c6', { x: -1, y: 3.2, r: 0.08 });
      b.box(6.4, 0.25, 5.9, '#d6d0c6', { x: 1.5, y: 6.2, z: -0.6, r: 0.08 });
      b.box(4.5, 0.2, 2.6, PAL.woodL, { x: -3, y: 3.45, z: 2.2, sharp: true });
    });
    b.box(5.2, 0.14, 3, '#d6d0c6', { x: 2.5, y: 0.08, z: d / 2 - 3.2, r: 0.05 });
    b.box(4.6, 0.1, 2.4, '#4fc3f7', { x: 2.5, y: 0.12, z: d / 2 - 3.2, mat: 'soft', sharp: true });
  },
  rowhouse(b, r, w, d) {
    lawnPad(b, w, d);
    const n = 3, uw = w / n;
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + (k + 0.5) * uw;
      const wall = pick(r, WALLS);
      b.box(uw - 0.1, 5.4, 7, wall, { x, z: -1.6, r: 0.12 });
      b.prism(uw, 2.2, 7.8, pick(r, ROOF), { x, y: 5.4, z: -1.6 });
      windows(b, uw - 1.6, 1.2, 1.92, 2, r, 0, x);
      windows(b, uw - 1.6, 3.6, 1.92, 2, r, 0, x);
      b.box(0.9, 2.0, 0.14, pick(r, ACC), { x: x + uw / 2 - 1.0, z: 1.95, r: 0.04 });
      b.box(uw - 0.4, 0.8, 0.4, '#3f8f45', { x, z: d / 2 - 0.3, r: 0.2 });
    }
  },
  apartment(b, r, w, d) {
    const wall = pick(r, WALLS);
    const floors = 4 + ((r() * 4) | 0);
    b.box(w, 0.25, d, '#d6d0c6', { r: 0.08 });
    b.box(w - 1, 0.6 + floors * 2.6, d - 3, wall, { z: -0.8, r: 0.2 });
    for (let f = 0; f < floors; f++) {
      const y = 1.3 + f * 2.6;
      windows(b, w - 3, y, -0.8 + (d - 3) / 2, Math.round(w / 3), r);
      if (f > 0) for (let k = 0; k < 2; k++) b.box(3, 0.2, 1.1, PAL.white, { x: -w / 4 + k * w / 2, y: y - 0.55, z: -0.8 + (d - 3) / 2 + 0.55, r: 0.06 });
    }
    b.box(w - 0.6, 0.4, d - 2.6, '#c9c3b8', { y: 0.6 + floors * 2.6, z: -0.8, r: 0.1 });
    b.box(2.2, 2.3, 0.14, '#7a4a28', { z: -0.8 + (d - 3) / 2 + 0.02, r: 0.05 });
  },
  // ---------------- countryside ----------------
  barn(b, r, w, d) {
    b.box(w, 4.2, d - 2, '#a0522d', { z: -1, r: 0.15 });
    b.prism(w + 1, 3.2, d - 0.6, '#6b4a2b', { y: 4.2, z: -1 });
    b.box(3.4, 3.4, 0.14, '#f1ece2', { z: (d - 2) / 2 - 1 + 0.05, r: 0.05 });
    for (let k = 0; k < 3; k++) b.cyl(0.8, 0.8, 1.4, '#e2c56b', { x: -w / 2 + 1.5 + k * 1.9, y: 0.8, z: d / 2 - 0.6, rz: Math.PI / 2 }, 12);
  },
  farmhouse(b, r, w, d) {
    // big Bernese-style farmhouse: masonry ground floor, wooden upper floor, huge hipped roof
    b.box(w - 4, 3.2, d - 4, '#f1ece2', { r: 0.2 });
    b.box(w - 4, 3.4, d - 4, '#b86b31', { y: 3.2, r: 0.15 });
    windows(b, w - 8, 1.2, (d - 4) / 2 + 0.05, 5, r);
    windows(b, w - 8, 4.2, (d - 4) / 2 + 0.05, 6, r);
    b.prism(w + 1, 6.5, d + 1, '#6b4a2b', { y: 6.6 });
    for (let k = 0; k < 5; k++) b.box(1.0, 0.3, 0.3, '#e0573f', { x: -w / 2 + 4 + k * 3.2, y: 4.3, z: (d - 4) / 2 + 0.3, r: 0.08 });
    for (let k = 0; k < 4; k++) b.cyl(0.8, 0.8, 1.4, '#e2c56b', { x: w / 2 - 1.5, y: 0.8, z: -d / 2 + 2 + k * 1.9, rx: Math.PI / 2 }, 12);
  },
  stadium(b, r, w, d) {
    b.box(w, 0.1, d, '#4caf50', { sharp: true });
    const fw = w - 10, fd = d - 10;
    for (let k = 0; k < 8; k++) b.box(fw / 8, 0.12, fd, k % 2 ? '#43a047' : '#4caf50', { x: -fw / 2 + (k + 0.5) * (fw / 8), sharp: true });
    b.box(fw, 0.13, 0.15, '#ffffff', { z: fd / 2, sharp: true });
    b.box(fw, 0.13, 0.15, '#ffffff', { z: -fd / 2, sharp: true });
    b.box(0.15, 0.13, fd, '#ffffff', { x: fw / 2, sharp: true });
    b.box(0.15, 0.13, fd, '#ffffff', { x: -fw / 2, sharp: true });
    b.box(0.15, 0.13, fd, '#ffffff', { sharp: true });
    b.torus(3.5, 0.08, '#ffffff', { y: 0.14, rx: Math.PI / 2 }, Math.PI * 2, 4, 28);
    for (const x of [-fw / 2, fw / 2]) {
      for (const z of [-2.4, 2.4]) b.box(0.15, 2.4, 0.15, '#ffffff', { x, z, sharp: true });
      b.box(0.15, 0.15, 5, '#ffffff', { x, y: 2.4, sharp: true });
    }
    // grandstands
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) b.box(fw, 0.8, 1.2, k % 2 ? '#e0573f' : '#c9c3b8', { y: k * 0.8, z: s * (fd / 2 + 1.5 + k * 1.1), r: 0.06 });
      b.box(fw, 0.3, 5, '#8a94a3', { y: 4.6, z: s * (fd / 2 + 3.2), r: 0.06 });
    }
    for (const [x, z] of [[-w / 2 + 1, -d / 2 + 1], [w / 2 - 1, -d / 2 + 1], [-w / 2 + 1, d / 2 - 1], [w / 2 - 1, d / 2 - 1]]) {
      b.cyl(0.25, 0.3, 14, '#9aa4b1', { x, z, mat: 'metal' }, 8);
      b.box(2.4, 1.2, 0.4, '#fff6d6', { x, y: 14, z, mat: 'lit', r: 0.08 });
    }
  },
  playground(b, r, w, d) {
    b.box(w, 0.1, d, '#e9d8a6', { sharp: true });
    b.box(3, 0.2, 3, '#e0573f', { x: -3, y: 2.2, r: 0.08 });
    for (const [x, z] of [[-4.4, -1.4], [-1.6, -1.4], [-4.4, 1.4], [-1.6, 1.4]]) b.box(0.25, 2.2, 0.25, '#4b8fd8', { x, z, sharp: true });
    b.box(1.2, 0.15, 4.5, '#f2c14e', { x: -0.3, y: 1.1, z: 2.6, rx: -0.45, r: 0.06 });
    b.box(0.2, 2.8, 0.2, '#3bb3a8', { x: 2.5, z: -2, sharp: true });
    b.box(0.2, 2.8, 0.2, '#3bb3a8', { x: 5.5, z: -2, sharp: true });
    b.box(3.4, 0.2, 0.2, '#3bb3a8', { x: 4, y: 2.8, z: -2, sharp: true });
    b.box(0.8, 0.1, 0.4, '#e86aa1', { x: 3.3, y: 0.8, z: -2, r: 0.04 });
    b.box(0.8, 0.1, 0.4, '#e86aa1', { x: 4.7, y: 0.8, z: -2, r: 0.04 });
    b.cyl(1.6, 1.6, 0.3, '#f2e6c1', { x: 3.8, z: 2.4 }, 16);
    bench(b, { x: 0, z: -d / 2 + 1, ry: 0 });
  },
};

Object.assign(MODELS, HOUSES);

// ---------------- small objects for the map editor ----------------
Object.assign(MODELS, {
  bush(b, r) {
    const c = pick(r, ['#4ca346', '#3f8f45', '#5cb84a', '#6aa84f']);
    b.blob(0.9, c, { y: 0.6, sy: 0.8 }, 1);
    b.blob(0.6, shade(c, 1.12), { x: 0.6, y: 0.45, z: 0.2, sy: 0.8 }, 1);
    if (r() < 0.5) for (let k = 0; k < 4; k++) b.sphere(0.1, pick(r, ['#ff6b9a', '#ffd43b', '#ffffff']), { x: Math.cos(k * 1.6) * 0.7, y: 1.0, z: Math.sin(k * 1.6) * 0.7 }, 6, 4);
  },
  rock(b, r) {
    b.blob(1.1, pick(r, ['#8d939b', '#a3a9b0', '#7b8189']), { y: 0.4, sy: 0.6, ry: r() * 3 }, 1);
    b.blob(0.6, '#9aa0a8', { x: 0.9, y: 0.2, z: 0.3, sy: 0.6 }, 1);
  },
  bench(b) { bench(b, {}); },
  lamp(b) {
    b.cyl(0.22, 0.3, 0.4, '#2b2f36', { mat: 'metal' }, 8);
    b.cyl(0.08, 0.11, 4.6, '#2b2f36', { mat: 'metal' }, 8);
    b.box(1.1, 0.08, 0.08, '#2b2f36', { x: -0.5, y: 4.55, mat: 'metal', sharp: true });
    b.cyl(0.25, 0.35, 0.3, '#2b2f36', { x: -1.0, y: 4.35, mat: 'metal' }, 8);
    b.sphere(0.24, '#fff0c8', { x: -1.0, y: 4.3, mat: 'lit' }, 8, 6);
  },
  car(b, r) { car(b, 0, 0, Math.PI / 2, pick(r, CAR_COLS)); },
  flowers(b, r) {
    b.box(3, 0.4, 1.4, '#b9ad98', { r: 0.12 });
    b.box(2.8, 0.06, 1.2, '#5b3a1e', { y: 0.36, sharp: true });
    for (let k = 0; k < 7; k++) b.blob(0.26, pick(r, ['#ff6b9a', '#ffd43b', '#ffffff', '#b197fc', '#ff922b']), { x: -1.2 + k * 0.4, y: 0.5, z: (k % 2) * 0.3 - 0.15 }, 1);
  },
  busstop(b) {
    b.box(2.6, 0.1, 0.9, '#5f6875', { y: 2.3, r: 0.04 });
    for (const x of [-1.2, 1.2]) b.box(0.08, 2.3, 0.08, '#5f6875', { x, z: -0.35, sharp: true });
    b.box(2.4, 1.6, 0.04, '#cfe6ef', { y: 0.5, z: -0.4, mat: 'glass', sharp: true });
    b.box(1.6, 0.1, 0.3, '#c98a4b', { y: 0.45, z: -0.15, r: 0.03 });
    b.box(0.6, 0.6, 0.06, '#f2c14e', { x: 1.0, y: 2.45, z: -0.4, mat: 'lit', sharp: true });
  },
  hedgerow(b) { b.box(6, 1.0, 0.8, '#3f8f45', { r: 0.3 }); },
  kiosk(b, r) {
    const c = pick(r, ACC);
    b.box(3, 2.4, 2.4, '#fbf7ef', { r: 0.15 });
    b.box(2.4, 1.0, 0.1, '#bfe3ff', { y: 0.9, z: 1.22, mat: 'lit', sharp: true });
    awning(b, { y: 2.2, z: 1.2, w: 3.2, depth: 0.9, colors: ['#ffffff', c] });
    b.box(3.3, 0.3, 2.7, c, { y: 2.4, r: 0.1 });
  },
});

function drawLot(b, lot) {
  const r = rng(lot.seed);
  b.group({ x: lot.x, z: lot.z, ry: lot.ry, s: lot.s || 1 }, () => MODELS[lot.kind](b, r, lot.w, lot.d));
}

/** One object as its own mesh group (map editor preview), centred on the origin. */
export function buildObjectModel(obj, lod = 2) {
  const b = new MeshBuilder({ lod, uv: false });
  drawLot(b, { ...obj, x: 0, z: 0, ry: 0 });
  const g = b.build();
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.geometry.computeBoundingBox(); } });
  return g;
}
export const hasModel = (kind) => !!MODELS[kind];

/**
 * All district buildings, merged per 110 m chunk with two levels of detail
 * (near: LOD 1, far: LOD 2) and a low-poly shadow caster.
 */
export function buildDistricts() {
  const group = new THREE.Group();
  const CH = 110;
  const map = new Map();
  for (const lot of LOTS) {
    if (!MODELS[lot.kind]) continue;
    const key = `${Math.floor(lot.x / CH)},${Math.floor(lot.z / CH)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(lot);
  }
  const chunks = [];
  for (const lots of map.values()) {
    const hi = new MeshBuilder({ lod: 2, uv: false });
    const lo = new MeshBuilder({ lod: 3, uv: false });
    const center = new THREE.Vector3();
    for (const lot of lots) { drawLot(hi, lot); drawLot(lo, lot); center.x += lot.x; center.z += lot.z; }
    center.divideScalar(lots.length);
    let radius = 0;
    for (const lot of lots) radius = Math.max(radius, Math.hypot(lot.x - center.x, lot.z - center.z) + Math.max(lot.w, lot.d));
    const near = hi.build();
    const far = lo.build({ castShadow: false });
    const proxy = makeShadowProxy(far);
    for (const g of [near, far]) g.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.geometry.computeBoundingSphere(); } });
    proxy.geometry.computeBoundingSphere();
    far.visible = false;
    group.add(near, far, proxy);
    chunks.push({ near, far, proxy, center, radius, low: false });
  }
  // farmland strips
  const fb = new MeshBuilder({ lod: 2, uv: false });
  for (const f of FIELDS) {
    fb.group({ x: f.x, z: f.z, ry: f.ry }, () => {
      fb.box(f.w, 0.12, f.d, f.color, { sharp: true });
      for (let z = -f.d / 2 + 1; z < f.d / 2; z += 1.6) fb.box(f.w - 0.6, 0.1, 0.35, shade(f.color, 0.86), { y: 0.1, z, sharp: true });
    });
  }
  const fields = fb.build({ castShadow: false });
  group.add(fields);
  return {
    group,
    chunks,
    /** Swap chunk LODs by distance to the camera (hysteresis avoids flicker). */
    update(cam, nearDist) {
      for (const c of chunks) {
        const d = Math.hypot(c.center.x - cam.x, c.center.z - cam.z) - c.radius;
        const low = c.low ? d > nearDist - 15 : d > nearDist + 15;
        if (low !== c.low) { c.low = low; c.near.visible = !low; c.far.visible = low; }
      }
    },
  };
}
