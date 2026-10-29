import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshBuilder, rng, disposeObject } from './builder.js';
import { SHADOW_PROXY_MAT } from './materials.js';
import { drawIcon } from '../ui/icons.js';
import {
  PAL, shade, plankBox, win, roundWin, door, stairs, awning, balcony, pergola, ac, pipe, barrel, crate, bin,
  rollDoor, tileRoof, flatRoof, tinRoof, chimney, lamp, bush, pot, bench, chalkboard, cafeTable, stringLights,
} from './kit.js';

const WOOD = PAL.woodL;
const WOOD_D = PAL.woodD;
const WHITE = PAL.white;

// ---------------------------------------------------------------------------
// Reusable props
// ---------------------------------------------------------------------------
function car(b, o, color = '#e63946') {
  b.group(o, () => {
    b.rbox(3.6, 0.85, 1.75, 0.38, color, { y: 0.35, mat: 'soft' });
    b.rbox(2.1, 0.8, 1.55, 0.36, '#bfe3ff', { x: -0.2, y: 1.0, mat: 'glass' });
    b.rbox(2.0, 0.14, 1.6, 0.07, color, { x: -0.2, y: 1.74, mat: 'soft' });
    b.box(0.12, 0.8, 1.6, color, { x: -0.2, y: 1.0, mat: 'soft' });
    for (const [x, z] of [[1.15, 0.85], [-1.15, 0.85], [1.15, -0.85], [-1.15, -0.85]]) {
      b.cyl(0.44, 0.44, 0.34, '#22262d', { x, y: 0.44, z: z - Math.sign(z) * 0.17, rx: Math.PI / 2 }, 16);
      b.cyl(0.22, 0.22, 0.36, '#d0d5dc', { x, y: 0.44, z: z - Math.sign(z) * 0.18, rx: Math.PI / 2, mat: 'metal' }, 12);
    }
    b.box(0.1, 0.24, 0.42, '#fff7cc', { x: 1.78, y: 0.72, z: 0.52, mat: 'lit' });
    b.box(0.1, 0.24, 0.42, '#fff7cc', { x: 1.78, y: 0.72, z: -0.52, mat: 'lit' });
    b.box(0.1, 0.2, 0.36, '#ff3030', { x: -1.78, y: 0.72, z: 0.55, mat: 'lit' });
    b.box(0.1, 0.2, 0.36, '#ff3030', { x: -1.78, y: 0.72, z: -0.55, mat: 'lit' });
    b.box(0.08, 0.16, 1.0, '#dfe3e8', { x: 1.84, y: 0.4, mat: 'metal' });
  });
}

function planter(b, o, flower = '#ff6b9a') {
  b.group(o, () => {
    b.box(1.6, 0.6, 0.7, '#b9ad98', { r: 0.15 });
    b.box(1.45, 0.1, 0.55, '#5b3a1e', { y: 0.55 });
    b.blob(0.45, PAL.greenD, { x: -0.4, y: 0.85 }, 1);
    b.blob(0.5, PAL.green, { x: 0.35, y: 0.9 }, 1);
    b.sphere(0.12, flower, { x: -0.2, y: 1.2, z: 0.15 }, 6, 4);
    b.sphere(0.12, flower, { x: 0.55, y: 1.25, z: 0.1 }, 6, 4);
    b.sphere(0.12, '#ffe066', { x: 0.1, y: 1.3, z: -0.1 }, 6, 4);
  });
}

function hangingSign(b, o, bg, ring) {
  b.group(o, () => {
    b.box(1.4, 0.12, 0.12, PAL.dark, { y: 1.0, z: 0.6, r: 0.04 });
    b.box(0.03, 0.3, 0.03, PAL.dark, { x: -0.35, y: 0.72, z: 1.0, sharp: true });
    b.box(0.03, 0.3, 0.03, PAL.dark, { x: 0.35, y: 0.72, z: 1.0, sharp: true });
    b.cyl(0.62, 0.62, 0.14, bg, { y: 0.1, z: 0.93, rx: Math.PI / 2 }, 24);
    b.torus(0.62, 0.06, ring, { y: 0.1 + 0.62, z: 1.07 - 0.07 }, Math.PI * 2, 8, 24);
  });
}

