// Map description edited with the in-game map editor (and the default city).
// Pure data, no three.js: zones are painted on a 10 m grid, roads / paths / railways
// are polylines of control points, landmarks are placed objects. citymap.js turns it
// into the 3D city (roads, lots, trees, water) when the game starts.

import { PLAY_HALF } from '../game/config.js';

export const MAP_KEY = 'empire-map-v1';
export const WORLD_HALF = 330;          // the editable square world: x, z in [-330, 330]
export const ZCELL = 10;                // zone painting resolution (m)
export const ZN = (2 * WORLD_HALF) / ZCELL;
export const CORE_HALF = PLAY_HALF + 4; // the playable district (fixed, not editable)

/** Zones that can be painted. `''` = countryside (unpainted). */
export const ZONES = [
  { id: '', name: 'Campagne', color: '#9fcf6e' },
  { id: 'ped', name: 'Zone piétonne', color: '#d9b98c' },
  { id: 'cbd', name: 'Affaires (tours)', color: '#6f8fc9' },
  { id: 'shop', name: 'Commerces', color: '#e48fc0' },
  { id: 'ind', name: 'Industrie', color: '#b8a067' },
  { id: 'res', name: 'Habitations', color: '#f2c26b' },
  { id: 'park', name: 'Parc', color: '#62c26a' },
  { id: 'forest', name: 'Forêt', color: '#2f7d4a' },
  { id: 'farm', name: 'Agricole', color: '#d8d06a' },
  { id: 'water', name: 'Eau', color: '#3ba7d8' },
];
const ZCHAR = '.pcsirkfaw'; // one character per zone in the serialized grid
export const zoneIndex = (id) => Math.max(0, ZONES.findIndex((z) => z.id === id));

/** Road kinds the editor can draw. */
export const LINE_TYPES = {
  main: { name: 'Avenue', width: 7 },
  sec: { name: 'Rue', width: 7 },
  hwy: { name: 'Autoroute', width: 12.2 },
  path: { name: 'Chemin piéton', width: 2.6 },
  rail: { name: 'Voie ferrée', width: 4.6 },
};

/** Landmarks: footprint w × d (front = +z before rotation). */
export const SPECIALS = {
  church: { name: 'Église', w: 14, d: 22 },
  station: { name: 'Gare', w: 40, d: 13 },
  mall: { name: 'Centre commercial', w: 42, d: 34 },
  parking: { name: 'Parking', w: 38, d: 30 },
  stadium: { name: 'Stade', w: 46, d: 32 },
  plant: { name: 'Centrale', w: 34, d: 22 },
  farmhouse: { name: 'Ferme', w: 22, d: 16 },
  playground: { name: 'Place de jeux', w: 14, d: 12 },
  fountain: { name: 'Fontaine', w: 22, d: 22 },
};

/** Everything the 3D editor can place: kind → footprint (w × d m) and category. */
export const HOUSE_LIST = [
  ['hColonial', 'Maison coloniale', 13, 12], ['hCape', 'Maison à lucarnes', 10, 13], ['hCraftsman', 'Bungalow à porche', 11, 13],
  ['hRanch', 'Plain-pied avec garage', 15, 11], ['hFarmhouse', 'Ferme blanche', 12, 13], ['hBeach', 'Maison sur pilotis', 11, 11],
  ['hTownPair', 'Maisons de ville', 10, 11], ['hDuplex', 'Duplex', 13, 12], ['hBrickApt', 'Immeuble en briques', 11, 11],
  ['hModern', 'Maison moderne', 11, 11], ['hCabin', 'Chalet en rondins', 12, 12], ['hBlueApt', 'Immeuble bleu', 10, 10],
];
export const CATALOG = [
  { cat: 'Maisons', items: HOUSE_LIST },
  { cat: 'Bâtiments', items: [
    ['oldtown', 'Maison de vieille ville', 8, 10], ['cafe', 'Café-terrasse', 9, 9], ['shoprow', 'Boutiques', 18, 11],
    ['apartment', 'Immeuble', 19, 13], ['rowhouse', 'Maisons mitoyennes', 17, 12], ['chalet', 'Chalet', 12, 14],
    ['villa', 'Villa avec piscine', 14, 15], ['tower', 'Tour de bureaux', 15, 15], ['office', 'Bureaux', 20, 13],
    ['bigbox', 'Grande surface', 30, 34], ['gas', 'Station-service', 16, 14], ['warehouse', 'Entrepôt', 28, 20],
    ['factory', 'Usine', 25, 20], ['silo', 'Silos', 13, 12], ['yard', 'Dépôt de conteneurs', 22, 16], ['barn', 'Grange', 14, 11],
  ] },
  { cat: 'Monuments', items: Object.entries(SPECIALS).map(([k, v]) => [k, v.name, v.w, v.d]).concat([['plaza', 'Petite place', 14, 12]]) },
  { cat: 'Nature', items: [['tree', 'Arbre feuillu', 3, 3], ['pine', 'Sapin', 3, 3], ['grove', 'Bosquet (8 arbres)', 14, 14], ['bush', 'Buisson', 2, 2], ['rock', 'Rocher', 2.5, 2.5], ['hedgerow', 'Haie', 6, 1]] },
  { cat: 'Mobilier', items: [['lamp', 'Lampadaire', 1, 1], ['bench', 'Banc', 2, 1], ['car', 'Voiture garée', 2, 4], ['flowers', 'Bac à fleurs', 3, 1.5], ['busstop', 'Arrêt de bus', 3, 1.2], ['kiosk', 'Kiosque', 3.4, 3]] },
];
export const CATALOG_ITEM = Object.fromEntries(CATALOG.flatMap((c) => c.items.map(([k, name, w, d]) => [k, { kind: k, name, w, d, cat: c.cat }])));
export const isTreeKind = (k) => k === 'tree' || k === 'pine';

