import { rng } from '../models/builder.js';
import { CELL, GRID, PLAY_HALF } from '../game/config.js';

// City plan around the playable district, organised like a city-builder map:
// a ring boulevard and an outer motorway, radial avenues, and themed districts
// (pedestrian old town, business district, shopping, industry, housing) separated by
// road-free green zones (park with a lake, forest, farmland). Everything here is plain
// data — roads, footpaths, building lots, trees — rendered by environment.js /
// districts.js and used by the traffic and pedestrian simulations.

export const R_RING = 150;      // ring boulevard
export const R_RAIL = 228;      // circular railway
export const R_HWY = 300;       // motorway around the city
export const R_WORLD = 330;     // flat land ends here, hills beyond
const CORE = PLAY_HALF;         // centreline of the playable district's edge roads
const CORE_EDGE = CORE + 4;     // outer edge of its sidewalks

/** Road cross-sections: c = half carriageway, sw = sidewalk width, lanes = offsets right of the centreline. */
export const ROAD_TYPES = {
  core: { c: 2, sw: 1.5, lanes: [1.0], main: true },
  main: { c: 2.4, sw: 1.6, lanes: [1.2], main: true },
  sec: { c: 2.0, sw: 1.4, lanes: [1.0], main: false },
  hwy: { c: 5.6, sw: 0, lanes: [1.5, 4.1], main: true },
};

// ---------------------------------------------------------------------------
// Districts: angular sectors (θ = atan2(z, x), north = −z) with wobbly borders
// ---------------------------------------------------------------------------
const SECTORS = [
  { id: 'cbd', a0: -125, a1: -55 },
  { id: 'park', a0: -55, a1: -25 },
  { id: 'shop', a0: -25, a1: 25 },
  { id: 'forest', a0: 25, a1: 55 },
  { id: 'ind', a0: 55, a1: 125 },
  { id: 'farm', a0: 125, a1: 150 },
  { id: 'res', a0: 150, a1: 210 },
  { id: 'park', a0: 210, a1: 235 },
];
export const ZONE_INFO = {
  core: 'Centre (terrains constructibles)',
  ped: 'Vieille ville piétonne',
  cbd: 'Quartier des affaires',
  shop: 'Zone commerciale',
  ind: 'Zone industrielle',
  res: 'Quartier résidentiel',
  park: 'Parc',
  forest: 'Forêt',
  farm: 'Zone agricole',
  wild: 'Campagne',
};
const deg = 180 / Math.PI;

export function sectorAt(x, z) {
  const R = Math.hypot(x, z);
  let a = Math.atan2(z, x) * deg + 7 * Math.sin(R / 23) + 4 * Math.sin(R / 9.7 + 1.3);
  if (a < -125) a += 360;
  if (a >= 235) a -= 360;
  for (const s of SECTORS) if (a >= s.a0 && a < s.a1) return s.id;
  return 'park';
}

export function zoneAt(x, z) {
  if (Math.abs(x) <= CORE_EDGE && Math.abs(z) <= CORE_EDGE) return 'core';
  const R = Math.hypot(x, z);
  if (R > R_HWY + 7) return 'wild';
  const s = sectorAt(x, z);
  if (s === 'cbd' && R < R_RING) return 'ped';
  return s;
}

// ---------------------------------------------------------------------------
// Polyline helpers
// ---------------------------------------------------------------------------
const rad = (a) => a / deg;
export function arcPts(R, a0, a1, step = 3, cx = 0, cz = 0) {
  const n = Math.max(2, Math.ceil((Math.abs(rad(a1 - a0)) * R) / step));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / n);
    pts.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]);
  }
  return pts;
}
export function linePts(x0, z0, x1, z1, step = 3) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n]);
  return pts;
}
/** Smooth curve through control points (Catmull-Rom), resampled every `step` m. */
export function curvePts(ctrl, step = 2.5) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(ctrl[ctrl.length - 1].slice());
  return out;
}
/** Keep only the runs of a polyline where `inside` holds (sampled every metre). */
function clipRuns(pts, inside, minLen = 12) {
  const runs = [];
  let cur = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0)));
    for (let k = 0; k < n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, z = z0 + ((z1 - z0) * k) / n;
      if (inside(x, z)) { if (!cur) { cur = []; runs.push(cur); } cur.push([x, z]); } else cur = null;
    }
  }
  const last = pts[pts.length - 1];
  if (cur && inside(last[0], last[1])) cur.push(last.slice());
  return runs.filter((r) => polyLen(r) >= minLen).map((r) => r.filter((p, i) => i % 3 === 0 || i === r.length - 1));
}
export function polyLen(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}

