import * as THREE from 'three';
import { MeshBuilder, rng } from '../models/builder.js';
import { ROADS_NET, PATHS, ALLEYS, WATER, R_RAIL, zoneAt, getRoadGraph, CORE_LINES } from './citymap.js';
import { PLAY_HALF, ROAD_Y } from '../game/config.js';

// Geometry for the district road network: curved carriageways, raised sidewalks with
// curbs (cut open at junctions), centre lines, motorway barriers, footpaths, the
// railway, the paved old town and turning circles. A few merged meshes in total.

const CORE_LIM = PLAY_HALF + 3.5;
const Y_MAIN = 0.075, Y_SEC = 0.05;

/** Simple growable geometry accumulator (positions + normals + uvs). */
class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  quad(a, b, c, d, nrm, uvs) {
    const o = this.p.length / 3;
    for (const v of [a, b, c, d]) this.p.push(v[0], v[1], v[2]);
    for (let k = 0; k < 4; k++) this.n.push(nrm[0], nrm[1], nrm[2]);
    if (uvs) for (const u of uvs) this.uv.push(u[0], u[1]);
    else for (const v of [a, b, c, d]) this.uv.push(v[0] / 2.2, v[2] / 2.2);
    // wind the triangles so that their face normal agrees with `nrm`
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const dot = (uy * vz - uz * vy) * nrm[0] + (uz * vx - ux * vz) * nrm[1] + (ux * vy - uy * vx) * nrm[2];
    if (dot >= 0) this.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
    else this.i.push(o, o + 2, o + 1, o, o + 3, o + 2);
  }
  mesh(mat, receive = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = receive;
    return m;
  }
}

/** Per-vertex unit tangents and right-hand normals of a polyline. */
function frames(pts, closed) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    out.push([tx, tz, -tz, tx]); // tangent, right normal
  }
  return out;
}