// ---------------------------------------------------------------------------
// Zone grid helpers
// ---------------------------------------------------------------------------
export function emptyZones() { return new Uint8Array(ZN * ZN); }
export const cellOf = (x, z) => [Math.floor((x + WORLD_HALF) / ZCELL), Math.floor((z + WORLD_HALF) / ZCELL)];
export const inCoreCell = () => false;
const inDefaultCore = (i, j) => {
  const x0 = i * ZCELL - WORLD_HALF, z0 = j * ZCELL - WORLD_HALF;
  return x0 + ZCELL > -CORE_HALF && x0 < CORE_HALF && z0 + ZCELL > -CORE_HALF && z0 < CORE_HALF;
};
export function encodeZones(grid) {
  let s = '';
  for (let k = 0; k < grid.length; k++) s += ZCHAR[grid[k]] || '.';
  return s;
}
export function decodeZones(str) {
  const g = emptyZones();
  if (typeof str !== 'string') return g;
  for (let k = 0; k < Math.min(str.length, g.length); k++) g[k] = Math.max(0, ZCHAR.indexOf(str[k]));
  return g;
}
function fillRect(grid, x0, z0, x1, z1, id) {
  const v = zoneIndex(id);
  for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x += ZCELL) {
    for (let z = Math.min(z0, z1); z < Math.max(z0, z1); z += ZCELL) {
      const [i, j] = cellOf(x + 0.5, z + 0.5);
      if (i >= 0 && j >= 0 && i < ZN && j < ZN && !inDefaultCore(i, j)) grid[j * ZN + i] = v;
    }
  }
}

/** Rounded rectangle (closed loop of control points), used for ring roads. */
function roundedRect(h, r) {
  const pts = [];
  const corner = (cx, cz, a0) => { for (let k = 0; k <= 8; k++) { const a = a0 + (k / 8) * (Math.PI / 2); pts.push([Math.round(cx + Math.cos(a) * r), Math.round(cz + Math.sin(a) * r)]); } };
  corner(h - r, h - r, 0);
  corner(-h + r, h - r, Math.PI / 2);
  corner(-h + r, -h + r, Math.PI);
  corner(h - r, -h + r, Math.PI * 1.5);
  return pts;
}

