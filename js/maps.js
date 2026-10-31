// Arena data (ASCII, 180° symmetric) + 3D arena builder (ground, walls, crates, bushes, water, scenery).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon, gradientMap } from './toon.js';

export const W = 21;
export const H = 31;

// Legend: . floor   # wall   X crate   * bush   ~ water.  Rows 0..15 (top half + middle row).
export const MAPS = [
  {
    id: 'canyon', name: 'Canyon Doré', theme: 'desert',
    rows: [
      '***.......#.......***',
      '**.................**',
      '*....XX.......XX....*',
      '.....X.........X.....',
      '..........###........',
      '##..**...........**##',
      '#...**....***....**.#',
      '....**...*****.......',
      '...........~~~.......',
      '..XX.......~~~...XX..',
      '..X..***.........X...',
      '......***......***...',
      '####.........#......#',
      '.....................',
      '....**..#.....#..**..',
      '...**...#.....#...**.',
    ],
  },
  {
    id: 'clairiere', name: 'Clairière Sauvage', theme: 'forest',
    rows: [
      '**.....*******.....**',
      '*...................*',
      '......#.......#......',
      '..***.#.......#.***..',
      '..***...........***..',
      '........XX.XX........',
      '####...............##',
      '......***....***.....',
      '..#...***....***..#..',
      '..#..................',
      '~~~~~~~..~~~..~~~~~~~',
      '........*****........',
      '..XX.................',
      '......#.......#......',
      '***...#..***..#...***',
      '***....##...##....***',
    ],
  },
  {
    id: 'glacier', name: 'Pic Glacé', theme: 'ice',
    rows: [
      '..#.....*****.....#..',
      '.....................',
      '...XXX.........XXX...',
      '.....................',
      '*****..###.###..*****',
      '*****...........*****',
      '......~~~...~~~......',
      '..#....~~...~~....#..',
      '..#..................',
      '......X.......X......',
      '***...X..***..X...***',
      '***...........#....**',
      '.....###.............',
      '.....................',
      '..XX.....***.....XX..',
      '..XX...#.....#...XX..',
    ],
  },
];

export const MODES = [
  { id: 'ko', name: 'K.O. Rush', desc: 'La première équipe à 12 K.O. remporte le combat.', goal: 12 },
  { id: 'zone', name: 'Zone Chaude', desc: 'Tenez la zone centrale jusqu\'à atteindre 100 %.', goal: 100 },
];

export const THEMES = {
  desert: {
    groundA: '#f2cb86', groundB: '#e9bf76', outer: '#d79f5c', grid: 'cracks',
    wall: '#e47f48', wallTop: '#f7ad72', wallTex: 'sandstone',
    bush: '#a9c43c', bushTop: '#d3e263',
    water: ['#168ac0', '#3fcdf0', '#effcff'], bank: '#b3743f',
    border: '#cf6f3d', borderTop: '#f09a5e', props: ['cactus', 'rock', 'cactus', 'barrel'],
    sky: '#f7d39a', hemiSky: '#fff4dd', hemiGround: '#c9895a', sun: '#fff1d6',
  },
  forest: {
    groundA: '#93d660', groundB: '#88cc56', outer: '#5ea947', grid: 'grass',
    wall: '#a3acc0', wallTop: '#6cc04a', wallTex: 'bricks',
    bush: '#2c9a48', bushTop: '#58c96a',
    water: ['#1f6fcf', '#4cb9f7', '#e8f8ff'], bank: '#6b5040',
    border: '#2e8a40', borderTop: '#47a956', props: ['tree', 'tree', 'mushroom', 'rock'],
    sky: '#bdeeff', hemiSky: '#eafbff', hemiGround: '#5e8f3d', sun: '#fff6e0',
  },
  ice: {
    groundA: '#eaf7ff', groundB: '#dbeffc', outer: '#c6e3f6', grid: 'snow',
    wall: '#7fc3ef', wallTop: '#ffffff', wallTex: 'ice',
    bush: '#2b8f88', bushTop: '#5ccabc',
    water: ['#163f8c', '#2f86d4', '#e6f6ff'], bank: '#89a9c4',
    border: '#8fd0f5', borderTop: '#ffffff', props: ['pine', 'pine', 'crystal', 'rock'],
    sky: '#dff3ff', hemiSky: '#ffffff', hemiGround: '#8fb6d6', sun: '#ffffff',
  },
};

