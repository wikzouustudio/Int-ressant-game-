import { rng } from '../models/builder.js';
import { CELL, PLAY_HALF } from '../game/config.js';
import {
  WORLD_HALF, ZCELL, ZN, CORE_HALF, ZONES, SPECIALS, CATALOG_ITEM, HOUSE_LIST, isTreeKind, loadSpec, decodeZones, expandLine, linePts, curvePts,
} from './mapspec.js';

// City plan around the playable district. It comes from the map edited in the in-game
// editor (mapspec.js): painted zones, drawn roads / paths / railways and landmarks.
// This module turns it into plain data — clipped road polylines, building lots along
// the streets, trees, farmland, water — rendered by environment.js / roadmesh.js /
// districts.js and used by the traffic and pedestrian simulations.

export { WORLD_HALF, linePts, curvePts };
const CORE = PLAY_HALF;         // centreline of the playable district's edge roads
const CORE_EDGE = CORE_HALF;    // outer edge of its sidewalks

/** Road cross-sections: c = half carriageway, sw = sidewalk width, lanes = offsets right of the centreline. */
export const ROAD_TYPES = {
  core: { c: 2, sw: 1.5, lanes: [1.0], main: true },
  main: { c: 2.4, sw: 1.6, lanes: [1.2], main: true },
  sec: { c: 2.0, sw: 1.4, lanes: [1.0], main: false },
  hwy: { c: 5.6, sw: 0, lanes: [1.5, 4.1], main: true },
};

export const ZONE_INFO = Object.fromEntries(ZONES.map((z) => [z.id || 'wild', z.name]));
ZONE_INFO.core = 'Centre (terrains constructibles)';

export const SPEC = loadSpec();
const AUTO = SPEC.auto !== false;   // fill streets with buildings and plant trees automatically
const GRIDZ = decodeZones(SPEC.zones);

export function zoneAt(x, z) {
  if (Math.abs(x) <= CORE_EDGE && Math.abs(z) <= CORE_EDGE) return 'core';
  const i = Math.floor((x + WORLD_HALF) / ZCELL), j = Math.floor((z + WORLD_HALF) / ZCELL);
  if (i < 0 || j < 0 || i >= ZN || j >= ZN) return 'wild';
  return ZONES[GRIDZ[j * ZN + i]].id || 'wild';
}
export const isWater = (x, z) => zoneAt(x, z) === 'water';

/** Keep only the runs of a polyline where `inside` holds (sampled every metre). */
function clipRuns(pts, inside, minLen = 12, closed = false) {
  const runs = [];
  let cur = null;
  const P = closed ? [...pts, pts[0]] : pts;
  for (let i = 0; i < P.length - 1; i++) {
    const [x0, z0] = P[i], [x1, z1] = P[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0)));
    for (let k = 0; k < n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, z = z0 + ((z1 - z0) * k) / n;
      if (inside(x, z)) { if (!cur) { cur = []; runs.push(cur); } cur.push([x, z]); } else cur = null;
    }
  }
  const last = P[P.length - 1];
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
export const PATHS = [];       // footpaths: {pts, w, kind: 'gravel' | 'paved', closed}
export const RAILS = [];       // railway lines: {pts, closed}
export const LOTS = [];        // generated buildings: {kind, x, z, ry, w, d, zone, seed}
export const TREES = [];       // [x, z, kind 'round' | 'pine', scale]
export const WATER_CELLS = []; // [x0, z0] corners of 10 m water cells
export const FIELDS = [];      // farmland plots: {x, z, w, d, ry, color}
export const CORE_LINES = [];  // core boulevards used by the traffic graph
export const CORE_EXITS = new Set(); // `${axis}|${line}|${side}`: district streets that leave the playable area

let rid = 0;
function road(pts, type, closed = false) {
  const r = { id: rid++, pts, type, closed, t: ROAD_TYPES[type] };
  ROADS_NET.push(r);
  return r;
}
// lines may not cross the playable district (they stop on its edge road) nor leave the map
const outsideCore = (x, z) => !(Math.abs(x) < CORE - 0.5 && Math.abs(z) < CORE - 0.5) && Math.abs(x) <= WORLD_HALF + 20 && Math.abs(z) <= WORLD_HALF + 20;
function clipLine(line) {
  const pts = expandLine(line, 2);
  if (pts.length < 2) return [];
  const all = pts.every(([x, z]) => outsideCore(x, z));
  if (all) return [{ pts: pts.filter((p, i) => i % 2 === 0 || i === pts.length - 1), closed: !!line.closed }];
  return clipRuns(pts, outsideCore, 6, !!line.closed).map((r) => ({ pts: r, closed: false }));
}

