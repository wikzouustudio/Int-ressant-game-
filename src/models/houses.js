import { PAL, shade, plankBox, win, door, stairs, awning, balcony, chimney, pot, barrel } from './kit.js';

// Detailed cartoon houses (reference sheet style): clapboard siding, shingled gable
// roofs, shutters, porches with balustrades, dormers, brick chimneys, flower boxes,
// steps and lots of plants. Each model draws a lot centred on the origin, front = +z.

const ROOF = '#4f5566';
const TRIM = '#fbf7ef';
const pick = (r, a) => a[(r() * a.length) | 0];

/** Shingled gable roof, ridge along X. y = eaves height. `wall` fills the gable ends. */
function gable(b, o) {
  const { w, d, h, color = ROOF, over = 0.45, wall } = o;
  const half = d / 2 + over;
  const len = Math.hypot(half, h);
  const ang = Math.atan2(h, half);
  b.group({ x: o.x || 0, y: o.y || 0, z: o.z || 0, ry: o.ry || 0 }, () => {
    if (wall) b.prism(w - 0.04, h - 0.05, d - 0.04, wall, {});
    for (const side of [1, -1]) {
      b.group({ z: (side * half) / 2, y: h / 2, rx: side * ang }, () => {
        b.box(w + over * 2, 0.2, len + 0.12, color, { y: -0.1, r: 0.06 });
        for (let z = -len / 2 + 0.35; z < len / 2; z += 0.42) b.box(w + over * 2 + 0.02, 0.05, 0.07, shade(color, 0.78), { y: 0.08, z, sharp: true });
        b.box(w + over * 2 + 0.06, 0.12, 0.18, TRIM, { y: -0.16, z: len / 2, r: 0.04 }); // fascia
      });
    }
    b.box(w + over * 2 + 0.1, 0.18, 0.34, shade(color, 0.82), { y: h - 0.08, r: 0.06 });
    // white trim along the gable ends
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.group({ x: sx * (w / 2 + 0.02), z: (sz * half) / 2, y: h / 2, rx: sz * ang }, () => b.box(0.14, 0.18, len, TRIM, { y: -0.12, r: 0.04 }));
    }
  });
}

/** Dormer window sitting on a roof slope facing +z. */
function dormer(b, o) {
  const { x = 0, y, z, wall = '#cfe1f2' } = o;
  b.group({ x, y, z }, () => {
    b.box(1.6, 1.5, 1.6, wall, { r: 0.1 });
    win(b, { y: 0.35, z: 0.82, w: 0.8, h: 0.8, frame: TRIM });
    gable(b, { y: 1.5, w: 1.6, d: 1.7, h: 0.8, over: 0.2, wall, ry: Math.PI / 2 });
  });
}

/** Porch: deck, steps, posts, balustrade and a small roof. */
function porch(b, o) {
  const { x = 0, z, w, d = 2.2, deck = 0.6, roofY = 3.0, post = TRIM, rail = TRIM, roof = ROOF, stair = 0, stone } = o;
  b.group({ x, z }, () => {
    b.box(w, deck, d, o.floor || '#c98a4b', { z: 0, r: 0.08 });
    const steps = Math.max(1, Math.round(deck / 0.2));
    stairs(b, { x: stair, z: d / 2, w: 1.6, steps, color: o.stepColor || '#d9cbb3' });
    const posts = [-w / 2 + 0.2, w / 2 - 0.2];
    if (w > 5) posts.push(-w / 6, w / 6);
    for (const px of posts) {
      if (stone) b.box(0.7, 1.2, 0.7, '#9a948a', { x: px, y: deck, z: d / 2 - 0.35, r: 0.12 });
      b.box(0.22, roofY - deck - (stone ? 1.2 : 0), 0.22, post, { x: px, y: deck + (stone ? 1.2 : 0), z: d / 2 - 0.35, r: 0.05 });
    }
    // balustrade on each side of the steps
    for (const [a0, a1] of [[-w / 2 + 0.2, stair - 0.9], [stair + 0.9, w / 2 - 0.2]]) {
      if (a1 - a0 < 0.4) continue;
      const mid = (a0 + a1) / 2;
      b.box(a1 - a0, 0.1, 0.12, rail, { x: mid, y: deck + 0.8, z: d / 2 - 0.35, r: 0.03 });
      b.box(a1 - a0, 0.08, 0.1, rail, { x: mid, y: deck + 0.12, z: d / 2 - 0.35, sharp: true });
      for (let px = a0 + 0.15; px < a1; px += 0.24) b.box(0.07, 0.7, 0.07, rail, { x: px, y: deck + 0.12, z: d / 2 - 0.35, sharp: true });
    }
    b.group({ y: roofY, z: 0.15, rx: 0.12 }, () => {
      b.box(w + 0.5, 0.2, d + 0.6, roof, { r: 0.06 });
      b.box(w + 0.55, 0.14, 0.14, TRIM, { y: -0.05, z: (d + 0.6) / 2, r: 0.04 });
    });
  });
}