export function makeGrid(map) {
  const top = map.rows.map((r) => r.padEnd(W, '.').slice(0, W));
  const mid = top[15];
  top[15] = mid.slice(0, 11) + mid.slice(0, 10).split('').reverse().join('');
  const g = [];
  for (let r = 0; r < H; r++) {
    if (r <= 15) g.push(top[r].split(''));
    else g.push(top[30 - r].split('').reverse());
  }
  // keep spawn areas clear
  for (const [c, r] of [...SPAWNS[1], ...SPAWNS[0]]) {
    for (let dc = -1; dc <= 1; dc++) {
      const cc = c + dc;
      if (cc >= 0 && cc < W && g[r][cc] !== '*') g[r][cc] = '.';
    }
  }
  return g;
}

// team 0 = blue (bottom, near camera), team 1 = red (top)
export const SPAWNS = [
  [[10, 29], [7, 28], [13, 28]],
  [[10, 1], [13, 2], [7, 2]],
];

export const tileX = (c) => c - (W - 1) / 2;
export const tileZ = (r) => r - (H - 1) / 2;
export const colOf = (x) => Math.floor(x + W / 2);
export const rowOf = (z) => Math.floor(z + H / 2);

// ------------------------------------------------------------ minimap (2D) for menus
export function drawMinimap(canvas, map) {
  const g = makeGrid(map);
  const th = THEMES[map.theme];
  const ctx = canvas.getContext('2d');
  const s = Math.floor(Math.min(canvas.width / W, canvas.height / H));
  const ox = Math.floor((canvas.width - s * W) / 2);
  const oy = Math.floor((canvas.height - s * H) / 2);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const ch = g[r][c];
      let col = (r + c) % 2 ? th.groundA : th.groundB;
      if (ch === '#') col = th.wall;
      else if (ch === 'X') col = '#b8763d';
      else if (ch === '*') col = th.bush;
      else if (ch === '~') col = th.water[1];
      ctx.fillStyle = col;
      ctx.fillRect(ox + c * s, oy + r * s, s, s);
    }
  }
  ctx.fillStyle = '#2f8bff';
  for (const [c, r] of SPAWNS[0]) ctx.fillRect(ox + c * s, oy + r * s, s, s);
  ctx.fillStyle = '#ff3d5a';
  for (const [c, r] of SPAWNS[1]) ctx.fillRect(ox + c * s, oy + r * s, s, s);
}