// ---------------------------------------------------------------------------
// Occupancy grid (2 m cells): roads, paths, water and lots reserve space so that
// generated buildings and trees never overlap anything.
// ---------------------------------------------------------------------------
const OC = 1, OH = 420, ON = (2 * OH) / OC;
const occ = new Uint8Array(ON * ON);
const cell = (x, z) => {
  const i = Math.floor((x + OH) / OC), j = Math.floor((z + OH) / OC);
  return i < 0 || j < 0 || i >= ON || j >= ON ? -1 : j * ON + i;
};
export function isFree(x, z) { const c = cell(x, z); return c >= 0 && occ[c] === 0; }
export function occAt(x, z) { const c = cell(x, z); return c < 0 ? 255 : occ[c]; }
function markDisc(x, z, r, v = 1) {
  for (let px = x - r; px <= x + r; px += OC) for (let pz = z - r; pz <= z + r; pz += OC) {
    if (Math.hypot(px - x, pz - z) > r) continue;
    const c = cell(px, pz);
    if (c >= 0 && occ[c] < v) occ[c] = v;
  }
}
function markPoly(pts, half, v = 1) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 1.0));
    for (let k = 0; k <= n; k++) markDisc(x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n, half, v);
  }
}
function rectCells(cx, cz, w, d, ry, fn) {
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let u = -w / 2; u <= w / 2 + 0.01; u += OC * 0.7) {
    for (let v = -d / 2; v <= d / 2 + 0.01; v += OC * 0.7) {
      if (fn(cx + u * c + v * s, cz - u * s + v * c) === false) return false;
    }
  }
  return true;
}
const rectFree = (cx, cz, w, d, ry) => rectCells(cx, cz, w, d, ry, (x, z) => isFree(x, z));
const markRect = (cx, cz, w, d, ry, v = 2) => rectCells(cx, cz, w, d, ry, (x, z) => { const c = cell(x, z); if (c >= 0) occ[c] = v; });

// ---------------------------------------------------------------------------
// Plan generation
// ---------------------------------------------------------------------------
export const ROADS_NET = [];   // {id, pts, type, closed}
export const PATHS = [];       // footpaths: {pts, w, kind: 'gravel' | 'paved'}
export const ALLEYS = [];      // pedestrian streets of the old town (graph only, ground is paved)
export const LOTS = [];        // generated buildings: {kind, x, z, ry, w, d, zone, seed}
export const TREES = [];       // [x, z, kind 'round' | 'pine', scale]
export const WATER = [];       // {x, z, rx, rz}
export const FIELDS = [];      // farmland strips: {x, z, w, d, ry, color}
export const CORE_LINES = [];  // core boulevards used by the traffic graph

/** Extend the ends of a clipped street onto the ring boulevard / motorway when they stop just short. */
function snap(run) {
  for (const end of [0, 1]) {
    const a = end ? run[run.length - 1] : run[0], b = end ? run[run.length - 2] : run[1];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
    const ux = (a[0] - b[0]) / d, uz = (a[1] - b[1]) / d;
    const R0 = Math.hypot(a[0], a[1]);
    for (let t = 0.5; t <= 14; t += 0.5) {
      const x = a[0] + ux * t, z = a[1] + uz * t, R = Math.hypot(x, z);
      if ((R0 - R_RING) * (R - R_RING) <= 0 || (R0 - R_HWY) * (R - R_HWY) <= 0) {
        const p = [x, z];
        if (end) run.push(p); else run.unshift(p);
        break;
      }
    }
  }
  return run;
}