// ---------------------------------------------------------------------------
// Default city: rectangular districts, a boulevard and a motorway loop
// ---------------------------------------------------------------------------
export function defaultSpec() {
  const z = emptyZones();
  // big blocks (north = −z)
  fillRect(z, -330, -330, -110, -110, 'park');
  fillRect(z, -110, -330, 110, -110, 'cbd');
  fillRect(z, 110, -330, 330, -110, 'park');
  fillRect(z, -330, -110, -110, 110, 'res');
  fillRect(z, 110, -110, 330, 110, 'shop');
  fillRect(z, -330, 110, -110, 330, 'farm');
  fillRect(z, -110, 110, 110, 330, 'ind');
  fillRect(z, 110, 110, 330, 330, 'forest');
  // ring between the district and the boulevard
  fillRect(z, -110, -110, 110, -74, 'ped');
  fillRect(z, -60, -150, 60, -110, 'ped');
  fillRect(z, -110, 74, 110, 110, 'ind');
  fillRect(z, 74, -110, 110, 110, 'shop');
  fillRect(z, -110, -110, -74, 110, 'res');
  // green corners and the forest belt along the edge
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) fillRect(z, sx * 74, sz * 74, sx * 110, sz * 110, 'park');
  fillRect(z, -330, -330, 330, -300, 'forest');
  fillRect(z, -330, 300, 330, 330, 'forest');
  fillRect(z, -330, -330, -300, 330, 'forest');
  fillRect(z, 300, -330, 330, 330, 'forest');
  // lake in the north-east park, pond in the north-west park
  fillRect(z, 240, -200, 270, -170, 'water');
  fillRect(z, 250, -210, 260, -160, 'water');
  fillRect(z, -200, -200, -170, -180, 'water');
  fillRect(z, -190, -210, -180, -170, 'water');

  const roads = [
    { type: 'main', closed: true, smooth: false, pts: roundedRect(150, 45) },
    { type: 'hwy', closed: true, smooth: false, pts: roundedRect(285, 70) },
    { type: 'rail', closed: true, smooth: false, pts: roundedRect(228, 60) },
    // avenues out of the district
    { type: 'main', pts: [[10, 70], [10, 285]] }, { type: 'main', pts: [[-10, 70], [-10, 285]] },
    { type: 'main', pts: [[70, 10], [285, 10]] }, { type: 'main', pts: [[70, -10], [285, -10]] },
    { type: 'main', pts: [[-70, 10], [-285, 10]] }, { type: 'main', pts: [[-70, -10], [-285, -10]] },
    { type: 'main', pts: [[10, -150], [10, -285]] }, { type: 'main', pts: [[-10, -150], [-10, -285]] },
    // business district grid
    { type: 'sec', pts: [[-110, -200], [110, -200]] }, { type: 'sec', pts: [[-110, -255], [110, -255]] },
    { type: 'sec', pts: [[-60, -150], [-60, -285]] }, { type: 'sec', pts: [[60, -150], [60, -285]] },
    // shopping
    { type: 'sec', pts: [[200, -110], [200, 110]] }, { type: 'sec', pts: [[255, -110], [255, 110]] },
    // industry
    { type: 'sec', pts: [[-110, 180], [110, 180]] },
    { type: 'sec', pts: [[60, 110], [60, 285]] }, { type: 'sec', pts: [[-60, 110], [-60, 285]] },
    // housing: winding streets
    { type: 'sec', smooth: true, pts: [[-150, -80], [-190, -100], [-230, -70], [-260, -95], [-285, -80]] },
    { type: 'sec', smooth: true, pts: [[-150, 70], [-185, 95], [-225, 60], [-265, 90], [-285, 75]] },
    { type: 'sec', pts: [[-200, -110], [-200, 110]] }, { type: 'sec', pts: [[-255, -110], [-255, 110]] },
    // old-town alleys and the square
    { type: 'path', pts: [[0, -74], [0, -112]] },
    { type: 'path', pts: [[-50, -74], [-50, -112]] }, { type: 'path', pts: [[50, -74], [50, -112]] },
    { type: 'path', pts: [[-30, -74], [-30, -112]] }, { type: 'path', pts: [[30, -74], [30, -112]] },
    { type: 'path', pts: [[-100, -112], [100, -112]] },
    { type: 'path', pts: [[-100, -78], [100, -78]] },
    // park paths
    { type: 'path', closed: true, smooth: true, pts: [[236, -218], [276, -218], [276, -150], [236, -150]] },
    { type: 'path', smooth: true, pts: [[155, -125], [200, -130], [236, -150]] },
    { type: 'path', smooth: true, pts: [[-155, -150], [-175, -165], [-205, -165]] },
    { type: 'path', smooth: true, pts: [[155, 160], [190, 200], [230, 190], [280, 235]] },
    { type: 'path', smooth: true, pts: [[-155, 160], [-200, 175], [-215, 222]] },
    // promenades between the two lanes of each avenue
    { type: 'path', pts: [[0, 74], [0, 280]] }, { type: 'path', pts: [[74, 0], [280, 0]] },
    { type: 'path', pts: [[-74, 0], [-280, 0]] }, { type: 'path', pts: [[0, -156], [0, -280]] },
  ];
  const specials = [
    { kind: 'fountain', x: 0, z: -127, ry: 0 },
    { kind: 'church', x: 32, z: -132, ry: 0 },
    { kind: 'station', x: 35, z: -242, ry: Math.PI },
    { kind: 'mall', x: 176, z: 50, ry: -Math.PI / 2 },
    { kind: 'parking', x: 176, z: -50, ry: -Math.PI / 2 },
    { kind: 'plant', x: 35, z: 262, ry: Math.PI },
    { kind: 'stadium', x: -190, z: -135, ry: 0 },
    { kind: 'farmhouse', x: -235, z: 230, ry: 0 },
    { kind: 'playground', x: 255, z: -132, ry: 0 },
  ];
  return { v: 1, zones: encodeZones(z), roads: [...defaultCoreRoads(), ...roads], specials, objects: [], auto: true, plots: defaultPlots(), hq: { ...HQ_DEFAULT } };
}