function shrubs(b, r, xs, z, s = 1) {
  for (const x of xs) {
    const c = pick(r, ['#4ca346', '#3f8f45', '#5cb84a', '#6aa84f']);
    b.blob(0.5 * s, c, { x, y: 0.42 * s, z, sy: 0.85 }, 1);
    b.blob(0.32 * s, shade(c, 1.15), { x: x + 0.3 * s, y: 0.75 * s, z: z + 0.1 }, 1);
    if (r() < 0.4) b.sphere(0.09, pick(r, ['#ff6b9a', '#ffd43b', '#ffffff']), { x: x - 0.2, y: 0.85 * s, z: z + 0.35 }, 6, 4);
  }
}
function pots(b, r, list) {
  for (const [x, z] of list) pot(b, { x, z, color: pick(r, ['#c56b4f', '#b4513a', '#d98c5f']), flower: r() < 0.6 ? pick(r, ['#ff6b9a', '#ffd43b', '#ffffff']) : null });
}
function path(b, z0, z1, x = 0, w = 1.4) {
  b.box(w, 0.08, z1 - z0, '#d9d3c7', { x, z: (z0 + z1) / 2, sharp: true });
}
function brickLines(b, w, h, z, y0, color, step = 0.32) {
  for (let y = y0 + step; y < y0 + h - 0.1; y += step) b.box(w, 0.04, 0.04, shade(color, 0.75), { y, z, sharp: true });
}
function garageDoor(b, o) {
  const { x, z, w = 2.6, h = 2.2, color = '#fbf7ef' } = o;
  b.box(w + 0.3, h + 0.2, 0.12, TRIM, { x, z: z - 0.02, r: 0.05 });
  b.box(w, h, 0.12, color, { x, z: z + 0.03, r: 0.04 });
  for (let y = 0.5; y < h; y += 0.5) b.box(w - 0.1, 0.05, 0.05, shade(color, 0.85), { x, y, z: z + 0.1, sharp: true });
  for (let k = 0; k < 4; k++) b.box(w / 5, 0.28, 0.05, PAL.lit, { x: x - w / 2 + (k + 0.75) * (w / 4.4), y: h - 0.55, z: z + 0.1, mat: 'lit', sharp: true });
}

