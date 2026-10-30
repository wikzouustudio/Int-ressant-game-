import { PAL, shade, plankBox, win, door, stairs, awning, balcony, chimney, pot, bench, cafeTable, rollDoor, crate, barrel, ac, pipe, stringLights } from './kit.js';
import { gable, dormer, porch, shrubs, pots, path, brickLines, garageDoor } from './houses.js';

// Detailed versions of the city buildings, in the same cartoon diorama style as the
// house set: framed windows, shutters, flower boxes, shingled roofs, awnings, signs,
// steps, plants, rooftop equipment. Each draws a lot of size (w × d) centred on the
// origin, street side towards +z. They replace the older, simpler district models.

const TRIM = '#fbf7ef';
const ROOF = '#4f5566';
const pick = (r, a) => a[(r() * a.length) | 0];
const WALLS = ['#f3d36b', '#8fb9e3', '#f3c9c0', '#d9ead3', '#e3d5f0', '#f6e3a8', '#f2d6b3', '#cfe1f2', '#f6f2ea'];
const ACC = ['#e0573f', '#4b8fd8', '#3bb3a8', '#f2a541', '#8b5cf6', '#e86aa1'];
const SHUT = ['#3d6fb8', '#c0392b', '#3f8f5a', '#5f6875', '#8b5a2b'];
const FLOW = ['#ff6b9a', '#ffd43b', '#ffffff', '#b197fc', '#ff922b'];

function car(b, x, z, ry, color) {
  b.group({ x, z, ry }, () => {
    b.rbox(3.2, 0.78, 1.55, 0.34, color, { y: 0.28, mat: 'soft' });
    b.rbox(1.8, 0.68, 1.4, 0.3, '#bfe3ff', { x: -0.2, y: 0.92, mat: 'glass' });
    for (const [cx, cz] of [[1.05, 0.72], [-1.05, 0.72], [1.05, -0.72], [-1.05, -0.72]]) b.cyl(0.34, 0.34, 0.24, '#22262d', { x: cx, y: 0.34, z: cz - Math.sign(cz) * 0.12, rx: Math.PI / 2 }, 8);
  });
}
const CAR_COLS = ['#e0573f', '#4b8fd8', '#f2c14e', '#f8f9fa', '#2e3440', '#3bb3a8', '#8b5cf6'];

/** Shop front: framed glass, door, striped awning and a sign board. z = facade plane. */
function shopFront(b, o) {
  const { x = 0, z, w, acc, h = 2.6 } = o;
  b.group({ x, z }, () => {
    b.box(w, h + 0.3, 0.16, shade(acc, 0.7), { y: 0.2, r: 0.05 });
    b.box(w - 0.5, h - 0.4, 0.12, PAL.lit, { y: 0.55, z: 0.06, mat: 'lit', sharp: true });
    for (let k = 1; k < Math.max(2, Math.round(w / 1.6)); k++) b.box(0.1, h - 0.4, 0.14, TRIM, { x: -w / 2 + 0.25 + (k * (w - 0.5)) / Math.max(2, Math.round(w / 1.6)), y: 0.55, z: 0.08, sharp: true });
    b.box(1.0, 2.1, 0.16, shade(acc, 0.85), { x: w / 2 - 0.9, y: 0.2, z: 0.1, r: 0.04 });
    b.box(w - 0.3, 0.5, 0.2, TRIM, { y: h + 0.55, z: 0.06, r: 0.06 });
    b.box(w * 0.55, 0.32, 0.06, acc, { y: h + 0.64, z: 0.18, mat: 'soft', sharp: true });
    awning(b, { y: h + 0.4, z: 0.12, w: w - 0.4, depth: 1.1, colors: ['#ffffff', acc] });
  });
}

/** Flat roof with a parapet and some rooftop equipment. */
function flatTop(b, r, w, d, y, z = 0) {
  b.box(w + 0.3, 0.45, d + 0.3, '#e9e2d6', { y, z, r: 0.1 });
  b.box(w - 0.4, 0.08, d - 0.4, '#8a94a3', { y: y + 0.42, z, sharp: true });
  if (r() < 0.7) ac(b, { x: -w / 4, y: y + 0.45, z: z - d / 4, s: 0.9 });
  if (r() < 0.5) b.box(1.4, 1.0, 1.2, '#f1f3f5', { x: w / 4, y: y + 0.45, z: z - d / 5, r: 0.08 });
}