// ---------------------------------------------------------------------------
// Spatial index of carriageways, to cut sidewalks / markings at junctions
// ---------------------------------------------------------------------------
const HC = 12;
const hash = new Map();
const segs = [];
function indexLine(pts, closed, half, id) {
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const s = { ax: a[0], az: a[1], bx: b[0], bz: b[1], half, id };
    segs.push(s);
    const x0 = Math.floor((Math.min(a[0], b[0]) - half) / HC), x1 = Math.floor((Math.max(a[0], b[0]) + half) / HC);
    const z0 = Math.floor((Math.min(a[1], b[1]) - half) / HC), z1 = Math.floor((Math.max(a[1], b[1]) + half) / HC);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const k = x * 1000 + z;
      if (!hash.has(k)) hash.set(k, []);
      hash.get(k).push(s);
    }
  }
}
function segDist(px, pz, s) {
  const vx = s.bx - s.ax, vz = s.bz - s.az;
  const t = Math.max(0, Math.min(1, ((px - s.ax) * vx + (pz - s.az) * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(px - s.ax - vx * t, pz - s.az - vz * t);
}
/** True if (x, z) lies on the carriageway of a road other than `id` (with a margin). */
export function onOtherRoad(x, z, id, margin = 0.3) {
  const list = hash.get(Math.floor(x / HC) * 1000 + Math.floor(z / HC));
  if (!list) return false;
  for (const s of list) if (s.id !== id && segDist(x, z, s) < s.half + margin) return true;
  return false;
}
const inCore = (x, z) => Math.abs(x) < CORE_LIM && Math.abs(z) < CORE_LIM;

let indexed = false;
function ensureIndex() {
  if (indexed) return;
  indexed = true;
  for (const r of ROADS_NET) indexLine(r.pts, r.closed, r.t.c, r.id);
  CORE_LINES.forEach((l, k) => indexLine(l.pts, false, 2, 'core' + k));
}

export function buildRoadNetwork(renderer, paveTex) {
  ensureIndex();
  const group = new THREE.Group();
  const asphMain = new Geo(), asphSec = new Geo(), walks = new Geo(), curbs = new Geo(), marks = new Geo();
  const gravel = new Geo(), paved = new Geo(), steel = new Geo(), concrete = new Geo();
  const lamps = [];
  const up = [0, 1, 0];

  for (const r of ROADS_NET) {
    const { c, sw } = r.t;
    const pts = r.pts, F = frames(pts, r.closed);
    const y = r.type === 'sec' ? Y_SEC : Y_MAIN;
    const asph = r.type === 'sec' ? asphSec : asphMain;
    const n = r.closed ? pts.length : pts.length - 1;
    const P = (i, off, yy) => { const p = pts[i % pts.length], f = F[i % pts.length]; return [p[0] + f[2] * off, yy, p[1] + f[3] * off]; };
    let lampAcc = r.id * 5.3 % 13;
    for (let i = 0; i < n; i++) {
      const j = i + 1;
      const mx = (pts[i][0] + pts[j % pts.length][0]) / 2, mz = (pts[i][1] + pts[j % pts.length][1]) / 2;
      if (inCore(mx, mz)) continue;
      asph.quad(P(i, -c, y), P(i, c, y), P(j, c, y), P(j, -c, y), up);
      const segLen = Math.hypot(pts[j % pts.length][0] - pts[i][0], pts[j % pts.length][1] - pts[i][1]);
      const f = F[i];
      const junction = (off) => onOtherRoad(mx + f[2] * off, mz + f[3] * off, r.id, 0.4) || inCore(mx + f[2] * off, mz + f[3] * off);
      if (sw > 0) {
        for (const s of [-1, 1]) {
          const o0 = s * c, o1 = s * (c + sw);
          if (junction(s * (c + sw / 2)) || junction(s * (c + 0.2))) continue;
          walks.quad(P(i, o0, ROAD_Y), P(i, o1, ROAD_Y), P(j, o1, ROAD_Y), P(j, o0, ROAD_Y), up);
          // curb faces: towards the carriageway and towards the verge
          const ni = [-f[2] * s, 0, -f[3] * s];
          curbs.quad(P(i, o0, 0), P(i, o0, ROAD_Y), P(j, o0, ROAD_Y), P(j, o0, 0), ni, [[0, 0], [0, 1], [1, 1], [1, 0]]);
          curbs.quad(P(i, o1, ROAD_Y), P(i, o1, 0), P(j, o1, 0), P(j, o1, ROAD_Y), [-ni[0], 0, -ni[2]], [[0, 0], [0, 1], [1, 1], [1, 0]]);
        }
      } else {
        // motorway: concrete median barrier + guardrails, open at junctions
        if (!junction(0)) {
          for (const s of [-0.3, 0.3]) curbs.quad(P(i, s, 0), P(i, s, 0.85), P(j, s, 0.85), P(j, s, 0), [s > 0 ? f[2] : -f[2], 0, s > 0 ? f[3] : -f[3]], [[0, 0], [0, 1], [1, 1], [1, 0]]);
          concrete.quad(P(i, -0.3, 0.85), P(i, 0.3, 0.85), P(j, 0.3, 0.85), P(j, -0.3, 0.85), up);
        }
        for (const s of [-1, 1]) {
          const o = s * (c + 0.5);
          if (junction(o) || junction(s * (c - 0.5))) continue;
          steel.quad(P(i, o, 0.45), P(i, o, 0.8), P(j, o, 0.8), P(j, o, 0.45), [f[2] * -s, 0, f[3] * -s], [[0, 0], [0, 1], [1, 1], [1, 0]]);
          steel.quad(P(i, o, 0.8), P(i, o, 0.45), P(j, o, 0.45), P(j, o, 0.8), [f[2] * s, 0, f[3] * s], [[0, 0], [0, 1], [1, 1], [1, 0]]);
          // edge line
          marks.quad(P(i, s * (c - 0.35), y + 0.012), P(i, s * (c - 0.2), y + 0.012), P(j, s * (c - 0.2), y + 0.012), P(j, s * (c - 0.35), y + 0.012), up);
        }
      }
      // lane markings: dashed centre line (main roads), lane dividers on the motorway
      if (r.t.main && (i % 2 === 0) && !junction(0)) {
        const offs = r.type === 'hwy' ? [-2.8, 2.8] : [0];
        for (const o of offs) marks.quad(P(i, o - 0.08, y + 0.012), P(i, o + 0.08, y + 0.012), P(j, o + 0.08, y + 0.012), P(j, o - 0.08, y + 0.012), up);
      }
      // street lamps
      if (sw > 0) {
        lampAcc += segLen;
        const step = r.t.main ? 16 : 22;
        if (lampAcc > step) {
          lampAcc = 0;
          for (const s of r.t.main ? [-1, 1] : [(i / 7) % 2 < 1 ? 1 : -1]) {
            const off = s * (c + sw - 0.4);
            if (junction(off) || junction(s * c)) continue;
            const lx = mx + f[2] * off, lz = mz + f[3] * off;
            lamps.push([lx, lz, Math.atan2(-f[3] * s, f[2] * s)]);
          }
        }
      }
    }
  }

  // turning circles at the dead ends of district streets
  const g = getRoadGraph();
  const tb = new MeshBuilder({ lod: 1 });
  for (const node of g.nodes) {
    if (node.edges.length !== 1 || inCore(node.x, node.z)) continue;
    const e = node.edges[0];
    if (e.line.type !== 'sec') continue;
    tb.cyl(6.4, 6.4, ROAD_Y, '#c9c3b8', { x: node.x, z: node.z }, 28);
    tb.cyl(6.1, 6.1, ROAD_Y + 0.004, '#8f8473', { x: node.x, z: node.z }, 28);
    tb.cyl(4.6, 4.6, ROAD_Y + 0.008, '#61666e', { x: node.x, z: node.z }, 28);
    tb.cyl(1.8, 1.8, 0.5, '#7cbc4f', { x: node.x, z: node.z }, 16);
    tb.blob(1.2, '#4ca346', { x: node.x, y: 1.0, z: node.z }, 1);
  }
  const turning = tb.build({ castShadow: false });
  group.add(turning);

  // footpaths (gravel in parks, paved promenades between avenue lanes)
  for (const p of PATHS) {
    const pts = p.pts, F = frames(pts, p.closed), h = p.w / 2;
    const geo = p.kind === 'paved' ? paved : gravel;
    const n = p.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % pts.length;
      const mx = (pts[i][0] + pts[j][0]) / 2, mz = (pts[i][1] + pts[j][1]) / 2;
      if (onOtherRoad(mx, mz, -1, 0.2) || zoneAt(mx, mz) === 'ped' || inCore(mx, mz)) continue;
      const a = pts[i], b = pts[j], fa = F[i], fb = F[j];
      geo.quad([a[0] - fa[2] * h, 0.04, a[1] - fa[3] * h], [a[0] + fa[2] * h, 0.04, a[1] + fa[3] * h],
        [b[0] + fb[2] * h, 0.04, b[1] + fb[3] * h], [b[0] - fb[2] * h, 0.04, b[1] - fb[3] * h], up);
      if (p.linear && i % 6 === 0) lamps.push([mx + F[i][2] * (h + 0.6), mz + F[i][3] * (h + 0.6), Math.atan2(-F[i][3], F[i][2])]);
      else if (!p.linear && i % 9 === 0) lamps.push([mx + F[i][2] * (h + 0.5), mz + F[i][3] * (h + 0.5), Math.atan2(-F[i][3], F[i][2])]);
    }
  }
  // old-town alleys get lamps too (the ground there is paved already)
  for (const pts of ALLEYS) {
    const F = frames(pts, false);
    for (let i = 2; i < pts.length - 1; i += 6) {
      const [x, z] = pts[i];
      if (zoneAt(x, z) !== 'ped') continue;
      lamps.push([x + F[i][2] * 2.2, z + F[i][3] * 2.2, Math.atan2(-F[i][3], F[i][2])]);
    }
  }

  // ---------------- railway ring ----------------
  const rail = new Geo(), ballast = new Geo();
  const RN = 720;
  for (let i = 0; i < RN; i++) {
    const a0 = (i / RN) * Math.PI * 2, a1 = ((i + 1) / RN) * Math.PI * 2;
    const ca0 = Math.cos(a0), sa0 = Math.sin(a0), ca1 = Math.cos(a1), sa1 = Math.sin(a1);
    const at = (a, R, y) => [Math.cos(a) * R, y, Math.sin(a) * R];
    const mx = ((ca0 + ca1) / 2) * R_RAIL, mz = ((sa0 + sa1) / 2) * R_RAIL;
    const crossing = onOtherRoad(mx, mz, -1, 1.2);
    const u0 = (i / RN) * 2 * Math.PI * R_RAIL / 2.4, u1 = ((i + 1) / RN) * 2 * Math.PI * R_RAIL / 2.4;
    if (!crossing) {
      ballast.quad(at(a0, R_RAIL - 1.9, 0.14), at(a0, R_RAIL + 1.9, 0.14), at(a1, R_RAIL + 1.9, 0.14), at(a1, R_RAIL - 1.9, 0.14), up, [[u0, 0], [u0, 1], [u1, 1], [u1, 0]]);
      for (const R of [R_RAIL - 1.9, R_RAIL + 1.9]) {
        const s = R > R_RAIL ? 1 : -1;
        ballast.quad(at(a0, R + s * 0.5, 0), at(a0, R, 0.14), at(a1, R, 0.14), at(a1, R + s * 0.5, 0), [ca0 * s * 0.3, 1, sa0 * s * 0.3], [[u0, 0.02], [u0, 0.02], [u1, 0.02], [u1, 0.02]]);
      }
    }
    for (const R of [R_RAIL - 0.72, R_RAIL + 0.72]) {
      rail.quad(at(a0, R - 0.06, 0.3), at(a0, R + 0.06, 0.3), at(a1, R + 0.06, 0.3), at(a1, R - 0.06, 0.3), up);
      rail.quad(at(a0, R + 0.06, 0.3), at(a0, R + 0.06, crossing ? 0.06 : 0.14), at(a1, R + 0.06, crossing ? 0.06 : 0.14), at(a1, R + 0.06, 0.3), [ca0, 0, sa0]);
      rail.quad(at(a0, R - 0.06, crossing ? 0.06 : 0.14), at(a0, R - 0.06, 0.3), at(a1, R - 0.06, 0.3), at(a1, R - 0.06, crossing ? 0.06 : 0.14), [-ca0, 0, -sa0]);
    }
  }

  // ---------------- paved old town ----------------
  const town = new Geo();
  const S = 1.5;
  for (let x = -160; x < 160; x += S) for (let z = -160; z < -PLAY_HALF; z += S) {
    if (zoneAt(x + S / 2, z + S / 2) !== 'ped' || onOtherRoad(x + S / 2, z + S / 2, -1, 0.5)) continue;
    town.quad([x, 0.03, z], [x + S, 0.03, z], [x + S, 0.03, z + S], [x, 0.03, z + S], up, [[x / 3, z / 3], [(x + S) / 3, z / 3], [(x + S) / 3, (z + S) / 3], [x / 3, (z + S) / 3]]);
  }

  // ---------------- water ----------------
  const waterMat = new THREE.MeshStandardMaterial({ color: '#2f9fc7', roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.9 });
  const rim = new MeshBuilder({ lod: 1 });
  const rr = rng(31);
  for (const w of WATER) {
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), waterMat);
    water.scale.set(w.rx, 1, w.rz);
    water.position.set(w.x, 0.05, w.z);
    water.receiveShadow = true;
    group.add(water);
    const n = Math.round((w.rx + w.rz) * 1.6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      rim.blob(0.55 + rr() * 0.5, '#b0aaa0', { x: w.x + Math.cos(a) * (w.rx + 0.3), y: 0, z: w.z + Math.sin(a) * (w.rz + 0.3), sy: 0.5 }, 1);
      if (i % 4 === 0) rim.cyl(0.05, 0.05, 1.6, '#5a8f3a', { x: w.x + Math.cos(a) * (w.rx - 1.5), y: -0.3, z: w.z + Math.sin(a) * (w.rz - 1.2) }, 4);
    }
    // wooden jetty
    rim.box(2.6, 0.2, 9, '#9c6b3f', { x: w.x + w.rx - 3, y: 0.3, z: w.z, ry: Math.PI / 2 });
    for (let i = 0; i < 4; i++) rim.cyl(0.15, 0.15, 1.2, '#6f4627', { x: w.x + w.rx - i * 2.4, y: -0.6, z: w.z - 1.2 }, 6);
  }
  group.add(rim.build());

  const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.92, ...o });
  group.add(asphMain.mesh(mat({ color: '#4a4f57' })));
  group.add(asphSec.mesh(mat({ color: '#61666e' })));
  group.add(walks.mesh(mat({ map: paveTex, roughness: 0.9 })));
  group.add(curbs.mesh(mat({ color: '#c9c3b8', roughness: 0.8 })));
  group.add(marks.mesh(mat({ color: '#f1f3f5', roughness: 0.7 })));
  group.add(gravel.mesh(mat({ color: '#d9cbb3', roughness: 1 })));
  group.add(paved.mesh(mat({ color: '#e3dccd', roughness: 0.9 })));
  group.add(concrete.mesh(mat({ color: '#d6d3cc' })));
  group.add(steel.mesh(mat({ color: '#b8c0c8', metalness: 0.6, roughness: 0.4 })));
  group.add(ballast.mesh(mat({ map: makeSleeperTexture(renderer), roughness: 1 })));
  group.add(rail.mesh(mat({ color: '#8d949c', metalness: 0.8, roughness: 0.35 })));
  group.add(town.mesh(mat({ map: makeCobbleTexture(renderer), roughness: 0.95 })));
  return { group, lamps };
}