/** A blank world: grass only, nothing generated. */
export function emptySpec() {
  return { v: 1, zones: encodeZones(emptyZones()), roads: [], specials: [], objects: [], auto: false, plots: [], hq: { x: 0, z: 0, ry: 0 } };
}

// ---------------------------------------------------------------------------
// The playable district: building lots ("terrains constructibles"), HQ, its streets.
// Everything is editable; ids of the default lots keep the old "i,j" keys so saves
// made before the editor still match.
// ---------------------------------------------------------------------------
export const PLOT_SIZE = 13;
export const HQ_DEFAULT = { x: 0, z: 0, ry: 0 };
export function defaultPlots() {
  const plots = [];
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
    if (i === 0 && j === 0) continue;
    plots.push({ id: `${i},${j}`, x: i * 20, z: j * 20, ry: 0, zone: Math.abs(i) === 3 || j === -3 ? 'ZI' : 'ZM' });
  }
  return plots;
}
export function defaultCoreRoads() {
  const roads = [];
  for (const v of [-70, -50, -30, -10, 10, 30, 50, 70]) {
    const type = Math.abs(v) === 10 || Math.abs(v) === 70 ? 'main' : 'sec';
    roads.push({ type, pts: [[-70, v], [70, v]] }, { type, pts: [[v, -70], [v, 70]] });
  }
  return roads;
}
/** Older saved maps had a fixed district: give them its lots, HQ and streets. */
function upgradeSpec(s) {
  if (!Array.isArray(s.plots)) {
    s.plots = defaultPlots();
    s.hq = { ...HQ_DEFAULT };
    s.roads = [...defaultCoreRoads(), ...s.roads];
  }
  s.hq ||= { ...HQ_DEFAULT };
  return s;
}

export function loadSpec() {
  try {
    const s = JSON.parse(localStorage.getItem(MAP_KEY) || 'null');
    if (s && s.v === 1 && Array.isArray(s.roads)) return upgradeSpec(s);
  } catch (e) { /* storage unavailable or corrupt */ }
  return defaultSpec();
}
export function saveSpec(spec) {
  try { localStorage.setItem(MAP_KEY, JSON.stringify(spec)); return true; } catch (e) { return false; }
}
export function clearSpec() {
  try { localStorage.removeItem(MAP_KEY); } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Polylines
// ---------------------------------------------------------------------------
export function linePts(x0, z0, x1, z1, step = 3) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n]);
  return pts;
}
/**
 * Smooth curve through control points: centripetal Catmull-Rom (no loops or cusps even
 * when the points are unevenly spaced), resampled every `step` m.
 */
export function curvePts(ctrl, step = 2.5, closed = false) {
  const n0 = ctrl.length;
  const at = (i) => {
    if (closed) return ctrl[(i + n0) % n0];
    if (i < 0) return [2 * ctrl[0][0] - ctrl[1][0], 2 * ctrl[0][1] - ctrl[1][1]];
    if (i >= n0) return [2 * ctrl[n0 - 1][0] - ctrl[n0 - 2][0], 2 * ctrl[n0 - 1][1] - ctrl[n0 - 2][1]];
    return ctrl[i];
  };
  const out = [];
  const segs = closed ? n0 : n0 - 1;
  const knot = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
  const lerp = (a, b, ta, tb, t) => {
    const k = (t - ta) / (tb - ta || 1);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = t1 + ((t2 - t1) * k) / n;
      const a1 = lerp(p0, p1, t0, t1, t), a2 = lerp(p1, p2, t1, t2, t), a3 = lerp(p2, p3, t2, t3, t);
      const b1 = lerp(a1, a2, t0, t2, t), b2 = lerp(a2, a3, t1, t3, t);
      out.push(lerp(b1, b2, t1, t2, t));
    }
  }
  if (!closed) out.push(ctrl[n0 - 1].slice());
  return out;
}
/** Dense polyline of a drawn line (straight segments, or a curve when `smooth`). */
export function expandLine(line, step = 3) {
  const c = line.pts;
  if (c.length < 2) return [];
  if (line.smooth && c.length > 2) return curvePts(c, step, !!line.closed);
  const out = [];
  const n = line.closed ? c.length : c.length - 1;
  for (let i = 0; i < n; i++) {
    const a = c[i], b = c[(i + 1) % c.length];
    const seg = linePts(a[0], a[1], b[0], b[1], step);
    if (i > 0) seg.shift();
    out.push(...seg);
  }
  if (line.closed) out.pop(); // the loop closes on its first point
  return out;
}