// ---------------------------------------------------------------------------
// Businesses — each faces +Z, footprint ~x[-5.6,5.6] z[-5.8,4.8], y=0 = pad top.
// ---------------------------------------------------------------------------
const MODELS = {
  lemonade(b, level, ctx) {
    // deck
    b.box(10, 0.3, 7, WOOD, { z: -0.8, r: 0.12 });
    for (let x = -4.5; x <= 4.5; x += 0.75) b.box(0.05, 0.02, 6.8, WOOD_D, { x, y: 0.3, z: -0.8, sharp: true });
    // kiosk body
    plankBox(b, 5.4, 3.3, 2.8, '#ffd35c', { y: 0.3, z: -1.8 });
    for (const x of [-2.7, 2.7]) b.box(0.28, 3.4, 0.28, WHITE, { x, y: 0.3, z: -0.4, r: 0.08 });
    b.box(6.3, 0.32, 3.9, '#f08a5d', { y: 3.6, z: -1.7, r: 0.15 });
    b.box(6.5, 0.12, 4.1, '#fbe3d0', { y: 3.6, z: -1.7, r: 0.05 });
    win(b, { x: -1.5, y: 1.7, z: -0.38, w: 1.2, h: 1.0, frame: WHITE, glass: '#fff3c4' });
    // counter
    plankBox(b, 5.4, 1.5, 1.5, WHITE, { y: 0.3, z: 0.55 });
    b.box(5.9, 0.18, 1.9, WOOD_D, { y: 1.8, z: 0.55, r: 0.08 });
    b.cyl(0.48, 0.48, 0.1, '#ffd35c', { y: 1.0, z: 1.3, rx: Math.PI / 2 }, 24);
    b.torus(0.48, 0.06, '#f08a5d', { y: 1.0 + 0.48 - 0.48, z: 1.4 }, Math.PI * 2, 8, 24);
    b.sphere(0.3, '#ffe135', { y: 1.0, z: 1.45, sx: 1.25, sz: 0.4 }, 12, 8);
    for (const x of [-2.6, 2.6]) b.cyl(0.08, 0.08, 1.8, WHITE, { x, y: 1.98, z: 1.3 }, 8);
    awning(b, { y: 3.65, z: -0.35, w: 6.2, depth: 2.1, colors: ['#ffffff', '#ffc93c'] });
    // giant lemon
    b.sphere(1.05, '#ffe135', { y: 4.95, z: -1.8, sx: 1.3 }, 20, 16);
    b.sphere(0.3, '#ffe135', { x: 1.38, y: 4.95, z: -1.8 }, 10, 8);
    b.sphere(0.3, '#ffe135', { x: -1.38, y: 4.95, z: -1.8 }, 10, 8);
    b.sphere(0.4, PAL.green, { x: -0.4, y: 5.95, z: -1.8, sx: 1.6, sy: 0.45, rz: 0.4 }, 12, 8);
    b.sphere(0.35, '#ffffff', { x: -0.5, y: 5.3, z: -0.9, sx: 1.4, sy: 0.6 }, 10, 8);
    // jars, cups
    for (let i = 0; i < 3; i++) {
      const x = -1.6 + i * 1.6;
      b.cyl(0.27, 0.27, 0.75, '#fff59d', { x, y: 1.98, z: 0.45, mat: 'glass' }, 14);
      b.cyl(0.22, 0.22, 0.5, ['#ffeb3b', '#ff8fab', '#a3e635'][i], { x, y: 2.0, z: 0.45, mat: 'neon' }, 12);
      b.cyl(0.29, 0.29, 0.1, WHITE, { x, y: 2.72, z: 0.45 }, 14);
      b.box(0.12, 0.08, 0.2, '#adb5bd', { x, y: 2.15, z: 0.75, mat: 'metal' });
    }
    for (let k = 0; k < 4; k++) b.cyl(0.13, 0.11, 0.12, '#f8f9fa', { x: 2.2, y: 1.98 + k * 0.1, z: 0.9 }, 10);
    // crates & barrel
    crate(b, { x: 3.9, y: 0.3, z: 1.4, fill: '#ffe135' });
    crate(b, { x: 3.9, y: 0.3, z: 0.2, ry: 0.2, fill: '#ffe135' });
    crate(b, { x: 3.9, y: 1.05, z: 0.8, ry: -0.1, fill: '#9ccc65' });
    barrel(b, { x: -4.2, y: 0.3, z: -3.4, color: '#f2b04b' });
    pot(b, { x: 3.8, y: 0.3, z: -3.4, flower: '#ff6b9a' });
    chalkboard(b, { x: 1.9, y: 0.3, z: 2.4, ry: -0.3 });
    // parasol table
    const parasol = (x, z, col) => {
      cafeTable(b, { x, y: 0.3, z, chair: '#ff8fab' });
      b.cyl(0.05, 0.05, 2.6, '#e9ecef', { x, y: 1.0, z, mat: 'metal' }, 6);
      b.cone(1.7, 0.75, col, { x, y: 3.2, z, mat: 'soft' }, 16);
      b.torus(1.66, 0.07, '#ffffff', { x, y: 3.22, z, rx: Math.PI / 2 }, Math.PI * 2, 6, 32);
      b.sphere(0.12, '#ffffff', { x, y: 3.98, z }, 8, 6);
    };
    parasol(-3.8, 1.2, '#ff6b6b');
    stringLights(b, [-3.8, 3.4, 1.2], [-2.7, 3.6, -0.4], 6, 0.3);
    if (level >= 3) parasol(-3.8, -2.2, '#4dabf7');
    if (level >= 5) {
      b.cyl(0.18, 0.26, 1.6, WOOD_D, { x: 3.9, y: 0.3, z: -2.0 }, 8);
      b.blob(1.15, PAL.greenD, { x: 3.9, y: 2.5, z: -2.0 }, 2);
      for (let i = 0; i < 6; i++) b.sphere(0.17, '#ffe135', { x: 3.9 + Math.cos(i) * 1.0, y: 2.4 + Math.sin(i * 3) * 0.5, z: -2 + Math.sin(i) * 0.9 }, 8, 6);
    }
    if (level >= 7) b.torus(1.7, 0.08, '#fff176', { y: 4.95, z: -1.8, mat: 'neon' }, Math.PI * 2, 6, 40);
    ctx.door = null;
    ctx.spots = { press: [3.9, 2.6, Math.PI], counter: [0, 2.3, Math.PI], tables: [-3.8, 2.9, Math.PI] };
  },

  bakery(b, level, ctx) {
    const blueH = level >= 6 ? 6.6 : 4.4;
    // plinth + ground floor (white planks)
    b.box(9.8, 0.35, 7.2, '#cfc5b4', { z: -1.8, r: 0.12 });
    plankBox(b, 9.2, 2.8, 6.6, PAL.plaster, { y: 0.35, z: -1.8, dir: 'h', step: 0.38 });
    b.box(9.5, 0.26, 6.9, WHITE, { y: 3.1, z: -1.8, r: 0.1 });
    // upper volumes: orange wood (left) + blue (right, taller)
    plankBox(b, 4.7, 2.5, 6.2, PAL.wood, { x: -2.25, y: 3.36, z: -1.9 });
    plankBox(b, 4.5, blueH, 6.2, PAL.blue, { x: 2.35, y: 3.36, z: -1.9 });
    for (const x of [-4.6, 0.1, 4.6]) b.box(0.26, 2.5, 0.26, WHITE, { x, y: 3.36, z: 1.2, r: 0.08 });
    // ground floor: door, shop windows, awnings
    door(b, { x: 0.3, y: 0.35, z: 1.5, w: 1.3, h: 2.25, color: PAL.wood, glass: true, steps: 2, lamp: true });
    win(b, { x: -2.6, y: 0.95, z: 1.5, w: 2.4, h: 1.45, frame: WHITE });
    for (let i = 0; i < 5; i++) b.sphere(0.17, i % 2 ? '#e9a54f' : '#cf7f32', { x: -3.4 + i * 0.4, y: 0.88, z: 1.85, sx: 1.6 }, 8, 6);
    awning(b, { x: -2.6, y: 2.85, z: 1.55, w: 3.1, depth: 1.05, colors: ['#ffffff', PAL.blue] });
    win(b, { x: 2.8, y: 1.0, z: 1.5, w: 1.6, h: 1.35, frame: WHITE, box: '#ff6b9a' });
    awning(b, { x: 2.8, y: 2.85, z: 1.55, w: 2.4, depth: 0.9, colors: ['#ffffff', '#e0573f'] });
    // upper left: balcony with two windows
    win(b, { x: -3.4, y: 3.85, z: 1.25, w: 1.0, h: 1.2, shutters: PAL.teal });
    win(b, { x: -1.2, y: 3.85, z: 1.25, w: 0.9, h: 1.3, frame: WHITE, box: level >= 3 ? '#ffd43b' : null });
    balcony(b, { x: -2.25, y: 3.36, z: 1.25, w: 4.5, d: 1.0, color: WOOD, plants: level >= 3 });
    // upper right (blue): porthole + small balcony window
    roundWin(b, { x: 2.35, y: 0, y0: 4.55, z: 1.25, r: 0.58 });
    win(b, { x: 2.35, y: 6.0, z: 1.25, w: 1.0, h: 1.2, frame: WHITE });
    if (blueH > 5) {
      balcony(b, { x: 2.35, y: 5.6, z: 1.25, w: 2.0, d: 0.75, color: WOOD });
      win(b, { x: 2.35, y: 8.1, z: 1.25, w: 1.0, h: 1.1, shutters: '#ffd35c' });
    } else {
      balcony(b, { x: 2.35, y: 5.6, z: 1.25, w: 2.0, d: 0.75, color: WOOD });
    }
    ac(b, { x: 4.62, y: 4.0, z: -0.6, ry: Math.PI / 2 });
    win(b, { x: 4.62, y: 4.2, z: -3.4, w: 1.0, h: 1.1, ry: Math.PI / 2 });
    win(b, { x: -4.62, y: 3.85, z: -2.0, w: 1.0, h: 1.1, ry: -Math.PI / 2, shutters: PAL.teal });
    // rooftop terrace with pergola on the orange volume
    flatRoof(b, { x: -2.25, y: 5.86, z: -1.9, w: 4.7, d: 6.2, color: '#c9b8a3' });
    pergola(b, { x: -2.25, y: 6.16, z: -1.4, w: 3.6, d: 3.2, color: PAL.metalD });
    bench(b, { x: -2.6, y: 6.16, z: -2.5 });
    pot(b, { x: -0.9, y: 6.16, z: 0.6, flower: '#ff6b9a' });
    pot(b, { x: -3.8, y: 6.16, z: 0.6 });
    if (level >= 4) stringLights(b, [-4.0, 8.0, 0.2], [-0.5, 8.0, 0.2], 9, 0.4);
    // blue volume roof + exhaust pipe (bakery oven) + drain pipe
    flatRoof(b, { x: 2.35, y: 3.36 + blueH, z: -1.9, w: 4.5, d: 6.2, color: PAL.roofD });
    const top = 3.36 + blueH;
    pipe(b, { x: 4.65, y: 3.4, z: -3.6, ry: Math.PI / 2, h: top - 2.4, cap: true });
    ctx.emitters.push(new THREE.Vector3(4.85, top + 1.3, -3.6));
    pipe(b, { x: -4.75, y: 0.35, z: 0.9, ry: -Math.PI / 2, h: 5.5, r: 0.1 });
    // hanging croissant sign
    hangingSign(b, { x: 4.4, y: 2.6, z: 0.9 }, '#5b3a29', '#e9a54f');
    b.torus(0.32, 0.14, '#e8a54b', { x: 4.4, y: 2.72, z: 1.95 }, Math.PI * 1.15, 10, 16);
    // street props
    cafeTable(b, { x: 4.0, y: 0, z: 3.0, chair: PAL.teal });
    crate(b, { x: -4.7, y: 0, z: 2.6, fill: '#d99045' });
    crate(b, { x: -4.7, y: 0.75, z: 2.6, s: 0.8, fill: '#e9b26a' });
    barrel(b, { x: -3.6, y: 0, z: 3.0 });
    bin(b, { x: 5.5, y: 0, z: 0.8, color: '#e8613f' });
    chalkboard(b, { x: 1.7, y: 0, z: 2.8, ry: -0.3 });
    ctx.door = { out: [0.3, 2.8], in: [0.3, 0.2] };
    ctx.spots = { shop: [-2.6, 2.75, Math.PI], terrace: [4.0, 4.3, Math.PI] };
    ctx.height = top + 1.5;
  },

  garage(b, level, ctx) {
    b.box(11.6, 0.3, 8.2, '#c9c3b8', { z: -2, r: 0.12 });
    plankBox(b, 11, 4.2, 7.6, PAL.blue, { y: 0.3, z: -2, step: 0.5 });
    b.box(11.1, 1.0, 7.7, PAL.plaster, { y: 0.3, z: -2, r: 0.1 });
    flatRoof(b, { y: 4.5, z: -2, w: 11, d: 7.6, color: PAL.roofD });
    // sign band
    b.box(7.6, 1.4, 0.4, '#e0573f', { y: 4.85, z: 1.0, r: 0.3 });
    b.box(7.1, 1.0, 0.1, '#22262d', { y: 5.05, z: 1.22, r: 0.05 });
    b.box(4.2, 0.16, 0.08, '#ffffff', { x: 0.8, y: 5.7, z: 1.29, mat: 'neon' });
    b.box(3.4, 0.16, 0.08, '#ffd43b', { x: 0.4, y: 5.35, z: 1.29, mat: 'neon' });
    b.cyl(0.36, 0.36, 0.08, '#ff6b6b', { x: -2.4, y: 5.55, z: 1.25, rx: Math.PI / 2, mat: 'neon' }, 16);
    for (const x of [-3, 3]) b.box(0.22, 0.5, 0.22, PAL.dark, { x, y: 4.6, z: 1.0, r: 0.06 });
    // bay 1 open with car, bay 2 roll door
    b.box(4.0, 3.0, 0.2, '#1f2329', { x: -2.6, y: 0.3, z: 1.72, sharp: true });
    b.box(4.4, 0.3, 0.3, WHITE, { x: -2.6, y: 3.3, z: 1.78, r: 0.08 });
    for (const x of [-4.75, -0.45]) b.box(0.3, 3.1, 0.3, WHITE, { x, y: 0.3, z: 1.78, r: 0.08 });
    car(b, { x: -2.6, y: 0.3, z: 1.0, ry: Math.PI / 2 + 0.05, s: 0.95 }, '#ffd43b');
    rollDoor(b, { x: 2.6, y: 0.3, z: 1.75, w: 3.6, h: 2.9, color: '#e0573f' });
    // side office window + AC + pipe
    win(b, { x: 5.52, y: 1.8, z: -0.6, w: 1.2, h: 1.1, ry: Math.PI / 2 });
    ac(b, { x: 5.52, y: 3.2, z: -2.6, ry: Math.PI / 2, s: 0.85 });
    pipe(b, { x: -5.52, y: 0.3, z: 0.5, ry: -Math.PI / 2, h: 4.5, r: 0.1 });
    // tyres, toolbox, barrels
    for (let i = 0; i < 3; i++) b.torus(0.5, 0.24, '#22262d', { x: 5.0, y: 0.24 + i * 0.46, z: 3.6, rx: Math.PI / 2 }, Math.PI * 2, 10, 18);
    b.box(1.3, 0.95, 0.65, '#e0573f', { x: 3.5, z: 3.6, r: 0.08 });
    for (let k = 0; k < 3; k++) b.box(1.2, 0.05, 0.05, '#a8242b', { x: 3.5, y: 0.25 + k * 0.25, z: 3.94, sharp: true });
    barrel(b, { x: -5.0, y: 0, z: 3.4, color: '#376fb0' });
    barrel(b, { x: -4.05, y: 0, z: 3.75, color: '#e0573f' });
    if (level >= 3) {
      b.box(0.9, 0.6, 0.6, '#ffd43b', { x: -2.6, y: 0, z: 3.7, r: 0.1 });
      b.cyl(0.05, 0.05, 0.6, PAL.dark, { x: -2.6, y: 0.6, z: 3.7 }, 6);
    }
    if (level >= 5) {
      b.box(0.9, 2.1, 0.7, '#e0573f', { x: 5.3, z: 1.8 + 0.5, r: 0.15 });
      b.box(0.6, 0.5, 0.06, '#c3fae8', { x: 5.3, y: 1.35, z: 2.86, mat: 'neon' });
      b.torus(0.25, 0.05, PAL.dark, { x: 5.75, y: 1.0, z: 2.4, ry: Math.PI / 2 }, Math.PI, 6, 10);
    }
    if (level >= 7) {
      b.cyl(0.1, 0.1, 2.0, '#adb5bd', { x: 4, y: 4.8, z: -4, mat: 'metal' }, 8);
      b.sphere(0.9, '#e9ecef', { x: 4, y: 6.8, z: -4, rx: -0.9, mat: 'metal' }, 16, 8, Math.PI * 0.35);
    }
    ctx.door = { out: [2.6, 2.7], in: [2.6, 0.4] };
    ctx.spots = { car: [-1.1, 1.95, -Math.PI / 2], tyres: [4.6, 4.7, Math.PI] };
  },

  office(b, level, ctx) {
    const floors = 3 + level;
    const fh = 1.7;
    const r = rng(level * 77 + 3);
    b.box(9.2, 0.4, 9.2, '#cfd4da', { z: -1.3, r: 0.15 });
    // lobby
    b.box(8, fh * 1.3, 8, '#9cc9f0', { y: 0.4, z: -1.3, mat: 'glass', r: 0.2 });
    b.box(4.4, 0.3, 2.6, WHITE, { y: 2.65, z: 3.5, r: 0.14 });
    for (const x of [-1.9, 1.9]) b.cyl(0.12, 0.12, 2.3, '#dee2e6', { x, y: 0.4, z: 4.5, mat: 'metal' }, 10);
    door(b, { x: 0, y: 0.4, z: 2.72, w: 1.8, h: 2.0, color: '#9cc9f0', frame: '#dee2e6', glass: true });
    let y = 0.4 + fh * 1.3;
    for (let f = 0; f < floors; f++) {
      const inset = f > floors - 3 ? 0.4 : 0;
      const W = 8.4 - inset;
      b.box(W + 0.2, 0.28, W + 0.2, WHITE, { y, z: -1.3, r: 0.12 });
      b.box(W - 0.4, fh - 0.28, W - 0.4, '#6fa3d8', { y: y + 0.28, z: -1.3, mat: 'glass', r: 0.15 });
      const half = (W - 0.4) / 2;
      for (let k = 0; k < 4; k++) {
        const on = r() > 0.35;
        const col = on ? (r() > 0.5 ? '#fff1c1' : '#d0ecff') : '#3d5f84';
        const off = -half + 1.0 + k * ((2 * half - 2.0) / 3);
        for (const [x, z, ry] of [[off, half, 0], [half, off, Math.PI / 2], [-half, off, -Math.PI / 2]]) {
          b.group({ x, y: y + 0.5, z: -1.3 + z, ry }, () => {
            b.box(1.2, fh - 0.75, 0.06, col, { mat: on ? 'lit' : 'glass', sharp: true });
            b.box(1.36, 0.1, 0.12, WHITE, { y: -0.08, sharp: true });
            b.box(0.08, fh - 0.75, 0.1, WHITE, { sharp: true });
          });
        }
      }
      if (f % 3 === 1) balcony(b, { x: -2.2, y: y + 0.1, z: -1.3 + half + 0.2, w: 2.6, d: 0.8, color: WHITE, rail: '#dee2e6', plants: true });
      y += fh;
    }
    for (const [x, z] of [[-4.15, 2.85], [4.15, 2.85], [-4.15, -5.45], [4.15, -5.45]]) b.box(0.4, y - 0.4, 0.4, WHITE, { x, y: 0.4, z, r: 0.15 });
    flatRoof(b, { y, z: -1.3, w: 8.4, d: 8.4, color: '#b8c0ca' });
    y += 0.4;
    ac(b, { x: -2.4, y, z: -3.6 });
    ac(b, { x: -2.4, y, z: -2.4 });
    if (level >= 4) {
      b.cyl(2.2, 2.2, 0.15, '#495057', { x: 1.6, y, z: -1.3 }, 28);
      b.torus(1.9, 0.07, '#ffd43b', { x: 1.6, y: y + 0.17, z: -1.3, rx: Math.PI / 2 }, Math.PI * 2, 6, 32);
      b.box(0.25, 0.04, 1.3, '#ffffff', { x: 1.25, y: y + 0.15, z: -1.3, sharp: true });
      b.box(0.25, 0.04, 1.3, '#ffffff', { x: 1.95, y: y + 0.15, z: -1.3, sharp: true });
      b.box(0.5, 0.04, 0.25, '#ffffff', { x: 1.6, y: y + 0.15, z: -1.3, sharp: true });
    } else {
      pergola(b, { x: 1.4, y, z: -1.3, w: 3, d: 3 });
      bench(b, { x: 1.4, y, z: -1.8 });
      pot(b, { x: 2.7, y, z: 0, flower: '#9775fa' });
    }
    b.cyl(0.07, 0.11, 3.5, '#adb5bd', { x: -3.4, y, z: 1.6, mat: 'metal' }, 8);
    b.sphere(0.16, '#ff2d2d', { x: -3.4, y: y + 3.55, z: 1.6, mat: 'neon' }, 8, 6);
    // logo
    b.box(3.2, 1.3, 0.3, WHITE, { y: y - 2.05, z: 2.95, r: 0.15 });
    b.octa(0.45, '#4cc9f0', { x: -0.9, y: y - 1.4, z: 3.15, mat: 'neon' });
    b.box(1.4, 0.2, 0.1, '#4361ee', { x: 0.35, y: y - 1.25, z: 3.12, mat: 'neon' });
    b.box(1.0, 0.2, 0.1, '#4361ee', { x: 0.15, y: y - 1.65, z: 3.12, mat: 'neon' });
    planter(b, { x: -3.5, y: 0.4, z: 4.0 });
    planter(b, { x: 3.5, y: 0.4, z: 4.0 }, '#9775fa');
    for (let k = 0; k < 3; k++) b.torus(0.32, 0.05, PAL.dark, { x: -4.9, y: 0.75, z: 2.0 - k * 0.6, ry: Math.PI / 2, mat: 'metal' }, Math.PI, 6, 10);
    ctx.door = { out: [0, 3.6], in: [0, 1.4] };
    ctx.spots = { plaza: [-2.6, 5.0, 0.6] };
    ctx.height = y + 3.5;
  },

  factory(b, level, ctx) {
    b.box(8.4, 0.35, 9, '#c9c3b8', { x: -1.8, z: -1.6, r: 0.12 });
    plankBox(b, 7.8, 4.8, 8.4, '#c8553d', { x: -1.8, y: 0.3, z: -1.6, dir: 'h', step: 0.34 });
    b.box(7.95, 0.4, 8.55, '#8f3d2b', { x: -1.8, y: 0.3, z: -1.6, r: 0.1 });
    b.box(7.95, 0.3, 8.55, WHITE, { x: -1.8, y: 5.0, z: -1.6, r: 0.1 });
    for (let i = 0; i < 4; i++) {
      b.prism(7.8, 1.7, 2.1, '#9aa4b1', { x: -1.8, y: 5.3, z: -4.75 + i * 2.1 });
      b.box(7.6, 1.15, 0.08, '#cfe8ff', { x: -1.8, y: 5.35, z: -3.75 + i * 2.1, mat: 'lit', sharp: true });
      b.cyl(0.12, 0.12, 7.9, '#7b8694', { x: -5.75, y: 7.0, z: -4.75 + i * 2.1 + 1.05 - 1.05, rz: -Math.PI / 2 }, 8);
    }
    for (let i = 0; i < 4; i++) win(b, { x: -4.6 + i * 1.9, y: 3.2, z: 2.6, w: 1.1, h: 1.0, frame: '#f1e3d3', glass: '#ffcf70' });
    rollDoor(b, { x: -1.8, y: 0.3, z: 2.6, w: 3.2, h: 2.6, color: '#5d6b7a' });
    for (let i = 0; i < 8; i++) b.box(0.4, 0.3, 0.1, i % 2 ? '#1f2328' : '#ffd43b', { x: -3.2 + i * 0.4, y: 3.35, z: 2.7, sharp: true });
    // chimneys
    const chimneyR = (x, z, h) => {
      b.cyl(0.6, 0.8, h, '#c1440e', { x, z }, 18);
      for (let k = 1; k < 4; k++) b.cyl(0.66 - k * 0.02, 0.68 - k * 0.02, 0.55, '#f8f9fa', { x, y: h - k * 1.6, z }, 18);
      b.torus(0.62, 0.14, '#3d3d3d', { x, y: h, z, rx: Math.PI / 2 }, Math.PI * 2, 8, 20);
      ctx.emitters.push(new THREE.Vector3(x, h + 0.6, z));
    };
    chimneyR(-4.2, -4.6, 9.8);
    chimneyR(-2.2, -4.8, 8.3);
    if (level >= 4) chimneyR(-0.2, -4.6, 10.8);
    // silos with ladders
    for (const z of [-3.6, -0.6]) {
      b.cyl(1.25, 1.25, 5.6, '#d6dce4', { x: 4.2, z, mat: 'metal' }, 24);
      b.sphere(1.25, '#e9ecef', { x: 4.2, y: 5.6, z, mat: 'metal' }, 24, 10, Math.PI / 2);
      for (let k = 0; k < 3; k++) b.torus(1.27, 0.07, '#868e96', { x: 4.2, y: 1.2 + k * 1.6, z, rx: Math.PI / 2, mat: 'metal' }, Math.PI * 2, 6, 28);
      for (const dz of [-0.25, 0.25]) b.box(0.06, 5.4, 0.06, '#5f6875', { x: 5.5, y: 0.2, z: z + dz, sharp: true });
      for (let y = 0.6; y < 5.4; y += 0.5) b.box(0.06, 0.06, 0.5, '#5f6875', { x: 5.5, y, z, sharp: true });
    }
    b.cyl(0.22, 0.22, 2.2, '#868e96', { x: 2.0, y: 4.2, z: -2.1, rz: -Math.PI / 2, mat: 'metal' }, 10);
    b.torus(0.5, 0.22, '#868e96', { x: 2.0, y: 4.7, z: -2.1, rx: 0, mat: 'metal' }, Math.PI / 2, 8, 10);
    ac(b, { x: -3.6, y: 5.3, z: 1.5, s: 0.9 });
    // pallets
    for (let i = 0; i < (level >= 3 ? 3 : 2); i++) {
      const x = 3.6 + (i % 2) * 1.4, z = 2.2 + Math.floor(i / 2) * -1.4;
      b.box(1.2, 0.16, 1.2, WOOD, { x, z, r: 0.04 });
      crate(b, { x, y: 0.16, z, color: '#c9a46a' });
    }
    // forklift
    b.group({ x: 1.4, y: 0, z: 3.9, ry: -0.5 }, () => {
      b.box(1.3, 0.8, 1.8, '#ffc93c', { y: 0.35, r: 0.2 });
      b.box(1.1, 0.8, 0.9, '#2e3440', { y: 1.15, z: -0.3, r: 0.15, mat: 'glass' });
      b.box(1.2, 0.1, 1.0, '#ffc93c', { y: 1.95, z: -0.3, r: 0.05 });
      b.box(0.1, 2.0, 0.1, PAL.metalD, { x: -0.4, y: 0.2, z: 1.0, sharp: true });
      b.box(0.1, 2.0, 0.1, PAL.metalD, { x: 0.4, y: 0.2, z: 1.0, sharp: true });
      b.box(0.12, 0.06, 0.9, PAL.metalD, { x: -0.3, y: 0.25, z: 1.5, sharp: true });
      b.box(0.12, 0.06, 0.9, PAL.metalD, { x: 0.3, y: 0.25, z: 1.5, sharp: true });
      for (const [x, z] of [[-0.66, 0.55], [0.66, 0.55], [-0.66, -0.55], [0.66, -0.55]]) b.cyl(0.3, 0.3, 0.22, '#22262d', { x, y: 0.3, z, rz: Math.PI / 2 }, 12);
    });
    if (level >= 6) b.cyl(1.6, 1.6, 3, '#4dabf7', { x: 4.2, y: 0, z: -5.2, mat: 'metal' }, 24);
    ctx.door = { out: [-1.8, 3.4], in: [-1.8, 1.0] };
    ctx.spots = { pallets: [4.3, 3.5, Math.PI] };
  },

  lab(b, level, ctx) {
    b.box(11, 0.3, 8, '#d6dde4', { z: -2.0, r: 0.15 });
    b.rbox(10.4, 3.6, 7.4, 0.6, '#f4f7fa', { y: 0.3, z: -2.0, mat: 'soft' });
    b.rbox(10.5, 0.45, 7.5, 0.2, '#2ec4b6', { y: 2.9, z: -2.0 });
    for (const x of [-3.5, 3.0]) roundWin(b, { x, y: 0, y0: 1.9, z: 1.68, r: 0.7, frame: '#2ec4b6', glass: '#bff6ff' });
    door(b, { x: -0.3, y: 0.3, z: 1.66, w: 1.6, h: 2.3, color: '#0f766e', frame: WHITE, glass: true, steps: 1, stepColor: '#d6dde4' });
    ac(b, { x: 3.6, y: 3.9, z: 0.6, s: 0.9 });
    ac(b, { x: 2.2, y: 3.9, z: 0.6, s: 0.9 });
    pipe(b, { x: 5.22, y: 0.3, z: -3.6, ry: Math.PI / 2, h: 4.6, color: '#94a3b8', cap: true });
    // dome
    b.cyl(3.3, 3.4, 0.6, '#e2e8f0', { x: -1.5, y: 3.9, z: -2.3, mat: 'soft' }, 32);
    b.sphere(3.1, '#9be7ff', { x: -1.5, y: 4.5, z: -2.3, mat: 'glass' }, 32, 16, Math.PI / 2);
    b.sphere(1.0, '#3cf2e0', { x: -1.5, y: 5.3, z: -2.3, mat: 'neon' }, 18, 14);
    const ring = new MeshBuilder();
    ring.torus(1.7, 0.08, '#7cfff0', { rx: Math.PI / 2, mat: 'neon' }, Math.PI * 2, 8, 48);
    ring.torus(1.4, 0.06, '#c084fc', { mat: 'neon' }, Math.PI * 2, 8, 48);
    const ringMesh = ring.build({ castShadow: false });
    ringMesh.position.set(-1.5, 5.3, -2.3);
    ctx.extra.push(ringMesh);
    ctx.animated.push((t) => { ringMesh.rotation.y = t * 0.9; ringMesh.rotation.x = Math.sin(t * 0.7) * 0.6; });
    // satellite dish
    b.cyl(0.18, 0.28, 1.6, '#cbd5e1', { x: 3.6, y: 3.9, z: -4, mat: 'metal' }, 10);
    b.sphere(1.5, '#f8fafc', { x: 3.6, y: 6.3, z: -4, rx: -2.3, mat: 'soft' }, 20, 10, Math.PI * 0.32);
    b.cyl(0.05, 0.05, 1.0, '#94a3b8', { x: 3.6, y: 5.7, z: -4, rx: 0.85, mat: 'metal' }, 6);
    b.sphere(0.12, '#ff4d4d', { x: 3.6, y: 6.45, z: -3.35, mat: 'neon' }, 8, 6);
    // glowing tanks
    const tanks = level >= 3 ? 3 : 2;
    for (let i = 0; i < tanks; i++) {
      const x = 4.9, z = 2.6 - i * 1.3;
      b.cyl(0.55, 0.55, 0.22, '#64748b', { x, z, mat: 'metal' }, 16);
      b.cyl(0.46, 0.46, 1.7, i % 2 ? '#a3ff12' : '#38bdf8', { x, y: 0.22, z, mat: 'neon' }, 16);
      b.cyl(0.52, 0.52, 1.7, '#e0f2fe', { x, y: 0.22, z, mat: 'glass' }, 16);
      b.cyl(0.55, 0.55, 0.22, '#64748b', { x, y: 1.92, z, mat: 'metal' }, 16);
      b.sphere(0.2, '#64748b', { x, y: 2.15, z, mat: 'metal' }, 10, 8);
    }
    pot(b, { x: -4.6, y: 0, z: 2.6, flower: '#9be7ff' });
    bench(b, { x: -3.0, y: 0, z: 3.4 });
    if (level >= 5) {
      b.cyl(1.4, 1.5, 0.5, '#e2e8f0', { x: 3.4, y: 3.9, z: -1.2, mat: 'soft' }, 24);
      b.sphere(1.3, '#d8b4fe', { x: 3.4, y: 4.4, z: -1.2, mat: 'glass' }, 24, 12, Math.PI / 2);
    }
    if (level >= 7) {
      b.cyl(0.12, 0.35, 3.6, '#94a3b8', { x: -4.8, y: 0, z: -0.2, mat: 'metal' }, 12);
      for (let k = 0; k < 4; k++) b.torus(0.4 - k * 0.05, 0.08, '#b87333', { x: -4.8, y: 1.0 + k * 0.6, z: -0.2, rx: Math.PI / 2, mat: 'metal' }, Math.PI * 2, 8, 16);
      b.sphere(0.45, '#e0aaff', { x: -4.8, y: 3.9, z: -0.2, mat: 'neon' }, 16, 12);
    }
    ctx.door = { out: [-0.3, 2.7], in: [-0.3, 0.2] };
    ctx.spots = { tanks: [3.9, 2.6, Math.PI / 2] };
  },

  mine(b, level, ctx) {
    const r = rng(42);
    b.blob(5.0, '#8e959e', { x: 0, y: 1.4, z: -2.6, sy: 0.92, sx: 1.12 }, 2);
    b.blob(3.4, '#7d848d', { x: -3.7, y: 0.8, z: -1.5 }, 2);
    b.blob(3.0, '#a3a9b0', { x: 3.7, y: 0.7, z: -1.0 }, 2);
    b.blob(2.2, '#737a83', { x: 1.6, y: 5.0, z: -3.6 }, 2);
    b.blob(1.6, '#f8fafc', { x: 0.3, y: 6.25, z: -3.2, sy: 0.55 }, 2);
    for (let i = 0; i < 8; i++) b.blob(0.4 + r() * 0.4, '#9aa0a8', { x: -5 + r() * 10, y: 0.2, z: 1 + r() * 2.6, sy: 0.6 }, 1);
    b.blob(0.9, PAL.greenD, { x: -4.6, y: 2.5, z: -0.2 }, 1);
    b.blob(0.7, PAL.green, { x: 4.8, y: 2.2, z: 0.2 }, 1);
    // entrance
    b.box(2.6, 2.8, 2.0, '#0b0b0f', { y: 0, z: 1.2, sharp: true });
    b.box(0.42, 3.3, 0.42, WOOD, { x: -1.5, z: 2.3, r: 0.12 });
    b.box(0.42, 3.3, 0.42, WOOD, { x: 1.5, z: 2.3, r: 0.12 });
    b.box(3.8, 0.45, 0.5, WOOD_D, { y: 3.0, z: 2.3, r: 0.12 });
    b.box(3.2, 0.75, 0.14, '#6f4627', { y: 3.5, z: 2.5, r: 0.08 });
    b.box(2.6, 0.12, 0.05, '#ffd43b', { y: 3.85, z: 2.58, mat: 'neon', sharp: true });
    for (const x of [-1.5, 1.5]) {
      b.box(0.12, 0.3, 0.12, PAL.dark, { x, y: 2.6, z: 2.65, sharp: true });
      b.sphere(0.2, PAL.lit, { x, y: 2.5, z: 2.75, mat: 'lit' }, 10, 8);
    }
    // rails
    for (const x of [-0.5, 0.5]) b.box(0.1, 0.1, 4.2, '#9ca3af', { x, y: 0.12, z: 3.6, mat: 'metal', sharp: true });
    for (let i = 0; i < 6; i++) b.box(1.5, 0.1, 0.25, WOOD_D, { y: 0.02, z: 1.8 + i * 0.7, r: 0.03 });
    // minecart
    b.group({ x: 0, y: 0.2, z: 4.5 }, () => {
      b.box(1.5, 0.9, 1.6, '#4b5563', { y: 0.3, mat: 'metal', r: 0.15 });
      b.box(1.62, 0.14, 1.72, '#374151', { y: 1.15, mat: 'metal', r: 0.06 });
      for (const [x, z] of [[-0.6, 0.55], [0.6, 0.55], [-0.6, -0.55], [0.6, -0.55]]) {
        b.cyl(0.24, 0.24, 0.14, '#1f2937', { x, y: 0.24, z, rz: Math.PI / 2 }, 12);
      }
      for (let i = 0; i < 5; i++) b.octa(0.26, ['#67e8f9', '#f0abfc', '#a78bfa'][i % 3], { x: -0.4 + (i % 3) * 0.4, y: 1.35, z: i < 3 ? -0.25 : 0.3, sy: 1.4, mat: 'neon' });
    });
    // crystals
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
    barrel(b, { x: -3.6, y: 0, z: 3.4, color: '#a0612f' });
    crate(b, { x: -4.6, y: 0, z: 2.6, s: 0.9 });
    b.box(0.1, 1.6, 0.1, WOOD, { x: -2.6, z: 3.4, rz: 0.3, r: 0.03 });
    b.box(0.9, 0.14, 0.14, '#9ca3af', { x: -2.85, y: 1.5, z: 3.4, rz: 0.3, mat: 'metal', r: 0.05 });
    if (level >= 4) {
      plankBox(b, 2.6, 2.2, 2.2, WOOD, { x: 4.2, y: 0, z: 3.0 });
      tinRoof(b, { x: 4.2, y: 2.4, z: 1.8, w: 3.0, d: 2.6 });
      win(b, { x: 4.2, y: 0.9, z: 4.1, w: 0.9, h: 0.8, frame: WHITE });
    }
    ctx.door = { out: [-1.0, 3.0], in: [-1.0, 0.6] };
    ctx.spots = { cart: [1.45, 4.5, -Math.PI / 2] };
  },

  spaceport(b, level, ctx) {
    b.cyl(4.6, 4.9, 0.5, '#5b616b', { x: -1.2, z: -1.6 }, 40);
    b.cyl(4.3, 4.3, 0.06, '#6b7280', { x: -1.2, y: 0.5, z: -1.6 }, 40);
    b.torus(4.1, 0.14, '#ffd43b', { x: -1.2, y: 0.54, z: -1.6, rx: Math.PI / 2 }, Math.PI * 2, 6, 48);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      b.box(0.32, 0.14, 0.32, '#4dabf7', { x: -1.2 + Math.cos(a) * 4.5, y: 0.5, z: -1.6 + Math.sin(a) * 4.5, mat: 'neon', r: 0.05 });
    }
    // gantry
    const gx = 2.6, gz = -1.6, gh = 11;
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) b.box(0.24, gh, 0.24, '#e03131', { x: gx + dx, y: 0.5, z: gz + dz, r: 0.08 });
    for (let k = 0; k < 9; k++) {
      b.box(1.45, 0.14, 0.14, '#f8f9fa', { x: gx, y: 1.5 + k * 1.2, z: gz + 0.6, r: 0.05 });
      b.box(1.45, 0.14, 0.14, '#f8f9fa', { x: gx, y: 1.5 + k * 1.2, z: gz - 0.6, r: 0.05 });
      b.box(0.14, 0.14, 1.45, '#f8f9fa', { x: gx - 0.6, y: 1.5 + k * 1.2, z: gz, r: 0.05 });
    }
    b.box(1.9, 0.26, 0.36, '#e03131', { x: gx - 1.4, y: 8.5, z: gz, r: 0.08 });
    b.sphere(0.2, '#ff2d2d', { x: gx, y: gh + 0.7, z: gz, mat: 'neon' }, 10, 8);
    // control building
    b.rbox(4.4, 2.8, 3.2, 0.5, '#f4f7fa', { x: 3.4, z: 2.6, mat: 'soft' });
    b.rbox(4.5, 0.35, 3.3, 0.15, '#3a86ff', { x: 3.4, y: 2.0, z: 2.6 });
    roundWin(b, { x: 2.3, y: 0, y0: 1.35, z: 4.18, r: 0.42, frame: '#3a86ff' });
    roundWin(b, { x: 4.6, y: 0, y0: 1.35, z: 4.18, r: 0.42, frame: '#3a86ff' });
    door(b, { x: 3.45, y: 0, z: 4.18, w: 0.9, h: 1.9, color: '#3a86ff', glass: true });
    b.cyl(0.09, 0.09, 1, '#adb5bd', { x: 4.6, y: 2.8, z: 2.0, mat: 'metal' }, 8);
    b.sphere(0.85, '#e9ecef', { x: 4.6, y: 4.0, z: 2.0, rx: -2.4, mat: 'metal' }, 16, 8, Math.PI * 0.35);
    // fuel spheres
    b.sphere(1.25, '#dee2e6', { x: -4.7, y: 1.6, z: 3.0, mat: 'metal' }, 20, 14);
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [0, 0.7]]) b.cyl(0.08, 0.08, 1.0, '#868e96', { x: -4.7 + dx, y: 0, z: 3.0 + dz, mat: 'metal' }, 8);
    b.torus(1.27, 0.06, '#e03131', { x: -4.7, y: 1.6, z: 3.0, rx: Math.PI / 2 }, Math.PI * 2, 6, 28);
    if (level >= 4) {
      b.sphere(1.0, '#dee2e6', { x: -2.4, y: 1.3, z: 3.6, mat: 'metal' }, 18, 12);
      b.cyl(0.13, 0.13, 0.9, '#868e96', { x: -2.4, y: 0, z: 3.6, mat: 'metal' }, 8);
    }

    // animated rocket
    const rb = new MeshBuilder();
    rb.cyl(0.95, 0.95, 6.5, '#f8f9fa', { y: 0.9, mat: 'soft' }, 28);
    for (const y of [2.0, 5.2]) rb.cyl(0.98, 0.98, 0.45, '#1c7ed6', { y, mat: 'soft' }, 28);
    rb.cone(0.95, 2.4, '#e03131', { y: 7.4, mat: 'soft' }, 28);
    rb.sphere(0.2, '#e03131', { y: 9.75, mat: 'soft' }, 10, 8);
    rb.cyl(0.3, 0.75, 0.9, '#495057', { y: 0, mat: 'metal' }, 18);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      rb.box(0.16, 1.9, 1.05, '#e03131', { x: Math.cos(a) * 1.0, y: 0.8, z: Math.sin(a) * 1.0, ry: -a, mat: 'soft', r: 0.07 });
    }
    rb.torus(0.34, 0.08, '#e9ecef', { y: 4.4, z: 0.95, mat: 'metal' }, Math.PI * 2, 8, 18);
    rb.cyl(0.32, 0.32, 0.08, '#a5d8ff', { y: 4.4, z: 0.93, rx: Math.PI / 2, mat: 'lit' }, 16);
    rb.torus(0.34, 0.08, '#e9ecef', { y: 3.4, z: 0.95, mat: 'metal' }, Math.PI * 2, 8, 18);
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
    ctx.door = { out: [3.45, 5.0], in: [3.45, 3.0] };
    ctx.spots = { pad: [-0.2, 3.9, Math.PI], fuel: [-4.7, 4.9, Math.PI] };
  },
};