export const CITY_MODELS = {
  // ---------------- old town (pedestrian zone) ----------------
  /** Narrow old-town house: shop with awning, shuttered windows with flower boxes, gable. */
  oldtown(b, r, w, d) {
    const wall = pick(r, WALLS), acc = pick(r, ACC), sh = pick(r, SHUT);
    const floors = 2 + ((r() * 2) | 0);
    const fh = 2.7, H = 3.2 + floors * fh;
    const D = d - 0.6;
    b.box(w - 0.1, 0.3, D + 0.2, '#cfc5b4', { r: 0.08 });
    b.box(w - 0.3, 3.2, D, shade(wall, 0.92), { y: 0.3, r: 0.12 });
    plankBox(b, w - 0.3, H - 3.2, D, wall, { y: 3.5, dir: 'h', step: 0.36 });
    b.box(w - 0.1, 0.22, D + 0.2, TRIM, { y: 3.4, r: 0.06 });
    shopFront(b, { z: D / 2, w: w - 0.8, acc, h: 2.4 });
    const nWin = w > 8.5 ? 3 : 2;
    for (let f = 0; f < floors; f++) {
      for (let k = 0; k < nWin; k++) {
        const x = -w / 2 + 0.15 + ((k + 0.5) * (w - 0.3)) / nWin;
        win(b, { x, y: 4.2 + f * fh, z: D / 2 + 0.02, w: 0.85, h: 1.2, frame: TRIM, shutters: sh, box: f === 0 ? pick(r, FLOW) : null });
      }
    }
    gable(b, { y: H + 0.3, w: D, d: w - 0.3, h: 3.0, wall, ry: Math.PI / 2, over: 0.35, color: pick(r, ['#c0583d', '#a8492f', ROOF]) });
    if (r() < 0.5) dormer(b, { y: H + 0.6, z: -D / 4, wall });
    if (r() < 0.6) chimney(b, { x: w / 4, y: H + 1.0, z: -D / 3, h: 2.4, w: 0.7, color: '#c25b3f' });
    pots(b, r, [[-w / 2 + 0.6, D / 2 + 1.2]]);
  },

  /** Café-terrace: two-storey house, awning, tables with parasols, string lights. */
  cafe(b, r, w, d) {
    const wall = pick(r, ['#f6f2ea', '#f6e3a8', '#f3c9c0', '#d9ead3']), acc = pick(r, ACC);
    const D = d - 3.6, z0 = -1.8;
    b.box(w - 0.2, 0.3, D + 0.2, '#cfc5b4', { z: z0, r: 0.08 });
    plankBox(b, w - 0.4, 5.4, D, wall, { y: 0.3, z: z0, dir: 'h', step: 0.34 });
    gable(b, { y: 5.7, z: z0, w: w - 0.4, d: D, h: 2.2, color: '#c0583d', wall });
    shopFront(b, { z: z0 + D / 2, w: w - 1.0, acc, h: 2.4 });
    for (const x of [-w / 4, w / 4]) win(b, { x, y: 4.0, z: z0 + D / 2 + 0.02, w: 0.9, h: 1.0, frame: TRIM, box: pick(r, FLOW) });
    b.box(w - 0.4, 0.06, 3.2, '#c98a4b', { y: 0.05, z: d / 2 - 1.7, sharp: true });
    for (let k = 0; k < 2; k++) {
      const x = -w / 4 + k * (w / 2);
      cafeTable(b, { x, z: d / 2 - 1.6, chair: pick(r, ACC) });
      b.cyl(0.04, 0.04, 2.4, PAL.dark, { x, z: d / 2 - 1.6 }, 6);
      b.cone(1.4, 0.6, k ? acc : '#ffffff', { x, y: 2.3, z: d / 2 - 1.6 }, 10);
    }
    stringLights(b, [-w / 2 + 0.3, 3.2, d / 2 - 0.2], [w / 2 - 0.3, 3.2, d / 2 - 0.2], 9, 0.4);
    for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) b.box(0.1, 3.2, 0.1, PAL.dark, { x, z: d / 2 - 0.2, sharp: true });
    pots(b, r, [[-w / 2 + 0.6, d / 2 - 0.4], [w / 2 - 0.6, d / 2 - 0.4]]);
  },

  /** Old-town church with a clock tower, framed windows and a slate roof. */
  church(b, r) {
    const wall = '#f1ece2';
    b.box(13, 0.4, 19, '#cfc5b4', { z: -2, r: 0.1 });
    b.box(12, 8.6, 18, wall, { y: 0.4, z: -2, r: 0.2 });
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
      b.box(0.5, 9, 0.6, shade(wall, 0.9), { x: sx * 6.05, y: 0.4, z: -9.5 + k * 5, r: 0.08 }); // buttresses
      b.group({ x: sx * 6.02, z: -7 + k * 4.2, ry: sx * Math.PI / 2 }, () => {
        b.box(1.3, 4.0, 0.12, '#7fb2e0', { y: 2.4, mat: 'lit', sharp: true });
        b.cyl(0.65, 0.65, 0.12, '#7fb2e0', { y: 6.4, rx: Math.PI / 2, mat: 'lit' }, 12);
        b.box(1.6, 0.2, 0.3, TRIM, { y: 2.2, r: 0.04 });
      });
    }
    gable(b, { y: 9.0, z: -2, w: 18.4, d: 12, h: 5.0, wall, ry: Math.PI / 2, color: '#5f6875' });
    // tower
    b.box(5.4, 21, 5.4, wall, { y: 0.4, z: 8.4, r: 0.2 });
    for (const y of [7, 14]) b.box(5.7, 0.4, 5.7, '#d6d0c6', { y, z: 8.4, r: 0.08 });
    for (const [ry, ox, oz] of [[0, 0, 2.72], [Math.PI / 2, 2.72, 0], [-Math.PI / 2, -2.72, 0], [Math.PI, 0, -2.72]]) {
      b.group({ x: ox, z: 8.4 + oz, ry }, () => {
        b.cyl(1.25, 1.25, 0.16, '#fbf7ef', { y: 17, rx: Math.PI / 2 }, 20);
        b.torus(1.25, 0.12, '#c9a24a', { y: 17, z: 0.05, mat: 'gold' }, Math.PI * 2, 6, 20);
        b.box(0.1, 0.9, 0.08, PAL.dark, { y: 17, z: 0.1, sharp: true });
        b.box(0.7, 0.1, 0.08, PAL.dark, { x: 0.3, y: 17, z: 0.1, sharp: true });
        b.box(1.2, 2.6, 0.2, '#3e5874', { y: 10.2, r: 0.06 });
      });
    }
    b.box(5.6, 0.5, 5.6, '#5f6875', { y: 21.4, z: 8.4, r: 0.08 });
    b.cone(3.9, 9, '#3f8f6a', { y: 21.8, z: 8.4 }, 4);
    b.sphere(0.4, '#f2c14e', { y: 31, z: 8.4, mat: 'gold' }, 10, 8);
    b.box(0.1, 1.8, 0.1, '#f2c14e', { y: 31.2, z: 8.4, mat: 'gold', sharp: true });
    door(b, { z: 11.12, y: 0.4, w: 2.0, h: 3.2, color: '#7a4a28', steps: 2 });
    shrubs(b, r, [-4.5, 4.5], 10.5, 0.9);
  },

  // ---------------- business district ----------------
  /** Glass tower: stone lobby with canopy, floor slabs, vertical fins, crown and antenna. */
  tower(b, r, w) {
    const floors = 10 + ((r() * 14) | 0), fh = 2.2;
    const glass = pick(r, ['#6fa3d8', '#7fb6c9', '#8aa9d6', '#5f8fbf', '#9fb7c9']);
    const frame = pick(r, ['#f1f3f5', '#d6dbe0', '#2e3440', '#c9b79c']);
    const s = w - 3;
    b.box(w, 0.4, w, '#d6d0c6', { r: 0.12 });
    b.box(s + 0.6, 4.2, s + 0.6, '#cfc5b4', { y: 0.4, r: 0.2 });
    b.box(s - 1.6, 3.2, 0.12, PAL.lit, { y: 0.7, z: (s + 0.6) / 2, mat: 'lit', sharp: true });
    b.box(s - 1, 0.3, 2.4, frame === '#2e3440' ? '#5f6875' : '#3a3f47', { y: 3.6, z: (s + 0.6) / 2 + 1.1, r: 0.08 }); // canopy
    for (const x of [-s / 2 + 0.6, s / 2 - 0.6]) b.box(0.2, 3.2, 0.2, '#5f6875', { x, y: 0.4, z: (s + 0.6) / 2 + 2.1, sharp: true });
    let y = 4.6, cur = s;
    for (let f = 0; f < floors; f++) {
      if (f === Math.floor(floors * 0.7) && r() < 0.6) cur -= 1.6;
      b.box(cur, 0.3, cur, frame, { y, r: 0.1 });
      b.box(cur - 0.3, fh - 0.3, cur - 0.3, glass, { y: y + 0.3, mat: 'glass', r: 0.15 });
      y += fh;
    }
    for (let k = -2; k <= 2; k++) for (const side of [0, 1, 2, 3]) {
      const a = (side * Math.PI) / 2;
      b.group({ ry: a }, () => b.box(0.18, y - 4.6, 0.25, frame, { x: (k * cur) / 5, y: 4.6, z: cur / 2, sharp: true }));
    }
    b.box(cur + 0.4, 0.6, cur + 0.4, frame, { y, r: 0.15 });
    b.box(cur * 0.5, 2.2, cur * 0.5, '#adb5bd', { y: y + 0.6, r: 0.1 });
    for (let k = 0; k < 4; k++) b.box(cur * 0.55, 0.12, 0.12, frame, { y: y + 1.0 + k * 0.4, z: cur * 0.26, sharp: true });
    if (r() < 0.6) {
      b.cyl(0.08, 0.1, 6, '#adb5bd', { y: y + 2.8 }, 6);
      b.sphere(0.18, '#ff2d2d', { y: y + 8.9, mat: 'neon' }, 6, 4);
    }
    for (const x of [-w / 2 + 1, w / 2 - 1]) { b.box(1.4, 0.6, 1.4, '#a3998c', { x, z: w / 2 - 1, r: 0.1 }); shrubs(b, r, [x], w / 2 - 1, 0.7); }
  },

  /** Office block: stone base, framed window rows, entrance with steps, rooftop units. */
  office(b, r, w, d) {
    const floors = 4 + ((r() * 5) | 0), fh = 2.6;
    const wall = pick(r, ['#efe9df', '#d6dbe0', '#e8dcc8', '#cfd8e3', '#e9c9b0']);
    const acc = pick(r, ACC);
    const D = d - 2.4, z0 = -0.8;
    b.box(w, 0.35, d, '#d6d0c6', { r: 0.1 });
    b.box(w - 1, 3.3, D, '#b8b1a6', { y: 0.35, z: z0, r: 0.15 });
    b.box(w - 1, floors * fh, D, wall, { y: 3.65, z: z0, r: 0.15 });
    brickLines(b, w - 1.1, floors * fh, z0 + D / 2 + 0.02, 3.65, wall, 0.9);
    const n = Math.max(3, Math.round((w - 2) / 2.2));
    for (let f = 0; f < floors; f++) for (let k = 0; k < n; k++) {
      win(b, { x: -w / 2 + 1.2 + ((k + 0.5) * (w - 2.4)) / n, y: 4.3 + f * fh, z: z0 + D / 2 + 0.02, w: 1.0, h: 1.4, frame: TRIM, cross: false, glass: r() < 0.35 ? '#ffe3a3' : '#9cc9f0', dark: true });
    }
    b.box(w - 3, 2.6, 0.12, PAL.lit, { y: 0.55, z: z0 + D / 2 + 0.02, mat: 'lit', sharp: true });
    door(b, { z: z0 + D / 2 + 0.05, y: 0.35, w: 1.6, h: 2.6, color: '#3a3f47', glass: true });
    b.box(4.2, 0.25, 1.6, acc, { y: 3.2, z: z0 + D / 2 + 0.8, r: 0.06 });
    b.box(w * 0.45, 0.6, 0.12, '#ffffff', { y: 3.55, z: z0 + D / 2 + 0.05, mat: 'neon', sharp: true });
    stairs(b, { z: z0 + D / 2 + 0.3, w: 3, steps: 2, color: '#d9d3c7' });
    flatTop(b, r, w - 1, D, 3.65 + floors * fh, z0);
    for (const x of [-w / 2 + 1.4, w / 2 - 1.4]) { b.box(1.6, 0.6, 1.0, '#a3998c', { x, z: d / 2 - 0.6, r: 0.1 }); shrubs(b, r, [x], d / 2 - 0.6, 0.7); }
  },

  /** Little square with a statue, planters and benches. */
  plaza(b, r, w, d) {
    b.box(w, 0.14, d, '#e3dccd', { sharp: true });
    for (let k = 1; k < 6; k++) b.box(w, 0.15, 0.06, '#cfc6b5', { z: -d / 2 + (k * d) / 6, sharp: true });
    b.box(2.2, 1.0, 2.2, '#c9c3b8', { y: 0.14, r: 0.15 });
    b.box(1.4, 0.4, 1.4, '#b8b1a6', { y: 1.14, r: 0.1 });
    b.group({ y: 1.54 }, () => {
      b.box(0.5, 1.2, 0.4, '#8a9aa8', { mat: 'metal', r: 0.15 });
      b.sphere(0.32, '#8a9aa8', { y: 1.5, mat: 'metal' }, 10, 8);
      b.box(0.9, 0.18, 0.18, '#8a9aa8', { y: 1.0, rz: 0.4, mat: 'metal', r: 0.06 });
    });
    for (const [x, z] of [[-w / 2 + 1.6, -d / 2 + 1.6], [w / 2 - 1.6, -d / 2 + 1.6], [-w / 2 + 1.6, d / 2 - 1.6], [w / 2 - 1.6, d / 2 - 1.6]]) {
      b.box(2, 0.6, 2, '#c9c3b8', { x, z, r: 0.12 });
      b.cyl(0.12, 0.16, 1.6, '#7a5233', { x, y: 0.6, z }, 6);
      b.blob(1.1, pick(r, ['#4ca346', '#5cb84a', '#3f8f45']), { x, y: 2.6, z }, 1);
    }
    bench(b, { z: d / 2 - 2.6, ry: Math.PI });
    bench(b, { z: -d / 2 + 2.6 });
  },

  /** Railway station: stone hall with arched windows, clock tower, canopy over the tracks. */
  station(b, r, w, d) {
    const wall = '#efe2c9';
    b.box(w, 0.6, d, '#c9c3b8', { r: 0.1 });
    b.box(w * 0.55, 7.4, d - 3, wall, { y: 0.6, z: -1, r: 0.2 });
    brickLines(b, w * 0.55 - 0.1, 7.2, -1 + (d - 3) / 2 + 0.02, 0.6, wall, 0.8);
    for (let k = 0; k < 5; k++) {
      const x = -w * 0.275 + 1.6 + k * ((w * 0.55 - 3.2) / 4);
      b.box(1.5, 3.2, 0.12, PAL.lit, { x, y: 2.6, z: -1 + (d - 3) / 2 + 0.03, mat: 'lit', sharp: true });
      b.cyl(0.75, 0.75, 0.12, PAL.lit, { x, y: 5.8, z: -1 + (d - 3) / 2 + 0.03, rx: Math.PI / 2, mat: 'lit' }, 12);
      b.box(1.8, 0.2, 0.3, TRIM, { x, y: 2.4, z: -1 + (d - 3) / 2 + 0.1, r: 0.04 });
    }
    gable(b, { y: 8.0, z: -1, w: w * 0.55, d: d - 3, h: 2.6, color: '#b4513a' });
    b.box(4.8, 13, 4.8, wall, { x: w * 0.3, y: 0.6, z: -1, r: 0.2 });
    b.cyl(1.4, 1.4, 0.16, '#fbf7ef', { x: w * 0.3, y: 10.6, z: 1.45, rx: Math.PI / 2 }, 20);
    b.torus(1.4, 0.12, '#c9a24a', { x: w * 0.3, y: 10.6, z: 1.5, mat: 'gold' }, Math.PI * 2, 6, 20);
    b.box(0.1, 1.0, 0.08, PAL.dark, { x: w * 0.3, y: 10.6, z: 1.55, sharp: true });
    gable(b, { x: w * 0.3, y: 13.6, z: -1, w: 4.8, d: 4.8, h: 2.4, color: '#b4513a', wall });
    door(b, { x: -2, z: -1 + (d - 3) / 2 + 0.05, y: 0.6, w: 2.2, h: 2.8, color: '#3a3f47', glass: true });
    b.box(7, 1.1, 0.3, '#e0573f', { x: -2, y: 4.6, z: -1 + (d - 3) / 2 + 0.2, r: 0.1 });
    b.box(5.4, 0.6, 0.12, '#ffffff', { x: -2, y: 4.85, z: -1 + (d - 3) / 2 + 0.38, mat: 'neon', sharp: true });
    // platform canopy towards the tracks (−z)
    b.box(w, 0.25, 4, '#8a94a3', { y: 4, z: -d / 2 + 1.2, r: 0.08 });
    for (let x = -w / 2 + 2; x < w / 2; x += 6) b.box(0.25, 3.4, 0.25, PAL.dark, { x, y: 0.6, z: -d / 2 + 1.2, sharp: true, mat: 'metal' });
    for (let x = -w / 2 + 5; x < w / 2; x += 12) bench(b, { x, y: 0.6, z: -d / 2 + 1.6 });
    pots(b, r, [[-w / 2 + 1, d / 2 - 0.8], [w / 2 - 1, d / 2 - 0.8]]);
  },

  // ---------------- shopping ----------------
  /** Row of small shops, each with its own façade colour, awning and upper windows. */
  shoprow(b, r, w, d) {
    const n = Math.max(2, Math.round(w / 6.5)), sw = w / n, D = d - 2.4;
    b.box(w, 0.25, d, '#d9d3c7', { sharp: true });
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + (k + 0.5) * sw, wall = pick(r, WALLS), acc = pick(r, ACC);
      const H = 5.6 + (r() < 0.5 ? 0.8 : 0);
      b.group({ x }, () => {
        plankBox(b, sw - 0.1, H, D, wall, { y: 0.25, z: -1.2, dir: 'h', step: 0.36 });
        shopFront(b, { z: -1.2 + D / 2, w: sw - 0.8, acc, h: 2.4 });
        win(b, { x: -sw / 4, y: 4.1, z: -1.2 + D / 2 + 0.02, w: 0.9, h: 1.0, frame: TRIM, box: pick(r, FLOW) });
        win(b, { x: sw / 4, y: 4.1, z: -1.2 + D / 2 + 0.02, w: 0.9, h: 1.0, frame: TRIM });
        b.box(sw + 0.1, 0.5, D + 0.2, shade(wall, 0.8), { y: H + 0.25, z: -1.2, r: 0.08 });
        if (r() < 0.6) ac(b, { y: H + 0.75, z: -2.5, s: 0.8 });
      });
    }
    for (let k = 0; k <= n; k++) pots(b, r, [[-w / 2 + k * sw, d / 2 - 0.5]]);
  },

  /** Big-box store with signage, entrance canopy, trolley shelter and a car park. */
  bigbox(b, r, w, d) {
    const col = pick(r, ['#4b8fd8', '#e0573f', '#f2a541', '#3bb3a8', '#5f6875']);
    const D = 15;
    b.box(w, 0.06, d, '#5f6670', { sharp: true });
    b.box(w, 7.5, D, '#e9ecef', { z: -d / 2 + D / 2, r: 0.2 });
    for (let x = -w / 2 + 1; x < w / 2; x += 1.2) b.box(0.06, 7.2, 0.06, '#d6dbe0', { x, y: 0.15, z: -d / 2 + D + 0.02, sharp: true });
    b.box(w + 0.1, 1.6, D + 0.1, col, { y: 5.6, z: -d / 2 + D / 2, r: 0.1 });
    b.box(w * 0.4, 1.0, 0.2, '#ffffff', { y: 5.9, z: -d / 2 + D + 0.1, mat: 'neon', sharp: true });
    b.box(8, 3.2, 0.2, '#9cc9f0', { y: 0, z: -d / 2 + D + 0.05, mat: 'glass', sharp: true });
    b.box(10, 0.35, 3.4, col, { y: 3.4, z: -d / 2 + D + 1.6, r: 0.1 });
    for (const x of [-4.6, 4.6]) b.box(0.25, 3.4, 0.25, '#5f6875', { x, z: -d / 2 + D + 3.1, sharp: true });
    b.box(4, 2.4, 1.6, '#cfd4da', { x: w / 2 - 3, z: -d / 2 + D + 1.4, r: 0.06, mat: 'glass' });
    flatTop(b, r, w - 1, D - 1, 7.5, -d / 2 + D / 2);
    const pz0 = -d / 2 + D + 4.5;
    for (let x = -w / 2 + 2; x < w / 2 - 1; x += 2.8) {
      b.box(0.12, 0.02, 4.4, '#f8f9fa', { x, y: 0.06, z: pz0 + 3, sharp: true });
      b.box(0.12, 0.02, 4.4, '#f8f9fa', { x, y: 0.06, z: pz0 + 11, sharp: true });
      if (r() < 0.55) car(b, x + 1.4, pz0 + 3, (Math.PI / 2) * (r() < 0.5 ? 1 : -1), pick(r, CAR_COLS));
      if (r() < 0.4) car(b, x + 1.4, pz0 + 11, (Math.PI / 2) * (r() < 0.5 ? 1 : -1), pick(r, CAR_COLS));
    }
    for (const x of [-w / 2 + 0.8, w / 2 - 0.8]) { b.box(1.2, 0.5, 12, '#7cbc4f', { x, z: pz0 + 7, r: 0.1 }); shrubs(b, r, [x], pz0 + 4, 0.7); shrubs(b, r, [x], pz0 + 10, 0.7); }
  },

  /** Petrol station: canopy with lights, pump islands, shop with awning, price sign. */
  gas(b, r, w, d) {
    const acc = pick(r, ['#e0573f', '#4b8fd8', '#3bb3a8']);
    b.box(w, 0.08, d, '#8d939b', { sharp: true });
    b.box(10, 0.7, 7.6, '#f8f9fa', { y: 5, z: 1, r: 0.15 });
    b.box(10.1, 0.35, 7.7, acc, { y: 5.15, z: 1, r: 0.1 });
    for (let k = 0; k < 4; k++) b.box(1.2, 0.06, 0.6, PAL.lit, { x: -3.3 + k * 2.2, y: 4.96, z: 1, mat: 'lit', sharp: true });
    for (const x of [-2.6, 2.6]) {
      b.box(0.4, 5, 0.4, '#f1f3f5', { x, z: 1, r: 0.1 });
      b.box(1.6, 0.3, 3.6, '#d6d0c6', { x, z: 1, r: 0.06 });
      for (const z of [0.2, 1.8]) {
        b.box(0.8, 1.7, 0.6, acc, { x, y: 0.3, z, r: 0.12 });
        b.box(0.5, 0.4, 0.05, '#2e3440', { x, y: 1.4, z: z + 0.31, mat: 'lit', sharp: true });
      }
    }
    b.box(8, 3.4, 4.5, '#f8f9fa', { z: -d / 2 + 2.6, r: 0.15 });
    shopFront(b, { z: -d / 2 + 4.86, w: 7, acc, h: 2.2 });
    b.box(1.2, 6, 0.3, acc, { x: w / 2 - 1, z: d / 2 - 1, r: 0.1 });
    b.box(1.0, 2.2, 0.34, '#ffffff', { x: w / 2 - 1, y: 3.4, z: d / 2 - 1, mat: 'neon', sharp: true });
    shrubs(b, r, [-w / 2 + 1], d / 2 - 1, 0.7);
  },

  /** Shopping mall: glass atrium, signage, entrance plaza with planters. */
  mall(b, r, w, d) {
    b.box(w, 0.1, d, '#d9d3c7', { sharp: true });
    b.box(w - 2, 9, d - 8, '#eef1f4', { z: -3, r: 0.3 });
    for (let x = -w / 2 + 2; x < w / 2 - 1; x += 1.6) b.box(0.08, 8.6, 0.08, '#d6dbe0', { x, y: 0.2, z: -3 + (d - 8) / 2 + 0.02, sharp: true });
    b.box(w - 2.2, 2.4, 0.12, PAL.lit, { y: 1, z: -3 + (d - 8) / 2 + 0.04, mat: 'lit', sharp: true });
    b.box(w - 1.6, 0.4, d - 7.6, '#8b5cf6', { y: 9, z: -3, r: 0.1 });
    b.box(12, 12, 10, '#9cc9f0', { z: d / 2 - 9, mat: 'glass', r: 0.4 });
    for (let y = 2; y < 12; y += 2.4) b.box(12.1, 0.12, 10.1, TRIM, { y, z: d / 2 - 9, sharp: true });
    b.sphere(6, '#bfe3ff', { y: 12, z: d / 2 - 9, sy: 0.45, mat: 'glass' }, 20, 8, Math.PI / 2);
    b.box(16, 1.6, 0.4, '#8b5cf6', { y: 9.4, z: d / 2 - 3.8, r: 0.15 });
    b.box(12, 0.9, 0.2, '#ffffff', { y: 9.8, z: d / 2 - 3.5, mat: 'neon', sharp: true });
    awning(b, { x: -w / 4 - 2, y: 3.6, z: -3 + (d - 8) / 2 + 0.1, w: 8, depth: 1.4, colors: ['#ffffff', '#e86aa1'] });
    awning(b, { x: w / 4 + 2, y: 3.6, z: -3 + (d - 8) / 2 + 0.1, w: 8, depth: 1.4, colors: ['#ffffff', '#3bb3a8'] });
    for (const x of [-w / 2 + 5, w / 2 - 5]) { ac(b, { x, y: 9.4, z: -8 }); ac(b, { x: x * 0.6, y: 9.4, z: -10 }); }
    for (let k = 0; k < 6; k++) {
      const x = -w / 2 + 4 + k * ((w - 8) / 5);
      b.box(1.8, 0.6, 1.8, '#c9c3b8', { x, z: d / 2 - 1.5, r: 0.1 });
      shrubs(b, r, [x], d / 2 - 1.5, 0.8);
    }
    for (let k = 0; k < 3; k++) bench(b, { x: -6 + k * 6, z: d / 2 - 3.2, ry: Math.PI });
  },

  // ---------------- industry ----------------
  /** Warehouse: ribbed walls, saw-tooth skylights, loading docks with roll doors, truck. */
  warehouse(b, r, w, d) {
    const wall = pick(r, ['#c9c3b8', '#b8c4cc', '#d6c9b0', '#a9b4bf', '#c2cbb8']);
    const acc = pick(r, ACC);
    b.box(w + 2, 0.08, d + 2, '#9aa1a8', { sharp: true });
    b.box(w, 7, d, wall, { r: 0.2 });
    for (let x = -w / 2 + 0.5; x < w / 2; x += 0.7) b.box(0.06, 6.6, 0.06, shade(wall, 0.85), { x, y: 0.2, z: d / 2 + 0.02, sharp: true });
    const n = Math.max(2, Math.round(w / 8));
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + (k + 0.5) * (w / n);
      b.prism(d, 1.6, w / n, '#8a94a3', { x, y: 7, ry: Math.PI / 2 });
      b.box(w / n - 1.2, 1.0, 0.1, '#cfe8ff', { x, y: 7.2, z: 0, mat: 'lit', ry: 0, sharp: true });
      rollDoor(b, { x, z: d / 2, w: Math.min(3.4, w / n - 1.6), h: 3.2, color: shade(wall, 0.7) });
      b.box(Math.min(4, w / n - 1), 1.0, 1.8, '#6b7280', { x, z: d / 2 + 0.9, r: 0.06 }); // dock
    }
    b.box(w * 0.3, 0.9, 0.3, acc, { x: -w / 4, y: 5.4, z: d / 2 + 0.1, r: 0.1 });
    b.box(w * 0.22, 0.4, 0.08, '#ffffff', { x: -w / 4, y: 5.65, z: d / 2 + 0.28, mat: 'neon', sharp: true });
    pipe(b, { x: w / 2 - 0.6, z: d / 2, h: 7.6, color: '#8a94a3' });
    if (r() < 0.7) b.group({ x: w / 4, z: d / 2 + 4.5, ry: Math.PI / 2 }, () => {
      b.rbox(6, 2.6, 2.3, 0.15, '#f1f3f5', { x: -0.8, y: 0.7 });
      b.rbox(1.8, 2.2, 2.2, 0.3, pick(r, ACC), { x: 3, y: 0.7 });
      b.box(0.9, 0.8, 2.1, '#bfe3ff', { x: 3.6, y: 1.8, mat: 'glass', sharp: true });
      for (const x of [-2.8, -1.4, 3]) for (const z of [-1, 1]) b.cyl(0.42, 0.42, 0.3, '#22262d', { x, y: 0.42, z: z - Math.sign(z) * 0.15, rx: Math.PI / 2 }, 10);
    });
    for (let k = 0; k < 3; k++) crate(b, { x: -w / 2 + 1.5 + k * 1.2, z: d / 2 + 1.5, s: 0.9 });
  },

  /** Factory: brick hall with saw-tooth roof, striped chimney, tanks, pipes and stacks of barrels. */
  factory(b, r, w, d) {
    const wall = pick(r, ['#c5553f', '#b8c4cc', '#d6c9b0', '#bfa58a']);
    b.box(w + 2, 0.08, d + 2, '#9aa1a8', { sharp: true });
    b.box(w * 0.65, 8, d, wall, { x: -w * 0.175, r: 0.2 });
    brickLines(b, w * 0.65 - 0.1, 7.8, d / 2 + 0.02, 0.1, wall, 0.4);
    for (let k = 0; k < 4; k++) {
      b.prism(w * 0.65, 2.2, d * 0.25, '#6b7584', { x: -w * 0.175, y: 8, z: -d * 0.375 + k * d * 0.25, sharp: true });
      b.box(w * 0.65 - 0.4, 1.2, 0.08, '#cfe8ff', { x: -w * 0.175, y: 8.4, z: -d * 0.375 + k * d * 0.25 + 0.5, mat: 'lit', sharp: true });
    }
    for (let k = 0; k < 4; k++) win(b, { x: -w * 0.175 - w * 0.25 + k * (w * 0.5 / 3), y: 4.2, z: d / 2 + 0.02, w: 1.3, h: 1.6, frame: '#f1e3d3', glass: '#ffcf70' });
    rollDoor(b, { x: -w * 0.175, z: d / 2, w: 3.6, h: 3.0, color: '#5d6b7a' });
    b.box(w * 0.3, 5, d * 0.6, shade(wall, 0.9), { x: w * 0.33, z: -d * 0.15, r: 0.2 });
    const cx = w * 0.33, cz = d * 0.25;
    b.cyl(1.0, 1.4, 17, '#c1440e', { x: cx, z: cz }, 14);
    for (let k = 0; k < 3; k++) b.cyl(1.1 - k * 0.04, 1.12 - k * 0.04, 0.7, '#f8f9fa', { x: cx, y: 12 + k * 1.6, z: cz }, 14);
    b.torus(1.0, 0.18, '#3d3d3d', { x: cx, y: 17, z: cz, rx: Math.PI / 2 }, Math.PI * 2, 6, 16);
    for (const z of [-d * 0.35, -d * 0.1]) {
      b.cyl(1.4, 1.4, 5, '#d6dce4', { x: w * 0.42, z, mat: 'metal' }, 16);
      b.sphere(1.4, '#e9ecef', { x: w * 0.42, y: 5, z, mat: 'metal' }, 16, 8, Math.PI / 2);
    }
    for (const px of [-w * 0.4, -w * 0.1]) b.cyl(0.25, 0.25, d * 0.9, '#9aa4b1', { x: px, y: 8.5, rx: Math.PI / 2, mat: 'metal' }, 8);
    for (let k = 0; k < 4; k++) barrel(b, { x: w * 0.2 + (k % 2) * 0.9, z: d / 2 + 0.8 + Math.floor(k / 2) * 0.9, color: pick(r, ['#3d6fb8', '#e0573f', '#f2c14e']) });
  },

  /** Grain / cement silos with ladders, catwalk and conveyor. */
  silo(b, r, w, d) {
    b.box(w, 0.08, d, '#9aa1a8', { sharp: true });
    const col = pick(r, ['#f1f3f5', '#d6dbe0', '#c9b79c']);
    for (const [x, z] of [[-3, -2.5], [3, -2.5], [0, 2.8]]) {
      b.cyl(2.6, 2.6, 13, col, { x, z, mat: 'metal' }, 18);
      b.cone(2.7, 1.6, '#9aa4b1', { x, y: 13, z, mat: 'metal' }, 18);
      for (let k = 1; k < 5; k++) b.torus(2.62, 0.08, shade(col, 0.85), { x, y: k * 2.6, z, rx: Math.PI / 2 }, Math.PI * 2, 4, 24);
      for (const dx of [-0.25, 0.25]) b.box(0.06, 12.6, 0.06, '#5f6875', { x: x + dx, y: 0.3, z: z + 2.65, sharp: true });
      for (let y = 0.6; y < 12.6; y += 0.6) b.box(0.56, 0.06, 0.06, '#5f6875', { x, y, z: z + 2.65, sharp: true });
    }
    b.box(1.2, 16, 1.2, '#5f6875', { x: 0, z: -0.2, mat: 'metal', sharp: true });
    b.box(8, 0.6, 1.0, '#5f6875', { y: 14.6, z: -0.2, mat: 'metal', r: 0.06 });
    b.box(2.4, 2.6, 2.4, '#e0573f', { x: w / 2 - 1.6, z: d / 2 - 1.6, r: 0.12 });
  },

  /** Container yard with a gantry crane and a truck. */
  yard(b, r, w, d) {
    b.box(w, 0.08, d, '#8d939b', { sharp: true });
    const cols = ['#e0573f', '#4b8fd8', '#f2a541', '#3bb3a8', '#8b5cf6', '#5fb35a', '#c9c3b8'];
    for (let row = 0; row < 4; row++) for (let k = 0; k < 3; k++) {
      const h = 1 + ((r() * 3) | 0);
      for (let lvl = 0; lvl < h; lvl++) {
        const c = pick(r, cols), x = -w / 2 + 4 + k * 6.8, z = -d / 2 + 2.5 + row * 3.4;
        b.box(6, 2.4, 2.4, c, { x, y: lvl * 2.45, z, r: 0.08 });
        for (let q = 0; q < 7; q++) b.box(0.06, 2.1, 2.42, shade(c, 0.78), { x: x - 2.6 + q * 0.85, y: lvl * 2.45 + 0.15, z, sharp: true });
      }
    }
    for (const x of [-w / 2 + 0.5, w / 2 - 0.5]) b.box(0.5, 10, 0.5, '#ffc93c', { x, z: d / 2 - 1.5, r: 0.1 });
    b.box(w, 0.8, 0.8, '#ffc93c', { y: 10, z: d / 2 - 1.5, r: 0.12 });
    b.box(1.6, 1.2, 1.4, '#495057', { x: (r() - 0.5) * (w - 4), y: 8.8, z: d / 2 - 1.5, r: 0.1 });
  },

  // ---------------- housing ----------------
  /** Swiss chalet: masonry ground floor, wooden upper floor with balcony and flower boxes. */
  chalet(b, r, w, d) {
    const wall = pick(r, ['#fbf7ef', '#f2e6d0', '#e8dccb']);
    const wood = pick(r, ['#b86b31', '#9c5b2b', '#c27a3c']);
    b.box(w, 0.1, d, '#7cbc4f', { sharp: true });
    path(b, 0.4, d / 2, 1.2, 1.3);
    const hw = Math.min(8.4, w - 2.6), z0 = -1.6;
    b.group({ z: z0 }, () => {
      b.box(hw + 0.2, 0.4, 6.8, '#a3998c', { r: 0.08 });
      b.box(hw, 2.8, 6.4, wall, { y: 0.4, r: 0.12 });
      plankBox(b, hw, 2.6, 6.4, wood, { y: 3.2, dir: 'h', step: 0.3 });
      gable(b, { y: 5.8, w: 6.4, d: hw, h: 2.4, ry: Math.PI / 2, color: '#5c3d24', wall: wood, over: 0.8 });
      for (const x of [-hw / 2 + 1.4, hw / 2 - 1.4]) win(b, { x, y: 1.3, z: 3.22, w: 0.9, h: 1.0, frame: TRIM, shutters: '#3f8f5a' });
      door(b, { x: 0, y: 0.4, z: 3.22, w: 1.0, h: 2.1, color: '#7a4a28' });
      balcony(b, { y: 3.2, z: 3.2, w: hw + 0.2, d: 1.1, color: wood });
      for (const x of [-hw / 2 + 1.2, 0, hw / 2 - 1.2]) win(b, { x, y: 3.9, z: 3.22, w: 0.8, h: 1.0, frame: '#f6f2ea' });
      for (let k = 0; k < 4; k++) b.box(1.0, 0.3, 0.3, '#e0573f', { x: -hw / 2 + 1 + k * ((hw - 2) / 3), y: 4.2, z: 4.25, r: 0.06 });
      for (let k = 0; k < 4; k++) b.sphere(0.12, '#ff3d5a', { x: -hw / 2 + 1 + k * ((hw - 2) / 3), y: 4.55, z: 4.3 }, 6, 4);
      chimney(b, { x: hw / 4, y: 6.4, z: -1.6, h: 2.2, w: 0.7, color: '#a3998c' });
    });
    if (r() < 0.5) car(b, -w / 2 + 2, d / 2 - 2.6, 0, pick(r, CAR_COLS));
    else for (let k = 0; k < 4; k++) b.cyl(0.18, 0.18, 1.0, '#a0612f', { x: -w / 2 + 1.2, y: 0.18 + Math.floor(k / 2) * 0.36, z: -2 + (k % 2) * 0.4, rx: Math.PI / 2 }, 6);
    shrubs(b, r, [-w / 2 + 1, w / 2 - 1], d / 2 - 0.8, 0.8);
    for (let x = -w / 2 + 0.2; x <= w / 2; x += 0.9) b.box(0.08, 0.8, 0.08, '#c98a4b', { x, z: d / 2 - 0.1, sharp: true });
    b.box(w, 0.08, 0.1, '#c98a4b', { y: 0.65, z: d / 2 - 0.1, sharp: true });
  },

  /** Modern villa with pool, terrace and garden. */
  villa(b, r, w, d) {
    b.box(w, 0.1, d, '#7cbc4f', { sharp: true });
    path(b, 2, d / 2, -3, 1.6);
    b.group({ z: -1.8 }, () => {
      b.box(9.2, 0.3, 7.2, '#d9d3c7', { x: -1, r: 0.06 });
      b.box(9, 3.2, 7, '#fbf7ef', { x: -1, y: 0.3, r: 0.2 });
      b.box(8.6, 2.4, 0.12, '#9cc9f0', { x: -1, y: 0.7, z: 3.52, mat: 'glass', sharp: true });
      for (let x = -5; x < 3.5; x += 1.45) b.box(0.08, 2.4, 0.16, '#3a3f47', { x, y: 0.7, z: 3.55, sharp: true });
      plankBox(b, 6, 3.0, 5.5, '#c98a4b', { x: 1.5, y: 3.5, z: -0.6, dir: 'v', step: 0.3 });
      b.box(4.6, 2.0, 0.12, '#9cc9f0', { x: 1.5, y: 4.0, z: 2.17, mat: 'glass', sharp: true });
      b.box(9.6, 0.3, 7.6, '#3a3f47', { x: -1, y: 3.5, r: 0.06 });
      b.box(6.4, 0.3, 5.9, '#3a3f47', { x: 1.5, y: 6.5, z: -0.6, r: 0.06 });
      balcony(b, { x: -3, y: 3.5, z: 2.2, w: 4, d: 1.4, color: '#c9c3b8', rail: '#bfe3ff', plants: true });
    });
    b.box(6, 0.2, 3.6, '#d6d0c6', { x: 2.5, y: 0.05, z: d / 2 - 3.2, r: 0.06 });
    b.box(5.2, 0.14, 2.8, '#4fc3f7', { x: 2.5, y: 0.15, z: d / 2 - 3.2, mat: 'soft', sharp: true });
    for (const x of [0.4, 4.6]) b.box(0.7, 0.2, 1.8, '#f8f9fa', { x, y: 0.3, z: d / 2 - 0.8, r: 0.06 });
    b.cyl(0.04, 0.04, 2.2, PAL.dark, { x: 5.6, z: d / 2 - 0.9 }, 6);
    b.cone(1.2, 0.5, '#e86aa1', { x: 5.6, y: 2.1, z: d / 2 - 0.9 }, 10);
    shrubs(b, r, [-w / 2 + 1, w / 2 - 1, -w / 2 + 1], d / 2 - 0.8, 0.8);
    for (const x of [-w / 2 + 0.4, w / 2 - 0.4]) b.box(0.6, 0.9, d - 1, '#3f8f45', { x, r: 0.25 });
  },

  /** Row of three brick townhouses with stoops and window boxes. */
  rowhouse(b, r, w, d) {
    b.box(w, 0.1, d, '#7cbc4f', { sharp: true });
    const n = 3, uw = w / n;
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + (k + 0.5) * uw, wall = pick(r, ['#c5553f', '#8fb9e3', '#f3d36b', '#d9ead3', '#e9c9b0']);
      b.group({ x, z: -1.6 }, () => {
        b.box(uw - 0.1, 0.5, 7.2, '#a3998c', { r: 0.06 });
        b.box(uw - 0.1, 5.4, 7, wall, { y: 0.5, r: 0.12 });
        brickLines(b, uw - 0.2, 5.3, 3.52, 0.5, wall, 0.45);
        gable(b, { y: 5.9, w: uw, d: 7, h: 2.2, color: pick(r, [ROOF, '#c0583d']), wall });
        win(b, { x: -uw / 4, y: 1.5, z: 3.52, w: 0.9, h: 1.2, frame: TRIM, box: pick(r, FLOW) });
        win(b, { x: -uw / 4, y: 3.9, z: 3.52, w: 0.9, h: 1.2, frame: TRIM });
        win(b, { x: uw / 4, y: 3.9, z: 3.52, w: 0.9, h: 1.2, frame: TRIM });
        door(b, { x: uw / 4, y: 0.9, z: 3.52, w: 0.9, h: 2.0, color: pick(r, SHUT) });
        for (let s = 0; s < 3; s++) b.box(1.3, 0.8 - s * 0.26, 0.4, '#d9d3c7', { x: uw / 4, z: 3.75 + s * 0.38, r: 0.04 });
        chimney(b, { x: -uw / 4, y: 6.6, z: -1.8, h: 1.8, w: 0.6, color: '#c25b3f' });
      });
      shrubs(b, r, [x - uw / 4], d / 2 - 1.2, 0.7);
    }
  },

  /** Apartment block: framed windows, balconies with plants, entrance porch, flat roof. */
  apartment(b, r, w, d) {
    const wall = pick(r, WALLS);
    const floors = 4 + ((r() * 3) | 0);
    const D = d - 3, z0 = -0.8;
    b.box(w, 0.3, d, '#d6d0c6', { r: 0.08 });
    b.box(w - 1, 0.6 + floors * 2.7, D, wall, { y: 0.3, z: z0, r: 0.2 });
    for (let f = 0; f < floors; f++) {
      b.box(w - 0.8, 0.14, D + 0.2, shade(wall, 0.85), { y: 0.9 + f * 2.7, z: z0, r: 0.04 });
      const n = Math.max(3, Math.round((w - 2) / 2.6));
      for (let k = 0; k < n; k++) {
        const x = -w / 2 + 1.2 + ((k + 0.5) * (w - 2.4)) / n;
        win(b, { x, y: 1.4 + f * 2.7, z: z0 + D / 2 + 0.02, w: 0.9, h: 1.3, frame: TRIM, box: f === 0 && r() < 0.5 ? pick(r, FLOW) : null });
      }
      if (f > 0) for (const x of [-w / 4, w / 4]) balcony(b, { x, y: 0.95 + f * 2.7, z: z0 + D / 2 + 0.05, w: 2.6, d: 0.9, color: '#e9e2d6', rail: '#5f6875', plants: r() < 0.5 });
    }
    flatTop(b, r, w - 1, D, 0.9 + floors * 2.7, z0);
    porch(b, { z: z0 + D / 2 + 1.0, w: 3.4, d: 1.8, deck: 0.4, roofY: 2.9, roof: '#3a3f47' });
    door(b, { y: 0.7, z: z0 + D / 2 + 0.05, w: 1.3, h: 2.1, color: '#3d6fb8', glass: true });
    shrubs(b, r, [-w / 2 + 1.2, w / 2 - 1.2], d / 2 - 0.8, 0.8);
  },

  // ---------------- countryside ----------------
  /** Red barn with a gambrel roof, big doors, hay bales and a fence. */
  barn(b, r, w, d) {
    const red = '#b8452f';
    plankBox(b, w - 1, 4.4, d - 2, red, { z: -1, dir: 'v', step: 0.45 });
    gable(b, { y: 4.4, z: -1, w: w - 1, d: d - 2, h: 3.2, color: '#5f6875', wall: red, over: 0.5 });
    b.box(3.6, 3.6, 0.16, '#f1ece2', { z: (d - 2) / 2 - 1 + 0.05, r: 0.05 });
    b.box(3.2, 3.2, 0.18, red, { y: 0.2, z: (d - 2) / 2 - 1 + 0.08, r: 0.04 });
    for (const rz of [0.78, -0.78]) b.box(0.18, 4.2, 0.1, '#f1ece2', { y: 0.1, z: (d - 2) / 2 - 1 + 0.18, rz, sharp: true });
    win(b, { y: 5.4, z: (d - 2) / 2 - 1 + 0.02, w: 1.0, h: 0.9, frame: '#f1ece2' });
    for (let k = 0; k < 3; k++) b.cyl(0.8, 0.8, 1.4, '#e2c56b', { x: -w / 2 + 1.5 + k * 1.9, y: 0.8, z: d / 2 - 0.6, rz: Math.PI / 2 }, 12);
    for (let x = -w / 2; x <= w / 2; x += 1.6) b.box(0.12, 1.0, 0.12, '#9c6b3f', { x, z: d / 2, sharp: true });
    b.box(w, 0.1, 0.1, '#9c6b3f', { y: 0.8, z: d / 2, sharp: true });
  },

  /** Big Bernese farmhouse: masonry base, wooden storey, huge roof, balcony with geraniums. */
  farmhouse(b, r, w, d) {
    b.box(w - 4, 3.2, d - 4, '#f1ece2', { r: 0.2 });
    plankBox(b, w - 4, 3.4, d - 4, '#b86b31', { y: 3.2, dir: 'h', step: 0.32 });
    for (let k = 0; k < 5; k++) win(b, { x: -w / 2 + 4 + k * ((w - 8) / 4), y: 1.2, z: (d - 4) / 2 + 0.02, w: 0.9, h: 1.0, frame: TRIM, shutters: '#3f8f5a' });
    balcony(b, { y: 3.2, z: (d - 4) / 2, w: w - 4.4, d: 1.0, color: '#9c5b2b' });
    for (let k = 0; k < 6; k++) win(b, { x: -w / 2 + 3.6 + k * ((w - 7.2) / 5), y: 4.2, z: (d - 4) / 2 + 0.02, w: 0.8, h: 0.9, frame: '#f6f2ea' });
    for (let k = 0; k < 6; k++) b.box(0.9, 0.3, 0.3, '#e0573f', { x: -w / 2 + 3.6 + k * ((w - 7.2) / 5), y: 4.25, z: (d - 4) / 2 + 1.1, r: 0.06 });
    gable(b, { y: 6.6, w: w - 3, d: d - 3, h: 5.0, color: '#6b4a2b', wall: '#b86b31', over: 0.9 });
    door(b, { x: 2, y: 0, z: (d - 4) / 2 + 0.05, w: 1.2, h: 2.3, color: '#7a4a28' });
    for (let k = 0; k < 4; k++) b.cyl(0.8, 0.8, 1.4, '#e2c56b', { x: w / 2 - 1.5, y: 0.8, z: -d / 2 + 2 + k * 1.9, rx: Math.PI / 2 }, 12);
    barrel(b, { x: -w / 2 + 1.5, z: d / 2 - 1.5 });
    pots(b, r, [[-1, d / 2 - 1.4], [3.4, d / 2 - 1.4]]);
  },
};