// ------------------------------------------------------------ procedural textures
function canvasTex(size, draw, srgb = true) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function rnd(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function groundTexture(kind) {
  return canvasTex(128, (ctx, n) => {
    const R = rnd(7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, n, n);
    // soft tile bevel
    const gr = ctx.createLinearGradient(0, 0, 0, n);
    gr.addColorStop(0, 'rgba(255,255,255,0.0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.05)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, n, n);
    ctx.strokeStyle = 'rgba(60,30,10,0.10)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, n - 3, n - 3);
    if (kind === 'grass') {
      for (let i = 0; i < 40; i++) {
        const x = R() * n, y = R() * n;
        ctx.strokeStyle = `rgba(30,90,20,${0.12 + R() * 0.12})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2 + R() * 4, y - 5 - R() * 5);
        ctx.stroke();
      }
    } else if (kind === 'cracks') {
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(120,70,20,${0.08 + R() * 0.1})`;
        ctx.beginPath();
        ctx.arc(R() * n, R() * n, 1 + R() * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(120,70,20,0.10)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        let x = R() * n, y = R() * n;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 4; j++) {
          x += -12 + R() * 24;
          y += -12 + R() * 24;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(90,140,200,${0.08 + R() * 0.1})`;
        ctx.beginPath();
        ctx.arc(R() * n, R() * n, 1 + R() * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 10; i++) ctx.fillRect(R() * n, R() * n, 2, 2);
    }
  });
}

function wallTexture(kind) {
  return canvasTex(128, (ctx, n) => {
    const R = rnd(11);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, n, n);
    if (kind === 'sandstone') {
      for (let y = 0; y < n; y += 22) {
        ctx.fillStyle = `rgba(150,60,20,${0.08 + R() * 0.08})`;
        ctx.fillRect(0, y + 14, n, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(0, y, n, 3);
      }
      for (let i = 0; i < 25; i++) {
        ctx.fillStyle = `rgba(120,50,10,${0.1 + R() * 0.12})`;
        ctx.beginPath();
        ctx.arc(R() * n, R() * n, 1 + R() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'bricks') {
      ctx.strokeStyle = 'rgba(40,40,70,0.35)';
      ctx.lineWidth = 3;
      const bh = 32;
      for (let row = 0; row < 4; row++) {
        const y = row * bh;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(n, y);
        ctx.stroke();
        const off = row % 2 ? 32 : 0;
        for (let x = off; x <= n; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + bh);
          ctx.stroke();
        }
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = `rgba(255,255,255,${0.15 + R() * 0.15})`;
          ctx.fillRect(R() * n, y + 4, 16 + R() * 20, 4);
        }
      }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(R() * n, 0);
        ctx.lineTo(R() * n, n);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(30,80,150,0.18)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(R() * n, R() * n);
        ctx.lineTo(R() * n, R() * n);
        ctx.stroke();
      }
    }
  });
}

function crateTexture() {
  return canvasTex(128, (ctx, n) => {
    ctx.fillStyle = '#c98244';
    ctx.fillRect(0, 0, n, n);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#bd773b' : '#d18b4b';
      ctx.fillRect(0, i * 32, n, 32);
      ctx.fillStyle = 'rgba(80,40,10,0.35)';
      ctx.fillRect(0, i * 32 + 30, n, 2);
    }
    ctx.strokeStyle = '#7a4318';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, n - 14, n - 14);
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(n - 10, n - 10);
    ctx.stroke();
    ctx.fillStyle = '#ffd36b';
    for (const [x, y] of [[14, 14], [n - 14, 14], [14, n - 14], [n - 14, n - 14]]) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// ------------------------------------------------------------ prop templates (merged, vertex-colored)
function colored(geom, color, matrix) {
  const g = geom.index ? geom.toNonIndexed() : geom.clone();
  g.applyMatrix4(matrix);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}
const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

function propGeometry(kind) {
  const parts = [];
  const add = (g, col, m) => parts.push(colored(g, col, m));
  switch (kind) {
    case 'cactus':
      add(new THREE.CapsuleGeometry(0.22, 1.1, 4, 12), '#3fae4f', M4(0, 0.8, 0));
      add(new THREE.CapsuleGeometry(0.13, 0.35, 4, 10), '#3fae4f', M4(0.32, 0.9, 0, 1, 1, 1, 0, 0, -0.2));
      add(new THREE.CapsuleGeometry(0.12, 0.3, 4, 10), '#3fae4f', M4(-0.3, 1.1, 0, 1, 1, 1, 0, 0, 0.2));
      add(new THREE.SphereGeometry(0.09, 8, 6), '#ff6fb5', M4(0, 1.5, 0));
      break;
    case 'rock':
      add(new THREE.IcosahedronGeometry(0.6, 1), '#c88a58', M4(0, 0.3, 0, 1.2, 0.7, 1));
      add(new THREE.IcosahedronGeometry(0.35, 1), '#d99a66', M4(0.5, 0.2, 0.2, 1, 0.8, 1));
      break;
    case 'barrel':
      add(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 16), '#b8763d', M4(0, 0.4, 0));
      add(new THREE.TorusGeometry(0.32, 0.04, 6, 18), '#5b3a20', M4(0, 0.2, 0, 1, 1, 1, Math.PI / 2));
      add(new THREE.TorusGeometry(0.32, 0.04, 6, 18), '#5b3a20', M4(0, 0.6, 0, 1, 1, 1, Math.PI / 2));
      break;
    case 'tree':
      add(new THREE.CylinderGeometry(0.16, 0.24, 1.1, 10), '#7a5032', M4(0, 0.55, 0));
      add(new THREE.IcosahedronGeometry(0.75, 1), '#3aa14e', M4(0, 1.5, 0));
      add(new THREE.IcosahedronGeometry(0.55, 1), '#4cbd5f', M4(0.45, 1.35, 0.15));
      add(new THREE.IcosahedronGeometry(0.5, 1), '#2f9447', M4(-0.4, 1.3, -0.1));
      add(new THREE.IcosahedronGeometry(0.42, 1), '#5fd06f', M4(0.05, 1.95, 0.1));
      break;
    case 'mushroom':
      add(new THREE.CylinderGeometry(0.12, 0.16, 0.45, 10), '#fff3e0', M4(0, 0.22, 0));
      add(new THREE.SphereGeometry(0.38, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#ff4d5e', M4(0, 0.42, 0, 1, 0.8, 1));
      add(new THREE.SphereGeometry(0.06, 8, 6), '#ffffff', M4(0.15, 0.68, 0.1));
      add(new THREE.SphereGeometry(0.05, 8, 6), '#ffffff', M4(-0.12, 0.66, 0.16));
      add(new THREE.SphereGeometry(0.05, 8, 6), '#ffffff', M4(0, 0.72, -0.15));
      break;
    case 'pine':
      add(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 8), '#7a5032', M4(0, 0.25, 0));
      add(new THREE.ConeGeometry(0.75, 0.9, 10), '#2c8a78', M4(0, 0.85, 0));
      add(new THREE.ConeGeometry(0.58, 0.8, 10), '#33a08b', M4(0, 1.35, 0));
      add(new THREE.ConeGeometry(0.4, 0.7, 10), '#3bb39b', M4(0, 1.8, 0));
      add(new THREE.ConeGeometry(0.22, 0.3, 10), '#ffffff', M4(0, 2.08, 0));
      break;
    case 'crystal':
      add(new THREE.OctahedronGeometry(0.4, 0), '#9be3ff', M4(0, 0.55, 0, 0.8, 1.6, 0.8));
      add(new THREE.OctahedronGeometry(0.28, 0), '#c7f0ff', M4(0.35, 0.35, 0.1, 0.8, 1.4, 0.8, 0, 0, -0.4));
      add(new THREE.OctahedronGeometry(0.22, 0), '#7fd0ff', M4(-0.3, 0.3, -0.05, 0.8, 1.3, 0.8, 0, 0, 0.5));
      break;
    default:
      add(new THREE.IcosahedronGeometry(0.55, 1), '#8f97a8', M4(0, 0.28, 0, 1.2, 0.7, 1));
  }
  const g = mergeGeometries(parts);
  g.computeBoundingSphere();
  return g;
}

// ------------------------------------------------------------ arena
export function buildArena(map) {
  const theme = THEMES[map.theme];
  const grid = makeGrid(map);
  const group = new THREE.Group();
  const R = rnd(map.id.length * 977 + 13);
  const arena = { map, theme, grid, group, W, H, wallInst: new Map(), bushTime: { value: 0 } };

  const cell = (c, r) => (c < 0 || r < 0 || c >= W || r >= H ? null : grid[r][c]);
  arena.cell = cell;
  arena.blocksMove = (c, r) => {
    const ch = cell(c, r);
    return ch === null || ch === '#' || ch === 'X' || ch === '~';
  };
  arena.blocksShot = (c, r) => {
    const ch = cell(c, r);
    return ch === null || ch === '#' || ch === 'X';
  };
  arena.isBush = (c, r) => cell(c, r) === '*';
  arena.isWater = (c, r) => cell(c, r) === '~';

  // ---- ground
  const gTex = groundTexture(theme.grid);
  const pos = [];
  const col = [];
  const uv = [];
  const ca = new THREE.Color(theme.groundA);
  const cb = new THREE.Color(theme.groundB);
  const tmp = new THREE.Color();
  const pushQuad = (x0, z0, x1, z1, y, c, u1 = 1, v1 = 1) => {
    pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
    uv.push(0, 0, 0, v1, u1, v1, 0, 0, u1, v1, u1, 0);
    for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
  };
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (grid[r][c] === '~') continue;
      const x = tileX(c), z = tileZ(r);
      tmp.copy((r + c) % 2 ? ca : cb).offsetHSL(0, 0, (R() - 0.5) * 0.025);
      pushQuad(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0, tmp);
    }
  }
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  gGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  gGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  gGeo.computeVertexNormals();
  const ground = new THREE.Mesh(gGeo, toon('#ffffff', { map: gTex, vertexColors: true, rim: 0 }));
  ground.receiveShadow = true;
  group.add(ground);

  // outer ground frame
  {
    const p2 = [], c2 = [], u2 = [];
    const oc = new THREE.Color(theme.outer);
    const E = 34;
    const x0 = -W / 2, x1 = W / 2, z0 = -H / 2, z1 = H / 2;
    const quads = [[x0 - E, z0 - E, x1 + E, z0], [x0 - E, z1, x1 + E, z1 + E], [x0 - E, z0, x0, z1], [x1, z0, x1 + E, z1]];
    for (const q of quads) {
      const [a, b, cc, d] = q;
      p2.push(a, -0.02, b, a, -0.02, d, cc, -0.02, d, a, -0.02, b, cc, -0.02, d, cc, -0.02, b);
      const uw = (cc - a), vw = (d - b);
      u2.push(0, 0, 0, vw, uw, vw, 0, 0, uw, vw, uw, 0);
      for (let i = 0; i < 6; i++) c2.push(oc.r, oc.g, oc.b);
    }
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
    og.setAttribute('color', new THREE.Float32BufferAttribute(c2, 3));
    og.setAttribute('uv', new THREE.Float32BufferAttribute(u2, 2));
    og.computeVertexNormals();
    const outer = new THREE.Mesh(og, toon('#ffffff', { map: gTex, vertexColors: true, rim: 0 }));
    outer.receiveShadow = true;
    group.add(outer);
  }

  // ---- water
  {
    const wp = [], wu = [], we = [], bp = [], bc = [];
    const bank = new THREE.Color(theme.bank);
    const bankDark = bank.clone().multiplyScalar(0.7);
    const isW = (c, r) => cell(c, r) === '~';
    const YW = -0.16;
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (!isW(c, r)) continue;
        const x = tileX(c), z = tileZ(r);
        const e = [isW(c, r - 1) ? 0 : 1, isW(c + 1, r) ? 0 : 1, isW(c, r + 1) ? 0 : 1, isW(c - 1, r) ? 0 : 1];
        const vx = [[x - 0.5, z - 0.5, 0, 0], [x - 0.5, z + 0.5, 0, 1], [x + 0.5, z + 0.5, 1, 1], [x - 0.5, z - 0.5, 0, 0], [x + 0.5, z + 0.5, 1, 1], [x + 0.5, z - 0.5, 1, 0]];
        for (const v of vx) {
          wp.push(v[0], YW, v[1]);
          wu.push(v[2], v[3]);
          we.push(...e);
        }
        const side = (ax, az, bx, bz, shade) => {
          bp.push(ax, 0, az, ax, -0.45, az, bx, -0.45, bz, ax, 0, az, bx, -0.45, bz, bx, 0, bz);
          const cc = shade ? bank : bankDark;
          for (let i = 0; i < 6; i++) bc.push(cc.r, cc.g, cc.b);
        };
        if (e[0]) side(x - 0.5, z - 0.5, x + 0.5, z - 0.5, true);
        if (e[2]) side(x + 0.5, z + 0.5, x - 0.5, z + 0.5, false);
        if (e[1]) side(x + 0.5, z - 0.5, x + 0.5, z + 0.5, false);
        if (e[3]) side(x - 0.5, z + 0.5, x - 0.5, z - 0.5, false);
      }
    }
    if (wp.length) {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
      wg.setAttribute('uv', new THREE.Float32BufferAttribute(wu, 2));
      wg.setAttribute('aEdge', new THREE.Float32BufferAttribute(we, 4));
      const wm = new THREE.ShaderMaterial({
        uniforms: {
          uTime: arena.bushTime,
          uDeep: { value: new THREE.Color(theme.water[0]) },
          uLight: { value: new THREE.Color(theme.water[1]) },
          uFoam: { value: new THREE.Color(theme.water[2]) },
        },
        vertexShader: `
          attribute vec4 aEdge; varying vec4 vEdge; varying vec2 vUv; varying vec2 vW;
          void main(){ vEdge=aEdge; vUv=uv; vW=position.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `
          uniform float uTime; uniform vec3 uDeep; uniform vec3 uLight; uniform vec3 uFoam;
          varying vec4 vEdge; varying vec2 vUv; varying vec2 vW;
          void main(){
            float w = sin(vW.x*2.1 + uTime*1.5)*0.5 + sin(vW.y*2.7 - uTime*1.2 + vW.x*0.8)*0.5;
            vec3 col = mix(uDeep, uLight, 0.45 + 0.22*w);
            float band = abs(sin(vW.x*1.6 + vW.y*1.2 + w*0.8 + uTime*0.9));
            col = mix(col, uFoam, smoothstep(0.93, 0.97, band)*0.55);
            float d = 9.0;
            if (vEdge.x > 0.5) d = min(d, vUv.y);
            if (vEdge.y > 0.5) d = min(d, 1.0 - vUv.x);
            if (vEdge.z > 0.5) d = min(d, 1.0 - vUv.y);
            if (vEdge.w > 0.5) d = min(d, vUv.x);
            float wob = 0.03*sin(uTime*3.0 + (vW.x+vW.y)*7.0);
            col = mix(col, uDeep*0.75, smoothstep(0.32, 0.0, d)*0.35);
            col = mix(col, uFoam, 1.0 - smoothstep(0.07 + wob, 0.12 + wob, d));
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      });
      const water = new THREE.Mesh(wg, wm);
      water.receiveShadow = false;
      group.add(water);
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
      bg.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
      bg.computeVertexNormals();
      group.add(new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ vertexColors: true })));
    }
  }

  // ---- walls & crates (instanced)
  const wallCount = grid.flat().filter((ch) => ch === '#').length;
  const crateCount = grid.flat().filter((ch) => ch === 'X').length;
  const wTex = wallTexture(theme.wallTex);
  const wallBody = new THREE.InstancedMesh(new RoundedBoxGeometry(0.98, 1, 0.98, 2, 0.08), toon(theme.wall, { map: wTex, rim: 0.15 }), Math.max(1, wallCount));
  const wallCap = new THREE.InstancedMesh(new RoundedBoxGeometry(1.02, 0.2, 1.02, 2, 0.08), toon(theme.wallTop, { rim: 0.2 }), Math.max(1, wallCount));
  const crates = new THREE.InstancedMesh(new RoundedBoxGeometry(0.9, 0.9, 0.9, 2, 0.06), toon('#ffffff', { map: crateTexture(), rim: 0.15 }), Math.max(1, crateCount));
  for (const m of [wallBody, wallCap, crates]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.count = 0;
    group.add(m);
  }
  const mtx = new THREE.Matrix4();
  const tint = new THREE.Color();
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const ch = grid[r][c];
      const x = tileX(c), z = tileZ(r);
      if (ch === '#') {
        const h = 1.0 + R() * 0.18;
        const i = wallBody.count++;
        wallCap.count++;
        mtx.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1));
        wallBody.setMatrixAt(i, mtx);
        mtx.compose(new THREE.Vector3(x, h, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
        wallCap.setMatrixAt(i, mtx);
        tint.setRGB(1, 1, 1).offsetHSL(0, 0, (R() - 0.5) * 0.06);
        wallBody.setColorAt(i, tint);
        wallCap.setColorAt(i, tint);
        arena.wallInst.set(r * W + c, { kind: 'wall', i, h });
      } else if (ch === 'X') {
        const i = crates.count++;
        mtx.compose(new THREE.Vector3(x, 0.45, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (R() - 0.5) * 0.2, 0)), new THREE.Vector3(1, 1, 1));
        crates.setMatrixAt(i, mtx);
        arena.wallInst.set(r * W + c, { kind: 'crate', i, h: 0.9 });
      }
    }
  }
  for (const m of [wallBody, wallCap, crates]) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  arena.destroy = (c, r) => {
    const ch = cell(c, r);
    if (ch !== '#' && ch !== 'X') return null;
    const inst = arena.wallInst.get(r * W + c);
    grid[r][c] = '.';
    if (inst) {
      if (inst.kind === 'wall') {
        wallBody.setMatrixAt(inst.i, zero);
        wallCap.setMatrixAt(inst.i, zero);
        wallBody.instanceMatrix.needsUpdate = true;
        wallCap.instanceMatrix.needsUpdate = true;
      } else {
        crates.setMatrixAt(inst.i, zero);
        crates.instanceMatrix.needsUpdate = true;
      }
      arena.wallInst.delete(r * W + c);
    }
    return { kind: inst ? inst.kind : 'wall', color: inst && inst.kind === 'crate' ? '#c98244' : theme.wall, top: theme.wallTop };
  };

  // ---- border + scenery
  {
    const borderGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
    const ring = [];
    for (let c = -1; c <= W; c++) { ring.push([c, -1]); ring.push([c, H]); }
    for (let r = 0; r < H; r++) { ring.push([-1, r]); ring.push([W, r]); }
    const extra = [];
    for (let c = -3; c <= W + 2; c++) { extra.push([c, -2]); extra.push([c, H + 1]); }
    for (let r = -1; r <= H; r++) { extra.push([-2, r]); extra.push([W + 1, r]); }
    const all = ring.concat(extra);
    const bBody = new THREE.InstancedMesh(borderGeo, toon(theme.border, { map: wTex, rim: 0.15 }), all.length);
    const bCap = new THREE.InstancedMesh(new RoundedBoxGeometry(1.04, 0.24, 1.04, 2, 0.1), toon(theme.borderTop, { rim: 0.2 }), all.length);
    bBody.castShadow = bCap.castShadow = true;
    bBody.receiveShadow = bCap.receiveShadow = true;
    all.forEach(([c, r], i) => {
      const outerRing = i >= ring.length;
      const h = (outerRing ? 1.7 : 1.25) + R() * 0.35;
      mtx.compose(new THREE.Vector3(tileX(c), h / 2, tileZ(r)), new THREE.Quaternion(), new THREE.Vector3(1, h, 1));
      bBody.setMatrixAt(i, mtx);
      mtx.compose(new THREE.Vector3(tileX(c), h, tileZ(r)), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      bCap.setMatrixAt(i, mtx);
      tint.setRGB(1, 1, 1).offsetHSL(0, 0, (R() - 0.5) * 0.08);
      bBody.setColorAt(i, tint);
    });
    group.add(bBody, bCap);

    const propMat = toon('#ffffff', { vertexColors: true, rim: 0.25 });
    const kinds = theme.props;
    const placements = kinds.map(() => []);
    for (let i = 0; i < 150; i++) {
      const side = Math.floor(R() * 4);
      let x, z;
      if (side === 0) { x = -W / 2 - 3 - R() * 9; z = (R() - 0.5) * (H + 16); }
      else if (side === 1) { x = W / 2 + 3 + R() * 9; z = (R() - 0.5) * (H + 16); }
      else if (side === 2) { x = (R() - 0.5) * (W + 18); z = -H / 2 - 3 - R() * 8; }
      else { x = (R() - 0.5) * (W + 18); z = H / 2 + 3 + R() * 8; }
      placements[Math.floor(R() * kinds.length)].push([x, z, 0.75 + R() * 0.6, R() * Math.PI * 2]);
    }
    kinds.forEach((kind, ki) => {
      const list = placements[ki];
      if (!list.length) return;
      const im = new THREE.InstancedMesh(propGeometry(kind), propMat, list.length);
      im.castShadow = true;
      list.forEach(([x, z, s, ry], i) => {
        mtx.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s));
        im.setMatrixAt(i, mtx);
      });
      group.add(im);
    });
  }

  // ---- bushes (merged, swaying, part-transparent around the player, rustle when crossed)
  {
    const parts = [];
    const base = new THREE.Color(theme.bush);
    const topC = new THREE.Color(theme.bushTop);
    const ico = new THREE.IcosahedronGeometry(1, 1);
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (grid[r][c] !== '*') continue;
        const x = tileX(c), z = tileZ(r);
        const n = 4;
        for (let i = 0; i < n; i++) {
          const ox = (i % 2 ? 0.22 : -0.22) + (R() - 0.5) * 0.12;
          const oz = (i < 2 ? -0.22 : 0.22) + (R() - 0.5) * 0.12;
          const s = 0.36 + R() * 0.1;
          const g = ico.clone();
          g.applyMatrix4(M4(x + ox, 0.42 + R() * 0.12, z + oz, s, s * 1.15, s, R(), R(), R()));
          const cnt = g.attributes.position.count;
          const arr = new Float32Array(cnt * 3);
          const cc = new THREE.Color();
          for (let v = 0; v < cnt; v++) {
            const y = g.attributes.position.getY(v);
            cc.copy(base).lerp(topC, Math.min(1, Math.max(0, (y - 0.25) / 0.6)));
            arr[v * 3] = cc.r; arr[v * 3 + 1] = cc.g; arr[v * 3 + 2] = cc.b;
          }
          g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
          parts.push(g);
        }
        // small top tuft
        const g2 = new THREE.ConeGeometry(0.12, 0.3, 5).toNonIndexed();
        g2.applyMatrix4(M4(x + (R() - 0.5) * 0.3, 0.95, z + (R() - 0.5) * 0.3, 1, 1, 1, (R() - 0.5) * 0.4, 0, (R() - 0.5) * 0.4));
        const cnt2 = g2.attributes.position.count;
        const a2 = new Float32Array(cnt2 * 3);
        for (let v = 0; v < cnt2; v++) { a2[v * 3] = topC.r; a2[v * 3 + 1] = topC.g; a2[v * 3 + 2] = topC.b; }
        g2.setAttribute('color', new THREE.BufferAttribute(a2, 3));
        parts.push(g2);
      }
    }
    if (parts.length) {
      const bg = mergeGeometries(parts);
      const movers = [];
      for (let i = 0; i < 6; i++) movers.push(new THREE.Vector3(999, 999, 0));
      arena.bushMovers = movers;
      arena.bushFocus = { value: new THREE.Vector2(999, 999) };
      const bm = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradientMap(), transparent: true });
      bm.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = arena.bushTime;
        sh.uniforms.uMovers = { value: movers };
        sh.uniforms.uFocus = arena.bushFocus;
        sh.vertexShader = 'uniform float uTime;\nuniform vec3 uMovers[6];\nvarying vec2 vBW;\n' + sh.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float hh = clamp(position.y - 0.15, 0.0, 1.2);
          vec2 wxz = position.xz;
          transformed.x += sin(uTime*1.8 + wxz.x*1.3 + wxz.y*0.7) * 0.035 * hh;
          transformed.z += cos(uTime*1.4 + wxz.y*1.1) * 0.025 * hh;
          for (int i = 0; i < 6; i++) {
            vec2 dd = wxz - uMovers[i].xy;
            float l = length(dd);
            float f = (1.0 - smoothstep(0.0, 1.0, l)) * uMovers[i].z * hh;
            transformed.xz += (dd / max(l, 0.001)) * f * 0.22;
            transformed.y -= f * 0.06;
          }
          vBW = wxz;`
        );
        sh.fragmentShader = 'uniform vec2 uFocus;\nvarying vec2 vBW;\n' + sh.fragmentShader.replace(
          '#include <opaque_fragment>',
          `diffuseColor.a *= mix(0.38, 1.0, smoothstep(0.9, 1.7, distance(vBW, uFocus)));
          #include <opaque_fragment>`
        );
      };
      bm.customProgramCacheKey = () => 'bush';
      const bush = new THREE.Mesh(bg, bm);
      bush.castShadow = true;
      bush.receiveShadow = true;
      bush.renderOrder = 2;
      group.add(bush);
    } else {
      arena.bushMovers = null;
    }
  }

  // ---- spawn pads
  for (let team = 0; team < 2; team++) {
    const [c, r] = SPAWNS[team][0];
    const pad = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.6, 48),
      new THREE.MeshBasicMaterial({ color: team === 0 ? '#2f8bff' : '#ff3d5a', transparent: true, opacity: 0.45, depthWrite: false })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(tileX(c), 0.015, tileZ(r) + (team === 0 ? -0.6 : 0.6));
    group.add(pad);
  }

  arena.update = (t) => {
    arena.bushTime.value = t;
  };
  return arena;
}