export function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** Distances (×quality scale) at which a building switches to LOD 1 and LOD 2. */
export const BUILDING_LOD = [45, 110];

/**
 * Builds the three LOD versions of a business plus a low-poly shadow proxy.
 * Only LOD 0 keeps its animated extras (rocket, lab ring) and gameplay data.
 */
export function buildBusiness(typeId, level, lodScale = 1) {
  const levels = [];
  let main = null;
  for (let lod = 0; lod < 3; lod++) {
    const b = new MeshBuilder({ lod });
    const ctx = { emitters: [], animated: [], extra: [], height: 8, door: null, spots: {} };
    MODELS[typeId](b, level, ctx);
    const g = b.build();
    g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    if (lod === 0) main = ctx;
    else ctx.extra.forEach((e) => disposeObject(e));
    levels.push(g);
  }
  const lod = new THREE.LOD();
  lod.addLevel(levels[0], 0);
  lod.addLevel(levels[1], BUILDING_LOD[0] * lodScale, 0.08);
  lod.addLevel(levels[2], BUILDING_LOD[1] * lodScale, 0.08);
  const group = new THREE.Group();
  group.add(lod, makeShadowProxy(levels[2]));
  for (const e of main.extra) {
    e.traverse((m) => { if (m.isMesh && m.name !== 'neon') m.castShadow = true; });
    group.add(e);
  }
  return { group, lod, emitters: main.emitters, animated: main.animated, height: main.height, door: main.door, spots: main.spots };
}