/** Freight / passenger train running on the circular railway (one rotating group). */
export function buildTrain() {
  const b = new MeshBuilder({ lod: 1 });
  const cars = 7, len = 13;
  for (let k = 0; k < cars; k++) {
    const a = -(k * (len + 0.8)) / R_RAIL;
    const loco = k === 0;
    b.group({ x: Math.cos(a) * R_RAIL, z: Math.sin(a) * R_RAIL, ry: -a }, () => {
      // local +z = direction of travel (counter-clockwise), x = radial
      const body = loco ? '#e0573f' : k % 3 === 0 ? '#f1f3f5' : '#e0573f';
      b.box(2.9, 0.6, len, '#2e3440', { y: 0.4, r: 0.1 });
      b.rbox(3.1, 3.4, len - 0.4, 0.5, body, { y: 0.9, mat: 'soft' });
      b.box(3.14, 0.9, len - 1.6, '#3e5874', { y: 2.3, mat: 'lit', sharp: true });
      b.box(3.16, 0.25, len - 0.6, '#f8f9fa', { y: 1.6, sharp: true });
      b.rbox(2.9, 0.4, len - 1, 0.18, '#9aa4b1', { y: 4.3 });
      if (loco) {
        b.rbox(3.0, 1.6, 1.4, 0.5, '#2e3440', { y: 2.4, z: len / 2 - 0.4, mat: 'glass' });
        b.box(0.1, 1.4, 1.6, '#2e3440', { y: 4.6, x: 0.3, z: 1, sharp: true });
        b.box(1.6, 0.08, 0.1, '#2e3440', { y: 6.0, x: 0.3, z: 1, sharp: true });
        b.sphere(0.2, '#fff6d6', { x: -0.9, y: 1.3, z: len / 2 - 0.15, mat: 'neon' }, 8, 6);
        b.sphere(0.2, '#fff6d6', { x: 0.9, y: 1.3, z: len / 2 - 0.15, mat: 'neon' }, 8, 6);
      }
    });
  }
  const g = b.build();
  g.traverse((m) => { if (m.isMesh) m.frustumCulled = false; });
  return g;
}

function makeSleeperTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#9a948a';
  g.fillRect(0, 0, 128, 64);
  const r = rng(9);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(${60 + r() * 80},${60 + r() * 70},${55 + r() * 60},0.5)`;
    g.fillRect(r() * 128, r() * 64, 2, 2);
  }
  // sleepers across the track (u runs along the track, v across)
  for (let k = 0; k < 4; k++) { g.fillStyle = '#6b5a48'; g.fillRect(k * 32 + 8, 10, 14, 44); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function makeCobbleTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#a89a84';
  g.fillRect(0, 0, 256, 256);
  const r = rng(12);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const off = y % 2 ? 16 : 0;
    g.fillStyle = `hsl(${30 + r() * 12}, ${14 + r() * 12}%, ${62 + r() * 12}%)`;
    const px = x * 32 + off, py = y * 32;
    g.beginPath();
    g.roundRect(px + 2, py + 2, 28, 28, 7);
    g.fill();
    if (px + 32 > 256) { g.beginPath(); g.roundRect(px - 256 + 2, py + 2, 28, 28, 7); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