function generate() {
  // --- core boulevards (drawn by the street grid, listed here for the traffic graph)
  for (const v of [-CORE, -CELL / 2, CELL / 2, CORE]) {
    CORE_LINES.push({ pts: linePts(-CORE, v, CORE, v, 10), type: 'core' });
    CORE_LINES.push({ pts: linePts(v, -CORE, v, CORE, 10), type: 'core' });
  }

  // --- drawn lines
  for (const line of SPEC.roads) {
    for (const part of clipLine(line)) {
      if (line.type === 'path') PATHS.push({ pts: part.pts, w: 2.4, kind: zoneAt(...part.pts[0]) === 'park' ? 'gravel' : 'paved', closed: part.closed });
      else if (line.type === 'rail') RAILS.push(part);
      else if (ROAD_TYPES[line.type]) road(part.pts, line.type, part.closed);
    }
  }
  // which core streets continue outside (for the sidewalks / crossings of the edge roads)
  const lines = [-50, -30, -10, 10, 30, 50];
  for (const r of ROADS_NET) {
    if (r.closed) continue;
    for (const p of [r.pts[0], r.pts[r.pts.length - 1]]) {
      for (const side of [-1, 1]) {
        for (const v of lines) {
          if (Math.abs(p[1] - side * CORE) < 4 && Math.abs(p[0] - v) < 3) CORE_EXITS.add(`x|${v}|${side}`);
          if (Math.abs(p[0] - side * CORE) < 4 && Math.abs(p[1] - v) < 3) CORE_EXITS.add(`z|${v}|${side}`);
        }
      }
    }
  }

  for (const r of ROADS_NET) markPoly(r.pts, r.t.c + r.t.sw);
  for (const l of CORE_LINES) markPoly(l.pts, 4);
  for (let x = -CORE_EDGE; x <= CORE_EDGE; x += OC) for (let z = -CORE_EDGE; z <= CORE_EDGE; z += OC) markDisc(x, z, 0.5, 3);
  for (const rl of RAILS) markPoly(rl.closed ? [...rl.pts, rl.pts[0]] : rl.pts, 3.4, 3);
  for (const p of PATHS) markPoly(p.closed ? [...p.pts, p.pts[0]] : p.pts, p.w / 2 + 0.8, 1);

  // --- water cells
  for (let j = 0; j < ZN; j++) for (let i = 0; i < ZN; i++) {
    if (ZONES[GRIDZ[j * ZN + i]].id !== 'water') continue;
    const x0 = i * ZCELL - WORLD_HALF, z0 = j * ZCELL - WORLD_HALF;
    WATER_CELLS.push([x0, z0]);
    for (let x = x0 - 1; x <= x0 + ZCELL + 1; x += OC) for (let z = z0 - 1; z <= z0 + ZCELL + 1; z += OC) { const c = cell(x, z); if (c >= 0) occ[c] = 3; }
  }

  // --- objects placed by hand in the 3D editor
  for (const o of SPEC.objects || []) {
    if (isTreeKind(o.k)) { TREES.push([o.x, o.z, o.k === 'pine' ? 'pine' : 'round', o.s || 1]); markDisc(o.x, o.z, 1.2, 1); continue; }
    const def = CATALOG_ITEM[o.k];
    if (!def) continue;
    const s = o.s || 1, w = (o.w || def.w), d = (o.d || def.d);
    LOTS.push({ kind: o.k, x: o.x, z: o.z, ry: o.ry || 0, s, w, d, zone: zoneAt(o.x, o.z), seed: o.seed || 1 });
    markRect(o.x, o.z, w * s, d * s, o.ry || 0, 2);
  }

  // --- landmarks (placed before the generic lots)
  for (const sp of SPEC.specials || []) {
    const def = SPECIALS[sp.kind];
    if (!def) continue;
    LOTS.push({ kind: sp.kind, x: sp.x, z: sp.z, ry: sp.ry || 0, w: def.w, d: def.d, zone: zoneAt(sp.x, sp.z), seed: (LOTS.length + 1) * 7919 });
    markRect(sp.x, sp.z, def.w, def.d, sp.ry || 0, 2);
  }

  // --- farmland: square fields on free farm land
  const rf = rng(808);
  const colors = ['#d8c25a', '#9cc957', '#c8a24a', '#7fb24a', '#e2d27a'];
  for (let x = -WORLD_HALF; x < WORLD_HALF; x += 30) for (let z = -WORLD_HALF; z < WORLD_HALF; z += 30) {
    const w = 24 + rf() * 4, d = 24 + rf() * 4, cx = x + 15, cz = z + 15;
    if (zoneAt(cx - 12, cz - 12) !== 'farm' || zoneAt(cx + 12, cz + 12) !== 'farm' || zoneAt(cx - 12, cz + 12) !== 'farm' || zoneAt(cx + 12, cz - 12) !== 'farm') continue;
    if (!rectFree(cx, cz, w + 2, d + 2, 0)) continue;
    FIELDS.push({ x: cx, z: cz, w, d, ry: rf() < 0.5 ? 0 : Math.PI / 2, color: colors[(rf() * colors.length) | 0] });
    markRect(cx, cz, w + 1, d + 1, 0, 2);
  }

  // --- generic lots along every street, facing it
  const r = rng(2024);
  const placeAlong = (pts, half, opts = {}) => {
    let carry = r() * 4;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 1e-6) continue;
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
  if (AUTO) {
    for (const p of PATHS) placeAlong(p.closed ? [...p.pts, p.pts[0]] : p.pts, 2.6, { ped: true, only: 'ped' });
    for (const rd of ROADS_NET) if (rd.type !== 'hwy') placeAlong(rd.closed ? [...rd.pts, rd.pts[0]] : rd.pts, rd.t.c + rd.t.sw);
    // rows facing the playable district, along its edge roads
    placeAlong(linePts(-CORE, CORE, CORE, CORE, 2), 3.6, { sides: [-1] });
    placeAlong(linePts(CORE, -CORE, CORE, CORE, 2), 3.6, { sides: [-1] });
    placeAlong(linePts(-CORE, CORE, -CORE, -CORE, 2), 3.6, { sides: [-1] });
    placeAlong(linePts(-CORE, -CORE, CORE, -CORE, 2), 3.6, { sides: [1] });
  }

  // --- trees: forests, park groves, gardens and the countryside
  const rt = rng(99);
  const tree = (x, z, kind, s, minGap = 1) => {
    if (!isFree(x, z) || occAt(x + minGap, z) > 1 || occAt(x - minGap, z) > 1 || occAt(x, z + minGap) > 1 || occAt(x, z - minGap) > 1) return false;
    TREES.push([x, z, kind, s]);
    markDisc(x, z, 1.2, 1);
    return true;
  };
  const SPAN = WORLD_HALF + 80;
  for (let i = 0; i < 26000; i++) {
    const x = (rt() * 2 - 1) * SPAN, z = (rt() * 2 - 1) * SPAN;
    const zone = zoneAt(x, z);
    const out = Math.max(Math.abs(x), Math.abs(z)) - WORLD_HALF;
    if (!AUTO && out <= 0) continue; // hand-made world: only the horizon forest is automatic
    const dens = zone === 'wild' ? (out > 0 ? (out < 70 ? 0.3 : 0.05) : 0.05)
      : ({ forest: 0.55, park: 0.14, farm: 0.02, res: 0.05, ind: 0.015, cbd: 0.015, shop: 0.02 }[zone] ?? 0);
    if (rt() > dens) continue;
    const pine = zone === 'forest' || zone === 'wild' ? rt() < 0.6 : rt() < 0.15;
    tree(x, z, pine ? 'pine' : 'round', 0.75 + rt() * 0.6);
  }
  // tree-lined footpaths (outside the paved old town)
  for (const p of AUTO ? PATHS : []) {
    const pts = p.pts;
    for (let i = 1; i < pts.length - 1; i += 4) {
      const [x, z] = pts[i];
      if (zoneAt(x, z) === 'ped') continue;
      const dx = pts[i + 1][0] - pts[i - 1][0], dz = pts[i + 1][1] - pts[i - 1][1], l = Math.hypot(dx, dz) || 1;
      for (const s of [-3.4, 3.4]) {
        const tx = x - (dz / l) * s, tz = z + (dx / l) * s;
        if (occAt(tx, tz) <= 1 && zoneAt(tx, tz) !== 'water') TREES.push([tx, tz, 'round', 0.8 + rt() * 0.25]);
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
for (const [k, , w, d] of HOUSE_LIST) KINDS[k] = { size: () => [w, d], setback: 0.6, garden: k !== 'hBrickApt' && k !== 'hBlueApt' && k !== 'hTownPair' };
const MIX = {
  ped: [['oldtown', 5], ['cafe', 1.4], ['hTownPair', 1.6], ['hBlueApt', 1], ['hBrickApt', 0.8]],
  cbd: [['tower', 4], ['office', 3], ['plaza', 0.6]],
  shop: [['bigbox', 2], ['shoprow', 3], ['gas', 0.6]],
  ind: [['warehouse', 4], ['factory', 3], ['silo', 1.2], ['yard', 1.6]],
  res: [['chalet', 2], ['villa', 1.2], ['rowhouse', 0.6], ['apartment', 0.6], ['hColonial', 1.4], ['hCape', 1.4], ['hCraftsman', 1.4], ['hRanch', 1.1], ['hFarmhouse', 0.9],
    ['hDuplex', 1], ['hModern', 1], ['hCabin', 0.9], ['hBrickApt', 0.7], ['hBlueApt', 0.5], ['hTownPair', 0.7], ['hBeach', 0.4]],
  farm: [['barn', 1]],
};
function pickKind(zone, r, opts) {
  const mix = MIX[zone];
  if (!mix) return null;
  if (opts.only && zone !== opts.only) return null;
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
  if (!pedGraph) pedGraph = buildGraph(PATHS.map((p) => ({ pts: p.pts, closed: p.closed })), 3, 2);
  return pedGraph;
}