/** Merge a low-detail model into one invisible mesh that only renders into the shadow map. */
export function makeShadowProxy(low) {
  const geos = [];
  low.traverse((m) => { if (m.isMesh && m.name !== 'neon' && m.name !== 'glass') geos.push(m.geometry); });
  const proxy = new THREE.Mesh(mergeGeometries(geos, false), SHADOW_PROXY_MAT);
  proxy.castShadow = true;
  proxy.receiveShadow = false;
  proxy.name = 'shadow-proxy';
  return proxy;
}

export function setBuildingLodScale(lod, scale) {
  lod.levels[1].distance = BUILDING_LOD[0] * scale;
  lod.levels[2].distance = BUILDING_LOD[1] * scale;
}

// ---------------------------------------------------------------------------
// Headquarters (bank)
// ---------------------------------------------------------------------------
export function buildHQ() {
  const high = new MeshBuilder();
  hqModel(high);
  const group = high.build();
  group.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  const low = new MeshBuilder({ lod: 2 });
  hqModel(low);
  const lowGroup = low.build();
  group.add(makeShadowProxy(lowGroup));
  lowGroup.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
  return finishHQ(group);
}

function hqModel(b) {
  const stone = '#f2ead9';
  const stoneD = '#dccfb4';
  b.box(11.8, 0.6, 9.4, stoneD, { z: -2.0, r: 0.18 });
  stairs(b, { y: 0, z: 2.75, w: 6.2, steps: 3, color: stoneD });
  // main block
  plankBox(b, 10.4, 5.6, 6, stone, { y: 0.6, z: -3.4, dir: 'h', step: 0.7 });
  for (let i = 0; i < 3; i++) {
    win(b, { x: 5.22, y: 2.3, z: -5.4 + i * 1.8, w: 1.0, h: 1.9, ry: Math.PI / 2, frame: '#c9b88f', shutters: '#1d4f91' });
    win(b, { x: -5.22, y: 2.3, z: -5.4 + i * 1.8, w: 1.0, h: 1.9, ry: -Math.PI / 2, frame: '#c9b88f', shutters: '#1d4f91' });
  }
  // portico
  b.box(10.8, 0.3, 3.3, stoneD, { y: 0.6, z: 0.8, r: 0.1 });
  for (let i = 0; i < 6; i++) {
    const x = -4.25 + i * 1.7;
    b.cyl(0.42, 0.46, 0.35, stoneD, { x, y: 0.9, z: 1.6 }, 20);
    b.cyl(0.34, 0.38, 3.9, '#fbf6ea', { x, y: 1.25, z: 1.6 }, 20);
    b.torus(0.36, 0.08, stoneD, { x, y: 5.1, z: 1.6, rx: Math.PI / 2 }, Math.PI * 2, 8, 20);
    b.box(0.95, 0.3, 0.95, stoneD, { x, y: 5.15, z: 1.6, r: 0.1 });
  }
  b.box(11, 0.85, 3.7, stone, { y: 5.45, z: 0.6, r: 0.15 });
  b.box(11.1, 0.16, 3.8, '#c9a227', { y: 5.95, z: 0.6, mat: 'gold', r: 0.06 });
  b.prism(3.6, 2.0, 10.8, stone, { y: 6.3, z: 0.6, ry: Math.PI / 2 });
  b.box(11.2, 0.22, 0.4, stoneD, { y: 6.2, z: 2.4, r: 0.08 });
  b.cyl(0.6, 0.6, 0.12, '#f5c542', { y: 7.0, z: 2.45, rx: Math.PI / 2, mat: 'gold' }, 24);
  b.box(0.9, 0.24, 0.05, '#e5484d', { y: 7.0 - 0.12 + 0.6 - 0.6, z: 2.6, sharp: true });
  b.box(0.24, 0.9, 0.05, '#e5484d', { y: 7.0 - 0.45 + 0.6 - 0.6, z: 2.6, sharp: true });
  // door + windows
  door(b, { x: 0, y: 0.9, z: -0.38, w: 2.2, h: 3.4, color: '#7a4a22', frame: '#c9a227', glass: true });
  win(b, { x: -3.0, y: 1.8, z: -0.38, w: 1.0, h: 2.0, frame: '#c9b88f' });
  win(b, { x: 3.0, y: 1.8, z: -0.38, w: 1.0, h: 2.0, frame: '#c9b88f' });
  // roof + dome
  flatRoof(b, { y: 6.2, z: -3.4, w: 10.4, d: 6, color: stoneD, edge: stone });
  b.cyl(2.4, 2.5, 1.1, stone, { y: 6.6, z: -3.4 }, 32);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.box(0.3, 0.7, 0.1, PAL.lit, { x: Math.cos(a) * 2.44, y: 6.8, z: -3.4 + Math.sin(a) * 2.44, ry: -a + Math.PI / 2, mat: 'lit', r: 0.03 });
  }
  b.sphere(2.3, '#d4a72c', { y: 7.7, z: -3.4, mat: 'gold' }, 32, 16, Math.PI / 2);
  b.torus(2.3, 0.12, '#b8860b', { y: 7.7, z: -3.4, rx: Math.PI / 2, mat: 'gold' }, Math.PI * 2, 8, 32);
  b.cyl(0.08, 0.12, 1.3, '#d4a72c', { y: 9.9, z: -3.4, mat: 'gold' }, 10);
  // flags (Swiss + gold)
  for (const x of [-5.6, 5.6]) {
    b.cyl(0.08, 0.1, 7.5, '#dee2e6', { x, y: 0, z: 5.2, mat: 'metal' }, 10);
    b.sphere(0.16, '#d4a72c', { x, y: 7.55, z: 5.2, mat: 'gold' }, 10, 8);
    if (x < 0) {
      b.box(0.06, 1.6, 1.6, '#e5484d', { x, y: 5.75, z: 4.35, mat: 'soft', sharp: true });
      b.box(0.08, 0.95, 0.3, '#ffffff', { x, y: 6.07, z: 4.35, sharp: true });
      b.box(0.08, 0.3, 0.95, '#ffffff', { x, y: 6.4, z: 4.35, sharp: true });
    } else {
      b.box(0.06, 1.3, 2.1, '#d4a72c', { x, y: 6.0, z: 4.1, mat: 'gold', sharp: true });
    }
  }
  planter(b, { x: -4.4, y: 0, z: 4.0 });
  planter(b, { x: 4.4, y: 0, z: 4.0 }, '#ffd43b');
  lamp(b, { x: -3.4, y: 0, z: 5.6, ry: Math.PI });
  lamp(b, { x: 3.4, y: 0, z: 5.6, ry: Math.PI });
}