let rid = 0;
function road(pts, type, closed = false) {
  const r = { id: rid++, pts, type, closed, t: ROAD_TYPES[type] };
  ROADS_NET.push(r);
  return r;
}

const inDistrict = (id) => (x, z) => {
  const R = Math.hypot(x, z);
  return R > R_RING + 6 && R < R_HWY - 8 && zoneAt(x, z) === id;
};

function generate() {
  // --- core boulevards (drawn by the street grid, listed here for the traffic graph)
  for (const v of [-CORE, -CELL / 2, CELL / 2, CORE]) {
    CORE_LINES.push({ pts: linePts(-CORE, v, CORE, v, 10), type: 'core' });
    CORE_LINES.push({ pts: linePts(v, -CORE, v, CORE, 10), type: 'core' });
  }

  // --- ring boulevard, motorway, radial avenues
  road(arcPts(R_RING, 0, 360, 3).slice(0, -1), 'main', true);
  road(arcPts(R_HWY, 0, 360, 4).slice(0, -1), 'hwy', true);
  const zHwy = Math.sqrt(R_HWY * R_HWY - 100), zRing = Math.sqrt(R_RING * R_RING - 100);
  for (const s of [-1, 1]) {
    road(linePts(s * CELL / 2, CORE, s * CELL / 2, zHwy), 'main');           // south
    road(linePts(CORE, s * CELL / 2, zHwy, s * CELL / 2), 'main');           // east
    road(linePts(-CORE, s * CELL / 2, -zHwy, s * CELL / 2), 'main');         // west
    road(linePts(s * CELL / 2, -zRing, s * CELL / 2, -zHwy), 'main');        // north (beyond the old town)
  }

  // --- district streets
  const cbd = inDistrict('cbd');
  for (const z of [-196, -252]) for (const run of clipRuns(linePts(-200, z, 200, z, 2), cbd)) road(snap(run), 'sec');
  for (const x of [-58, 58]) for (const run of clipRuns(linePts(x, -150, x, -300, 2), cbd)) road(snap(run), 'sec');
  const shop = inDistrict('shop');
  for (const x of [196, 266]) for (const run of clipRuns(linePts(x, -130, x, 130, 2), shop)) road(snap(run), 'sec');
  for (const id of ['ind', 'res']) {
    const inside = inDistrict(id);
    const [a0, a1] = id === 'ind' ? [40, 140] : [135, 225];
    for (const R of [192, 264]) for (const run of clipRuns(arcPts(R, a0, a1, 2), inside)) road(snap(run), 'sec');
  }
  // residential cul-de-sacs off the arcs
  for (const a of [163, 172, 188, 197]) {
    const p0 = [Math.cos(rad(a)) * 192, Math.sin(rad(a)) * 192];
    const p1 = [Math.cos(rad(a)) * 214, Math.sin(rad(a)) * 214];
    road(linePts(p0[0], p0[1], p1[0], p1[1], 2), 'sec').culdesac = true;
    const q0 = [Math.cos(rad(a + 4)) * 264, Math.sin(rad(a + 4)) * 264];
    const q1 = [Math.cos(rad(a + 4)) * 284, Math.sin(rad(a + 4)) * 284];
    road(linePts(q0[0], q0[1], q1[0], q1[1], 2), 'sec').culdesac = true;
  }
  for (const r of ROADS_NET) markPoly(r.pts, r.t.c + r.t.sw);
  for (const l of CORE_LINES) markPoly(l.pts, 4);
  // core district itself
  for (let x = -CORE_EDGE; x <= CORE_EDGE; x += OC) for (let z = -CORE_EDGE; z <= CORE_EDGE; z += OC) markDisc(x, z, 0.5, 3);

  // --- railway ring
  markPoly(arcPts(R_RAIL, 0, 360, 3), 3.4, 3);

  // --- water: lake in the city park, pond in the west park
  const lake = { x: Math.cos(rad(-40)) * 188, z: Math.sin(rad(-40)) * 188, rx: 24, rz: 16 };
  const pond = { x: Math.cos(rad(-137)) * 190, z: Math.sin(rad(-137)) * 190, rx: 18, rz: 13 };
  WATER.push(lake, pond);
  for (const w of WATER) {
    for (let a = 0; a < 360; a += 4) for (let k = 0; k <= 1; k += 0.1) markDisc(w.x + Math.cos(rad(a)) * w.rx * k, w.z + Math.sin(rad(a)) * w.rz * k, 2.5, 3);
  }

  // --- footpaths: green zones have no roads, only paths
  const ellipse = (w, grow) => {
    const pts = [];
    for (let a = 0; a < 360; a += 6) pts.push([w.x + Math.cos(rad(a)) * (w.rx + grow), w.z + Math.sin(rad(a)) * (w.rz + grow)]);
    return pts;
  };
  const polar = (R, a) => [Math.cos(rad(a)) * R, Math.sin(rad(a)) * R];
  PATHS.push({ pts: ellipse(lake, 7), w: 2.4, kind: 'gravel', closed: true });
  PATHS.push({ pts: curvePts([polar(R_RING + 6, -31), [lake.x - 22, lake.z + 13]]), w: 2.4, kind: 'gravel' });
  PATHS.push({ pts: curvePts([[lake.x + 27, lake.z - 8], polar(240, -42), polar(262, -36), polar(R_HWY - 8, -45)]), w: 2.4, kind: 'gravel' });
  PATHS.push({ pts: curvePts([polar(R_RING + 6, -50), [lake.x - 10, lake.z - 21]]), w: 2.4, kind: 'gravel' });
  PATHS.push({ pts: ellipse(pond, 6), w: 2.2, kind: 'gravel', closed: true });
  PATHS.push({ pts: curvePts([polar(R_RING + 6, -134), polar(166, -128), [pond.x + 12, pond.z - 15]]), w: 2.2, kind: 'gravel' });
  PATHS.push({ pts: curvePts([[pond.x - 20, pond.z + 6], polar(225, -140), polar(262, -133), polar(R_HWY - 8, -136)]), w: 2.2, kind: 'gravel' });
  // forest trail and farm track
  PATHS.push({ pts: curvePts([polar(R_RING + 6, 38), polar(190, 44), polar(230, 36), polar(262, 45), polar(R_HWY - 8, 40)]), w: 2.0, kind: 'gravel' });
  PATHS.push({ pts: curvePts([polar(R_RING + 6, 138), polar(200, 136), polar(R_RAIL - 6, 139)]), w: 3.0, kind: 'gravel' });
  // small parks between the district and the ring (diagonals)
  for (const a of [-45, 45, 135, -135]) {
    PATHS.push({ pts: curvePts([polar(104, a - 10), polar(116, a - 3), polar(126, a + 4), polar(R_RING - 6, a + 9)]), w: 2.2, kind: 'gravel' });
  }
  // linear parks between the two lanes of each radial avenue
  PATHS.push({ pts: linePts(0, CORE + 4, 0, R_HWY - 8, 3), w: 2.6, kind: 'paved', linear: true });
  PATHS.push({ pts: linePts(CORE + 4, 0, R_HWY - 8, 0, 3), w: 2.6, kind: 'paved', linear: true });
  PATHS.push({ pts: linePts(-CORE - 4, 0, -R_HWY + 8, 0, 3), w: 2.6, kind: 'paved', linear: true });
  PATHS.push({ pts: linePts(0, -R_RING - 6, 0, -R_HWY + 8, 3), w: 2.6, kind: 'paved', linear: true });
  for (const p of PATHS) markPoly(p.pts, p.w / 2 + 0.8, 1);

  // --- old town (pedestrian zone) between the district and the ring, north side
  const square = { x: 0, z: -112, r: 13 };
  ALLEYS.push(linePts(0, -CORE - 4, 0, -R_RING + 5, 3));
  for (const x of [-50, -30, 30, 50]) {
    const zEnd = -Math.sqrt(112 * 112 - x * x);
    ALLEYS.push(linePts(x, -CORE - 4, x, zEnd, 3));
  }
  ALLEYS.push(arcPts(112, -118, -62, 3));
  ALLEYS.push(arcPts(R_RING - 7, -122, -58, 3));
  ALLEYS.push(linePts(-CORE - 2, -CORE - 6, CORE + 2, -CORE - 6, 3)); // along the district edge
  for (const a of ALLEYS) markPoly(a, 2.6, 1);
  markDisc(square.x, square.z, square.r, 2);

  // --- special landmarks (placed before the generic lots)
  const special = (kind, x, z, ry, w, d) => {
    LOTS.push({ kind, x, z, ry, w, d, zone: zoneAt(x, z), seed: (LOTS.length + 1) * 7919 });
    markRect(x, z, w, d, ry, 2);
  };
  special('fountain', square.x, square.z, 0, 0.1, 0.1);
  special('church', 22, -128, Math.PI * 0.08, 14, 22);
  special('station', Math.cos(rad(-77)) * 240, Math.sin(rad(-77)) * 240, Math.PI / 2 + rad(77), 40, 13);
  special('mall', 176, 48, -Math.PI / 2, 42, 34);
  special('parking', 176, -48, -Math.PI / 2, 38, 30);
  special('plant', Math.cos(rad(82)) * 272, Math.sin(rad(82)) * 272, rad(82) + Math.PI / 2, 34, 22);
  special('stadium', Math.cos(rad(-128)) * 248, Math.sin(rad(-128)) * 248, rad(-128) + Math.PI / 2, 46, 32);
  special('farmhouse', Math.cos(rad(137)) * 214, Math.sin(rad(137)) * 214, rad(137) + Math.PI / 2, 22, 16);
  special('playground', Math.cos(rad(-38)) * 258, Math.sin(rad(-38)) * 258, 0.6, 14, 12);

  // farmland strips around the farm
  const rf = rng(808);
  for (let k = 0; k < 26; k++) {
    const a = 126 + rf() * 23, R = 165 + rf() * 125;
    const x = Math.cos(rad(a)) * R, z = Math.sin(rad(a)) * R;
    const w = 18 + rf() * 16, d = 12 + rf() * 10, ry = rad(a) + (rf() - 0.5) * 0.3;
    if (zoneAt(x, z) !== 'farm' || !rectFree(x, z, w + 2, d + 2, ry)) continue;
    FIELDS.push({ x, z, w, d, ry, color: ['#d8c25a', '#9cc957', '#c8a24a', '#7fb24a', '#e2d27a'][(rf() * 5) | 0] });
    markRect(x, z, w + 1, d + 1, ry, 2);
  }

  // --- generic lots along every street, facing it
  const r = rng(2024);
  const placeAlong = (pts, half, opts = {}) => {
    let carry = r() * 4;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const tx = (x1 - x0) / len, tz = (z1 - z0) / len;
      let s = carry;
      while (s < len) {
        const px = x0 + tx * s, pz = z0 + tz * s;
        let used = 3;
        for (const side of opts.sides || [-1, 1]) {
          const nx = -tz * side, nz = tx * side;
          const probe = zoneAt(px + nx * (half + 8), pz + nz * (half + 8));
          const kind = pickKind(probe, r, opts);
          if (!kind) continue;
          const [w, d] = KINDS[kind].size(r);
          const off = half + (KINDS[kind].setback ?? 1.2) + d / 2;
          const cx = px + nx * off + tx * w / 2, cz = pz + nz * off + tz * w / 2;
          if (zoneAt(cx, cz) !== probe) continue;
          const ry = Math.atan2(nx, nz) + Math.PI; // front (+z local) faces the street
          if (!rectFree(cx, cz, w, d, ry)) continue;
          LOTS.push({ kind, x: cx, z: cz, ry, w, d, zone: probe, seed: (r() * 1e9) | 0 });
          markRect(cx, cz, w + 0.6, d + 0.6, ry, 2);
          if (KINDS[kind].garden) TREES.push([cx - nx * (d / 2 - 2) + tx * (w / 2 - 2), cz - nz * (d / 2 - 2) + tz * (w / 2 - 2), 'round', 0.7 + r() * 0.3]);
          used = Math.max(used, w + 1.5);
        }
        s += used;
      }
      carry = s - len;
    }
  };
  for (const a of ALLEYS) placeAlong(a, 2.6, { ped: true });
  placeAlong(arcPts(R_RING, -125, -55, 2), 4.6, { sides: [-1] });
  for (const rd of ROADS_NET) if (rd.type !== 'hwy') placeAlong(rd.pts, rd.t.c + rd.t.sw);
  // district-facing rows along the outer edge of the playable district
  placeAlong(linePts(-CORE, CORE, CORE, CORE, 2), 3.6, { sides: [-1] });
  placeAlong(linePts(CORE, -CORE, CORE, CORE, 2), 3.6, { sides: [-1] });
  placeAlong(linePts(-CORE, CORE, -CORE, -CORE, 2), 3.6, { sides: [-1] });
  placeAlong(linePts(-CORE, -CORE, CORE, -CORE, 2), 3.6, { sides: [1] });

  // --- trees: forests, park groves, gardens, linear parks and the countryside
  const rt = rng(99);
  const tree = (x, z, kind, s, minGap = 1) => {
    if (!isFree(x, z) || occAt(x + minGap, z) > 1 || occAt(x - minGap, z) > 1 || occAt(x, z + minGap) > 1 || occAt(x, z - minGap) > 1) return false;
    TREES.push([x, z, kind, s]);
    markDisc(x, z, 1.2, 1);
    return true;
  };
  for (let i = 0; i < 22000; i++) {
    const a = rt() * Math.PI * 2;
    const R = 80 + Math.sqrt(rt()) * 330;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    const zone = zoneAt(x, z);
    const dens = { forest: 0.55, wild: R < R_HWY + 70 ? 0.32 : 0.06, park: 0.16, farm: 0.03, res: 0.05, ind: 0.015, cbd: 0.015, shop: 0.02, ped: 0, core: 0 }[zone] ?? 0;
    if (rt() > dens) continue;
    const pine = zone === 'forest' || zone === 'wild' ? rt() < 0.6 : rt() < 0.15;
    tree(x, z, pine ? 'pine' : 'round', 0.75 + rt() * 0.6);
  }
  // linear parks: double row of trees along each promenade
  for (const p of PATHS) if (p.linear) {
    for (let i = 0; i < p.pts.length; i += 3) {
      const [x, z] = p.pts[i];
      const horiz = Math.abs(p.pts[1][0] - p.pts[0][0]) > 0.5;
      for (const s of [-3.4, 3.4]) {
        const tx = horiz ? x : x + s, tz = horiz ? z + s : z;
        if (zoneAt(tx, tz) !== 'ped' && occAt(tx, tz) <= 1) TREES.push([tx, tz, 'round', 0.8 + rt() * 0.25]);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Lot kinds: footprint (w along the street × d deep), allowed zones and weights
// ---------------------------------------------------------------------------
export const KINDS = {
  oldtown: { size: (r) => [7 + r() * 3, 9 + r() * 2], setback: 0.4 },
  cafe: { size: () => [9, 9], setback: 0.4 },
  tower: { size: (r) => { const s = 13 + r() * 5; return [s, s]; }, setback: 2.5 },
  office: { size: (r) => [18 + r() * 6, 12 + r() * 3], setback: 2.5 },
  plaza: { size: () => [14, 12], setback: 0.5 },
  bigbox: { size: (r) => [26 + r() * 8, 34], setback: 1 },
  shoprow: { size: (r) => [15 + r() * 6, 11], setback: 1.5 },
  gas: { size: () => [16, 14], setback: 0.6 },
  warehouse: { size: (r) => [24 + r() * 8, 18 + r() * 4], setback: 2 },
  factory: { size: (r) => [22 + r() * 6, 20], setback: 2 },
  silo: { size: () => [13, 12], setback: 2 },
  yard: { size: () => [22, 16], setback: 1.5 },
  chalet: { size: (r) => [11 + r() * 2, 14], setback: 0.8, garden: true },
  villa: { size: () => [14, 15], setback: 0.8, garden: true },
  apartment: { size: (r) => [17 + r() * 4, 13], setback: 2.5 },
  rowhouse: { size: () => [17, 12], setback: 1.2, garden: true },
  barn: { size: () => [14, 11], setback: 2 },
};
const MIX = {
  ped: [['oldtown', 6], ['cafe', 1.4]],
  cbd: [['tower', 4], ['office', 3], ['plaza', 0.6]],
  shop: [['bigbox', 2], ['shoprow', 3], ['gas', 0.6]],
  ind: [['warehouse', 4], ['factory', 3], ['silo', 1.2], ['yard', 1.6]],
  res: [['chalet', 4], ['villa', 2], ['rowhouse', 1.5], ['apartment', 1.2]],
  farm: [['barn', 1]],
};
function pickKind(zone, r, opts) {
  const mix = MIX[zone];
  if (!mix) return null;
  if (zone === 'ped' && !opts.ped && r() < 0.6) return null; // the old town is mostly reached on foot
  if (zone === 'farm' && r() < 0.85) return null;
  let tot = 0;
  for (const [, w] of mix) tot += w;
  let x = r() * tot;
  for (const [k, w] of mix) { x -= w; if (x <= 0) return k; }
  return mix[0][0];
}

generate();

// ---------------------------------------------------------------------------
// Graphs (traffic and pedestrians): split polylines at every crossing / T-junction
// ---------------------------------------------------------------------------
function segHit(ax, az, bx, bz, cx, cz, dx, dz) {
  const rX = bx - ax, rZ = bz - az, sX = dx - cx, sZ = dz - cz;
  const den = rX * sZ - rZ * sX;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sZ - (cz - az) * sX) / den;
  const u = ((cx - ax) * rZ - (cz - az) * rX) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
}

/**
 * lines: [{pts, closed, ...}] → { nodes: [{x, z, edges: []}], edges: [{a, b, pts, len, line}] }
 * Open ends are extended by `ext` metres so T-junctions that stop just short still connect.
 */
export function buildGraph(lines, ext = 2.5, merge = 2.5) {
  const prep = lines.map((l) => {
    const pts = l.pts.map((p) => p.slice());
    if (l.closed) pts.push(pts[0].slice());
    else {
      const ex = (a, b) => { const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; a[0] += ((a[0] - b[0]) / d) * ext; a[1] += ((a[1] - b[1]) / d) * ext; };
      ex(pts[0], pts[1]);
      ex(pts[pts.length - 1], pts[pts.length - 2]);
    }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return { l, pts, cum, total: cum[cum.length - 1], box: [x0, x1, z0, z1], hits: [] };
  });
  for (let i = 0; i < prep.length; i++) {
    for (let j = i + 1; j < prep.length; j++) {
      const A = prep[i], B = prep[j];
      if (A.box[1] < B.box[0] || B.box[1] < A.box[0] || A.box[3] < B.box[2] || B.box[3] < A.box[2]) continue;
      for (let a = 0; a < A.pts.length - 1; a++) {
        const [ax, az] = A.pts[a], [bx, bz] = A.pts[a + 1];
        const sx0 = Math.min(ax, bx), sx1 = Math.max(ax, bx), sz0 = Math.min(az, bz), sz1 = Math.max(az, bz);
        if (sx1 < B.box[0] || sx0 > B.box[1] || sz1 < B.box[2] || sz0 > B.box[3]) continue;
        for (let b = 0; b < B.pts.length - 1; b++) {
          const [cx, cz] = B.pts[b], [dx, dz] = B.pts[b + 1];
          if (Math.max(cx, dx) < sx0 || Math.min(cx, dx) > sx1 || Math.max(cz, dz) < sz0 || Math.min(cz, dz) > sz1) continue;
          const h = segHit(ax, az, bx, bz, cx, cz, dx, dz);
          if (!h) continue;
          A.hits.push(A.cum[a] + h[0] * (A.cum[a + 1] - A.cum[a]));
          B.hits.push(B.cum[b] + h[1] * (B.cum[b + 1] - B.cum[b]));
        }
      }
    }
  }
  const nodes = [];
  const nodeAt = (x, z) => {
    for (const n of nodes) if (Math.abs(n.x - x) < merge && Math.abs(n.z - z) < merge) return n;
    const n = { id: nodes.length, x, z, edges: [] };
    nodes.push(n);
    return n;
  };
  // point at arc length s (s may exceed the length of a closed loop: it wraps)
  const pointAt = (P, s) => {
    if (P.l.closed) s = ((s % P.total) + P.total) % P.total;
    let k = 1;
    while (k < P.cum.length - 1 && P.cum[k] < s) k++;
    const t = (s - P.cum[k - 1]) / (P.cum[k] - P.cum[k - 1] || 1);
    return [P.pts[k - 1][0] + (P.pts[k][0] - P.pts[k - 1][0]) * t, P.pts[k - 1][1] + (P.pts[k][1] - P.pts[k - 1][1]) * t];
  };
  const edges = [];
  for (const P of prep) {
    const T = P.total;
    let hits = [...P.hits].sort((a, b) => a - b);
    let cuts;
    if (P.l.closed) {
      cuts = hits.length ? hits : [0];
    } else {
      // an end that stops just short of (or just past) another line snaps onto it
      const near0 = hits.filter((c) => c < ext + 3);
      const near1 = hits.filter((c) => c > T - ext - 3);
      const s0 = near0.length ? near0[0] : ext;
      const s1 = near1.length ? near1[near1.length - 1] : T - ext;
      cuts = [s0, ...hits.filter((c) => c > s0 && c < s1), s1];
    }
    const merged = [];
    for (const c of cuts) if (!merged.length || c - merged[merged.length - 1] > 3) merged.push(c);
    if (!P.l.closed && merged.length > 1 && cuts[cuts.length - 1] - merged[merged.length - 1] > 0.01) merged[merged.length - 1] = cuts[cuts.length - 1];
    const spans = [];
    for (let k = 0; k < merged.length - 1; k++) spans.push([merged[k], merged[k + 1]]);
    if (P.l.closed) spans.push([merged[merged.length - 1], merged[0] + T]);
    for (const [s0, s1] of spans) {
      const p0 = pointAt(P, s0), p1 = pointAt(P, s1);
      const A = nodeAt(p0[0], p0[1]), B = nodeAt(p1[0], p1[1]);
      if (A === B) continue;
      const pts = [[A.x, A.z]];
      // interior vertices (unrolled over two laps for closed loops)
      for (let lap = 0; lap < (P.l.closed ? 2 : 1); lap++) {
        for (let k = 0; k < P.cum.length; k++) {
          const s = P.cum[k] + lap * T;
          if (s > s0 + 0.3 && s < s1 - 0.3) pts.push(P.pts[k].slice());
        }
      }
      pts.push([B.x, B.z]);
      const e = { id: edges.length, a: A, b: B, pts, len: polyLen(pts), line: P.l };
      edges.push(e);
      A.edges.push(e);
      B.edges.push(e);
    }
  }
  return { nodes, edges };
}

let roadGraph = null, pedGraph = null;
/** Traffic graph: core boulevards + every district road. */
export function getRoadGraph() {
  if (!roadGraph) roadGraph = buildGraph([...CORE_LINES, ...ROADS_NET]);
  return roadGraph;
}
/** Pedestrian graph: old-town alleys, park paths and promenades. */
export function getPedGraph() {
  if (!pedGraph) pedGraph = buildGraph([...ALLEYS.map((pts) => ({ pts })), ...PATHS.map((p) => ({ pts: p.pts, closed: p.closed }))], 3, 2);
  return pedGraph;
}

export const OLD_TOWN = { square: { x: 0, z: -112, r: 13 } };
export const GRID_HALF = GRID;