export const HOUSES = {
  /** Yellow two-storey colonial, blue shutters, porch and garage. */
  hColonial(b, r) {
    const wall = '#f3d36b';
    plankBox(b, 7.4, 5.6, 6.4, wall, { x: -1.4, y: 0.3, z: -1.2, dir: 'h', step: 0.34 });
    b.box(7.6, 0.3, 6.6, '#cfc5b4', { x: -1.4, z: -1.2, r: 0.08 });
    gable(b, { x: -1.4, y: 5.9, z: -1.2, w: 7.4, d: 6.4, h: 2.6, wall });
    plankBox(b, 3.6, 3.0, 5.4, wall, { x: 4.0, y: 0.3, z: -0.7, dir: 'h', step: 0.34 });
    gable(b, { x: 4.0, y: 3.3, z: -0.7, w: 3.6, d: 5.4, h: 1.5, wall });
    garageDoor(b, { x: 4.0, z: 2.0, w: 2.6, h: 2.3 });
    for (const x of [-3.6, 0.8]) win(b, { x, y: 1.4, z: 2.0, w: 1.0, h: 1.2, frame: TRIM, shutters: '#3d6fb8' });
    for (const x of [-3.6, -1.4, 0.8]) win(b, { x, y: 4.0, z: 2.0, w: 1.0, h: 1.2, frame: TRIM, shutters: '#3d6fb8' });
    win(b, { x: 2.32, y: 4.0, z: -1.2, w: 0.9, h: 1.1, frame: TRIM, ry: Math.PI / 2 });
    door(b, { x: -1.4, y: 0.9, z: 2.0, color: '#3d6fb8', w: 1.1, h: 2.1 });
    porch(b, { x: -1.4, z: 3.1, w: 6.8, d: 2.2, deck: 0.6, roofY: 3.2 });
    chimney(b, { x: -4.2, y: 6.0, z: -2.6, h: 3.4, w: 0.9, color: '#c25b3f' });
    b.box(2.8, 0.06, 3.2, '#d9d3c7', { x: 4.0, z: 3.7, sharp: true });
    shrubs(b, r, [-5.0, 2.0], 4.3);
    shrubs(b, r, [-5.4, -4.6], 0.0, 0.8);
    pots(b, r, [[1.6, 4.4], [-4.3, 4.6]]);
  },

  /** Blue Cape Cod with two dormers, red door and flower boxes. */
  hCape(b, r) {
    const wall = '#8fb9e3';
    b.box(8.0, 0.4, 6.2, '#cfc5b4', { z: -1, r: 0.08 });
    plankBox(b, 7.6, 3.2, 5.8, wall, { y: 0.4, z: -1, dir: 'h', step: 0.34 });
    gable(b, { y: 3.6, z: -1, w: 7.6, d: 5.8, h: 3.4, wall });
    for (const x of [-1.7, 1.7]) dormer(b, { x, y: 4.0, z: 0.6, wall });
    for (const x of [-2.4, 2.4]) win(b, { x, y: 1.5, z: 1.9, w: 1.1, h: 1.2, frame: TRIM, box: '#ff6b9a' });
    door(b, { x: 0, y: 0.4, z: 1.9, color: '#d6453b', w: 1.1, h: 2.2, steps: 2 });
    b.box(1.8, 0.14, 0.9, TRIM, { y: 2.85, z: 2.2, r: 0.05 }); // door hood
    for (const x of [-0.75, 0.75]) b.box(0.12, 0.7, 0.12, TRIM, { x, y: 0.4, z: 2.65, sharp: true });
    chimney(b, { x: 2.6, y: 4.5, z: -2.6, h: 3.4, w: 0.9, color: '#c25b3f' });
    path(b, 2.8, 6.2);
    shrubs(b, r, [-3.6, 3.6], 2.6);
    shrubs(b, r, [-3.6, 3.6], 4.6, 0.7);
    pots(b, r, [[1.4, 3.6], [-1.4, 3.6]]);
  },

  /** Green craftsman bungalow: front gable with brackets, stone porch pillars. */
  hCraftsman(b, r) {
    const wall = '#7aa070';
    b.box(8.6, 0.6, 7.0, '#9a948a', { z: -0.8, r: 0.1 });
    plankBox(b, 8.2, 3.4, 6.6, wall, { y: 0.6, z: -0.8, dir: 'h', step: 0.3 });
    gable(b, { y: 4.0, z: -0.8, w: 6.6, d: 8.2, h: 2.6, wall: '#e9dcc0', ry: Math.PI / 2, over: 0.7 });
    for (const x of [-3.0, 3.0]) b.box(0.18, 0.9, 0.9, '#c98a4b', { x, y: 3.4, z: 2.7, rx: -0.6, r: 0.04 }); // brackets
    for (const x of [-2.6, 2.6]) win(b, { x, y: 1.8, z: 2.5, w: 1.3, h: 1.3, frame: TRIM, box: '#ffd43b' });
    win(b, { y: 4.6, z: 2.45, w: 1.0, h: 0.8, frame: TRIM });
    door(b, { x: 0, y: 0.6, z: 2.5, color: '#b4513a', w: 1.1, h: 2.2 });
    porch(b, { z: 3.6, w: 7.6, d: 2.2, deck: 0.8, roofY: 3.6, stone: true, post: '#e9dcc0', rail: '#c98a4b', floor: '#b8743c' });
    chimney(b, { x: -2.8, y: 4.0, z: -3.2, h: 3.0, w: 1.0, color: '#a3998c' });
    shrubs(b, r, [-4.6, 4.6], 4.6, 0.9);
    pots(b, r, [[-2.2, 5.6], [2.2, 5.6], [4.7, 2.6]]);
  },

  /** Single-storey ranch house with garage and stone planters. */
  hRanch(b, r) {
    const wall = '#f0d9a8';
    b.box(12.4, 0.3, 6.4, '#cfc5b4', { z: -0.8, r: 0.08 });
    plankBox(b, 12, 3.0, 6, wall, { y: 0.3, z: -0.8, dir: 'h', step: 0.36 });
    gable(b, { y: 3.3, z: -0.8, w: 12, d: 6, h: 1.8, over: 0.6 });
    for (const sx of [-1, 1]) b.prism(0.1, 1.75, 6, wall, { x: sx * 5.97, y: 3.3, z: -0.8 });
    for (const x of [-4.4, -1.6]) win(b, { x, y: 1.2, z: 2.2, w: 1.5, h: 1.2, frame: TRIM, shutters: '#c0392b' });
    door(b, { x: 0.4, y: 0.3, z: 2.2, color: '#c0392b', w: 1.1, h: 2.2 });
    garageDoor(b, { x: 3.8, z: 2.2, w: 3.2, h: 2.3 });
    b.box(3.6, 0.06, 3.4, '#d9d3c7', { x: 3.8, z: 4.0, sharp: true });
    for (const x of [-4.4, -1.6]) {
      b.box(2.2, 0.6, 0.9, '#a3998c', { x, z: 2.9, r: 0.1 });
      shrubs(b, r, [x - 0.5, x + 0.5], 2.9, 0.7);
    }
    chimney(b, { x: -3, y: 3.6, z: -1.6, h: 2.6, w: 0.9, color: '#c25b3f' });
    pots(b, r, [[1.6, 2.9]]);
    shrubs(b, r, [-6.4, 6.4], 3.0, 0.8);
  },

  /** White farmhouse with a wraparound porch. */
  hFarmhouse(b, r) {
    const wall = '#f6f2ea';
    b.box(8.6, 0.6, 7.4, '#cfc5b4', { z: -1, r: 0.08 });
    plankBox(b, 7.6, 5.4, 6.2, wall, { y: 0.6, z: -1.4, dir: 'v', step: 0.42 });
    gable(b, { y: 6.0, z: -1.4, w: 6.2, d: 7.6, h: 3.0, wall, ry: Math.PI / 2 });
    for (const x of [-2.4, 2.4]) win(b, { x, y: 1.6, z: 1.7, w: 1.1, h: 1.4, frame: '#e9e2d6' });
    for (const x of [-1.6, 1.6]) win(b, { x, y: 4.0, z: 1.7, w: 1.0, h: 1.2, frame: '#e9e2d6' });
    win(b, { y: 6.8, z: 1.66, w: 0.8, h: 0.9, frame: '#e9e2d6' });
    door(b, { x: 0, y: 0.6, z: 1.7, color: '#c0392b', w: 1.1, h: 2.2 });
    porch(b, { z: 2.9, w: 9.4, d: 2.4, deck: 0.6, roofY: 3.4, roof: '#4f5566' });
    for (const sx of [-1, 1]) b.box(1.6, 0.6, 6.0, '#c98a4b', { x: sx * 4.7, z: -0.4, r: 0.08 }); // side decks
    chimney(b, { x: 2.0, y: 6.4, z: -3.0, h: 3.0, w: 0.9, color: '#c25b3f' });
    shrubs(b, r, [-4.6, -3.6, 3.6, 4.6], 4.8, 0.8);
    pots(b, r, [[-2.4, 3.2], [2.4, 3.2]]);
  },

  /** Turquoise beach house on stilts with a striped awning and a surfboard. */
  hBeach(b, r) {
    const wall = '#5ec8d6';
    for (const x of [-3.2, 0, 3.2]) for (const z of [-3.2, 0.2, 2.6]) b.box(0.4, 2.2, 0.4, '#b8743c', { x, z, r: 0.06 });
    for (const x of [-3.2, 3.2]) b.box(0.18, 2.6, 0.18, '#a0612f', { x, y: 0.1, z: -1.5, rx: 0.75, sharp: true }); // braces
    b.box(7.4, 0.3, 6.6, '#c98a4b', { y: 2.2, z: -0.4, r: 0.06 });
    plankBox(b, 6.6, 3.0, 4.4, wall, { y: 2.5, z: -1.4, dir: 'h', step: 0.3 });
    gable(b, { y: 5.5, z: -1.4, w: 6.6, d: 4.4, h: 1.6, color: '#5f6875' });
    for (const x of [-1.8, 1.8]) win(b, { x, y: 3.5, z: 0.82, w: 1.1, h: 1.1, frame: TRIM, box: '#ffd43b' });
    door(b, { x: 0, y: 2.5, z: 0.82, color: '#f6f2ea', w: 1.0, h: 2.1, glass: true });
    awning(b, { y: 5.1, z: 0.85, w: 6.0, depth: 1.4, colors: ['#ffffff', '#4b8fd8'] });
    // deck railing
    for (let x = -3.6; x <= 3.6; x += 0.3) b.box(0.08, 0.8, 0.08, TRIM, { x, y: 2.5, z: 2.85, sharp: true });
    b.box(7.4, 0.1, 0.14, TRIM, { y: 3.3, z: 2.85, r: 0.03 });
    // stairs down the side
    for (let k = 0; k < 9; k++) b.box(1.3, 0.16, 0.5, '#c98a4b', { x: 4.4, y: 2.2 - (k + 1) * 0.24, z: 2.4 - k * 0.42, r: 0.03 });
    b.box(0.1, 2.6, 0.1, TRIM, { x: 5.0, y: 0.2, z: 0.6, rx: 0.5, sharp: true });
    b.rbox(0.6, 2.6, 0.12, 0.28, '#f2c14e', { x: -4.1, y: 0, z: 1.8, rz: 0.1 }); // surfboard
    b.box(0.05, 2.3, 0.14, '#e0573f', { x: -4.1, y: 0.15, z: 1.8, rz: 0.1, sharp: true });
    shrubs(b, r, [-2.4, 2.6], 3.6, 0.7);
    pots(b, r, [[2.4, 2.4]]);
  },

  /** Pair of narrow red / blue townhouses with awnings and stoops. */
  hTownPair(b, r) {
    const cols = ['#d9534a', '#3d6fd0'];
    cols.forEach((wall, k) => {
      const x = k ? 2.1 : -2.1;
      b.group({ x }, () => {
        b.box(4.2, 7.4, 6.4, wall, { z: -1.4, r: 0.12 });
        brickLines(b, 4.1, 7.2, 1.82, 0.2, wall, 0.5);
        b.box(4.5, 0.5, 6.7, shade(wall, 0.75), { y: 7.4, z: -1.4, r: 0.1 }); // cornice
        for (let i = 0; i < 4; i++) b.box(0.3, 0.3, 0.3, TRIM, { x: -1.7 + i * 1.13, y: 7.1, z: 1.9, r: 0.05 });
        win(b, { x: 0, y: 5.0, z: 1.82, w: 1.2, h: 1.3, frame: TRIM, box: '#ffd43b' });
        win(b, { x: 0.8, y: 2.7, z: 1.82, w: 0.9, h: 1.1, frame: TRIM });
        door(b, { x: -0.7, y: 0.9, z: 1.82, color: k ? '#e8a33a' : '#f2c14e', w: 1.0, h: 2.1 });
        awning(b, { x: -0.1, y: 3.6, z: 1.85, w: 3.4, depth: 1.0, colors: ['#ffffff', k ? '#4b8fd8' : '#e0573f'] });
        for (let s = 0; s < 4; s++) b.box(1.5, 0.9 - s * 0.22, 0.42, '#c98a4b', { x: -0.7, z: 2.1 + s * 0.4, r: 0.04 });
        pots(b, r, [[1.4, 2.6]]);
      });
    });
    b.box(0.6, 1.4, 0.6, '#5f6875', { x: 3.9, y: 7.6, z: -3, r: 0.08 });
    barrel(b, { x: -4.2, z: 2.4, color: '#5f6875', r: 0.36, h: 0.9 });
    shrubs(b, r, [4.0], 2.6, 0.8);
  },

  /** Duplex: two gabled halves, blue and yellow, each with its porch. */
  hDuplex(b, r) {
    const cols = ['#7ea7d8', '#f3d36b'];
    b.box(11.6, 0.3, 6.6, '#cfc5b4', { z: -1, r: 0.08 });
    cols.forEach((wall, k) => {
      const x = k ? 2.85 : -2.85;
      plankBox(b, 5.6, 5.2, 6.2, wall, { x, y: 0.3, z: -1, dir: 'h', step: 0.34 });
      gable(b, { x, y: 5.5, z: -1, w: 6.2, d: 5.6, h: 2.4, wall, ry: Math.PI / 2, over: 0.35 });
      win(b, { x: x - 1.2, y: 3.6, z: 2.1, w: 1.0, h: 1.1, frame: TRIM });
      win(b, { x: x + 1.2, y: 3.6, z: 2.1, w: 1.0, h: 1.1, frame: TRIM });
      win(b, { x, y: 6.1, z: 2.08, w: 0.8, h: 0.8, frame: TRIM });
      win(b, { x: x + (k ? 1.4 : -1.4), y: 1.2, z: 2.1, w: 1.1, h: 1.2, frame: TRIM, box: '#ff6b9a' });
      door(b, { x: x + (k ? -0.6 : 0.6), y: 0.6, z: 2.1, color: k ? '#e8a33a' : '#3d6fb8', w: 1.0, h: 2.1 });
      porch(b, { x, z: 3.2, w: 5.2, d: 2.0, deck: 0.6, roofY: 2.9, stair: k ? -0.6 : 0.6 });
      shrubs(b, r, [x + (k ? 2.2 : -2.2)], 4.6, 0.8);
    });
    pots(b, r, [[0, 4.6]]);
  },

  /** Three-storey red brick apartment house with wooden balconies. */
  hBrickApt(b, r) {
    const wall = '#c5553f';
    b.box(9.2, 0.4, 7.4, '#cfc5b4', { z: -1, r: 0.08 });
    b.box(8.8, 9.0, 7.0, wall, { y: 0.4, z: -1, r: 0.12 });
    brickLines(b, 8.7, 8.8, 2.52, 0.4, wall, 0.3);
    for (const sx of [-1, 1]) b.box(1.4, 9.2, 0.3, '#f6f2ea', { x: sx * 1.4, y: 0.4, z: 2.45, r: 0.06 }); // pale bay
    b.box(9.3, 0.5, 7.5, '#f6f2ea', { y: 9.4, z: -1, r: 0.1 });
    b.box(8.4, 0.12, 6.6, '#8a94a3', { y: 9.8, z: -1, sharp: true });
    for (let f = 0; f < 3; f++) {
      const y = 1.4 + f * 2.9;
      for (const x of [-3.2, 3.2]) win(b, { x, y, z: 2.55, w: 1.0, h: 1.3, frame: TRIM });
      if (f > 0) {
        win(b, { x: -0.6, y, z: 2.55, w: 0.9, h: 1.3, frame: TRIM });
        win(b, { x: 0.6, y, z: 2.55, w: 0.9, h: 1.3, frame: TRIM });
        balcony(b, { y: y - 0.45, z: 2.6, w: 3.4, d: 1.0, color: '#c98a4b', plants: f === 2 });
      }
    }
    door(b, { x: 0, y: 0.9, z: 2.55, color: '#3d6fb8', w: 1.2, h: 2.1, glass: true });
    awning(b, { y: 3.4, z: 2.6, w: 2.4, depth: 0.9, colors: ['#4b8fd8', '#2e5fa8'] });
    stairs(b, { z: 2.75, w: 2.2, steps: 3, color: '#d9d3c7' });
    for (const x of [-3.8, 3.8]) b.box(0.8, 0.4, 0.8, '#5f6875', { x, y: 10, z: -3, r: 0.06 });
    shrubs(b, r, [-3.8, -2.6, 2.6, 3.8], 3.4, 0.8);
  },

  /** Modern cube house: white render and timber cladding, garage and terrace. */
  hModern(b, r) {
    b.box(9.6, 0.25, 7.6, '#d9d3c7', { z: -0.8, r: 0.06 });
    b.box(4.6, 6.2, 6.4, '#f4f1ec', { x: -2.3, y: 0.25, z: -1.2, r: 0.1 });
    plankBox(b, 4.8, 3.2, 6.4, '#c98a4b', { x: 2.4, y: 3.25, z: -1.2, dir: 'v', step: 0.3 });
    b.box(4.8, 3.0, 6.4, '#5f6670', { x: 2.4, y: 0.25, z: -1.2, r: 0.08 });
    b.box(5.0, 0.3, 6.8, '#3a3f47', { x: 2.4, y: 6.45, z: -1.2, r: 0.06 });
    b.box(4.8, 0.3, 6.8, '#3a3f47', { x: -2.3, y: 6.45, z: -1.2, r: 0.06 });
    b.box(3.4, 0.6, 0.2, '#4b8fd8', { x: -2.6, y: 6.4, z: 2.1, r: 0.06 });
    b.box(2.0, 2.0, 0.12, '#9cc9f0', { x: -2.7, y: 3.6, z: 2.0, mat: 'glass', sharp: true });
    b.box(2.2, 0.16, 0.2, '#3a3f47', { x: -2.7, y: 5.6, z: 2.05, sharp: true });
    b.box(2.2, 0.16, 0.2, '#3a3f47', { x: -2.7, y: 3.5, z: 2.05, sharp: true });
    b.box(1.0, 2.3, 0.14, '#7a4a28', { x: -2.4, y: 0.6, z: 2.0, r: 0.04 });
    b.box(1.6, 0.6, 1.0, '#d9d3c7', { x: -2.4, z: 2.5, r: 0.06 });
    // garage + terrace with planters on top
    b.box(3.6, 2.4, 0.12, '#3a3f47', { x: 2.4, y: 0.25, z: 2.02, r: 0.04 });
    for (let y = 0.5; y < 2.6; y += 0.3) b.box(3.5, 0.04, 0.04, '#2e3238', { x: 2.4, y, z: 2.1, sharp: true });
    balcony(b, { x: 2.4, y: 3.25, z: 2.0, w: 4.6, d: 1.2, color: '#c98a4b', plants: true });
    b.box(1.2, 2.0, 0.12, '#9cc9f0', { x: 1.4, y: 3.6, z: 2.0, mat: 'glass', sharp: true });
    b.box(1.2, 2.0, 0.12, '#9cc9f0', { x: 3.4, y: 3.6, z: 2.0, mat: 'glass', sharp: true });
    for (const x of [-4.3, -0.8]) {
      b.box(1.4, 0.7, 1.0, '#a3998c', { x, z: 3.0, r: 0.08 });
      shrubs(b, r, [x], 3.0, 0.8);
    }
    b.box(3.6, 0.06, 3.0, '#bdb6a8', { x: 2.4, z: 3.6, sharp: true });
    shrubs(b, r, [4.6], 3.6, 0.7);
  },

  /** Log cabin with a green metal roof, porch and firewood. */
  hCabin(b, r) {
    const log = '#b87a42';
    b.box(8.0, 0.5, 6.4, '#9a948a', { z: -1, r: 0.1 });
    for (let y = 0.5, k = 0; y < 3.6; y += 0.42, k++) {
      const c = k % 2 ? log : shade(log, 0.9);
      b.cyl(0.24, 0.24, 7.8, c, { x: -3.9, y, z: 1.9, rz: -Math.PI / 2 }, 10);
      b.cyl(0.24, 0.24, 7.8, c, { x: -3.9, y, z: -3.9, rz: -Math.PI / 2 }, 10);
      b.cyl(0.24, 0.24, 6.2, c, { x: 3.7, y, z: -4.1, rx: Math.PI / 2 }, 10);
      b.cyl(0.24, 0.24, 6.2, c, { x: -3.7, y, z: -4.1, rx: Math.PI / 2 }, 10);
    }
    b.box(7.4, 3.2, 5.6, shade(log, 0.85), { y: 0.5, z: -1, r: 0.1 });
    gable(b, { y: 3.6, z: -1, w: 7.8, d: 6.0, h: 2.4, color: '#3f8f5a', wall: log, over: 0.6 });
    for (const x of [-2.4, 2.4]) win(b, { x, y: 1.6, z: 2.15, w: 1.0, h: 1.1, frame: '#f6f2ea' });
    win(b, { y: 4.4, z: 1.9, w: 0.8, h: 0.8, frame: '#f6f2ea' });
    door(b, { x: 0, y: 0.5, z: 2.15, color: '#d6453b', w: 1.1, h: 2.2 });
    porch(b, { z: 3.2, w: 6.4, d: 2.0, deck: 0.5, roofY: 3.0, post: '#9c5b2b', rail: '#9c5b2b', roof: '#3f8f5a', floor: '#a0612f' });
    chimney(b, { x: 2.6, y: 3.6, z: -2.6, h: 3.4, w: 1.0, color: '#a3998c' });
    for (let k = 0; k < 6; k++) b.cyl(0.22, 0.22, 1.2, '#a0612f', { x: 4.6, y: 0.22 + Math.floor(k / 3) * 0.42, z: 0.6 + (k % 3) * 0.46 - (k >= 3 ? 0.2 : 0), rx: Math.PI / 2 }, 8);
    barrel(b, { x: 4.6, z: 2.6, r: 0.4, h: 0.9 });
    pots(b, r, [[-3.4, 4.4], [1.8, 4.4]]);
    shrubs(b, r, [-4.6], 3.2, 0.8);
  },

  /** Pale blue three-storey building with a striped shop awning. */
  hBlueApt(b, r) {
    const wall = '#a9c6e8';
    b.box(9.0, 0.3, 7.2, '#d9d3c7', { z: -1, r: 0.06 });
    plankBox(b, 8.6, 9.2, 6.8, wall, { y: 0.3, z: -1, dir: 'h', step: 0.36 });
    b.box(9.0, 0.6, 7.2, '#f6f2ea', { y: 9.5, z: -1, r: 0.1 });
    for (let k = 0; k < 4; k++) b.box(0.5, 0.5, 0.5, '#8a94a3', { x: -3.2 + k * 2.1, y: 10.1, z: -2.2, r: 0.08 });
    for (let f = 1; f < 3; f++) {
      const y = 1.2 + f * 2.9;
      for (const x of [-2.8, 0, 2.8]) win(b, { x, y, z: 2.45, w: 1.0, h: 1.3, frame: TRIM });
      balcony(b, { x: -2.8, y: y - 0.45, z: 2.5, w: 2.0, d: 0.8, color: '#c98a4b' });
      balcony(b, { x: 2.8, y: y - 0.45, z: 2.5, w: 2.0, d: 0.8, color: '#c98a4b', plants: true });
    }
    b.box(8.2, 2.4, 0.12, '#bfe3ff', { y: 0.6, z: 2.42, mat: 'lit', sharp: true });
    for (const x of [-2.8, 0, 2.8]) b.box(0.18, 2.4, 0.2, TRIM, { x: x + 1.4, y: 0.6, z: 2.45, sharp: true });
    door(b, { x: 0, y: 0.3, z: 2.45, color: '#3d6fb8', w: 1.1, h: 2.3, glass: true });
    awning(b, { y: 3.4, z: 2.45, w: 8.4, depth: 1.3, colors: ['#ffffff', '#4b8fd8'] });
    shrubs(b, r, [-4.0, 4.0], 3.4, 0.9);
    pots(b, r, [[-2.4, 3.6], [2.4, 3.6], [-1.2, 3.6]]);
  },
};