function finishHQ(group) {
  const tex = makeCoinTexture();
  const gold = new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 1, roughness: 0.25 });
  const face = new THREE.MeshStandardMaterial({ map: tex, metalness: 1, roughness: 0.28 });
  gold.userData.owned = true; face.userData.owned = true;
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.3, 40), [gold, face, face]);
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
  g.lineWidth = 12;
  g.beginPath(); g.arc(128, 128, 108, 0, Math.PI * 2); g.stroke();
  // Swiss cross + CHF, like a 5-franc coin
  g.fillStyle = '#9a6a0c';
  g.fillRect(108, 44, 40, 104);
  g.fillRect(76, 76, 104, 40);
  g.font = '900 44px Outfit, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('CHF', 128, 186);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------------------
// Signboard with canvas text (standing at the front corner of a pad)
// ---------------------------------------------------------------------------
export function buildSign(title, subtitle, color, iconName) {
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
  g.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(g, 22, 140, 130, 30, 14);
  g.fill();
  if (iconName) drawIcon(g, iconName, 37, 46, 100);
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  let size = 46;
  g.font = `800 ${size}px Outfit, Arial, sans-serif`;
  while (g.measureText(title).width > 320 && size > 24) { size -= 2; g.font = `800 ${size}px Outfit, Arial, sans-serif`; }
  g.fillText(title, 172, 76);
  g.fillStyle = color;
  g.font = '700 32px Outfit, Arial, sans-serif';
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

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------------------
// Empty plot decoration ("À vendre" + zone d'affectation)
// ---------------------------------------------------------------------------
const forSaleTex = {};
export function buildForSale(zone) {
  if (!forSaleTex[zone]) {
    const industrial = zone === 'ZI';
    forSaleTex[zone] = canvasTexture(256, 160, (g) => {
      g.fillStyle = '#fff8e7';
      g.fillRect(0, 0, 256, 160);
      g.strokeStyle = '#e03131';
      g.lineWidth = 10;
      g.strokeRect(5, 5, 246, 150);
      g.fillStyle = '#e03131';
      g.font = '900 48px Outfit, Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('À VENDRE', 128, 58);
      g.fillStyle = industrial ? '#7c4a1e' : '#1d4ed8';
      roundRect(g, 22, 96, 212, 44, 10);
      g.fill();
      g.fillStyle = '#ffffff';
      g.font = '800 24px Outfit, Arial, sans-serif';
      g.fillText(industrial ? 'ZONE INDUSTRIELLE' : 'ZONE MIXTE', 128, 119);
    });
  }
  const grp = new THREE.Group();
  const b = new MeshBuilder();
  b.box(0.15, 1.6, 0.15, WOOD_D, {});
  b.box(2.2, 1.45, 0.08, WOOD, { y: 1.0, z: -0.06 });
  grp.add(b.build());
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.25), new THREE.MeshStandardMaterial({ map: forSaleTex[zone], roughness: 0.8 }));
  plane.position.set(0, 1.72, 0.0);
  plane.castShadow = true;
  grp.add(plane);
  return grp;
}

// ---------------------------------------------------------------------------
// Construction site: 1) gabarits (profile poles, mise à l'enquête publique)
//                    2) chantier (fence, scaffolding, crane)
// ---------------------------------------------------------------------------
let enqueteTex = null;
export function buildConstructionSite(color) {
  const root = new THREE.Group();

  // --- Phase 1: gabarits — the iconic Swiss profile poles ---
  const gb = new MeshBuilder();
  const corners = [[-5, -5], [5, -5], [5, 3], [-5, 3]];
  const h = 7;
  for (const [x, z] of corners) {
    gb.box(0.14, h, 0.14, '#f1f3f5', { x, z });
    for (let k = 0; k < 4; k++) gb.box(0.15, 0.35, 0.15, '#e03131', { x, y: h - 0.35 - k * 0.7, z });
    gb.box(0.6, 0.1, 0.1, '#f1f3f5', { x, y: h - 0.05, z, ry: Math.PI / 4 });
  }
  gb.box(10, 0.06, 0.06, '#e03131', { y: h - 0.2, z: -5 });
  gb.box(10, 0.06, 0.06, '#e03131', { y: h - 0.2, z: 3 });
  gb.box(0.06, 0.06, 8, '#e03131', { x: -5, y: h - 0.2, z: -1 });
  gb.box(0.06, 0.06, 8, '#e03131', { x: 5, y: h - 0.2, z: -1 });
  const gabarits = gb.build();
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
  const board = new MeshBuilder();
  board.box(0.12, 1.4, 0.12, '#5b6475', { x: -0.8, mat: 'metal' });
  board.box(0.12, 1.4, 0.12, '#5b6475', { x: 0.8, mat: 'metal' });
  const boardG = board.build();
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.42), new THREE.MeshStandardMaterial({ map: enqueteTex, roughness: 0.7 }));
  plate.position.set(0, 1.7, 0.08);
  boardG.add(plate);
  boardG.position.set(-3.6, 0, 5.2);
  boardG.rotation.y = 0.3;
  gabarits.add(boardG);
  root.add(gabarits);

  // --- Phase 2: chantier ---
  const cb = new MeshBuilder();
  // fence
  for (let i = 0; i < 12; i++) {
    const x = -5.5 + i;
    cb.box(0.95, 1.1, 0.06, i % 2 ? '#ff922b' : '#f8f9fa', { x: x + 0.5, z: 5.2 });
  }
  for (const x of [-6, 6]) cb.box(0.06, 1.1, 11, '#f8f9fa', { x, z: -0.3 });
  // foundation & site hut (baraque de chantier)
  cb.box(10, 0.4, 8, '#9aa0a6', { z: -1 });
  cb.box(3.2, 2.4, 2.2, '#f2f2f2', { x: 3.6, z: 3.2 });
  cb.box(3.3, 0.2, 2.3, '#495057', { x: 3.6, y: 2.4, z: 3.2 });
  cb.box(0.9, 0.6, 0.05, '#a5d8ff', { x: 3.0, y: 1.3, z: 4.31, mat: 'lit' });
  // material piles
  for (let i = 0; i < 3; i++) cb.box(1.4, 0.25, 0.9, '#c9a46a', { x: -4, y: i * 0.26, z: 3.6 });
  cb.cone(0.9, 0.9, '#d9c7a1', { x: -2.2, z: 3.8 }, 10);
  const site = cb.build();
  root.add(site);

  // scaffolding grows with progress
  const sb = new MeshBuilder();
  const levels = 5;
  for (let l = 0; l < levels; l++) {
    const y = l * 1.6;
    for (const [x, z] of [[-4.6, -4.6], [4.6, -4.6], [4.6, 2.6], [-4.6, 2.6], [0, 2.6], [0, -4.6]]) {
      sb.cyl(0.05, 0.05, 1.6, '#adb5bd', { x, y: y + 0.4, z, mat: 'metal' }, 6);
    }
    sb.box(9.4, 0.08, 0.8, '#c08a4a', { y: y + 2.0, z: 3.0 });
    sb.box(9.4, 0.05, 0.05, '#ff922b', { y: y + 2.8, z: 3.35 });
    sb.box(0.8, 0.08, 7.4, '#c08a4a', { x: 5.0, y: y + 2.0, z: -1 });
  }
  const scaffold = sb.build();
  root.add(scaffold);
  // building core rising (grey concrete + building colour band)
  const core = new MeshBuilder();
  core.box(8.6, 1, 6.6, '#c5c9ce', {});
  core.box(8.7, 0.12, 6.7, color, { y: 0.95 });
  const coreMesh = core.build();
  coreMesh.position.set(0, 0.4, -1);
  root.add(coreMesh);

  // tower crane
  const kb = new MeshBuilder();
  kb.box(0.6, 14, 0.6, '#ffd43b', { mat: 'metal' });
  kb.box(1.4, 0.8, 1.4, '#495057', { y: 13.6 });
  const crane = kb.build();
  crane.position.set(-5.2, 0, -5.2);
  const jibB = new MeshBuilder();
  jibB.box(14, 0.45, 0.45, '#ffd43b', { x: 4, y: 0, mat: 'metal' });
  jibB.box(2.2, 1.2, 1.0, '#495057', { x: -3.2, y: -1.1 });
  jibB.cyl(0.02, 0.02, 4.5, '#212529', { x: 8, y: -4.5 }, 4);
  jibB.box(0.8, 0.5, 0.8, '#868e96', { x: 8, y: -5.1, mat: 'metal' });
  const jib = jibB.build();
  jib.position.y = 14.4;
  crane.add(jib);
  root.add(crane);

  const update = (progress, t) => {
    const p1 = progress < 0.3;
    gabarits.visible = p1;
    site.visible = scaffold.visible = coreMesh.visible = crane.visible = !p1;
    if (!p1) {
      const k = (progress - 0.3) / 0.7;
      coreMesh.scale.y = Math.max(0.01, k * 7.5);
      scaffold.scale.y = Math.max(0.05, Math.min(1, 0.25 + k));
      jib.rotation.y = Math.sin(t * 0.4) * 1.2 + 0.4;
    }
  };
  update(0, 0);
  return { group: root, update };
}

export { bush };
